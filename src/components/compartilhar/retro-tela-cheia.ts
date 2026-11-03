import { isNativeShell } from "@/lib/native-shell";
import { FORMATOS } from "./tipos";
import { luminancia } from "./temas";

/**
 * A RETROSPECTIVA EM TELA CHEIA (02/11, protótipo) — A CHAVE E AS CONTAS.
 *
 * O dono viu a retrospectiva de outubro (o card pequeno numa moldura, com
 * "Stories | Feed", "Postar nos Stories" e "Salvar" embaixo de CADA card) e
 * pediu: "tem que ser assim [tela cheia como o Spotify], o principal". Ligada,
 * cada card ocupa a tela inteira, passa sozinho (barrinhas no topo), toque à
 * direita avança, à esquerda volta, segurar pausa, arrastar pra baixo ou o X
 * fecha. Compartilhar virou o ícone do canto (a folha de baixo) e o botão
 * grande "Compartilhar meu outubro" no último card.
 *
 * COMO DESLIGAR (rollback): trocar "on" por "off" em RETRO_TELA_CHEIA aqui
 * (site: + push; app: + build nova). Desligada, a retrospectiva volta a ser
 * byte a byte a de antes (RetroOutubro › RetroOutubroClassica).
 *
 * PRA OLHAR AS DUAS NO MESMO NAVEGADOR (só na web, nunca no app das lojas):
 * `/retrospectiva?retro=outubro&retro-tela=classica` (a antiga) ou
 * `&retro-tela=cheia` (a nova); `&retro-tela=auto` volta pra constante.
 * Fica gravado em localStorage `retro-tela-cheia-force`.
 */
export type ModoTelaCheia = "on" | "off";

export const RETRO_TELA_CHEIA: ModoTelaCheia = "on";

export const CHAVE_FORCA_TELA_CHEIA = "retro-tela-cheia-force";
export const PARAM_QA_TELA = "retro-tela";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/** `?retro-tela=cheia|classica|auto` (só web): grava/apaga a força deste navegador. */
export function guardarForcaTelaCheia(busca?: string | URLSearchParams): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = p.get(PARAM_QA_TELA);
  if (v === "cheia" || v === "on") ls.set(CHAVE_FORCA_TELA_CHEIA, "on");
  else if (v === "classica" || v === "off") ls.set(CHAVE_FORCA_TELA_CHEIA, "off");
  else if (v === "auto") ls.del(CHAVE_FORCA_TELA_CHEIA);
}

/** A tela cheia vale pra esta abertura? (força de QA da web → constante) */
export function telaCheiaLigada(): boolean {
  guardarForcaTelaCheia();
  const f = isNativeShell() ? null : ls.get(CHAVE_FORCA_TELA_CHEIA);
  return (f === "on" || f === "off" ? f : RETRO_TELA_CHEIA) === "on";
}

/* ------------------------------------------------------------------------- *
 * O TEMPO DE CADA CARD
 * ------------------------------------------------------------------------- */

export const TEMPOS = {
  /** A abertura (os mini-cards entrando). */
  abertura: 6000,
  /** Card sem animação (aparelho sem vídeo) ou enquanto a animação não vem. */
  padrao: 6000,
  /** Card de módulo: a animação inteira + este respiro, entre o mínimo e o máximo. */
  respiro: 1500,
  minimo: 5500,
  maximo: 9000,
  /** Abertura: se a animação não ficar pronta em tanto tempo, o relógio anda assim mesmo (com o card parado). */
  esperaMaxima: 2500,
  /** Os outros cards: a animação vem pronta de antes (é preparada enquanto o card anterior passa); se não vier neste
   *  tempo (a pessoa tocou rápido), o card aparece PARADO — nunca a tela só com o fundo esperando. */
  esperaCard: 500,
  /** Segurar mais que isto = pausa (menos é um toque). */
  segurar: 220,
  /** Arrastar pra baixo mais que isto fecha. */
  arrastoFecha: 110,
  /** (02/11) O "adivinha": sem toque, revela sozinho depois disto… */
  adivinha: 8000,
  /** …e a resposta fica na tela isto antes de passar pro card. */
  resposta: 2200,
} as const;

/** (02/11) Segundos em que só a frase do card aparece antes do número entrar contando (o suspense). */
export const SUSPENSE = 0.7;

/** Quanto o card fica na tela antes de passar sozinho (ms). `duracaoAnimacao` em segundos. */
export function tempoDoCard(id: string, duracaoAnimacao?: number | null): number {
  if (id === "abertura") return Math.max(TEMPOS.abertura, duracaoAnimacao ? Math.round(duracaoAnimacao * 1000) + 600 : 0);
  if (!duracaoAnimacao) return TEMPOS.padrao;
  return Math.min(TEMPOS.maximo, Math.max(TEMPOS.minimo, Math.round(duracaoAnimacao * 1000) + TEMPOS.respiro));
}

/* ------------------------------------------------------------------------- *
 * ONDE O CARD FICA NA TELA
 * ------------------------------------------------------------------------- */

/**
 * (02/11, dono: "tem muito espaço em branco no topo, as coisas só começam no meio") O card de Stories (1080×1920)
 * tem as faixas de cima (0–250) e de baixo (1660–1920) VAZIAS de propósito — a zona segura do Instagram. Na tela
 * cheia elas não servem pra nada: o CONTEÚDO (do chip do topo, em 250, até o fim da assinatura, em ~1660) é que
 * é encaixado — o chip logo abaixo das barrinhas/botões, a largura com uma margem fina dos lados (a margem do
 * card, 84 px, sai pra fora da tela), e o que sobra de altura vira `extra` (cards.tsx › AlturaExtraCtx): o card
 * fica mais comprido só aqui e o que mora embaixo (estatísticas, assinatura) desce até o pé. Sem faixa vazia em
 * cima nem embaixo. A imagem e o vídeo de postar não mudam (extra = 0 lá).
 */
export const CONTEUDO = { topo: 250, fim: 1660, largura: 912 } as const;
/** Altura das barrinhas + linha dos botões (abaixo da área segura de cima). */
export const ALTURA_CONTROLES = 64;
/** O respiro entre os botões e o chip do card. */
export const FOLGA_TOPO = 6;
/** A margem do conteúdo até a borda da tela, dos lados. */
export const MARGEM_LADO = 18;
/** O que fica livre embaixo do card: nada (só o respiro), a pílula "Compartilhar" ou os botões do último card. */
export const RESERVA_BASE = { nada: 14, pilula: 66, final: 124 } as const;
export type ReservaBase = keyof typeof RESERVA_BASE;
/** O card nunca cresce mais que isto (tela muito comprida: o resto é o fundo). */
export const EXTRA_MAXIMO = 900;
/** Tela mais larga que isto (tablet, PC): uma coluna 9:16 no meio, com fundo escuro em volta. */
export const PROPORCAO_COLUNA = 0.62;

export interface Encaixe {
  /** A largura da coluna (= a tela no celular). */
  coluna: number;
  escala: number;
  /** Onde o card fica DENTRO da coluna (px de tela). w/h já com o extra. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** px de CARD a mais de altura (o card desenhado tem 1920 + extra). */
  extra: number;
}

export function encaixeDoCard(o: { largura: number; altura: number; topoSeguro: number; baseSeguro: number; reserva?: ReservaBase }): Encaixe {
  const { w: CW, h: CH } = FORMATOS.stories;
  const H = Math.max(1, o.altura);
  const coluna = o.largura / H > PROPORCAO_COLUNA ? Math.min(o.largura, Math.round((H * CW) / CH)) : o.largura;
  const topo = o.topoSeguro + ALTURA_CONTROLES + FOLGA_TOPO;
  const base = H - o.baseSeguro - RESERVA_BASE[o.reserva ?? "nada"];
  // a largura manda (com a margem fina); só encolhe se o conteúdo não couber entre o topo e a base
  const escala = Math.max(0.05, Math.min((coluna - 2 * MARGEM_LADO) / CONTEUDO.largura, (base - topo) / (CONTEUDO.fim - CONTEUDO.topo)));
  const y = topo - CONTEUDO.topo * escala;
  const extra = Math.max(0, Math.min(EXTRA_MAXIMO, Math.floor((base - y) / escala - CONTEUDO.fim)));
  const w = CW * escala;
  const h = (CH + extra) * escala;
  return { coluna, escala, x: (coluna - w) / 2, y, w, h, extra };
}

/* ------------------------------------------------------------------------- *
 * O FUNDO DO CARD ESTICADO ATÉ AS BORDAS (sem barra preta, sem emenda)
 * ------------------------------------------------------------------------- */

export interface Parada { cor: string; pos: number | null }
export interface FundoLido { angulo: number; paradas: Parada[]; liso: string | null }

const COR = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|transparent)\s*(-?[\d.]+%)?/g;

/**
 * Lê o fundo do card (o `background-image`/`background-color` do elemento
 * `[data-cartao-share]`). Degradê linear → ângulo + paradas; cor lisa → liso.
 */
export function lerFundoDoCard(imagem: string | null | undefined, cor: string | null | undefined): FundoLido | null {
  const img = (imagem ?? "").trim();
  const m = /^linear-gradient\((.*)\)$/s.exec(img);
  if (m) {
    const corpo = m[1];
    const ang = /^\s*(-?[\d.]+)deg/.exec(corpo);
    const angulo = ang ? Number(ang[1]) : /^\s*to top/.test(corpo) ? 0 : 180;
    const paradas: Parada[] = [];
    for (const x of corpo.matchAll(COR)) paradas.push({ cor: x[1], pos: x[2] ? Number(x[2].replace("%", "")) / 100 : null });
    if (paradas.length >= 1) {
      // posições que faltam: espalhadas por igual (o que o CSS faz)
      const n = paradas.length;
      if (paradas[0].pos == null) paradas[0].pos = 0;
      if (paradas[n - 1].pos == null) paradas[n - 1].pos = n === 1 ? 0 : 1;
      for (let i = 1; i < n - 1; i++) {
        if (paradas[i].pos != null) continue;
        let j = i;
        while (paradas[j].pos == null) j++;
        const a = paradas[i - 1].pos!, b = paradas[j].pos!;
        for (let k = i; k < j; k++) paradas[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
      }
      return { angulo, paradas, liso: null };
    }
  }
  const c = (cor ?? "").trim();
  if (c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)") return { angulo: 180, paradas: [], liso: c };
  return null;
}

const comprimento = (w: number, h: number, rad: number) => Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));

/**
 * O MESMO degradê do card, refeito pra caixa da tela: dentro do card bate
 * pixel a pixel com o dele (as paradas são deslocadas pela projeção do
 * começo da linha do degradê), fora continua a cor da ponta — como o CSS.
 */
export function fundoEsticado(f: FundoLido, card: { x: number; y: number; w: number; h: number }, caixa: { w: number; h: number }): string {
  if (f.liso) return f.liso;
  if (f.paradas.length === 1) return f.paradas[0].cor;
  const rad = (f.angulo * Math.PI) / 180;
  const d = { x: Math.sin(rad), y: -Math.cos(rad) };
  const Lc = comprimento(card.w, card.h, rad);
  const Lo = comprimento(caixa.w, caixa.h, rad);
  const inicioC = { x: card.x + card.w / 2 - (d.x * Lc) / 2, y: card.y + card.h / 2 - (d.y * Lc) / 2 };
  const inicioO = { x: caixa.w / 2 - (d.x * Lo) / 2, y: caixa.h / 2 - (d.y * Lo) / 2 };
  const delta = (inicioC.x - inicioO.x) * d.x + (inicioC.y - inicioO.y) * d.y;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `linear-gradient(${f.angulo}deg, ${f.paradas.map((p) => `${p.cor} ${r((p.pos ?? 0) * Lc + delta)}px`).join(", ")})`;
}

/** A textura de pontinhos da moldura, na escala da tela e alinhada com a do card. */
export function texturaEsticada(imagem: string, tamanho: string, escala: number, card: { x: number; y: number }): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | null {
  if (!/^radial-gradient/.test(imagem)) return null;
  const px = Number((/([\d.]+)px/.exec(tamanho) ?? [])[1]);
  if (!px) return null;
  const passo = px * escala;
  const img = imagem.replace(/([\d.]+)px/g, (_, n) => `${Math.round(Number(n) * escala * 100) / 100}px`);
  const mod = (v: number) => Math.round((((v % passo) + passo) % passo) * 100) / 100;
  return { backgroundImage: img, backgroundSize: `${passo}px ${passo}px`, backgroundPosition: `${mod(card.x)}px ${mod(card.y)}px` };
}

/** O topo do fundo é claro (papel, creme)? Então barrinhas, X e relógio vão escuros. */
export function fundoClaro(f: FundoLido | null): boolean {
  const cor = f?.liso ?? f?.paradas[0]?.cor;
  if (!cor) return false;
  const hex = paraHex(cor);
  return hex ? luminancia(hex) > 0.45 : false;
}

export function paraHex(cor: string): string | null {
  const c = cor.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c.slice(1).split("").map((x) => x + x).join("")}`;
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}
