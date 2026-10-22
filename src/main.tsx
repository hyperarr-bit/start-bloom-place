import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/escuro.css"; // modo escuro como sistema (gerado por scripts/gerar-escuro.mjs) — depois do index.css de propósito
import { trackEvent, captureLandingMeta, iniciarMedicaoDoAparelho } from "@/lib/analytics";
import { initPwaInstall } from "@/lib/pwa-install";
import { isNativeShell } from "@/lib/native-shell";
import { instalarTrocaDeRotaSemBranco } from "@/lib/troca-de-rota";
import { instalarResizeObserverSePreciso } from "@/lib/resize-observer-fallback";
import { instalarArrastarComMouse } from "@/lib/arrastar-com-mouse";
import { ehErroDeChunk, recarregarPorChunkNovo } from "@/lib/chunk-novo";
import { guardarForcaDaCobrancaV14 } from "@/lib/cobranca-recusada";
import { guardarForcaCardRecusa } from "@/lib/card-recusa";
import { guardarForcaDegrau2, guardarForcaMotivos } from "@/lib/mensal-degraus";
import { guardarForcaDaAvaliacaoV14 } from "@/lib/avaliacao-v14";
import { guardarForcaAvaliacaoTesteDia2 } from "@/lib/avaliacao-teste-dia2";
import { guardarForcaDasOfertas } from "@/lib/ofertas-saida";
import { guardarForcaConquistas2 } from "@/lib/conquistas2";
import { guardarForcaDesafiosRodizio } from "@/lib/desafios-rodizio";
import { guardarForcaMedicaoTotal, instalarMedicaoTotal } from "@/lib/medicao-total";
import { precisaRestaurar, restaurarDaCopia } from "@/missao/seguranca";

// Rede de segurança da classe core-shell (o index.html já tenta no boot):
// se a injeção do Capacitor chegar depois do bloco inline por qualquer
// mudança de ordem, aqui garante antes do React montar. O CSS do shell
// (ex.: matar outline de foco preso) depende só desta classe.
if (isNativeShell()) document.documentElement.classList.add("core-shell");
// 1.0.17 QA: troca de rota sem quadro em branco (foto da tela de antes por cima, cross-fade de 200 ms) — só no app
if (isNativeShell()) instalarTrocaDeRotaSemBranco();

// 10/10 (1.0.14): device_id, turma e versão em TODO evento + app_primeira_abertura
// (1× por aparelho, só no app das lojas). Antes do React: os primeiros eventos
// do boot já saem com a ficha. Ver lib/aparelho.
void iniciarMedicaoDoAparelho();
// As chaves de QA da 1.0.14 pelo link (`?cobranca-v14=on`, `?avaliacao-v14=on`): gravadas no aparelho, como a MISSAO_DOSES.
guardarForcaDaCobrancaV14();
guardarForcaDegrau2(); // 1.0.18: `?recusa-degrau2=on|off|auto|agora[,recomecar]` — o 2º degrau da recusa (mensal 19,90)
guardarForcaMotivos(); // 1.0.18: `?motivos-folha=on|off|ab|auto` — a folha "O que te fez parar?" no paywall do funil
guardarForcaCardRecusa(); // 1.0.18: `?card-recusa=on|off|auto[,recomecar]` — o card de tela inteira do cartão recusado
guardarForcaDaAvaliacaoV14();
guardarForcaAvaliacaoTesteDia2(); // 1.0.18: `?avaliacao-teste-dia2=on|off|auto` — pedir nota também pro teste que voltou no dia 2
guardarForcaConquistas2(); // `?conquistas2=on|off|auto`: a tela nova de Conquistas neste aparelho (QA)
guardarForcaDesafiosRodizio(); // `?desafios-rodizio=on|off|auto`: o rodízio dos desafios da semana neste navegador (QA)
guardarForcaDasOfertas(); // `?ofertas-saida=…` em qualquer rota: o paywall enxuto mora no gate e no /planos, não só no funil
// 1.0.16 — medição total: os toques das telas do app contados em memória e enviados num `uso_resumo` por
// sessão (segundo plano/fechar). Chave remota `medicao_total`; `?medicao-total=on|off|auto` no navegador (QA).
guardarForcaMedicaoTotal();
instalarMedicaoTotal();

// Navegador/WebView sem ResizeObserver derrubava o módulo Finanças INTEIRO
// (o Recharts exige, e o throw sobe até o RouteErrorBoundary). Instala antes
// do React montar; em navegador moderno isto é um `if` e nada mais.
instalarResizeObserverSePreciso();

// Mouse arrasta as faixas que rolam pro lado (web/PC). No toque não faz nada.
instalarArrastarComMouse();

// Telemetria de crash (15/07): cliente reportou "tela branca ao pagar" e a
// gente só tinha silêncio nos eventos — sem isso, todo crash é adivinhação.
// Rate-limit de 1 report/20s pra nunca inundar o analytics em loop de erro.
let lastJsErrorAt = 0;
const reportJsError = (kind: string, message: string, extra: Record<string, unknown> = {}) => {
  const now = Date.now();
  if (now - lastJsErrorAt < 20_000) return;
  lastJsErrorAt = now;
  try {
    trackEvent("js_error", {
      kind,
      message: String(message || "?").slice(0, 300),
      route: window.location.pathname + window.location.search.slice(0, 60),
      ua: navigator.userAgent.slice(0, 160),
      // 08/10: o painel do admin agrupa js_error sem saber o que é chunk velho
      // de deploy e o que é crash de verdade — agora vem marcado.
      chunk: ehErroDeChunk(message),
      ...extra,
    });
  } catch { /* nunca deixar o report derrubar nada */ }
};
// 08/10 (12 "Failed to fetch dynamically imported module" no painel depois dos
// deploys): erro de chunk que NÃO passa pelo vite:preloadError nem por um
// RouteErrorBoundary (rota sem boundary — o React relança no window.onerror;
// import() solto que rejeita) só virava evento. Agora recarrega UMA vez por
// sessão também por aqui (regra única em src/lib/chunk-novo.ts).
const recarregarSeForChunk = (message: unknown) => {
  if (ehErroDeChunk(message)) recarregarPorChunkNovo();
};
window.addEventListener("error", (e) => {
  reportJsError("error", e.message, { source: `${e.filename?.split("/").pop() ?? "?"}:${e.lineno ?? "?"}` });
  recarregarSeForChunk(e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = (e as PromiseRejectionEvent).reason;
  const message = r?.message ?? String(r ?? "?");
  reportJsError("unhandledrejection", message);
  recarregarSeForChunk(message);
});

// Deploy troca os chunks hasheados e APAGA os antigos. Quem estava com o site
// aberto de antes fica com imports quebrados → TELA BRANCA (caso real 15/07:
// cliente travada no "vou pagar e fica branco"). O Vite emite vite:preloadError
// nesses casos — recarrega 1x pra pegar a versão nova. Guarda em sessionStorage
// evita loop se o reload não resolver.
//
// NUNCA chamar event.preventDefault() aqui (16/08 — era o crash nº1 de
// produção, 11 telas quebradas em /casa e 10 pessoas DIFERENTES em 7 dias).
// O helper do Vite é `carrega().catch(aoFalhar)`, e `aoFalhar` só RELANÇA se
// ninguém tiver chamado preventDefault. Com o preventDefault, aquele catch
// RESOLVE `undefined` — o React.lazy guarda _result=undefined e o
// lazyInitializer lê `undefined.default`, estourando
// "Cannot read properties of undefined (reading 'default')". Ou seja: a
// proteção contra tela branca estava CRIANDO um crash pior, porque o
// TypeError genérico não parece erro de chunk e o boundary não recarregava.
// Deixando o erro subir, a rejeição chega com a mensagem verdadeira
// ("dynamically imported module"), que o RouteErrorBoundary já sabe tratar.
//
// 08/10: a decisão de recarregar (1x por sessão, nunca sem rede, com
// cache-buster) mora em src/lib/chunk-novo.ts e é a MESMA do RouteErrorBoundary
// e dos handlers de erro acima — quem chegar primeiro recarrega, os outros
// veem o carimbo e se calam. Antes eram três réguas diferentes (30 s aqui,
// 60 s no boundary, nada no import() solto).
window.addEventListener("vite:preloadError", () => { recarregarPorChunkNovo(); });

// Always unregister any previously-installed service worker and wipe caches.
// Past versions of this app may have registered a SW that is now serving
// stale HTML/JS/assets to returning visitors. This self-heals them.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {});
  }
}



// Captura o beforeinstallprompt ANTES do React montar (o evento pode disparar
// cedo e só dispara uma vez). Sem service worker: o bloco acima continua
// desregistrando qualquer SW — Chrome instala só com o manifest.
initPwaInstall();

/* UTM/fbclid no BOOT, antes do router (12/08). A captura vivia só no
 * useEffect das páginas de funil — e efeito roda DEPOIS do commit, quando o
 * <Navigate replace> de quem já é logado/assinante (ComecarDia14) ou da raiz
 * (RootGate) já limpou a URL. Resultado medido hoje: 6 de 10 vendas web "sem
 * utm" no banco e na UTMify — todas de gente com conta antiga que clicou no
 * anúncio de novo — enquanto o pixel da Meta (que lê a URL no boot, antes do
 * redirect) atribuía normalmente. Aqui é síncrono e ANTES do createRoot:
 * nenhum redirect corre antes. As chamadas nas páginas ficam — são no-op
 * inofensivo (a linha 40 da analytics não sobrescreve pago com vazio). */
captureLandingMeta();

// Teste de gateway por link (?gw=cakto): grava NA CHEGADA. O checkout lê isso
// quando abre, mas o funil troca a URL antes e o parâmetro se perdia (25/09).
try {
  const gw = new URLSearchParams(window.location.search).get("gw");
  if (gw && /^(asaas|cakto|pagarme|abacate)$/.test(gw)) sessionStorage.setItem("pix-gw-teste", gw);
} catch { /* noop */ }

const montarApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
  // 02/09: os pixels de anúncio (index.html) só carregam depois da 1ª pintura —
  // o aviso sai no frame seguinte ao mount, quando a porta já está na tela.
  requestAnimationFrame(() => { setTimeout(() => { try { window.dispatchEvent(new Event("core:montou")); } catch { /* noop */ } }, 0); });
};
// 18/10 (funil da missão): o navegador do Instagram zerou o storage e recarregou no meio do dia 1 da convidada →
// a cópia do IndexedDB volta ANTES do React (missao/seguranca). Só com o cookie do funil; senão, monta direto.
if (!isNativeShell() && precisaRestaurar()) void restaurarDaCopia().catch(() => false).finally(montarApp);
else montarApp();
