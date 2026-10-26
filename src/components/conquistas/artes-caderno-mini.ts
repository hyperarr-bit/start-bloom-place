import { useEffect, useState } from "react";
import { ARTES_CADERNO } from "./artes-caderno";

/**
 * AS MINIATURAS DA GRADE (varredura 26/10 — Conquistas › "Ver todas" com figurinhas em branco/cortadas ao rolar rápido).
 *
 * A grade desenhava cada célula (≤ 96 pt) a partir da arte de 640×640 (~1,6 MB decodificada; ~160 MB as 99) num
 * `<image>` de SVG — o WebKit pintava parcial/vazio quando a imagem ainda decodificava ou tinha sido descartada, e não
 * repintava. Agora a grade usa miniaturas de 288 px (3× a célula no iPhone: a mesma nitidez; ~33 MB decodificadas
 * todas juntas), geradas por `scripts/miniaturas-figurinhas.mjs` em src/assets/conquistas-caderno/mini/<id>.webp, num
 * `<img>` comum (que repinta sozinho). O detalhe/zoom, o álbum, a festa e o compartilhar seguem com a arte grande.
 */
const minis = import.meta.glob<string>("/src/assets/conquistas-caderno/mini/*.webp", { eager: true, query: "?url", import: "default" });
export const ARTES_MINI: Record<string, string> = Object.fromEntries(
  Object.entries(minis).map(([p, url]) => [p.split("/").pop()!.replace(".webp", ""), url]),
);
/** A miniatura da figurinha (cai na arte grande se faltar — nunca célula sem arte). */
export const arteMini = (id: string): string | undefined => ARTES_MINI[id] ?? ARTES_CADERNO[id];

/* ------------------------------------------------ pronta = baixada E decodificada (uma vez por URL, na abertura) */
const prontas = new Set<string>();
const pedidas = new Map<string, Promise<void>>();
const ouvintes = new Set<() => void>();
/** As Image de pré-carga ficam vivas (na memória do módulo): o WebKit mantém o recurso no cache da página. */
const vivas: HTMLImageElement[] = [];

export const imagemPronta = (url: string | undefined): boolean => !url || prontas.has(url);

const marcarPronta = (url: string) => {
  if (prontas.has(url)) return;
  prontas.add(url);
  ouvintes.forEach((o) => o());
};

/** Baixa e decodifica (decode(); sem decode = no load). O decode do WebKit às vezes não volta com dezenas juntas: depois
 *  do load, no máximo 1,5 s de espera — aí vale pronta (o <img> da célula repinta sozinho quando terminar). */
export function precarregar(url: string | undefined): Promise<void> {
  if (!url || typeof Image === "undefined") return Promise.resolve();
  const ja = pedidas.get(url);
  if (ja) return ja;
  const p = new Promise<void>((ok) => {
    const img = new Image();
    img.decoding = "async";
    vivas.push(img);
    let feito = false;
    const fim = () => { if (feito) return; feito = true; marcarPronta(url); ok(); };
    img.onload = () => {
      const d = typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve();
      Promise.race([d, new Promise((r) => window.setTimeout(r, 1500))]).then(fim);
    };
    img.onerror = fim; // sem a miniatura: a célula não fica esperando pra sempre
    img.src = url;
  });
  pedidas.set(url, p);
  return p;
}

/** Ao abrir Conquistas (antes do "Ver todas"): todas as miniaturas, sem pressa. */
export const precarregarMinis = (): void => { for (const u of new Set(Object.values(ARTES_MINI))) void precarregar(u); };

/** A célula sabe quando a SUA miniatura já está pronta (re-render só dela). */
export function useImagemPronta(url: string | undefined): boolean {
  const [pronta, setPronta] = useState(() => imagemPronta(url));
  useEffect(() => {
    if (imagemPronta(url)) { setPronta(true); return; }
    setPronta(false);
    const ouvir = () => { if (imagemPronta(url)) setPronta(true); };
    ouvintes.add(ouvir);
    void precarregar(url);
    return () => { ouvintes.delete(ouvir); };
  }, [url]);
  return pronta;
}

/** só testes */
export const __zerarMinis = () => { prontas.clear(); pedidas.clear(); vivas.length = 0; };
