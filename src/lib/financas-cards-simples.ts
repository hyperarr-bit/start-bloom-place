/**
 * CARDS SIMPLES DO DASHBOARD DE FINANÇAS (desenho pra aprovação, 17/10) — a chave, sem tela.
 *
 * Dois cards do Dashboard de SEMPRE ganham uma apresentação mais simples (as MESMAS contas, só a
 * apresentação): QUANTO POSSO GASTAR HOJE vira herói "R$ X por dia" com a conta escondida em
 * "Como chegamos nesse número ›", e PREVISÃO DO FIM DO MÊS vira a frase "Se continuar assim, sobra
 * R$ X no fim do mês" com as linhas em "Ver a conta ›". O desenho mora no Dashboard (`simples`).
 *
 * DESLIGADO por padrão — o Dashboard continua idêntico ao de hoje até o dono aprovar.
 * QA só no navegador: `?cards-simples=on|off|auto` — "on" mostra os cards simples neste navegador
 * (prints/teste), "off" os de sempre, "auto" volta à constante. A URL só é lida FORA do app das
 * lojas; a força já guardada no storage vale em qualquer shell (o app da loja não tem barra de
 * endereço nem devtools pra gravá-la, e o Safari do iPhone é outra origem — por isso o harness de
 * prints, que finge o shell do iPhone, consegue ligar gravando a chave antes de abrir).
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoCards = "on" | "off";
/** A constante (app e site). Ligar só com ok do dono. */
export const CARDS_SIMPLES: ModoCards = "off";

/** Força de QA (só navegador) — sem prefixo varrido, sobrevive às vassouras. */
export const CHAVE_FORCA_CARDS_SIMPLES = "cards-simples-force";
export const PARAM_QA_CARDS_SIMPLES = "cards-simples";
/** Abriu "Como chegamos nesse número" / "Ver a conta" (`card`: pode_gastar | previsao). */
export const EV_CARD_CONTA_ABRIR = "financas_card_conta_abrir";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const forcaQa = (): ModoCards | null => {
  const f = ls.get(CHAVE_FORCA_CARDS_SIMPLES);
  return f === "on" || f === "off" ? f : null;
};

let ultimaBusca: string | null = null;
/** Lê `?cards-simples=` uma vez por busca e guarda neste navegador (nunca no app da loja). */
export function guardarForcaCardsDaUrl(busca?: string): void {
  if (isNativeShell()) return;
  let v: string | null;
  try {
    const texto = busca ?? window.location.search;
    if (texto === ultimaBusca) return;
    ultimaBusca = texto;
    v = new URLSearchParams(texto).get(PARAM_QA_CARDS_SIMPLES);
  } catch { return; }
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_CARDS_SIMPLES, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_CARDS_SIMPLES);
}
/** Só testes. */
export const _zerarBuscaCards = (): void => { ultimaBusca = null; };

/** Os cards simples estão ligados AQUI? Força de QA (navegador) > constante. */
export function cardsSimplesLigados(): boolean {
  const f = forcaQa();
  if (f) return f === "on";
  return CARDS_SIMPLES === "on";
}
