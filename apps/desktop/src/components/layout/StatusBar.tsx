import { AlertTriangle, Database, Monitor, RefreshCw, Server, Wifi } from "lucide-react";
import { useApp, useData } from "../../lib/app-context";
import { brl, monthLabel } from "../../lib/format";
import { dueAlerts, monthSummary } from "../../lib/repo";

export function StatusBar() {
  const { lan, month, lastSync, bump, prefs, openSettings } = useApp();
  const { data: s } = useData(() => monthSummary(month), [month]);
  const { data: alerts = [] } = useData(() => dueAlerts(0), []);
  const overdue = alerts.filter((a) => a.level !== "proximo").length;
  const saldo = (s?.receitas ?? 0) - (s?.despesas ?? 0);

  const mode =
    lan?.mode === "server"
      ? { icon: Server, text: `Servidor ${lan.ip}:${lan.port} · código ${lan.token}`, tone: "text-brand" }
      : lan?.mode === "client"
        ? { icon: Wifi, text: `Conectado a ${lan.remote_host}`, tone: "text-brand" }
        : { icon: Monitor, text: "Banco local", tone: "text-muted" };

  const sep = <span className="h-3 w-px bg-line" />;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-line bg-surface px-3 text-[11px] text-muted">
      <button onClick={() => openSettings("rede")} className={`flex items-center gap-1.5 font-semibold hover:underline ${mode.tone}`} title="Configurar rede local">
        <mode.icon size={12} /> {mode.text}
      </button>
      {sep}
      <span className="flex items-center gap-1.5">
        <Database size={12} /> {monthLabel(month, true)}
      </span>
      {sep}
      <span>
        Saldo previsto: <b className={`money num ${saldo < 0 ? "text-neg" : "text-pos"}`}>{brl(saldo)}</b>
      </span>
      <span>
        A pagar: <b className="money num text-ink">{brl(s?.aPagar ?? 0)}</b>
      </span>
      {overdue > 0 && (
        <span className="flex items-center gap-1 font-bold text-neg">
          <AlertTriangle size={12} /> {overdue} vencido(s)/hoje
        </span>
      )}
      <div className="ml-auto flex items-center gap-3">
        {prefs.privacy && <span className="font-semibold text-warn">Modo privacidade</span>}
        <button onClick={bump} className="flex items-center gap-1 hover:text-ink" title="Atualizar dados">
          <RefreshCw size={11} /> {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </button>
        {sep}
        <span>v{lan?.version ?? "0.1.0"}</span>
      </div>
    </footer>
  );
}
