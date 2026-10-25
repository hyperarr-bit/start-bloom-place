import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * O CARROSSEL DO DIA (opção E, 25/10) — como os cards de macros do Cal AI: páginas de largura cheia
 * que rolam de lado com o dedo e param uma por vez (scroll-snap nativo, sem biblioteca), bolinhas
 * embaixo. Todas as páginas têm a MESMA altura (a da mais alta — a página 1), então o que vem embaixo
 * (os módulos) não pula quando a pessoa arrasta.
 *
 * Só pros prints: `paginaInicial` abre já numa página; `arrasto` (0…1) congela o trilho no meio do
 * caminho entre a 1ª e a 2ª página, sem o snap, pra fotografar "a próxima entrando".
 */
interface Props {
  paginas: ReactNode[];
  rotulos: string[];
  paginaInicial?: number;
  arrasto?: number | null;
  onMudar?: (pagina: number) => void;
}

export const CarrosselDia = ({ paginas, rotulos, paginaInicial = 0, arrasto = null, onMudar }: Props) => {
  const trilho = useRef<HTMLDivElement>(null);
  const [pagina, setPagina] = useState(paginaInicial);

  const posicaoDa = (el: HTMLDivElement, n: number) => {
    const alvo = el.children[n] as HTMLElement | undefined;
    const primeira = el.children[0] as HTMLElement | undefined;
    return alvo && primeira ? alvo.offsetLeft - primeira.offsetLeft : 0;
  };

  useLayoutEffect(() => {
    const el = trilho.current;
    if (!el) return;
    if (arrasto != null) {
      el.dataset.arrasto = String(arrasto);
      el.scrollLeft = posicaoDa(el, 1) * Math.max(0, Math.min(1, arrasto));
    } else if (paginaInicial > 0) {
      el.scrollLeft = posicaoDa(el, paginaInicial);
    }
    // só na montagem: é a posição inicial dos prints
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    let quadro = 0;
    const ler = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const passo = posicaoDa(el, 1) || el.clientWidth;
        const n = Math.max(0, Math.min(paginas.length - 1, Math.round(el.scrollLeft / Math.max(1, passo))));
        setPagina((p) => (p === n ? p : n));
      });
    };
    el.addEventListener("scroll", ler, { passive: true });
    return () => { el.removeEventListener("scroll", ler); cancelAnimationFrame(quadro); };
  }, [paginas.length]);

  useEffect(() => { onMudar?.(pagina); }, [pagina, onMudar]);

  const irPara = (n: number) => {
    const el = trilho.current;
    if (!el) return;
    el.scrollTo({ left: posicaoDa(el, n), behavior: "smooth" });
  };

  return (
    <section data-testid="he-carrossel" aria-roledescription="carrossel" aria-label="Seu dia">
      {/* as páginas são filhas DIRETAS do trilho (a posição de cada uma vem do offsetLeft delas) */}
      <div ref={trilho} className="he-trilho" data-testid="he-trilho">
        {paginas}
      </div>
      <div className="flex justify-center items-center gap-[7px] mt-3.5" data-testid="he-bolinhas" data-pagina={pagina}>
        {paginas.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir para ${rotulos[i] ?? `página ${i + 1}`}`}
            aria-current={i === pagina ? "true" : undefined}
            onClick={() => irPara(i)}
            className="h-6 w-6 -mx-1 grid place-items-center"
          >
            <span className={`block w-[7px] h-[7px] rounded-full transition-colors ${i === pagina ? "bg-foreground" : "bg-foreground/20"}`} />
          </button>
        ))}
      </div>
    </section>
  );
};
