import { idDoAparelho } from "@/lib/dia1-cheio";
import { isIOS, isNativeShell } from "@/lib/native-shell";

/**
 * ABAS "CADERNO" COM SUMÁRIO — as chaves (07/11, novidades-guardadas/2026-11-07/trial-abas/SPEC.md §5.3).
 *
 * Por quê: o estudo de 07/11 (DECISAO.md) não achou evidência de que mudar abas muda "pagou" (grau D pra tudo aqui).
 * O pacote quer NÃO PIORAR, deixar a fileira caber na tela (hoje corta em 8 de 16 módulos a 390 px) e deixar pronto o
 * sorteio que pode responder de verdade. Só a CONTA NOVA (marcador de origem "nova", como o padrão enxuto) muda; a
 * conta antiga e quem já paga continuam com a fileira de hoje.
 *
 * TRÊS CHAVES REMOTAS na metadata de QUALQUER offering do RevenueCat (a `current` vence), no molde da `fluxo_enxuto`.
 * A metadata é a mesma pras duas lojas, então elas SÓ valem no app do iPhone; site e Android ficam como estão (a não
 * ser pela força de QA por URL):
 *   · `abas_enxutas`: "on" (padrão) = braço HOJE pra todos (o enxuto de hoje, "Ver todas" grava) · "off" = braço TODAS
 *     (todas as abas, como na 1.0.21) · "sumario" = braço SUMÁRIO (a porta abre um índice que não grava) · "ab" =
 *     sorteio hoje × todas · "ac" = hoje × sumário · "abc" = os 3;
 *   · `abas_visual`: "hoje" (padrão) = a fileira de hoje · "fixa" = plano B (pílula de hoje, porta presa à direita,
 *     esmaecido na borda) · "caderno" = divisórias calmas em 2 linhas, faixa de 4 px na cor do módulo;
 *   · `abas_medicao`: "off" (padrão) · "on" = os consertos da medição (§8.1: `first_transaction` falso das chaves
 *     *-last-seen-*, `uso_modulo` 1x por chave por dia, `aba_aberta` com a origem, `origem` nos eventos da fileira).
 *     Qualquer uma das outras duas fora do padrão também liga a medição (o sorteio nunca roda sem ela).
 *
 * CHAVE DESLIGADA = as três no padrão = o app do main, byte a byte (src/test/abas-caderno-identico.test.tsx cobra).
 * Rollback sem build: `abas_visual` → "hoje" e `abas_enxutas` → "on".
 *
 * Sorteio: 1x por aparelho (FNV-1a do id do aparelho, sal próprio "abas-enxutas:" — não divide braço com a
 * fluxo_enxuto nem com a Home nova), gravado em `core-abas-braco` como "<modo>:<braço>" (estável entre aberturas).
 *
 * QA por URL (grava neste aparelho/navegador, fora dos prefixos varridos; `auto` desfaz):
 *   `?abas-braco=hoje|todas|sumario|auto` · `?abas-visual=hoje|fixa|caderno|auto` · `?abas-medicao=on|off|auto`.
 *   O `?abas-enxutas=on|off|auto` de antes (lib/abas-ocultas) continua valendo e VENCE o braço.
 * Eventos: fora do padrão, TODO evento leva `abas_braco` e `abas_visual` (lib/analytics).
 */
export type ModoAbas = "on" | "off" | "sumario" | "ab" | "ac" | "abc";
export type BracoAbas = "hoje" | "todas" | "sumario";
export type VisualAbas = "hoje" | "fixa" | "caderno";
export type MedicaoAbas = "on" | "off";

/** Os padrões (chave ausente). Trocar aqui = build. */
export const ABAS_MODO_PADRAO: ModoAbas = "on";
export const ABAS_VISUAL_PADRAO: VisualAbas = "hoje";
export const ABAS_MEDICAO_PADRAO: MedicaoAbas = "off";

export const CHAVE_REMOTA_ABAS_MODO = "abas_enxutas";
export const CHAVE_REMOTA_ABAS_VISUAL = "abas_visual";
export const CHAVE_REMOTA_ABAS_MEDICAO = "abas_medicao";

/** No aparelho (prefixo core-: estão em lib/chaves-do-aparelho, as vassouras não levam). */
export const CHAVE_ABAS_MODO_APARELHO = "core-abas-enxutas";
export const CHAVE_ABAS_VISUAL_APARELHO = "core-abas-visual";
export const CHAVE_ABAS_MEDICAO_APARELHO = "core-abas-medicao";
export const CHAVE_ABAS_BRACO = "core-abas-braco";
/** `uso_modulo` 1x por chave por dia (com a medição ligada): { dia, chaves } do dia de hoje. */
export const CHAVE_USO_MODULO_DIA = "core-uso-modulo-dia";

/** Forças de QA (fora dos prefixos varridos, como `forcar-abas-enxutas`). */
export const CHAVE_FORCA_ABAS_BRACO = "forcar-abas-braco";
export const CHAVE_FORCA_ABAS_VISUAL = "forcar-abas-visual";
export const CHAVE_FORCA_ABAS_MEDICAO = "forcar-abas-medicao";
export const PARAM_ABAS_BRACO = "abas-braco";
export const PARAM_ABAS_VISUAL = "abas-visual";
export const PARAM_ABAS_MEDICAO = "abas-medicao";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};
const limpo = (v: unknown) => String(v ?? "").trim().toLowerCase();

export const modoAbasDe = (v: unknown): ModoAbas | null => {
  const t = limpo(v);
  return t === "on" || t === "off" || t === "sumario" || t === "ab" || t === "ac" || t === "abc" ? t : null;
};
export const bracoAbasDe = (v: unknown): BracoAbas | null => {
  const t = limpo(v);
  return t === "hoje" || t === "todas" || t === "sumario" ? t : null;
};
export const visualAbasDe = (v: unknown): VisualAbas | null => {
  const t = limpo(v);
  return t === "hoje" || t === "fixa" || t === "caderno" ? t : null;
};
const medicaoDe = (v: unknown): MedicaoAbas | null => {
  const t = limpo(v);
  return t === "on" || t === "off" ? t : null;
};

/** A chave remota vale AQUI? Só no app do iPhone (a metadata é a mesma pras duas lojas). */
const remotaValeAqui = (): boolean => { try { return isNativeShell() && isIOS(); } catch { return false; } };

/* ------------------------------------------------------------------ RevenueCat */

/** Em memória: o que o getOfferings DESTA abertura disse. */
const remoto: { modo?: ModoAbas; visual?: VisualAbas; medicao?: MedicaoAbas } = {};

type Off = { metadata?: Record<string, unknown> } | null | undefined;
/** Decisão pura: o valor válido de `chave` em qualquer offering (a `current` vence); nenhum = null. */
export function lerChaveDasOfferings<T>(offerings: unknown, chave: string, valida: (v: unknown) => T | null): T | null {
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: T | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = valida(off?.metadata?.[chave]) ?? lido;
  return valida(o?.current?.metadata?.[chave]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu. Só valor válido muda algo (memória + aparelho). */
export function registrarAbasRemoto(offerings: unknown): void {
  try {
    if (!remotaValeAqui() || !offerings || typeof offerings !== "object") return;
    const modo = lerChaveDasOfferings(offerings, CHAVE_REMOTA_ABAS_MODO, modoAbasDe);
    const visual = lerChaveDasOfferings(offerings, CHAVE_REMOTA_ABAS_VISUAL, visualAbasDe);
    const medicao = lerChaveDasOfferings(offerings, CHAVE_REMOTA_ABAS_MEDICAO, medicaoDe);
    if (modo) { remoto.modo = modo; ls.set(CHAVE_ABAS_MODO_APARELHO, modo); }
    if (visual) { remoto.visual = visual; ls.set(CHAVE_ABAS_VISUAL_APARELHO, visual); }
    if (medicao) { remoto.medicao = medicao; ls.set(CHAVE_ABAS_MEDICAO_APARELHO, medicao); }
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarAbasCaderno = (): void => { delete remoto.modo; delete remoto.visual; delete remoto.medicao; forcaLida = false; };

/* ------------------------------------------------------------------ forças de QA */

/** Grava `?abas-braco=`, `?abas-visual=` e `?abas-medicao=` deste aparelho (`auto` desfaz). */
export function guardarForcaAbasCaderno(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const um = (param: string, chave: string, valida: (v: unknown) => string | null) => {
    const v = p.get(param);
    if (v === null) return;
    if (limpo(v) === "auto") ls.del(chave);
    else { const ok = valida(v); if (ok) ls.set(chave, ok); }
  };
  um(PARAM_ABAS_BRACO, CHAVE_FORCA_ABAS_BRACO, bracoAbasDe);
  um(PARAM_ABAS_VISUAL, CHAVE_FORCA_ABAS_VISUAL, visualAbasDe);
  um(PARAM_ABAS_MEDICAO, CHAVE_FORCA_ABAS_MEDICAO, medicaoDe);
}
let forcaLida = false;
/** A força da URL vale a partir da 1ª leitura desta abertura (o link de QA pode cair em qualquer rota). */
const lerForcaUmaVez = () => {
  if (forcaLida) return;
  forcaLida = true;
  if (typeof window !== "undefined") guardarForcaAbasCaderno();
};

/* ------------------------------------------------------------------ o modo, o braço, o visual */

/** O modo AQUI: RevenueCat desta abertura (iPhone) > última resposta do aparelho (iPhone) > padrão. */
export function modoAbas(): ModoAbas {
  if (!remotaValeAqui()) return ABAS_MODO_PADRAO;
  return remoto.modo ?? modoAbasDe(ls.get(CHAVE_ABAS_MODO_APARELHO)) ?? ABAS_MODO_PADRAO;
}

const BRACOS_DO_MODO: Record<"ab" | "ac" | "abc", readonly BracoAbas[]> = {
  ab: ["hoje", "todas"],
  ac: ["hoje", "sumario"],
  abc: ["hoje", "todas", "sumario"],
};

/** Sorteio determinístico pelo id (FNV-1a 32 bits, sal "abas-enxutas:"): 2 braços = 50/50, 3 = terços. */
export function sortearBracoAbas(id: string, bracos: readonly BracoAbas[]): BracoAbas {
  let h = 0x811c9dc5;
  const s = `abas-enxutas:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return bracos[(h >>> 8) % bracos.length];
}

/** O braço deste aparelho: força de QA > modo fixo > sorteio (1x por modo, gravado). */
export function bracoAbas(): BracoAbas {
  lerForcaUmaVez();
  const f = bracoAbasDe(ls.get(CHAVE_FORCA_ABAS_BRACO));
  if (f) return f;
  const m = modoAbas();
  if (m === "on") return "hoje";
  if (m === "off") return "todas";
  if (m === "sumario") return "sumario";
  const bracos = BRACOS_DO_MODO[m];
  const gravado = ls.get(CHAVE_ABAS_BRACO) ?? "";
  const [modoGravado, bracoGravado] = gravado.split(":");
  const b = bracoAbasDe(bracoGravado);
  if (modoGravado === m && b && bracos.includes(b)) return b;
  const sorteado = sortearBracoAbas(idDoAparelho(), bracos);
  ls.set(CHAVE_ABAS_BRACO, `${m}:${sorteado}`);
  return sorteado;
}

/** O visual da fileira AQUI (só conta nova usa): força > RevenueCat (iPhone) > aparelho (iPhone) > padrão. */
export function visualAbas(): VisualAbas {
  lerForcaUmaVez();
  const f = visualAbasDe(ls.get(CHAVE_FORCA_ABAS_VISUAL));
  if (f) return f;
  if (!remotaValeAqui()) return ABAS_VISUAL_PADRAO;
  return remoto.visual ?? visualAbasDe(ls.get(CHAVE_ABAS_VISUAL_APARELHO)) ?? ABAS_VISUAL_PADRAO;
}

/** Alguma das chaves de abas está fora do padrão neste aparelho (sem contar a medição)? */
export function abasForaDoPadrao(): boolean {
  try {
    lerForcaUmaVez();
    return modoAbas() !== ABAS_MODO_PADRAO || !!bracoAbasDe(ls.get(CHAVE_FORCA_ABAS_BRACO)) || visualAbas() !== ABAS_VISUAL_PADRAO;
  } catch { return false; }
}

/** A medição nova (SPEC §8.1) está ligada AQUI? Força > chave `abas_medicao` (iPhone) > as outras fora do padrão > padrão. */
export function medicaoAbasLigada(): boolean {
  try {
    lerForcaUmaVez();
    const f = medicaoDe(ls.get(CHAVE_FORCA_ABAS_MEDICAO));
    if (f) return f === "on";
    if (remotaValeAqui()) {
      const r = remoto.medicao ?? medicaoDe(ls.get(CHAVE_ABAS_MEDICAO_APARELHO));
      if (r) return r === "on";
    }
    if (abasForaDoPadrao()) return true;
    return ABAS_MEDICAO_PADRAO === "on";
  } catch { return false; }
}

/** Os campos dos eventos: fora do padrão, qual braço e qual visual este aparelho tem. Padrão = nada (eventos iguais). */
export function camposAbasCaderno(): { abas_braco?: BracoAbas; abas_visual?: VisualAbas } {
  try {
    if (!abasForaDoPadrao()) return {};
    return { abas_braco: bracoAbas(), abas_visual: visualAbas() };
  } catch { return {}; }
}

/* ------------------------------------------------------------------ uso_modulo 1x por chave por dia */

/** true = esta chave ainda não contou `uso_modulo` hoje neste aparelho (e já fica marcada). Dia = o de Brasília/local. */
export function usoModuloPrimeiraVezHoje(chave: string, dia: string): boolean {
  let atual: { dia?: string; chaves?: string[] } = {};
  try { atual = JSON.parse(ls.get(CHAVE_USO_MODULO_DIA) ?? "{}") ?? {}; } catch { atual = {}; }
  const chaves = atual.dia === dia && Array.isArray(atual.chaves) ? atual.chaves.filter((c) => typeof c === "string") : [];
  if (chaves.includes(chave)) return false;
  ls.set(CHAVE_USO_MODULO_DIA, JSON.stringify({ dia, chaves: [...chaves, chave].slice(-200) }));
  return true;
}
