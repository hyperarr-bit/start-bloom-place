/**
 * PAINEL LIMPO DE FINANÇAS (1.0.16, 16/10) — a régua, a chave e o "decidido uma vez", sem tela.
 *
 * Pedido do dono (dados de 16/09–16/10, quem vê → mexe): o DASHBOARD de Finanças da conta NOVA abre
 * com o que se usa — QUANTO POSSO GASTAR HOJE, ALERTAS INTELIGENTES, MEU MÊS, GASTOS POR CATEGORIA e
 * TOTAL POR CARTÃO NO MÊS — e o resto (previsão do fim do mês 5%, evolução do patrimônio 6%,
 * progresso do mês 4%, os números, receitas × despesas, método, fixos × variáveis, top 5, últimas,
 * comparação mensal e anual) fica atrás de "Mais gráficos", lá embaixo. Nada é apagado. O DESAFIO
 * DA SEMANA (40% mexem) fica à vista, logo depois do topo. O desenho mora no Dashboard (`limpo`);
 * quem monta os pedaços é pages/Index.
 *
 * ── QUEM VÊ ─────────────────────────────────────────────────────────────────────────────────
 *   Conta logada (não convidado, não demo /preview) e ELEGÍVEL, decidido UMA vez e guardado:
 *     · passou pelo "Vamos montar suas Finanças" (a marca DA CONTA — a do aparelho pode ser de
 *       outra conta que entrou antes neste celular); OU
 *     · criada a partir de PAINEL_LIMPO_CONTAS_DESDE (16/10, 1.0.16 em construção) e, na 1ª vez que
 *       abre Finanças nesta versão, sem dado nenhum de Finanças (`temDadosDeFinancas`) ou com
 *       menos de 48 h (a régua de conta nova do Montar e da missão: quem lançou um gasto pela Home
 *       antes de abrir Finanças continua sendo conta nova).
 *   Quem já usava o Dashboard fica com o de hoje, exatamente igual — conta antiga nunca é elegível.
 *   A decisão é tomada na abertura do MÓDULO (pages/Index, qualquer aba), antes de a pessoa lançar
 *   alguma coisa, e só o "sim" é guardado — o "não" de conta antiga é determinístico e não
 *   precisa escrever nada em ~1.000 contas.
 *
 * ── ONDE O "SIM" FICA ───────────────────────────────────────────────────────────────────────
 *   · na conta: `core-financas-painel` = { limpo: true, em } (useUserData, escrita de sistema) —
 *     volta no login em outro aparelho;
 *   · no aparelho, POR CONTA: `core-financas-painel-<id da conta>` = "1" (CHAVES_DO_APARELHO, família)
 *     — a vassoura da abertura apaga o cache da conta e o dado do servidor chega depois; sem isto o
 *     painel de sempre piscava a cada abertura antes do limpo. Por conta porque outra pessoa que
 *     entrar neste celular não pode herdar o painel.
 *
 * ── A CHAVE ─────────────────────────────────────────────────────────────────────────────────
 *   `PAINEL_LIMPO` (app das lojas) ligada · `PAINEL_LIMPO_WEB` (site) desligada.
 *   Metadata do RevenueCat `financas_painel_limpo: "on" | "off"` em QUALQUER offering (a `current`
 *   vence) manda no app sem versão nova (revenuecat.ts registra). Desligar não esquece quem é
 *   elegível: religou, o painel limpo volta pra mesma gente.
 *   QA só no navegador: `?painel-limpo=on|off|auto` — "on" mostra o limpo pra QUALQUER conta deste
 *   navegador (prints/teste), "off" o de sempre, "auto" volta à regra.
 *   Ordem: força de QA (navegador) > metadata remota (app) > constante.
 *
 * Evento: `financas_mais_graficos_abrir` (abriu o "Mais gráficos"; sem dado nenhum).
 */
import { isNativeShell } from "@/lib/native-shell";
import { CHAVE_MONTAR_FINANCAS, temDadosDeFinancas } from "@/lib/montar-financas";

export type ModoChave = "on" | "off";
/** App das lojas. ROLLBACK = "off" aqui (ou metadata `financas_painel_limpo: "off"` no RevenueCat, sem build). */
export const PAINEL_LIMPO: ModoChave = "on";
/** Site (Vercel). */
export const PAINEL_LIMPO_WEB: ModoChave = "off";

export const CHAVE_REMOTA_PAINEL_LIMPO = "financas_painel_limpo";
/** Força de QA (só navegador) — sem prefixo varrido, sobrevive às vassouras. */
export const CHAVE_FORCA_PAINEL_LIMPO = "painel-limpo-force";
export const PARAM_QA_PAINEL_LIMPO = "painel-limpo";

/** Na conta (useUserData). */
export const CHAVE_PAINEL_LIMPO = "core-financas-painel";
/** No aparelho, uma por conta (`${prefixo}${id}`). Ver chaves-do-aparelho.ts. */
export const PREFIXO_PAINEL_LIMPO_APARELHO = "core-financas-painel-";

/** Conta criada daqui pra frente conta como "depois desta build" (16/10, com a 1.0.16 em construção — a conta
 *  nova criada pra testar antes do envio também vale; quem tem dado e mais de 48 h fica no painel de sempre). */
export const PAINEL_LIMPO_CONTAS_DESDE = "2026-10-16T00:00:00-03:00";
const CONTA_NOVA_MS = 48 * 3600e3;

export const EV_MAIS_GRAFICOS = "financas_mais_graficos_abrir";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/* ───────────────────────── chave ───────────────────────── */

let remota: ModoChave | null = null;
const modoDe = (v: unknown): ModoChave | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

/** Decisão pura: o `financas_painel_limpo` do metadata das offerings (a `current` vence). */
export function lerChaveRemotaPainel(offerings: unknown): ModoChave | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoChave | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    const m = modoDe(off?.metadata?.[CHAVE_REMOTA_PAINEL_LIMPO]);
    if (m) lido = m;
  }
  const c = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_PAINEL_LIMPO]);
  return c ?? lido;
}
/** revenuecat.ts chama a cada getOfferings() do boot. */
export function registrarChavePainelLimpo(offerings: unknown): void {
  try { remota = lerChaveRemotaPainel(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarRemotaPainel = (): void => { remota = null; };

const forcaQa = (): ModoChave | null => {
  if (isNativeShell()) return null;
  const f = ls.get(CHAVE_FORCA_PAINEL_LIMPO);
  return f === "on" || f === "off" ? f : null;
};

let ultimaBusca: string | null = null;
/** Lê `?painel-limpo=` uma vez por busca e guarda neste navegador (nunca no app da loja). */
export function guardarForcaPainelDaUrl(busca?: string): void {
  if (isNativeShell()) return;
  let v: string | null;
  try {
    const texto = busca ?? window.location.search;
    if (texto === ultimaBusca) return;
    ultimaBusca = texto;
    v = new URLSearchParams(texto).get(PARAM_QA_PAINEL_LIMPO);
  } catch { return; }
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_PAINEL_LIMPO, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_PAINEL_LIMPO);
}

/** A chave, sem a régua: força de QA (navegador) > metadata do RevenueCat (app) > constante. */
export function painelLimpoLigado(): boolean {
  const f = forcaQa();
  if (f) return f === "on";
  if (isNativeShell()) return (remota ?? PAINEL_LIMPO) === "on";
  return PAINEL_LIMPO_WEB === "on";
}

/* ───────────────────────── régua ───────────────────────── */

export interface ContextoPainel {
  uid: string | null | undefined;
  criadoEm: string | null | undefined;
  get: <T>(k: string, f: T) => T;
  /** O dado da conta já chegou (antes disso, `get` devolve o padrão). */
  loaded: boolean;
  isGuest: boolean;
  isPreview?: boolean;
  agora?: number;
}

const marcadoNoAparelho = (uid: string): boolean => ls.get(`${PREFIXO_PAINEL_LIMPO_APARELHO}${uid}`) === "1";
const objeto = (v: unknown): Record<string, unknown> | null => {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") { try { const o = JSON.parse(v); return o && typeof o === "object" ? o : null; } catch { return null; } }
  return null;
};

/**
 * A conta é elegível ao painel limpo? `null` = ainda não dá pra saber (o dado da conta não chegou
 * e o aparelho não lembra) — quem chama mostra o painel de sempre até lá.
 */
export function contaElegivelAoPainelLimpo({ uid, criadoEm, get, loaded, isGuest, isPreview, agora = Date.now() }: ContextoPainel): boolean | null {
  if (!uid || isGuest || isPreview) return false;
  if (marcadoNoAparelho(uid)) return true;
  if (!loaded) return null;
  if (objeto(get<unknown>(CHAVE_PAINEL_LIMPO, null))?.limpo === true) return true;
  if (objeto(get<unknown>(CHAVE_MONTAR_FINANCAS, null))?.r) return true; // passou pelo Montar (marca da conta)
  const criada = Date.parse(String(criadoEm ?? ""));
  if (!Number.isFinite(criada) || criada < Date.parse(PAINEL_LIMPO_CONTAS_DESDE)) return false;
  return agora - criada < CONTA_NOVA_MS || !temDadosDeFinancas(get);
}

/** Guarda o "sim" (aparelho + conta). Idempotente: só escreve o que falta. */
export function lembrarPainelLimpo(
  uid: string,
  get: <T>(k: string, f: T) => T,
  set: (k: string, v: unknown, opts?: { system?: boolean }) => void,
): void {
  if (!marcadoNoAparelho(uid)) ls.set(`${PREFIXO_PAINEL_LIMPO_APARELHO}${uid}`, "1");
  if (objeto(get<unknown>(CHAVE_PAINEL_LIMPO, null))?.limpo !== true) {
    set(CHAVE_PAINEL_LIMPO, { limpo: true, em: new Date().toISOString() }, { system: true });
  }
}

/** O Dashboard abre limpo AQUI? Força de QA "on"/"off" (navegador) vence a régua; senão chave E régua. */
export function mostrarPainelLimpo(elegivel: boolean | null): boolean {
  const f = forcaQa();
  if (f) return f === "on";
  return elegivel === true && painelLimpoLigado();
}
