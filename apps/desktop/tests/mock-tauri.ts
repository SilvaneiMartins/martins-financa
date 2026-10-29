// Substitui o `invoke` do Tauri nos testes: executa o SQL num SQLite em memória
// (node:sqlite) aplicando as MESMAS migrações do Rust (lidas de migrations.rs).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

// node:sqlite (Node 22.5+) carregado em tempo de execução — o Vite não o resolve como import
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

let db: any;

export function resetDb() {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const src = readFileSync(resolve(__dirname, "../src-tauri/src/migrations.rs"), "utf8");
  for (const m of src.matchAll(/r#"([\s\S]*?)"#/g)) db.exec(m[1]);
  return db;
}

const norm = (p: unknown[] = []) => p.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v));
const exec = (sql: string, params?: unknown[]) => {
  const r = db.prepare(sql).run(...norm(params));
  return { rows_affected: Number(r.changes), last_insert_id: Number(r.lastInsertRowid) };
};

export async function invoke(cmd: string, args: any): Promise<any> {
  if (!db) resetDb();
  switch (cmd) {
    case "db_query":
      return db.prepare(args.sql).all(...norm(args.params)).map((r: object) => ({ ...r }));
    case "db_execute":
      return exec(args.sql, args.params);
    case "db_batch": {
      db.exec("BEGIN");
      try {
        const out = args.statements.map((s: any) => exec(s.sql, s.params));
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    default:
      throw new Error(`invoke não simulado: ${cmd}`);
  }
}
