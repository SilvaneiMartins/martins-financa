// Montagem dos relatórios (mesma estrutura serve para tela, PDF e CSV).
import type { ReportDoc } from "./export";
import { brl, dateBR, monthLabel, monthRange, pct } from "./format";
import { listTransactions, monthlySeries, summary as periodSummary, totalsBy, totalsByCategory, type TxFilter } from "./repo";
import type { Transaction } from "./types";

export type ReportKind = "mensal" | "periodo" | "lancamentos" | "categorias";

export const REPORT_KINDS: Record<ReportKind, string> = {
  mensal: "Relatório mensal completo",
  periodo: "Evolução por período (mês a mês)",
  categorias: "Despesas e receitas por categoria",
  lancamentos: "Lista de lançamentos",
};

const txSection = (title: string, rows: Transaction[]) => ({
  title,
  columns: [
    { header: "Data", value: (t: Transaction) => dateBR(t.date) },
    { header: "Descrição", value: (t: Transaction) => t.description },
    { header: "Categoria", value: (t: Transaction) => t.category_name ?? "—" },
    { header: "Conta", value: (t: Transaction) => t.account_name ?? "—" },
    { header: "Tipo", value: (t: Transaction) => (t.kind === "receita" ? "Receita" : "Despesa") },
    { header: "Situação", value: (t: Transaction) => (t.status === "pago" ? "Pago" : "Pendente") },
    { header: "Valor", value: (t: Transaction) => (t.kind === "despesa" ? -t.amount : t.amount), money: true },
  ],
  rows,
  totals: ["", "", "", "", "", "Saldo", rows.reduce((s, t) => s + (t.kind === "receita" ? t.amount : -t.amount), 0)],
});

export async function buildReport(kind: ReportKind, fromMonth: string, toMonth: string, filter: TxFilter = {}): Promise<ReportDoc> {
  const [from] = monthRange(fromMonth);
  const [, to] = monthRange(toMonth);
  const period = fromMonth === toMonth ? monthLabel(fromMonth, true) : `${monthLabel(fromMonth, true)} a ${monthLabel(toMonth, true)}`;
  const f: TxFilter = { ...filter, from, to };

  if (kind === "lancamentos") {
    const rows = await listTransactions(f, 100_000);
    return { title: "Lançamentos", subtitle: period, sections: [txSection("Lançamentos", rows.slice().reverse())] };
  }

  const [series, despesas, receitas] = await Promise.all([
    monthlySeries(fromMonth, toMonth, filter),
    totalsByCategory("despesa", f),
    totalsByCategory("receita", f),
  ]);
  const totR = series.reduce((s, p) => s + p.receitas, 0);
  const totD = series.reduce((s, p) => s + p.despesas, 0);
  const summary = [
    { label: "Total de receitas", value: brl(totR) },
    { label: "Total de despesas", value: brl(totD) },
    { label: "Resultado do período", value: brl(totR - totD) },
    { label: "Taxa de poupança", value: totR ? pct(((totR - totD) / totR) * 100, 1) : "—" },
  ];

  const catSection = (title: string, rows: typeof despesas, total: number) => ({
    title,
    columns: [
      { header: "Categoria", value: (r: (typeof rows)[number]) => r.name },
      { header: "Lançamentos", value: (r: (typeof rows)[number]) => String(r.count), align: "right" as const },
      { header: "% do total", value: (r: (typeof rows)[number]) => pct((r.total / (total || 1)) * 100, 1), align: "right" as const },
      { header: "Total", value: (r: (typeof rows)[number]) => r.total, money: true },
    ],
    rows,
    totals: ["Total", "", "100%", total],
  });

  if (kind === "categorias") {
    return {
      title: "Receitas e despesas por categoria",
      subtitle: period,
      summary,
      sections: [catSection("Despesas por categoria", despesas, totD), catSection("Receitas por categoria", receitas, totR)],
    };
  }

  const seriesSection = {
    title: "Evolução mensal",
    columns: [
      { header: "Mês", value: (p: (typeof series)[number]) => monthLabel(p.month, true) },
      { header: "Receitas", value: (p: (typeof series)[number]) => p.receitas, money: true },
      { header: "Despesas", value: (p: (typeof series)[number]) => p.despesas, money: true },
      { header: "Saldo", value: (p: (typeof series)[number]) => p.saldo, money: true },
    ],
    rows: series,
    totals: ["Total", totR, totD, totR - totD],
  };

  if (kind === "periodo") {
    return { title: "Evolução financeira", subtitle: period, summary, sections: [seriesSection, catSection("Despesas por categoria", despesas, totD)] };
  }

  // mensal completo
  const [s, byAccount, byMember, txs] = await Promise.all([
    periodSummary(f),
    totalsBy("account", f),
    totalsBy("member", f),
    listTransactions(f, 100_000),
  ]);
  const byField = (title: string, rows: typeof byAccount) => ({
    title,
    columns: [
      { header: "Nome", value: (r: (typeof rows)[number]) => r.name },
      { header: "Receitas", value: (r: (typeof rows)[number]) => r.receitas, money: true },
      { header: "Despesas", value: (r: (typeof rows)[number]) => r.despesas, money: true },
    ],
    rows,
  });
  return {
    title: fromMonth === toMonth ? `Relatório mensal — ${monthLabel(fromMonth, true)}` : "Relatório completo",
    subtitle: fromMonth === toMonth ? undefined : period,
    summary: [
      ...summary,
      { label: "Já recebido", value: brl(s.recebido) },
      { label: "Já pago", value: brl(s.pago) },
      { label: "A receber", value: brl(s.aReceber) },
      { label: "A pagar", value: brl(s.aPagar) },
    ],
    sections: [
      catSection("Despesas por categoria", despesas, totD),
      catSection("Receitas por categoria", receitas, totR),
      byField("Por conta / cartão", byAccount),
      byField("Por membro da família", byMember),
      txSection("Todos os lançamentos", txs.slice().reverse()),
    ],
  };
}
