import { idDoAparelho } from "@/lib/dia1-cheio";
import { isIOS, isNativeShell } from "@/lib/native-shell";

/**
 * FLUXO ENXUTO (1.0.21, dono 27/10): "Tira o montar finanças e todos os tutorial, talvez deixa só o da home. Aí a tela
 * pós compra é uma tela nova bonita estilo BitePal parabenizando, aí depois o usuário já entra na home." + adendo:
 * "Vamos tirar o tutorial, dicas de uso e etc." + "Liga pra todo mundo e o montar rotinas sai também".
 *
 * Por quê (turmas separadas pela versão do app): até a 1.0.13 (sem tutorial) ~23% dos testes pagaram; 1.0.14–1.0.15
 * (tour da Home + cartões) ~18%; 1.0.16–1.0.17 (tutorial em todo módulo) ~14%. A regra antiga "nenhum módulo abre pela
 * 1ª vez sem tutorial" (17/10) foi REVOGADA pelo dono em 27/10.
 *
 * COM O ENXUTO LIGADO (cada peça pergunta `fluxoEnxutoLigado()`):
 *   · sem "Vamos montar suas Finanças" e sem "Rotina pronta em 3 toques" (montarFinancasLigado/montarRotinaLigado = não);
 *   · sem tutorial na 1ª abertura de módulo (intro guiada/1 toque, cartões, ModuleTip/DicasDaBeleza, holofote antigo,
 *     QuickStart) e sem dicas de uso ("Conhecer mais"/lâmpada, "Mais dicas do módulo", a Dica do dia da missão);
 *   · sem o tour da Home antiga; na Home nova fica SÓ a dica do "+" (`home_dica_mais`);
 *   · pós-compra do iPhone: cadastro → TelaParabens → Home (sem BoasVindasPago e sem o "Tá dentro!" da missão);
 *   · a missão de 3 dias continua, leve: cada dose aponta a ação direto no módulo;
 *   · conquistas com CALMA nos 3 primeiros dias da conta (lib/festas-calma).
 * DESLIGADO ("off") = o app da 1.0.20, byte a byte.
 *
 * CHAVE REMOTA `fluxo_enxuto` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `card_recusa` / `home_nova`:
 *   · "on"  → enxuto pra todo mundo;
 *   · "off" → o fluxo de hoje (rollback);
 *   · "ab"  → 50/50 pelo id do aparelho (FNV-1a, sal próprio "fluxo-enxuto:"), sorteado 1x e gravado;
 *   · ausente/estranho → nada muda (vale o guardado no aparelho, senão o PADRÃO).
 * PADRÃO: app do iPhone = "on" (dono 27/10, "liga pra todo mundo"); site e Android = "off". A metadata das offerings é
 * a mesma pras duas lojas, então a chave remota SÓ vale no iPhone — no Android e no site o enxuto só liga pela força de QA.
 * A última resposta válida fica no aparelho (`core-fluxo-enxuto`), o braço do "ab" em `core-fluxo-enxuto-braco`.
 * QA: `?fluxo-enxuto=on|off|ab|auto` grava uma força neste aparelho/navegador (`fluxo-enxuto-force`, fora dos prefixos
 * varridos); "auto" desfaz.
 * Eventos: com o modo diferente de "off", TODO evento leva `fluxo_enxuto: "enxuto" | "atual"` (lib/analytics).
 */
export type ModoFluxoEnxuto = "on" | "off" | "ab";
export type BracoFluxoEnxuto = "enxuto" | "atual";

/** ROLLBACK sem RevenueCat = trocar aqui + build. */
export const FLUXO_ENXUTO_APP: ModoFluxoEnxuto = "on";
export const FLUXO_ENXUTO_WEB: ModoFluxoEnxuto = "off";
export const CHAVE_REMOTA_FLUXO_ENXUTO = "fluxo_enxuto";
export const CHAVE_FLUXO_ENXUTO_APARELHO = "core-fluxo-enxuto";
export const CHAVE_BRACO_FLUXO_ENXUTO = "core-fluxo-enxuto-braco";
export const CHAVE_FORCA_FLUXO_ENXUTO = "fluxo-enxuto-force";
export const PARAM_FLUXO_ENXUTO = "fluxo-enxuto";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoFluxoEnxuto | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "off" || t === "ab" ? t : null;
};
const bracoDe = (v: unknown): BracoFluxoEnxuto | null => (v === "enxuto" || v === "atual" ? v : null);

/** A chave remota vale AQUI? Só no app do iPhone (a metadata é a mesma pras duas lojas). */
const remotaValeAqui = (): boolean => { try { return isNativeShell() && isIOS(); } catch { return false; } };
/** O padrão do iPhone. Os testes antigos (escritos pro fluxo de hoje) rodam com `__FLUXO_ENXUTO_PADRAO_APP__ = "off"`
 *  (src/test/setup.ts); os do enxuto apagam o global pra ver o padrão de verdade ("on"). */
const padraoDoApp = (): ModoFluxoEnxuto =>
  modoDe((globalThis as { __FLUXO_ENXUTO_PADRAO_APP__?: unknown }).__FLUXO_ENXUTO_PADRAO_APP__) ?? FLUXO_ENXUTO_APP;
export const padraoFluxoEnxuto = (): ModoFluxoEnxuto => (remotaValeAqui() ? padraoDoApp() : FLUXO_ENXUTO_WEB);

/** Em memória: o que o getOfferings DESTA abertura disse. */
let remoto: ModoFluxoEnxuto | undefined;

/** Decisão pura: o valor explícito em qualquer offering (a `current` vence); nenhum = null. */
export function lerFluxoEnxutoRemoto(offerings: unknown): ModoFluxoEnxuto | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoFluxoEnxuto | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_FLUXO_ENXUTO]) ?? lido;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_FLUXO_ENXUTO]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu. Só um valor válido muda algo (memória + aparelho). */
export function registrarFluxoEnxutoRemoto(offerings: unknown): void {
  try {
    if (!remotaValeAqui() || !offerings || typeof offerings !== "object") return;
    const lido = lerFluxoEnxutoRemoto(offerings);
    if (!lido) return;
    remoto = lido;
    ls.set(CHAVE_FLUXO_ENXUTO_APARELHO, lido);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarFluxoEnxuto = (): void => { remoto = undefined; };

/** Grava `?fluxo-enxuto=on|off|ab|auto` deste aparelho. */
export function guardarForcaFluxoEnxuto(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_FLUXO_ENXUTO);
  } catch { return; }
  if (v === null) return;
  const t = v.trim().toLowerCase();
  if (t === "auto") ls.del(CHAVE_FORCA_FLUXO_ENXUTO);
  else if (modoDe(t)) ls.set(CHAVE_FORCA_FLUXO_ENXUTO, t);
}

/** O modo AQUI: força de QA > RevenueCat desta abertura (iPhone) > última resposta do aparelho (iPhone) > padrão. */
export function modoFluxoEnxuto(): ModoFluxoEnxuto {
  const f = modoDe(ls.get(CHAVE_FORCA_FLUXO_ENXUTO));
  if (f) return f;
  if (!remotaValeAqui()) return FLUXO_ENXUTO_WEB;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_FLUXO_ENXUTO_APARELHO)) ?? padraoDoApp();
}

/** Sorteio 50/50 determinístico pelo id (FNV-1a 32 bits, sal próprio — não compartilha braço com a Home nova nem o sino). */
export function sortearBracoFluxoEnxuto(id: string): BracoFluxoEnxuto {
  let h = 0x811c9dc5;
  const s = `fluxo-enxuto:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "enxuto" : "atual";
}

/** O braço deste aparelho no "ab" (sorteado 1x e gravado — estável entre aberturas). */
export function bracoFluxoEnxuto(): BracoFluxoEnxuto {
  const gravado = bracoDe(ls.get(CHAVE_BRACO_FLUXO_ENXUTO));
  if (gravado) return gravado;
  const sorteado = sortearBracoFluxoEnxuto(idDoAparelho());
  ls.set(CHAVE_BRACO_FLUXO_ENXUTO, sorteado);
  return sorteado;
}

/** O enxuto está ligado AQUI? */
export function fluxoEnxutoLigado(): boolean {
  try {
    const m = modoFluxoEnxuto();
    if (m === "off") return false;
    if (m === "on") return true;
    return bracoFluxoEnxuto() === "enxuto";
  } catch { return false; }
}

/** Os campos dos eventos: com o modo diferente de "off", qual fluxo a pessoa vê. "off" = nada (eventos idênticos). */
export function camposFluxoEnxuto(): { fluxo_enxuto?: BracoFluxoEnxuto } {
  try {
    if (modoFluxoEnxuto() === "off") return {};
    return { fluxo_enxuto: fluxoEnxutoLigado() ? "enxuto" : "atual" };
  } catch { return {}; }
}
