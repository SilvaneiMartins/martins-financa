import { ArrowDownCircle, ArrowUpCircle, Landmark, PiggyBank, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CategoryBreakdown, IncomeExpenseChart } from "../components/charts";
import { MonthNav } from "../components/MonthNav";
import { TransactionForm } from "../components/TransactionForm";
import { Badge, Button, Card, Dot, Money, PageHeader, Progress, Stat } from "../components/ui";
import { useApp, useData } from "../lib/app-context";
import { addMonths, brl, dateBR, pct } from "../lib/format";
import { dueAlerts, listAccounts, listGoals, monthlySeries, monthSummary, totalsByCategory } from "../lib/repo";

export function Dashboard() {
  const { month } = useApp();
  const [form, setForm] = useState<null | "receita" | "despesa">(null);
  const { data: s } = useData(() => monthSummary(month), [month]);
  const { data: series = [] } = useData(() => monthlySeries(addMonths(month, -5), month), [month]);
  const { data: cats = [] } = useData(() => totalsByCategory("despesa", { month }), [month]);
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: alerts = [] } = useData(() => dueAlerts(15), []);
  const { data: goals = [] } = useData(() => listGoals(), []);

  const saldoContas = accounts.filter((a) => a.type !== "cartao_credito").reduce((x, a) => x + (a.balance ?? 0), 0);
  const faturas = accounts.filter((a) => a.type === "cartao_credito").reduce((x, a) => x + (a.balance ?? 0), 0);
  const saldoMes = (s?.receitas ?? 0) - (s?.despesas ?? 0);
  const savingRate = s?.receitas ? (saldoMes / s.receitas) * 100 : 0;

  return (
    <>
      <PageHeader title="Painel" subtitle="Visão geral das suas finanças no mês">
        <MonthNav />
        <Button variant="primary" onClick={() => setForm("despesa")}><Plus size={16} /> Novo lançamento</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receitas do mês" cents={s?.receitas ?? 0} tone="pos" icon={<ArrowUpCircle size={18} />} hint={<>Recebido <span className="money">{brl(s?.recebido ?? 0)}</span></>} />
        <Stat label="Despesas do mês" cents={s?.despesas ?? 0} tone="neg" icon={<ArrowDownCircle size={18} />} hint={<>A pagar <span className="money">{brl(s?.aPagar ?? 0)}</span></>} />
        <Stat label="Saldo previsto" cents={saldoMes} tone={saldoMes < 0 ? "neg" : "brand"} icon={<PiggyBank size={18} />} hint={s?.receitas ? `Você poupa ${pct(savingRate, 1)} da renda` : "Cadastre suas rendas"} />
        <Stat label="Saldo em contas" cents={saldoContas} tone="brand" icon={<Landmark size={18} />} hint={<>Faturas em aberto <span className="money">{brl(faturas)}</span></>} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Receitas × despesas — últimos 6 meses" className="xl:col-span-2">
          {series.some((p) => p.receitas || p.despesas) ? <IncomeExpenseChart data={series} /> : <p className="grid h-[260px] place-items-center text-sm text-muted">Os gráficos aparecem assim que você tiver lançamentos.</p>}
        </Card>
        <Card title="Para onde foi o dinheiro" action={<Link to="/relatorios" className="whitespace-nowrap text-xs font-semibold text-brand hover:underline">Relatórios</Link>}>
          <CategoryBreakdown rows={cats} limit={6} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Próximos vencimentos" pad={false} action={<Link to="/compromissos" className="whitespace-nowrap text-xs font-semibold text-brand hover:underline">Contas a pagar</Link>}>
          {alerts.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nada vencendo. 🎉</p>
          ) : (
            <ul>
              {alerts.slice(0, 8).map((a) => (
                <li key={a.key} className="flex items-center gap-3 border-t border-line px-5 py-2.5 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.title}</div>
                    <div className="text-xs text-muted">{dateBR(a.date)}</div>
                  </div>
                  {a.level === "vencido" && <Badge tone={a.kind === "receita" ? "warn" : "neg"}>{a.kind === "receita" ? "Não recebido" : "Vencido"}</Badge>}
                  {a.level === "hoje" && <Badge tone="warn">Hoje</Badge>}
                  <Money cents={a.amount} signed={a.kind} className="text-sm font-bold" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Contas e cartões" pad={false} action={<Link to="/contas" className="whitespace-nowrap text-xs font-semibold text-brand hover:underline">Gerenciar</Link>}>
          <ul>
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-t border-line px-5 py-2.5 first:border-t-0">
                <Dot color={a.color} />
                <span className="flex-1 truncate text-sm font-semibold">{a.name}</span>
                {a.type === "cartao_credito" ? (
                  <span className="text-xs text-muted">fatura <Money cents={a.balance ?? 0} className="font-bold text-ink" /></span>
                ) : (
                  <Money cents={a.balance ?? 0} tone className="text-sm font-bold" />
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Metas de longo prazo" action={<Link to="/metas" className="whitespace-nowrap text-xs font-semibold text-brand hover:underline">Ver metas</Link>}>
          {goals.length === 0 ? (
            <p className="text-sm text-muted">Crie metas como reserva de emergência, entrada da casa ou aposentadoria.</p>
          ) : (
            <ul className="space-y-4">
              {goals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-xs text-muted">{pct((g.current / g.target) * 100)}</span>
                  </div>
                  <Progress value={g.current} max={g.target} tone="brand" />
                  <div className="mt-1 text-xs text-muted"><span className="money">{brl(g.current)}</span> de <span className="money">{brl(g.target)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <TransactionForm open={!!form} defaultKind={form ?? "despesa"} onClose={() => setForm(null)} />
    </>
  );
}
