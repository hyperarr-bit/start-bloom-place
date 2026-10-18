import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

/**
 * A TELA DO MÓDULO EM MINIATURA, VIVA (10/10; quadros em 10/10 v2).
 *
 * Renderiza o componente REAL do módulo (ou a réplica viva do card), reduzido com
 * `transform: scale`, por cima de um store EM MEMÓRIA com dados de exemplo (como a
 * demo /preview faz): nada do que o componente lê ou grava passa perto da conta da
 * pessoa — a conta continua vazia. `pointer-events: none` + `inert` + aria-hidden:
 * é figura, não tela — o dedinho (👆) diz onde tocar.
 *
 * MINI-ANIMAÇÃO EM QUADROS (v2, dono: "mostrar adicionando uma refeição"): `quadros`
 * é uma lista de remendos do store; a miniatura passa por eles em loop (digita →
 * aparece → marca), trocando a cada `intervalo` ms. Cada quadro pode mover o dedinho
 * (`"mini:dedinho"`) e alimentar o que a réplica lê (`"mini:digitando"`, `"mini:itens"`…).
 * Com prefers-reduced-motion fica parada no ÚLTIMO quadro (o resultado).
 */
export const CHAVE_DEDINHO = "mini:dedinho";

export interface Quadro extends Record<string, unknown> {
  [CHAVE_DEDINHO]?: { x: string; y: string };
}

export function Miniatura({
  sementes,
  children,
  largura = 390,
  escala = 0.56,
  altura = 196,
  dedinho,
  legenda,
  quadros,
  intervalo = 1500,
}: {
  /** O store de exemplo (as mesmas chaves que o componente real lê). */
  sementes: Record<string, unknown>;
  children: ReactNode;
  /** Largura "real" em que o componente é desenhado antes de reduzir (um celular). */
  largura?: number;
  escala?: number;
  /** Altura visível do recorte, em px. */
  altura?: number;
  /** Onde o dedinho aponta, em % do recorte (o quadro pode trocar). */
  dedinho?: { x: string; y: string };
  legenda?: string;
  /** Os quadros da mini-animação (remendos por cima das sementes), em loop. */
  quadros?: Quadro[];
  intervalo?: number;
}) {
  const reduzir = useReducedMotion();
  const total = quadros?.length ?? 0;
  const [quadro, setQuadro] = useState(() => (reduzir && total ? total - 1 : 0));
  useEffect(() => {
    if (total < 2 || reduzir) return;
    const t = setInterval(() => setQuadro((q) => (q + 1) % total), intervalo);
    return () => clearInterval(t);
  }, [total, intervalo, reduzir]);

  const remendo = quadros?.[Math.min(quadro, Math.max(0, total - 1))];
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const store = useMemo<Record<string, unknown>>(() => ({ ...sementes, ...(remendo ?? {}), ...extra }), [sementes, remendo, extra]);
  const get = useCallback(<T,>(k: string, f: T): T => (k in store ? (store[k] as T) : f), [store]);
  const set = useCallback((k: string, v: unknown) => setExtra((s) => ({ ...s, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);

  // `inert` tira a miniatura da ordem de foco (o React 18 não conhece a prop; vai pelo DOM)
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.setAttribute("inert", ""); }, []);

  /* A miniatura PREENCHE a largura do cartão (v2): a escala sai de recorte ÷ largura, medida no
   * aparelho; e o recorte encolhe até a altura do conteúdo (nunca passa de `altura`) — sem a faixa
   * vazia embaixo de um bloco curto. No jsdom (sem medida) ficam a escala e a altura pedidas. */
  const recorte = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState<{ escala: number; altura: number } | null>(null);
  useEffect(() => {
    const medir = () => {
      const w = recorte.current?.clientWidth ?? 0;
      const h = ref.current?.scrollHeight ?? 0;
      if (!w || !h) return;
      const e = Math.min(1, w / largura);
      setMedida({ escala: e, altura: Math.min(altura, Math.ceil(h * e) + 2) });
    };
    medir();
    const t = setTimeout(medir, 350); // fontes e o componente real assentando
    window.addEventListener("resize", medir);
    return () => { clearTimeout(t); window.removeEventListener("resize", medir); };
  }, [largura, altura, quadro]);

  const ponteiro = (remendo?.[CHAVE_DEDINHO] as { x: string; y: string } | undefined) ?? dedinho;

  return (
    <figure className="m-0">
      <div
        ref={recorte}
        className="relative overflow-hidden rounded-xl border"
        style={{ height: medida?.altura ?? altura, borderColor: "var(--ct-linha)", background: "hsl(var(--background))", transition: "height .25s ease" }}
        data-testid="miniatura"
        data-quadro={total ? quadro : undefined}
        data-quadros={total || undefined}
      >
        <div
          ref={ref}
          aria-hidden="true"
          className="absolute left-0 top-0 origin-top-left select-none pointer-events-none"
          style={{ width: largura, transform: `scale(${medida?.escala ?? escala})` }}
        >
          <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>
        </div>
        {ponteiro && (
          <span className="ct-dedinho" style={{ left: ponteiro.x, top: ponteiro.y }} aria-hidden="true" data-testid="dedinho">👆</span>
        )}
      </div>
      {legenda && <figcaption className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--ct-suave)" }}>{legenda}</figcaption>}
    </figure>
  );
}
