import { Check, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cls } from "../lib/format";
import { inputCls } from "./ui";

export interface ComboboxOption<V extends string | number = string | number> {
  value: V;
  label: string;
  /** segunda linha, menor (ex.: banco, tipo da conta) */
  description?: string;
  /** bolinha de cor à esquerda (ex.: cor da categoria) */
  color?: string | null;
  icon?: ReactNode;
  disabled?: boolean;
  /** termos extras considerados na busca */
  keywords?: string;
}

export interface ComboboxProps<V extends string | number> {
  value: V | null | undefined;
  onChange: (value: V | null) => void;
  options: ComboboxOption<V>[];
  placeholder?: string;
  /** adiciona uma primeira opção que representa "nenhum" (valor null), ex.: "Sem categoria" */
  nullLabel?: string;
  /** campo de busca; por padrão liga sozinho quando há mais de 7 opções */
  searchable?: boolean;
  /** mostra o botão de limpar quando há valor */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** "sm" para tabelas e barras de filtro */
  size?: "sm" | "md";
  emptyText?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  className?: string;
}

const NULL_KEY = "__null__";
const MAX_LIST_HEIGHT = 260;

/** minúsculas e sem acentos: "Educação" casa com "educacao" */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Row<V extends string | number> {
  key: string;
  value: V | null;
  label: string;
  description?: string;
  color?: string | null;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * Lista suspensa com busca, navegação por teclado e leitor de tela (padrão ARIA "combobox").
 * O foco permanece no campo; a lista é renderizada num portal e por isso não é cortada
 * por modais ou áreas com rolagem.
 */
export function Combobox<V extends string | number>({
  value, onChange, options, placeholder = "Selecione", nullLabel, searchable, clearable, disabled, invalid, autoFocus, size = "md",
  emptyText = "Nada encontrado", id, name, className, ...aria
}: ComboboxProps<V>) {
  const uid = useId();
  const listId = `${uid}-list`;
  const isSearchable = searchable ?? options.length > 7;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const rows = useMemo<Row<V>[]>(() => {
    const q = norm(query.trim());
    const base: Row<V>[] = options
      .filter((o) => !q || norm(`${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`).includes(q))
      .map((o) => ({ key: String(o.value), ...o }));
    if (nullLabel && (!q || norm(nullLabel).includes(q))) base.unshift({ key: NULL_KEY, value: null, label: nullLabel });
    return base;
  }, [options, query, nullLabel]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const openList = useCallback(() => {
    if (disabled || open) return;
    const idx = rows.findIndex((r) => (r.value ?? null) === (value ?? null) && !r.disabled);
    setActive(idx >= 0 ? idx : Math.max(0, rows.findIndex((r) => !r.disabled)));
    setOpen(true);
  }, [disabled, open, rows, value]);

  // posiciona a lista abaixo do campo (ou acima, se faltar espaço)
  const place = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 180 && above > below;
    setPos({
      left: r.left,
      width: r.width,
      maxHeight: Math.min(MAX_LIST_HEIGHT, Math.max(120, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // mantém o item ativo visível
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, pos]);

  // fecha ao clicar fora (o foco fica no campo, então o blur cobre Tab; isto cobre cliques)
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !list.current?.contains(t)) close();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open, close]);

  function choose(row: Row<V> | undefined) {
    if (!row || row.disabled) return;
    onChange(row.value);
    close();
  }

  function move(delta: number) {
    if (!rows.length) return;
    let i = active;
    for (let n = 0; n < rows.length; n++) {
      i = (i + delta + rows.length) % rows.length;
      if (!rows[i].disabled) break;
    }
    setActive(i);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else move(e.key === "ArrowDown" ? 1 : -1);
        break;
      case "Home":
      case "End":
        if (open && !isSearchable) {
          e.preventDefault();
          const order = e.key === "Home" ? rows : [...rows].reverse();
          const target = order.find((r) => !r.disabled);
          if (target) setActive(rows.indexOf(target));
        }
        break;
      case "Enter":
        if (open) {
          e.preventDefault();
          choose(rows[active]);
        }
        break;
      case " ":
        if (!isSearchable) {
          e.preventDefault();
          if (open) choose(rows[active]);
          else openList();
        }
        break;
      case "Escape":
        if (open) {
          // não deixa o Esc fechar também o modal que contém o campo
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case "Tab":
        if (open) close();
        break;
    }
  }

  const showClear = clearable && !disabled && value != null && value !== "";
  const text = open && isSearchable ? query : selected?.label ?? (value == null ? nullLabel ?? "" : "");
  const activeId = open && rows[active] ? `${uid}-opt-${active}` : undefined;

  return (
    <div ref={wrap} className={cls("relative", !/(^|\s)w-/.test(className ?? "") && "w-full", className)}>
      {selected?.icon && (
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted [&>svg]:h-4 [&>svg]:w-4">
          {selected.icon}
        </span>
      )}
      <input
        ref={input}
        id={id}
        name={name}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-autocomplete={isSearchable ? "list" : "none"}
        aria-invalid={invalid || undefined}
        aria-label={aria["aria-label"]}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        readOnly={!isSearchable}
        value={text}
        placeholder={open && isSearchable && selected ? selected.label : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onMouseDown={() => (open ? (isSearchable ? undefined : close()) : openList())}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={cls(inputCls, "w-full truncate pr-14", !!selected?.icon && "pl-9", size === "sm" && "h-8 text-xs", !isSearchable && "cursor-pointer", !selected && value == null && !nullLabel && "text-muted")}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Limpar seleção"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); input.current?.focus(); }}
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={14} />
          </button>
        )}
        <span aria-hidden="true" className="pointer-events-none grid h-7 w-6 place-items-center text-muted">
          <ChevronDown size={16} className={cls("transition-transform duration-150", open && "rotate-180")} />
        </span>
      </div>

      {open && pos &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            className="mf-anim-pop fixed z-[70] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[0_16px_40px_-12px_rgba(22,60,110,0.35)]"
          >
            {rows.length === 0 && <li role="presentation" className="px-3 py-6 text-center text-sm text-muted">{emptyText}</li>}
            {rows.map((r, i) => {
              const isSel = (r.value ?? null) === (value ?? null);
              return (
                <li
                  key={r.key}
                  id={`${uid}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={r.disabled || undefined}
                  onMouseEnter={() => !r.disabled && setActive(i)}
                  onClick={() => choose(r)}
                  className={cls(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                    i === active && "bg-brand-soft",
                    isSel ? "font-bold text-brand" : "text-ink",
                    r.disabled && "cursor-not-allowed opacity-40",
                    r.value === null && "text-muted",
                  )}
                >
                  {r.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />}
                  {r.icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{r.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.label}</span>
                    {r.description && <span className="block truncate text-[11px] font-medium text-muted">{r.description}</span>}
                  </span>
                  {isSel && <Check size={15} className="shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
