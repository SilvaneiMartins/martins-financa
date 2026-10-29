import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../lib/app-context";
import { addMonths, currentMonth, monthLabel } from "../lib/format";

/** Navegação de mês global (todas as telas compartilham o mês selecionado). */
export function MonthNav() {
  const { month, setMonth } = useApp();
  const isCurrent = month === currentMonth();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      <button className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-36 text-center text-sm font-bold">{monthLabel(month, true)}</span>
      <button className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
        <ChevronRight size={16} />
      </button>
      {!isCurrent && (
        <button className="rounded-md px-2 text-xs font-semibold text-brand hover:underline" onClick={() => setMonth(currentMonth())}>
          Hoje
        </button>
      )}
    </div>
  );
}
