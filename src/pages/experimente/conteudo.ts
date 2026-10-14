/**
 * FUNIL-DEMO (/experimente, 14/10) — as frases e os módulos num lugar só (os testes leem daqui).
 * Sem preço em lugar nenhum; nunca "sem cartão"; nada de área de transferência.
 */
import type { ItemDaDemo } from "@/lib/demo-guiada";

/** Os 5 módulos, na ordem do USO REAL (dono, 14/10). `?m=` aceita a chave. */
export const MODULOS_DEMO = [
  { key: "financas", label: "Finanças", emoji: "💰" },
  { key: "rotina", label: "Rotina", emoji: "📅" },
  { key: "treino", label: "Treino", emoji: "💪" },
  { key: "saude", label: "Saúde", emoji: "❤️" },
  { key: "dieta", label: "Dieta", emoji: "🥗" },
] as const;
export type ModuloDemo = (typeof MODULOS_DEMO)[number]["key"];
export const MODULO_PADRAO: ModuloDemo = "financas";

/** `?m=` → módulo (aceita maiúscula, acento e os apelidos óbvios); desconhecido = Finanças. */
const APELIDOS: Record<string, ModuloDemo> = {
  financas: "financas", financa: "financas", dinheiro: "financas",
  rotina: "rotina", habitos: "rotina",
  treino: "treino", academia: "treino",
  saude: "saude",
  dieta: "dieta", alimentacao: "dieta",
};
export function moduloDaUrl(m: string | null | undefined): ModuloDemo {
  const k = String(m ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return APELIDOS[k] ?? MODULO_PADRAO;
}
export const ehModuloDemo = (m: string): m is ModuloDemo => MODULOS_DEMO.some((x) => x.key === m);

/** A área (como a Porta grava em respostas.area) de cada módulo. */
export const AREA_DO_MODULO: Record<ModuloDemo, string> = {
  financas: "dinheiro", rotina: "rotina", treino: "corpo", saude: "saude", dieta: "corpo",
};

/** A marca destas contas em user_metadata.porta (compara com a Porta do /comece). */
export const VARIANTE = "demo";

export const TOPO_SELO = "Modo demonstração";
export const FAIXA_TEXTO = "Demonstração com dados de exemplo";
export const BOTAO_CRIAR = "Criar conta";

/** A folha de baixo (30 s / 2ª troca de módulo). Não bloqueia a demo. */
export const FOLHA_TITULO = "Gostou? Crie sua conta grátis e continue no app.";
export const FOLHA_TEXTO = "Leva menos de um minuto. Depois é só entrar no app.";
export const FOLHA_BOTAO = "Criar conta grátis";
export const FOLHA_FECHAR = "Continuar explorando";
/** a folha aparece sozinha depois disso (1x por sessão) */
export const SEGUNDOS_ATE_A_FOLHA = 30;

/** O fim de cada módulo. */
export const FIM_TITULO = "Gostou? Leve isso pro seu celular.";
export const FIM_TEXTO = "Crie sua conta grátis e continue no app, com os seus dados.";

/** A conta (ContaPorta com o título deste funil). */
export const CONTA_TITULO = "Crie sua conta grátis e continue no app";
export const contaTexto = (itens: ItemDaDemo[]): string =>
  itens.length === 1
    ? "O que você anotou na demonstração vai junto pra sua conta."
    : itens.length > 1
      ? `As ${itens.length} coisas que você anotou na demonstração vão junto pra sua conta.`
      : "Leva menos de um minuto. Depois é só entrar no app.";
export const VOLTAR_DEMO = "Voltar pra demonstração";
