import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { notifyDataChanged } from "../lib/db";
import { dateBR, diffDays, today } from "../lib/format";
import { payInvoice, setTxStatus, type DueAlert } from "../lib/repo";
import { useApp } from "../lib/app-context";
import { Money } from "./ui";

const GROUPS: { level: DueAlert["level"]; title: string; icon: typeof Clock; tone: string }[] = [
  { level: "vencido", title: "Vencidos", icon: AlertTriangle, tone: "text-neg" },
  { level: "hoje", title: "Vencem hoje", icon: Clock, tone: "text-warn" },
  { level: "proximo", title: "Próximos vencimentos", icon: CalendarClock, tone: "text-brand" },
];

export function NotificationsPanel({ alerts, onClose }: { alerts: DueAlert[]; onClose: () => void }) {
  const { toast, prefs } = useApp();

  async function settle(a: DueAlert) {
    if (a.invoice) await payInvoice(a.invoice.accountId, a.invoice.date);
    else if (a.txId) await setTxStatus(a.txId, "pago");
    toast(a.kind === "receita" ? "Marcado como recebido" : "Marcado como pago");
    notifyDataChanged();
  }

  return (
    <div className="absolute right-0 top-11 z-40 w-[380px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-bold">Vencimentos</span>
        <span className="text-xs text-muted">próximos {prefs.alertDays} dias</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {alerts.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
            <CheckCircle2 className="text-pos" />
            Tudo em dia! Nenhuma conta vencida ou vencendo.
          </div>
        )}
        {GROUPS.map(({ level, title, icon: Icon, tone }) => {
          const items = alerts.filter((a) => a.level === level);
          if (!items.length) return null;
          return (
            <div key={level}>
              <div className={`flex items-center gap-2 bg-surface-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider ${tone}`}>
                <Icon size={13} /> {title} · {items.length}
              </div>
              {items.map((a) => {
                const d = diffDays(today(), a.date);
                return (
                  <div key={a.key} className="flex items-center gap-3 border-t border-line px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{a.title}</div>
                      <div className="text-xs text-muted">
                        {dateBR(a.date)} · {d < 0 ? `${-d} dia(s) de atraso` : d === 0 ? "hoje" : `em ${d} dia(s)`}
                      </div>
                    </div>
                    <Money cents={a.amount} signed={a.kind} className="text-sm font-bold" />
                    <button
                      onClick={() => settle(a)}
                      className="rounded-md border border-line px-2 py-1 text-[11px] font-bold hover:bg-surface-2"
                      title={a.kind === "receita" ? "Marcar como recebido" : "Marcar como pago"}
                    >
                      {a.kind === "receita" ? "Recebi" : "Paguei"}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <button onClick={onClose} className="w-full border-t border-line py-2 text-xs font-semibold text-muted hover:bg-surface-2">
        Fechar
      </button>
    </div>
  );
}
