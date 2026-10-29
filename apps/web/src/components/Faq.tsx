import { useId, useState } from "react";
import { REPO_URL } from "../lib/config";

const faqs = [
  ["É gratuito mesmo? Qual é a pegadinha?", "Não tem. O Martins Finança é gratuito e de código aberto (licença MIT), mantido pela Agência Martins. Não há anúncios nem venda de dados — até porque seus dados nunca saem do seu computador."],
  ["Funciona no celular?", "Esta primeira versão é para computador (Windows, macOS e Linux). Uma versão para celular está nos planos."],
  ["Como uso em dois computadores?", "No computador principal, ative “Compartilhar” em Configurações → Rede local. Nos outros, escolha “Conectar” e digite o endereço e o código exibidos. Todos no mesmo Wi-Fi."],
  ["Meu banco é suportado?", "Qualquer banco que exporte extrato em OFX ou CSV — praticamente todos os grandes bancos e bancos digitais do Brasil."],
  ["Meus dados ficam seguros?", "Tudo é gravado num arquivo no seu computador, sem conta online e sem enviar nada para a internet. Faça backup com um clique em Configurações → Dados e backup."],
  ["Encontrei um problema / tenho uma ideia", "Abra uma issue no GitHub. Contribuições são muito bem-vindas."],
];

export function Faq() {
  const uid = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="pb-14 md:pb-[88px]">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 md:grid-cols-[1fr_1.7fr] md:gap-14">
        <div>
          <h2 className="mb-3 text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-tight">Perguntas frequentes</h2>
          <p className="mb-6 max-w-[40ch] text-muted">Respostas rápidas para as dúvidas mais comuns antes de baixar.</p>
          <div className="rounded-[18px] border border-line bg-surface p-5">
            <p className="font-bold">Ainda tem dúvidas?</p>
            <p className="mt-1 text-[15px] text-muted">Abra uma issue no GitHub — a gente responde por lá.</p>
            <a
              href={`${REPO_URL}/issues`}
              className="mt-4 inline-flex h-10 items-center rounded-xl border border-line bg-bg px-4 text-sm font-bold transition hover:-translate-y-px hover:border-brand/50"
            >
              Abrir uma issue
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i;
            const btn = `${uid}-b${i}`;
            const panel = `${uid}-p${i}`;
            return (
              <div
                key={q}
                className={`overflow-hidden rounded-[18px] border bg-surface transition-all duration-200 ${isOpen ? "border-brand/40 shadow-[0_8px_24px_-14px_rgba(47,128,217,.45)]" : "border-line hover:border-brand/30"}`}
              >
                <h3>
                  <button
                    id={btn}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panel}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-bg/60 focus-visible:bg-brand-soft"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold transition-colors ${isOpen ? "bg-brand text-brand-ink" : "bg-brand-soft text-brand"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={`flex-1 text-[15px] font-bold ${isOpen ? "text-brand" : ""}`}>{q}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-brand" : "text-muted"}`}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </h3>
                <div
                  id={panel}
                  role="region"
                  aria-labelledby={btn}
                  className={`grid transition-[grid-template-rows,visibility] duration-200 ease-out ${isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="mx-5 border-t border-line pb-5 pl-[52px] pt-4 text-[15px] leading-relaxed text-muted">{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
