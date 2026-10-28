import { idDoAparelho } from "@/lib/dia1-cheio";
import { isIOS, isNativeShell } from "@/lib/native-shell";
import { modo1012 } from "@/lib/modo-1012";
import { webHomeNovaLigada } from "@/lib/web-home-nova";

/**
 * HOME NOVA — OPÇÃO E (1.0.19, 26/10): a Home do carrossel do dia (src/components/home-nova/e), aprovada pelo
 * dono depois de 6 rodadas de mockup (novidades-guardadas/2026-10-25/home-nova/E). Quem a vê é decidido por uma
 * CHAVE REMOTA, no padrão de `dias23` / `sino_paywall`, com um PADRÃO por plataforma (26/10, "home nova garantida"):
 *
 * ┌ A REGRA FINAL (1.0.19 na loja) ───────────────────────────────────────────────────────────────────────────────┐
 * │ 1. App das lojas: sem resposta do RevenueCat, sem cache e sem a chave na metadata = "novas+admin" (PADRÃO).    │
 * │    Site/navegador: o padrão é "off" (a Home do site não muda; o RevenueCat nem roda lá).                       │
 * │ 2. A chave `home_nova` manda quando responde COM um valor válido; o valor fica guardado no aparelho. "off" é o │
 * │    desligar de emergência: vale da PRÓXIMA abertura em diante (nunca troca a Home na frente da pessoa).        │
 * │ 3. O modo vale a abertura inteira: fixado na 1ª decisão com conta (fixarModoDaAbertura); uma resposta que     │
 * │    chega depois só é guardada pra próxima abertura.                                                            │
 * │ 4. Conta NOVA (origem gravada na conta, ver abaixo) vê a Home nova desde a 1ª Home, sempre; a Home ESPERA a   │
 * │    origem estar decidida (pages/Home: tela de carregamento de sempre, nunca a Home antiga por um quadro).      │
 * │ 5. Conta ANTIGA nunca vê a Home nova (só o admin, no "novas+admin"); uma vez nova/antiga, pra sempre.          │
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `home_nova` na metadata de QUALQUER offering do RevenueCat (a `current` vence):
 *   · ausente ou valor estranho → NADA muda (vale o guardado no aparelho, senão o padrão da plataforma);
 *   · "off" → a Home de hoje, byte a byte, pra todo mundo (o desligar de emergência);
 *   · "admin" → liga SÓ para contas com papel de admin (a mesma checagem do /admin, lib/admin) — é como o dono
 *     testa no TestFlight com os dados reais dele sem mudar nada para os clientes;
 *   · "on" → todos;
 *   · "ab" → sorteio 50/50 determinístico pelo id do aparelho (FNV-1a com sal próprio, como o do sino), estável
 *     entre aberturas; os eventos levam `home_nova: "nova" | "atual"` (camposHomeNova);
 *   · "novas" (dono 26/10, SEM A/B) → liga só pra CONTA NOVA: a que tem o marcador de origem "nova" gravado na conta
 *     (`core-home-nova-origem`, ver ORIGEM DA CONTA abaixo). Cliente antigo nunca liga; uma vez nova, nova pra sempre;
 *   · "novas+admin" (o PADRÃO do app das lojas) → as contas novas E o dono (a checagem de admin, como no "admin").
 *
 * ORIGEM DA CONTA (a regra do "novas", 26/10) — decidida UMA vez por conta, no app das lojas (1.0.19+), na 1ª
 * abertura com a conta carregada do servidor (OrigemDaContaNaSessao, App), e gravada na CONTA (sobe pro user_data;
 * reinstalar ou trocar de aparelho lê o marcador de volta, nunca reclassifica):
 *   · "nova"   = a conta foi criada há menos de 48 h (created_at do Supabase, a mesma régua da missão) E não tem
 *                missão em doses de antes (nem a cópia na conta, nem a local desta conta) — quem começou o teste
 *                numa versão anterior já tem missão e fica "antiga";
 *   · "antiga" = todo o resto: conta com mais de 48 h (inclusive quem já tinha conta e só agora começa o teste),
 *                conta antiga reinstalando o app, conta com missão de uma versão anterior.
 *   No site (navegador) nada é classificado nem gravado: a conta criada pela Porta/site é decidida quando abrir o app
 *   (dentro de 48 h = nova). 27/10: com WEB_HOME_NOVA "on" (lib/web-home-nova) o SITE também decide e grava, com a
 *   MESMA régua, e o modo do site vira "novas" (conta nova vê a Home nova; antiga e admin, a de hoje). Reinstalar no mesmo dia: o marcador volta da conta (ou, se não chegou a subir, a regra
 *   decide de novo — a missão só sobe pra conta DEPOIS do marcador). Sem created_at: nada é gravado e esta abertura
 *   fica com a Home de hoje (nunca liga a nova na dúvida).
 *   A decisão só usa a conta QUANDO ELA É DESTA conta (loaded + contaCompleta: o render de troca convidado→conta
 *   ainda tem o `loaded` do convidado) — components/home-nova/OrigemDaConta (decidirOrigemDaConta).
 *   Espelho no aparelho (`core-home-nova-origem-aparelho` = "<uid>:nova|antiga") pra decidir sem esperar a conta.
 *   O score sem os pontos "de graça" (use-life-hub-data) usa o MESMO marcador — vale pra conta nova com a chave em
 *   qualquer modo.
 * A última resposta VÁLIDA fica no aparelho (`core-home-nova`); o braço sorteado em `core-home-nova-braco`; a resposta
 * da checagem de admin em `core-home-nova-admin` (por conta, pra 2ª abertura não esperar a consulta).
 * QA: `?home-nova=on|off|auto` (guarda em `forcar-home-nova` neste aparelho/navegador; "auto" desfaz).
 *
 * A FORÇA da cor dos módulos (rodada 6 do mockup) mora em SUAVIDADE_HOME_NOVA: "mais" (70 % pro lado da rodada 4,
 * a escolhida) · "suave" (50 %, reserva) · "forte" (v5). Trocar = uma palavra aqui.
 */
export type ModoHomeNova = "off" | "admin" | "on" | "ab" | "novas" | "novas+admin";
export type OrigemDaConta = "nova" | "antiga";
export type BracoHomeNova = "nova" | "atual";
export type SuavidadeHomeNova = "forte" | "suave" | "mais";

export const CHAVE_REMOTA_HOME_NOVA = "home_nova";
export const CHAVE_HOME_NOVA_APARELHO = "core-home-nova";
export const CHAVE_BRACO_HOME_NOVA = "core-home-nova-braco";
export const CHAVE_ADMIN_HOME_NOVA = "core-home-nova-admin";
/** O dia em que o fogo da pílula já acendeu (o pulso toca 1x por dia). */
export const CHAVE_FOGO_ACESO_HOME_NOVA = "core-home-nova-fogo";
/** O dia em que o card do score já fez a festinha do 100 (estrela âmbar; 1x por dia — home-nova/e/Festa100). */
export const CHAVE_SCORE_100_HOME_NOVA = "core-home-nova-score-100";
/** Força de QA — fora dos prefixos que as vassouras do cache apagam ("home-" é varrido; lib/chaves-do-aparelho). */
export const CHAVE_FORCA_HOME_NOVA = "forcar-home-nova";
/** 26/10: a cor do tema que a pessoa tinha ANTES da Home nova forçar o Original (chave da conta); volta quando a chave desliga. */
export const CHAVE_COR_ANTES_HOME_NOVA = "core-cor-antes-home-nova";
export const PARAM_HOME_NOVA = "home-nova";
/** 26/10: o marcador de origem da conta (DA CONTA, sobe pro user_data): { tipo: "nova" | "antiga", em, versao, regra }. */
export const CHAVE_ORIGEM_CONTA = "core-home-nova-origem";
/** 26/10: o espelho do marcador neste aparelho ("<uid>:nova|antiga"), pra decidir antes de a conta chegar. */
export const CHAVE_ORIGEM_APARELHO = "core-home-nova-origem-aparelho";
/** 26/10: a origem de uma conta ficou conhecida (quem decide com React relê). */
export const EVENTO_ORIGEM_HOME_NOVA = "home-nova:origem";
/** A versão que grava o marcador (só informativo, vai no marcador). */
export const VERSAO_ORIGEM = "1.0.19";
/** Conta "nova": criada há menos disto (a mesma régua da missão em doses / do tutorial). */
export const JANELA_CONTA_NOVA_MS = 48 * 3600e3;
/** A barra de vidro pede pra abrir a folha do "+" (a folha mora na Home). */
export const EVENTO_HOME_NOVA_MAIS = "home-nova:mais";

/* O "+" tocado FORA da Home (Conquistas, Você): a barra leva pra Home e a folha tem que abrir ao chegar. Em memória
 * (não no estado da navegação: um state no histórico reabriria a folha ao voltar pra essa entrada). */
let maisPendente = false;
export const pedirMaisNaHome = (): void => { maisPendente = true; };
/** A Home consome o pedido ao montar (1x). */
export const consumirMaisPendente = (): boolean => { const v = maisPendente; maisPendente = false; return v; };
/** ROLLBACK/AJUSTE da força da cor = trocar aqui ("mais" é a aprovada; "suave" a reserva). */
export const SUAVIDADE_HOME_NOVA: SuavidadeHomeNova = "mais";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoHomeNova | null => {
  const t = String(v ?? "").toLowerCase().replace(/\s+/g, "");
  if (t === "novas+admin" || t === "admin+novas") return "novas+admin";
  return t === "off" || t === "admin" || t === "on" || t === "ab" || t === "novas" ? t : null;
};
const bracoDe = (v: unknown): BracoHomeNova | null => (v === "nova" || v === "atual" ? v : null);

/** 26/10: o modo quando o RevenueCat não disse nada (sem resposta, sem cache, sem a chave): app do iPhone = "novas+admin"
 *  (toda conta nova vê a Home nova, garantido); site e Android = "off" (a Home do site não muda; o Android ainda não
 *  passou pelo QA da Home nova — liga por lá só pela chave remota, quando o dono decidir). */
export const MODO_PADRAO_APP: ModoHomeNova = "novas+admin";
export const MODO_PADRAO_WEB: ModoHomeNova = "off";
/** 27/10 (lib/web-home-nova): no site, com WEB_HOME_NOVA "on", o padrão é "novas" — só a conta NOVA (marcador de origem) vê a
 *  Home nova; o admin, como todo cliente antigo, fica com a de hoje. "off" = MODO_PADRAO_WEB, como antes. */
export const MODO_SITE_HOME_NOVA: ModoHomeNova = "novas";
export const padraoHomeNova = (): ModoHomeNova =>
  (isNativeShell() && isIOS() ? MODO_PADRAO_APP : webHomeNovaLigada() ? MODO_SITE_HOME_NOVA : MODO_PADRAO_WEB);

/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let remoto: ModoHomeNova | undefined;
/** Em memória: a resposta da checagem de admin desta abertura (null = ainda não sabe / não precisou). */
let adminAtual: boolean | null = null;
/** 26/10: o modo FIXADO desta abertura (null = ainda não decidiu nada com conta). Ver fixarModoDaAbertura. */
let modoFixo: ModoHomeNova | null = null;

/** O valor EXPLÍCITO da chave em qualquer offering (a `current` vence); ausente/estranho em todas = null (não disse nada). */
export function lerHomeNovaRemotoExplicito(offerings: unknown): ModoHomeNova | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoHomeNova | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_HOME_NOVA]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_HOME_NOVA]) ?? lido;
  return lido;
}
/** Decisão pura: o valor explícito; sem ele, o PADRÃO da plataforma (app "novas+admin", site "off"). */
export function lerHomeNovaRemoto(offerings: unknown): ModoHomeNova {
  return lerHomeNovaRemotoExplicito(offerings) ?? padraoHomeNova();
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu (registrarChavesDasOfferings).
 *  Só um valor VÁLIDO muda alguma coisa (memória + aparelho); a chave ausente/estranha não derruba o guardado nem o padrão.
 *  Com o modo desta abertura já fixado, a resposta só é guardada — vale da próxima abertura em diante. */
export function registrarHomeNovaRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerHomeNovaRemotoExplicito(offerings);
    if (!lido) return;
    remoto = lido;
    ls.set(CHAVE_HOME_NOVA_APARELHO, lido);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarHomeNova = (): void => { remoto = undefined; adminAtual = null; maisPendente = false; origens.clear(); origensTentadas.clear(); contaDaSessao = null; criadoEmDaSessao = null; modoFixo = null; };

/* ------------------------------------------------------------------ ORIGEM DA CONTA (modo "novas") */

/** Em memória: a origem já decidida/lida de cada conta nesta abertura. */
const origens = new Map<string, OrigemDaConta>();
/** Em memória: as contas cuja origem JÁ FOI TENTADA com a conta carregada nesta abertura (decidida ou indecidível —
 *  sem created_at, no site). A Home só espera a origem de conta que ainda não foi tentada. */
const origensTentadas = new Set<string>();
export const marcarOrigemTentada = (userId: string): void => { origensTentadas.add(userId); };
export const origemJaTentada = (userId: string): boolean => origensTentadas.has(userId);
/** Em memória: a conta logada (OrigemDaContaNaSessao define a cada render) — pra quem decide sem o user na mão. */
let contaDaSessao: string | null = null;
/** 1.0.19 (novato polido): quando ESSA conta foi criada (created_at do Supabase) — o score do novato (use-life-hub-data,
 *  lib/pendencias-novato) usa a mesma régua de 7 dias da lista, sem o hub precisar do useAuth. */
let criadoEmDaSessao: string | null = null;
export const definirContaHomeNova = (userId: string | null | undefined, criadoEm?: string | null): void => {
  contaDaSessao = userId || null;
  criadoEmDaSessao = userId ? criadoEm ?? null : null;
};
export const contaDaSessaoHomeNova = (): string | null => contaDaSessao;
export const criadoEmDaContaHomeNova = (): string | null => criadoEmDaSessao;

/** O marcador gravado na conta → a origem (lixo = null). */
export function lerMarcadorOrigem(v: unknown): OrigemDaConta | null {
  const t = (v && typeof v === "object" ? (v as { tipo?: unknown }).tipo : v) as unknown;
  return t === "nova" || t === "antiga" ? t : null;
}
export interface MarcadorOrigem { tipo: OrigemDaConta; em: string; versao: string; regra: string }
export const marcadorDe = (tipo: OrigemDaConta, agora: number = Date.now()): MarcadorOrigem =>
  ({ tipo, em: new Date(agora).toISOString(), versao: VERSAO_ORIGEM, regra: "conta<48h e sem missão de antes" });

/**
 * A REGRA (pura): "nova" só no app (nativo), conta criada há menos de 48 h e sem missão em doses de antes.
 * Sem data de criação = "antiga" (na dúvida, nunca liga a Home nova pra quem pode ser cliente antigo).
 */
export function classificarOrigem(p: { nativo: boolean; criadoEm?: string | null; temMissaoDeAntes: boolean; agora?: number }): OrigemDaConta {
  const agora = p.agora ?? Date.now();
  const t = p.criadoEm ? new Date(p.criadoEm).getTime() : NaN;
  const recente = Number.isFinite(t) && agora - t < JANELA_CONTA_NOVA_MS && agora - t > -JANELA_CONTA_NOVA_MS;
  return p.nativo && recente && !p.temMissaoDeAntes ? "nova" : "antiga";
}

/** A origem que esta abertura já conhece pra conta: memória > espelho do aparelho > null (não sabe). */
export function origemConhecida(userId: string | null | undefined): OrigemDaConta | null {
  if (!userId) return null;
  const mem = origens.get(userId);
  if (mem) return mem;
  const v = ls.get(CHAVE_ORIGEM_APARELHO);
  if (v === `${userId}:nova`) return "nova";
  if (v === `${userId}:antiga`) return "antiga";
  return null;
}

/** Só a memória desta abertura (sem o espelho). */
export const origemEmMemoria = (userId: string): OrigemDaConta | null => origens.get(userId) ?? null;
/** Anota na memória SEM efeito colateral (pode ser chamado no render: não grava nem avisa). */
export const anotarOrigemEmMemoria = (userId: string, origem: OrigemDaConta): void => { origens.set(userId, origem); };

/** Registra a origem da conta (memória + espelho do aparelho) e avisa quem decide com React. */
export function registrarOrigem(userId: string, origem: OrigemDaConta): void {
  const espelho = ls.get(CHAVE_ORIGEM_APARELHO);
  origens.set(userId, origem);
  ls.set(CHAVE_ORIGEM_APARELHO, `${userId}:${origem}`);
  // avisa sempre que o espelho muda (a memória pode já ter sido anotada no render, sem aviso)
  if (espelho !== `${userId}:${origem}`) { try { window.dispatchEvent(new CustomEvent(EVENTO_ORIGEM_HOME_NOVA, { detail: { origem } })); } catch { /* sem window */ } }
}

/** A conta (da sessão, se nenhuma for passada) é NOVA? — o score sem pontos de graça e o modo "novas" leem isto. */
export const contaEhNova = (userId?: string | null): boolean => origemConhecida(userId ?? contaDaSessao) === "nova";

/** Guarda `?home-nova=` (on|off grava a força; auto desfaz). */
export function guardarForcaHomeNova(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = (p.get(PARAM_HOME_NOVA) ?? "").toLowerCase();
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_HOME_NOVA, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_HOME_NOVA);
}

/** A força de QA deste aparelho, se houver. */
export function forcaHomeNova(): "on" | "off" | null {
  const f = ls.get(CHAVE_FORCA_HOME_NOVA);
  return f === "on" || f === "off" ? f : null;
}

/** O modo que valeria AGORA, sem o fixado: o que o RevenueCat disse nesta abertura > a última resposta do aparelho >
 *  o padrão da plataforma (app "novas+admin", site "off"). */
function modoVivo(): ModoHomeNova {
  // 1.0.21 modo 1.0.12: a Home nova pra conta nova é parte da versão (um "off" remoto pensado pros apps antigos não a tira)
  if (modo1012() && isNativeShell() && isIOS()) return MODO_PADRAO_APP;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_HOME_NOVA_APARELHO)) ?? padraoHomeNova();
}

/** O modo AQUI: o fixado desta abertura, senão o vivo. (A força de QA é tratada em homeNovaLigada.) */
export function modoHomeNova(): ModoHomeNova {
  return modoFixo ?? modoVivo();
}

/**
 * 26/10: FIXA o modo desta abertura (1x; as próximas chamadas não mudam nada). Quem decide com uma conta na mão chama
 * isto (useHomeNova, homeNovaLigadaSincrona com conta): daí em diante uma resposta do RevenueCat — inclusive "off" — só
 * é guardada e vale na PRÓXIMA abertura. É o que garante que a Home nunca troca na frente da pessoa.
 */
export function fixarModoDaAbertura(): ModoHomeNova {
  if (!modoFixo) modoFixo = modoVivo();
  return modoFixo;
}

/** Sorteio 50/50 determinístico pelo id (FNV-1a 32 bits, sal próprio — não compartilha braço com o sino nem com o dia 1). */
export function sortearBracoHomeNova(id: string): BracoHomeNova {
  let h = 0x811c9dc5;
  const s = `home-nova:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "nova" : "atual";
}

/** O braço deste aparelho no modo "ab" (gravado na 1ª vez, estável entre aberturas). */
export function bracoHomeNova(): BracoHomeNova {
  const gravado = bracoDe(ls.get(CHAVE_BRACO_HOME_NOVA));
  if (gravado) return gravado;
  const sorteado = sortearBracoHomeNova(idDoAparelho());
  ls.set(CHAVE_BRACO_HOME_NOVA, sorteado);
  return sorteado;
}

/** O modo "admin" (ou "novas+admin") precisa da checagem de admin (sem força de QA por cima)? */
export const homeNovaPrecisaDeAdmin = (): boolean => {
  if (forcaHomeNova() !== null) return false;
  const m = modoHomeNova();
  return m === "admin" || m === "novas+admin";
};

/** A resposta da checagem de admin guardada neste aparelho PARA ESTA conta (null = nunca checou). */
export function lerAdminGuardado(userId: string | null | undefined): boolean | null {
  if (!userId) return null;
  const v = ls.get(CHAVE_ADMIN_HOME_NOVA);
  if (v === `${userId}:1`) return true;
  if (v === `${userId}:0`) return false;
  return null;
}
export function guardarAdmin(userId: string, ok: boolean): void {
  ls.set(CHAVE_ADMIN_HOME_NOVA, `${userId}:${ok ? "1" : "0"}`);
  adminAtual = ok;
}
/** O hook avisa o que descobriu (pra quem decide sem React: rotas, eventos). */
export const informarAdminHomeNova = (ok: boolean | null): void => { adminAtual = ok; };
export const adminHomeNovaConhecido = (): boolean | null => adminAtual;

/**
 * A decisão: a Home nova está ligada AQUI? força de QA (on|off) > modo remoto:
 * off → não · on → sim · admin → só se `admin` for true · ab → o braço sorteado é "nova" ·
 * novas → só se a origem da conta for "nova" (desconhecida = não) · novas+admin → origem "nova" OU admin.
 * (A origem DESCONHECIDA nunca chega à Home nas lojas: pages/Home espera a decisão — ver origemJaTentada.)
 */
export function homeNovaLigada(admin: boolean | null, origem: OrigemDaConta | null = null): boolean {
  const f = forcaHomeNova();
  if (f) return f === "on";
  const modo = modoHomeNova();
  if (modo === "off") return false;
  if (modo === "on") return true;
  if (modo === "admin") return admin === true;
  if (modo === "novas") return origem === "nova";
  if (modo === "novas+admin") return origem === "nova" || admin === true;
  return bracoHomeNova() === "nova";
}

/** A mesma decisão sem React (rotas, barra, missão, tour): a resposta de admin desta abertura ou a guardada pra conta,
 *  e a origem conhecida da conta. Sem `userId`, a conta da sessão (OrigemDaContaNaSessao). */
export function homeNovaLigadaSincrona(userId?: string | null): boolean {
  try {
    const id = userId ?? contaDaSessao;
    if (id) fixarModoDaAbertura();
    return homeNovaLigada(adminAtual ?? lerAdminGuardado(id), origemConhecida(id));
  } catch { return false; }
}

/** 1.0.19 (dono 26/10): o tom do botão principal das folhas da missão que abrem POR CIMA da Home ("Dia 1 feito ·
 *  Combinado", "Dia 2: Rotina · Começar", a escolha do dia 2, o plano do braço B, a pré-folha do lembrete) — com a Home
 *  nova ligada, "e" (a tinta da E: preto no claro, claro no escuro, canto cheio, como o "+" e o "Continuar" da
 *  CelebracaoDia100E — missao-doses.css); com a Home antiga, o magenta de sempre. */
export const tomDoBotaoDaMissao = (userId?: string | null): "e" | "magenta" => (homeNovaLigadaSincrona(userId) ? "e" : "magenta");

/** Os campos dos eventos: com a chave em qualquer modo que não "off", qual Home a pessoa vê. */
export function camposHomeNova(userId?: string | null): { home_nova?: BracoHomeNova } {
  try {
    if (forcaHomeNova() === null && modoHomeNova() === "off") return {};
    return { home_nova: homeNovaLigadaSincrona(userId) ? "nova" : "atual" };
  } catch { return {}; }
}
