// Regras de negócio e consultas do Martins Finança.
import { batch, execute, one, query, save, type Param, type Stmt } from "./db";
import {
  addMonths,
  dateInMonth,
  isoDate,
  monthRange,
  monthsBetween,
  parseISO,
  today,
} from "./format";
import type { Account, Category, Commitment, Goal, IncomeSource, Member, Transaction, Trip, TripItem } from "./types";

// ---------------- Cadastros básicos ----------------

export const listCategories = (kind?: "receita" | "despesa") =>
  query<Category>(
    `SELECT * FROM categories WHERE archived = 0 ${kind ? "AND kind = ?" : ""} ORDER BY kind DESC, name`,
    kind ? [kind] : [],
  );

export const listMembers = () => query<Member>("SELECT * FROM members ORDER BY name");

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  return query<Account>(
    `SELECT a.*,
       CASE WHEN a.type = 'cartao_credito' THEN
         COALESCE((SELECT SUM(t.amount) FROM transactions t
                   WHERE t.account_id = a.id AND t.kind='despesa' AND t.status='pendente'), 0)
       ELSE
         a.initial_balance
         + COALESCE((SELECT SUM(CASE WHEN t.kind='receita' THEN t.amount ELSE -t.amount END)
                     FROM transactions t WHERE t.account_id = a.id AND t.status='pago'), 0)
       END AS balance
     FROM accounts a ${includeArchived ? "" : "WHERE a.archived = 0"}
     ORDER BY a.type = 'cartao_credito', a.name`,
  );
}

// ---------------- Lançamentos ----------------

export interface TxFilter {
  month?: string;
  from?: string;
  to?: string;
  kind?: string;
  status?: string;
  categoryId?: number | null;
  accountId?: number | null;
  scope?: string;
  memberId?: number | null;
  tripId?: number | null;
  search?: string;
}

export function buildTxWhere(f: TxFilter): { where: string; params: Param[] } {
  const w: string[] = [];
  const p: Param[] = [];
  if (f.month) {
    const [a, b] = monthRange(f.month);
    w.push("t.date BETWEEN ? AND ?");
    p.push(a, b);
  }
  if (f.from) { w.push("t.date >= ?"); p.push(f.from); }
  if (f.to) { w.push("t.date <= ?"); p.push(f.to); }
  if (f.kind) { w.push("t.kind = ?"); p.push(f.kind); }
  if (f.status) { w.push("t.status = ?"); p.push(f.status); }
  if (f.categoryId) { w.push("t.category_id = ?"); p.push(f.categoryId); }
  if (f.accountId) { w.push("t.account_id = ?"); p.push(f.accountId); }
  if (f.scope) { w.push("t.scope = ?"); p.push(f.scope); }
  if (f.memberId) { w.push("t.member_id = ?"); p.push(f.memberId); }
  if (f.tripId) { w.push("t.trip_id = ?"); p.push(f.tripId); }
  if (f.search) {
    w.push("(t.description LIKE ? OR t.notes LIKE ?)");
    p.push(`%${f.search}%`, `%${f.search}%`);
  }
  return { where: w.length ? `WHERE ${w.join(" AND ")}` : "", params: p };
}

const TX_SELECT = `SELECT t.*, c.name AS category_name, c.color AS category_color,
  a.name AS account_name, a.type AS account_type, m.name AS member_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN members m ON m.id = t.member_id`;

export function listTransactions(f: TxFilter, limit = 2000) {
  const { where, params } = buildTxWhere(f);
  return query<Transaction>(`${TX_SELECT} ${where} ORDER BY t.date DESC, t.id DESC LIMIT ${limit}`, params);
}

/** Calcula a data de vencimento da fatura em que uma compra no cartão cai. */
export function invoiceDueDate(purchase: string, closingDay: number, dueDay: number): string {
  const d = parseISO(purchase);
  let month = purchase.slice(0, 7);
  // compra após o fechamento vai para a fatura seguinte
  if (d.getDate() > closingDay) month = addMonths(month, 1);
  // vencimento antes do fechamento => vence no mês seguinte ao fechamento
  if (dueDay <= closingDay) month = addMonths(month, 1);
  return dateInMonth(month, dueDay);
}

export interface TxInput {
  id?: number;
  kind: "receita" | "despesa";
  description: string;
  amount: number; // centavos (total da compra quando parcelado)
  date: string;
  status: "pago" | "pendente";
  category_id: number | null;
  account_id: number | null;
  scope: "pessoal" | "familiar";
  member_id: number | null;
  trip_id?: number | null;
  notes?: string | null;
  installments?: number;
}

export async function saveTransaction(input: TxInput) {
  const account = input.account_id
    ? await one<Account>("SELECT * FROM accounts WHERE id = ?", [input.account_id])
    : undefined;
  const isCard = account?.type === "cartao_credito";
  const base = {
    kind: input.kind,
    category_id: input.category_id,
    account_id: input.account_id,
    scope: input.scope,
    member_id: input.member_id,
    trip_id: input.trip_id ?? null,
    notes: input.notes ?? null,
  };

  if (input.id) {
    await save("transactions", { ...base, description: input.description, amount: input.amount, date: input.date, status: input.status }, input.id);
    return;
  }

  const n = Math.max(1, input.installments ?? 1);
  const firstDate = isCard
    ? invoiceDueDate(input.date, account!.closing_day ?? 1, account!.due_day ?? 10)
    : input.date;
  const status = isCard ? "pendente" : input.status;
  const group = n > 1 ? `g${Date.now()}` : null;
  const per = Math.floor(input.amount / n);
  const rest = input.amount - per * n;

  const stmts: Stmt[] = [];
  for (let i = 0; i < n; i++) {
    const month = addMonths(firstDate.slice(0, 7), i);
    const date = i === 0 ? firstDate : dateInMonth(month, Number(firstDate.slice(8, 10)));
    const row: Record<string, Param> = {
      ...base,
      description: n > 1 ? `${input.description} (${i + 1}/${n})` : input.description,
      amount: per + (i === 0 ? rest : 0),
      date,
      purchase_date: isCard ? input.date : null,
      status: i === 0 ? status : "pendente",
      installment_no: n > 1 ? i + 1 : null,
      installment_total: n > 1 ? n : null,
      group_key: group,
    };
    const keys = Object.keys(row);
    stmts.push({
      sql: `INSERT INTO transactions (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      params: keys.map((k) => row[k]),
    });
  }
  await batch(stmts);
}

export const setTxStatus = (id: number, status: "pago" | "pendente") =>
  execute("UPDATE transactions SET status = ? WHERE id = ?", [status, id]);

export async function deleteTransaction(tx: Transaction, wholeGroup: boolean) {
  if (wholeGroup && tx.group_key) await execute("DELETE FROM transactions WHERE group_key = ?", [tx.group_key]);
  else await execute("DELETE FROM transactions WHERE id = ?", [tx.id]);
}

export const payInvoice = (accountId: number, dueDate: string) =>
  execute(
    "UPDATE transactions SET status='pago' WHERE account_id = ? AND date = ? AND kind='despesa' AND status='pendente'",
    [accountId, dueDate],
  );

// ---------------- Recorrências (compromissos e rendas) ----------------

/** Parcela de um compromisso para um mês (null se fora do período). */
export function installmentFor(c: Commitment, month: string): number | null {
  const start = c.start_date.slice(0, 7);
  const idx = monthsBetween(start, month);
  if (idx < 0) return null;
  if (c.type === "avulsa") return idx === 0 ? 1 : null;
  if (c.total_installments && idx >= c.total_installments) return null;
  return idx + 1;
}

/**
 * Gera lançamentos PENDENTES para compromissos e fontes de renda do mês.
 * Idempotente: usa ref_key único (INSERT OR IGNORE).
 */
export async function generateRecurring(month: string) {
  const [commitments, incomes, receitaFallback] = await Promise.all([
    query<Commitment>("SELECT * FROM commitments WHERE active = 1"),
    query<IncomeSource>("SELECT * FROM income_sources WHERE active = 1"),
    one<{ id: number }>("SELECT id FROM categories WHERE kind='receita' ORDER BY id LIMIT 1"),
  ]);
  const stmts: Stmt[] = [];
  for (const c of commitments) {
    const n = installmentFor(c, month);
    if (!n) continue;
    const total = c.type === "avulsa" ? null : c.total_installments;
    stmts.push({
      sql: `INSERT OR IGNORE INTO transactions
        (kind, description, amount, date, status, category_id, account_id, scope, member_id,
         commitment_id, installment_no, installment_total, ref_key)
        VALUES ('despesa', ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        total ? `${c.name} (${n}/${total})` : c.name,
        c.amount, dateInMonth(month, c.due_day), c.category_id, c.account_id, c.scope, c.member_id,
        c.id, total ? n : null, total, `c:${c.id}:${month}`,
      ],
    });
  }
  for (const s of incomes) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO transactions
        (kind, description, amount, date, status, category_id, account_id, scope, member_id, income_source_id, ref_key)
        VALUES ('receita', ?, ?, ?, 'pendente', ?, ?, 'familiar', ?, ?, ?)`,
      params: [
        s.name, s.net, dateInMonth(month, s.pay_day), s.category_id ?? receitaFallback?.id ?? null,
        s.account_id, s.member_id, s.id, `i:${s.id}:${month}`,
      ],
    });
  }
  if (stmts.length) await batch(stmts);
}

// ---------------- Alertas de vencimento ----------------

export interface DueAlert {
  key: string;
  title: string;
  date: string;
  amount: number;
  kind: "receita" | "despesa";
  level: "vencido" | "hoje" | "proximo";
  txId?: number;
  invoice?: { accountId: number; date: string };
}

export async function dueAlerts(daysAhead = 7): Promise<DueAlert[]> {
  const t = today();
  const limit = isoDate(new Date(Date.now() + daysAhead * 86_400_000));
  const rows = await query<{
    id: number; description: string; date: string; amount: number; kind: "receita" | "despesa";
    account_id: number | null; account_type: string | null; account_name: string | null;
  }>(
    `SELECT t.id, t.description, t.date, t.amount, t.kind, t.account_id, a.type AS account_type, a.name AS account_name
     FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.status = 'pendente' AND t.date <= ? AND t.date >= date(?, '-120 days')
     ORDER BY t.date`,
    [limit, t],
  );
  const level = (d: string): DueAlert["level"] => (d < t ? "vencido" : d === t ? "hoje" : "proximo");
  const out: DueAlert[] = [];
  const invoices = new Map<string, DueAlert>();
  for (const r of rows) {
    if (r.account_type === "cartao_credito" && r.kind === "despesa" && r.account_id) {
      const key = `inv:${r.account_id}:${r.date}`;
      const cur = invoices.get(key);
      if (cur) cur.amount += r.amount;
      else
        invoices.set(key, {
          key, title: `Fatura ${r.account_name}`, date: r.date, amount: r.amount, kind: "despesa",
          level: level(r.date), invoice: { accountId: r.account_id, date: r.date },
        });
    } else {
      out.push({ key: `tx:${r.id}`, title: r.description, date: r.date, amount: r.amount, kind: r.kind, level: level(r.date), txId: r.id });
    }
  }
  return [...out, ...invoices.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------- Resumos e relatórios ----------------

export interface MonthSummary {
  receitas: number;
  despesas: number;
  recebido: number;
  pago: number;
  aReceber: number;
  aPagar: number;
}

export function monthSummary(month: string, f: TxFilter = {}): Promise<MonthSummary> {
  return summary({ ...f, month });
}

export async function summary(f: TxFilter): Promise<MonthSummary> {
  const { where, params } = buildTxWhere(f);
  const r = await one<MonthSummary>(
    `SELECT
      COALESCE(SUM(CASE WHEN kind='receita' THEN amount END),0) AS receitas,
      COALESCE(SUM(CASE WHEN kind='despesa' THEN amount END),0) AS despesas,
      COALESCE(SUM(CASE WHEN kind='receita' AND status='pago' THEN amount END),0) AS recebido,
      COALESCE(SUM(CASE WHEN kind='despesa' AND status='pago' THEN amount END),0) AS pago,
      COALESCE(SUM(CASE WHEN kind='receita' AND status='pendente' THEN amount END),0) AS aReceber,
      COALESCE(SUM(CASE WHEN kind='despesa' AND status='pendente' THEN amount END),0) AS aPagar
     FROM transactions t ${where}`,
    params,
  );
  return r ?? { receitas: 0, despesas: 0, recebido: 0, pago: 0, aReceber: 0, aPagar: 0 };
}

export interface MonthPoint { month: string; receitas: number; despesas: number; saldo: number }

export async function monthlySeries(fromMonth: string, toMonth: string, f: TxFilter = {}): Promise<MonthPoint[]> {
  const [from] = monthRange(fromMonth);
  const [, to] = monthRange(toMonth);
  const { where, params } = buildTxWhere({ ...f, from, to });
  const rows = await query<{ month: string; receitas: number; despesas: number }>(
    `SELECT substr(date,1,7) AS month,
       COALESCE(SUM(CASE WHEN kind='receita' THEN amount END),0) AS receitas,
       COALESCE(SUM(CASE WHEN kind='despesa' THEN amount END),0) AS despesas
     FROM transactions t ${where} GROUP BY 1 ORDER BY 1`,
    params,
  );
  const map = new Map(rows.map((r) => [r.month, r]));
  const out: MonthPoint[] = [];
  for (let m = fromMonth; m <= toMonth; m = addMonths(m, 1)) {
    const r = map.get(m);
    out.push({ month: m, receitas: r?.receitas ?? 0, despesas: r?.despesas ?? 0, saldo: (r?.receitas ?? 0) - (r?.despesas ?? 0) });
  }
  return out;
}

export interface CategoryTotal { id: number | null; name: string; color: string; total: number; count: number }

export function totalsByCategory(kind: "receita" | "despesa", f: TxFilter) {
  const { where, params } = buildTxWhere({ ...f, kind });
  return query<CategoryTotal>(
    `SELECT c.id, COALESCE(c.name,'Sem categoria') AS name, COALESCE(c.color,'#94a3b8') AS color,
       SUM(t.amount) AS total, COUNT(*) AS count
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     ${where} GROUP BY c.id ORDER BY total DESC`,
    params,
  );
}

export function totalsBy(field: "account" | "member" | "scope", f: TxFilter) {
  const { where, params } = buildTxWhere(f);
  const expr =
    field === "account" ? "COALESCE(a.name,'Sem conta')" : field === "member" ? "COALESCE(m.name,'Família / geral')" : "t.scope";
  return query<{ name: string; receitas: number; despesas: number }>(
    `SELECT ${expr} AS name,
       COALESCE(SUM(CASE WHEN t.kind='receita' THEN t.amount END),0) AS receitas,
       COALESCE(SUM(CASE WHEN t.kind='despesa' THEN t.amount END),0) AS despesas
     FROM transactions t LEFT JOIN accounts a ON a.id=t.account_id LEFT JOIN members m ON m.id=t.member_id
     ${where} GROUP BY 1 ORDER BY despesas DESC`,
    params,
  );
}

// ---------------- Compromissos e rendas ----------------

export const listCommitments = () =>
  query<Commitment>(
    `SELECT cm.*, c.name AS category_name,
      (SELECT COUNT(*) FROM transactions t WHERE t.commitment_id = cm.id AND t.status='pago') AS paid_count
     FROM commitments cm LEFT JOIN categories c ON c.id = cm.category_id
     ORDER BY cm.active DESC, cm.due_day`,
  );

export const listIncomeSources = () =>
  query<IncomeSource>(
    `SELECT s.*, m.name AS member_name FROM income_sources s LEFT JOIN members m ON m.id = s.member_id
     ORDER BY s.active DESC, s.net DESC`,
  );

// ---------------- Planejamento familiar (orçamento) ----------------

export interface BudgetRow { category_id: number; name: string; color: string; planned: number; actual: number }

export function budgetForMonth(month: string, scope?: string) {
  const [a, b] = monthRange(month);
  return query<BudgetRow>(
    `SELECT c.id AS category_id, c.name, c.color,
       COALESCE(bg.planned, 0) AS planned,
       COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.category_id = c.id AND t.kind='despesa'
          AND t.date BETWEEN ? AND ? ${scope ? "AND t.scope = ?" : ""}), 0) AS actual
     FROM categories c LEFT JOIN budgets bg ON bg.category_id = c.id AND bg.month = ?
     WHERE c.kind = 'despesa' AND c.archived = 0
     ORDER BY planned DESC, actual DESC, c.name`,
    scope ? [a, b, scope, month] : [a, b, month],
  );
}

export const setBudget = (month: string, categoryId: number, planned: number) =>
  execute(
    `INSERT INTO budgets (month, category_id, planned) VALUES (?,?,?)
     ON CONFLICT(month, category_id) DO UPDATE SET planned = excluded.planned`,
    [month, categoryId, planned],
  );

export async function copyBudget(fromMonth: string, toMonth: string) {
  await execute(
    `INSERT INTO budgets (month, category_id, planned)
       SELECT ?, category_id, planned FROM budgets WHERE month = ?
     ON CONFLICT(month, category_id) DO UPDATE SET planned = excluded.planned`,
    [toMonth, fromMonth],
  );
}

/** Média dos últimos 3 meses por categoria — base para sugerir orçamento. */
export function averageSpend(month: string) {
  const [from] = monthRange(addMonths(month, -3));
  const [, to] = monthRange(addMonths(month, -1));
  return query<{ category_id: number; avg: number }>(
    `SELECT category_id, CAST(SUM(amount) / 3 AS INTEGER) AS avg FROM transactions
     WHERE kind='despesa' AND date BETWEEN ? AND ? AND category_id IS NOT NULL GROUP BY category_id`,
    [from, to],
  );
}

// ---------------- Viagens ----------------

export const listTrips = () =>
  query<Trip>(
    `SELECT tr.*,
       COALESCE((SELECT SUM(planned) FROM trip_items i WHERE i.trip_id = tr.id),0) AS planned_total,
       COALESCE((SELECT SUM(actual) FROM trip_items i WHERE i.trip_id = tr.id),0)
       + COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.trip_id = tr.id AND t.kind='despesa'),0) AS actual_total
     FROM trips tr ORDER BY tr.start_date DESC`,
  );

export const listTripItems = (tripId: number) =>
  query<TripItem>("SELECT * FROM trip_items WHERE trip_id = ? ORDER BY category, id", [tripId]);

// ---------------- Metas de longo prazo ----------------

export const listGoals = () => query<Goal>("SELECT * FROM goals ORDER BY priority, target_date");

export async function contributeToGoal(goalId: number, amount: number) {
  await batch([
    { sql: "INSERT INTO goal_contributions (goal_id, amount, date) VALUES (?,?,?)", params: [goalId, amount, today()] },
    { sql: "UPDATE goals SET current = current + ? WHERE id = ?", params: [amount, goalId] },
  ]);
}

/**
 * Projeção mês a mês com juros compostos.
 * Retorna quantos meses faltam para atingir o alvo (ou null se > 100 anos).
 */
export function projectGoal(g: Pick<Goal, "current" | "target" | "monthly_contribution" | "expected_return">, maxMonths = 1200) {
  const r = Math.pow(1 + (g.expected_return || 0) / 100, 1 / 12) - 1;
  let v = g.current;
  const points: { m: number; value: number }[] = [{ m: 0, value: v }];
  let reached: number | null = v >= g.target ? 0 : null;
  for (let m = 1; m <= maxMonths && reached === null; m++) {
    v = v * (1 + r) + g.monthly_contribution;
    if (m % 3 === 0 || v >= g.target) points.push({ m, value: Math.round(v) });
    if (v >= g.target) reached = m;
  }
  return { months: reached, points };
}

/** Aporte mensal necessário para chegar ao alvo numa data. */
export function requiredMonthly(g: Pick<Goal, "current" | "target" | "expected_return">, months: number) {
  if (months <= 0) return Math.max(0, g.target - g.current);
  const r = Math.pow(1 + (g.expected_return || 0) / 100, 1 / 12) - 1;
  const fvCurrent = g.current * Math.pow(1 + r, months);
  const remaining = g.target - fvCurrent;
  if (remaining <= 0) return 0;
  if (r === 0) return Math.ceil(remaining / months);
  return Math.ceil((remaining * r) / (Math.pow(1 + r, months) - 1));
}

// ---------------- Configurações persistidas no banco ----------------

export async function getSetting(key: string): Promise<string | undefined> {
  const r = await one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return r?.value;
}

export const setSetting = (key: string, value: string) =>
  execute("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
