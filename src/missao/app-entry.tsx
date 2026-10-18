/**
 * O APP DE VERDADE, carregado por trás da 1ª tela do /missao (protótipo 18/10).
 *
 * O missao.html importa este módulo em SEGUNDO PLANO (src/missao/leve.ts) enquanto a pessoa lê as telas 1 e 2:
 * importar baixa e avalia o React + o App inteiro + o CSS do app, mas NÃO monta nada (o CSS do app é injetado
 * agora e não mexe no HTML leve: as classes dele são .mt-* e o #mt fica por cima). Quando ela toca no botão da
 * tela 2, `montar(area)` liga o convidado da missão, cria a missão (braço A, sem a tela de boas-vindas), troca a
 * URL pro módulo da área SEM recarregar e monta o App no #root — o tutorial abre na hora.
 *
 * Repete o que o main.tsx faz antes do createRoot e importa pro funil (fallback do ResizeObserver, captura de
 * UTM/fbclid enquanto a URL ainda é a do anúncio, erro de chunk → recarrega 1x). Sem service worker, sem PWA.
 */
import { createRoot } from "react-dom/client";
import App from "../App";
import "../index.css";
import "../styles/escuro.css";
import "./missao.css";
import { captureLandingMeta, trackEvent } from "@/lib/analytics";
import { instalarResizeObserverSePreciso } from "@/lib/resize-observer-fallback";
import { recarregarPorChunkNovo } from "@/lib/chunk-novo";
import { funilMissaoLigado, type AreaMissaoWeb } from "@/lib/missao-web";
import { prepararMissao } from "./preparar";

instalarResizeObserverSePreciso();
captureLandingMeta(); // AGORA: a URL ainda é a do anúncio (/missao?utm_…&fbclid=…)
const ligado = funilMissaoLigado(); // idem: guarda a força de QA (?funil-missao=on) antes de a URL virar /financas
window.addEventListener("vite:preloadError", () => { recarregarPorChunkNovo(); });

let montado = false;
/** Monta o App no #root, já no módulo da área. */
export function montar(area: AreaMissaoWeb, sessao: string, t0: number): void {
  if (montado) return;
  montado = true;
  if (!ligado) { window.location.replace("/"); return; } // chave FUNIL_MISSAO desligada e sem QA: o site de sempre
  const rota = prepararMissao(area, sessao);
  try { history.replaceState({ missao: area }, "", rota + window.location.hash); } catch { /* noop */ }
  const raiz = document.getElementById("root")!;
  raiz.classList.add("mt-entrando");
  createRoot(raiz).render(<App />);
  trackEvent("missao_web_app_montado", { area, missao_session_id: sessao, ms_desde_toque: Math.round(performance.now() - t0) });
  requestAnimationFrame(() => { setTimeout(() => { try { window.dispatchEvent(new Event("core:montou")); } catch { /* noop */ } }, 0); });
}

/** O módulo da 1ª dose em segundo plano (o mesmo chunk do lazy do App.tsx: o React.lazy acha o módulo pronto). */
const PAGINA_DA_AREA: Record<AreaMissaoWeb, () => Promise<unknown>> = {
  dinheiro: () => import("../pages/Index"),
  tudo: () => import("../pages/Index"),
  rotina: () => import("../pages/Rotina"),
  corpo: () => import("../pages/Treino"),
  metas: () => import("../pages/DesenvolvimentoPessoal"),
};
export function preaquecer(area: AreaMissaoWeb): Promise<unknown> {
  return Promise.all([PAGINA_DA_AREA[area]().catch(() => null), import("./FunilMissaoCamada").catch(() => null)]);
}
