import { Copy, Pencil, Plus, Sparkles, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Combobox } from "../components/Combobox";
import { MonthNav } from "../components/MonthNav";
import { Button, Card, Dot, Field, IconButton, Input, Modal, Money, MoneyInput, PageHeader, Progress, Segmented, Table, confirmDialog } from "../components/ui";
import { useApp, useData } from "../lib/app-context";
import { notifyDataChanged, remove, save } from "../lib/db";
import { addMonths, brl, monthLabel, pct } from "../lib/format";
import { averageSpend, budgetForMonth, copyBudget, listMembers, monthSummary, setBudget, totalsBy } from "../lib/repo";
import type { Member } from "../lib/types";

const COLORS = ["#2f80d9", "#2a6fdb", "#c2570c", "#7c3aed", "#db2777", "#0891b2", "#a16207"];

export function FamilyPlan() {
  const { month, toast } = useApp();
  const [scope, setScope] = useState<"" | "familiar" | "pessoal">("");
  const { data: rows = [] } = useData(() => budgetForMonth(month, scope || undefined), [month, scope]);
  const { data: s } = useData(() => monthSummary(month), [month]);
  const { data: members = [] } = useData(() => listMembers(), []);
  const { data: byMember = [] } = useData(() => totalsBy("member", { month }), [month]);
  const [member, setMember] = useState<Partial<Member> | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const planned = rows.reduce((x, r) => x + r.planned, 0);
  const actual = rows.reduce((x, r) => x + r.actual, 0);
  const income = s?.receitas ?? 0;
  const free = income - planned;

  async function suggest() {
    const avg = await averageSpend(month);
    if (!avg.length) return toast("Ainda não há 3 meses de histórico para sugerir.", "erro");
    for (const a of avg) await setBudget(month, a.category_id, Math.ceil(a.avg / 1000) * 1000);
    toast("Orçamento sugerido pela média dos últimos 3 meses");
    notifyDataChanged();
  }

  async function copyPrev() {
    await copyBudget(addMonths(month, -1), month);
    toast(`Copiado de ${monthLabel(addMonths(month, -1), true)}`);
    notifyDataChanged();
  }

  async function saveMember() {
    if (!member?.name?.trim()) return;
    await save("members", { name: member.name.trim(), relation: member.relation || null, color: member.color ?? COLORS[members.length % COLORS.length] }, member.id);
    setMember(null);
    notifyDataChanged();
  }

  return (
    <>
      <PageHeader title="Planejamento familiar" subtitle="Orçamento mensal por categoria e participação de cada membro">
        <MonthNav />
        <Button onClick={copyPrev}><Copy size={16} /> Copiar mês anterior</Button>
        <Button variant="primary" onClick={suggest}><Sparkles size={16} /> Sugerir pela média</Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          ["Renda prevista do mês", income, "text-pos"],
          ["Orçamento planejado", planned, "text-ink"],
          ["Gasto até agora", actual, actual > planned && planned > 0 ? "text-neg" : "text-ink"],
          [free >= 0 ? "Sobra para poupar" : "Planejado acima da renda", free, free >= 0 ? "text-brand" : "text-neg"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className={`money num text-lg font-extrabold ${c}`}>{brl(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title={`Orçamento — ${monthLabel(month, true)}`} className="xl:col-span-2" pad={false}
          action={<Segmented value={scope} onChange={setScope} options={[{ value: "", label: "Tudo" }, { value: "familiar", label: "Familiar" }, { value: "pessoal", label: "Pessoal" }]} />}>
          <Table>
            <thead><tr><th>Categoria</th><th className="!text-right">Planejado</th><th className="!text-right">Realizado</th><th className="w-48">Uso</th></tr></thead>
            <tbody>
              {rows.filter((r) => r.planned || r.actual || editing === r.category_id).map((r) => (
                <tr key={r.category_id}>
                  <td><span className="flex items-center gap-2"><Dot color={r.color} />{r.name}</span></td>
                  <td className="w-44 text-right">
                    {editing === r.category_id ? (
                      <BudgetCell initial={r.planned} onDone={async (v) => { setEditing(null); if (v !== r.planned) { await setBudget(month, r.category_id, v); notifyDataChanged(); } }} />
                    ) : (
                      <button className="money num font-semibold hover:text-brand hover:underline" onClick={() => setEditing(r.category_id)}>{r.planned ? brl(r.planned) : "definir"}</button>
                    )}
                  </td>
                  <td className="text-right"><Money cents={r.actual} className={r.planned && r.actual > r.planned ? "font-bold text-neg" : ""} /></td>
                  <td>
                    {r.planned > 0 ? (
                      <div className="flex items-center gap-2"><Progress value={r.actual} max={r.planned} /><span className="w-10 text-right text-xs text-muted">{pct((r.actual / r.planned) * 100)}</span></div>
                    ) : <span className="text-xs text-muted">sem limite</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="border-t border-line px-4 py-3">
            <Combobox
              className="w-80"
              size="sm"
              value={null}
              onChange={(v) => v != null && setEditing(v)}
              placeholder="+ Adicionar categoria ao orçamento"
              aria-label="Adicionar categoria ao orçamento"
              emptyText="Todas as categorias já estão no orçamento"
              options={rows.filter((r) => !r.planned && !r.actual).map((r) => ({ value: r.category_id, label: r.name, color: r.color }))}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Membros da família" action={<Button size="sm" onClick={() => setMember({ name: "", relation: "" })}><UserPlus size={14} /> Adicionar</Button>} pad={false}>
            {members.length === 0 ? (
              <p className="p-5 text-sm text-muted">Adicione quem faz parte do orçamento (você, cônjuge, filhos) para separar gastos por pessoa.</p>
            ) : (
              <ul>
                {members.map((m) => {
                  const t = byMember.find((b) => b.name === m.name);
                  return (
                    <li key={m.id} className="group flex items-center gap-3 border-t border-line px-5 py-2.5 first:border-t-0">
                      <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white" style={{ background: m.color }}>{m.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{m.name}</div>
                        <div className="text-xs text-muted">{m.relation ?? "—"} · gastou <span className="money">{brl(t?.despesas ?? 0)}</span></div>
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100">
                        <IconButton label="Editar" onClick={() => setMember(m)}><Pencil size={14} /></IconButton>
                        <IconButton label="Remover" onClick={async () => { if (await confirmDialog(`Remover ${m.name}?`)) { await remove("members", m.id); notifyDataChanged(); } }}><Trash2 size={14} /></IconButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Regra 50/30/20 (referência)">
            <p className="mb-3 text-xs text-muted">Uma divisão clássica da renda líquida. Use como ponto de partida, não como regra rígida.</p>
            {[["Necessidades (moradia, mercado, contas)", 0.5], ["Desejos (lazer, restaurantes)", 0.3], ["Poupança e dívidas", 0.2]].map(([l, p]) => (
              <div key={l as string} className="flex justify-between border-t border-line py-2 text-sm first:border-t-0">
                <span>{l}</span><Money cents={Math.round(income * (p as number))} className="font-bold" />
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Modal open={!!member} onClose={() => setMember(null)} title={member?.id ? "Editar membro" : "Novo membro"}
        footer={<><Button variant="ghost" onClick={() => setMember(null)}>Cancelar</Button><Button variant="primary" onClick={saveMember}><Plus size={16} /> Salvar</Button></>}>
        {member && (
          <div className="grid gap-4">
            <Field label="Nome"><Input autoFocus value={member.name ?? ""} onChange={(e) => setMember({ ...member, name: e.target.value })} /></Field>
            <Field label="Parentesco"><Input value={member.relation ?? ""} onChange={(e) => setMember({ ...member, relation: e.target.value })} placeholder="Ex.: Cônjuge, Filho(a)" /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function BudgetCell({ initial, onDone }: { initial: number; onDone: (cents: number) => void }) {
  const [v, setV] = useState(initial);
  return <MoneyInput autoFocus value={v} onChange={setV} onBlur={() => onDone(v)} onKeyDown={(e) => e.key === "Enter" && onDone(v)} />;
}
