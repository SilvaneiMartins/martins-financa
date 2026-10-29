// Componentes de interface reutilizáveis.
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { brl, cls } from "../lib/format";

type Variant = "primary" | "ghost" | "outline" | "danger";

export function Button({ variant = "outline", size = "md", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...p}
      className={cls(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand text-brand-ink hover:brightness-110",
        variant === "outline" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink hover:bg-surface-2",
        variant === "danger" && "bg-neg text-white hover:brightness-110",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...p}
      aria-label={label}
      title={label}
      className={cls("relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors", className)}
    >
      {children}
    </button>
  );
}

export function Card({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cls("rounded-2xl border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 className="text-sm font-bold">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Money({ cents, signed, tone, className }: { cents: number; signed?: "receita" | "despesa"; tone?: boolean; className?: string }) {
  const color = signed === "receita" ? "text-pos" : signed === "despesa" ? "text-neg" : tone ? (cents < 0 ? "text-neg" : "text-pos") : "";
  const prefix = signed === "receita" ? "+ " : signed === "despesa" ? "− " : "";
  return <span className={cls("money num whitespace-nowrap", color, className)}>{prefix}{brl(signed ? Math.abs(cents) : cents)}</span>;
}

export function Stat({ label, cents, hint, tone, icon }: { label: string; cents: number; hint?: ReactNode; tone?: "pos" | "neg" | "brand" | "warn"; icon?: ReactNode }) {
  const toneCls = { pos: "text-pos", neg: "text-neg", brand: "text-brand", warn: "text-warn" }[tone ?? "brand"];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
        <span className={toneCls}>{icon}</span>
      </div>
      <div className={cls("money num mt-1.5 text-xl font-extrabold", toneCls)}>{brl(cents)}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "pos" | "neg" | "warn" | "brand" | "muted" }) {
  const t = {
    pos: "bg-pos-soft text-pos",
    neg: "bg-neg-soft text-neg",
    warn: "bg-warn-soft text-warn",
    brand: "bg-brand-soft text-brand",
    muted: "bg-surface-2 text-muted",
  }[tone];
  return <span className={cls("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", t)}>{children}</span>;
}

export function Field({ label, children, hint, error, required, className }: { label: string; children: ReactNode; hint?: string; error?: string; required?: boolean; className?: string }) {
  return (
    <label className={cls("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
        {required && <span className="ml-0.5 text-neg" aria-hidden="true">*</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-[11px] font-semibold text-neg">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>
      )}
    </label>
  );
}

export const inputCls =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-neg aria-[invalid=true]:ring-neg/15 disabled:opacity-60";

/** largura cheia, a não ser que o className já defina uma largura */
const widthOf = (c?: string) => (/(^|\s)(w-|flex-1)/.test(c ?? "") ? "" : "w-full");

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cls(inputCls, widthOf(p.className), p.className)} />;
}

export function TextArea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cls(inputCls, "h-20 w-full py-2", p.className)} />;
}

/** Campo monetário em reais; valor em centavos. */
export function MoneyInput({ value, onChange, ...p }: { value: number; onChange: (cents: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const display = (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
      <input
        {...p}
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(Number(digits || "0"));
        }}
        className={cls(inputCls, "num w-full pl-9 text-right")}
      />
    </div>
  );
}

const MODAL_SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-4xl",
  "3xl": "max-w-5xl",
  /** padrão dos modais grandes: largura 5xl e altura fixa (o conteúdo rola) */
  large: "max-w-5xl",
} as const;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
  /** classe de largura própria (tem prioridade sobre `size`) */
  width?: string;
  /** sem padding e sem rolagem no corpo — o conteúdo gerencia o próprio layout (ex.: Configurações) */
  flush?: boolean;
  panelClassName?: string;
}

/**
 * Janela modal acessível: portal, foco preso e restaurado, Esc/fundo para fechar
 * (sem fechar ao arrastar o mouse para fora) e animação de entrada.
 */
export function Modal({ open, onClose, title, description, icon, children, footer, size = "md", width, flush, panelClassName }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // se nenhum campo pediu foco (autoFocus), foca o painel
    requestAnimationFrame(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      // listas abertas (Combobox) tratam o Esc primeiro
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function trapFocus(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="mf-anim-fade fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); downOnBackdrop.current = false; }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={cls(
          "mf-anim-pop flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_70px_-20px_rgba(22,60,110,0.45)] outline-none",
          width ?? MODAL_SIZES[size],
          size === "large" && "h-[min(720px,92vh)]",
          panelClassName,
        )}
      >
        <header className="flex items-center gap-3 border-b border-line px-6 py-4">
          {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-extrabold tracking-tight">{title}</h2>
            {description && <p id={descId} className="truncate text-xs text-muted">{description}</p>}
          </div>
          <IconButton label="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className={flush ? "flex min-h-0 flex-1" : "min-h-0 flex-1 overflow-y-auto px-6 py-5"}>{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <p className="font-bold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Progress({ value, max, tone }: { value: number; max: number; tone?: "auto" | "brand" }) {
  const ratio = max > 0 ? value / max : 0;
  const color = tone === "brand" ? "bg-brand" : ratio > 1 ? "bg-neg" : ratio > 0.85 ? "bg-warn" : "bg-pos";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(ratio * 100)}>
      <div className={cls("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cls(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-surface-2/60">
        {children}
      </table>
    </div>
  );
}

export function Dot({ color }: { color?: string | null }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color ?? "#94a3b8" }} />;
}

/** Confirmação nativa (diálogo do sistema no app desktop). */
export async function confirmDialog(msg: string, title = "Martins Finança"): Promise<boolean> {
  if ("__TAURI_INTERNALS__" in window) {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return ask(msg, { title, kind: "warning", okLabel: "Sim", cancelLabel: "Cancelar" });
  }
  return window.confirm(msg);
}

export { brl };
