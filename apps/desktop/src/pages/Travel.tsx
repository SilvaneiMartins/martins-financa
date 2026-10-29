import { ArrowLeft, Check, Pencil, Plane, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TransactionForm } from "../components/TransactionForm";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Money, MoneyInput, PageHeader, Progress, Table, TextArea, confirmDialog } from "../components/ui";
import { Combobox } from "../components/Combobox";
import { useApp, useData } from "../lib/app-context";
import { execute, notifyDataChanged, remove, save } from "../lib/db";
import { brl, currentMonth, dateBR, diffDays, monthsBetween, today } from "../lib/format";
import { listTransactions, listTripItems, listTrips } from "../lib/repo";
import { TRIP_CATEGORIES, TRIP_STATUS, type Trip, type TripItem } from "../lib/types";

const blankTrip: Partial<Trip> = { name: "", destination: "", start_date: "", end_date: "", budget: 0, travelers: 1, status: "planejando", notes: "" };

export function Travel() {
  const { toast } = useApp();
  const { data: trips = [] } = useData(() => listTrips(), []);
  const [edit, setEdit] = useState<Partial<Trip> | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const current = trips.find((t) => t.id === openId);

  async function submit() {
    if (!edit?.name?.trim()) return toast("Dê um nome para a viagem", "erro");
    const id = await save("trips", {
      name: edit.name.trim(), destination: edit.destination || null, start_date: edit.start_date || null, end_date: edit.end_date || null,
      budget: edit.budget ?? 0, travelers: edit.travelers ?? 1, status: edit.status ?? "planejando", notes: edit.notes || null,
    }, edit.id);
    setEdit(null);
    notifyDataChanged();
    if (!edit.id) setOpenId(id);
  }

  if (current) return <TripDetail trip={current} onBack={() => setOpenId(null)} onEdit={() => setEdit(current)} editModal={<TripModal edit={edit} setEdit={setEdit} submit={submit} />} />;

  return (
    <>
      <PageHeader title="Planejamento de viagens" subtitle="Orçamento, custos previstos × realizados e quanto guardar por mês">
        <Button variant="primary" onClick={() => setEdit({ ...blankTrip })}><Plus size={16} /> Nova viagem</Button>
      </PageHeader>
      {trips.length === 0 ? (
        <Card><Empty icon={<Plane />} title="Nenhuma viagem planejada" text="Planeje férias, visitas à família ou feriados: defina o orçamento, liste os custos e acompanhe o que já foi gasto." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((t) => {
            const base = t.budget || t.planned_total || 0;
            const days = t.start_date ? diffDays(today(), t.start_date) : null;
            return (
              <button key={t.id} onClick={() => setOpenId(t.id)} className="rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-brand">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className="text-xs text-muted">{t.destination ?? "Destino a definir"}</div>
                  </div>
                  <Badge tone={t.status === "concluida" ? "pos" : t.status === "cancelada" ? "muted" : "brand"}>{TRIP_STATUS[t.status]}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted">
                  {t.start_date ? `${dateBR(t.start_date)} → ${dateBR(t.end_date)}` : "Datas a definir"}
                  {days !== null && days > 0 && t.status !== "concluida" && <> · faltam <b className="text-ink">{days} dias</b></>}
                </div>
                <div className="mt-4 flex justify-between text-sm"><span className="text-muted">Gasto</span><span><Money cents={t.actual_total ?? 0} className="font-bold" /> / <Money cents={base} /></span></div>
                <div className="mt-1.5"><Progress value={t.actual_total ?? 0} max={base || 1} /></div>
              </button>
            );
          })}
        </div>
      )}
      <TripModal edit={edit} setEdit={setEdit} submit={submit} />
    </>
  );
}

function TripModal({ edit, setEdit, submit }: { edit: Partial<Trip> | null; setEdit: (t: Partial<Trip> | null) => void; submit: () => void }) {
  return (
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Editar viagem" : "Nova viagem"}
      footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" onClick={submit}>Salvar</Button></>}>
      {edit && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" className="col-span-2"><Input autoFocus value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex.: Férias em família" /></Field>
          <Field label="Destino" className="col-span-2"><Input value={edit.destination ?? ""} onChange={(e) => setEdit({ ...edit, destination: e.target.value })} placeholder="Ex.: Porto Seguro - BA" /></Field>
          <Field label="Ida"><Input type="date" value={edit.start_date ?? ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} /></Field>
          <Field label="Volta"><Input type="date" value={edit.end_date ?? ""} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} /></Field>
          <Field label="Orçamento total"><MoneyInput value={edit.budget ?? 0} onChange={(v) => setEdit({ ...edit, budget: v })} /></Field>
          <Field label="Viajantes"><Input type="number" min={1} value={edit.travelers ?? 1} onChange={(e) => setEdit({ ...edit, travelers: Number(e.target.value) })} /></Field>
          <Field label="Situação" className="col-span-2">
            <Combobox value={edit.status} onChange={(v) => v && setEdit({ ...edit, status: v })} searchable={false} options={Object.entries(TRIP_STATUS).map(([k, v]) => ({ value: k, label: v }))} />
          </Field>
          <Field label="Anotações" className="col-span-2"><TextArea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
        </div>
      )}
    </Modal>
  );
}

function TripDetail({ trip, onBack, onEdit, editModal }: { trip: Trip; onBack: () => void; onEdit: () => void; editModal: React.ReactNode }) {
  const { toast } = useApp();
  const { data: items = [] } = useData(() => listTripItems(trip.id), [trip.id]);
  const { data: txs = [] } = useData(() => listTransactions({ tripId: trip.id }), [trip.id]);
  const [item, setItem] = useState<Partial<TripItem> | null>(null);
  const [txOpen, setTxOpen] = useState(false);

  const planned = items.reduce((s, i) => s + i.planned, 0);
  const actual = items.reduce((s, i) => s + i.actual, 0) + txs.filter((t) => t.kind === "despesa").reduce((s, t) => s + t.amount, 0);
  const budget = trip.budget || planned;
  const nights = trip.start_date && trip.end_date ? Math.max(1, diffDays(trip.start_date, trip.end_date)) : null;
  const monthsLeft = trip.start_date ? Math.max(1, monthsBetween(currentMonth(), trip.start_date.slice(0, 7))) : null;
  const toSave = Math.max(0, budget - actual);

  async function saveItem() {
    if (!item?.description?.trim()) return toast("Descreva o item", "erro");
    await save("trip_items", { trip_id: trip.id, category: item.category ?? "outros", description: item.description.trim(), planned: item.planned ?? 0, actual: item.actual ?? 0, paid: item.paid ?? 0 }, item.id);
    setItem(null);
    notifyDataChanged();
  }

  async function delTrip() {
    if (!(await confirmDialog(`Excluir a viagem "${trip.name}"? Os lançamentos vinculados permanecem.`))) return;
    await remove("trips", trip.id);
    notifyDataChanged();
    onBack();
  }

  return (
    <>
      <PageHeader title={trip.name} subtitle={`${trip.destination ?? ""} ${trip.start_date ? `· ${dateBR(trip.start_date)} → ${dateBR(trip.end_date)}` : ""}`}>
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Voltar</Button>
        <Button onClick={onEdit}><Pencil size={16} /> Editar</Button>
        <Button onClick={delTrip}><Trash2 size={16} /></Button>
        <Button variant="primary" onClick={() => setItem({ category: "hospedagem", description: "", planned: 0, actual: 0 })}><Plus size={16} /> Item de custo</Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Orçamento", budget],
          ["Previsto nos itens", planned],
          ["Gasto até agora", actual],
          ["Por viajante", Math.round(budget / Math.max(1, trip.travelers))],
          [nights ? `Por dia (${nights} noites)` : "Por dia", nights ? Math.round(budget / nights) : 0],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className="money num text-lg font-extrabold">{brl(v as number)}</div>
          </div>
        ))}
      </div>

      {monthsLeft && toSave > 0 && trip.status !== "concluida" && (
        <p className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
          Para chegar ao orçamento sem dívida, guarde <b className="money">{brl(Math.ceil(toSave / monthsLeft))}</b> por mês nos próximos {monthsLeft} mês(es).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Custos planejados" className="xl:col-span-2" pad={false}>
          {items.length === 0 ? (
            <Empty title="Sem itens" text="Adicione passagens, hospedagem, alimentação, passeios..." />
          ) : (
            <Table>
              <thead><tr><th>Item</th><th>Categoria</th><th className="!text-right">Previsto</th><th className="!text-right">Real</th><th /></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="group">
                    <td className="font-semibold">{i.description} {i.paid ? <Badge tone="pos"><Check size={10} /> pago</Badge> : null}</td>
                    <td className="text-muted">{TRIP_CATEGORIES[i.category] ?? i.category}</td>
                    <td className="text-right"><Money cents={i.planned} /></td>
                    <td className="text-right"><Money cents={i.actual} className={i.actual > i.planned ? "font-bold text-neg" : "font-bold"} /></td>
                    <td className="w-28">
                      <div className="flex justify-end opacity-60 group-hover:opacity-100">
                        <IconButton label={i.paid ? "Marcar como não pago" : "Marcar como pago"} onClick={async () => { await execute("UPDATE trip_items SET paid = ?, actual = CASE WHEN actual = 0 THEN planned ELSE actual END WHERE id = ?", [i.paid ? 0 : 1, i.id]); notifyDataChanged(); }}><Check size={15} /></IconButton>
                        <IconButton label="Editar" onClick={() => setItem(i)}><Pencil size={15} /></IconButton>
                        <IconButton label="Excluir" onClick={async () => { await remove("trip_items", i.id); notifyDataChanged(); }}><Trash2 size={15} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card title="Gastos lançados na viagem" action={<Button size="sm" onClick={() => setTxOpen(true)}><Plus size={14} /> Gasto</Button>} pad={false}>
          {txs.length === 0 ? <p className="p-5 text-sm text-muted">Durante a viagem, lance os gastos aqui — eles entram no seu controle normal e na conta da viagem.</p> : (
            <ul>
              {txs.map((t) => (
                <li key={t.id} className="flex justify-between border-t border-line px-5 py-2.5 text-sm first:border-t-0">
                  <span><span className="font-semibold">{t.description}</span><br /><span className="text-xs text-muted">{dateBR(t.date)}</span></span>
                  <Money cents={t.amount} signed={t.kind} className="font-bold" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={!!item} onClose={() => setItem(null)} title={item?.id ? "Editar item" : "Novo item de custo"}
        footer={<><Button variant="ghost" onClick={() => setItem(null)}>Cancelar</Button><Button variant="primary" onClick={saveItem}>Salvar</Button></>}>
        {item && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Descrição" className="col-span-2"><Input autoFocus value={item.description ?? ""} onChange={(e) => setItem({ ...item, description: e.target.value })} placeholder="Ex.: Passagem aérea ida e volta" /></Field>
            <Field label="Categoria" className="col-span-2">
              <Combobox value={item.category} onChange={(v) => v && setItem({ ...item, category: v })} searchable={false} options={Object.entries(TRIP_CATEGORIES).map(([k, v]) => ({ value: k, label: v }))} />
            </Field>
            <Field label="Valor previsto"><MoneyInput value={item.planned ?? 0} onChange={(v) => setItem({ ...item, planned: v })} /></Field>
            <Field label="Valor real"><MoneyInput value={item.actual ?? 0} onChange={(v) => setItem({ ...item, actual: v })} /></Field>
          </div>
        )}
      </Modal>
      <TransactionForm open={txOpen} onClose={() => setTxOpen(false)} tripId={trip.id} />
      {editModal}
    </>
  );
}
