/**
 * QUANDO O ATT É PEDIDO — chave remota `att_momento` (1.0.18, dono 21/10: "testar, não decidir").
 *
 * O dado (raio-X do funil de 21/10): o diálogo do rastreamento caía sozinho 3 s depois de abrir a welcome, em cima
 * do vídeo; 173 instalações (7,6 %) fechavam o app em 3 s, 66 delas com o diálogo aberto, e 28 % ficavam com
 * `notDetermined` pra sempre (isso último foi consertado em lib/att-ios, e vale nos dois braços).
 *
 * A metadata `att_momento` em QUALQUER offering do RevenueCat (a `current` vence), lida no mesmo padrão de
 * `missao_1_por_dia` / `tour_home_quando` (lib/dia1-cheio):
 *   · "auto3s"  (ou ausente, ou RevenueCat sem resposta) → o de hoje: o pedido 3 s depois da welcome;
 *   · "comecar"                                           → só no toque em "Começar" (quem entra por outro caminho,
 *                                                           "Entrar"/gate, é perguntado na Home, que já pedia);
 *   · "ab"                                                → 50/50 pelo id do aparelho, sorteado 1x e gravado
 *                                                           (`core-att-braco`): estável entre aberturas.
 * A última resposta do RevenueCat fica no aparelho (`core-att-momento`): a welcome monta antes do getOfferings
 * da abertura responder. Todo `att_pedido` / `att_resposta` e os `app_welcome_*` levam `att_braco`
 * ("auto3s" | "comecar" — o que valeu pra essa pessoa) e `att_momento` (o modo remoto).
 */
import { idDoAparelho } from "@/lib/dia1-cheio";

export type ModoAttMomento = "auto3s" | "comecar" | "ab";
export type BracoATT = "auto3s" | "comecar";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_ATT_MOMENTO = "att_momento";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho). */
export const CHAVE_ATT_MOMENTO_APARELHO = "core-att-momento";
/** O braço sorteado no modo "ab" (chave do aparelho: estável entre aberturas e ao logout). */
export const CHAVE_BRACO_ATT = "core-att-braco";
/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let remoto: ModoAttMomento | undefined;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
};

const modoDe = (v: unknown): ModoAttMomento | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "auto3s" || t === "comecar" || t === "ab" ? t : null;
};
const bracoDe = (v: unknown): BracoATT | null => (v === "auto3s" || v === "comecar" ? v : null);

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente/estranha em todas = "auto3s" (o de hoje). */
export function lerAttMomentoRemoto(offerings: unknown): ModoAttMomento {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoAttMomento | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_ATT_MOMENTO]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_ATT_MOMENTO]) ?? lido;
  return lido ?? "auto3s";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu. */
export function registrarAttMomentoRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return; // não respondeu de verdade: fica como estava
    remoto = lerAttMomentoRemoto(offerings);
    ls.set(CHAVE_ATT_MOMENTO_APARELHO, remoto);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarAttMomentoRemoto = (): void => { remoto = undefined; };

/** O modo que vale AQUI: o que o RevenueCat disse nesta abertura, senão a última resposta do aparelho, senão "auto3s". */
export function modoAttMomento(): ModoAttMomento {
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_ATT_MOMENTO_APARELHO)) ?? "auto3s";
}

/**
 * Sorteio 50/50 determinístico pelo id do aparelho (FNV-1a 32 bits, como o `sortearBraco` do dia 1) — mas decidido
 * pelo bit 16, não pela paridade: a paridade do FNV é só "quantos caracteres ímpares", e um sal apenas a inverte —
 * o braço do ATT sairia SEMPRE o lado oposto do braço do dia 1 do mesmo aparelho (os dois testes se contaminariam).
 * Conferido: 2.000 ids → 50/50 e ~50 % de coincidência com o lado do dia 1 (independente).
 */
export function sortearBracoATT(id: string): BracoATT {
  let h = 0x811c9dc5;
  const s = `att:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "auto3s" : "comecar";
}

/**
 * O braço desta pessoa: "auto3s" / "comecar" direto nos modos fixos; no "ab", o gravado ou o sorteio pelo id do
 * aparelho, gravado em `core-att-braco` na 1ª vez (estável entre aberturas e ao logout).
 */
export function bracoATT(): BracoATT {
  const modo = modoAttMomento();
  if (modo !== "ab") return modo;
  const gravado = bracoDe(ls.get(CHAVE_BRACO_ATT));
  if (gravado) return gravado;
  const sorteado = sortearBracoATT(idDoAparelho());
  ls.set(CHAVE_BRACO_ATT, sorteado);
  return sorteado;
}

/** Os campos que vão em todo evento do ATT e da welcome. Nunca lança. */
export function camposDoATT(): { att_braco: BracoATT; att_momento: ModoAttMomento } {
  try { return { att_braco: bracoATT(), att_momento: modoAttMomento() }; } catch { return { att_braco: "auto3s", att_momento: "auto3s" }; }
}
