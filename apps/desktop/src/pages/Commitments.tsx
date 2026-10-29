import { CalendarClock, FileText, Landmark, NotebookPen, Pencil, Plus, Power, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { Combobox } from "../components/Combobox";
import { TabPanel, Tabs } from "../components/Tabs";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Money, MoneyInput, PageHeader, Progress, Segmented, Table, TextArea, confirmDialog } from "../components/ui";
import { useApp, useData } from "../lib/app-context";
import { execute, notifyDataChanged, save } from "../lib/db";
import { addMonths, brl, currentMonth, dateBR, today } from "../lib/format";
import { generateRecurring, installmentFor, listAccounts, listCategories, listCommitments, listMembers } from "../lib/repo";
import { COMMITMENT_TYPES, type Commitment } from "../lib/types";

const blank: Partial<Commitment> = {
  name: "", type: "recorrente", amount: 0, total_installments: null, start_date: today(), due_day: 10,
  interest_rate: null, financed_amount: null, category_id: null, account_id: null, scope: "familiar", member_id: null, notes: "",
};

const FINANCING = ["financiamento_imobiliario", "financiamento_veiculo", "emprestimo", "consorcio"];

type FormTab = "geral" | "financiamento" | "classificacao" | "notas";
type FormErrors = { name?: string; amount?: string };

export function Commitments() {
  const { toast } = useApp();
  const [view, setView] = useState<"ativos" | "todos">("ativos");
  const { data: items = [] } = useData(() => listCommitments(), []);
  const { data: categories = [] } = useData(() => listCategories("despesa"), []);
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: members = [] } = useData(() => listMembers(), []);
  const [edit, setEdit] = useState<Partial<Commitment> | null>(null);
  const [tab, setTab] = useState<FormTab>("geral");
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  function openForm(c: Partial<Commitment>) {
    setErrors({});
    setTab("geral");
    setEdit(c);
  }

  const visible = items.filter((c) => view === "todos" || c.active);
  const monthlyTotal = items.filter((c) => c.active && c.type !== "avulsa").reduce((s, c) => s + c.amount, 0);
  // parcela do mês atual (pela data de início) — funciona mesmo para financiamentos antigos
  const current = (c: Commitment) => installmentFor(c, currentMonth()) ?? (c.start_date.slice(0, 7) > currentMonth() ? 0 : c.total_installments ?? 0);
  const debt = items
    .filter((c) => c.active && c.total_installments && c.type !== "avulsa")
    .reduce((s, c) => s + Math.max(0, c.total_installments! - current(c) + 1) * c.amount, 0);

  async function submit() {
    if (!edit) return;
    const next: FormErrors = {};
    if (!edit.name?.trim()) next.name = "Informe o nome";
    if (!edit.amount) next.amount = "Informe o valor da parcela";
    setErrors(next);
    if (Object.keys(next).length) {
      setTab("geral");
      return;
    }
    const isFin = FINANCING.includes(edit.type!);
    setBusy(true);
    try {
      await save("commitments", {
        name: edit.name!.trim(), type: edit.type!, amount: edit.amount!,
        total_installments: edit.type === "avulsa" ? 1 : edit.total_installments || null,
        start_date: edit.start_date!, due_day: edit.due_day ?? 10,
        interest_rate: isFin ? edit.interest_rate ?? null : null,
        financed_amount: isFin ? edit.financed_amount ?? null : null,
        category_id: edit.category_id ?? null, account_id: edit.account_id ?? null,
        scope: edit.scope ?? "familiar", member_id: edit.member_id ?? null, notes: edit.notes || null, active: 1,
      }, edit.id);
      // edição: atualiza o valor das parcelas ainda pendentes
      if (edit.id) await execute("UPDATE transactions SET amount = ? WHERE commitment_id = ? AND status = 'pendente'", [edit.amount, edit.id]);
      // gera as parcelas do mês atual e do próximo
      await generateRecurring(currentMonth());
      await generateRecurring(addMonths(currentMonth(), 1));
      toast("Compromisso salvo — lançamentos do mês gerados");
      setEdit(null);
      notifyDataChanged();
    } catch (e) {
      toast(String(e), "erro");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Commitment) {
    await execute("UPDATE commitments SET active = ? WHERE id = ?", [c.active ? 0 : 1, c.id]);
    notifyDataChanged();
  }

  async function del(c: Commitment) {
    if (!(await confirmDialog(`Excluir "${c.name}"? Os lançamentos PENDENTES dele também serão removidos; os já pagos ficam no histórico.`))) return;
    await execute("DELETE FROM transactions WHERE commitment_id = ? AND status = 'pendente'", [c.id]);
    await execute("DELETE FROM commitments WHERE id = ?", [c.id]);
    notifyDataChanged();
  }

  const isFin = !!edit && FINANCING.includes(edit.type ?? "");
  const total = edit?.total_installments && edit.amount ? edit.amount * edit.total_installments : 0;
  const creditCost = isFin && edit?.financed_amount && total ? total - edit.financed_amount : 0;

  return (
    <>
      <PageHeader title="Contas a pagar" subtitle="Contas fixas, avulsas, financiamentos, empréstimos e assinaturas">
        <Segmented value={view} onChange={setView} options={[{ value: "ativos", label: "Ativos" }, { value: "todos", label: "Todos" }]} />
        <Button variant="primary" onClick={() => openForm({ ...blank })}><Plus size={16} /> Novo compromisso</Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Compromissos mensais</div><div className="money num text-lg font-extrabold">{brl(monthlyTotal)}</div></div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Saldo devedor estimado (parcelas restantes)</div><div className="money num text-lg font-extrabold text-neg">{brl(debt)}</div></div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Itens ativos</div><div className="text-lg font-extrabold">{items.filter((c) => c.active).length}</div></div>
      </div>

      <Card pad={false}>
        {visible.length === 0 ? (
          <Empty icon={<CalendarClock />} title="Nenhum compromisso" text="Cadastre aluguel, financiamento da casa, energia, internet, escola... O app gera os lançamentos de cada mês automaticamente e avisa os vencimentos." />
        ) : (
          <Table>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Vence</th><th>Progresso</th><th className="!text-right">Parcela</th><th /></tr></thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className={`group ${c.active ? "" : "opacity-50"}`}>
                  <td><div className="font-semibold">{c.name}</div><div className="text-[11px] text-muted">{c.category_name ?? "Sem categoria"} · {c.scope === "familiar" ? "Familiar" : "Pessoal"}</div></td>
                  <td><Badge tone={FINANCING.includes(c.type) ? "warn" : "muted"}>{COMMITMENT_TYPES[c.type] ?? c.type}</Badge></td>
                  <td className="whitespace-nowrap text-muted">{c.type === "avulsa" ? dateBR(`${c.start_date.slice(0, 7)}-${String(c.due_day).padStart(2, "0")}`) : `todo dia ${c.due_day}`}</td>
                  <td className="w-56">
                    {c.total_installments && c.total_installments > 1 ? (
                      <div>
                        <div className="mb-1 text-xs text-muted">parcela {current(c)} de {c.total_installments}</div>
                        <Progress value={current(c)} max={c.total_installments} tone="brand" />
                      </div>
                    ) : <span className="text-xs text-muted">{c.type === "avulsa" ? "Única" : "Sem prazo"}</span>}
                  </td>
                  <td className="text-right font-bold"><Money cents={c.amount} /></td>
                  <td className="w-28">
                    <div className="flex justify-end opacity-60 group-hover:opacity-100">
                      <IconButton label={c.active ? "Pausar" : "Reativar"} onClick={() => toggleActive(c)}><Power size={15} /></IconButton>
                      <IconButton label="Editar" onClick={() => openForm(c)}><Pencil size={15} /></IconButton>
                      <IconButton label="Excluir" onClick={() => del(c)}><Trash2 size={15} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar compromisso" : "Novo compromisso"}
        description="Contas fixas, parcelas e financiamentos geram lançamentos todo mês"
        icon={<CalendarClock size={18} />}
        size="large"
        footer={
          <>
            {total > 0 && (
              <p className="mr-auto min-w-0 truncate text-xs text-muted">
                Total a pagar: <b className="money text-ink">{brl(total)}</b>
                {creditCost > 0 && <> · custo do crédito: <b className="money text-neg">{brl(creditCost)}</b></>}
              </p>
            )}
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </>
        }
      >
        {edit && (
          <div onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit()}>
            <Tabs
              idBase="commitment"
              aria-label="Seções do compromisso"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "geral", label: "Geral", icon: <FileText size={15} />, invalid: !!(errors.name || errors.amount) },
                { id: "financiamento", label: "Financiamento", icon: <Landmark size={15} />, hidden: !isFin },
                { id: "classificacao", label: "Classificação", icon: <Tags size={15} /> },
                { id: "notas", label: "Observações", icon: <NotebookPen size={15} /> },
              ]}
            />
            <div className="min-h-[19rem] pt-5">
              <TabPanel idBase="commitment" id="geral" value={tab} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                <Field label="Nome" required error={errors.name} className="sm:col-span-2">
                  <Input
                    autoFocus
                    aria-invalid={!!errors.name}
                    value={edit.name ?? ""}
                    onChange={(e) => { setEdit({ ...edit, name: e.target.value }); setErrors((x) => ({ ...x, name: undefined })); }}
                    placeholder="Ex.: Financiamento Caixa — apartamento"
                  />
                </Field>
                <Field label="Tipo">
                  <Combobox
                    value={edit.type}
                    onChange={(v) => v && setEdit({ ...edit, type: v })}
                    options={Object.entries(COMMITMENT_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                  />
                </Field>
                <Field label={edit.type === "avulsa" ? "Valor" : "Valor da parcela / mensal"} required error={errors.amount}>
                  <MoneyInput
                    aria-invalid={!!errors.amount}
                    value={edit.amount ?? 0}
                    onChange={(v) => { setEdit({ ...edit, amount: v }); setErrors((x) => ({ ...x, amount: undefined })); }}
                  />
                </Field>
                <Field label={edit.type === "avulsa" ? "Data de vencimento" : "Primeira parcela em"}>
                  <Input type="date" value={edit.start_date} onChange={(e) => setEdit({ ...edit, start_date: e.target.value, due_day: Number(e.target.value.slice(8, 10)) || edit.due_day })} />
                </Field>
                {edit.type !== "avulsa" && (
                  <>
                    <Field label="Dia de vencimento">
                      <Input type="number" min={1} max={31} value={edit.due_day ?? 10} onChange={(e) => setEdit({ ...edit, due_day: Number(e.target.value) })} />
                    </Field>
                    <Field label="Total de parcelas" hint="Deixe vazio para conta sem fim (luz, internet...)" className="sm:col-span-2">
                      <Input type="number" min={1} value={edit.total_installments ?? ""} onChange={(e) => setEdit({ ...edit, total_installments: e.target.value ? Number(e.target.value) : null })} placeholder="Ex.: 360" />
                    </Field>
                  </>
                )}
              </TabPanel>

              <TabPanel idBase="commitment" id="financiamento" value={tab} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                <Field label="Valor financiado" hint="Quanto você recebeu / o valor do bem">
                  <MoneyInput value={edit.financed_amount ?? 0} onChange={(v) => setEdit({ ...edit, financed_amount: v })} />
                </Field>
                <Field label="Juros (% ao ano)">
                  <Input type="number" step="0.01" value={edit.interest_rate ?? ""} onChange={(e) => setEdit({ ...edit, interest_rate: e.target.value ? Number(e.target.value) : null })} placeholder="Ex.: 9,5" />
                </Field>
                {total > 0 && edit.financed_amount ? (
                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-brand-soft p-4 text-center sm:col-span-2">
                    <div><div className="text-[11px] text-muted">Total a pagar</div><div className="money num text-base font-extrabold">{brl(total)}</div></div>
                    <div><div className="text-[11px] text-muted">Valor financiado</div><div className="money num text-base font-extrabold">{brl(edit.financed_amount)}</div></div>
                    <div><div className="text-[11px] text-muted">Custo do crédito</div><div className="money num text-base font-extrabold text-neg">{brl(creditCost)}</div></div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted sm:col-span-2">
                    Informe o valor e o total de parcelas (aba Geral) e o valor financiado para ver o custo total do crédito.
                  </p>
                )}
              </TabPanel>

              <TabPanel idBase="commitment" id="classificacao" value={tab} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                <Field label="Categoria">
                  <Combobox value={edit.category_id} onChange={(v) => setEdit({ ...edit, category_id: v })} nullLabel="Sem categoria" options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))} />
                </Field>
                <Field label="Pagar com">
                  <Combobox
                    value={edit.account_id}
                    onChange={(v) => setEdit({ ...edit, account_id: v })}
                    nullLabel="Não definido"
                    options={accounts.map((a) => ({ value: a.id, label: a.name, description: a.type === "cartao_credito" ? "Cartão de crédito" : a.bank ?? undefined, color: a.color }))}
                  />
                </Field>
                <Field label="Gasto">
                  <Combobox value={edit.scope} onChange={(v) => v && setEdit({ ...edit, scope: v })} options={[{ value: "familiar", label: "Familiar" }, { value: "pessoal", label: "Pessoal" }]} />
                </Field>
                <Field label="Responsável">
                  <Combobox value={edit.member_id} onChange={(v) => setEdit({ ...edit, member_id: v })} nullLabel="Ninguém em especial" options={members.map((m) => ({ value: m.id, label: m.name, description: m.relation ?? undefined, color: m.color }))} />
                </Field>
              </TabPanel>

              <TabPanel idBase="commitment" id="notas" value={tab}>
                <Field label="Observações" hint="Contrato, número do boleto, contato do credor...">
                  <TextArea className="!h-40" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                </Field>
              </TabPanel>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
