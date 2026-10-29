import {
  ArrowLeftRight, BarChart3, CalendarClock, ChevronsLeft, ChevronsRight, CircleHelp, FileUp, HandCoins,
  LayoutDashboard, Plane, Power, Settings, Target, Users, Wallet,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useApp } from "../../lib/app-context";
import { cls } from "../../lib/format";
import { CloseAppModal } from "../CloseAppModal";

export const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/contas", label: "Contas e cartões", icon: Wallet },
  { to: "/compromissos", label: "Contas a pagar", icon: CalendarClock },
  { to: "/rendas", label: "Rendas", icon: HandCoins },
  { to: "/importar", label: "Importar extrato", icon: FileUp },
  { to: "/familia", label: "Planejamento familiar", icon: Users },
  { to: "/viagens", label: "Viagens", icon: Plane },
  { to: "/metas", label: "Longo prazo", icon: Target },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function Sidebar() {
  const { openSettings, openHelp } = useApp();
  const [closing, setClosing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("mf:sidebar") === "1"; } catch { return false; }
  });
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("mf:sidebar", c ? "0" : "1"); } catch { /* ok */ }
      return !c;
    });
  };

  const item = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors";
  const label = (t: string) => (collapsed ? null : <span className="truncate">{t}</span>);

  return (
    <aside className={cls("flex shrink-0 flex-col border-r border-line bg-surface transition-[width]", collapsed ? "w-[60px]" : "w-60")}>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Navegação principal">
        {NAV.map(({ to, label: l, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? l : undefined}
            className={({ isActive }) =>
              cls(item, isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink", collapsed && "justify-center px-0")
            }
          >
            <Icon size={18} className="shrink-0" />
            {label(l)}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-line p-2">
        <button onClick={() => openSettings()} className={cls(item, "w-full text-muted hover:bg-surface-2 hover:text-ink", collapsed && "justify-center px-0")} title="Configurações">
          <Settings size={18} /> {label("Configurações")}
        </button>
        <button onClick={openHelp} className={cls(item, "w-full text-muted hover:bg-surface-2 hover:text-ink", collapsed && "justify-center px-0")} title="Ajuda">
          <CircleHelp size={18} /> {label("Ajuda")}
        </button>
        <button onClick={() => setClosing(true)} className={cls(item, "w-full text-muted hover:bg-neg-soft hover:text-neg", collapsed && "justify-center px-0")} title="Fechar o aplicativo">
          <Power size={18} /> {label("Fechar")}
        </button>
        <button onClick={toggle} className={cls(item, "w-full text-muted hover:bg-surface-2", collapsed && "justify-center px-0")} title={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />} {label("Recolher")}
        </button>
      </div>
      <CloseAppModal open={closing} onClose={() => setClosing(false)} />
    </aside>
  );
}
