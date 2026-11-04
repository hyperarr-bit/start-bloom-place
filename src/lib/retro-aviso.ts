/**
 * AVISO "SUA RETROSPECTIVA DE OUTUBRO GANHOU CARA NOVA" (01/11, dono).
 *
 * Até 01/11 a retrospectiva de outubro abria no visual ANTIGO (MonthlyWrapped). Quem já tinha
 * aberto (108 pessoas no 1º dia, sem marca nenhuma no aparelho) ou fechado o cartão/banner precisa
 * saber que agora tem a nova — dono: "pra quem clicou na versão antiga também, porque está
 * desatualizada". Então o aviso vale pra TODA conta com outubro que ainda não abriu a NOVA.
 *
 * Aparece (a folha de baixo da Home, as duas Homes — components/wrapped/AvisoRetroNova) quando:
 *   1. a retrospectiva nova de outubro está ativa (lib/retro-outubro) e hoje é até 10/11, inclusive;
 *   2. a conta tem outubro com dados (construirRetroMes ≠ null — conta nova de novembro nunca vê);
 *   3. a conta ainda não abriu a NOVA (CHAVE_RETRO_NOVA_ABERTA, gravada por pages/Retrospectiva);
 *   4. a conta ainda não viu este aviso (CHAVE_RETRO_AVISO, na conta + espelho no aparelho);
 *   5. a tela está livre (quem monta confere: nenhuma folha, festa, missão, convite da Home nova).
 *
 * As duas chaves da CONTA (sem prefixo varrido, gravadas por useUserData.set) sobem pro user_data;
 * os espelhos do APARELHO (core-…-aparelho, em lib/chaves-do-aparelho) cobrem fechar o app antes de a
 * escrita da conta subir — o mesmo padrão do convite da Home nova.
 */
import { localDayKey } from "@/lib/utils";
import { retroOutubroAtiva, RETRO_OUTUBRO } from "@/lib/retro-outubro";

/** Na conta: { em } — a retrospectiva de outubro já abriu no visual NOVO (cards). */
export const CHAVE_RETRO_NOVA_ABERTA = "retro-outubro-nova-aberta";
/** Na conta: { em, resposta: "visto" | "abrir" | "fechar" } — o aviso já apareceu. */
export const CHAVE_RETRO_AVISO = "retro-outubro-aviso-visto";
/** No aparelho: uids (até 5) que já viram o aviso aqui. */
export const CHAVE_RETRO_AVISO_APARELHO = "core-retro-outubro-aviso-aparelho";
/** No aparelho: uids (até 5) que já abriram a nova aqui. */
export const CHAVE_RETRO_NOVA_APARELHO = "core-retro-outubro-nova-aparelho";

/** Último dia (inclusive, no fuso do aparelho) em que o aviso pode aparecer. */
export const ULTIMO_DIA_AVISO_RETRO = "2026-11-10";
/** Quanto o aviso espera a Home assentar antes de olhar a tela (depois do convite da Home nova, que espera 2,5 s e tem a vez). */
export const ESPERA_AVISO_RETRO_MS = 3000;
/** 02/11: a 1ª tentativa do aviso — depois de a loja costumar responder (a tela de cobrança recusada chega em ~0,5–4 s). */
export const PRIMEIRA_TENTATIVA_AVISO_RETRO_MS = 6000;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
};

const temNaLista = (chave: string, uid: string) => (ls.get(chave) ?? "").split(",").includes(uid);
const porNaLista = (chave: string, uid: string) => {
  const atuais = (ls.get(chave) ?? "").split(",").filter(Boolean);
  if (!atuais.includes(uid)) ls.set(chave, [...atuais, uid].slice(-5).join(","));
};

export const avisoRetroVistoNoAparelho = (uid: string): boolean => temNaLista(CHAVE_RETRO_AVISO_APARELHO, uid);
export const marcarAvisoRetroNoAparelho = (uid: string): void => porNaLista(CHAVE_RETRO_AVISO_APARELHO, uid);
export const retroNovaAbertaNoAparelho = (uid: string): boolean => temNaLista(CHAVE_RETRO_NOVA_APARELHO, uid);
export const marcarRetroNovaNoAparelho = (uid: string): void => porNaLista(CHAVE_RETRO_NOVA_APARELHO, uid);

/**
 * 02/11 noite (dono: "tira o aviso, essa experiência tá ruim"): DESLIGADO até a retrospectiva abrir em tela cheia
 * (estilo Spotify Wrapped). "on" religa. Testes: `globalThis.__AVISO_RETRO__ = true|false` força.
 */
export const AVISO_RETRO = "off" as "on" | "off";
const avisoRetroLigado = (): boolean => {
  const g = (globalThis as { __AVISO_RETRO__?: unknown }).__AVISO_RETRO__;
  if (g === true || g === false) return g;
  return AVISO_RETRO === "on";
};

/** A janela do aviso: a chave ligada, a nova de outubro ativa e hoje ≤ 10/11. */
export const janelaDoAvisoRetro = (agora: Date = new Date()): boolean =>
  avisoRetroLigado() && retroOutubroAtiva(RETRO_OUTUBRO.ano, RETRO_OUTUBRO.mesIdx, agora) && localDayKey(agora) <= ULTIMO_DIA_AVISO_RETRO;

export interface EntradaAvisoRetro {
  userId: string | null;
  /** A leitura da conta chegou inteira do servidor (antes disso as marcas podem não estar aqui). */
  contaCarregada: boolean;
  convidado?: boolean;
  /** janelaDoAvisoRetro(agora). */
  janela: boolean;
  /** construirRetroMes(2026, 9, …) ≠ null. */
  temOutubro: boolean;
  novaAbertaNaConta: unknown;
  avisoNaConta: unknown;
}

/** Decisão pura (a tela livre quem confere é o componente). */
export function deveMostrarAvisoRetro(e: EntradaAvisoRetro): boolean {
  if (!e.userId || !e.contaCarregada || e.convidado) return false;
  if (!e.janela || !e.temOutubro) return false;
  if (e.novaAbertaNaConta != null || retroNovaAbertaNoAparelho(e.userId)) return false;
  if (e.avisoNaConta != null || avisoRetroVistoNoAparelho(e.userId)) return false;
  return true;
}

/* 02/11 (revisor de bugs): "1 folha por abertura" nos DOIS sentidos. O aviso já cedia ao convite da Home nova; o
   convite não cedia ao aviso — com a tela ocupada no começo, o aviso abria e, ao fechar, o convite vinha em seguida.
   A marca mora aqui (lib) pra o EscolhaDaHome ler sem importar o componente do aviso. */
let avisoRetroNestaAbertura = false;
export const avisoRetroApareceuNestaAbertura = (): boolean => avisoRetroNestaAbertura;
export const marcarAvisoRetroNestaAbertura = (): void => { avisoRetroNestaAbertura = true; };
/** Só testes. */
export const _zerarMarcaAvisoRetroNestaAbertura = (): void => { avisoRetroNestaAbertura = false; };
