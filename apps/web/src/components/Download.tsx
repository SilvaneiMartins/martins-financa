import type { OS, Release } from "../lib/releases";

const platforms: { os: OS; name: string; hint: string }[] = [
  { os: "windows", name: "Windows", hint: "instalador .exe / .msi" },
  { os: "mac-arm", name: "macOS (Apple Silicon M1–M4)", hint: ".dmg" },
  { os: "mac-intel", name: "macOS (Intel)", hint: ".dmg" },
  { os: "linux", name: "Linux", hint: ".AppImage / .deb / .rpm" },
];

export function Download({ release }: { release: Release }) {
  return (
    <section id="baixar" className="pb-14 md:pb-[88px]">
      <div className="mx-auto max-w-[1120px] px-5">
        <div className="grid items-center gap-8 rounded-3xl bg-brand p-7 text-brand-ink md:grid-cols-[1.2fr_1fr] md:p-12">
          <div>
            <h2 className="mb-3 text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-tight">Baixe agora. É grátis.</h2>
            <p className="opacity-85">
              Sem cadastro, sem cartão de crédito, sem período de teste. Um projeto da Agência Martins para ajudar as famílias brasileiras a cuidar do próprio dinheiro.
            </p>
            <p className="mt-4 text-[13px] opacity-85">
              Na primeira abertura, o Windows (SmartScreen) ou o macOS podem avisar que o app é de um desenvolvedor não identificado — clique em “Mais informações → Executar assim mesmo” (Windows) ou clique com o botão direito → Abrir (macOS).
            </p>
          </div>
          <div className="grid gap-2.5">
            {platforms.map((p) => (
              <a
                key={p.os}
                href={release.url(p.os)}
                className="flex items-center justify-between gap-3 rounded-xl bg-brand-ink/15 px-4 py-3.5 font-bold transition hover:bg-brand-ink/25"
              >
                {p.name}
                <span className="text-[13px] font-medium opacity-80">{p.hint}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
