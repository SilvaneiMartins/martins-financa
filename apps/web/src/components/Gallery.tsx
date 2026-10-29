import contas from "../assets/contas.webp";
import relatorios from "../assets/relatorios.webp";
import metas from "../assets/metas.webp";
import lancamento from "../assets/modal-lancamento.webp";
import compromisso from "../assets/modal-compromisso.webp";
import configuracoes from "../assets/configuracoes.webp";

const shots = [
  { src: lancamento, title: "Lançamento em segundos", text: "Receita ou despesa no mesmo formulário, com parcelas, categoria, conta e membro da família.", alt: "Janela de nova despesa com descrição, valor, categoria e conta" },
  { src: compromisso, title: "Financiamentos sob controle", text: "Cadastre parcelas e veja o custo total do crédito. Os lançamentos de cada mês nascem sozinhos.", alt: "Janela de edição de compromisso de um financiamento imobiliário" },
  { src: contas, title: "Contas e cartões", text: "Saldo de cada conta, limite e faturas dos cartões num só lugar.", alt: "Tela de contas e cartões de crédito" },
  { src: metas, title: "Metas de longo prazo", text: "Reserva de emergência, entrada do imóvel, aposentadoria — com projeção e aporte necessário.", alt: "Tela de metas de longo prazo com progresso" },
  { src: relatorios, title: "Relatórios", text: "Evolução mês a mês, por categoria e por pessoa. Exporte em PDF ou CSV.", alt: "Tela de relatórios com gráficos e totais" },
  { src: configuracoes, title: "Do seu jeito", text: "Tema claro, escuro ou do sistema, fonte maior, modo privacidade e rede local.", alt: "Janela de configurações com seletor de tema" },
];

export function Gallery() {
  return (
    <section id="telas" className="pb-14 md:pb-[88px]">
      <div className="mx-auto max-w-[1120px] px-5">
        <h2 className="mb-3 text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-tight">Conheça o app por dentro</h2>
        <p className="mb-10 max-w-[60ch] text-muted">Telas reais do Martins Finança, com dados de exemplo.</p>
        <div className="grid gap-5 md:grid-cols-2">
          {shots.map((s) => (
            <figure key={s.title} className="overflow-hidden rounded-[18px] border border-line bg-surface">
              <div className="overflow-hidden border-b border-line bg-bg">
                <img src={s.src} alt={s.alt} loading="lazy" width={1280} height={800} className="block h-auto w-full transition duration-500 hover:scale-[1.03]" />
              </div>
              <figcaption className="p-5">
                <h3 className="text-[17px] font-bold">{s.title}</h3>
                <p className="mt-1 text-[15px] text-muted">{s.text}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
