import { REPO_URL } from "../lib/config";
import { detectOS, OS_LABEL, type Release } from "../lib/releases";
import { Icons } from "./Icons";
import painel from "../assets/painel.webp";

export function Hero({ release }: { release: Release }) {
  const os = detectOS();
  return (
    <header className="mx-auto max-w-[1120px] px-5 pb-10 pt-[72px] text-center">
      <span className="inline-block rounded-full bg-brand-soft px-3.5 py-1.5 text-[13px] font-bold text-brand">
        100% gratuito · código aberto · sem anúncios
      </span>
      <h1 className="mx-auto my-5 max-w-[14ch] text-[clamp(36px,6vw,64px)] font-extrabold leading-[1.05] tracking-tight">
        Seu dinheiro <em className="not-italic text-brand">em ordem</em>, sem pagar nada por isso.
      </h1>
      <p className="mx-auto mb-8 max-w-[46ch] text-[clamp(17px,2vw,20px)] text-muted">
        Controle receitas, despesas, cartões, financiamentos, o orçamento da família, viagens e metas — num app de computador simples, feito para brasileiros.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={os ? release.url(os) : "#baixar"}
          className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-brand px-[22px] font-bold text-brand-ink transition hover:-translate-y-px hover:brightness-110"
        >
          {Icons.download}
          {os ? OS_LABEL[os] : "Baixar grátis"}
        </a>
        <a href={REPO_URL} className="inline-flex h-12 items-center rounded-xl border border-line bg-surface px-[22px] font-bold transition hover:-translate-y-px">
          Ver no GitHub
        </a>
      </div>
      <p className="mt-3.5 text-[13px] text-muted">
        {release.tag ? `Versão ${release.tag} · ` : ""}Windows · macOS · Linux
      </p>
      <div className="mx-auto mt-14 max-w-[1060px] overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(47,128,217,.35)]">
        <img
          src={painel}
          alt="Tela principal do Martins Finança com receitas, despesas, gráfico mensal e categorias"
          width={1280}
          height={800}
          className="block h-auto w-full"
        />
      </div>
    </header>
  );
}
