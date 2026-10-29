//! Compartilhamento na rede local (mesmo Wi-Fi).
//!
//! Por que não abrir o arquivo .db por pasta compartilhada? O SQLite não é seguro
//! sobre SMB/NFS (travas de arquivo falham e o banco pode corromper). Por isso um
//! computador vira **Servidor** (dono do arquivo) e expõe uma API HTTP protegida por
//! código de acesso; os demais entram em modo **Cliente** e todas as consultas vão
//! para o servidor. Um único gravador = sem corrupção.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::SocketAddr;
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;

use crate::db::{self, Db, Statement};

pub const DEFAULT_PORT: u16 = 47820;

#[derive(Clone)]
struct ServerState {
    db: Db,
    token: String,
}

pub struct ServerHandle {
    pub port: u16,
    pub token: String,
    shutdown: Option<oneshot::Sender<()>>,
}

impl ServerHandle {
    pub fn stop(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteConfig {
    pub host: String,
    pub port: u16,
    pub token: String,
}

pub fn generate_token() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(8)
        .map(char::from)
        .collect::<String>()
        .to_uppercase()
}

pub fn local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

fn authorized(headers: &HeaderMap, token: &str) -> bool {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.trim_start_matches("Bearer ").trim() == token)
        .unwrap_or(false)
}

fn err(status: StatusCode, msg: impl ToString) -> Response {
    (status, Json(json!({ "error": msg.to_string() }))).into_response()
}

async fn ping() -> impl IntoResponse {
    Json(json!({ "app": "martins-financa", "version": env!("CARGO_PKG_VERSION") }))
}

async fn h_query(
    State(s): State<ServerState>,
    headers: HeaderMap,
    Json(st): Json<Statement>,
) -> Response {
    if !authorized(&headers, &s.token) {
        return err(StatusCode::UNAUTHORIZED, "Código de acesso inválido");
    }
    let conn = s.db.lock().unwrap();
    match db::query(&conn, &st) {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => err(StatusCode::BAD_REQUEST, e),
    }
}

async fn h_execute(
    State(s): State<ServerState>,
    headers: HeaderMap,
    Json(st): Json<Statement>,
) -> Response {
    if !authorized(&headers, &s.token) {
        return err(StatusCode::UNAUTHORIZED, "Código de acesso inválido");
    }
    let conn = s.db.lock().unwrap();
    match db::execute(&conn, &st) {
        Ok(r) => Json(r).into_response(),
        Err(e) => err(StatusCode::BAD_REQUEST, e),
    }
}

async fn h_batch(
    State(s): State<ServerState>,
    headers: HeaderMap,
    Json(sts): Json<Vec<Statement>>,
) -> Response {
    if !authorized(&headers, &s.token) {
        return err(StatusCode::UNAUTHORIZED, "Código de acesso inválido");
    }
    let conn = s.db.lock().unwrap();
    match db::batch(&conn, &sts) {
        Ok(r) => Json(r).into_response(),
        Err(e) => err(StatusCode::BAD_REQUEST, e),
    }
}

pub async fn start_server(db: Db, port: u16, token: String) -> Result<ServerHandle, String> {
    let state = ServerState {
        db,
        token: token.clone(),
    };
    let app = Router::new()
        .route("/api/ping", get(ping))
        .route("/api/query", post(h_query))
        .route("/api/execute", post(h_execute))
        .route("/api/batch", post(h_batch))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Não foi possível abrir a porta {port}: {e}"))?;
    let (tx, rx) = oneshot::channel::<()>();
    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });
    Ok(ServerHandle {
        port,
        token,
        shutdown: Some(tx),
    })
}

// ---------- Cliente ----------

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("http client")
}

pub async fn remote_call(
    cfg: &RemoteConfig,
    path: &str,
    body: &impl Serialize,
) -> Result<Value, String> {
    let url = format!("http://{}:{}{}", cfg.host, cfg.port, path);
    let res = client()
        .post(&url)
        .bearer_auth(&cfg.token)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Servidor indisponível ({}): {e}", cfg.host))?;
    let status = res.status();
    let value: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(value
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erro no servidor")
            .to_string());
    }
    Ok(value)
}

pub async fn remote_ping(cfg: &RemoteConfig) -> Result<Value, String> {
    let url = format!("http://{}:{}/api/ping", cfg.host, cfg.port);
    let res = client().get(&url).send().await.map_err(|e| e.to_string())?;
    res.json().await.map_err(|e| e.to_string())
}
