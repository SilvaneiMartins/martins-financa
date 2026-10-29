import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../lib/app-context";
import type { Theme } from "../lib/prefs";
import { cls } from "../lib/format";

const THEMES: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", description: "Acompanha o seu computador", icon: Monitor },
  { value: "light", label: "Claro", description: "Fundo claro (padrão)", icon: Sun },
  { value: "dark", label: "Escuro", description: "Mais confortável à noite", icon: Moon },
];

/**
 * Menu de tema do cabeçalho. Mesmo comportamento do sino de notificações:
 * clicar abre, clicar de novo (ou fora, ou Esc) fecha.
 */
export function ThemeMenu() {
  const { prefs, setPrefs } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.value === prefs.theme) ?? THEMES[1];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tema: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 aria-expanded:bg-surface-2 aria-expanded:text-ink"
      >
        <current.icon size={17} />
        <span className="hidden min-w-14 text-left md:inline">{current.label}</span>
        <ChevronDown size={14} className={cls("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" aria-label="Tema da aplicação" className="mf-anim-pop absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
          {THEMES.map(({ value, label, description, icon: Icon }) => {
            const selected = value === prefs.theme;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setPrefs({ theme: value });
                  setOpen(false);
                }}
                className={cls(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:bg-brand-soft",
                  selected ? "bg-brand-soft text-brand" : "hover:bg-surface-2",
                )}
              >
                <span className={cls("grid h-8 w-8 shrink-0 place-items-center rounded-lg", selected ? "bg-surface text-brand" : "bg-surface-2 text-muted")}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{label}</span>
                  <span className={cls("block truncate text-[11px]", selected ? "text-brand/80" : "text-muted")}>{description}</span>
                </span>
                {selected && <Check size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
