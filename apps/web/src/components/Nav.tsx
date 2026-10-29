import { REPO_URL } from "../lib/config";
import { ThemeMenu } from "./ThemeMenu";
import logo from "../assets/logo.svg";

const links = [
  ["#recursos", "Recursos"],
  ["#familia", "Família"],
  ["#privacidade", "Privacidade"],
  ["#telas", "Telas"],
  ["#baixar", "Baixar"],
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5">
        <a href="#" className="flex items-center gap-2.5 font-extrabold">
          <img src={logo} alt="" className="h-8 w-8" />
          <span>
            Martins Finança
            <small className="block text-[10px] font-bold uppercase leading-none tracking-[.14em] text-muted">Agência Martins</small>
          </span>
        </a>
        <div className="flex items-center gap-6">
          <div className="hidden gap-6 text-sm font-semibold text-muted md:flex">
            {links.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-ink">
                {label}
              </a>
            ))}
            <a href={REPO_URL} className="hover:text-ink">
              GitHub
            </a>
          </div>
          <ThemeMenu />
        </div>
      </div>
    </nav>
  );
}
