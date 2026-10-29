import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cls } from "../lib/format";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
  icon?: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  /** permite vários itens abertos ao mesmo tempo (padrão: um por vez) */
  multiple?: boolean;
  /** ids abertos no início */
  defaultOpen?: string[];
  /** mostra o número do item (01, 02...) quando não há ícone */
  numbered?: boolean;
  className?: string;
}

/**
 * Acordeão em cartões separados: cada item é um bloco independente, com espaço entre eles,
 * número/ícone, destaque do item aberto e animação de altura. Acessível por teclado (botão
 * com aria-expanded/aria-controls).
 */
export function Accordion({ items, multiple, defaultOpen = [], numbered = true, className }: AccordionProps) {
  const uid = useId();
  const [open, setOpen] = useState<string[]>(defaultOpen);

  const toggle = (id: string) =>
    setOpen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : multiple ? [...cur, id] : [id]));

  return (
    <div className={cls("flex flex-col gap-3", className)}>
      {items.map((item, i) => {
        const isOpen = open.includes(item.id);
        const btnId = `${uid}-btn-${item.id}`;
        const panelId = `${uid}-panel-${item.id}`;
        return (
          <section
            key={item.id}
            className={cls(
              "overflow-hidden rounded-2xl border bg-surface transition-all duration-200",
              isOpen ? "border-brand/40 shadow-[0_8px_24px_-14px_rgba(47,128,217,0.45)]" : "border-line hover:border-brand/30",
            )}
          >
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-surface-2/60 focus-visible:bg-brand-soft"
              >
                <span
                  aria-hidden="true"
                  className={cls(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold transition-colors",
                    isOpen ? "bg-brand text-brand-ink" : "bg-brand-soft text-brand",
                  )}
                >
                  {item.icon ?? (numbered ? String(i + 1).padStart(2, "0") : null)}
                </span>
                <span className={cls("flex-1 text-[15px] font-bold", isOpen && "text-brand")}>{item.title}</span>
                <ChevronDown size={18} aria-hidden="true" className={cls("shrink-0 text-muted transition-transform duration-200", isOpen && "rotate-180 text-brand")} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className={cls(
                "grid transition-[grid-template-rows,visibility] duration-200 ease-out",
                isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="mx-5 border-t border-line pb-5 pl-[52px] pt-4 text-sm leading-relaxed text-muted">{item.content}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
