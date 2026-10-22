/**
 * ATT no iPhONE (19/09) — pedido de rastreamento, do jeito que a Apple aceita.
 *
 * Contexto: 0% dos usuários de iPhone têm rastreamento ligado (Gerenciador de
 * Eventos da Meta), porque a build 13 nasceu SEM o pedido — decisão de 07/09
 * depois de duas recusas 2.1 "unable to locate the ATT permission request",
 * que vieram do framework de ATT embarcado SEM diálogo. O caminho compatível
 * é o oposto: pedir de verdade, com texto em português, depois da welcome.
 *
 * O que muda quando a pessoa aceita: o `idPublicidade()` do plugin passa a
 * devolver o IDFA, a ficha do aparelho é regravada com ele, e o Purchase que o
 * servidor manda pra Meta vai com `madid` — atribuição por aparelho, com o
 * valor exato, em vez do modelo estatístico. No Brasil ~50% aceitam.
 *
 * Nunca trava o funil: sem plugin (web, Android, build antiga) devolve na
 * hora; no iPhone o sistema só mostra o diálogo UMA vez por instalação, e a
 * chave local evita chamar o plugin de novo à toa.
 */
import { capturarDispositivoApp, trackEvent } from "@/lib/analytics";

const CHAVE = "core-att-status";

export type StatusATT = "authorized" | "denied" | "restricted" | "notDetermined" | "nao_ios" | "ja_pedido" | "sem_plugin" | "pulado_porta";

/* ─────────────────────────────────────────────────────────────────────────────
 * QUEM VEIO DA PORTA NÃO VÊ O ATT (10/10, build 38 — dono: "não quero 2 avisos do sistema
 * na 1ª abertura"). A conta nasceu no site com a campanha gravada (fbc/utm em
 * user_metadata.porta): o ATT não acrescenta atribuição e é mais um diálogo laranja entre
 * ela e o paywall. Quem é da Porta:
 *   · o app abriu por `core://entrar?h=…` (deep-link.ts / PortaPrimeiraAbertura marcam
 *     ANTES do resgate — e no arranque frio a welcome nem monta, então o timer de 3 s dela
 *     não existe); ou
 *   · a sessão é de uma conta com `user_metadata.porta` (entrou pelo "Entrar" normal).
 * A marca é do APARELHO (`porta-sem-att`, fora da vassoura do logout) e vai pro nativo
 * (`CoreNativo.pularATT()`), que segura a RESERVA de 10 s do AppDelegate. O nativo também
 * marca sozinho quando recebe `core://entrar` (application(_:open:)) — não depende do JS
 * chegar antes dos 10 s. Todo mundo que não é da Porta: ATT exatamente como hoje.
 * ───────────────────────────────────────────────────────────────────────────── */
export const CHAVE_PORTA_SEM_ATT = "porta-sem-att";

const avisarNativo = async (): Promise<void> => {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "ios") return;
    // objeto embrulhado não precisa aqui: a promise resolve com o retorno do método, não com o plugin
    await registerPlugin<{ pularATT(): Promise<void> }>("CoreNativo").pularATT();
  } catch { /* build sem o método: a reserva nativa segue como antes */ }
};

/**
 * SEM PEDIDO AUTOMÁTICO NA WELCOME (1.0.18, dono 21/10): o diálogo do ATT não cai mais sozinho em cima do vídeo
 * da welcome (eram 3 s depois de abrir; 173 instalações fechavam o app em 3 s, 66 com o diálogo aberto). O pedido
 * sai só no toque em "Começar" (que já pedia) e, pra quem entra por outro caminho ("Já tem conta? Entrar" → gate),
 * na Home (que já pede). A reserva nativa de 10 s do AppDelegate (recusa 2.1 de 20/09: o revisor entrou pelo login
 * e nunca viu o diálogo) continua existindo pra quem NÃO passa pela welcome — a welcome a segura pelo mesmo
 * `CoreNativo.pularATT()` da Porta, SEM a marca permanente do aparelho: o JS segue pedindo no Começar e na Home.
 */
export function segurarReservaNativaDoATT(): void { void avisarNativo(); }

/** Marca o aparelho como "veio da Porta" e segura o ATT (JS e reserva nativa). Nunca lança. */
export function marcarPortaSemATT(): void {
  try { localStorage.setItem(CHAVE_PORTA_SEM_ATT, "1"); } catch { /* noop */ }
  void avisarNativo();
}

/** Na abertura do app: se o aparelho já é da Porta, repete o aviso pro nativo (a marca nativa é por processo). */
export function reavisarPortaSemATT(): void {
  let marcado = false;
  try { marcado = localStorage.getItem(CHAVE_PORTA_SEM_ATT) === "1"; } catch { /* noop */ }
  if (marcado) void avisarNativo();
}

/** É da Porta? (marca do aparelho, ou a sessão atual é de uma conta com user_metadata.porta) */
async function ehDaPorta(): Promise<boolean> {
  try { if (localStorage.getItem(CHAVE_PORTA_SEM_ATT) === "1") return true; } catch { /* noop */ }
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const porta = (data?.session?.user?.user_metadata as { porta?: unknown } | undefined)?.porta;
    if (porta && typeof porta === "object") { marcarPortaSemATT(); return true; }
  } catch { /* sem sessão legível: segue como hoje */ }
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * "notDetermined" NÃO É RESPOSTA (1.0.18 — raio-X do funil de 21/10: 641 instalações, 28 %, ficaram com o ATT
 * `notDetermined` pra sempre, 598 delas pelo pedido automático dos 3 s). O iOS devolve notDetermined quando o
 * diálogo NÃO chegou a aparecer (o app ainda não estava "ativo" na hora do pedido, ou o pedido foi interrompido) —
 * e o código gravava isso como "já pedido" e nunca mais perguntava. Agora:
 *   · notDetermined não grava nada: o próximo pedido natural que JÁ existe (o "Começar" da welcome, a Home, a
 *     próxima abertura) pergunta de novo;
 *   · no máximo 1 repetição por abertura do app (duas respostas notDetermined seguidas = espera a próxima abertura);
 *   · authorized / denied / restricted continuam gravados pra sempre — nunca se pergunta depois de uma resposta.
 * O momento do pedido (3 s depois da welcome) NÃO mudou: tirar o pedido automático é decisão do dono (anotado).
 * ───────────────────────────────────────────────────────────────────────────── */
const REPETICOES_POR_ABERTURA = 1;
let naoDeterminadosNestaAbertura = 0;
/** Só testes: simula uma nova abertura do app. */
export const _zerarAberturaDoATT = (): void => { naoDeterminadosNestaAbertura = 0; };

export async function pedirRastreamentoIos(origem: string): Promise<StatusATT> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "ios") return "nao_ios";
    // "notDetermined" gravado pelas versões 1.0.14–1.0.17 não é resposta: esses aparelhos voltam a ser perguntados
    try { const guardado = localStorage.getItem(CHAVE); if (guardado && guardado !== "notDetermined") return "ja_pedido"; } catch { /* modo privado */ }
    if (naoDeterminadosNestaAbertura > REPETICOES_POR_ABERTURA) return "ja_pedido"; // já repetiu nesta abertura: fica pra próxima
    if (await ehDaPorta()) return "pulado_porta";
    const MetaAds = registerPlugin<{ pedirRastreamento(): Promise<{ status: string }> }>("MetaAds");
    // 20 s de teto: se o diálogo não vier (build sem o método), o funil segue.
    const r = await Promise.race([
      MetaAds.pedirRastreamento(),
      new Promise<{ status: string }>((res) => setTimeout(() => res({ status: "sem_plugin" }), 20000)),
    ]);
    const status = (r?.status || "sem_plugin") as StatusATT;
    if (status === "notDetermined") {
      // o diálogo não apareceu: não grava (o próximo pedido pergunta de novo); o evento guarda qual tentativa foi
      naoDeterminadosNestaAbertura += 1;
      trackEvent("att_resposta", { status, origem, tentativa: naoDeterminadosNestaAbertura });
    } else if (status !== "sem_plugin") {
      try { localStorage.setItem(CHAVE, status); } catch { /* noop */ }
      trackEvent("att_resposta", { status, origem });
      // Aceitou: regrava a ficha do aparelho, agora com o IDFA dentro.
      if (status === "authorized") void capturarDispositivoApp();
    }
    return status;
  } catch {
    return "sem_plugin";
  }
}
