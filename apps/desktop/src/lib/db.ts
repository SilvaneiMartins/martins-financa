import { invoke } from "@tauri-apps/api/core";

/**
 * Acesso ao banco. O Rust decide se a consulta roda no SQLite local
 * ou no servidor da rede local (modo cliente) — o frontend não muda nada.
 * Sempre use parâmetros (?) — nunca concatene valores no SQL.
 */
export type Param = string | number | boolean | null | undefined;
export interface Stmt {
  sql: string;
  params?: Param[];
}
export interface ExecResult {
  rows_affected: number;
  last_insert_id: number;
}

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const clean = (params: Param[] = []) => params.map((p) => (p === undefined ? null : p));

export function query<T = Record<string, unknown>>(sql: string, params: Param[] = []): Promise<T[]> {
  return invoke<T[]>("db_query", { sql, params: clean(params) });
}

export async function one<T = Record<string, unknown>>(sql: string, params: Param[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export function execute(sql: string, params: Param[] = []): Promise<ExecResult> {
  return invoke<ExecResult>("db_execute", { sql, params: clean(params) });
}

export function batch(statements: Stmt[]): Promise<ExecResult[]> {
  return invoke<ExecResult[]>("db_batch", {
    statements: statements.map((s) => ({ sql: s.sql, params: clean(s.params) })),
  });
}

/** INSERT/UPDATE genérico a partir de um objeto. */
export async function save(table: string, data: Record<string, Param>, id?: number | null): Promise<number> {
  const keys = Object.keys(data).filter((k) => k !== "id");
  if (id) {
    const set = keys.map((k) => `${k} = ?`).join(", ");
    await execute(`UPDATE ${table} SET ${set} WHERE id = ?`, [...keys.map((k) => data[k]), id]);
    return id;
  }
  const res = await execute(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    keys.map((k) => data[k]),
  );
  return res.last_insert_id;
}

export function remove(table: string, id: number) {
  return execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

/** Avisa todas as janelas que os dados mudaram (telas recarregam). */
export function notifyDataChanged() {
  if (isTauri()) import("@tauri-apps/api/event").then(({ emit }) => emit("mf:data-changed"));
  else window.dispatchEvent(new CustomEvent("mf:data-changed"));
}
