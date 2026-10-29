import { beforeEach, describe, expect, it } from "vitest";
import { execute, one, query, save } from "../src/lib/db";
import { addMonths, dateInMonth, toCents } from "../src/lib/format";
import { applyMapping, guessMapping, importKey, parseCSVText, parseOFX } from "../src/lib/importers";
import { buildReport } from "../src/lib/reports";
import {
  budgetForMonth, dueAlerts, generateRecurring, invoiceDueDate, listAccounts, listTransactions,
  monthSummary, monthlySeries, payInvoice, projectGoal, requiredMonthly, saveTransaction, setBudget, totalsByCategory,
} from "../src/lib/repo";
import { resetDb } from "./mock-tauri";
import { toCSV, toPDF } from "../src/lib/export";
import { writeFileSync } from "node:fs";

const cat = async (name: string) => (await one<{ id: number }>("SELECT id FROM categories WHERE name = ?", [name]))!.id;

beforeEach(() => {
  resetDb();
});

describe("formatação", () => {
  it("converte valores brasileiros para centavos", () => {
    expect(toCents("1.234,56")).toBe(123456);
    expect(toCents("R$ -10,5")).toBe(-1050);
    expect(toCents("99.90")).toBe(9990);
    expect(toCents(12.34)).toBe(1234);
  });
  it("ajusta o dia ao fim do mês", () => {
    expect(dateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

describe("migrações", () => {
  it("cria categorias padrão e a carteira", async () => {
    const cats = await query("SELECT * FROM categories");
    expect(cats.length).toBeGreaterThan(20);
    const accs = await listAccounts();
    expect(accs[0].name).toBe("Carteira");
  });
});

describe("cartão de crédito", () => {
  it("calcula a fatura pela data de fechamento", () => {
    // fecha dia 5, vence dia 12
    expect(invoiceDueDate("2026-10-03", 5, 12)).toBe("2026-10-12");
    expect(invoiceDueDate("2026-10-06", 5, 12)).toBe("2026-11-12");
    // fecha dia 25, vence dia 5 do mês seguinte
    expect(invoiceDueDate("2026-10-20", 25, 5)).toBe("2026-11-05");
    expect(invoiceDueDate("2026-10-26", 25, 5)).toBe("2026-12-05");
  });

  it("parcela compras e paga a fatura", async () => {
    const card = await save("accounts", { name: "Nubank", type: "cartao_credito", credit_limit: 500000, closing_day: 5, due_day: 12 });
    await saveTransaction({
      kind: "despesa", description: "Geladeira", amount: 300001, date: "2026-10-10", status: "pago",
      category_id: null, account_id: card, scope: "familiar", member_id: null, installments: 3,
    });
    const txs = await listTransactions({ accountId: card });
    expect(txs).toHaveLength(3);
    expect(txs.map((t) => t.date).sort()).toEqual(["2026-11-12", "2026-12-12", "2027-01-12"]);
    expect(txs.reduce((s, t) => s + t.amount, 0)).toBe(300001);
    expect(txs.every((t) => t.status === "pendente")).toBe(true);

    const [acc] = (await listAccounts()).filter((a) => a.id === card);
    expect(acc.balance).toBe(300001);

    await payInvoice(card, "2026-11-12");
    const [after] = (await listAccounts()).filter((a) => a.id === card);
    expect(after.balance).toBe(300001 - txs.find((t) => t.date === "2026-11-12")!.amount);
  });
});

describe("recorrências", () => {
  it("gera compromissos e rendas sem duplicar", async () => {
    const moradia = await cat("Financiamento");
    await save("commitments", { name: "Financiamento casa", type: "financiamento_imobiliario", amount: 150000, total_installments: 2, start_date: "2026-10-01", due_day: 15, category_id: moradia, scope: "familiar" });
    await save("commitments", { name: "IPVA", type: "avulsa", amount: 90000, start_date: "2026-10-20", due_day: 20, scope: "familiar" });
    await save("income_sources", { name: "Salário CLT", type: "clt", gross: 600000, net: 480000, pay_day: 5 });

    for (const m of ["2026-10", "2026-10", "2026-11", "2026-12"]) await generateRecurring(m);

    const all = await listTransactions({});
    const fin = all.filter((t) => t.description.startsWith("Financiamento casa"));
    expect(fin.map((t) => t.description).sort()).toEqual(["Financiamento casa (1/2)", "Financiamento casa (2/2)"]);
    expect(all.filter((t) => t.description === "IPVA")).toHaveLength(1);
    expect(all.filter((t) => t.kind === "receita")).toHaveLength(3);

    const s = await monthSummary("2026-10");
    expect(s.receitas).toBe(480000);
    expect(s.despesas).toBe(240000);
    expect(s.aPagar).toBe(240000);
  });

  it("lista vencidos e agrupa faturas", async () => {
    await execute("INSERT INTO transactions (kind, description, amount, date, status) VALUES ('despesa','Luz',20000,date('now','-2 days'),'pendente')");
    await execute("INSERT INTO transactions (kind, description, amount, date, status) VALUES ('despesa','Água',8000,date('now','+3 days'),'pendente')");
    const alerts = await dueAlerts(7);
    expect(alerts.map((a) => a.level)).toEqual(["vencido", "proximo"]);
  });
});

describe("relatórios e orçamento", () => {
  it("monta séries, categorias, orçamento e exporta", async () => {
    const mercado = await cat("Mercado");
    await saveTransaction({ kind: "despesa", description: "Mercado", amount: 50000, date: "2026-09-10", status: "pago", category_id: mercado, account_id: null, scope: "familiar", member_id: null });
    await saveTransaction({ kind: "receita", description: "Freela", amount: 200000, date: "2026-10-01", status: "pago", category_id: null, account_id: null, scope: "pessoal", member_id: null });
    const series = await monthlySeries("2026-08", "2026-10");
    expect(series.map((p) => p.saldo)).toEqual([0, -50000, 200000]);
    const byCat = await totalsByCategory("despesa", { month: "2026-09" });
    expect(byCat[0]).toMatchObject({ name: "Mercado", total: 50000 });

    await setBudget("2026-09", mercado, 60000);
    await setBudget("2026-09", mercado, 70000);
    const b = (await budgetForMonth("2026-09")).find((r) => r.category_id === mercado)!;
    expect(b).toMatchObject({ planned: 70000, actual: 50000 });

    for (const kind of ["mensal", "periodo", "categorias", "lancamentos"] as const) {
      const doc = await buildReport(kind, "2026-09", "2026-10");
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(toCSV(doc)).toContain(";");
      const pdf = toPDF(doc);
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
      if (process.env.MF_PDF_OUT && kind === "mensal") writeFileSync(process.env.MF_PDF_OUT, pdf);
    }
  });

  it("projeta metas com juros", () => {
    const p = projectGoal({ current: 0, target: 1200000, monthly_contribution: 100000, expected_return: 0 });
    expect(p.months).toBe(12);
    expect(requiredMonthly({ current: 0, target: 1200000, expected_return: 0 }, 12)).toBe(100000);
    expect(requiredMonthly({ current: 0, target: 1200000, expected_return: 10 }, 12)).toBeLessThan(100000);
  });
});

describe("importação de extratos", () => {
  it("lê OFX", () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-45.90<FITID>abc1<MEMO>IFOOD *RESTAURANTE
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005<TRNAMT>1500.00<FITID>abc2<NAME>PIX RECEBIDO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOFX(ofx);
    expect(rows).toEqual([
      { date: "2026-10-05", description: "IFOOD *RESTAURANTE", amount: -4590, fitid: "abc1" },
      { date: "2026-10-05", description: "PIX RECEBIDO", amount: 150000, fitid: "abc2" },
    ]);
    expect(importKey(1, rows[0])).toBe("ofx:1:abc1");
  });

  it("lê CSV brasileiro com ; e vírgula decimal", () => {
    const csv = `Data;Histórico;Valor\n01/10/2026;"Supermercado; Centro";-123,45\n02/10/2026;Salário;3.500,00\n`;
    const table = parseCSVText(csv);
    const map = guessMapping(table[0]);
    expect(map).toMatchObject({ date: 0, description: 1, amount: 2, hasHeader: true });
    expect(applyMapping(table, map)).toEqual([
      { date: "2026-10-01", description: "Supermercado; Centro", amount: -12345 },
      { date: "2026-10-02", description: "Salário", amount: 350000 },
    ]);
  });
});
