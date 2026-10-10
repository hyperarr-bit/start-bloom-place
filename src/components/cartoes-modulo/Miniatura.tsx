import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

/**
 * A TELA DO MÓDULO EM MINIATURA, VIVA (10/10, cartão "Onde fica o essencial").
 *
 * Renderiza o componente REAL do módulo, reduzido com `transform: scale`, por cima
 * de um store EM MEMÓRIA com dados de exemplo (como a demo /preview faz): nada do
 * que o componente lê ou grava passa perto da conta da pessoa. `pointer-events:
 * none` + `inert` + aria-hidden: é figura, não tela — o dedinho (👆) diz onde tocar.
 */
export function Miniatura({
  sementes,
  children,
  largura = 390,
  escala = 0.56,
  altura = 196,
  dedinho,
  legenda,
}: {
  /** O store de exemplo (as mesmas chaves que o componente real lê). */
  sementes: Record<string, unknown>;
  children: ReactNode;
  /** Largura "real" em que o componente é desenhado antes de reduzir (um celular). */
  largura?: number;
  escala?: number;
  /** Altura visível do recorte, em px. */
  altura?: number;
  /** Onde o dedinho aponta, em % do recorte. */
  dedinho?: { x: string; y: string };
  legenda?: string;
}) {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...sementes }));
  const get = useCallback(<T,>(k: string, f: T): T => (k in store ? (store[k] as T) : f), [store]);
  const set = useCallback((k: string, v: unknown) => setStore((s) => ({ ...s, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);

  // `inert` tira a miniatura da ordem de foco (o React 18 não conhece a prop; vai pelo DOM)
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.setAttribute("inert", ""); }, []);

  return (
    <figure className="m-0">
      <div
        className="relative overflow-hidden rounded-xl border"
        style={{ height: altura, borderColor: "var(--ct-linha)", background: "hsl(var(--background))" }}
        data-testid="miniatura"
      >
        <div
          ref={ref}
          aria-hidden="true"
          className="absolute left-0 top-0 origin-top-left select-none pointer-events-none"
          style={{ width: largura, transform: `scale(${escala})` }}
        >
          <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>
        </div>
        {dedinho && (
          <span className="ct-dedinho" style={{ left: dedinho.x, top: dedinho.y }} aria-hidden="true" data-testid="dedinho">👆</span>
        )}
      </div>
      {legenda && <figcaption className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--ct-suave)" }}>{legenda}</figcaption>}
    </figure>
  );
}
