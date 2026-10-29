// Leitura de extratos bancários: OFX (padrão dos bancos brasileiros) e CSV.
import { toCents } from "./format";

export interface ImportedRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // centavos, negativo = saída
  fitid?: string;
}

/** OFX 1.x (SGML) e 2.x (XML) — Itaú, Bradesco, BB, Caixa, Nubank, Inter, Santander... */
export function parseOFX(text: string): ImportedRow[] {
  const rows: ImportedRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const dt = tag(block, "DTPOSTED");
    const amt = tag(block, "TRNAMT");
    if (!dt || !amt) continue;
    const memo = tag(block, "MEMO");
    const name = tag(block, "NAME");
    rows.push({
      date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`,
      description: decodeEntities(memo || name || "Sem descrição"),
      amount: toCents(amt.includes(",") ? amt : Number(amt)),
      fitid: tag(block, "FITID") || undefined,
    });
  }
  return rows;
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// ---------- CSV ----------

export function detectSeparator(firstLine: string): string {
  const counts = [";", ",", "\t", "|"].map((s) => [s, firstLine.split(s).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCSVText(text: string, sep?: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const separator = sep ?? detectSeparator(clean.split(/\r?\n/)[0] ?? "");
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) out.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) out.push(row);
  return out;
}

/** "31/12/2025", "2025-12-31", "31-12-25" -> ISO */
export function parseDateBR(s: string): string | null {
  const v = s.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export interface CsvMapping {
  date: number;
  description: number;
  amount: number;
  /** quando o banco separa entrada/saída em duas colunas */
  credit?: number;
  hasHeader: boolean;
  invertSign: boolean; // faturas de cartão costumam vir com compras positivas
}

/** Tenta adivinhar as colunas pelo cabeçalho. */
export function guessMapping(header: string[]): CsvMapping {
  const find = (re: RegExp) => header.findIndex((h) => re.test(h.toLowerCase()));
  const date = find(/data|date/);
  const description = find(/descri|hist[oó]rico|lan[cç]amento|memo|title|estabelecimento/);
  const amount = find(/valor|amount|quantia|d[eé]bito/);
  const credit = find(/cr[eé]dito/);
  const looksHeader = date >= 0 || description >= 0 || amount >= 0;
  return {
    date: date >= 0 ? date : 0,
    description: description >= 0 ? description : 1,
    amount: amount >= 0 ? amount : 2,
    credit: credit >= 0 && credit !== amount ? credit : undefined,
    hasHeader: looksHeader,
    invertSign: false,
  };
}

export function applyMapping(table: string[][], map: CsvMapping): ImportedRow[] {
  const body = map.hasHeader ? table.slice(1) : table;
  const out: ImportedRow[] = [];
  for (const r of body) {
    const date = parseDateBR(r[map.date] ?? "");
    if (!date) continue;
    let amount = toCents(r[map.amount] ?? "");
    if (map.credit !== undefined && r[map.credit]) {
      const credit = toCents(r[map.credit]);
      amount = credit ? Math.abs(credit) : -Math.abs(amount);
    }
    if (map.invertSign) amount = -amount;
    if (!amount) continue;
    out.push({ date, description: (r[map.description] ?? "").trim() || "Sem descrição", amount });
  }
  return out;
}

/** Chave para evitar importar a mesma transação duas vezes. */
export function importKey(accountId: number, r: ImportedRow) {
  if (r.fitid) return `ofx:${accountId}:${r.fitid}`;
  const base = `${r.date}|${r.amount}|${r.description.toLowerCase().replace(/\s+/g, " ")}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `csv:${accountId}:${h >>> 0}`;
}

/** Sugere categoria por palavras-chave comuns no Brasil. */
const RULES: [RegExp, string][] = [
  [/ifood|rappi|restaurante|lanchonete|padaria|burger|pizza/i, "Alimentação fora"],
  [/mercado|supermerc|atacad|assai|carrefour|hortifruti/i, "Mercado"],
  [/uber|99app|99 pop|onibus|metr[oô]|passagem|estacionamento|sem parar|pedagio/i, "Transporte"],
  [/posto|combust|shell|ipiranga|petrobras|br mania/i, "Combustível"],
  [/farm[aá]cia|drogaria|droga|hospital|cl[ií]nica|laborat|unimed|hapvida/i, "Saúde"],
  [/netflix|spotify|prime video|disney|hbo|max\b|youtube|deezer|globoplay|apple\.com/i, "Assinaturas"],
  [/energia|enel|cemig|copel|light|celesc|equatorial|energisa|sabesp|saneago|agua|g[aá]s/i, "Energia / Água / Gás"],
  [/vivo|claro|tim\b|oi\b|internet|telecom/i, "Internet / Telefone"],
  [/aluguel|condom[ií]nio/i, "Moradia"],
  [/escola|faculdade|curso|udemy|alura/i, "Educação"],
  [/iof|tarifa|anuidade|juros|imposto|darf|iptu|ipva/i, "Impostos e taxas"],
  [/sal[aá]rio|folha|pagto sal/i, "Salário"],
  [/rendimento|dividendo|jcp/i, "Rendimentos"],
  [/pet|ra[cç][aã]o|veterin/i, "Pets"],
];

export function suggestCategory(description: string, kind: "receita" | "despesa", categories: { id: number; name: string; kind: string }[]) {
  for (const [re, name] of RULES) {
    if (re.test(description)) {
      const c = categories.find((x) => x.name === name && x.kind === kind);
      if (c) return c.id;
    }
  }
  return null;
}
