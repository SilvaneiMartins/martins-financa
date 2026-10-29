import { REPO_URL } from "../lib/config";

export function Footer() {
  return (
    <footer className="overflow-hidden border-t border-line pt-8 text-sm text-muted">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-5">
        <span>© {new Date().getFullYear()} Agência Martins · Martins Finança · Licença MIT</span>
        <a href={REPO_URL} className="hover:text-ink">
          Código-fonte no GitHub
        </a>
      </div>

      <div
        aria-hidden
        className="pointer-events-none mt-10 select-none overflow-hidden text-center font-bold leading-[0.8] tracking-tighter [-webkit-mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent_92%)] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent_92%)]"
      >
        <span className="block text-[clamp(4rem,21vw,19rem)] text-brand opacity-[0.32]">
          Martins
          <span className="ml-[0.1em] align-top text-[0.26em] font-semibold leading-none tracking-tight">Finança</span>
        </span>
      </div>
    </footer>
  );
}
