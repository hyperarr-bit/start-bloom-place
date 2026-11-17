import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { lerTela } from "@/lib/nav-abas";
import { EVENTO_NOVO_INDIQUE, balaoIndiqueDevido, gravarMarcaNovo, lerMarcaNovo, pontoIndiqueDevido } from "@/lib/indique-entrada";
import { useIndiqueElegivel } from "./use-indique-elegivel";
import { pedirDestaqueIndique } from "./destaque";
import { COMISSAO_POR_AMIGA_CENTS, reaisBr } from "../../../supabase/functions/_shared/indique";

/**
 * O "NOVO: INDIQUE E GANHE" DE 1 VEZ SÓ (17/11, subida — dono: "ensinar o usuário a ir lá"). Nunca card na Home
 * (feedback_home_sem_card_extra): um BALÃO preso à aba Você (Home nova, barra de vidro) ou à sua inicial no topo (Home clássica),
 * com a ponta apontando pra ela, mais um PONTINHO rosa no mesmo lugar até ela ver a linha. O toque no balão leva até a linha
 * (que pisca um anel rosa). Some sozinho em 9 s ou no 1º toque fora; aparece 1 vez por conta neste aparelho.
 * Só no site, só com a chave INDIQUE_ENTRADA, só pra cliente pagante (use-indique-elegivel), e só sem nada por cima (tour, missão,
 * folha, cobrança recusada, a dica do "+", o aviso do menu novo).
 * Eventos: indique_novo_balao {acao: vista|toque|dispensado, onde}.
 */
export const ESPERA_BALAO_INDIQUE_MS = 1800;
export const DURA_BALAO_INDIQUE_MS = 9000;

const algoPorCima = (): boolean => {
  try {
    return lerTela().camadaPorCima
      || !!document.querySelector('[role="dialog"], [role="alertdialog"], [data-testid="hn-dica-mais"], [data-testid="aviso-menu-novo"]');
  } catch { return true; }
};

export function useAvisoNovoIndique(onde: "aba" | "avatar", podeAgora: boolean, forcar?: { balao?: boolean; ponto?: boolean }) {
  const { elegivel, uid } = useIndiqueElegivel(forcar ? true : undefined);
  const [, setVersao] = useState(0);
  const [balao, setBalao] = useState(!!forcar?.balao);
  useEffect(() => {
    const reler = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_NOVO_INDIQUE, reler);
    return () => window.removeEventListener(EVENTO_NOVO_INDIQUE, reler);
  }, []);
  const marca = uid ? lerMarcaNovo(uid) : null;
  const candidato = !forcar && elegivel && !!uid && podeAgora && balaoIndiqueDevido(marca);

  useEffect(() => {
    if (!candidato || !uid) return;
    let tentativas = 0;
    let id = 0;
    const tentar = (): boolean => {
      if (algoPorCima()) return false;
      if (!balaoIndiqueDevido(lerMarcaNovo(uid))) return true;
      setBalao(true);
      gravarMarcaNovo(uid, { balao: true }); // gravado na hora em que aparece: reabrir o app não repete
      trackEvent("indique_novo_balao", { acao: "vista", onde });
      return true;
    };
    const t = window.setTimeout(() => {
      if (tentar()) return;
      id = window.setInterval(() => { if (tentar() || ++tentativas > 60) window.clearInterval(id); }, 1000);
    }, ESPERA_BALAO_INDIQUE_MS);
    return () => { window.clearTimeout(t); window.clearInterval(id); };
  }, [candidato, uid, onde]);

  // na tela: some sozinho em DURA_BALAO_INDIQUE_MS; o 1º toque FORA do balão o dispensa; uma camada por cima o tira na hora
  useEffect(() => {
    if (!balao || forcar) return;
    const fim = window.setTimeout(() => setBalao(false), DURA_BALAO_INDIQUE_MS);
    if (!podeAgora) { window.clearTimeout(fim); setBalao(false); return; }
    const fora = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('[data-testid="indique-novo-balao"]')) return;
      trackEvent("indique_novo_balao", { acao: "dispensado", onde });
      setBalao(false);
    };
    const id = window.setInterval(() => { if (algoPorCima()) setBalao(false); }, 400);
    document.addEventListener("pointerdown", fora, true);
    return () => { document.removeEventListener("pointerdown", fora, true); window.clearInterval(id); window.clearTimeout(fim); };
  }, [balao, onde, forcar, podeAgora]);

  const ponto = forcar ? !!forcar.ponto : elegivel && !!uid && pontoIndiqueDevido(marca);
  const usar = () => {
    trackEvent("indique_novo_balao", { acao: "toque", onde });
    setBalao(false);
    pedirDestaqueIndique();
  };
  return { balao: balao && (forcar ? true : elegivel), ponto, usar };
}

/**
 * O balão em cima da aba Você da barra de vidro: uma caixa da largura de UMA aba (a 3ª, à direita da pílula), a setinha no meio
 * dela e o balão alinhado pela direita. Vai dentro da <nav> (que é `relative`).
 */
export const BalaoNaAbaVoce = ({ onToque }: { onToque: () => void }) => (
  <span className="absolute bottom-full right-1.5 mb-2.5 h-0 pointer-events-none" style={{ width: "calc((100% - 12px) / 3)" }} data-testid="indique-novo-balao-aba">
    <span aria-hidden className="absolute -bottom-1.5 left-1/2 -ml-1.5 w-3 h-3 rotate-45 bg-foreground" />
    <span className="pointer-events-auto"><BalaoNovoIndique ponta="fora" onToque={onToque} className="bottom-0 right-0" /></span>
  </span>
);

/** o pontinho rosa (na aba Você / na inicial do topo) */
export const PontoNovoIndique = ({ className = "" }: { className?: string }) => (
  <span className={`absolute w-[9px] h-[9px] rounded-full ${className}`} style={{ background: "hsl(330 65% 50%)", boxShadow: "0 0 0 2px var(--he-vidro-fio, hsl(var(--background)))" }} data-testid="indique-novo-ponto" aria-label="Novidade: Indique e ganhe" />
);

/**
 * O balão. `ponta`: "cima-direita" (embaixo da inicial do topo, a setinha no próprio balão) ou "fora" (em cima da aba Você: quem
 * monta põe a setinha no meio da aba — BalaoNaAbaVoce). Escuro (tinta), pequeno, como o balão do menu novo e a dica do "+".
 */
export function BalaoNovoIndique({ ponta, onToque, className = "" }: { ponta: "fora" | "cima-direita"; onToque: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToque}
      className={`absolute z-50 w-[15.5rem] rounded-xl px-3.5 py-2.5 text-left text-[12.5px] leading-snug shadow-lg bg-foreground text-background animate-in fade-in-0 zoom-in-95 ${className}`}
      data-testid="indique-novo-balao"
      data-ponta={ponta}
      aria-live="polite"
    >
      {ponta === "cima-direita" && <span aria-hidden className="absolute -top-1.5 right-3.5 w-3 h-3 rotate-45 bg-foreground" />}
      <span className="relative flex items-start gap-2">
        <span className="text-[15px] leading-none mt-[1px]" aria-hidden>💗</span>
        <span>
          <b className="font-extrabold">Novo: Indique e ganhe</b>
          <span className="block opacity-80 mt-0.5">{reaisBr(COMISSAO_POR_AMIGA_CENTS)} por amiga que comprar pelo seu link. Toque pra ver ›</span>
        </span>
      </span>
    </button>
  );
}
