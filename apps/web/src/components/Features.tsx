import type { ReactNode } from "react";
import { Icons } from "./Icons";

const features: { icon: ReactNode; title: string; text: string }[] = [
  { icon: Icons.list, title: "Receitas e despesas", text: "Lançamentos pessoais ou familiares, por categoria, conta e membro da família. Filtros por mês, tipo e situação." },
  { icon: Icons.card, title: "Cartão de crédito de verdade", text: "Compras parceladas entram na fatura certa pelo dia de fechamento. Limite, faturas futuras e pagamento com um clique." },
  { icon: Icons.home, title: "Financiamentos e contas fixas", text: "Financiamento da casa, veículo, consórcio, empréstimo, escola, luz e internet. Parcelas geradas sozinhas, com saldo devedor." },
  { icon: Icons.money, title: "Rendas CLT, PJ e outras", text: "Salário bruto e líquido, pró-labore, aposentadoria, aluguéis. Veja quanto entra e quanto é descontado." },
  { icon: Icons.import, title: "Importa extrato do banco", text: "OFX e CSV de Itaú, Bradesco, BB, Caixa, Santander, Nubank, Inter... com sugestão automática de categoria e sem duplicar." },
  { icon: Icons.bell, title: "Nunca mais pague juros por esquecer", text: "Alertas de contas vencidas, que vencem hoje e nos próximos dias — no app e como notificação do sistema." },
  { icon: Icons.chart, title: "Relatórios em PDF e CSV", text: "Relatório mensal completo, evolução mês a mês, por categoria, por conta e por pessoa. Abre no Excel." },
  { icon: Icons.target, title: "Metas de longo prazo", text: "Reserva de emergência, entrada da casa, aposentadoria: projeção com juros e quanto guardar por mês." },
];

export function Features() {
  return (
    <section id="recursos" className="py-14 md:py-[88px]">
      <div className="mx-auto max-w-[1120px] px-5">
        <h2 className="mb-3 text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-tight">Tudo que você precisa para sair do vermelho</h2>
        <p className="mb-10 max-w-[60ch] text-muted">Sem planilhas complicadas. Cadastre uma vez e o app cuida do resto todo mês.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-[18px] border border-line bg-surface p-6">
              <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-brand-soft text-brand">{f.icon}</div>
              <h3 className="mb-1.5 mt-3 text-[17px] font-bold">{f.title}</h3>
              <p className="text-[15px] text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
