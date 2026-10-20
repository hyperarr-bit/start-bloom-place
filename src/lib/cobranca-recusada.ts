/**
 * CARTÃO RECUSADO NA LOJA — a conta pura da versão 1.0.14 (10/10).
 *
 * O dinheiro parado: 59% das cobranças do iPhone falham e ~5% recuperam. A
 * Apple segue tentando por semanas e dá 28 dias de carência com acesso; se a
 * pessoa troca o cartão, a cobrança entra. O aviso existe (AvisoCobrancaRecusada,
 * 26/09, consertado 07/10) — mas levava pra tela de ASSINATURAS (onde não tem
 * cartão), sumia por 24 h num toque e não dizia quanto tempo sobrava.
 *
 * O que nasce LIGADO (conserto): o botão "Atualizar pagamento" do iPhone abre a
 * página da forma de pagamento (apps.apple.com/account/billing); o Android segue
 * na Play. E a medição: `dias_restantes` no aviso_cobranca_view.
 *
 * O que nasce atrás da chave `COBRANCA_V14` (DESLIGADA; rollback = "off"):
 *   · o contador da carência ("você tem N dias pra atualizar") no aviso;
 *   · "Agora não" esconde só até a próxima abertura do app (não mais 24 h);
 *   · avisos locais em +24 h e +72 h depois de detectar o cartão recusado,
 *     cancelados quando a cobrança entra (lib/notificacoes, faixa 940000);
 *   · a folha nativa "Problema de cobrança" do StoreKit (iOS 16.4+) só na Home
 *     (ios/App/App/AppDelegate.swift + lib/cobranca-nativa).
 * QA: `?cobranca-v14=on` liga só neste aparelho/navegador (`off` força, `auto`
 * desfaz) — padrão da MISSAO_DOSES. A build `VITE_V14_QA=1` (lib/v14-qa) liga.
 */
import { plataformaApp } from "@/lib/native-shell";
import { urlGerenciarAssinatura } from "@/lib/loja";
import type { ProblemaDeCobranca } from "@/lib/revenuecat";
import { v14Ligada } from "@/lib/v14-qa";

export type ModoCobrancaV14 = "off" | "on";
/** A chave da versão. ROLLBACK = "off". */
export const COBRANCA_V14: ModoCobrancaV14 = "off";

export const CHAVE_FORCA_COBRANCA_V14 = "cobranca-v14-force";
export const PARAM_QA_COBRANCA_V14 = "cobranca-v14";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado: vale a chave */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/** Grava a força de QA do link (`?cobranca-v14=on|off|auto`). */
export function guardarForcaDaCobrancaV14(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = p.get(PARAM_QA_COBRANCA_V14);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_COBRANCA_V14, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_COBRANCA_V14);
}

export const cobrancaV14Ligada = (): boolean => {
  const f = ls.get(CHAVE_FORCA_COBRANCA_V14);
  if (f === "on" || f === "off") return f === "on";
  if (v14Ligada()) return true;
  return (COBRANCA_V14 as ModoCobrancaV14) === "on";
};

/** A carência da Apple (Billing Grace Period) já configurada: 28 dias. */
export const CARENCIA_DIAS = 28;
const DIA_MS = 86_400_000;

/**
 * Dias que sobram da carência a partir de billingIssueDetectedAt. Arredonda
 * pra cima (faltando 3 h ainda é "1 dia"); nunca negativo; null sem data.
 */
export function diasRestantesDaCarencia(detectadoEm: string | null | undefined, agora: number = Date.now()): number | null {
  if (!detectadoEm) return null;
  const inicio = new Date(detectadoEm).getTime();
  if (!Number.isFinite(inicio)) return null;
  const fim = inicio + CARENCIA_DIAS * DIA_MS;
  return Math.max(0, Math.ceil((fim - agora) / DIA_MS));
}

/** O texto do contador. null = não mostrar (sem data, ou carência vencida). */
export function textoDaCarencia(dias: number | null): string | null {
  if (dias == null || dias <= 0) return null;
  return dias === 1 ? "Você tem 1 dia pra atualizar." : `Você tem ${dias} dias pra atualizar.`;
}

const PACOTE_ANDROID = "br.com.coreaplicativo.app";
/** A página da forma de pagamento da Apple — onde o cartão mora de verdade. */
export const URL_PAGAMENTO_APPLE = "https://apps.apple.com/account/billing";

/** Pra onde o botão "Atualizar pagamento" leva. iPhone: forma de pagamento; Android: a Play (como sempre). */
export function urlAtualizarPagamento(p: Pick<ProblemaDeCobranca, "url">, plataforma = plataformaApp()): string {
  if (plataforma === "ios") return URL_PAGAMENTO_APPLE;
  return p.url ?? urlGerenciarAssinatura(PACOTE_ANDROID);
}

/* ─── "Agora não" só até a próxima abertura (chave ligada) ───────────────────
 * Memória do processo: o app fechado e reaberto volta a mostrar. Quem nunca
 * fecha o app conta "abertura" como voltar do fundo depois de 30 min. */
export const PAUSA_QUE_CONTA_COMO_ABERTURA_MS = 30 * 60e3;
let fechadoNestaAbertura = false;
let escondidoDesde: number | null = null;

let vistoNestaAbertura = false;

export const fecharAvisoNestaAbertura = (): void => { fechadoNestaAbertura = true; };
/** 1.0.17: o `aviso_cobranca_view` sai no máximo 1x por abertura (o aviso some e volta quando uma guia abre e fecha). */
export const avisoVistoNestaAbertura = (): boolean => vistoNestaAbertura;
export const marcarAvisoVistoNestaAbertura = (): void => { vistoNestaAbertura = true; };
export const avisoFechadoNestaAbertura = (): boolean => fechadoNestaAbertura;
/** O aviso chama a cada mudança de visibilidade; voltar depois de 30 min = abertura nova. */
export function registrarVisibilidadeDoAviso(visivel: boolean, agora: number = Date.now()): void {
  if (!visivel) { escondidoDesde = escondidoDesde ?? agora; return; }
  if (escondidoDesde != null && agora - escondidoDesde >= PAUSA_QUE_CONTA_COMO_ABERTURA_MS) { fechadoNestaAbertura = false; vistoNestaAbertura = false; }
  escondidoDesde = null;
}
/** Pra teste. */
export const zerarAvisoDaAbertura = (): void => { fechadoNestaAbertura = false; vistoNestaAbertura = false; escondidoDesde = null; };

/* ─── 1.0.17: nunca por cima de uma guia ──────────────────────────────────────
 * Com acesso (carência), o aviso espera a tela ficar livre: boas-vindas e doses da missão, Montar Finanças,
 * festa, tour da Home, intro do módulo, qualquer folha modal. Quem acabou de entrar no teste não tem cartão
 * recusado — mas quem está na carência e abre o app no meio de uma dose não leva duas coisas de uma vez.
 * Sem acesso o aviso mora no alto do bloqueio (é a tela inteira) e não espera nada. */
export const SELETOR_GUIA_NA_TELA =
  '[data-camada-guia], [data-momento], [data-testid="montar-financas"], [role="dialog"][aria-modal="true"], [role="alertdialog"]';
export function guiaNaTela(doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  try { return !!doc?.querySelector(SELETOR_GUIA_NA_TELA); } catch { return false; }
}

/* ─── avisos locais +24 h / +72 h ──────────────────────────────────────────── */
const CHAVE_AVISOS_ARMADOS = "core-aviso-cobranca-notif";

/**
 * Acompanha a verdade da loja a cada leitura do problemaDeCobranca(): detectou →
 * arma uma vez por detecção (a chave guarda o billingIssueDetectedAt); sumiu
 * (cobrança entrou / cancelou) → cancela. Com a chave desligada, não arma nada —
 * e desarma o que uma força de QA tenha deixado.
 */
export async function sincronizarAvisosDeCobranca(p: ProblemaDeCobranca): Promise<"armado" | "cancelado" | "nada"> {
  try {
    const armados = ls.get(CHAVE_AVISOS_ARMADOS);
    if (!p.temProblema || !cobrancaV14Ligada()) {
      if (!armados) return "nada";
      const n = await import("@/lib/notificacoes");
      await n.cancelarAvisosDeCobranca();
      ls.del(CHAVE_AVISOS_ARMADOS);
      return "cancelado";
    }
    const marca = p.detectadoEm ?? "sem-data";
    if (armados === marca) return "nada";
    const n = await import("@/lib/notificacoes");
    const ok = await n.agendarAvisosDeCobranca(marca);
    if (ok) ls.set(CHAVE_AVISOS_ARMADOS, marca);
    return ok ? "armado" : "nada";
  } catch {
    return "nada"; // avisar nunca quebra o aviso
  }
}
