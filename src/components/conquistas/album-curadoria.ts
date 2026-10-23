import { CATEGORIAS, type Badge, type BadgeCategoria } from "@/components/gamification/types";

/**
 * Composição do álbum novo: alterna cenas, proporções e acentos de cor.
 * As posições são editoriais, nunca dependem do progresso ou do desbloqueio.
 * As quebras abaixo acompanham as folhas de até cinco figurinhas atuais.
 */
export const ORDEM_EDITORIAL: Partial<Record<BadgeCategoria, readonly string[]>> = {
  sequencia: [
    "sequencia-2", "sequencia-3", "sequencia-7", "sequencia-14", "sequencia-30",
    "retorno", "protetor-1", "sequencia-100", "mes-20", "ano-365",
  ],
  finance: [
    "first-income", "first-expense", "wishlist", "organizer", "finance-3",
    "saver-20", "finance-conta", "saver-60", "finance-limite", "conscious-buyer",
    "investor-1k", "bills-ok", "quitador", "challenger", "mes-fechado",
    "debt-free", "challenger-5", "challenger-15", "azul-3", "emergency-fund",
  ],
  rotina: [
    "rotina-1", "tarefa-1", "compromisso-1", "humor-1", "diario-1",
    "tarefa-feita", "habito-criado", "foco-1", "rotina-semana",
    "diario-7", "rotina-21", "humor-7", "contador-3",
    "foco-3", "urgencia-feita", "foco-10h", "rotina-revisao",
  ],
  leitura: [
    "leitura-primeira", "leitura-3", "leitura-estante", "leitura-1", "leitura-nota",
    "leitura-30", "leitura-10", "meta-ano", "leitura-25",
  ],
  treino: [
    "treino-plano", "treino-1", "treino-carga", "treino-7", "treino-pr",
    "treino-completo", "treino-12", "treino-nota", "treino-semana",
    "treino-25", "meta-semanal-4", "treino-50", "treino-100",
  ],
  dieta: [
    "dieta-refeicao", "dieta-plano", "receita-1", "dieta-1",
    "dieta-jejum", "receita-3", "dieta-semana",
  ],
  saude: [
    "agua-1", "saude-remedio", "sono-1", "saude-log",
    "agua-3", "sono-7", "agua-7",
  ],
};

const posicoesDosModulos = new Map(CATEGORIAS.map((categoria, indice) => [categoria.id, indice]));
const posicoesDasFigurinhas = new Map(
  Object.entries(ORDEM_EDITORIAL).map(([categoria, ids]) => [categoria, new Map(ids.map((id, indice) => [id, indice]))]),
);
const DEPOIS_DA_CURADORIA = Number.MAX_SAFE_INTEGER;

/** Mantém os objetos originais; figurinhas futuras entram no fim do seu módulo, na ordem recebida. */
export function ordenarParaAlbumEditorial(adesivos: readonly Badge[]): Badge[] {
  return adesivos.map((adesivo, indice) => ({ adesivo, indice })).sort((a, b) => {
    const modulo = (posicoesDosModulos.get(a.adesivo.category) ?? DEPOIS_DA_CURADORIA)
      - (posicoesDosModulos.get(b.adesivo.category) ?? DEPOIS_DA_CURADORIA);
    if (modulo) return modulo;
    const ordem = posicoesDasFigurinhas.get(a.adesivo.category);
    return (ordem?.get(a.adesivo.id) ?? DEPOIS_DA_CURADORIA)
      - (ordem?.get(b.adesivo.id) ?? DEPOIS_DA_CURADORIA)
      || a.indice - b.indice;
  }).map(({ adesivo }) => adesivo);
}
