mod db;
mod lan;
mod migrations;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

use db::{Db, ExecResult, Statement};
use lan::{RemoteConfig, ServerHandle};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    #[default]
    Local,
    Server,
    Client,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct Config {
    mode: Mode,
    remote: Option<RemoteConfig>,
    server_port: Option<u16>,
    server_token: Option<String>,
}

struct AppState {
    db: Db,
    db_path: PathBuf,
    config_path: PathBuf,
    config: Mutex<Config>,
    server: Mutex<Option<ServerHandle>>,
}

impl AppState {
    fn save_config(&self) {
        let cfg = self.config.lock().unwrap().clone();
        if let Ok(json) = serde_json::to_string_pretty(&cfg) {
            let _ = std::fs::write(&self.config_path, json);
        }
    }
    fn remote(&self) -> Option<RemoteConfig> {
        let cfg = self.config.lock().unwrap();
        if cfg.mode == Mode::Client {
            cfg.remote.clone()
        } else {
            None
        }
    }
}

type CmdResult<T> = Result<T, String>;

// ---------------- Banco de dados ----------------

#[tauri::command]
async fn db_query(
    state: State<'_, AppState>,
    sql: String,
    params: Option<Vec<Value>>,
) -> CmdResult<Vec<Map<String, Value>>> {
    let st = Statement {
        sql,
        params: params.unwrap_or_default(),
    };
    if let Some(remote) = state.remote() {
        let v = lan::remote_call(&remote, "/api/query", &st).await?;
        return serde_json::from_value(v).map_err(|e| e.to_string());
    }
    let conn = state.db.lock().unwrap();
    db::query(&conn, &st).map_err(|e| e.to_string())
}

#[tauri::command]
async fn db_execute(
    state: State<'_, AppState>,
    sql: String,
    params: Option<Vec<Value>>,
) -> CmdResult<ExecResult> {
    let st = Statement {
        sql,
        params: params.unwrap_or_default(),
    };
    if let Some(remote) = state.remote() {
        let v = lan::remote_call(&remote, "/api/execute", &st).await?;
        return serde_json::from_value(v).map_err(|e| e.to_string());
    }
    let conn = state.db.lock().unwrap();
    db::execute(&conn, &st).map_err(|e| e.to_string())
}

#[tauri::command]
async fn db_batch(
    state: State<'_, AppState>,
    statements: Vec<Statement>,
) -> CmdResult<Vec<ExecResult>> {
    if let Some(remote) = state.remote() {
        let v = lan::remote_call(&remote, "/api/batch", &statements).await?;
        return serde_json::from_value(v).map_err(|e| e.to_string());
    }
    let conn = state.db.lock().unwrap();
    db::batch(&conn, &statements).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_backup(state: State<'_, AppState>, path: String) -> CmdResult<()> {
    let conn = state.db.lock().unwrap();
    db::backup_to(&conn, &PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_restore(state: State<'_, AppState>, path: String) -> CmdResult<()> {
    if state.config.lock().unwrap().mode == Mode::Client {
        return Err("Desconecte do servidor antes de restaurar um backup local.".into());
    }
    let mut conn = state.db.lock().unwrap();
    db::restore_from(&mut conn, &PathBuf::from(path)).map_err(|e| e.to_string())
}

// ---------------- Rede local ----------------

#[derive(Serialize)]
struct LanStatus {
    mode: Mode,
    ip: String,
    port: Option<u16>,
    token: Option<String>,
    remote_host: Option<String>,
    db_path: String,
    version: String,
}

fn status_of(state: &AppState) -> LanStatus {
    let cfg = state.config.lock().unwrap().clone();
    let server = state.server.lock().unwrap();
    LanStatus {
        mode: cfg.mode,
        ip: lan::local_ip(),
        port: server.as_ref().map(|s| s.port),
        token: server.as_ref().map(|s| s.token.clone()),
        remote_host: cfg.remote.map(|r| format!("{}:{}", r.host, r.port)),
        db_path: state.db_path.to_string_lossy().into_owned(),
        version: env!("CARGO_PKG_VERSION").into(),
    }
}

#[tauri::command]
fn lan_status(state: State<'_, AppState>) -> LanStatus {
    status_of(&state)
}

#[tauri::command]
async fn lan_server_start(
    state: State<'_, AppState>,
    port: Option<u16>,
    new_token: Option<bool>,
) -> CmdResult<LanStatus> {
    if let Some(h) = state.server.lock().unwrap().take() {
        h.stop();
    }
    let (port, token) = {
        let cfg = state.config.lock().unwrap();
        let port = port.or(cfg.server_port).unwrap_or(lan::DEFAULT_PORT);
        let token = if new_token.unwrap_or(false) {
            None
        } else {
            cfg.server_token.clone()
        };
        (port, token.unwrap_or_else(lan::generate_token))
    };
    let handle = lan::start_server(state.db.clone(), port, token.clone()).await?;
    *state.server.lock().unwrap() = Some(handle);
    {
        let mut cfg = state.config.lock().unwrap();
        cfg.mode = Mode::Server;
        cfg.server_port = Some(port);
        cfg.server_token = Some(token);
    }
    state.save_config();
    Ok(status_of(&state))
}

#[tauri::command]
fn lan_server_stop(state: State<'_, AppState>) -> LanStatus {
    if let Some(h) = state.server.lock().unwrap().take() {
        h.stop();
    }
    state.config.lock().unwrap().mode = Mode::Local;
    state.save_config();
    status_of(&state)
}

#[tauri::command]
async fn lan_client_connect(
    state: State<'_, AppState>,
    host: String,
    port: u16,
    token: String,
) -> CmdResult<LanStatus> {
    let remote = RemoteConfig {
        host: host.trim().into(),
        port,
        token: token.trim().to_uppercase(),
    };
    lan::remote_ping(&remote)
        .await
        .map_err(|e| format!("Não encontrei o servidor: {e}"))?;
    // testa o código de acesso
    lan::remote_call(
        &remote,
        "/api/query",
        &Statement {
            sql: "SELECT 1 AS ok".into(),
            params: vec![],
        },
    )
    .await?;
    if let Some(h) = state.server.lock().unwrap().take() {
        h.stop();
    }
    {
        let mut cfg = state.config.lock().unwrap();
        cfg.mode = Mode::Client;
        cfg.remote = Some(remote);
    }
    state.save_config();
    Ok(status_of(&state))
}

#[tauri::command]
fn lan_client_disconnect(state: State<'_, AppState>) -> LanStatus {
    state.config.lock().unwrap().mode = Mode::Local;
    state.save_config();
    status_of(&state)
}

// ---------------- Arquivos e janelas ----------------

#[tauri::command]
fn write_text_file(path: String, contents: String) -> CmdResult<()> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, contents: Vec<u8>) -> CmdResult<()> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> CmdResult<String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    // extratos de bancos brasileiros às vezes vêm em Latin-1
    Ok(match String::from_utf8(bytes.clone()) {
        Ok(s) => s,
        Err(_) => bytes.iter().map(|&b| b as char).collect(),
    })
}

#[tauri::command]
fn app_exit(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("martins-financa.db");
            let config_path = data_dir.join("config.json");
            let conn = db::open(&db_path).map_err(|e| e.to_string())?;
            let config: Config = std::fs::read_to_string(&config_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            let resume_server = config.mode == Mode::Server;

            app.manage(AppState {
                db: Arc::new(Mutex::new(conn)),
                db_path,
                config_path,
                config: Mutex::new(config),
                server: Mutex::new(None),
            });

            // Se este computador era o servidor, volta a compartilhar automaticamente.
            if resume_server {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let state = handle.state::<AppState>();
                    let _ = lan_server_start(state, None, None).await;
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_query,
            db_execute,
            db_batch,
            db_backup,
            db_restore,
            lan_status,
            lan_server_start,
            lan_server_stop,
            lan_client_connect,
            lan_client_disconnect,
            write_text_file,
            write_binary_file,
            read_text_file,
            app_exit
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Martins Finança");
}
