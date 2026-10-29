import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useApp } from "../../lib/app-context";
import { isTauri, notifyDataChanged } from "../../lib/db";
import { addMonths, brl, currentMonth, today } from "../../lib/format";
import { dueAlerts, generateRecurring } from "../../lib/repo";
import { HelpModal } from "../HelpModal";
import { SettingsModal } from "../../settings/SettingsModal";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";

export function AppLayout() {
  const { toasts, toast, prefs } = useApp();
  const started = useRef(false);

  // Ao abrir: gera lançamentos recorrentes do mês atual e do próximo, e avisa vencimentos.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const m = currentMonth();
        await generateRecurring(m);
        await generateRecurring(addMonths(m, 1));
        notifyDataChanged();
        if (prefs.notifyOS && isTauri()) await notifyOS();
      } catch (e) {
        toast(String(e), "erro");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
      <StatusBar />
      <SettingsModal />
      <HelpModal />
      <div className="pointer-events-none fixed bottom-10 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-sm rounded-xl px-4 py-3 text-sm font-semibold shadow-xl ${t.tone === "erro" ? "bg-neg text-white" : "bg-ink text-bg"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Uma notificação do sistema por dia com o que está vencido ou vence hoje. */
async function notifyOS() {
  const key = "mf:last-os-notify";
  try {
    if (localStorage.getItem(key) === today()) return;
  } catch { /* ok */ }
  const alerts = (await dueAlerts(1)).filter((a) => a.kind === "despesa");
  if (!alerts.length) return;
  const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
  let ok = await isPermissionGranted();
  if (!ok) ok = (await requestPermission()) === "granted";
  if (!ok) return;
  const vencidos = alerts.filter((a) => a.level === "vencido");
  const total = alerts.reduce((s, a) => s + a.amount, 0);
  sendNotification({
    title: "Martins Finança — vencimentos",
    body: `${vencidos.length} vencido(s), ${alerts.length - vencidos.length} vencendo hoje/amanhã · ${brl(total)}`,
  });
  try { localStorage.setItem(key, today()); } catch { /* ok */ }
}
