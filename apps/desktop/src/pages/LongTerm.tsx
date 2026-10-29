import { HandCoins, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { GoalProjectionChart } from "../components/charts";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Money, MoneyInput, PageHeader, Progress, TextArea, confirmDialog } from "../components/ui";
import { Combobox } from "../components/Combobox";
import { useApp, useData } from "../lib/app-context";
import { notifyDataChanged, remove, save } from "../lib/db";
import { addMonths, brl, currentMonth, dateBR, monthLabel, monthsBetween, pct } from "../lib/format";
import { averageSpend, contributeToGoal, listGoals, projectGoal, requiredMonthly } from "../lib/repo";
import { GOAL_TYPES, type Goal } from "../lib/types";

const blank: Partial<Goal> = { name: "", type: "reserva_emergencia", target: 0, current: 0, target_date: "", monthly_contribution: 0, expected_return: 6, priority: 2, notes: "" };
const PRIORITY: Record<number, string> = { 1: "Alta", 2: "Média", 3: "Baixa" };

export function LongTerm() {
  const { toast } = useApp();
  const { data: goals = [] } = useData(() => listGoals(), []);
  const { data: avg = [] } = useData(() => averageSpend(currentMonth()), []);
  const [edit, setEdit] = useState<Partial<Goal> | null>(null);
  const [contrib, setContrib] = useState<{ goal: Goal; amount: number } | null>(null);

  const avgMonthly = avg.reduce((s, a) => s + a.avg, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.current, 0);
  const totalMonthly = goals.reduce((s, g) => s + g.monthly_contribution, 0);

  async function submit() {
    if (!edit?.name?.trim() || !edit.target) return toast("Informe nome e valor da meta", "erro");
    await save("goals", {
      name: edit.name.trim(), type: edit.type!, target: edit.target, current: edit.current ?? 0, target_date: edit.target_date || null,
      monthly_contribution: edit.monthly_contribution ?? 0, expected_return: edit.expected_return ?? 0, priority: edit.priority ?? 2, notes: edit.notes || null,
    }, edit.id);
    setEdit(null);
    notifyDataChanged();
  }

  const preview = edit?.target ? projectGoal({ current: edit.current ?? 0, target: edit.target, monthly_contribution: edit.monthly_contribution ?? 0, expected_return: edit.expected_return ?? 0 }) : null;

  return (
    <>
      <PageHeader title="Planejamento de longo prazo" subtitle="Reserva de emergência, casa própria, aposentadoria, estudos dos filhos">
        <Button variant="primary" onClick={() => setEdit({ ...blank })}><Plus size={16} /> Nova meta</Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Acumulado em metas</div><div className="money num text-lg font-extrabold text-brand">{brl(totalCurrent)} <span className="text-xs text-muted">de {brl(totalTarget)}</span></div></div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Aportes mensais planejados</div><div className="money num text-lg font-extrabold">{brl(totalMonthly)}</div></div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-xs text-muted">Reserva de emergência ideal (6× gasto médio)</div>
          <div className="money num text-lg font-extrabold">{avgMonthly ? brl(avgMonthly * 6) : "—"}</div>
          {avgMonthly > 0 && !goals.some((g) => g.type === "reserva_emergencia") && (
            <button className="text-xs font-semibold text-brand hover:underline" onClick={() => setEdit({ ...blank, name: "Reserva de emergência", target: avgMonthly * 6 })}>Criar essa meta</button>
          )}
        </div>
      </div>

      {goals.length === 0 ? (
        <Card><Empty icon={<Target />} title="Nenhuma meta ainda" text="Comece pela reserva de emergência: 6 meses de gastos guardados em algo seguro e com liquidez diária." action={<Button variant="primary" onClick={() => setEdit({ ...blank, name: "Reserva de emergência", target: avgMonthly * 6 })}>Criar reserva de emergência</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {goals.map((g) => {
            const proj = projectGoal(g);
            const monthsToDate = g.target_date ? monthsBetween(currentMonth(), g.target_date.slice(0, 7)) : null;
            const need = monthsToDate !== null ? requiredMonthly(g, monthsToDate) : null;
            const onTrack = need === null || g.monthly_contribution >= need;
            return (
              <Card key={g.id}
                title={<span className="flex items-center gap-2">{g.name} <Badge tone="muted">{GOAL_TYPES[g.type]}</Badge> <Badge tone={g.priority === 1 ? "neg" : "muted"}>{PRIORITY[g.priority]}</Badge></span>}
                action={<div className="flex"><IconButton label="Editar" onClick={() => setEdit(g)}><Pencil size={15} /></IconButton><IconButton label="Excluir" onClick={async () => { if (await confirmDialog(`Excluir a meta "${g.name}"?`)) { await remove("goals", g.id); notifyDataChanged(); } }}><Trash2 size={15} /></IconButton></div>}>
                <div className="flex items-end justify-between">
                  <div><div className="text-xs text-muted">Acumulado</div><Money cents={g.current} className="text-2xl font-extrabold text-brand" /></div>
                  <div className="text-right"><div className="text-xs text-muted">Meta</div><Money cents={g.target} className="font-bold" /></div>
                </div>
                <div className="my-3 flex items-center gap-2"><Progress value={g.current} max={g.target} tone="brand" /><span className="text-xs font-bold">{pct((g.current / g.target) * 100)}</span></div>
                <GoalProjectionChart points={proj.points} target={g.target} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="text-muted">Com <span className="money">{brl(g.monthly_contribution)}</span>/mês a {pct(g.expected_return, 1)} a.a.</div>
                    <div className="mt-0.5 font-bold">{proj.months === null ? "não atinge em 100 anos" : proj.months === 0 ? "Meta atingida! 🎉" : `atinge em ${monthLabel(addMonths(currentMonth(), proj.months), true)}`}</div>
                  </div>
                  <div className={`rounded-lg p-2.5 ${onTrack ? "bg-pos-soft" : "bg-warn-soft"}`}>
                    {g.target_date ? (
                      <>
                        <div className="text-muted">Para chegar até {dateBR(g.target_date)}</div>
                        <div className={`mt-0.5 font-bold ${onTrack ? "text-pos" : "text-warn"}`}>guarde <span className="money">{brl(need ?? 0)}</span>/mês</div>
                      </>
                    ) : <div className="text-muted">Defina uma data-alvo para calcular o aporte necessário.</div>}
                  </div>
                </div>
                <Button className="mt-3 w-full" onClick={() => setContrib({ goal: g, amount: g.monthly_contribution })}><HandCoins size={16} /> Registrar aporte</Button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Editar meta" : "Nova meta"} width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" onClick={submit}>Salvar</Button></>}>
        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" className="col-span-2"><Input autoFocus value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex.: Entrada do apartamento" /></Field>
            <Field label="Tipo"><Combobox value={edit.type} onChange={(v) => v && setEdit({ ...edit, type: v })} searchable={false} options={Object.entries(GOAL_TYPES).map(([k, v]) => ({ value: k, label: v }))} /></Field>
            <Field label="Prioridade"><Combobox value={edit.priority} onChange={(v) => v && setEdit({ ...edit, priority: v })} searchable={false} options={Object.entries(PRIORITY).map(([k, v]) => ({ value: Number(k), label: v }))} /></Field>
            <Field label="Valor da meta"><MoneyInput value={edit.target ?? 0} onChange={(v) => setEdit({ ...edit, target: v })} /></Field>
            <Field label="Já tenho guardado"><MoneyInput value={edit.current ?? 0} onChange={(v) => setEdit({ ...edit, current: v })} /></Field>
            <Field label="Aporte mensal"><MoneyInput value={edit.monthly_contribution ?? 0} onChange={(v) => setEdit({ ...edit, monthly_contribution: v })} /></Field>
            <Field label="Rentabilidade esperada (% a.a.)" hint="Use um valor real (acima da inflação), ex.: 4 a 6"><Input type="number" step="0.1" value={edit.expected_return ?? 0} onChange={(e) => setEdit({ ...edit, expected_return: Number(e.target.value) })} /></Field>
            <Field label="Data-alvo (opcional)" className="col-span-2"><Input type="date" value={edit.target_date ?? ""} onChange={(e) => setEdit({ ...edit, target_date: e.target.value })} /></Field>
            {preview && (
              <p className="col-span-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                {preview.months === null ? "Com esse aporte a meta não é atingida — aumente o aporte mensal." : preview.months === 0 ? "Meta já atingida." : <>Previsão: <b className="text-ink">{monthLabel(addMonths(currentMonth(), preview.months), true)}</b> ({Math.floor(preview.months / 12)} anos e {preview.months % 12} meses)</>}
              </p>
            )}
            <Field label="Anotações" className="col-span-2"><TextArea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!contrib} onClose={() => setContrib(null)} title={`Aporte — ${contrib?.goal.name ?? ""}`}
        footer={<><Button variant="ghost" onClick={() => setContrib(null)}>Cancelar</Button><Button variant="primary" onClick={async () => { if (contrib && contrib.amount) { await contributeToGoal(contrib.goal.id, contrib.amount); toast("Aporte registrado"); notifyDataChanged(); } setContrib(null); }}>Registrar</Button></>}>
        {contrib && <Field label="Valor do aporte" hint="Para retirar, edite a meta e ajuste o valor guardado."><MoneyInput autoFocus value={contrib.amount} onChange={(v) => setContrib({ ...contrib, amount: v })} /></Field>}
      </Modal>
    </>
  );
}
