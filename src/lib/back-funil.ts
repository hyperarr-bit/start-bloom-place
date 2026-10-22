/**
 * BACK DOS FUNIS WEB (21/10, pedido do dono: "um Back pro nosso funil, no mesmo estilo do que era no app de iOS,
 * SEM MUDAR O PREÇO, só aparecer ele").
 *
 * Quem aperta VOLTAR (botão/gesto do navegador, inclusive no navegador do Instagram/Facebook) na OFERTA ou no PIX
 * GERADO ganha UMA tela (BackFolha) com a MESMA oferta (vitalício R$ 27,90) ou o MESMO Pix, em vez de sair.
 *
 * Mecânica (um "degrau" no histórico):
 *   · a etapa que segura o voltar se registra (useSegurarVoltar); se ainda não foi usada nesta sessão, entra UM
 *     pushState com a marca `coreBack` (mesma URL, mesmo estado do react-router + a marca);
 *   · o voltar consome o degrau → popstate → a etapa da vez mostra o back e fica marcada (1x por sessão por etapa);
 *   · o PRÓXIMO voltar não acha degrau e sai de verdade — ninguém fica preso em laço;
 *   · degrau sobrando sem etapa pra mostrar (a pessoa já saiu da oferta por dentro da página): o voltar que o
 *     consumiu é repassado (history.back()), então vale como UM voltar normal;
 *   · as telas do quiz não se registram: o voltar entre elas fica como sempre foi;
 *   · nada de beforeunload nem popup.
 *
 * Chave: BACK_FUNIL (padrão DESLIGADA). QA: `?back=on` (fica na sessão da aba) / `?back=off`.
 * Copy: BACK_COPY ("sorteio" 50/50 por aparelho, ou fixa "a"/"b"); QA `?backv=a|b`.
 * Eventos: back_view / back_ficou {acao} / back_saiu {via} — todos com {funil, etapa, variante}.
 * Rollback: BACK_FUNIL = false (é o padrão). O app da loja nunca liga (isNativeShell).
 */
import { useEffect, useRef } from "react";
import { isNativeShell } from "@/lib/native-shell";

/** A CHAVE. false = os funis ficam byte a byte como antes. */
export const BACK_FUNIL = false;

/** Qual texto: "sorteio" (50/50, guardado no aparelho) ou fixa. */
export const BACK_COPY: "sorteio" | "a" | "b" = "sorteio";

export type FunilDoBack = "inicio" | "hoje";
export type EtapaDoBack = "oferta" | "pix";
export type VarianteDoBack = "a" | "b";

const CHAVE_QA = "core-back-qa";
const CHAVE_QA_V = "core-back-qa-v";
const CHAVE_VARIANTE = "core-back-variante";
const CHAVE_USADOS = "core-back-usados";
const MARCA = "coreBack";

const lerParam = (nome: string): string | null => {
  try { return new URLSearchParams(window.location.search).get(nome); } catch { return null; }
};

/** Ligado nesta aba? `?back=on|off` vence a chave e fica guardado na sessão (o funil troca de URL no caminho). */
export function backLigado(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeShell()) return false;
  const p = lerParam("back");
  let qa: string | null = null;
  try {
    if (p === "on") sessionStorage.setItem(CHAVE_QA, "1");
    else if (p === "off") sessionStorage.setItem(CHAVE_QA, "0");
    qa = sessionStorage.getItem(CHAVE_QA);
  } catch {
    qa = p === "on" ? "1" : p === "off" ? "0" : null;
  }
  if (qa === "1") return true;
  if (qa === "0") return false;
  return BACK_FUNIL;
}

let varianteMemoria: VarianteDoBack | null = null;
/** A copy desta pessoa — congelada (sessão do QA > chave fixa > sorteio guardado no aparelho). */
export function varianteDoBack(): VarianteDoBack {
  const p = lerParam("backv");
  try {
    if (p === "a" || p === "b") sessionStorage.setItem(CHAVE_QA_V, p);
    const qa = sessionStorage.getItem(CHAVE_QA_V);
    if (qa === "a" || qa === "b") return qa;
  } catch { if (p === "a" || p === "b") return p; }
  if (BACK_COPY !== "sorteio") return BACK_COPY;
  if (varianteMemoria) return varianteMemoria;
  try {
    const v = localStorage.getItem(CHAVE_VARIANTE);
    if (v === "a" || v === "b") return (varianteMemoria = v);
  } catch { /* noop */ }
  varianteMemoria = Math.random() < 0.5 ? "a" : "b";
  try { localStorage.setItem(CHAVE_VARIANTE, varianteMemoria); } catch { /* noop */ }
  return varianteMemoria;
}

/* ── 1x por sessão por etapa ── */
let usadosMemoria: Set<string> | null = null;
const usados = (): Set<string> => {
  if (usadosMemoria) return usadosMemoria;
  try { usadosMemoria = new Set(JSON.parse(sessionStorage.getItem(CHAVE_USADOS) || "[]") as string[]); }
  catch { usadosMemoria = new Set(); }
  return usadosMemoria;
};
export const chaveDoBack = (funil: FunilDoBack, etapa: EtapaDoBack) => `${funil}:${etapa}`;
export const backJaUsado = (chave: string): boolean => usados().has(chave);
function marcarUsado(chave: string): void {
  const u = usados();
  u.add(chave);
  try { sessionStorage.setItem(CHAVE_USADOS, JSON.stringify([...u])); } catch { /* fica a memória */ }
}

/* ── o degrau ── */
type Guarda = { id: number; chave: string; aoVoltar: () => void };
let guardas: Guarda[] = [];
let proximoId = 1;
let token: string | null = null;
let degrauNoTopo = false;
let ouvindo = false;

const naMarca = (): boolean => {
  try { return !!token && (window.history.state as Record<string, unknown> | null)?.[MARCA] === token; } catch { return false; }
};
/** A etapa que responde ao próximo voltar: a registrada por último que ainda não usou o back. */
const guardaDaVez = (): Guarda | undefined => {
  for (let i = guardas.length - 1; i >= 0; i--) if (!backJaUsado(guardas[i].chave)) return guardas[i];
  return undefined;
};

function empilhar(): void {
  if (degrauNoTopo || !guardaDaVez()) return;
  try {
    token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const atual = (window.history.state ?? {}) as Record<string, unknown>;
    window.history.pushState({ ...atual, [MARCA]: token }, "");
    degrauNoTopo = true;
  } catch { /* navegador negou: o voltar fica como sempre */ }
}

function aoPop(): void {
  if (naMarca()) { degrauNoTopo = true; return; } // voltou de uma página acima pro degrau: ele está de pé de novo
  if (!degrauNoTopo) return; // não é com a gente
  degrauNoTopo = false;
  const g = guardaDaVez();
  if (!g) { window.history.back(); return; } // degrau sem etapa: repassa — vale como um voltar normal
  marcarUsado(g.chave);
  g.aoVoltar();
  empilhar(); // outra etapa ainda com back guardado (raro) ganha o degrau dela
}

function ouvir(): void {
  if (ouvindo) return;
  ouvindo = true;
  window.addEventListener("popstate", aoPop);
}

/** Registra uma etapa. Devolve o "desregistrar". */
export function segurarVoltar(chave: string, aoVoltar: () => void): () => void {
  const g: Guarda = { id: proximoId++, chave, aoVoltar };
  guardas.push(g);
  ouvir();
  empilhar();
  return () => {
    guardas = guardas.filter((x) => x.id !== g.id);
    // saiu por navegação (o react-router empilhou/trocou por cima): o degrau não está mais no topo
    if (degrauNoTopo && !naMarca()) degrauNoTopo = false;
  };
}

/** "Sair mesmo assim": faz o voltar que a pessoa pediu. */
export function sairDeVerdade(): void {
  try { window.history.back(); } catch { /* noop */ }
}

/**
 * A etapa segura o voltar enquanto `ativo` (e a chave ligada, e o back desta etapa ainda não usado na sessão).
 * `aoVoltar` abre a BackFolha.
 */
export function useSegurarVoltar(funil: FunilDoBack, etapa: EtapaDoBack, ativo: boolean, aoVoltar: () => void): void {
  const ref = useRef(aoVoltar);
  ref.current = aoVoltar;
  const chave = chaveDoBack(funil, etapa);
  const ligado = ativo && backLigado();
  useEffect(() => {
    if (!ligado || backJaUsado(chave)) return;
    return segurarVoltar(chave, () => ref.current());
  }, [ligado, chave]);
}

/** Só testes. */
export function _zerarBack(): void {
  if (ouvindo) window.removeEventListener("popstate", aoPop);
  ouvindo = false;
  guardas = [];
  token = null;
  degrauNoTopo = false;
  usadosMemoria = null;
  varianteMemoria = null;
}
