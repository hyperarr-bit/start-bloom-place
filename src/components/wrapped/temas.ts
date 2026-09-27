import { MESES, type RetroMes } from "@/lib/retrospectiva";
import { larguraDe } from "./prancheta";

/**
 * TEMAS DA RETROSPECTIVA (26/09, mudança de rota aprovada pelo dono): o
 * "papel pontilhado" saiu e a retrospectiva virou um sistema de 3 peles,
 * desenhadas pelo designer:
 *   paginas  — "Páginas de dentro": o planner premium escuro (linho, foil,
 *              espiral, lacre). É o PADRÃO.
 *   edicao   — "Edição de setembro": a revista do mês (cor chapada, capa).
 *   recortes — "Recortes": o scrapbook (polaroid, washi, adesivos).
 *
 * A pessoa troca pelo chip "Tema" da capa (decisão do designer); a escolha fica em
 * `retro-tema` (user_data). A lógica de dados é a mesma nos três: muda só a
 * pele de cada página. O card final é o do planner em todos; nos temas
 * revista e recortes o card do próprio tema vira a opção secundária.
 *
 * Aqui mora só o que é puro (nomes, leitura da chave e as frases que as
 * páginas escrevem) — dá pra testar sem montar tela nenhuma.
 */

export type TemaDaRetro = "paginas" | "edicao" | "recortes";
export const TEMA_PADRAO: TemaDaRetro = "paginas";
export const CHAVE_DO_TEMA = "retro-tema";
export const ORDEM_DOS_TEMAS: TemaDaRetro[] = ["paginas", "edicao", "recortes"];

export const ehTema = (v: unknown): v is TemaDaRetro => v === "paginas" || v === "edicao" || v === "recortes";
/** O que estiver gravado (ou nada, ou lixo) vira um tema válido. */
export const lerTema = (v: unknown): TemaDaRetro => (ehTema(v) ? v : TEMA_PADRAO);

/** Nome na folha de temas — a revista leva o mês ("Edição de Setembro", como o designer escreveu). */
export const nomeDoTema = (t: TemaDaRetro, mes: string) =>
  t === "paginas" ? "Páginas de dentro" : t === "edicao" ? `Edição de ${mes.charAt(0).toUpperCase()}${mes.slice(1)}` : "Recortes";
export const DESCRICAO_DO_TEMA: Record<TemaDaRetro, string> = {
  paginas: "planner premium",
  edicao: "revista",
  recortes: "scrapbook",
};

/** Estilo do card: o planner (padrão em todos os temas) ou o do próprio tema. */
export type EstiloDoCard = "planner" | "revista" | "recortes";
export const estiloDoTema = (t: TemaDaRetro): EstiloDoCard | null => (t === "edicao" ? "revista" : t === "recortes" ? "recortes" : null);
export const ROTULO_DO_ESTILO: Record<EstiloDoCard, string> = { planner: "Planner", revista: "Revista", recortes: "Recortes" };

/* ------------------------------------------------------------ frases */

/** "Constância de Ferro" → "Constância de ferro" (é assim que os três cards escrevem). */
export const perfilEmFrase = (nome: string) => {
  const t = nome.trim();
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1).toLocaleLowerCase("pt-BR") : t;
};

/**
 * Quebra um título em até duas linhas equilibradas ("Constância / de ferro",
 * "Olho no / dinheiro"). Palavra única fica numa linha só.
 */
export const emDuasLinhas = (texto: string): string[] => {
  const p = texto.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return p;
  let melhor = [p.join(" ")];
  let pior = Infinity;
  for (let i = 1; i < p.length; i++) {
    const a = p.slice(0, i).join(" ");
    const b = p.slice(i).join(" ");
    const m = Math.max(a.length, b.length);
    if (m < pior) { pior = m; melhor = [a, b]; }
  }
  return melhor;
};

/**
 * O perfil no card: em duas linhas quando as duas têm corpo ("Constância /
 * de ferro", "Cofre / forte"); numa só quando a quebra deixaria uma palavra
 * solta ("Em construção", "No azul") e ela cabe.
 */
export const linhasDoPerfil = (perfil: string, tamanho: number, largura: number): string[] => {
  const duas = emDuasLinhas(perfil);
  if (duas.length === 2 && duas.every((l) => l.length >= 4)) return duas;
  if (larguraDe(perfil, tamanho, { familia: "serif", italico: true }) <= largura) return [perfil];
  return duas;
};

const EXTENSO = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
/** "Sete páginas" (feminino: é de página que se fala). Acima de dez, o número. */
export const paginasPorExtenso = (n: number) => {
  const t = n >= 0 && n <= 10 ? EXTENSO[n] : String(n);
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} ${n === 1 ? "página" : "páginas"}`;
};

/** "09" — o número da edição da revista é o do mês. */
export const numeroDaEdicao = (mesIdx: number) => String(mesIdx + 1).padStart(2, "0");

/**
 * A cor da página "Meu mês" na revista é a do dia da semana mais forte — a
 * mesma família do planner do Treino. A nota de rodapé explica ("Esta página
 * é índigo porque a sua terça foi"). Quinta é amarela: texto escuro.
 */
export const COR_DO_DIA_NA_REVISTA: Record<string, { cor: string; nome: string; artigo: "a" | "o"; clara: boolean }> = {
  SEGUNDA: { cor: "#2f6df6", nome: "azul", artigo: "a", clara: false },
  "TERÇA": { cor: "#4f46e5", nome: "índigo", artigo: "a", clara: false },
  QUARTA: { cor: "#15803d", nome: "verde", artigo: "a", clara: false },
  QUINTA: { cor: "#facc15", nome: "amarela", artigo: "a", clara: true },
  SEXTA: { cor: "#db2777", nome: "rosa", artigo: "a", clara: false },
  "SÁBADO": { cor: "#9333ea", nome: "roxa", artigo: "o", clara: false },
  DOMINGO: { cor: "#7c3aed", nome: "violeta", artigo: "o", clara: false },
};

/** A linha do rodapé da página "Meu mês" — sempre pelo lado bom, com dado real. */
export const linhaDoMeuMes = (r: RetroMes): string => {
  const mm = r.meuMes;
  if (!mm) return "Cada dia anotado conta.";
  if (mm.aMaisQueAnterior) return "Tá virando rotina de verdade.";
  const base = Math.max(1, r.base.dias);
  if (mm.diasAnotados / base >= 0.8) return "Quase todo dia no papel.";
  if (mm.diasAnotados / base >= 0.5) return "Mais da metade dos dias no papel.";
  if (mm.sequencia && mm.sequencia.dias >= 5) return `${mm.sequencia.dias} dias seguidos sem soltar a caneta.`;
  return "Cada dia anotado conta.";
};

/** "19 dias, quase todos que você anotou." — a proporção diz qual frase cabe. */
export const fraseDoHabito = (dias: number, diasAnotados: number) => {
  const p = diasAnotados > 0 ? dias / diasAnotados : 0;
  const d = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (p >= 0.8 && dias >= 3) return `${d}, quase todos que você anotou.`;
  if (p >= 0.5 && dias >= 3) return `${d}, mais da metade dos que você anotou.`;
  return `${d} no mês.`;
};

/** "de 26. Quase metade." — só o que o número sustenta. */
export const fraseDosDiasSemGasto = (livres: number, base: number) => {
  const p = base > 0 ? livres / base : 0;
  const de = `de ${base}.`;
  if (p >= 0.55) return `${de} Mais da metade.`;
  if (p >= 0.4) return `${de} Quase metade.`;
  return de;
};

/** "fechado em 30/09" — o mês fecha no último dia dele. */
export const fechadoEm = (r: Pick<RetroMes, "base" | "mesIdx">) =>
  `fechado em ${r.base.diasDoMes}/${String(r.mesIdx + 1).padStart(2, "0")}`;

/** "setembro" → "Setembro" (o nome do mês como título). */
export const tituloDoMes = (mesIdx: number) => MESES[mesIdx];

/** O rótulo de cada página nas abas do planner e no sumário da revista. */
export const ROTULO_DA_PAGINA: Record<string, string> = {
  "meu-mes": "Meu mês",
  dinheiro: "Dinheiro",
  corpo: "Corpo",
  humor: "Humor",
  card: "Card",
};
