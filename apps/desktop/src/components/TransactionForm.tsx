import { ArrowDownCircle, ArrowUpCircle, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp, useData } from "../lib/app-context";
import { notifyDataChanged } from "../lib/db";
import { brl, today } from "../lib/format";
import { invoiceDueDate, listAccounts, listCategories, listMembers, saveTransaction, type TxInput } from "../lib/repo";
import type { Transaction } from "../lib/types";
import { Combobox } from "./Combobox";
import { Button, Field, Input, Modal, MoneyInput, Segmented, TextArea } from "./ui";

const empty = (kind: "receita" | "despesa"): TxInput => ({
  kind, description: "", amount: 0, date: today(), status: "pago", category_id: null, account_id: null,
  scope: "pessoal", member_id: null, notes: "", installments: 1,
});

export function TransactionForm({
  open, onClose, initial, defaultKind = "despesa", tripId,
}: { open: boolean; onClose: () => void; initial?: Transaction | null; defaultKind?: "receita" | "despesa"; tripId?: number }) {
  const { toast } = useApp();
  const [f, setF] = useState<TxInput>(empty(defaultKind));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({});
  const { data: categories = [] } = useData(() => listCategories(), []);
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: members = [] } = useData(() => listMembers(), []);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setF({
        id: initial.id, kind: initial.kind, description: initial.description, amount: initial.amount, date: initial.date,
        status: initial.status, category_id: initial.category_id, account_id: initial.account_id, scope: initial.scope,
        member_id: initial.member_id, notes: initial.notes, trip_id: initial.trip_id,
      });
    } else {
      setF({ ...empty(defaultKind), trip_id: tripId ?? null, scope: tripId ? "familiar" : "pessoal" });
    }
    setErrors({});
  }, [open, initial, defaultKind, tripId]);

  const set = <K extends keyof TxInput>(k: K, v: TxInput[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (k === "description" || k === "amount") setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const account = accounts.find((a) => a.id === f.account_id);
  const isCard = account?.type === "cartao_credito";
  const cats = categories.filter((c) => c.kind === f.kind);
  const invoice = useMemo(
    () => (isCard && account && !f.id ? invoiceDueDate(f.date, account.closing_day ?? 1, account.due_day ?? 10) : null),
    [isCard, account, f.date, f.id],
  );

  async function submit() {
    const next: typeof errors = {};
    if (!f.description.trim()) next.description = "Informe a descrição";
    if (f.amount <= 0) next.amount = "Informe um valor maior que zero";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await saveTransaction(f);
      toast(f.id ? "Lançamento atualizado" : "Lançamento salvo");
      notifyDataChanged();
      onClose();
    } catch (e) {
      toast(String(e), "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={f.id ? "Editar lançamento" : f.kind === "receita" ? "Nova receita" : "Nova despesa"}
      description={f.id ? "Altere os dados do lançamento" : "Registre uma entrada ou saída de dinheiro"}
      icon={f.id ? <Pencil size={18} /> : f.kind === "receita" ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
      size="large"
      footer={
        <>
          <span className="mr-auto hidden text-[11px] text-muted sm:block"><kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans font-semibold">Ctrl</kbd> + <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans font-semibold">Enter</kbd> para salvar</span>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-x-5" onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit()}>
        {!f.id && (
          <div className="sm:col-span-2 md:col-span-3">
            <Segmented value={f.kind} onChange={(v) => setF((s) => ({ ...s, kind: v, category_id: null }))} options={[{ value: "despesa", label: "Despesa" }, { value: "receita", label: "Receita" }]} />
          </div>
        )}
        <Field label="Descrição" required error={errors.description} className="sm:col-span-2">
          <Input autoFocus aria-invalid={!!errors.description} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Mercado do mês" />
        </Field>
        <Field label={f.installments && f.installments > 1 ? "Valor total" : "Valor"} required error={errors.amount}>
          <MoneyInput aria-invalid={!!errors.amount} value={f.amount} onChange={(v) => set("amount", v)} />
        </Field>
        <Field label={isCard ? "Data da compra" : "Data / vencimento"} hint={invoice ? `Entra na fatura que vence em ${invoice.split("-").reverse().join("/")}` : undefined}>
          <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Combobox
            value={f.category_id}
            onChange={(v) => set("category_id", v)}
            nullLabel="Sem categoria"
            options={cats.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          />
        </Field>
        <Field label="Conta / cartão">
          <Combobox
            value={f.account_id}
            onChange={(v) => set("account_id", v)}
            nullLabel="Nenhuma"
            options={accounts
              .filter((a) => f.kind === "despesa" || a.type !== "cartao_credito")
              .map((a) => ({ value: a.id, label: a.name, description: a.type === "cartao_credito" ? "Cartão de crédito" : a.bank ?? undefined, color: a.color }))}
          />
        </Field>
        {!f.id && f.kind === "despesa" && (
          <Field label="Parcelas" hint={f.installments && f.installments > 1 ? `${f.installments}x de ${brl(Math.floor(f.amount / f.installments))}` : undefined}>
            <Combobox
              value={f.installments ?? 1}
              onChange={(v) => set("installments", v ?? 1)}
              searchable
              options={Array.from({ length: 48 }, (_, i) => i + 1).map((n) => ({ value: n, label: n === 1 ? "À vista" : `${n}x`, keywords: String(n) }))}
            />
          </Field>
        )}
        {!isCard && (
          <Field label="Situação">
            <Combobox
              value={f.status}
              onChange={(v) => v && set("status", v)}
              options={[
                { value: "pago", label: f.kind === "receita" ? "Recebido" : "Pago" },
                { value: "pendente", label: f.kind === "receita" ? "A receber" : "A pagar" },
              ]}
            />
          </Field>
        )}
        <Field label="Gasto">
          <Combobox
            value={f.scope}
            onChange={(v) => v && set("scope", v)}
            options={[{ value: "pessoal", label: "Pessoal" }, { value: "familiar", label: "Familiar" }]}
          />
        </Field>
        <Field label="Membro da família">
          <Combobox value={f.member_id} onChange={(v) => set("member_id", v)} nullLabel="Ninguém em especial" options={members.map((m) => ({ value: m.id, label: m.name, description: m.relation ?? undefined, color: m.color }))} />
        </Field>
        <Field label="Observações" className="sm:col-span-2 md:col-span-3">
          <TextArea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
