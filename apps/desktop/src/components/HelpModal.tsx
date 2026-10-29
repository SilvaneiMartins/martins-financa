import { CircleHelp, Github, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useApp } from "../lib/app-context";
import { REPO_URL } from "../lib/constants";
import { Accordion } from "./Accordion";
import { Button, Empty, Input, Modal } from "./ui";

const FAQ: { id: string; q: string; a: string }[] = [
  { id: "comecar", q: "Por onde começo?", a: "1) Cadastre suas contas e cartões. 2) Cadastre suas rendas (salário CLT, PJ...). 3) Cadastre as contas fixas e financiamentos em “Contas a pagar”. A partir daí o app gera os lançamentos de cada mês sozinho — você só confirma o pagamento." },
  { id: "cartao", q: "Como funciona o cartão de crédito?", a: "Ao lançar uma despesa no cartão, informe a data da compra. O app calcula em qual fatura ela cai (pelo dia de fechamento) e cria as parcelas nas faturas seguintes. Em “Contas e cartões” você paga a fatura inteira com um clique." },
  { id: "escopo", q: "Gasto pessoal × familiar", a: "Cada lançamento pode ser marcado como pessoal ou familiar e atribuído a um membro da família. Os filtros e relatórios separam esses valores." },
  { id: "importar", q: "Como importar o extrato do banco?", a: "No internet banking, exporte o extrato em OFX (preferível) ou CSV. Em “Importar extrato”, escolha a conta e o arquivo. Lançamentos repetidos são ignorados automaticamente." },
  { id: "rede", q: "Como usar em mais de um computador da casa?", a: "Em Configurações → Rede local, ative “Compartilhar” no computador principal. Nos outros, escolha “Conectar” e digite o endereço e o código de acesso exibidos. Todos precisam estar no mesmo Wi-Fi e o computador principal precisa estar ligado." },
  { id: "dados", q: "Meus dados ficam onde?", a: "Somente no seu computador, num arquivo SQLite. Nada é enviado para a internet. Faça backups periódicos em Configurações → Dados e backup." },
  { id: "atalhos", q: "Atalhos", a: "Ctrl/⌘ + Enter salva formulários. Esc fecha janelas. O ícone de olho no topo oculta os valores (modo privacidade)." },
];

/** minúsculas e sem acentos, para a busca */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpModal() {
  const { help, closeHelp } = useApp();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = norm(query.trim());
    return q ? FAQ.filter((f) => norm(`${f.q} ${f.a}`).includes(q)) : FAQ;
  }, [query]);

  function close() {
    closeHelp();
    setQuery("");
  }

  return (
    <Modal
      open={help}
      onClose={close}
      title="Ajuda"
      description="Perguntas frequentes e primeiros passos"
      icon={<CircleHelp size={18} />}
      size="large"
      footer={
        <>
          <Button className="mr-auto" onClick={() => openUrl(REPO_URL).catch(() => window.open(REPO_URL))}>
            <Github size={16} /> Projeto no GitHub
          </Button>
          <Button variant="primary" onClick={close}>Fechar</Button>
        </>
      }
    >
      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          autoFocus
          type="search"
          className="pl-9"
          placeholder="Buscar na ajuda (ex.: cartão, backup, importar)"
          aria-label="Buscar na ajuda"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results.length === 0 ? (
        <Empty icon={<SearchX size={28} />} title="Nada encontrado" text="Tente outras palavras ou abra uma issue no GitHub se a dúvida persistir." />
      ) : (
        <Accordion
          key={query.trim() ? `q:${results.map((r) => r.id).join()}` : "all"}
          multiple={!!query.trim()}
          defaultOpen={query.trim() ? results.map((r) => r.id) : [FAQ[0].id]}
          items={results.map((f) => ({ id: f.id, title: f.q, content: <p>{f.a}</p> }))}
        />
      )}
    </Modal>
  );
}
