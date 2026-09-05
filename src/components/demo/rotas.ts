/**
 * ROTAS DA DEMO — pra onde a demo devolve e como ela abre cada módulo.
 * Saiu do Preview.tsx em 05/09 pra o CTA e o coach serem testáveis sem
 * importar as 16 páginas de módulo. Lógica idêntica à que estava lá.
 */

/** A volta que o funil deixou marcada, se deixou (o W grava o caminho dele). */
export const voltaMarcada = (): string | null => {
  try { return sessionStorage.getItem("core-demo-volta"); } catch { return null; }
};

/** Volta da demo no shell: o funil que armou a demo deixa o endereço em
 *  core-demo-volta (funil W); sem ele, a porta clássica do /app. */
export const voltaDaDemoShell = (): string => {
  try { return sessionStorage.getItem("core-demo-volta") || "/app?step=compromissos"; } catch { return "/app?step=compromissos"; }
};

/** Funis de teste congelados (24/07): a demo é a MESMA página pros três, então
 *  eles carimbam `&from=` na URL e a volta devolve pro funil de origem. Sem
 *  isso a pessoa sai do /funil-radar e volta no /inicio, trocando de funil
 *  justo antes da tela de venda. Whitelist fechada — `from` desconhecido cai
 *  no comportamento normal. */
export const FUNIS_TESTE: Record<string, { path: string; volta: "signup" }> = {
  // 27/07: os TRÊS voltam em ?step=signup. O radar voltava em "plano" porque
  // tinha a tela SEU PLANO entre a demo e o cadastro — ela saiu quando o funil
  // do app foi alinhado ao esqueleto do dia 14 (ver ComecarRadar).
  // 31/08: o /inicio virou o funil W (Pix). O dia 14 continua vivo, mas agora
  // só em /funil-dia14 — quem entra na demo por ele tem que voltar pra lá, e
  // não cair no funil novo no meio do caminho.
  dia14: { path: "/funil-dia14", volta: "signup" },
  radar: { path: "/funil-radar", volta: "signup" },
  v1: { path: "/funil-v1", volta: "signup" },
};

/** Volta pro funil de teste preservando a trilha: ?porta=vida é o que faz o
 *  funil rodar em modo vitrine (fora do /inicio ele não sabe disso sozinho). */
export const voltaFunilTeste = (from: string, tour?: boolean): string | null => {
  const f = FUNIS_TESTE[from];
  if (!f) return null;
  return `${f.path}?step=${f.volta}${tour ? "&porta=vida" : ""}`;
};

/**
 * ABA CERTA DO MÓDULO DE METAS (05/09). O módulo de desenvolvimento abre em
 * SOBRE MIM (lista de motivações) a menos que a URL peça ?tab=metas — os
 * funis Comecar, V1, Radar e Dia14 carimbam isso quando a área é metas; o W
 * não carimba, e a demo de metas (a que mais perde gente: 23% saem) abria na
 * aba errada, sem o quadro de metas que o 1º passo do coach aponta.
 */
export const ABA_PADRAO_DA_DEMO: Record<string, string> = { desenvolvimento: "metas" };

/** Link de um módulo na barra do tour, já com a aba padrão quando o módulo tem uma. */
export const linkDoModuloDaDemo = (key: string, from?: string): string =>
  `/preview/${key}?funnel=1&tour=vida${from ? `&from=${from}` : ""}${ABA_PADRAO_DA_DEMO[key] ? `&tab=${ABA_PADRAO_DA_DEMO[key]}` : ""}`;

/** A busca (query string) normalizada com a aba padrão — ou null se nada muda. */
export const abaPadraoDaDemo = (key: string, search: string): string | null => {
  const aba = ABA_PADRAO_DA_DEMO[key];
  if (!aba) return null;
  const p = new URLSearchParams(search);
  if (p.has("tab")) return null;
  p.set("tab", aba);
  return p.toString();
};
