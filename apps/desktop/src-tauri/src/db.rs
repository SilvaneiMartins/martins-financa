//! Camada de acesso ao SQLite.
//!
//! O frontend envia SQL parametrizado (nunca concatenado) e recebe linhas como JSON.
//! A mesma camada é usada localmente (comandos Tauri) e pelo servidor da rede local.

use rusqlite::{types::ValueRef, Connection, ToSql};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::migrations::MIGRATIONS;

pub type Db = Arc<Mutex<Connection>>;

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("Erro no banco de dados: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Operação não permitida: {0}")]
    Forbidden(String),
    #[error("{0}")]
    Other(String),
}

impl Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub rows_affected: usize,
    pub last_insert_id: i64,
}

pub fn open(path: &Path) -> Result<Connection, DbError> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;
         PRAGMA synchronous = NORMAL;",
    )?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<(), DbError> {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        if version > current {
            let tx = conn.unchecked_transaction()?;
            tx.execute_batch(sql)?;
            tx.execute_batch(&format!("PRAGMA user_version = {version};"))?;
            tx.commit()?;
        }
    }
    Ok(())
}

/// Bloqueia comandos que poderiam escapar do banco da aplicação.
pub fn guard(sql: &str) -> Result<(), DbError> {
    let upper = sql.to_uppercase();
    for word in [
        "ATTACH",
        "DETACH",
        "VACUUM",
        "LOAD_EXTENSION",
        "WRITABLE_SCHEMA",
    ] {
        if upper.contains(word) {
            return Err(DbError::Forbidden(word.to_lowercase()));
        }
    }
    Ok(())
}

fn to_sql_values(params: &[Value]) -> Vec<Box<dyn ToSql>> {
    params
        .iter()
        .map(|v| -> Box<dyn ToSql> {
            match v {
                Value::Null => Box::new(rusqlite::types::Null),
                Value::Bool(b) => Box::new(*b as i64),
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i)
                    } else {
                        Box::new(n.as_f64().unwrap_or(0.0))
                    }
                }
                Value::String(s) => Box::new(s.clone()),
                other => Box::new(other.to_string()),
            }
        })
        .collect()
}

pub fn query(conn: &Connection, st: &Statement) -> Result<Vec<Map<String, Value>>, DbError> {
    guard(&st.sql)?;
    let mut stmt = conn.prepare_cached(&st.sql)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let values = to_sql_values(&st.params);
    let refs: Vec<&dyn ToSql> = values.iter().map(|b| b.as_ref()).collect();
    let mut rows = stmt.query(refs.as_slice())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut obj = Map::with_capacity(names.len());
        for (i, name) in names.iter().enumerate() {
            let v = match row.get_ref(i)? {
                ValueRef::Null => Value::Null,
                ValueRef::Integer(n) => Value::Number(n.into()),
                ValueRef::Real(f) => Number::from_f64(f)
                    .map(Value::Number)
                    .unwrap_or(Value::Null),
                ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
                ValueRef::Blob(_) => Value::Null,
            };
            obj.insert(name.clone(), v);
        }
        out.push(obj);
    }
    Ok(out)
}

pub fn execute(conn: &Connection, st: &Statement) -> Result<ExecResult, DbError> {
    guard(&st.sql)?;
    let values = to_sql_values(&st.params);
    let refs: Vec<&dyn ToSql> = values.iter().map(|b| b.as_ref()).collect();
    let rows_affected = conn.execute(&st.sql, refs.as_slice())?;
    Ok(ExecResult {
        rows_affected,
        last_insert_id: conn.last_insert_rowid(),
    })
}

/// Executa vários comandos numa única transação (tudo ou nada).
pub fn batch(conn: &Connection, sts: &[Statement]) -> Result<Vec<ExecResult>, DbError> {
    let tx = conn.unchecked_transaction()?;
    let mut results = Vec::with_capacity(sts.len());
    for st in sts {
        results.push(execute(&tx, st)?);
    }
    tx.commit()?;
    Ok(results)
}

/// Cópia consistente do banco (funciona com o app aberto).
pub fn backup_to(conn: &Connection, dest: &Path) -> Result<(), DbError> {
    let mut dst = Connection::open(dest)?;
    let backup = rusqlite::backup::Backup::new(conn, &mut dst)?;
    backup.run_to_completion(256, std::time::Duration::from_millis(5), None)?;
    Ok(())
}

/// Restaura um backup para dentro do banco atual.
pub fn restore_from(conn: &mut Connection, src: &Path) -> Result<(), DbError> {
    let source = Connection::open(src)?;
    // valida se é um banco do Martins Finança
    let ok: i64 = source
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='transactions'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| DbError::Other("Arquivo não é um backup válido".into()))?;
    if ok == 0 {
        return Err(DbError::Other(
            "Arquivo não é um backup do Martins Finança".into(),
        ));
    }
    {
        let backup = rusqlite::backup::Backup::new(&source, conn)?;
        backup.run_to_completion(256, std::time::Duration::from_millis(5), None)?;
    }
    migrate(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_db() -> Connection {
        let path = std::env::temp_dir().join(format!("mf-test-{}.db", rand::random::<u32>()));
        open(&path).expect("abre banco")
    }

    #[test]
    fn migra_e_consulta() {
        let conn = temp_db();
        let st = Statement {
            sql: "SELECT count(*) AS n FROM categories WHERE kind = ?".into(),
            params: vec![json!("despesa")],
        };
        let rows = query(&conn, &st).unwrap();
        assert!(rows[0]["n"].as_i64().unwrap() > 10);
    }

    #[test]
    fn batch_e_atomico() {
        let conn = temp_db();
        let ok = Statement {
            sql: "INSERT INTO members (name) VALUES (?)".into(),
            params: vec![json!("Ana")],
        };
        let bad = Statement {
            sql: "INSERT INTO nao_existe VALUES (1)".into(),
            params: vec![],
        };
        assert!(batch(&conn, &[ok, bad]).is_err());
        let n = query(
            &conn,
            &Statement {
                sql: "SELECT count(*) AS n FROM members".into(),
                params: vec![],
            },
        )
        .unwrap();
        assert_eq!(n[0]["n"], json!(0));
    }

    #[test]
    fn bloqueia_attach() {
        let conn = temp_db();
        let st = Statement {
            sql: "ATTACH DATABASE '/tmp/x.db' AS x".into(),
            params: vec![],
        };
        assert!(matches!(execute(&conn, &st), Err(DbError::Forbidden(_))));
    }
}
