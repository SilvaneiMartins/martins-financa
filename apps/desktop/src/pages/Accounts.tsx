import { CreditCard, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Money, MoneyInput, PageHeader, Progress, confirmDialog } from "../components/ui";
import { Combobox } from "../components/Combobox";
import { useApp, useData } from "../lib/app-context";
import { notifyDataChanged, query, remove, save } from "../lib/db";
import { brl, dateBR, today } from "../lib/format";
import { listAccounts, payInvoice } from "../lib/repo";
import { ACCOUNT_TYPES, type Account, type AccountType } from "../lib/types";

const BANKS = ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Caixa", "Santander", "Inter", "C6 Bank", "PicPay", "Mercado Pago", "Sicoob", "Sicredi", "BTG", "XP", "Banrisul", "Outro"];
const COLORS = ["#2f80d9", "#7c3aed", "#ea580c", "#facc15", "#2563eb", "#dc2626", "#ec4899", "#111827", "#16a34a", "#0891b2"];

const blank: Partial<Account> = { name: "", type: "corrente", bank: "", initial_balance: 0, credit_limit: 0, closing_day: 1, due_day: 10, color: COLORS[0] };

export function Accounts() {
  const { toast } = useApp();
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: invoices = [] } = useData(
    () => query<{ account_id: number; date: string; total: number }>(
      `SELECT account_id, date, SUM(amount) AS total FROM transactions
       WHERE status='pendente' AND kind='despesa' AND account_id IN (SELECT id FROM accounts WHERE type='cartao_credito')
       GROUP BY account_id, date ORDER BY date`,
    ),
    [],
  );
  const [edit, setEdit] = useState<Partial<Account> | null>(null);

  const banks = accounts.filter((a) => a.type !== "cartao_credito");
  const cards = accounts.filter((a) => a.type === "cartao_credito");
  const total = banks.reduce((s, a) => s + (a.balance ?? 0), 0);

  async function submit() {
    if (!edit?.name?.trim()) return toast("Informe o nome", "erro");
    const isCard = edit.type === "cartao_credito";
    await save("accounts", {
      name: edit.name.trim(), type: edit.type!, bank: edit.bank || null, color: edit.color ?? COLORS[0],
      initial_balance: isCard ? 0 : edit.initial_balance ?? 0,
      credit_limit: isCard ? edit.credit_limit ?? 0 : 0,
      closing_day: isCard ? edit.closing_day ?? 1 : null,
      due_day: isCard ? edit.due_day ?? 10 : null,
    }, edit.id);
    toast("Conta salva");
    setEdit(null);
    notifyDataChanged();
  }

  async function del(a: Account) {
    if (!(await confirmDialog(`Excluir "${a.name}"? Os lançamentos continuam, mas ficam sem conta.`))) return;
    await remove("accounts", a.id);
    notifyDataChanged();
  }

  async function pay(a: Account, date: string, value: number) {
    if (!(await confirmDialog(`Marcar a fatura de ${dateBR(date)} do ${a.name} (${brl(value)}) como paga?`))) return;
    await payInvoice(a.id, date);
    toast("Fatura paga");
    notifyDataChanged();
  }

  return (
    <>
      <PageHeader title="Contas e cartões" subtitle={`Saldo total em contas: ${brl(total)}`}>
        <Button onClick={() => setEdit({ ...blank, type: "cartao_credito", color: COLORS[1] })}><CreditCard size={16} /> Novo cartão</Button>
        <Button variant="primary" onClick={() => setEdit({ ...blank })}><Plus size={16} /> Nova conta</Button>
      </PageHeader>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Contas bancárias e carteira</h2>
      {banks.length === 0 ? (
        <Card><Empty icon={<Landmark />} title="Nenhuma conta" text="Cadastre suas contas para acompanhar saldos e importar extratos." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banks.map((a) => (
            <div key={a.id} className="group rounded-2xl border border-line bg-surface p-5" style={{ borderTop: `4px solid ${a.color}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{a.name}</div>
                  <div className="text-xs text-muted">{ACCOUNT_TYPES[a.type]}{a.bank ? ` · ${a.bank}` : ""}</div>
                </div>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <IconButton label="Editar" onClick={() => setEdit(a)}><Pencil size={15} /></IconButton>
                  <IconButton label="Excluir" onClick={() => del(a)}><Trash2 size={15} /></IconButton>
                </div>
              </div>
              <div className="mt-4 text-xs text-muted">Saldo atual</div>
              <Money cents={a.balance ?? 0} tone className="text-2xl font-extrabold" />
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-muted">Cartões de crédito</h2>
      {cards.length === 0 ? (
        <Card><Empty icon={<CreditCard />} title="Nenhum cartão" text="Compras no cartão entram automaticamente na fatura certa, de acordo com o dia de fechamento." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {cards.map((a) => {
            const used = a.balance ?? 0;
            const mine = invoices.filter((i) => i.account_id === a.id);
            const next = mine[0];
            return (
              <div key={a.id} className="group rounded-2xl border border-line bg-surface p-5" style={{ borderTop: `4px solid ${a.color}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{a.name}</div>
                    <div className="text-xs text-muted">Fecha dia {a.closing_day} · vence dia {a.due_day}{a.bank ? ` · ${a.bank}` : ""}</div>
                  </div>
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <IconButton label="Editar" onClick={() => setEdit(a)}><Pencil size={15} /></IconButton>
                    <IconButton label="Excluir" onClick={() => del(a)}><Trash2 size={15} /></IconButton>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-muted">Limite</div><Money cents={a.credit_limit} className="font-bold" /></div>
                  <div><div className="text-xs text-muted">Comprometido</div><Money cents={used} className="font-bold text-neg" /></div>
                  <div><div className="text-xs text-muted">Disponível</div><Money cents={a.credit_limit - used} className="font-bold text-pos" /></div>
                </div>
                <div className="mt-2"><Progress value={used} max={a.credit_limit || 1} /></div>
                {mine.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
                    {mine.slice(0, 4).map((i) => (
                      <li key={i.date} className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Fatura {dateBR(i.date)}</span>
                        {i.date < today() && <Badge tone="neg">Vencida</Badge>}
                        {i === next && i.date >= today() && <Badge tone="brand">Próxima</Badge>}
                        <Money cents={i.total} className="ml-auto font-bold" />
                        <Button size="sm" variant={i === next ? "primary" : "outline"} onClick={() => pay(a, i.date, i.total)}>Pagar</Button>
                      </li>
                    ))}
                    {mine.length > 4 && <li className="text-xs text-muted">+ {mine.length - 4} faturas futuras (parcelas)</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar" : edit?.type === "cartao_credito" ? "Novo cartão de crédito" : "Nova conta"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" onClick={submit}>Salvar</Button></>}
      >
        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" className="col-span-2"><Input autoFocus value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex.: Nubank Silvanei" /></Field>
            <Field label="Tipo">
              <Combobox value={edit.type as string} onChange={(v) => v && setEdit({ ...edit, type: v as AccountType })} searchable={false} options={Object.entries(ACCOUNT_TYPES).map(([k, v]) => ({ value: k, label: v }))} />
            </Field>
            <Field label="Banco / instituição">
              <Combobox value={edit.bank || null} onChange={(v) => setEdit({ ...edit, bank: v ?? "" })} nullLabel="Não informado" options={BANKS.map((b) => ({ value: b, label: b }))} />
            </Field>
            {edit.type === "cartao_credito" ? (
              <>
                <Field label="Limite" className="col-span-2"><MoneyInput value={edit.credit_limit ?? 0} onChange={(v) => setEdit({ ...edit, credit_limit: v })} /></Field>
                <Field label="Dia de fechamento"><Input type="number" min={1} max={31} value={edit.closing_day ?? 1} onChange={(e) => setEdit({ ...edit, closing_day: Number(e.target.value) })} /></Field>
                <Field label="Dia de vencimento"><Input type="number" min={1} max={31} value={edit.due_day ?? 10} onChange={(e) => setEdit({ ...edit, due_day: Number(e.target.value) })} /></Field>
              </>
            ) : (
              <Field label="Saldo inicial" className="col-span-2" hint="Saldo da conta no dia em que você começou a usar o app">
                <MoneyInput value={edit.initial_balance ?? 0} onChange={(v) => setEdit({ ...edit, initial_balance: v })} />
              </Field>
            )}
            <Field label="Cor" className="col-span-2">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEdit({ ...edit, color: c })} aria-label={`Cor ${c}`}
                    className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-surface ${edit.color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
