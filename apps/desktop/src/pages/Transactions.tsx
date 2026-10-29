import { Check, Pencil, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { MonthNav } from "../components/MonthNav";
import { TransactionForm } from "../components/TransactionForm";
import { Badge, Button, Card, Dot, Empty, IconButton, Input, Money, PageHeader, Segmented, Table, confirmDialog } from "../components/ui";
import { Combobox } from "../components/Combobox";
import { useApp, useData } from "../lib/app-context";
import { notifyDataChanged } from "../lib/db";
import { brl, dateBR } from "../lib/format";
import { deleteTransaction, listAccounts, listCategories, listMembers, listTransactions, monthSummary, setTxStatus, type TxFilter } from "../lib/repo";
import type { Transaction } from "../lib/types";

export function Transactions() {
  const { month, toast } = useApp();
  const [kind, setKind] = useState<"" | "receita" | "despesa">("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [scope, setScope] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState<null | "receita" | "despesa">(null);

  const filter: TxFilter = { month, kind, status, categoryId, accountId, scope, memberId, search: search.trim() };
  const deps = [month, kind, status, categoryId, accountId, scope, memberId, search];
  const { data: rows = [], loading } = useData(() => listTransactions(filter), deps);
  const { data: s } = useData(() => monthSummary(month, { ...filter, month: undefined }), deps);
  const { data: categories = [] } = useData(() => listCategories(), []);
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: members = [] } = useData(() => listMembers(), []);

  const anyFilter = kind || status || categoryId || accountId || scope || memberId || search;
  const clear = () => {
    setKind(""); setStatus(""); setCategoryId(null); setAccountId(null); setScope(""); setMemberId(null); setSearch("");
  };

  async function toggle(t: Transaction) {
    await setTxStatus(t.id, t.status === "pago" ? "pendente" : "pago");
    notifyDataChanged();
  }

  async function del(t: Transaction) {
    let whole = false;
    if (t.group_key) whole = await confirmDialog(`"${t.description}" faz parte de um parcelamento.\n\nSim = excluir TODAS as parcelas\nCancelar = escolher excluir só esta`);
    if (!whole && !(await confirmDialog(`Excluir "${t.description}"?`))) return;
    await deleteTransaction(t, whole);
    toast("Lançamento excluído");
    notifyDataChanged();
  }

  return (
    <>
      <PageHeader title="Lançamentos" subtitle="Receitas e despesas — pessoais e da família">
        <MonthNav />
        <Button variant="primary" onClick={() => setFormOpen(kind || "despesa")}><Plus size={16} /> Novo lançamento</Button>
      </PageHeader>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={kind} onChange={setKind} options={[{ value: "", label: "Todos" }, { value: "receita", label: "Entradas" }, { value: "despesa", label: "Saídas" }]} />
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Buscar descrição ou observação" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Combobox className="w-44" size="sm" value={status || null} onChange={(v) => setStatus(v ?? "")} nullLabel="Situação" aria-label="Situação" options={[{ value: "pago", label: "Pago / recebido" }, { value: "pendente", label: "Pendente" }]} />
          <Combobox className="w-48" size="sm" value={categoryId} onChange={setCategoryId} nullLabel="Categoria" aria-label="Categoria" options={categories.filter((c) => !kind || c.kind === kind).map((c) => ({ value: c.id, label: c.name, color: c.color }))} />
          <Combobox className="w-48" size="sm" value={accountId} onChange={setAccountId} nullLabel="Conta / cartão" aria-label="Conta" options={accounts.map((a) => ({ value: a.id, label: a.name, description: a.type === "cartao_credito" ? "Cartão de crédito" : a.bank ?? undefined, color: a.color }))} />
          <Combobox className="w-48" size="sm" value={scope || null} onChange={(v) => setScope(v ?? "")} nullLabel="Pessoal + familiar" aria-label="Gasto" options={[{ value: "pessoal", label: "Pessoal" }, { value: "familiar", label: "Familiar" }]} />
          {members.length > 0 && (
            <Combobox className="w-44" size="sm" value={memberId} onChange={setMemberId} nullLabel="Membro" aria-label="Membro" options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))} />
          )}
          {anyFilter && <Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button>}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {[
          ["Entradas", s?.receitas ?? 0, "text-pos"],
          ["Saídas", s?.despesas ?? 0, "text-neg"],
          ["Resultado", (s?.receitas ?? 0) - (s?.despesas ?? 0), (s?.receitas ?? 0) >= (s?.despesas ?? 0) ? "text-pos" : "text-neg"],
          ["Pendente a pagar", s?.aPagar ?? 0, "text-warn"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className={`money num text-lg font-extrabold ${c}`}>{brl(v as number)}</div>
          </div>
        ))}
      </div>

      <Card pad={false}>
        {!loading && rows.length === 0 ? (
          <Empty title="Nenhum lançamento encontrado" text={anyFilter ? "Tente remover alguns filtros." : "Comece adicionando uma receita ou despesa, ou importe um extrato do seu banco."} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Situação</th><th className="!text-right">Valor</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="group">
                  <td className="num whitespace-nowrap text-muted">{dateBR(t.date)}</td>
                  <td>
                    <div className="font-semibold">{t.description}</div>
                    <div className="flex gap-1.5 text-[11px] text-muted">
                      {t.scope === "familiar" && <span>Familiar</span>}
                      {t.member_name && <span>· {t.member_name}</span>}
                      {t.purchase_date && <span>· compra {dateBR(t.purchase_date)}</span>}
                    </div>
                  </td>
                  <td><span className="flex items-center gap-2"><Dot color={t.category_color} />{t.category_name ?? "—"}</span></td>
                  <td className="text-muted">{t.account_name ?? "—"}</td>
                  <td>
                    {t.status === "pago" ? <Badge tone="pos">{t.kind === "receita" ? "Recebido" : "Pago"}</Badge> : <Badge tone="warn">Pendente</Badge>}
                  </td>
                  <td className="text-right font-bold"><Money cents={t.amount} signed={t.kind} /></td>
                  <td className="w-28">
                    <div className="flex justify-end opacity-60 group-hover:opacity-100">
                      <IconButton label={t.status === "pago" ? "Marcar como pendente" : t.kind === "receita" ? "Marcar como recebido" : "Marcar como pago"} onClick={() => toggle(t)}>
                        {t.status === "pago" ? <Undo2 size={15} /> : <Check size={15} />}
                      </IconButton>
                      <IconButton label="Editar" onClick={() => setEditing(t)}><Pencil size={15} /></IconButton>
                      <IconButton label="Excluir" onClick={() => del(t)} className="hover:text-neg"><Trash2 size={15} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <TransactionForm open={!!formOpen || !!editing} initial={editing} defaultKind={formOpen ?? "despesa"} onClose={() => { setFormOpen(null); setEditing(null); }} />
    </>
  );
}
