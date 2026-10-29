import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FileUp, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Field, Money, PageHeader, Table } from "../components/ui";
import { Combobox } from "../components/Combobox";
import { useApp, useData } from "../lib/app-context";
import { batch, notifyDataChanged, query, type Stmt } from "../lib/db";
import { dateBR } from "../lib/format";
import { applyMapping, guessMapping, importKey, parseCSVText, parseOFX, suggestCategory, type CsvMapping, type ImportedRow } from "../lib/importers";
import { listAccounts, listCategories } from "../lib/repo";

interface Row extends ImportedRow { key: string; include: boolean; dup: boolean; categoryId: number | null }

export function Import() {
  const { toast } = useApp();
  const { data: accounts = [] } = useData(() => listAccounts(), []);
  const { data: categories = [] } = useData(() => listCategories(), []);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const account = accounts.find((a) => a.id === accountId);

  async function prepare(parsed: ImportedRow[], accId: number) {
    const keys = parsed.map((r) => importKey(accId, r));
    const existing = new Set<string>();
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500);
      const found = await query<{ ref_key: string }>(`SELECT ref_key FROM transactions WHERE ref_key IN (${chunk.map(() => "?").join(",")})`, chunk);
      found.forEach((f) => existing.add(f.ref_key));
    }
    setRows(parsed.map((r, i) => {
      const kind = r.amount >= 0 ? "receita" : "despesa";
      return { ...r, key: keys[i], dup: existing.has(keys[i]), include: !existing.has(keys[i]), categoryId: suggestCategory(r.description, kind, categories) };
    }));
  }

  async function pickFile() {
    if (!accountId) return toast("Escolha primeiro a conta do extrato", "erro");
    const path = await open({ multiple: false, filters: [{ name: "Extrato", extensions: ["ofx", "csv", "txt"] }] });
    if (!path || Array.isArray(path)) return;
    const text = await invoke<string>("read_text_file", { path });
    setFileName(path.split(/[\\/]/).pop() ?? path);
    if (/<OFX>|OFXHEADER/i.test(text)) {
      setTable(null); setMapping(null);
      await prepare(parseOFX(text), accountId);
    } else {
      const t = parseCSVText(text);
      const m = guessMapping(t[0] ?? []);
      setTable(t); setMapping(m);
      await prepare(applyMapping(t, m), accountId);
    }
  }

  async function remap(m: CsvMapping) {
    setMapping(m);
    if (table && accountId) await prepare(applyMapping(table, m), accountId);
  }

  const selected = rows.filter((r) => r.include);
  const totals = useMemo(() => ({
    in: selected.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
    out: selected.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0),
  }), [selected]);

  async function doImport() {
    if (!accountId || !selected.length) return;
    setBusy(true);
    try {
      const stmts: Stmt[] = selected.map((r) => ({
        sql: `INSERT OR IGNORE INTO transactions (kind, description, amount, date, status, category_id, account_id, scope, ref_key, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pessoal', ?, ?)`,
        params: [
          r.amount >= 0 ? "receita" : "despesa", r.description, Math.abs(r.amount), r.date,
          account?.type === "cartao_credito" ? "pendente" : "pago", r.categoryId, accountId, r.key, `Importado de ${fileName}`,
        ],
      }));
      await batch(stmts);
      toast(`${selected.length} lançamento(s) importado(s)`);
      setRows([]); setTable(null); setFileName("");
      notifyDataChanged();
    } catch (e) {
      toast(String(e), "erro");
    } finally {
      setBusy(false);
    }
  }

  const header = table?.[0] ?? [];
  const colSelect = (label: string, k: "date" | "description" | "amount" | "credit", optional = false) => (
    <Field label={label}>
      <Combobox
        value={mapping?.[k] ?? null}
        onChange={(v) => remap({ ...mapping!, [k]: v ?? undefined })}
        nullLabel={optional ? "— nenhuma —" : undefined}
        placeholder="Selecione a coluna"
        options={header.map((h, i) => ({ value: i, label: mapping?.hasHeader ? h || `Coluna ${i + 1}` : `Coluna ${i + 1} (${h})` }))}
      />
    </Field>
  );

  return (
    <>
      <PageHeader title="Importar extrato" subtitle="Arquivos OFX ou CSV exportados do internet banking">
        {rows.length > 0 && <Button variant="primary" onClick={doImport} disabled={busy || !selected.length}>Importar {selected.length} lançamento(s)</Button>}
      </PageHeader>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Conta / cartão do extrato" className="w-72">
            <Combobox
              value={accountId}
              onChange={(v) => { setAccountId(v); setRows([]); }}
              placeholder="Selecione..."
              options={accounts.map((a) => ({ value: a.id, label: a.name, description: a.type === "cartao_credito" ? "Cartão de crédito" : a.bank ?? undefined, color: a.color }))}
            />
          </Field>
          <Button onClick={pickFile}><FileUp size={16} /> Escolher arquivo</Button>
          {fileName && <span className="text-sm text-muted">{fileName}</span>}
        </div>
        <p className="mt-4 flex gap-2 text-xs text-muted">
          <Info size={14} className="shrink-0" />
          Prefira OFX (Itaú, Bradesco, BB, Caixa, Santander, Inter, Nubank...). Lançamentos já importados são detectados e ignorados automaticamente. As categorias são sugeridas pelo nome — revise antes de importar.
        </p>
      </Card>

      {mapping && (
        <Card title="Colunas do CSV" className="mb-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {colSelect("Data", "date")}
            {colSelect("Descrição", "description")}
            {colSelect("Valor (ou débito)", "amount")}
            {colSelect("Crédito (se separado)", "credit", true)}
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={mapping.hasHeader} onChange={(e) => remap({ ...mapping, hasHeader: e.target.checked })} /> 1ª linha é cabeçalho</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={mapping.invertSign} onChange={(e) => remap({ ...mapping, invertSign: e.target.checked })} /> Inverter sinal (fatura)</label>
            </div>
          </div>
        </Card>
      )}

      {rows.length > 0 ? (
        <Card pad={false} title={<span>Prévia · {rows.length} linhas · entradas <Money cents={totals.in} className="text-pos" /> · saídas <Money cents={totals.out} className="text-neg" /></span>}
          action={<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setRows(rows.map((r) => ({ ...r, include: !r.dup })))}>Marcar novos</Button><Button size="sm" variant="ghost" onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}>Desmarcar</Button></div>}>
          <Table>
            <thead><tr><th /><th>Data</th><th>Descrição</th><th>Categoria</th><th className="!text-right">Valor</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key + i} className={r.dup ? "opacity-50" : ""}>
                  <td className="w-8"><input type="checkbox" checked={r.include} aria-label="Importar linha" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} /></td>
                  <td className="num whitespace-nowrap text-muted">{dateBR(r.date)}</td>
                  <td>{r.description} {r.dup && <Badge>já importado</Badge>}</td>
                  <td className="w-56">
                    <Combobox
                      size="sm"
                      aria-label="Categoria"
                      value={r.categoryId}
                      onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, categoryId: v } : x)))}
                      nullLabel="Sem categoria"
                      options={categories.filter((c) => c.kind === (r.amount >= 0 ? "receita" : "despesa")).map((c) => ({ value: c.id, label: c.name, color: c.color }))}
                    />
                  </td>
                  <td className="text-right font-bold"><Money cents={Math.abs(r.amount)} signed={r.amount >= 0 ? "receita" : "despesa"} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Card><Empty icon={<FileUp />} title="Nenhum arquivo carregado" text="Escolha a conta e o arquivo do extrato para ver a prévia." /></Card>
      )}
    </>
  );
}
