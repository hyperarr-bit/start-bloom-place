/**
 * A DEMO QUE VENDE (/liberar, 16/10) — as frases num lugar só (os testes leem daqui). Puro, sem React.
 *
 * Os números do dono: no /assinar 72% saem na 1ª tela e 88% de quem vê o preço não toca em pagar (não viu o app);
 * no /experimente 13% criam conta, mas quase ninguém instala o app depois. Aqui a pessoa VÊ e USA o app (a demo do
 * /experimente) e paga no SITE, com Pix (o paywall do /assinar), antes do app.
 *
 * Regras: nunca "sem cartão"; nunca "grátis" (aqui é pago); área de transferência só no "Copiar código Pix".
 */
import type { ModuloDemo } from "@/pages/experimente/conteudo";
import { MODULOS_DEMO } from "@/pages/experimente/conteudo";

/** A marca destas contas/eventos: `variante: "demo"` (user_metadata.venda e os eventos demo_* / venda_*). */
export const VARIANTE_LIBERAR = "demo";

/** O botão de todas as entradas (topo, faixa, folha, fim). */
export const BOTAO_LIBERAR = "Liberar meu CORE";

/** A folha de baixo (30 s / 2ª troca de módulo, 1x por sessão). Não bloqueia a demo. */
export const FOLHA_TITULO_LIBERAR = "Gostou? Libere o CORE completo e continue no app.";
export const FOLHA_TEXTO_LIBERAR = "Paga no Pix, aqui mesmo, e já entra no app com os seus dados.";

/** O fim de cada módulo. */
export const FIM_TITULO_LIBERAR = "Gostou? Libere o CORE completo.";
export const FIM_TEXTO_LIBERAR = "Continue no app, no celular e no computador, com os seus dados.";

/** O paywall do /assinar com as frases desta página (o card do preço e os botões são os mesmos). */
export const PAYWALL_TITULO_LIBERAR = "Libere seu CORE completo";
export const PAYWALL_SUB_LIBERAR = "Tudo o que você viu na demonstração, com os seus dados de verdade.";
export const BENEFICIOS_LIBERAR = [
  "O app inteiro, sem dados de exemplo",
  "Dinheiro, rotina, treino, saúde e dieta num lugar só",
  "No iPhone, no Android e no computador",
] as const;

const NOME: Record<ModuloDemo, string> = Object.fromEntries(MODULOS_DEMO.map((m) => [m.key, m.label])) as Record<ModuloDemo, string>;

/** O contexto acima do título do paywall: o módulo que ela mais usou e (se anotou algo) que isso vai junto. */
export function contextoDoPaywall(modulo: ModuloDemo, itens: number): { linha: string; itens: string | null } {
  return {
    linha: `Seu CORE começa por ${NOME[modulo]}`,
    itens: itens === 1 ? "O que você anotou na demonstração vai junto." : itens > 1 ? `As ${itens} coisas que você anotou na demonstração vão junto.` : null,
  };
}

/** O módulo que ela mais usou: o de mais mexidas; empate/nada = o que está aberto. */
export function moduloMaisUsado(mexidas: Partial<Record<ModuloDemo, number>>, aberto: ModuloDemo): ModuloDemo {
  let melhor: ModuloDemo = aberto;
  let n = mexidas[aberto] ?? 0;
  for (const m of MODULOS_DEMO) {
    const v = mexidas[m.key] ?? 0;
    if (v > n) { melhor = m.key; n = v; }
  }
  return melhor;
}

export const VOLTAR_DEMO_LIBERAR = "Voltar pra demonstração";
