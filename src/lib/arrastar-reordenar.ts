import { MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";

/**
 * ARRASTAR PRA REORDENAR — A REGRA ÚNICA (28/10, avaliação 5★ da App Store: "a tela é muito sensível, às vezes basta
 * encostar sem querer e já aparece a opção de mudar as coisas de lugar … exigir que a pessoa segure por mais tempo").
 *
 * O que acontecia na Home clássica (widgets):
 *   1. o "segurar pra editar" (use-long-press, 600 ms) NÃO cancelava quando o dedo se mexia — quem começava a ROLAR a
 *      Home em cima de um widget e parava com o dedo lá caía no modo de editar (os widgets balançando);
 *   2. já no modo de editar, o PointerSensor do dnd-kit também pega o toque (Pointer Events valem pro dedo) e começava
 *      o arrasto com 5 px de movimento — rolar a tela arrastava widget.
 * Agora (as duas pontas usam estas constantes):
 *   · o arrasto pelo DEDO só começa com o dedo PARADO por SEGURAR_PRA_ARRASTAR_MS (tolerância TOLERANCIA_DEDO_PX); mexeu
 *     antes disso = é rolagem, o arrasto nunca começa;
 *   · o MOUSE (computador) segue começando com DISTANCIA_MOUSE_PX de movimento (mouse não rola a página arrastando);
 *   · sem PointerSensor (ele não distingue dedo de mouse);
 *   · onde existe modo de editar (widgets da Home clássica), o reordenar só funciona DENTRO dele (SortableWidget só
 *     liga os ouvintes do arrasto com `editing`), e entrar no modo também exige o dedo parado (use-long-press).
 * Outros lugares de reordenar no app não usam toque longo: Home nova › Organizar, Dieta (cardápio) e Estudos (grade)
 * mudam a ordem por setas/seletores. As abas dos módulos (abas-ocultaveis) já cancelam o "segurar" no touchmove.
 */
export const SEGURAR_PRA_ARRASTAR_MS = 550;
export const TOLERANCIA_DEDO_PX = 5;
export const DISTANCIA_MOUSE_PX = 5;

export const RESTRICAO_TOQUE = { delay: SEGURAR_PRA_ARRASTAR_MS, tolerance: TOLERANCIA_DEDO_PX } as const;
export const RESTRICAO_MOUSE = { distance: DISTANCIA_MOUSE_PX } as const;

/** Os sensores do dnd-kit de toda lista reordenável: mouse por distância, dedo só segurando parado. */
export function useSensoresDeReordenar() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: RESTRICAO_MOUSE }),
    useSensor(TouchSensor, { activationConstraint: RESTRICAO_TOQUE }),
  );
}

/**
 * O "segurar parado" em forma pura (o use-long-press usa; testável com relógio falso): `iniciar(x, y)` arma o tempo,
 * `mover(x, y)` cancela se o dedo saiu da tolerância, `soltar()` cancela. `aoSegurar` dispara 1x, só com o dedo parado.
 */
export function criarSegurarParado(aoSegurar: () => void, ms: number = SEGURAR_PRA_ARRASTAR_MS, tolerancia: number = TOLERANCIA_DEDO_PX) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origem: { x: number; y: number } | null = null;
  const soltar = () => { if (timer) clearTimeout(timer); timer = null; origem = null; };
  return {
    iniciar(x: number, y: number) {
      soltar();
      origem = { x, y };
      timer = setTimeout(() => { timer = null; origem = null; aoSegurar(); }, ms);
    },
    mover(x: number, y: number) {
      if (!origem) return;
      if (Math.abs(x - origem.x) > tolerancia || Math.abs(y - origem.y) > tolerancia) soltar();
    },
    soltar,
    /** Está armado (dedo pra baixo, ainda sem disparar)? */
    armado: () => timer !== null,
  };
}
