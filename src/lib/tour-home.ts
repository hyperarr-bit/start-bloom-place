/**
 * TOUR DA HOME + CARTÕES DE BOAS-VINDAS DO MÓDULO — protótipo (10/10/2026).
 *
 * Três chaves, TODAS DESLIGADAS por padrão (o app de hoje, byte a byte — travado
 * em src/test/tour-home-e-cartoes.test.tsx):
 *
 *  · `CARTOES_MODULO` — na 1ª visita a Finanças e à Beleza, 3 cartões que deslizam
 *    (Faz isso agora · Onde fica o essencial, com a tela em miniatura viva · O que
 *    não precisa hoje) no lugar do "Dicas para começar". Os outros módulos seguem
 *    com o ModuleTip de sempre.
 *  · `TOUR_HOME` — "Sua Home em 5 passos": overlay por cima da Home real (anel +
 *    balão magenta), score → pendências → ações rápidas → widgets → módulos, cada
 *    passo com UMA ação de 1 toque ou "Deixar como está"; sem "pular tudo". No fim,
 *    a festa do adesivo "Casa arrumada" (comum, pelo mesmo caminho dos Momentos).
 *  · `MODULO_OCULTA_PENDENCIAS` — esconder um módulo na grade da Home também
 *    esconde as pendências daquele módulo (e o score não cobra). Regra DERIVADA
 *    da preferência que já existe (`core-module-prefs.hidden`): nada é copiado pra
 *    `home-pendencias-prefs`, então religar o módulo volta ao estado anterior.
 *
 * QA pelo link, SÓ NO NAVEGADOR (como `?missao-doses=on`): `?cartoes=on|off|auto`,
 * `?tour-home=on|off|auto|recomecar` (recomecar apaga o "já vi" deste aparelho),
 * `?modulo-oculta-pendencias=on|off|auto`. A força fica no localStorage deste
 * navegador (a Home → módulo → Home passa por várias páginas). No app das lojas a
 * força é ignorada: só a chave do código decide.
 */
import { isNativeShell } from "@/lib/native-shell";
import { contaNova, lerMissao, missaoCumprida, missaoDosesLigada } from "@/lib/missao-doses";
import { trialCartaoAtivo } from "@/lib/teste-gratis";

export type ModoChave = "off" | "on";
/** Cartões de boas-vindas (Finanças e Beleza). ROLLBACK/LIGAR = trocar aqui. */
export const CARTOES_MODULO: ModoChave = "off";
/** Tour obrigatório da Home em 5 passos. */
export const TOUR_HOME: ModoChave = "off";
/** Módulo oculto na Home ⇒ as pendências dele não são cobradas. */
export const MODULO_OCULTA_PENDENCIAS: ModoChave = "off";

export const PARAM_CARTOES = "cartoes";
export const PARAM_TOUR_HOME = "tour-home";
export const PARAM_MODULO_OCULTA = "modulo-oculta-pendencias";
export const CHAVE_FORCA_CARTOES = "cartoes-force";
export const CHAVE_FORCA_TOUR_HOME = "tour-home-force";
export const CHAVE_FORCA_MODULO_OCULTA = "modulo-oculta-pendencias-force";

/** 1x por aparelho: o tour já passou aqui (localStorage). A mesma chave vai pra conta (data) pro adesivo. */
export const CHAVE_TOUR_FEITO = "core-home-tour-done";
/** 1x por aparelho: os cartões do módulo já foram vistos aqui. */
export const chaveCartoesVistos = (moduleId: string) => `core-cartoes-vistos-${moduleId}`;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado: vale a chave */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const lerForca = (chave: string): ModoChave | null => {
  const f = ls.get(chave);
  return f === "on" || f === "off" ? f : null;
};

let ultimaBuscaLida: string | null = null;

/**
 * Guarda as forças do link (`?cartoes=`, `?tour-home=`, `?modulo-oculta-pendencias=`) neste
 * navegador. Cada busca é lida UMA vez por carga da página: a Home chama a cada render e o
 * `recomecar` apagaria o "já vi" de novo logo depois do tour acabar.
 */
export function guardarForcasDaUrl(busca?: string | URLSearchParams): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try {
    p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
  } catch { return; }
  const texto = p.toString();
  if (texto === ultimaBuscaLida) return;
  ultimaBuscaLida = texto;
  const aplicar = (param: string, chave: string) => {
    const v = p.get(param);
    if (v === "on" || v === "off") ls.set(chave, v);
    else if (v === "auto") ls.del(chave);
    return v;
  };
  aplicar(PARAM_CARTOES, CHAVE_FORCA_CARTOES);
  aplicar(PARAM_MODULO_OCULTA, CHAVE_FORCA_MODULO_OCULTA);
  const t = aplicar(PARAM_TOUR_HOME, CHAVE_FORCA_TOUR_HOME);
  if (t === "recomecar") { ls.set(CHAVE_FORCA_TOUR_HOME, "on"); ls.del(CHAVE_TOUR_FEITO); }
}

/** Chave + força (só no navegador): a resposta única de "está ligado AQUI?". */
const ligado = (modo: ModoChave, chaveForca: string): boolean => {
  if (isNativeShell()) return modo === "on";
  const f = lerForca(chaveForca);
  if (f) return f === "on";
  return modo === "on";
};

export const cartoesLigados = (modo: ModoChave = CARTOES_MODULO): boolean => ligado(modo, CHAVE_FORCA_CARTOES);
export const tourHomeLigado = (modo: ModoChave = TOUR_HOME): boolean => ligado(modo, CHAVE_FORCA_TOUR_HOME);
export const moduloOcultaPendenciasLigado = (modo: ModoChave = MODULO_OCULTA_PENDENCIAS): boolean => ligado(modo, CHAVE_FORCA_MODULO_OCULTA);

/** A força de QA do tour está ligada neste navegador (ignora a régua de conta nova — o dono testa com a conta dele). */
export const tourForcadoPorQa = (): boolean => !isNativeShell() && lerForca(CHAVE_FORCA_TOUR_HOME) === "on";

export const tourFeitoNesteAparelho = (): boolean => !!ls.get(CHAVE_TOUR_FEITO);
export const marcarTourFeito = (): void => ls.set(CHAVE_TOUR_FEITO, new Date().toISOString());

export const cartoesVistosNesteAparelho = (moduleId: string): boolean => !!ls.get(chaveCartoesVistos(moduleId));
export const marcarCartoesVistos = (moduleId: string): void => ls.set(chaveCartoesVistos(moduleId), new Date().toISOString());

/**
 * QUANDO O TOUR APARECE (decisão do dono, 10/10): na primeira Home de uma conta
 * NOVA sem missão ativa/pendente — isto é, depois de terminar a missão em doses
 * E também pra quem pulou a missão ("Explorar por conta própria") ou nunca a
 * teve (web). Nunca pra conta antiga que já usa (conta ≥ 48 h), nunca pra quem
 * está na Missão dos 3 dias do iPhone (MissaoDoTrial), e 1x por aparelho.
 *
 *   · chave desligada (sem força)            → não
 *   · já passou neste aparelho               → não
 *   · conta ≥ 48 h (e sem força de QA)       → não (cliente antigo não vê nada)
 *   · Missão do iPhone em andamento          → não (ela é o tutorial)
 *   · missão em doses ligada, com passo por fazer e NÃO pulada → não (espera ela acabar)
 *   · senão                                  → sim
 */
export function deveMostrarTourHome(criadoEm: string | null | undefined, agora: number = Date.now()): boolean {
  if (!tourHomeLigado()) return false;
  if (tourFeitoNesteAparelho()) return false;
  if (!tourForcadoPorQa() && !contaNova(criadoEm, agora)) return false;
  try { if (trialCartaoAtivo()) return false; } catch { /* sem storage */ }
  if (missaoDosesLigada()) {
    const m = lerMissao();
    if (m && !missaoCumprida(m) && !m.explorou) return false;
  }
  return true;
}

/* ------------------------------------------------------------ eventos entre as peças da Home */

/** O tour pede pra lista "Pendências de hoje" abrir (pra acender o "⋯"). */
export const EVENTO_PENDENCIAS_ABRIR = "core:pendencias-abrir";
/** O tour liga/desliga o modo de edição da grade de módulos (a engrenagem). `detail: { editar: boolean }` */
export const EVENTO_MODULOS_EDITAR = "core:modulos-editar";
/** O tour esconde um módulo — quem grava é o ModuleDrawer (uma fonte só da preferência). `detail: { id }` */
export const EVENTO_MODULOS_OCULTAR = "core:modulos-ocultar";

export const avisar = (nome: string, detail?: Record<string, unknown>): void => {
  try { window.dispatchEvent(new CustomEvent(nome, { detail })); } catch { /* sem window */ }
};
