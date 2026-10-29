// Exportação para CSV (compatível com Excel BR) e PDF.
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { brl, dateBR, today } from "./format";

export interface Column<T> {
  header: string;
  value: (row: T) => string | number;
  money?: boolean;
  align?: "left" | "right";
}

export interface ReportSection<T = any> {
  title: string;
  columns: Column<T>[];
  rows: T[];
  totals?: (string | number)[];
}

export interface ReportDoc {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  sections: ReportSection[];
}

const csvCell = (v: string | number) => {
  const s = typeof v === "number" ? (v / 100).toFixed(2).replace(".", ",") : String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(doc: ReportDoc): string {
  const lines: string[] = [];
  lines.push(doc.title);
  if (doc.subtitle) lines.push(doc.subtitle);
  doc.summary?.forEach((s) => lines.push(`${s.label};${s.value}`));
  for (const sec of doc.sections) {
    lines.push("", sec.title);
    lines.push(sec.columns.map((c) => c.header).join(";"));
    for (const r of sec.rows) {
      lines.push(sec.columns.map((c) => {
        const v = c.value(r);
        return c.money && typeof v === "number" ? csvCell(v) : csvCell(String(v));
      }).join(";"));
    }
    if (sec.totals) lines.push(sec.totals.map((v) => (typeof v === "number" ? csvCell(v) : csvCell(v))).join(";"));
  }
  // BOM para o Excel reconhecer acentos
  return "﻿" + lines.join("\r\n");
}

export function toPDF(doc: ReportDoc): Uint8Array {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const brand: [number, number, number] = [15, 95, 85];
  const w = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(...brand);
  pdf.rect(0, 0, w, 64, "F");
  pdf.setTextColor(244, 239, 228);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Martins Finança", 40, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Gerado em ${dateBR(today())}`, w - 40, 30, { align: "right" });

  pdf.setTextColor(29, 36, 32);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(doc.title, 40, 92);
  let y = 108;
  if (doc.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(107, 113, 106);
    pdf.text(doc.subtitle, 40, y);
    y += 16;
  }

  if (doc.summary?.length) {
    autoTable(pdf, {
      startY: y,
      body: doc.summary.map((s) => [s.label, s.value]),
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { textColor: [107, 113, 106] }, 1: { fontStyle: "bold", halign: "right" } },
      tableWidth: 280,
    });
    y = (pdf as any).lastAutoTable.finalY + 16;
  }

  for (const sec of doc.sections) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(29, 36, 32);
    if (y > pdf.internal.pageSize.getHeight() - 80) { pdf.addPage(); y = 50; }
    pdf.text(sec.title, 40, y);
    autoTable(pdf, {
      startY: y + 6,
      head: [sec.columns.map((c) => c.header)],
      body: sec.rows.map((r) => sec.columns.map((c) => {
        const v = c.value(r);
        return c.money && typeof v === "number" ? brl(v) : String(v ?? "");
      })),
      foot: sec.totals ? [sec.totals.map((v) => (typeof v === "number" ? brl(v) : v))] : undefined,
      headStyles: { fillColor: brand, textColor: [244, 239, 228] },
      footStyles: { fillColor: [239, 234, 223], textColor: [29, 36, 32], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: Object.fromEntries(
        sec.columns.map((c, i) => [i, { halign: c.money || c.align === "right" ? "right" : "left" }]),
      ),
      showFoot: "lastPage",
      didParseCell: (data) => {
        const col = sec.columns[data.column.index];
        if (col && (col.money || col.align === "right")) data.cell.styles.halign = "right";
      },
    });
    y = (pdf as any).lastAutoTable.finalY + 24;
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`Martins Finança · Agência Martins · página ${i} de ${pages}`, w / 2, pdf.internal.pageSize.getHeight() - 20, { align: "center" });
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}

/** Abre "Salvar como" e grava o arquivo. Retorna o caminho ou null se cancelado. */
export async function saveReport(doc: ReportDoc, format: "pdf" | "csv", baseName: string): Promise<string | null> {
  const path = await save({
    defaultPath: `${baseName}.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  });
  if (!path) return null;
  if (format === "csv") await invoke("write_text_file", { path, contents: toCSV(doc) });
  else await invoke("write_binary_file", { path, contents: Array.from(toPDF(doc)) });
  return path;
}
