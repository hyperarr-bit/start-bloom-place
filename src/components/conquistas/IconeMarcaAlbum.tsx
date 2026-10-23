import type { BadgeCategoria } from "@/components/gamification/types";

/** Símbolos próprios do álbum: mesma grade de 24 unidades, sem glifos de emoji. */
export const IconeMarcaAlbum = ({ modulo }: { modulo?: BadgeCategoria }) => {
  const desenhos = {
    sequencia: <path d="M13 3c1 5-4 5-2 9 2 0 3-2 4-4 5 6 4 12-3 13-8 0-10-8-4-13-1 4 1 4 1 4-1-4 3-6 4-9Z" />,
    finance: <><ellipse cx="12" cy="7" rx="8" ry="4" /><path d="M4 7v5c0 5 16 5 16 0V7M4 12v5c0 5 16 5 16 0v-5M9 6h5m-2-1v4" /></>,
    rotina: <><path d="M6 5h13v16H6c-2 0-3-2-3-4V7c0-2 1-3 3-3M7 3v5m9-5v5M3 10h16M8 15l2 2 5-5" /></>,
    leitura: <><path d="M12 7C9 4 5 4 2 5v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-7-1-10 2Zm0 0v14M5 9l4 1m-4 3 4 1m6-4 4-1m-4 5 4-1" /></>,
    treino: <><path d="M8 11h8v3H8M3 8h4v9H3zM17 8h4v9h-4zM1 10v5m22-5v5M7 6v13m10-13v13" /></>,
    dieta: <><path d="M4 12h16c0 5-3 8-8 8s-8-3-8-8Zm4 9h8M6 9c-2-3 0-5 3-3 1-5 6-4 6 0 4-1 5 2 3 3M12 5v4" /></>,
    saude: <><path d="M12 21S2 15 2 8c0-5 7-6 10-1 3-5 10-4 10 1 0 7-10 13-10 13Z" /><path d="M5 12h4l2-4 3 8 2-4h3" /></>,
    vida: <><path d="M12 21V11M12 16C5 16 3 12 3 7c6 0 9 3 9 9Zm0-4c0-7 4-9 9-9 0 6-3 9-9 9Z" /></>,
    carreira: <><path d="M8 7V4h8v3M3 8h18v13H3zM3 12c5 4 13 4 18 0M10 12h4v4h-4z" /></>,
    geral: <path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />,
  };
  return <svg className="alb-marca-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{modulo ? desenhos[modulo] : <><path d="m12 2 2.8 6.7L22 11l-7.2 2.3L12 20l-2.8-6.7L2 11l7.2-2.3L12 2Z" /><path d="m20 18 .7 1.3L22 20l-1.3.7L20 22l-.7-1.3L18 20l1.3-.7L20 18Z" /></>}</svg>;
};
