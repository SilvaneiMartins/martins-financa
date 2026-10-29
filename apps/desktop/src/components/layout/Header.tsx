import { useEffect, useRef, useState } from "react";
import { Bell, Download, Eye, EyeOff } from "lucide-react";

import { IconButton } from "../ui";
import { dueAlerts } from "../../lib/repo";
import { ExportModal } from "../ExportModal";
import { ThemeMenu } from "../ThemeMenu";
import { useApp, useData } from "../../lib/app-context";
import { NotificationsPanel } from "../NotificationsPanel";

export function Header() {
  const { prefs, setPrefs } = useApp();
  const [openBell, setOpenBell] = useState(false);
  const [openExport, setOpenExport] = useState(false);
  const { data: alerts = [] } = useData(() => dueAlerts(prefs.alertDays), [prefs.alertDays]);
  const urgent = alerts.filter((a) => a.level !== "proximo").length;
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openBell) return;
    const fn = (e: MouseEvent) => bellRef.current && !bellRef.current.contains(e.target as Node) && setOpenBell(false);
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, [openBell]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="" className="h-7 w-7" />
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight">Martins Finança</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Agência Martins</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label={prefs.privacy ? "Mostrar valores" : "Ocultar valores"} onClick={() => setPrefs({ privacy: !prefs.privacy })}>
          {prefs.privacy ? <EyeOff size={18} /> : <Eye size={18} />}
        </IconButton>

        <ThemeMenu />

        <div className="relative" ref={bellRef}>
          <IconButton label="Notificações de vencimento" onClick={() => setOpenBell((v) => !v)}>
            <Bell size={18} />
            {alerts.length > 0 && (
              <span className={`absolute right-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold leading-4 text-white ${urgent ? "bg-neg" : "bg-warn"}`}>
                {alerts.length > 99 ? "99+" : alerts.length}
              </span>
            )}
          </IconButton>
          {openBell && <NotificationsPanel alerts={alerts} onClose={() => setOpenBell(false)} />}
        </div>

        <button
          onClick={() => setOpenExport(true)}
          className="ml-2 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink hover:brightness-110"
        >
          <Download size={16} /> Exportar
        </button>
      </div>
      <ExportModal open={openExport} onClose={() => setOpenExport(false)} />
    </header>
  );
}
