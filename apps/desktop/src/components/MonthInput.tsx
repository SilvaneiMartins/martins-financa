import { Combobox } from "./Combobox";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Seletor de mês (YYYY-MM). Evita <input type="month">, que não funciona no macOS/Linux. */
export function MonthInput({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const [y, m] = value.split("-").map(Number);
  const now = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => now - 10 + i);
  const set = (yy: number, mm: number) => onChange(`${yy}-${String(mm).padStart(2, "0")}`);
  return (
    <div className="flex gap-2">
      <Combobox value={m} onChange={(v) => v && set(y, v)} aria-label="Mês" searchable={false} options={MONTH_NAMES.map((n, i) => ({ value: i + 1, label: n }))} />
      <Combobox value={y} onChange={(v) => v && set(v, m)} aria-label="Ano" searchable={false} className="w-28" options={years.map((yy) => ({ value: yy, label: String(yy) }))} />
    </div>
  );
}
