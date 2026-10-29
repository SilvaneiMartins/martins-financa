import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "../lib/theme";

const icon = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    {children}
  </svg>
);

const THEMES: { value: Theme; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Sistema", description: "Acompanha o seu computador", icon: icon(<><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>) },
  { value: "light", label: "Claro", description: "Fundo claro (padrão)", icon: icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>) },
  { value: "dark", label: "Escuro", description: "Mais confortável à noite", icon: icon(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />) },
];

/** Menu de tema: clicar abre, clicar de novo (ou fora, ou Esc) fecha. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.value === theme) ?? THEMES[1];

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
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold outline-none transition hover:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40 aria-expanded:border-brand/50"
      >
        {current.icon}
        <span className="hidden sm:inline">{current.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="menu" aria-label="Tema do site" className="absolute right-0 top-11 z-20 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(22,60,110,.35)]">
          {THEMES.map((t) => {
            const selected = t.value === theme;
            return (
              <button
                key={t.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(t.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:bg-brand-soft ${selected ? "bg-brand-soft text-brand" : "hover:bg-bg"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected ? "bg-surface text-brand" : "bg-bg text-muted"}`}>{t.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{t.label}</span>
                  <span className={`block truncate text-[11px] ${selected ? "text-brand/80" : "text-muted"}`}>{t.description}</span>
                </span>
                {selected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
