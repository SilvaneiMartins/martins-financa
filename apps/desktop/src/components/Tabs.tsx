import { useRef, type ReactNode } from "react";
import { cls } from "../lib/format";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  /** marca a aba com um ponto de alerta (ex.: campo obrigatório com erro) */
  invalid?: boolean;
  /** esconde a aba sem removê-la da lista de ids */
  hidden?: boolean;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** prefixo dos ids (liga cada aba ao seu painel); use o mesmo em <TabPanel> */
  idBase: string;
  className?: string;
  "aria-label"?: string;
}

/** Abas acessíveis (ARIA tablist): setas, Home e End navegam; só a aba ativa entra na ordem do Tab. */
export function Tabs<T extends string>({ tabs, value, onChange, idBase, className, ...aria }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const visible = tabs.filter((t) => !t.hidden);

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = visible.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % visible.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + visible.length) % visible.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = visible.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = visible[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div role="tablist" aria-label={aria["aria-label"]} onKeyDown={onKeyDown} className={cls("flex gap-1 border-b border-line", className)}>
      {visible.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cls(
              "relative -mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:bg-brand-soft",
              selected ? "border-brand text-brand" : "border-transparent text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
            {t.invalid && <span aria-label="Há campos com erro" className="h-2 w-2 rounded-full bg-neg" />}
          </button>
        );
      })}
    </div>
  );
}

/** Conteúdo de uma aba. Só renderiza a aba ativa; o estado do formulário fica no componente pai. */
export function TabPanel<T extends string>({ id, value, idBase, children, className }: { id: T; value: T; idBase: string; children: ReactNode; className?: string }) {
  if (id !== value) return null;
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} tabIndex={-1} className={cls("mf-anim-fade outline-none", className)}>
      {children}
    </div>
  );
}
