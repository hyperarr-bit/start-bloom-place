import { modo1012 } from "@/lib/modo-1012";
/**
 * PEDIDO DE AVALIAÇÃO PRA QUEM ESTÁ NO TESTE E VOLTOU NO DIA 2 — iPhone (1.0.18, dono 22/10).
 *
 * A regra de 23/09 (só quem PAGOU e voltou) limpou as notas, mas o volume caiu de ~2,1/dia pra ~0,37/dia
 * (47 avaliações no iPhone, nota 4,6). A mudança aprovada: pedir também pra quem está no TESTE GRÁTIS, com
 * a renovação LIGADA, e VOLTOU num dia BRT diferente do da compra do teste (≥ 20 h depois) — no MESMO
 * momento de valor de sempre (lib/avaliacao → `pedirAvaliacaoTesteDia2`, chamado pelo ConviteDeValor).
 *
 * CHAVE REMOTA `avaliacao_teste_dia2` ("on" | "off") na metadata de QUALQUER offering do RevenueCat (a
 * `current` vence), no padrão de `card_recusa` / `dias23`:
 *   · "off" (ou ausente, ou RevenueCat que nunca respondeu) → a regra de 23/09, byte a byte;
 *   · "on" → o teste no dia 2 também é pedido.
 * A última resposta fica no aparelho (`core-avaliacao-teste-dia2`, chave do aparelho).
 * QA: `?avaliacao-teste-dia2=on|off|auto` (guarda em `avaliacao-teste-dia2-force`; "auto" desfaz).
 */

export type ModoAvaliacaoTesteDia2 = "off" | "on";
/** O padrão quando ninguém disse nada. ROLLBACK = "off" (ou a chave "off" na metadata). */
export const AVALIACAO_TESTE_DIA2: ModoAvaliacaoTesteDia2 = "off";
export const CHAVE_REMOTA_AVALIACAO_TESTE_DIA2 = "avaliacao_teste_dia2";
export const CHAVE_AVALIACAO_TESTE_DIA2_APARELHO = "core-avaliacao-teste-dia2";
export const PARAM_AVALIACAO_TESTE_DIA2 = "avaliacao-teste-dia2";
export const CHAVE_FORCA_AVALIACAO_TESTE_DIA2 = "avaliacao-teste-dia2-force";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoAvaliacaoTesteDia2 | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "off" ? t : null;
};

/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let remoto: ModoAvaliacaoTesteDia2 | undefined;

/** Decisão pura: a chave em qualquer offering (a `current` vence); null = nenhuma offering disse. */
export function lerAvaliacaoTesteDia2Remoto(offerings: unknown): ModoAvaliacaoTesteDia2 | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoAvaliacaoTesteDia2 | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_AVALIACAO_TESTE_DIA2]) ?? lido;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_AVALIACAO_TESTE_DIA2]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarAvaliacaoTesteDia2Remoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerAvaliacaoTesteDia2Remoto(offerings);
    // a chave sumiu da metadata = volta pro padrão (off), e a cópia do aparelho também
    remoto = lido ?? AVALIACAO_TESTE_DIA2;
    if (lido) ls.set(CHAVE_AVALIACAO_TESTE_DIA2_APARELHO, lido);
    else ls.del(CHAVE_AVALIACAO_TESTE_DIA2_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarAvaliacaoTesteDia2Remoto = (): void => { remoto = undefined; };

/** Guarda `?avaliacao-teste-dia2=` (on|off grava a força; auto desfaz). */
export function guardarForcaAvaliacaoTesteDia2(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = (p.get(PARAM_AVALIACAO_TESTE_DIA2) ?? "").toLowerCase();
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_AVALIACAO_TESTE_DIA2, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_AVALIACAO_TESTE_DIA2);
}

/** O modo AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > constante (off). */
export function modoAvaliacaoTesteDia2(): ModoAvaliacaoTesteDia2 {
  if (modo1012()) return "off"; // 1.0.21 modo 1.0.12: sem a avaliação no dia 2 do teste
  const f = modoDe(ls.get(CHAVE_FORCA_AVALIACAO_TESTE_DIA2));
  if (f) return f;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_AVALIACAO_TESTE_DIA2_APARELHO)) ?? AVALIACAO_TESTE_DIA2;
}
export const avaliacaoTesteDia2Ligada = (): boolean => modoAvaliacaoTesteDia2() === "on";
