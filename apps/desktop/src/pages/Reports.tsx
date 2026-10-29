import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { BalanceLine, CategoryBreakdown, IncomeExpenseChart } from "../components/charts";
import { Combobox } from "../components/Combobox";
import { MonthInput } from "../components/MonthInput";
import { Button, Card, Field, PageHeader } from "../components/ui";
import { useApp, useData } from "../lib/app-context";
import { saveReport } from "../lib/export";
import { addMonths, brl, monthLabel, monthRange, pct } from "../lib/format";
import { buildReport, REPORT_KINDS, type ReportKind } from "../lib/reports";
import { listMembers, monthlySeries, totalsBy, totalsByCategory, type TxFilter } from "../lib/repo";

const PRESETS = [
  { id: "mes", label: "Mês selecionado" },
  { id: "3m", label: "Últimos 3 meses" },
  { id: "6m", label: "Últimos 6 meses" },
  { id: "12m", label: "Últimos 12 meses" },
  { id: "ano", label: "Ano do mês selecionado" },
  { id: "custom", label: "Personalizado" },
];

export function Reports() {
  const { month, toast } = useApp();
  const [preset, setPreset] = useState("6m");
  const [cFrom, setCFrom] = useState(addMonths(month, -5));
  const [cTo, setCTo] = useState(month);
  const [scope, setScope] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [kind, setKind] = useState<ReportKind>("periodo");

  const [from, to] = (() => {
    switch (preset) {
      case "mes": return [month, month];
      case "3m": return [addMonths(month, -2), month];
      case "6m": return [addMonths(month, -5), month];
      case "12m": return [addMonths(month, -11), month];
      case "ano": return [`${month.slice(0, 4)}-01`, `${month.slice(0, 4)}-12`];
      default: return [cFrom, cTo < cFrom ? cFrom : cTo];
    }
  })();

  const filter: TxFilter = { scope, memberId };
  const range: TxFilter = { ...filter, from: monthRange(from)[0], to: monthRange(to)[1] };
  const deps = [from, to, scope, memberId];
  const { data: series = [] } = useData(() => monthlySeries(from, to, filter), deps);
  const { data: desp = [] } = useData(() => totalsByCategory("despesa", range), deps);
  const { data: rec = [] } = useData(() => totalsByCategory("receita", range), deps);
  const { data: byAcc = [] } = useData(() => totalsBy("account", range), deps);
  const { data: byScope = [] } = useData(() => totalsBy("scope", range), deps);
  const { data: members = [] } = useData(() => listMembers(), []);

  const totR = series.reduce((s, p) => s + p.receitas, 0);
  const totD = series.reduce((s, p) => s + p.despesas, 0);
  const n = Math.max(1, series.length);
  const worst = [...series].sort((a, b) => a.saldo - b.saldo)[0];
  const best = [...series].sort((a, b) => b.saldo - a.saldo)[0];

  async function exportAs(format: "pdf" | "csv") {
    try {
      const doc = await buildReport(kind, from, to, filter);
      const path = await saveReport(doc, format, `relatorio-${kind}-${from}_${to}`);
      if (path) toast(`Relatório salvo em ${path}`);
    } catch (e) {
      toast(String(e), "erro");
    }
  }

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`${monthLabel(from, true)} a ${monthLabel(to, true)}`}>
        <Combobox className="w-64" value={kind as string} onChange={(v) => v && setKind(v as ReportKind)} searchable={false} aria-label="Modelo de relatório para exportar" options={Object.entries(REPORT_KINDS).map(([k, v]) => ({ value: k, label: v }))} />
        <Button onClick={() => exportAs("csv")}><FileSpreadsheet size={16} /> CSV</Button>
        <Button variant="primary" onClick={() => exportAs("pdf")}><FileText size={16} /> PDF</Button>
      </PageHeader>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Período" className="w-52">
            <Combobox value={preset} onChange={(v) => v && setPreset(v)} searchable={false} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
          </Field>
          {preset === "custom" && (
            <>
              <Field label="De"><MonthInput value={cFrom} onChange={setCFrom} /></Field>
              <Field label="Até"><MonthInput value={cTo} onChange={setCTo} /></Field>
            </>
          )}
          <Field label="Gasto" className="w-40">
            <Combobox value={scope} onChange={(v) => setScope(v ?? "")} searchable={false} options={[{ value: "", label: "Pessoal + familiar" }, { value: "pessoal", label: "Pessoal" }, { value: "familiar", label: "Familiar" }]} />
          </Field>
          {members.length > 0 && (
            <Field label="Membro" className="w-40">
              <Combobox value={memberId} onChange={setMemberId} nullLabel="Todos" options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))} />
            </Field>
          )}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total de receitas", brl(totR)],
          ["Total de despesas", brl(totD)],
          ["Resultado", brl(totR - totD)],
          ["Taxa de poupança", totR ? pct(((totR - totD) / totR) * 100, 1) : "—"],
          ["Média de gastos/mês", brl(Math.round(totD / n))],
          ["Média de renda/mês", brl(Math.round(totR / n))],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className="money num text-base font-extrabold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Receitas × despesas por mês"><IncomeExpenseChart data={series} /></Card>
        <Card title="Saldo acumulado no período"><BalanceLine data={series} height={260} /></Card>
        <Card title="Despesas por categoria"><CategoryBreakdown rows={desp} limit={10} /></Card>
        <Card title="Receitas por categoria"><CategoryBreakdown rows={rec} limit={10} /></Card>
        <Card title="Por conta / cartão" pad={false}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted"><th className="px-5 py-2">Conta</th><th className="px-5 py-2 text-right">Entradas</th><th className="px-5 py-2 text-right">Saídas</th></tr></thead>
            <tbody>{byAcc.map((r) => <tr key={r.name} className="border-t border-line"><td className="px-5 py-2 font-semibold">{r.name}</td><td className="money num px-5 py-2 text-right">{brl(r.receitas)}</td><td className="money num px-5 py-2 text-right">{brl(r.despesas)}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Destaques">
          <ul className="space-y-3 text-sm">
            <li>Gasto pessoal: <b className="money">{brl(byScope.find((b) => b.name === "pessoal")?.despesas ?? 0)}</b> · gasto familiar: <b className="money">{brl(byScope.find((b) => b.name === "familiar")?.despesas ?? 0)}</b></li>
            {desp[0] && <li>Maior categoria de gasto: <b>{desp[0].name}</b> (<span className="money">{brl(desp[0].total)}</span>, {pct((desp[0].total / (totD || 1)) * 100, 1)} das despesas)</li>}
            {best && series.length > 1 && <li>Melhor mês: <b>{monthLabel(best.month, true)}</b> (<span className="money">{brl(best.saldo)}</span>)</li>}
            {worst && series.length > 1 && <li>Mês mais apertado: <b>{monthLabel(worst.month, true)}</b> (<span className="money">{brl(worst.saldo)}</span>)</li>}
            <li className="text-muted">Use o seletor acima para exportar este período em PDF ou CSV.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
