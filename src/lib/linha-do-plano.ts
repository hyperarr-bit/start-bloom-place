/**
 * A linha curta do plano ("Plano anual", "Acesso vitalício", "Teste grátis até 24 de out."…) — o detalhe inteiro mora em
 * /planos. Nasceu na aba Você da 1.0.17 (pages/Voce.tsx, que reexporta daqui); a 1.0.18 usa a mesma no "Meu plano"
 * do menu da conta (AccountDrawer). Fica num lib pra folha não puxar a página do Você (e o ciclo Voce ⇄ AccountDrawer).
 */
const NOME_DO_PLANO: Record<string, string> = {
  monthly: "Plano mensal",
  monthly_prepaid: "1 mês de acesso",
  annual: "Plano anual",
  lifetime: "Acesso vitalício",
};

export function linhaDoPlano(a: { subLoaded: boolean; isSubscribed: boolean; billingPeriod: string | null; subscriptionEnd: string | null; inGracePeriod: boolean }, testeAtivo = false): string {
  if (!a.subLoaded) return "Ver meu acesso";
  if (a.inGracePeriod) return "Pagamento pendente";
  if (!a.isSubscribed) return "Sem plano ativo";
  if (a.billingPeriod === "annual" && testeAtivo && a.subscriptionEnd) {
    const d = new Date(a.subscriptionEnd);
    if (!Number.isNaN(d.getTime())) return `Teste grátis até ${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  }
  return NOME_DO_PLANO[a.billingPeriod ?? ""] ?? "Todos os 16 módulos liberados";
}
