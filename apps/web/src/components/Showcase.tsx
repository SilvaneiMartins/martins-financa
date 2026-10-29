import familia from "../assets/familia.webp";
import escuro from "../assets/lancamentos-escuro.webp";

interface SplitProps {
  id: string;
  title: string;
  text: string;
  items: string[];
  image: string;
  alt: string;
  imageFirst?: boolean;
}

function Split({ id, title, text, items, image, alt, imageFirst }: SplitProps) {
  return (
    <section id={id} className="pb-14 md:pb-[88px]">
      <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-5 md:grid-cols-[1fr_1.25fr]">
        <div className={imageFirst ? "md:order-2" : ""}>
          <h2 className="mb-3 text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-tight">{title}</h2>
          <p className="mb-6 max-w-[60ch] text-muted">{text}</p>
          <ul className="grid gap-3">
            {items.map((i) => (
              <li key={i} className="flex gap-2.5">
                <span className="font-extrabold text-brand">✓</span>
                {i}
              </li>
            ))}
          </ul>
        </div>
        <img src={image} alt={alt} loading="lazy" width={1280} height={800} className="w-full rounded-[14px] border border-line" />
      </div>
    </section>
  );
}

export function Showcase() {
  return (
    <>
      <Split
        id="familia"
        title="Planejamento para a família inteira"
        text="Monte o orçamento do mês por categoria, acompanhe o que cada um gastou e planeje as próximas férias sem dívida."
        items={[
          "Orçamento mensal com sugestão pela média dos últimos meses",
          "Membros da família e separação gasto pessoal × familiar",
          "Planejamento de viagens: custos previstos × reais e quanto guardar por mês",
          "Use em vários computadores da casa pelo mesmo Wi-Fi",
        ]}
        image={familia}
        alt="Tela de planejamento familiar com orçamento por categoria e membros da família"
      />
      <Split
        id="privacidade"
        imageFirst
        title="Seus dados são seus"
        text="Nada de conta online, senha de banco ou nuvem de terceiros. Tudo fica num arquivo no seu computador."
        items={[
          "Funciona sem internet",
          "Não pede senha do banco — você importa o extrato que baixou",
          "Backup em um clique para pen drive ou sua nuvem pessoal",
          "Modo privacidade para esconder os valores da tela",
          "Código aberto (MIT): qualquer pessoa pode auditar",
        ]}
        image={escuro}
        alt="Lista de lançamentos no tema escuro"
      />
    </>
  );
}
