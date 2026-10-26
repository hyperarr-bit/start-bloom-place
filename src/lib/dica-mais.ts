import { missaoDoDiaEmCena, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";

/**
 * A DICA DO "+" (1.0.19, dono 26/10) — o ÚNICO ensino da Home nova (o tour antigo de 5 passos está aposentado):
 * um balão pequeno preso ao "+" da barra de vidro, "Toque no + pra anotar qualquer coisa do seu dia".
 *
 *   · QUANDO: na Home nova, depois da 1ª dose da missão (feitos[1]) — e, pra quem tocou "Explorar por conta
 *     própria" (nunca faz dose), na 1ª Home depois das boas-vindas. Nunca com a missão do dia ainda em cena
 *     (festa → "Plano de amanhã" decidido primeiro: missaoDoDiaEmCena) nem com outra camada/folha na tela (a barra
 *     some nessas horas — a dica mora DENTRO da barra).
 *   · SOME no 1º toque (no "+" = "usada"; em qualquer outro lugar = "dispensada") e NUNCA volta: marca no aparelho
 *     (chave do aparelho, a vassoura não leva) E na conta (reinstalar não repete). Fechar o app com ela na tela não
 *     a repete pra sempre: a 2ª aparição sem toque é a última (MAX_APARICOES_DICA_MAIS), como as outras dicas.
 *   · Sem missão nenhuma (cliente antigo com a Home nova, o dono no "admin"): nada.
 */
export const CHAVE_DICA_MAIS = "core-home-nova-dica-mais";
export const MAX_APARICOES_DICA_MAIS = 2;
/** Quanto tempo a barra tem que ficar parada, sem camada por cima, antes do balão entrar. */
export const ESPERA_DICA_MAIS_MS = 1200;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
};

type MarcaDica = { feita?: string; via?: string; aparicoes?: number };
const lerMarca = (v: unknown): MarcaDica | null => {
  if (!v) return null;
  if (typeof v === "string") { try { return JSON.parse(v) as MarcaDica; } catch { return { feita: v }; } }
  return typeof v === "object" ? (v as MarcaDica) : null;
};

/** Já foi tocada (usada/dispensada) ou já apareceu as vezes que podia — neste aparelho ou na conta.
 *  `contadaNestaAbertura`: a aparição DESTA abertura já foi contada — ela não tira a dica da tela. */
export function dicaDoMaisEncerrada(naConta?: unknown, contadaNestaAbertura = false): boolean {
  const aqui = lerMarca(ls.get(CHAVE_DICA_MAIS));
  const conta = lerMarca(naConta);
  if (aqui?.feita || conta?.feita) return true;
  return Math.max(aqui?.aparicoes ?? 0, conta?.aparicoes ?? 0) - (contadaNestaAbertura ? 1 : 0) >= MAX_APARICOES_DICA_MAIS;
}

/** A dica está devendo? (sem olhar a tela: quem chama confere a barra visível e a espera). */
export function dicaDoMaisDevida(m: EstadoMissaoDoses | null, naConta?: unknown, hoje: string = localDayKey(), contadaNestaAbertura = false): boolean {
  if (!m || !m.boasVindas) return false;
  if (dicaDoMaisEncerrada(naConta, contadaNestaAbertura)) return false;
  if (!m.feitos[1] && !m.explorou) return false;
  return !missaoDoDiaEmCena(m, hoje);
}

/** Conta uma aparição (1x por abertura do app — quem chama segura). Devolve a marca nova (pra subir pra conta). */
export function registrarAparicaoDicaMais(naConta?: unknown): MarcaDica {
  const aqui = lerMarca(ls.get(CHAVE_DICA_MAIS)) ?? {};
  const conta = lerMarca(naConta) ?? {};
  const nova: MarcaDica = { ...conta, ...aqui, aparicoes: Math.max(aqui.aparicoes ?? 0, conta.aparicoes ?? 0) + 1 };
  ls.set(CHAVE_DICA_MAIS, JSON.stringify(nova));
  return nova;
}

/** O 1º toque: encerra pra sempre. Devolve a marca (pra subir pra conta). */
export function encerrarDicaMais(via: "usada" | "dispensada", agora: number = Date.now()): MarcaDica {
  const aqui = lerMarca(ls.get(CHAVE_DICA_MAIS)) ?? {};
  const nova: MarcaDica = { ...aqui, feita: new Date(agora).toISOString(), via };
  ls.set(CHAVE_DICA_MAIS, JSON.stringify(nova));
  return nova;
}
