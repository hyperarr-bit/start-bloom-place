import type { ConfigCartoes } from "./CartoesDoModulo";

/**
 * O REGISTRO DOS CARTÕES DE BOAS-VINDAS (1.0.14): um arquivo por módulo, carregado
 * SOB DEMANDA — só quando a folha vai aparecer. Cada módulo abre a página leve de
 * sempre; a miniatura (que renderiza o componente REAL do módulo com dados de
 * exemplo) só entra no pacote de quem está vendo os cartões.
 *
 * Ordem de prioridade do dono (10/10): Rotina, Treino, Saúde, Dieta, Metas, Casa,
 * Estudos, Biblioteca, Mente, Carreira, Relações, Detox, Pet, Viagens (Finanças e
 * Beleza vieram antes). Abas "vivas" de cada módulo: scratchpad/complexidade-10-10
 * (uso que se repete em 2+ dias, 14 dias de card_interact).
 */
export type FabricaDeCartoes = () => ConfigCartoes;

const CARTOES: Record<string, () => Promise<{ default: FabricaDeCartoes }>> = {
  financas: () => import("./cartoes-financas"),
  beleza: () => import("./cartoes-beleza"),
  rotina: () => import("./cartoes-rotina"),
  treino: () => import("./cartoes-treino"),
  saude: () => import("./cartoes-saude"),
  dieta: () => import("./cartoes-dieta"),
  desenvolvimento: () => import("./cartoes-desenvolvimento"),
  casa: () => import("./cartoes-casa"),
  estudos: () => import("./cartoes-estudos"),
  biblioteca: () => import("./cartoes-biblioteca"),
  hiperfoco: () => import("./cartoes-hiperfoco"),
  carreira: () => import("./cartoes-carreira"),
  relacionamentos: () => import("./cartoes-relacionamentos"),
  detox: () => import("./cartoes-detox"),
  pet: () => import("./cartoes-pet"),
  viagens: () => import("./cartoes-viagens"),
};

/** Os 16 módulos com cartões. */
export const MODULOS_COM_CARTOES: readonly string[] = Object.keys(CARTOES);

export async function carregarCartoes(moduleId: string): Promise<FabricaDeCartoes | null> {
  const carregar = CARTOES[moduleId];
  if (!carregar) return null;
  const mod = await carregar();
  return mod.default;
}

/**
 * Abre a aba do módulo pelo RÓTULO (o "antes" do "Fazer agora"): procura o botão de aba
 * na tela cujo texto contém o rótulo e toca nele. Não mexe no estado da página — é o
 * mesmo toque que a pessoa daria. Rótulo que não existe = fica na aba em que está.
 */
export function abrirAba(rotulo: string): void {
  try {
    const alvo = rotulo.toUpperCase();
    const botoes = Array.from(document.querySelectorAll<HTMLElement>('header button, [role="tablist"] button, [role="tab"], .notion-tab'));
    const aba = botoes.find((b) => (b.textContent ?? "").toUpperCase().includes(alvo));
    aba?.click();
  } catch { /* sem DOM */ }
}
