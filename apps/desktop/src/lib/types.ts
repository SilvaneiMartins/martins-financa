export type Kind = "receita" | "despesa";
export type Scope = "pessoal" | "familiar";
export type TxStatus = "pago" | "pendente";

export interface Category {
  id: number;
  name: string;
  kind: Kind;
  color: string;
  archived: number;
}

export interface Member {
  id: number;
  name: string;
  relation: string | null;
  color: string;
}

export type AccountType = "corrente" | "poupanca" | "investimento" | "carteira" | "cartao_credito" | "outro";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  bank: string | null;
  initial_balance: number;
  credit_limit: number;
  closing_day: number | null;
  due_day: number | null;
  color: string;
  archived: number;
  balance?: number; // contas: saldo atual | cartão: valor em aberto
}

export interface IncomeSource {
  id: number;
  name: string;
  type: string;
  gross: number;
  net: number;
  pay_day: number;
  member_id: number | null;
  account_id: number | null;
  category_id: number | null;
  active: number;
  notes: string | null;
  member_name?: string;
}

export interface Commitment {
  id: number;
  name: string;
  type: string;
  amount: number;
  total_installments: number | null;
  start_date: string;
  due_day: number;
  interest_rate: number | null;
  financed_amount: number | null;
  category_id: number | null;
  account_id: number | null;
  scope: Scope;
  member_id: number | null;
  active: number;
  notes: string | null;
  category_name?: string;
  paid_count?: number;
}

export interface Transaction {
  id: number;
  kind: Kind;
  description: string;
  amount: number;
  date: string;
  purchase_date: string | null;
  status: TxStatus;
  category_id: number | null;
  account_id: number | null;
  scope: Scope;
  member_id: number | null;
  commitment_id: number | null;
  income_source_id: number | null;
  trip_id: number | null;
  installment_no: number | null;
  installment_total: number | null;
  group_key: string | null;
  ref_key: string | null;
  notes: string | null;
  category_name?: string | null;
  category_color?: string | null;
  account_name?: string | null;
  account_type?: AccountType | null;
  member_name?: string | null;
}

export interface Trip {
  id: number;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  travelers: number;
  status: string;
  notes: string | null;
  planned_total?: number;
  actual_total?: number;
}

export interface TripItem {
  id: number;
  trip_id: number;
  category: string;
  description: string;
  planned: number;
  actual: number;
  paid: number;
}

export interface Goal {
  id: number;
  name: string;
  type: string;
  target: number;
  current: number;
  target_date: string | null;
  monthly_contribution: number;
  expected_return: number;
  priority: number;
  notes: string | null;
}

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  investimento: "Investimentos",
  carteira: "Carteira / dinheiro",
  cartao_credito: "Cartão de crédito",
  outro: "Outra",
};

export const INCOME_TYPES: Record<string, string> = {
  clt: "CLT (salário)",
  pj: "PJ / Pró-labore",
  autonomo: "Autônomo / Freelance",
  servidor: "Servidor público",
  aposentadoria: "Aposentadoria / Pensão",
  aluguel: "Aluguel recebido",
  beneficio: "Benefício social",
  investimentos: "Rendimentos",
  outros: "Outros",
};

export const COMMITMENT_TYPES: Record<string, string> = {
  avulsa: "Conta avulsa (uma vez)",
  recorrente: "Conta fixa mensal",
  financiamento_imobiliario: "Financiamento da casa",
  financiamento_veiculo: "Financiamento de veículo",
  emprestimo: "Empréstimo",
  consorcio: "Consórcio",
  assinatura: "Assinatura",
  mensalidade: "Mensalidade",
  imposto: "Imposto (IPTU/IPVA)",
  outros: "Outros",
};

export const TRIP_CATEGORIES: Record<string, string> = {
  transporte: "Transporte",
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  passeios: "Passeios",
  compras: "Compras",
  seguro: "Seguro / Documentos",
  outros: "Outros",
};

export const TRIP_STATUS: Record<string, string> = {
  planejando: "Planejando",
  confirmada: "Confirmada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const GOAL_TYPES: Record<string, string> = {
  reserva_emergencia: "Reserva de emergência",
  aposentadoria: "Aposentadoria",
  imovel: "Imóvel / Entrada",
  veiculo: "Veículo",
  educacao: "Educação",
  viagem: "Viagem",
  quitar_divida: "Quitar dívida",
  outros: "Outros",
};
