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
 * força é ignorada: só a chave do código decide — ou a build de QA (`VITE_V14_QA=1`,
 * lib/v14-qa), que liga as três.
 */
import { fluxoEnxutoLigado } from "@/lib/fluxo-enxuto";
import { isNativeShell } from "@/lib/native-shell";
import { contaNova, ehUmPorDia, lerMissao, missaoCumprida, missaoDosesLigada, missaoDosesMandaNoApp, missaoEmAndamento } from "@/lib/missao-doses";
import { trialCartaoAtivo } from "@/lib/teste-gratis";
import { v14Ligada } from "@/lib/v14-qa";
import { modoTourHomeRemoto } from "@/lib/dia1-cheio";
import { homeNovaLigadaSincrona } from "@/lib/home-nova";

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

/** Chave + força (só no navegador) + build de QA: a resposta única de "está ligado AQUI?". */
const ligado = (modo: ModoChave, chaveForca: string): boolean => {
  if (isNativeShell()) return modo === "on" || v14Ligada();
  const f = lerForca(chaveForca);
  if (f) return f === "on";
  return modo === "on" || v14Ligada();
};

export const cartoesLigados = (modo: ModoChave = CARTOES_MODULO): boolean => !fluxoEnxutoLigado() && ligado(modo, CHAVE_FORCA_CARTOES);
/**
 * 1.0.19 (dono 26/10): com a HOME NOVA ligada pra conta da sessão (lib/home-nova) o tour antigo de 5 passos está
 * APOSENTADO — ele apontava pro score/ações rápidas/widgets da Home de hoje. Responder "desligado" aqui é o que faz
 * TODO mundo que espera o tour seguir sem ele: a missão (braço B fecha o 4º passo sozinha; braço A não segura o
 * "Plano de amanhã"), a festa da dose 1 (sem "Conhecer minha Home") e o álbum (sem "Casa arrumada").
 */
/** 1.0.21: com o FLUXO ENXUTO (lib/fluxo-enxuto) o tour da Home antiga também sai — o mesmo caminho da Home nova acima. */
export const tourHomeLigado = (modo: ModoChave = TOUR_HOME): boolean => !fluxoEnxutoLigado() && !homeNovaLigadaSincrona() && ligado(modo, CHAVE_FORCA_TOUR_HOME);
/** A Home nova está ligada pra conta da sessão (o tour antigo está aposentado). */
export const tourAposentadoPelaHomeNova = (): boolean => homeNovaLigadaSincrona();
export const moduloOcultaPendenciasLigado = (modo: ModoChave = MODULO_OCULTA_PENDENCIAS): boolean => ligado(modo, CHAVE_FORCA_MODULO_OCULTA);

/** A força de QA do tour está ligada neste navegador (ignora a régua de conta nova — o dono testa com a conta dele). */
export const tourForcadoPorQa = (): boolean => !isNativeShell() && lerForca(CHAVE_FORCA_TOUR_HOME) === "on";

/** 10/10: o tour acabou (TourDaHome dispara) — a missão em doses (braço B) fecha o 4º passo com isto. */
export const EVENTO_TOUR_HOME_FIM = "tour-home:concluido";
export const tourFeitoNesteAparelho = (): boolean => !!ls.get(CHAVE_TOUR_FEITO);
/** `valor`: o "Pular" do popup de entrada (1.0.17) grava "pulou:<data>" — a mesma chave, o tour não volta. */
export const marcarTourFeito = (valor: string = new Date().toISOString()): void => ls.set(CHAVE_TOUR_FEITO, valor);

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
 *   · missão em doses com tela por mostrar   → não (espera): dose por fazer, a folha
 *     "Plano de amanhã" (braço B) ou "O que você construiu" ainda não visto — é
 *     `missaoEmAndamento` (lib/missao-doses) + "ainda falta dose". Quem pulou a
 *     missão inteira ("Explorar por conta própria") vê o tour direto.
 *   · senão                                  → sim
 * A Home relê isto nos eventos `missao-doses:mudou` e `missao-doses:completa`
 * (hook useTourDaHome em components/home/TourDaHome): o fluxo esperado é missão
 * (3 doses) → plano de amanhã → tour da Home → festa "Casa arrumada".
 */
/**
 * 1.0.16 (desenho 8 seção 7c) — QUAL tour: metadata `tour_home` ("curto" | "longo" | "off") manda; sem ela,
 * segue o braço da missão: A (uma dose por dia) = o CURTO de 3 passos "faz isso", logo depois da dose 1;
 * B / sem braço = o LONGO de 5 passos de hoje, depois das 3 doses. null = nenhum tour.
 */
export type VarianteDoTour = "curto" | "longo";
export function varianteDoTour(m = lerMissao()): VarianteDoTour | null {
  const r = modoTourHomeRemoto();
  if (r === "off") return null;
  if (r) return r;
  return ehUmPorDia(m) ? "curto" : "longo";
}

export function deveMostrarTourHome(criadoEm: string | null | undefined, agora: number = Date.now()): boolean {
  if (!tourHomeLigado()) return false;
  if (!varianteDoTour()) return false;
  if (tourFeitoNesteAparelho()) return false;
  if (tourSemMaisAberturas()) return false;
  if (!tourForcadoPorQa() && !contaNova(criadoEm, agora)) return false;
  // 10/10: a trava do teste grátis era da Missão de 3 dias do iPhone (1.0.8). Com a missão em doses ligada o
  // tour É o 4º passo da missão — e quase toda conta nova do iPhone está em teste grátis: sem isto ninguém via o tour.
  try { if (!missaoDosesLigada() && trialCartaoAtivo()) return false; } catch { /* sem storage */ }
  if (missaoDosesLigada()) {
    const m = lerMissao();
    // 1.0.17 (vídeo do dono, 19/10): a missão nasce num efeito DEPOIS do 1º render da Home. Sem missão ainda, a
    // trava abaixo não valia e o tour LONGO (variante sem braço) aparecia ~150 ms antes do "Tá dentro!". Conta nova
    // no app, onde a missão VAI nascer → o tour espera (a Home relê no `missao-doses:mudou`).
    if (!m && isNativeShell() && missaoDosesMandaNoApp(criadoEm)) return false;
    // 1.0.16, braço A (uma dose por dia): a missão leva 3 dias — o tour não espera ela acabar, só a tela de hoje
    // (a dose do dia 1 + "amanhã · te lembro às…"; num dia novo, o convite do dia). B e a 1.0.10: como sempre.
    if (m && !m.explorou && (missaoEmAndamento(m) || (!missaoCumprida(m) && !ehUmPorDia(m)))) return false;
    // 1.0.16, braço A: quem tocou "Explorar por conta própria" vê o tour curto na 1ª VOLTA à Home, não no
    // mesmo segundo (desenho 8, 7c) — a missão marca `saiuDaHome` quando ela abre outra tela
    if (m && m.explorou && ehUmPorDia(m) && !m.saiuDaHome) return false;
  }
  return true;
}

/**
 * 1.0.16 — FECHOU O APP NO MEIO DO TOUR: ele volta, mas no máximo em 2 aberturas (a mesma régua do "Vamos montar
 * suas Finanças"): a 2ª vez que aparece sem chegar ao fim é a última. Conta 1 por abertura do app, quando o tour
 * APARECE de verdade (o `home_tour_visto`). Chave do aparelho (chaves-do-aparelho.ts).
 */
export const CHAVE_TOUR_VISTAS = "core-home-tour-vistas";
export const MAX_ABERTURAS_DO_TOUR = 2;
let tourVistoNestaAbertura = false;
export function registrarTourVisto(): void {
  if (tourVistoNestaAbertura) return;
  tourVistoNestaAbertura = true;
  ls.set(CHAVE_TOUR_VISTAS, String((Number(ls.get(CHAVE_TOUR_VISTAS)) || 0) + 1));
}
/** O tour já apareceu nas aberturas que tinha (e não nesta): não volta mais. */
export const tourSemMaisAberturas = (): boolean => !tourVistoNestaAbertura && (Number(ls.get(CHAVE_TOUR_VISTAS)) || 0) >= MAX_ABERTURAS_DO_TOUR;
/** Só testes: simula fechar e abrir o app de novo. */
export const _novaAberturaDoTour = (): void => { tourVistoNestaAbertura = false; };

/** O tour já foi feito — neste aparelho OU na conta (`core-home-tour-done` sobe pro user_data: reinstalar ou
 *  trocar de aparelho não repete o tour; desenho 8, 4.8). `get` é o do useUserData. */
export const tourFeito = (get?: <T>(k: string, f: T) => T): boolean => {
  if (tourFeitoNesteAparelho()) return true;
  try { return !!get?.(CHAVE_TOUR_FEITO, null); } catch { return false; }
};

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
