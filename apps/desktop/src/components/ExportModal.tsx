import { FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../lib/app-context";
import { saveReport } from "../lib/export";
import { addMonths } from "../lib/format";
import { buildReport, REPORT_KINDS, type ReportKind } from "../lib/reports";
import { Combobox } from "./Combobox";
import { MonthInput } from "./MonthInput";
import { Button, Field, Modal } from "./ui";

export function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { month, toast } = useApp();
  const [kind, setKind] = useState<ReportKind>("mensal");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [from, setFrom] = useState(month);
  const [to, setTo] = useState(month);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFrom(kind === "periodo" ? addMonths(month, -11) : month);
      setTo(month);
    }
  }, [open, month, kind]);

  async function run() {
    setBusy(true);
    try {
      const doc = await buildReport(kind, from, to < from ? from : to);
      const path = await saveReport(doc, format, `martins-financa-${kind}-${from}${to !== from ? `_${to}` : ""}`);
      if (path) {
        toast(`Arquivo salvo em ${path}`);
        onClose();
      }
    } catch (e) {
      toast(String(e), "erro");
    } finally {
      setBusy(false);
    }
  }

  const Opt = ({ v, icon, label, hint }: { v: "pdf" | "csv"; icon: React.ReactNode; label: string; hint: string }) => (
    <button
      onClick={() => setFormat(v)}
      className={`flex flex-1 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${format === v ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2"}`}
    >
      <span className="text-brand">{icon}</span>
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar dados"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={run} disabled={busy}>{busy ? "Gerando..." : `Exportar ${format.toUpperCase()}`}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <Opt v="pdf" icon={<FileText />} label="PDF" hint="Para imprimir ou enviar" />
          <Opt v="csv" icon={<FileSpreadsheet />} label="CSV" hint="Abre no Excel / Planilhas" />
        </div>
        <Field label="O que exportar">
          <Combobox value={kind as string} onChange={(v) => v && setKind(v as ReportKind)} searchable={false} options={Object.entries(REPORT_KINDS).map(([k, v]) => ({ value: k, label: v }))} />
        </Field>
        <div className="grid gap-3">
          <Field label="De (mês)"><MonthInput value={from} onChange={setFrom} /></Field>
          <Field label="Até (mês)"><MonthInput value={to} onChange={setTo} /></Field>
        </div>
      </div>
    </Modal>
  );
}
