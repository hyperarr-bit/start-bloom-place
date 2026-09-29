/** Estilos compartilhados das folhas e campos de Relações (fora do kit.tsx pro fast refresh do vite). */

/** Classe dos campos de texto das folhas: 16px (o iPhone não dá zoom), 44px de altura. */
export const CAMPO = "w-full min-h-[44px] rounded-[10px] border border-input bg-background px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** Folha de baixo do app (mesmo formato das outras folhas). */
export const FOLHA = "tema-relacoes rounded-t-3xl p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col focus:outline-none";
/** Ao abrir, o foco vai pra própria folha (não pro X): sem anel de foco no toque, e o teclado continua preso dentro. */
export const focarNaFolha = (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus?.(); };
