/**
 * O TECLADO DO iPHONE DE VERDADE, no jsdom (20/10 — o "+ Outro" do post-it do gasto entrava em loop no aparelho do
 * dono e nenhum teste nem o Simulador pegaram: o Simulador usa o teclado do Mac, a área visível nunca encolhe).
 *
 * O que o WKWebView faz e o jsdom não (o app NÃO usa o plugin de teclado do Capacitor):
 *   · abrir: o campo ganha foco (focusin), a JANELA continua do mesmo tamanho e o `visualViewport` ENCOLHE
 *     (resize nele e na janela) e o iPhone ROLA a página pra mostrar o campo (scroll);
 *   · fechar pelo "OK" da barra do teclado (ou tocando fora): o campo perde o foco NA HORA (focusout), mas o teclado
 *     ainda leva ~250 ms descendo — nesse meio a área visível CONTINUA pequena e o iPhone desfaz a rolagem (scroll);
 *     só depois o `visualViewport` volta ao tamanho (resize).
 * O jsdom não tem `visualViewport`: este helper põe um falso (EventTarget com height/offsetTop) e devolve tudo no fim.
 * Os relógios são do teste (vi.useFakeTimers): o helper só dispara os eventos, quem anda o tempo é o teste.
 */
import { act } from "@testing-library/react";

export interface TecladoIphone {
  /** a área visível agora (a janela continua `alturaTela`) */
  readonly altura: number;
  /** foco no campo + teclado subindo (área visível encolhe) + a rolagem que o iPhone faz */
  abrir(campo: HTMLElement, rolagem?: number): void;
  /** o "OK" da barra do teclado / toque fora: o foco sai NA HORA, a área visível ainda pequena, o iPhone desfaz a rolagem */
  soltarFoco(): void;
  /** o teclado terminou de descer: a área visível volta ao tamanho da janela */
  assentar(): void;
  /** troca o foco de um campo pra outro com o teclado aberto (o tipo de teclado muda, a altura também) */
  trocarPara(campo: HTMLElement, alturaTeclado?: number): void;
  /** devolve a janela como estava (sempre num finally/afterEach) */
  desinstalar(): void;
}

class VisualViewportFalso extends EventTarget {
  height: number;
  width: number;
  offsetTop = 0;
  offsetLeft = 0;
  pageTop = 0;
  pageLeft = 0;
  scale = 1;
  constructor(w: number, h: number) { super(); this.width = w; this.height = h; }
}

/** iPhone 15/16 (390×844) por padrão; o SE é 375×667. O teclado de letras do iPhone + a barra de sugestões ≈ 336 px. */
export function instalarTecladoIphone({ alturaTela = 844, larguraTela = 390, alturaTeclado = 336 }: { alturaTela?: number; larguraTela?: number; alturaTeclado?: number } = {}): TecladoIphone {
  const antesVV = Object.getOwnPropertyDescriptor(window, "visualViewport");
  const antesAltura = Object.getOwnPropertyDescriptor(window, "innerHeight");
  const antesLargura = Object.getOwnPropertyDescriptor(window, "innerWidth");
  const antesScroll = Object.getOwnPropertyDescriptor(window, "scrollY");
  const vv = new VisualViewportFalso(larguraTela, alturaTela);
  let y = 0;
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: alturaTela });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: larguraTela });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });

  const redimensionou = () => { vv.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("resize")); };
  const rolou = (novo: number) => { y = novo; vv.offsetTop = 0; vv.pageTop = novo; window.dispatchEvent(new Event("scroll")); vv.dispatchEvent(new Event("scroll")); };

  return {
    get altura() { return vv.height; },
    abrir(campo, rolagem = 180) {
      act(() => {
        if (document.activeElement !== campo) campo.focus();
        campo.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        vv.height = alturaTela - alturaTeclado;
        redimensionou();
        rolou(y + rolagem);
      });
    },
    soltarFoco() {
      act(() => {
        const ativo = document.activeElement as HTMLElement | null;
        if (ativo && ativo !== document.body) {
          ativo.blur();
          ativo.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        }
        rolou(Math.max(0, y - 180));
      });
    },
    assentar() {
      act(() => {
        vv.height = alturaTela;
        redimensionou();
      });
    },
    trocarPara(campo, altura = alturaTeclado) {
      act(() => {
        const ativo = document.activeElement as HTMLElement | null;
        ativo?.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: campo }));
        campo.focus();
        campo.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        vv.height = alturaTela - altura;
        redimensionou();
      });
    },
    desinstalar() {
      const voltar = (k: string, d: PropertyDescriptor | undefined) => {
        if (d) Object.defineProperty(window, k, d);
        else delete (window as unknown as Record<string, unknown>)[k];
      };
      voltar("visualViewport", antesVV);
      voltar("innerHeight", antesAltura);
      voltar("innerWidth", antesLargura);
      voltar("scrollY", antesScroll);
    },
  };
}
