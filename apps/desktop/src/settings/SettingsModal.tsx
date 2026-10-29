import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Accessibility, Bell, CircleHelp, Code2, Database, Github, Globe, Info, Linkedin, Mail, MessageCircle, Monitor, Palette, Plus, Server, Settings, Tags, Trash2, Wifi, Youtube,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Combobox } from "../components/Combobox";
import { ThemeSelect } from "../components/ThemeSelect";
import { Badge, Button, Card, Dot, Field, IconButton, Input, Modal, Segmented, confirmDialog } from "../components/ui";
import { useApp, useData, type LanStatus } from "../lib/app-context";
import { execute, notifyDataChanged } from "../lib/db";
import { cls, today } from "../lib/format";
import { listCategories } from "../lib/repo";
import { DEVELOPER, REPO_URL } from "../lib/constants";

const SECTIONS = [
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "acessibilidade", label: "Fonte e acessibilidade", icon: Accessibility },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "rede", label: "Rede local", icon: Wifi },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "dados", label: "Dados e backup", icon: Database },
  { id: "ajuda", label: "Ajuda", icon: CircleHelp },
  { id: "sobre", label: "Sobre", icon: Info },
];

export function SettingsModal() {
  const { settings, openSettings, closeSettings } = useApp();
  const section = settings.section;

  return (
    <Modal
      open={settings.open}
      onClose={closeSettings}
      title="Configurações"
      description="Aparência, notificações, rede local, categorias e dados"
      icon={<Settings size={18} />}
      size="large"
      flush
    >
      <nav className="w-56 shrink-0 space-y-0.5 overflow-y-auto border-r border-line bg-surface-2/40 p-2.5" aria-label="Seções de configuração">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => openSettings(id)}
            aria-current={section === id ? "page" : undefined}
            className={cls(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40",
              section === id ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </nav>
      <div key={section} className="mf-anim-fade min-w-0 flex-1 overflow-y-auto p-6">
        {section === "aparencia" && <Appearance />}
        {section === "acessibilidade" && <A11y />}
        {section === "notificacoes" && <Notifications />}
        {section === "rede" && <Network />}
        {section === "categorias" && <Categories />}
        {section === "dados" && <Data />}
        {section === "ajuda" && <HelpSection />}
        {section === "sobre" && <About />}
      </div>
    </Modal>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
      <span><span className="block text-sm font-bold">{label}</span>{desc && <span className="block text-xs text-muted">{desc}</span>}</span>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cls("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}>
        <span className={cls("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

function Appearance() {
  const { prefs, setPrefs } = useApp();
  return (
    <Section title="Aparência" desc="Escolha o tema da aplicação.">
      <Card>
        <Field label="Tema">
          <ThemeSelect />
        </Field>
      </Card>
      <Toggle label="Modo privacidade" desc="Borra todos os valores — útil para mostrar a tela para outras pessoas." checked={prefs.privacy} onChange={(v) => setPrefs({ privacy: v })} />
    </Section>
  );
}

function A11y() {
  const { prefs, setPrefs } = useApp();
  const sizes = [90, 100, 112, 125, 140];
  return (
    <Section title="Fonte e acessibilidade" desc="Aumente o texto de toda a aplicação.">
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Tamanho da fonte</span>
          <span className="text-sm text-muted">{prefs.fontScale}%</span>
        </div>
        <div className="mt-4 flex gap-2">
          {sizes.map((s) => (
            <button key={s} onClick={() => setPrefs({ fontScale: s })} className={cls("flex-1 rounded-lg border py-3 font-bold", prefs.fontScale === s ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-surface-2")} style={{ fontSize: `${s * 0.14}px` }}>
              Aa
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Pré-visualização: Saldo previsto do mês <b className="text-ink">R$ 1.234,56</b></p>
      </Card>
    </Section>
  );
}

function Notifications() {
  const { prefs, setPrefs } = useApp();
  return (
    <Section title="Notificações" desc="Avisos de contas vencidas e próximas do vencimento.">
      <Toggle label="Notificação do sistema" desc="Uma vez por dia, ao abrir o app, avisa contas vencidas ou que vencem hoje/amanhã." checked={prefs.notifyOS} onChange={(v) => setPrefs({ notifyOS: v })} />
      <Card>
        <Field label="Mostrar no sino os vencimentos dos próximos">
          <Combobox
            value={prefs.alertDays}
            onChange={(v) => v != null && setPrefs({ alertDays: v })}
            options={[3, 5, 7, 10, 15, 30].map((d) => ({ value: d, label: `${d} dias` }))}
          />
        </Field>
      </Card>
    </Section>
  );
}

function Network() {
  const { lan, refreshLan, toast } = useApp();
  const [mode, setMode] = useState<"server" | "client">(lan?.mode === "client" ? "client" : "server");
  const [port, setPort] = useState(lan?.port ?? 47820);
  const [host, setHost] = useState("");
  const [cPort, setCPort] = useState(47820);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await refreshLan();
      await emit("mf:lan-changed");
      toast(ok);
    } catch (e) {
      toast(String(e), "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Rede local" desc="Use o mesmo banco de dados em vários computadores da casa, conectados ao mesmo Wi-Fi.">
      <Card>
        <div className="flex items-center gap-3">
          {lan?.mode === "server" ? <Server className="text-brand" /> : lan?.mode === "client" ? <Wifi className="text-brand" /> : <Monitor className="text-muted" />}
          <div className="flex-1">
            <div className="text-sm font-bold">
              {lan?.mode === "server" ? "Este computador está compartilhando os dados" : lan?.mode === "client" ? `Conectado ao servidor ${lan.remote_host}` : "Usando apenas o banco deste computador"}
            </div>
            <div className="text-xs text-muted">IP deste computador: {lan?.ip ?? "—"}</div>
          </div>
          <Badge tone={lan?.mode === "local" ? "muted" : "pos"}>{lan?.mode === "server" ? "Servidor" : lan?.mode === "client" ? "Cliente" : "Local"}</Badge>
        </div>
        {lan?.mode === "server" && (
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-brand-soft p-4 text-center">
            <div><div className="text-xs text-muted">Endereço</div><div className="selectable font-mono text-lg font-bold">{lan.ip}</div></div>
            <div><div className="text-xs text-muted">Porta</div><div className="selectable font-mono text-lg font-bold">{lan.port}</div></div>
            <div><div className="text-xs text-muted">Código de acesso</div><div className="selectable font-mono text-lg font-bold tracking-widest">{lan.token}</div></div>
          </div>
        )}
      </Card>

      {lan?.mode === "local" && (
        <Segmented value={mode} onChange={setMode} options={[{ value: "server", label: "Compartilhar este computador" }, { value: "client", label: "Conectar a outro computador" }]} />
      )}

      {lan?.mode === "local" && mode === "server" && (
        <Card>
          <p className="mb-4 text-sm text-muted">Este computador vira o “principal”: guarda o banco de dados e os outros se conectam a ele. Ele precisa estar ligado e com o app aberto. Se o firewall perguntar, permita o acesso na rede privada.</p>
          <div className="flex items-end gap-3">
            <Field label="Porta" className="w-32"><Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} /></Field>
            <Button variant="primary" disabled={busy} onClick={() => run(() => invoke("lan_server_start", { port }), "Compartilhamento ativado")}><Server size={16} /> Ativar compartilhamento</Button>
          </div>
        </Card>
      )}

      {lan?.mode === "local" && mode === "client" && (
        <Card>
          <p className="mb-4 text-sm text-muted">Digite os dados exibidos no computador principal (Configurações → Rede local). Enquanto conectado, tudo que você lançar vai direto para o banco dele.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Endereço (IP)"><Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.10" /></Field>
            <Field label="Porta"><Input type="number" value={cPort} onChange={(e) => setCPort(Number(e.target.value))} /></Field>
            <Field label="Código de acesso"><Input value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} placeholder="ABCD1234" className="font-mono tracking-widest" /></Field>
          </div>
          <Button className="mt-4" variant="primary" disabled={busy || !host || !token} onClick={() => run(() => invoke("lan_client_connect", { host, port: cPort, token }), "Conectado ao servidor")}><Wifi size={16} /> Conectar</Button>
        </Card>
      )}

      {lan?.mode === "server" && (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={async () => { if (await confirmDialog("Gerar um novo código? Os outros computadores precisarão se conectar de novo.")) run(() => invoke("lan_server_start", { port: lan.port, newToken: true }), "Novo código gerado"); }}>Gerar novo código</Button>
          <Button variant="danger" disabled={busy} onClick={() => run(() => invoke("lan_server_stop"), "Compartilhamento desativado")}>Parar compartilhamento</Button>
        </div>
      )}
      {lan?.mode === "client" && (
        <Button variant="danger" disabled={busy} onClick={() => run(() => invoke("lan_client_disconnect"), "Voltou a usar o banco local")}>Desconectar e usar banco local</Button>
      )}
      <p className="text-xs text-muted">Por segurança, o banco SQLite nunca é aberto por pasta compartilhada (isso corrompe o arquivo). Um computador é o dono do arquivo e os outros acessam por ele, protegidos pelo código de acesso. Use somente em redes de confiança (casa).</p>
    </Section>
  );
}

function Categories() {
  const { toast } = useApp();
  const { data: cats = [] } = useData(() => listCategories(), []);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"despesa" | "receita">("despesa");
  const [color, setColor] = useState("#64748b");

  async function add() {
    if (!name.trim()) return;
    await execute("INSERT INTO categories (name, kind, color) VALUES (?,?,?)", [name.trim(), kind, color]);
    setName("");
    toast("Categoria criada");
    notifyDataChanged();
  }

  return (
    <Section title="Categorias" desc="Organize receitas e despesas do seu jeito. Categorias arquivadas somem dos formulários, mas o histórico é mantido.">
      <Card>
        <div className="flex items-end gap-2">
          <Field label="Nova categoria" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></Field>
          <Combobox className="w-36" value={kind} onChange={(v) => v && setKind(v)} aria-label="Tipo" options={[{ value: "despesa", label: "Despesa" }, { value: "receita", label: "Receita" }]} />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded-lg border border-line bg-surface" aria-label="Cor" />
          <Button variant="primary" onClick={add}><Plus size={16} /></Button>
        </div>
      </Card>
      {(["despesa", "receita"] as const).map((k) => (
        <Card key={k} title={k === "despesa" ? "Despesas" : "Receitas"} pad={false}>
          <ul>
            {cats.filter((c) => c.kind === k).map((c) => (
              <li key={c.id} className="group flex items-center gap-3 border-t border-line px-5 py-2 first:border-t-0">
                <input type="color" value={c.color} aria-label={`Cor de ${c.name}`} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  onChange={async (e) => { await execute("UPDATE categories SET color = ? WHERE id = ?", [e.target.value, c.id]); notifyDataChanged(); }} />
                <input defaultValue={c.name} className="flex-1 rounded bg-transparent px-1 text-sm font-semibold outline-none focus:bg-surface-2"
                  onBlur={async (e) => { if (e.target.value.trim() && e.target.value !== c.name) { await execute("UPDATE categories SET name = ? WHERE id = ?", [e.target.value.trim(), c.id]); notifyDataChanged(); } }} />
                <IconButton label="Arquivar" className="opacity-0 group-hover:opacity-100" onClick={async () => { if (await confirmDialog(`Arquivar "${c.name}"?`)) { await execute("UPDATE categories SET archived = 1 WHERE id = ?", [c.id]); notifyDataChanged(); } }}><Trash2 size={14} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <p className="flex items-center gap-2 text-xs text-muted"><Dot color="#64748b" /> Clique no nome para renomear e na bolinha para trocar a cor.</p>
    </Section>
  );
}

function Data() {
  const { lan, toast } = useApp();
  async function backup() {
    const path = await saveDialog({ defaultPath: `martins-financa-backup-${today()}.db`, filters: [{ name: "Backup", extensions: ["db"] }] });
    if (!path) return;
    try { await invoke("db_backup", { path }); toast("Backup salvo"); } catch (e) { toast(String(e), "erro"); }
  }
  async function restore() {
    const path = await open({ multiple: false, filters: [{ name: "Backup", extensions: ["db"] }] });
    if (!path || Array.isArray(path)) return;
    if (!(await confirmDialog("Restaurar este backup vai SUBSTITUIR todos os dados atuais. Recomendamos fazer um backup antes. Continuar?"))) return;
    try { await invoke("db_restore", { path }); notifyDataChanged(); toast("Backup restaurado"); } catch (e) { toast(String(e), "erro"); }
  }
  return (
    <Section title="Dados e backup" desc="Seus dados ficam somente neste computador. Faça cópias de segurança com frequência (pen drive, nuvem pessoal).">
      <Card>
        <div className="text-xs text-muted">Arquivo do banco de dados</div>
        <div className="selectable mt-1 break-all font-mono text-xs">{lan?.db_path ?? "—"}</div>
      </Card>
      <div className="flex gap-2">
        <Button variant="primary" onClick={backup} disabled={lan?.mode === "client"}><Database size={16} /> Fazer backup</Button>
        <Button onClick={restore} disabled={lan?.mode === "client"}>Restaurar backup</Button>
      </div>
      {lan?.mode === "client" && <p className="text-xs text-warn">Conectado a outro computador: faça o backup no computador principal.</p>}
    </Section>
  );
}

function HelpSection() {
  return (
    <Section title="Ajuda" desc="Precisa de ajuda ou encontrou um problema?">
      <Card>
        <ul className="space-y-2 text-sm">
          <li>• O botão <b>Ajuda</b> no menu lateral tem o passo a passo e perguntas frequentes, com busca.</li>
          <li>• Encontrou um erro ou tem uma ideia? Abra uma <i>issue</i> no GitHub.</li>
        </ul>
        <Button className="mt-4" onClick={() => openUrl(`${REPO_URL}/issues`).catch(() => window.open(`${REPO_URL}/issues`))}>Abrir issues no GitHub</Button>
      </Card>
    </Section>
  );
}

function ExternalLink({ href, icon, label, value }: { href: string; icon: ReactNode; label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => openUrl(href).catch(() => window.open(href))}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left outline-none transition-colors hover:border-brand/40 hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand group-hover:bg-surface">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className="block truncate text-sm font-bold">{value}</span>
      </span>
    </button>
  );
}

function About() {
  const { lan } = useApp();
  const initials = DEVELOPER.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <Section title="Sobre">
      <Card>
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="" className="h-14 w-14" />
          <div>
            <div className="text-lg font-extrabold">Martins Finança</div>
            <div className="text-sm text-muted">Versão {lan?.version ?? "0.1.0"} · Agência Martins</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Aplicativo gratuito e de código aberto para controle financeiro pessoal e familiar, feito para brasileiros.
          Sem anúncios, sem assinatura e sem enviar seus dados para a internet. Licença MIT.
        </p>
        <p className="mt-3 text-xs text-muted">Feito com Rust, Tauri, React, TypeScript, Tailwind CSS e SQLite.</p>
        <Button className="mt-4" onClick={() => openUrl(REPO_URL).catch(() => window.open(REPO_URL))}>Código-fonte no GitHub</Button>
      </Card>

      <Card title="Sobre o desenvolvedor">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-extrabold text-brand-ink" aria-hidden="true">{initials}</span>
          <div>
            <div className="text-lg font-extrabold">{DEVELOPER.name}</div>
            <div className="flex items-center gap-1.5 text-sm text-muted"><Code2 size={14} /> {DEVELOPER.role}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <ExternalLink href={`mailto:${DEVELOPER.email}`} icon={<Mail size={18} />} label="E-mail" value={DEVELOPER.email} />
          <ExternalLink href={DEVELOPER.whatsapp.url} icon={<MessageCircle size={18} />} label="WhatsApp" value={DEVELOPER.whatsapp.label} />
          <ExternalLink href={DEVELOPER.linkedin} icon={<Linkedin size={18} />} label="LinkedIn" value="silvanei-martins" />
          <ExternalLink href={DEVELOPER.github} icon={<Github size={18} />} label="GitHub" value="silvaneimartins" />
          <ExternalLink href={DEVELOPER.youtube} icon={<Youtube size={18} />} label="Canal no YouTube" value="@silvanei.martins" />
          <ExternalLink href={DEVELOPER.website} icon={<Globe size={18} />} label="Site pessoal" value="silvaneimartins.com.br" />
        </div>
      </Card>
    </Section>
  );
}

export type { LanStatus };
