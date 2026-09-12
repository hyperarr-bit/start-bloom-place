/**
 * MEDIÇÃO DE CARDS (12/09, dono: "não seria bom botar medição de card pra
 * saber o que melhorar?").
 *
 * Até aqui a telemetria parava na ABA (module_analytics): dava pra saber que
 * `rotina › semana` é a segunda aba mais aberta do app, mas não se alguém
 * toca no card "Urgências" ou se ele só ocupa espaço. Foi essa cegueira que
 * deixou o bloco de fases entrar por uma avaliação e ficar por dez dias sem
 * ninguém saber se era usado.
 *
 * Como funciona, sem tocar em nenhum módulo:
 *  - card = elemento com `rounded` + `border` na classe, que não está dentro
 *    de outro card, com um título (heading ou texto em caixa alta em
 *    negrito) — é o desenho que os 16 módulos já usam. `data-card="chave"`
 *    num elemento vale mais que a detecção, pra quem quiser precisão.
 *  - `card_view`: uma vez por sessão por módulo/aba/card, quando 30% do
 *    card entra na tela (IntersectionObserver).
 *  - `card_interact`: uma vez por sessão por módulo/aba/card, no primeiro
 *    clique, digitação ou troca de valor dentro do card.
 * A chave é o título normalizado (caixa alta, sem emoji, número ou
 * pontuação, até 32 letras): "URGÊNCIAS", "COMO VOCÊ ESTÁ HOJE",
 * "RITUAL MATINAL". Contadores no título ("0/2 feitas") ficam de fora
 * porque a chave é o PRIMEIRO texto forte do card, não o cabeçalho inteiro.
 *
 * Relatório: `npm run cards` (scripts/cards.mjs) — por módulo e aba, quantas
 * pessoas viram cada card e quantas usaram.
 */
import { trackEvent } from "@/lib/analytics";

const VISTOS = "core_cards_vistos";
const USADOS = "core_cards_usados";
const MARCA = "__coreCard";

type ComMarca = HTMLElement & { [MARCA]?: string };

const lembrar = (chaveStorage: string, chave: string): boolean => {
  try {
    const lista: string[] = JSON.parse(sessionStorage.getItem(chaveStorage) || "[]");
    if (lista.includes(chave)) return true;
    lista.push(chave);
    sessionStorage.setItem(chaveStorage, JSON.stringify(lista.slice(-400)));
    return false;
  } catch {
    return false;
  }
};

/** "🔁 O QUE VOCÊ REPETE NO DIA" → "O QUE VOCE REPETE NO DIA" (sem acento,
 *  sem emoji, sem número), no máximo 32 caracteres. Exportado pro teste. */
export const normalizarChave = (texto: string): string =>
  texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 32)
    .trim();

const ehCaixaAlta = (t: string) => {
  const letras = t.replace(/[^\p{L}]/gu, "");
  if (letras.length < 3) return false;
  const altas = letras.replace(/[^\p{Lu}]/gu, "").length;
  return altas / letras.length >= 0.6;
};

/** Título do card: o primeiro texto forte (heading, ou negrito em caixa alta). */
export const tituloDoCard = (el: Element): string | null => {
  const explicito = el.getAttribute("data-card");
  if (explicito) return explicito;
  const candidatos = el.querySelectorAll('h1,h2,h3,h4,[class*="font-black"],[class*="font-bold"],[class*="font-semibold"]');
  for (const c of candidatos) {
    // texto PRÓPRIO do elemento e dos filhos inline curtos — sem descer no card inteiro
    // innerText respeita <br> como espaço ("CONSISTÊNCIA<br>VENCE" não vira uma palavra só)
    const t = ((c as HTMLElement).innerText ?? c.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 80) continue;
    // `uppercase` na classe conta como caixa alta: o texto do DOM pode ser "Lidos (6)"
    // e a tela mostrar "LIDOS (6)" (innerText só aplica isso em navegador de verdade)
    const caixaAltaPorCss = /\buppercase\b/.test(String(c.className || ""));
    if (c.tagName === "H1" || c.tagName === "H2" || c.tagName === "H3" || c.tagName === "H4" || ehCaixaAlta(t) || caixaAltaPorCss) {
      const chave = normalizarChave(t);
      if (chave.length >= 4) return chave; // "SEG", "TER" dos dias da semana ficam de fora
    }
  }
  return null;
};

const pareceCard = (el: Element): boolean => {
  const cls = String(el.className || "");
  return /\brounded/.test(cls) && /\bborder\b/.test(cls);
};

export function instalarMedicaoDeCards(modulo: string, abaAtual: () => string | null): () => void {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return () => {};
  const raiz = document.getElementById("root") || document.body;
  const observados = new Set<Element>();

  const chaveDe = (el: ComMarca) => `${modulo}/${abaAtual() || ""}/${el[MARCA] || ""}`;

  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const el = e.target as ComMarca;
      io.unobserve(el);
      const card = el[MARCA];
      if (!card) continue;
      if (lembrar(VISTOS, chaveDe(el))) continue;
      trackEvent("card_view", { modulo, aba: abaAtual() || "", card });
    }
  }, { threshold: 0.3 });

  const varrer = () => {
    const todos = raiz.querySelectorAll('[data-card],[class*="rounded"][class*="border"]');
    for (const el of todos) {
      if (observados.has(el)) continue;
      if (!el.hasAttribute("data-card")) {
        if (!pareceCard(el)) continue;
        // só o card de FORA: um card dentro de outro é parte dele
        const pai = el.parentElement?.closest('[data-card],[class*="rounded"][class*="border"]');
        if (pai && (pai.hasAttribute("data-card") || pareceCard(pai))) continue;
        if ((el as HTMLElement).offsetHeight < 60) continue;
      }
      const titulo = tituloDoCard(el);
      if (!titulo) continue;
      (el as ComMarca)[MARCA] = titulo;
      observados.add(el);
      io.observe(el);
    }
  };

  let agendado: number | null = null;
  const agendarVarredura = () => {
    if (agendado !== null) return;
    agendado = window.setTimeout(() => { agendado = null; varrer(); }, 300);
  };
  const mo = new MutationObserver(agendarVarredura);
  mo.observe(raiz, { childList: true, subtree: true });
  agendarVarredura();

  const interagiu = (ev: Event) => {
    const alvo = ev.target as Element | null;
    if (!alvo || !(alvo instanceof Element)) return;
    let el: Element | null = alvo;
    while (el && el !== raiz) {
      if (observados.has(el)) break;
      el = el.parentElement;
    }
    if (!el || el === raiz) return;
    const card = (el as ComMarca)[MARCA];
    if (!card) return;
    if (lembrar(USADOS, chaveDe(el as ComMarca))) return;
    trackEvent("card_interact", { modulo, aba: abaAtual() || "", card });
  };
  document.addEventListener("click", interagiu, true);
  document.addEventListener("input", interagiu, true);
  document.addEventListener("change", interagiu, true);

  return () => {
    if (agendado !== null) window.clearTimeout(agendado);
    mo.disconnect();
    io.disconnect();
    document.removeEventListener("click", interagiu, true);
    document.removeEventListener("input", interagiu, true);
    document.removeEventListener("change", interagiu, true);
  };
}
