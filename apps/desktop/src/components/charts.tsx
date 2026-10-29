// Gráficos. Cores vêm dos tokens --chart-* (azul = entradas, laranja = saídas),
// validadas para daltonismo; sempre com legenda, tooltip e rótulos em texto.
import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp } from "../lib/app-context";
import { brl, monthLabel, pct } from "../lib/format";
import type { CategoryTotal, MonthPoint } from "../lib/repo";
import { Dot } from "./ui";

function useChartTheme() {
  const { prefs } = useApp();
  const read = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return { inc: v("--chart-in"), out: v("--chart-out"), grid: v("--chart-grid"), muted: v("--muted"), ink: v("--ink"), surface: v("--surface"), line: v("--line"), brand: v("--brand") };
  };
  const [t, setT] = useState(read);
  useEffect(() => {
    const id = requestAnimationFrame(() => setT(read()));
    return () => cancelAnimationFrame(id);
  }, [prefs.theme]);
  return t;
}

const compact = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

function TooltipBox({ active, payload, label, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-bold">{labelFmt ? labelFmt(label) : label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <Dot color={p.color} />
          <span className="text-muted">{p.name}</span>
          <span className="money num ml-auto pl-4 font-bold">{brl(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function IncomeExpenseChart({ data, height = 260 }: { data: MonthPoint[]; height?: number }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compact} tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<TooltipBox labelFmt={(m: string) => monthLabel(m, true)} />} cursor={{ fill: t.grid, opacity: 0.5 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.ink }} />
        <Bar dataKey="receitas" name="Receitas" fill={t.inc} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="despesas" name="Despesas" fill={t.out} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BalanceLine({ data, height = 220 }: { data: MonthPoint[]; height?: number }) {
  const t = useChartTheme();
  let acc = 0;
  const rows = data.map((p) => ({ month: p.month, acumulado: (acc += p.saldo) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compact} tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
        <ReferenceLine y={0} stroke={t.muted} strokeDasharray="3 3" />
        <Tooltip content={<TooltipBox labelFmt={(m: string) => monthLabel(m, true)} />} cursor={{ stroke: t.muted }} />
        <Line type="monotone" dataKey="acumulado" name="Saldo acumulado" stroke={t.brand} strokeWidth={2} dot={{ r: 4, fill: t.brand, stroke: t.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GoalProjectionChart({ points, target, height = 180 }: { points: { m: number; value: number }[]; target: number; height?: number }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="m" tickFormatter={(m) => (m >= 12 ? `${(m / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}a` : `${m}m`)} tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compact} tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
        <ReferenceLine y={target} stroke={t.out} strokeDasharray="4 4" label={{ value: "Meta", fill: t.muted, fontSize: 11, position: "insideTopLeft" }} />
        <Tooltip content={<TooltipBox labelFmt={(m: number) => `Mês ${m}`} />} />
        <Line type="monotone" dataKey="value" name="Projeção" stroke={t.brand} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Lista com barras (sempre rotulada) — melhor que pizza para muitas categorias. */
export function CategoryBreakdown({ rows, limit = 8 }: { rows: CategoryTotal[]; limit?: number }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const top = rows.slice(0, limit);
  const rest = rows.slice(limit);
  const items = rest.length
    ? [...top, { id: -1, name: `Outras (${rest.length})`, color: "#94a3b8", total: rest.reduce((s, r) => s + r.total, 0), count: 0 }]
    : top;
  const max = Math.max(1, ...items.map((r) => r.total));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">Sem lançamentos no período.</p>;
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id ?? r.name}>
          <div className="mb-1 flex items-center gap-2 text-sm">
            <Dot color={r.color} />
            <span className="truncate font-semibold">{r.name}</span>
            <span className="ml-auto text-xs text-muted">{pct((r.total / (total || 1)) * 100, 1)}</span>
            <span className="money num w-28 text-right font-bold">{brl(r.total)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
