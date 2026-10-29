import { FileText, HandCoins, NotebookPen, Pencil, Plus, Power, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { Combobox } from "../components/Combobox";
import { TabPanel, Tabs } from "../components/Tabs";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Money, MoneyInput, PageHeader, Table, TextArea, confirmDialog } from "../components/ui";
import { useApp, useData } from "../lib/app-context";
import { execute, notifyDataChanged, save } from "../lib/db";
import { addMonths, brl, currentMonth, pct } from "../lib/format";
import { generateRecurring, listAccounts, listCategories, listIncomeSources, listMembers } from "../lib/repo";
import { INCOME_TYPES, type IncomeSource } from "../lib/types";

const blank: Partial<IncomeSource> = { name: "", type: "clt", gross: 0, net: 0, pay_day: 5, member_id: null, account_id: null, category_id: null, notes: "" };

type FormTab = "geral" | "recebimento" | "notas";
type FormErrors = { name?: string; net?: string };

export function Income() {
  const { toast } = useApp();
  const { data: items = [] } = useData(() => listIncomeSources(), []);
  const { data: members = [] } = useData(() => listMembers(), []);
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: categories = [] } = useData(() => listCategories("receita"), []);
  const [edit, setEdit] = useState<Partial<IncomeSource> | null>(null);
  const [tab, setTab] = useState<FormTab>("geral");
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  function openForm(i: Partial<IncomeSource>) {
    setErrors({});
    setTab("geral");
    setEdit(i);
  }

  const active = items.filter((i) => i.active);
  const totalNet = active.reduce((s, i) => s + i.net, 0);
  const totalGross = active.reduce((s, i) => s + (i.gross || i.net), 0);
  const clt = active.filter((i) => i.type === "clt" || i.type === "servidor");

  async function submit() {
    if (!edit) return;
    const next: FormErrors = {};
    if (!edit.name?.trim()) next.name = "Informe o nome";
    if (!edit.net) next.net = "Informe o valor líquido";
    setErrors(next);
    if (Object.keys(next).length) {
      setTab("geral");
      return;
    }
    const cat = edit.category_id ?? categories.find((c) => c.name === (edit.type === "pj" ? "Pró-labore / PJ" : edit.type === "aluguel" ? "Aluguel recebido" : edit.type === "investimentos" ? "Rendimentos" : "Salário"))?.id ?? null;
    setBusy(true);
    try {
      await save("income_sources", {
        name: edit.name!.trim(), type: edit.type!, gross: edit.gross ?? 0, net: edit.net!, pay_day: edit.pay_day ?? 5,
        member_id: edit.member_id ?? null, account_id: edit.account_id ?? null, category_id: cat, notes: edit.notes || null, active: 1,
      }, edit.id);
      if (edit.id) await execute("UPDATE transactions SET amount = ? WHERE income_source_id = ? AND status = 'pendente'", [edit.net, edit.id]);
      await generateRecurring(currentMonth());
      await generateRecurring(addMonths(currentMonth(), 1));
      toast("Renda salva");
      setEdit(null);
      notifyDataChanged();
    } catch (e) {
      toast(String(e), "erro");
    } finally {
      setBusy(false);
    }
  }

  async function del(i: IncomeSource) {
    if (!(await confirmDialog(`Excluir "${i.name}"? Recebimentos pendentes dela serão removidos.`))) return;
    await execute("DELETE FROM transactions WHERE income_source_id = ? AND status='pendente'", [i.id]);
    await execute("DELETE FROM income_sources WHERE id = ?", [i.id]);
    notifyDataChanged();
  }

  return (
    <>
      <PageHeader title="Rendas" subtitle="Salário CLT, PJ, autônomo, aposentadoria, aluguéis — tudo que entra todo mês">
        <Button variant="primary" onClick={() => openForm({ ...blank })}><Plus size={16} /> Nova renda</Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Renda líquida mensal</div><div className="money num text-lg font-extrabold text-pos">{brl(totalNet)}</div></div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3"><div className="text-xs text-muted">Renda bruta mensal</div><div className="money num text-lg font-extrabold">{brl(totalGross)}</div></div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-xs text-muted">Descontos (INSS, IR, benefícios)</div>
          <div className="money num text-lg font-extrabold text-neg">{brl(totalGross - totalNet)} <span className="text-xs font-semibold text-muted">{totalGross ? pct(((totalGross - totalNet) / totalGross) * 100, 1) : ""}</span></div>
        </div>
      </div>

      {clt.length > 0 && (
        <p className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
          Dica: lance o 13º salário e as férias como receitas avulsas em Lançamentos (categoria “13º e férias”) nos meses em que caírem.
        </p>
      )}

      <Card pad={false}>
        {items.length === 0 ? (
          <Empty icon={<HandCoins />} title="Nenhuma renda cadastrada" text="Cadastre seu salário e as rendas da família. O app cria os recebimentos de cada mês automaticamente." />
        ) : (
          <Table>
            <thead><tr><th>Fonte</th><th>Tipo</th><th>Quem recebe</th><th>Dia</th><th className="!text-right">Bruto</th><th className="!text-right">Líquido</th><th /></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={`group ${i.active ? "" : "opacity-50"}`}>
                  <td className="font-semibold">{i.name}</td>
                  <td><Badge tone="brand">{INCOME_TYPES[i.type] ?? i.type}</Badge></td>
                  <td className="text-muted">{i.member_name ?? "—"}</td>
                  <td className="text-muted">dia {i.pay_day}</td>
                  <td className="text-right text-muted"><Money cents={i.gross} /></td>
                  <td className="text-right font-bold"><Money cents={i.net} signed="receita" /></td>
                  <td className="w-28">
                    <div className="flex justify-end opacity-60 group-hover:opacity-100">
                      <IconButton label={i.active ? "Pausar" : "Reativar"} onClick={async () => { await execute("UPDATE income_sources SET active = ? WHERE id = ?", [i.active ? 0 : 1, i.id]); notifyDataChanged(); }}><Power size={15} /></IconButton>
                      <IconButton label="Editar" onClick={() => openForm(i)}><Pencil size={15} /></IconButton>
                      <IconButton label="Excluir" onClick={() => del(i)}><Trash2 size={15} /></IconButton>
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
        title={edit?.id ? "Editar renda" : "Nova renda"}
        description="O app cria o recebimento de cada mês automaticamente"
        icon={<HandCoins size={18} />}
        size="large"
        footer={
          <>
            {edit?.net ? (
              <p className="mr-auto min-w-0 truncate text-xs text-muted">
                Líquido: <b className="money text-pos">{brl(edit.net)}</b>
                {edit.gross && edit.gross > edit.net ? <> · descontos: <b className="money text-neg">{brl(edit.gross - edit.net)}</b> ({pct(((edit.gross - edit.net) / edit.gross) * 100, 1)})</> : null}
              </p>
            ) : null}
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </>
        }
      >
        {edit && (
          <div onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit()}>
            <Tabs
              idBase="income"
              aria-label="Seções da renda"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "geral", label: "Geral", icon: <FileText size={15} />, invalid: !!(errors.name || errors.net) },
                { id: "recebimento", label: "Recebimento", icon: <Tags size={15} /> },
                { id: "notas", label: "Observações", icon: <NotebookPen size={15} /> },
              ]}
            />
            <div className="min-h-[19rem] pt-5">
              <TabPanel idBase="income" id="geral" value={tab} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                <Field label="Nome" required error={errors.name} className="sm:col-span-2">
                  <Input
                    autoFocus
                    aria-invalid={!!errors.name}
                    value={edit.name ?? ""}
                    onChange={(e) => { setEdit({ ...edit, name: e.target.value }); setErrors((x) => ({ ...x, name: undefined })); }}
                    placeholder="Ex.: Salário empresa X"
                  />
                </Field>
                <Field label="Tipo">
                  <Combobox value={edit.type} onChange={(v) => v && setEdit({ ...edit, type: v })} options={Object.entries(INCOME_TYPES).map(([k, v]) => ({ value: k, label: v }))} />
                </Field>
                <Field label="Dia do pagamento">
                  <Input type="number" min={1} max={31} value={edit.pay_day ?? 5} onChange={(e) => setEdit({ ...edit, pay_day: Number(e.target.value) })} />
                </Field>
                <Field label="Valor bruto" hint="Opcional — como está no holerite">
                  <MoneyInput value={edit.gross ?? 0} onChange={(v) => setEdit({ ...edit, gross: v })} />
                </Field>
                <Field label="Valor líquido" required error={errors.net} hint="O que cai na conta">
                  <MoneyInput
                    aria-invalid={!!errors.net}
                    value={edit.net ?? 0}
                    onChange={(v) => { setEdit({ ...edit, net: v }); setErrors((x) => ({ ...x, net: undefined })); }}
                  />
                </Field>
              </TabPanel>

              <TabPanel idBase="income" id="recebimento" value={tab} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                <Field label="Quem recebe">
                  <Combobox value={edit.member_id} onChange={(v) => setEdit({ ...edit, member_id: v })} nullLabel="Ninguém em especial" options={members.map((m) => ({ value: m.id, label: m.name, description: m.relation ?? undefined, color: m.color }))} />
                </Field>
                <Field label="Cai na conta">
                  <Combobox
                    value={edit.account_id}
                    onChange={(v) => setEdit({ ...edit, account_id: v })}
                    nullLabel="Não definida"
                    options={accounts.filter((a) => a.type !== "cartao_credito").map((a) => ({ value: a.id, label: a.name, description: a.bank ?? undefined, color: a.color }))}
                  />
                </Field>
                <Field label="Categoria" hint="Em “Automática” o app escolhe pelo tipo da renda" className="sm:col-span-2">
                  <Combobox value={edit.category_id} onChange={(v) => setEdit({ ...edit, category_id: v })} nullLabel="Automática pelo tipo" options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))} />
                </Field>
              </TabPanel>

              <TabPanel idBase="income" id="notas" value={tab}>
                <Field label="Observações" hint="Empresa, regime, benefícios incluídos...">
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
