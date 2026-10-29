/**
 * OCULTAR ABAS — a regra pura (1.0.22, dono 28/10: "muita gente achou completo mas confuso"; 2 chamados pedindo pra
 * ocultar abas que não usam). O hook (hooks/use-abas-ocultas) e a fileira (components/ui/abas-ocultaveis) usam isto.
 *
 * GUARDADO NA CONTA (sobe pro user_data; vale no iPhone, no Android e no site; sobrevive a reabrir e a trocar de aparelho):
 *   · `abas-ocultas:<modulo>` = string[] — os ids OCULTOS. É a chave que a Rotina e o Metas já usam desde 07/09, no MESMO
 *     formato: quem já ocultou alguma aba ali continua com ela oculta, e o app antigo (que lê essa chave) vê o mesmo.
 *     Guardar só as ocultas (e nunca as visíveis) faz uma aba nova que a gente lançar aparecer sozinha pra todo mundo.
 *   · `abas-ordem:<modulo>` = string[] — a ordem escolhida em "Organizar abas" (chave NOVA; ausente = a ordem do app).
 *   Nenhuma das duas começa com "core-" (as vassouras do cache não as tocam) e o prefixo "abas-" fica fora da ativação
 *   (use-user-data) e da sequência (lib/sequencia): ocultar "financas" não pode virar "first_transaction".
 *
 * Regras duras: a última aba visível nunca some; ocultar não apaga dado nenhum; a aba volta quando religa; um link que
 * abre direto numa aba oculta abre mesmo assim (a fileira mostra ela enquanto estiver aberta); com o tutorial (holofote)
 * aberto todas aparecem, porque ele aponta pras abas pelo `data-spotlight`.
 */
import { ABAS_ENXUTAS, ABAS_POUCO_USO, ABAS_QUE_NUNCA_SAEM } from "@/lib/abas-enxutas";

export const chaveAbasOcultas = (moduloId: string) => `abas-ocultas:${moduloId}`;
export const chaveOrdemDasAbas = (moduloId: string) => `abas-ordem:${moduloId}`;

/** Valor gravado → lista de ids. `null` = nada gravado (pode valer o padrão enxuto); lixo = [] (mostra tudo). */
export function lerListaDeIds(v: unknown): string[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** A ordem efetiva: a gravada (só ids que existem) com as abas novas entrando logo depois da vizinha de antes. */
export function ordenarAbas<T extends { id: string }>(abas: readonly T[], ordem: readonly string[] | null): T[] {
  if (!ordem || ordem.length === 0) return [...abas];
  const porId = new Map(abas.map((a) => [a.id, a]));
  const saida: T[] = [];
  const vistas = new Set<string>();
  for (const id of ordem) {
    const a = porId.get(id);
    if (a && !vistas.has(id)) { saida.push(a); vistas.add(id); }
  }
  abas.forEach((a, i) => {
    if (vistas.has(a.id)) return;
    // aba que não estava na ordem gravada (nova, ou condicional como o KIT de Finanças): logo depois da vizinha
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = saida.findIndex((s) => s.id === abas[j].id);
      if (k >= 0) { pos = k + 1; break; }
    }
    saida.splice(pos, 0, a);
    vistas.add(a.id);
  });
  return saida;
}

/** O padrão enxuto do módulo (só ids que existem e que podem sair). */
export function padraoEnxuto(moduloId: string, ids: readonly string[]): string[] {
  const nunca = new Set(ABAS_QUE_NUNCA_SAEM[moduloId] ?? []);
  return (ABAS_POUCO_USO[moduloId] ?? []).filter((id) => ids.includes(id) && !nunca.has(id));
}

/**
 * As ocultas que valem agora: a gravada; sem nada gravado, o padrão enxuto (se vale pra esta conta). Nunca todas:
 * se a lista esconderia tudo, a 1ª aba fica.
 */
export function ocultasEfetivas(p: { ids: readonly string[]; gravada: string[] | null; enxuta: boolean; moduloId: string }): string[] {
  const base = p.gravada ?? (p.enxuta ? padraoEnxuto(p.moduloId, p.ids) : []);
  const validas = base.filter((id) => p.ids.includes(id));
  if (p.ids.length > 0 && validas.length >= p.ids.length) return validas.filter((id) => id !== p.ids[0]);
  return validas;
}

/** Mover uma aba uma casa (−1 pra frente, +1 pra trás) — devolve a nova ordem completa, ou null se não dá. */
export function moverNaOrdem(ids: readonly string[], id: string, delta: -1 | 1): string[] | null {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const nova = [...ids];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

/* ------------------------------------------------------------------ chave ABAS_ENXUTAS (+ força de QA) */

/** Força de QA neste aparelho/navegador: `?abas-enxutas=on|off` grava, `auto` desfaz. Fora dos prefixos varridos. */
export const CHAVE_FORCA_ABAS_ENXUTAS = "forcar-abas-enxutas";
export const PARAM_ABAS_ENXUTAS = "abas-enxutas";

export function guardarForcaAbasEnxutas(busca?: string): void {
  try {
    const v = (new URLSearchParams(busca ?? window.location.search).get(PARAM_ABAS_ENXUTAS) ?? "").toLowerCase();
    if (v === "on" || v === "off") localStorage.setItem(CHAVE_FORCA_ABAS_ENXUTAS, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA_ABAS_ENXUTAS);
  } catch { /* sem storage: vale a chave */ }
}

let forcaLida = false;
export function abasEnxutasLigada(): boolean {
  // a força da URL vale a partir da 1ª leitura desta abertura (o link de QA pode cair em qualquer rota)
  if (!forcaLida) { forcaLida = true; if (typeof window !== "undefined") guardarForcaAbasEnxutas(); }
  try {
    const f = localStorage.getItem(CHAVE_FORCA_ABAS_ENXUTAS);
    if (f === "on") return true;
    if (f === "off") return false;
  } catch { /* segue */ }
  return ABAS_ENXUTAS;
}

/* ------------------------------------------------------------------ tutorial aberto = todas as abas */

let seguras = 0;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

/** O holofote (SpotlightOverlay) segura enquanto está aberto; devolve o "soltar". */
export function segurarTodasAsAbas(): () => void {
  seguras += 1;
  avisar();
  let solto = false;
  return () => { if (solto) return; solto = true; seguras = Math.max(0, seguras - 1); avisar(); };
}
export const todasAsAbasSeguras = (): boolean => seguras > 0;
export const ouvirTodasAsAbas = (f: () => void): (() => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
/** Só testes. */
export const _zerarTodasAsAbas = (): void => { seguras = 0; avisar(); };
