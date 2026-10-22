/**
 * MENU NOVO DA CONTA (1.0.18, dono 21/10: aprovado SÓ o menu — a Home não muda agora).
 *
 * A folha do avatar da Home (AccountDrawer) em 3 grupos, no desenho v1-menu (novidades-guardadas/2026-10-21/
 * noite-21-10/menu-home-1018): (1) você — cartão com nome + e-mail (Minha conta), Meu plano, Conquistas com a
 * sequência; (2) App — Aparência (modo escuro + cores, que SAEM do topo da Home), Lembretes, Usar no computador,
 * Rever tutorial; (3) Ajuda — Ajuda e suporte, Privacidade e termos; e Sair embaixo. A Retrospectiva sai do menu
 * (0,5% dos pagantes) e ganha um link discreto no fim das Conquistas (as entradas de sempre continuam: a faixa da
 * Home nos dias 1–10, o banner de Finanças e a notificação do dia 1º).
 * Topo da Home com o menu novo: saudação + subtítulo + avatar (sem o sol e a paleta).
 *
 * CHAVE REMOTA `menu_novo` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `tour_home_quando` (lib/dia1-cheio):
 *   · "todos" (ou ausente, ou RevenueCat sem resposta) → o menu novo pra todo mundo;
 *   · "off"                                            → o menu e o topo de hoje (sol e paleta de volta), sem build.
 * A última resposta fica no aparelho (`core-menu-novo`, chave do aparelho): a Home monta antes do getOfferings da
 * abertura responder; sem a cópia, um "off" piscaria o menu novo a cada abertura.
 *
 * AVISO ÚNICO (`core-menu-novo-aviso`, chave do aparelho): quem estava no modo escuro ou numa cor ≠ Original quando
 * o menu novo aparece pela 1ª vez vê UMA vez um balão no avatar ("Modo escuro e cores agora ficam aqui ›
 * Aparência"). Quem estava no Claro · Original é marcado como "não precisa" na mesma hora — nunca vê. Gravado na
 * hora em que aparece: fechar o app com o balão na tela não o repete.
 *
 * QA no navegador: `?menu-novo=on|off|auto` (guarda neste navegador, como `?nav-abas=`). No app das lojas o link é
 * ignorado — lá quem manda é a metadata.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoMenuNovo = "todos" | "off";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_MENU_NOVO = "menu_novo";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho: sobrevive à abertura e ao logout). */
export const CHAVE_MENU_NOVO_APARELHO = "core-menu-novo";
/** O aviso "o tema mudou de lugar" já foi resolvido neste aparelho ("visto" | "nao-precisa"). */
export const CHAVE_AVISO_MENU_NOVO = "core-menu-novo-aviso";
export const PARAM_MENU_NOVO = "menu-novo";
/** Força de QA do navegador (fora dos prefixos que as vassouras do cache apagam). */
export const CHAVE_FORCA_MENU_NOVO = "menu-novo-force";

/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let remoto: ModoMenuNovo | undefined;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoMenuNovo | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "todos" || t === "off" ? t : null;
};

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente/estranha em todas = "todos". */
export function lerMenuNovoRemoto(offerings: unknown): ModoMenuNovo {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoMenuNovo | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_MENU_NOVO]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_MENU_NOVO]) ?? lido;
  return lido ?? "todos";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarMenuNovoRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return; // não respondeu de verdade: fica como estava
    remoto = lerMenuNovoRemoto(offerings);
    ls.set(CHAVE_MENU_NOVO_APARELHO, remoto);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarMenuNovoRemoto = (): void => { remoto = undefined; };

let ultimaBusca: string | null = null;
/** Guarda `?menu-novo=` deste navegador (lido 1x por busca). No app das lojas não faz nada. */
export function guardarForcaMenuNovoDaUrl(busca?: string): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try { p = new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const texto = p.toString();
  if (texto === ultimaBusca) return;
  ultimaBusca = texto;
  const v = (p.get(PARAM_MENU_NOVO) ?? "").toLowerCase();
  if (v === "on" || v === "todos") ls.set(CHAVE_FORCA_MENU_NOVO, "todos");
  else if (v === "off") ls.set(CHAVE_FORCA_MENU_NOVO, "off");
  else if (v === "auto") ls.del(CHAVE_FORCA_MENU_NOVO);
}

/** O modo que vale AQUI: força do navegador (só web) > RevenueCat desta abertura > última resposta do aparelho > "todos". */
export function modoMenuNovo(): ModoMenuNovo {
  if (!isNativeShell()) {
    const f = modoDe(ls.get(CHAVE_FORCA_MENU_NOVO));
    if (f) return f;
  }
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_MENU_NOVO_APARELHO)) ?? "todos";
}

/** "O menu novo (e o topo sem sol/paleta) vale AQUI?" */
export const menuNovoLigado = (): boolean => modoMenuNovo() !== "off";

/* ------------------------------------------------------------------ o aviso único */

/** Quem precisa do aviso: escuro ou cor ≠ Original. Pura. */
export const temaFogeDoPadrao = (mode: string, palette: string): boolean => mode === "dark" || (!!palette && palette !== "default");

/**
 * Decide o aviso desta vez e já grava a decisão (uma vez por aparelho):
 *   · já resolvido antes → false;
 *   · tema fora do padrão → grava "visto" e devolve true (mostrar agora);
 *   · Claro · Original → grava "nao-precisa" e devolve false (nunca mais pergunta).
 * Quem chama só pede quando o menu novo está ligado e nada está por cima da Home.
 */
export function consumirAvisoMenuNovo(mode: string, palette: string): boolean {
  if (ls.get(CHAVE_AVISO_MENU_NOVO)) return false;
  const precisa = temaFogeDoPadrao(mode, palette);
  ls.set(CHAVE_AVISO_MENU_NOVO, precisa ? "visto" : "nao-precisa");
  return precisa;
}
