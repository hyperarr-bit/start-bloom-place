import type { ReactNode } from "react";
import { Home, Plus, Trophy } from "lucide-react";
import type { AbaNova } from "../BarraFlutuante";

/**
 * A BARRA DE VIDRO (opção E, 25/10) — a mesma barra da direção A (Início · Conquistas · Você + o "+"),
 * em LIQUID GLASS como a do Cal AI / iOS 26: a pílula é translúcida, desfoca e satura o que rola atrás
 * (backdrop-filter, com o prefixo -webkit- pro iPhone), com um fio de luz na borda de cima e uma sombra
 * macia por fora; a aba ativa é um vidro um pouco mais claro. O "+" segue sólido, em grafite — é o único
 * botão de ação da tela e precisa de contraste sobre qualquer fundo. Flutua acima do indicador do iPhone.
 * Alvos: abas 64 pt de altura, "+" 60.
 */
interface Props {
  ativa: AbaNova;
  iniciais: string;
  onIr: (aba: AbaNova) => void;
  onMais: () => void;
  rotulos?: Partial<Record<AbaNova, string>>;
  /** 1.0.19 (26/10): a dica do "+" (lib/dica-mais), presa ao botão — vem pronta de quem monta a barra */
  dica?: ReactNode;
  /** 1.0.21: o número de figurinhas novas no álbum (as que entraram quietas), no ícone das Conquistas */
  seloConquistas?: ReactNode;
}

/** O balão da dica do "+": pequeno, sem borda, sombra mínima, na paleta suave da Home nova; a ponta aponta pro "+". */
export const DicaDoMais = () => (
  <div className="he-dica-mais" role="status" data-testid="hn-dica-mais">
    <p className="text-[13.5px] leading-snug font-medium">
      Toque no <span className="he-dica-mais-plus" aria-label="mais">+</span> pra anotar qualquer coisa do seu dia
    </p>
    <span className="he-dica-mais-ponta" aria-hidden />
  </div>
);

/** 1.0.21: o selo com o número de figurinhas novas (ainda não coladas) no troféu das Conquistas. */
export const SeloNovas = ({ n }: { n: number }) => (n > 0 ? (
  <span
    className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full grid place-items-center text-[10px] font-extrabold leading-none text-white"
    style={{ background: "hsl(330 65% 50%)", boxShadow: "0 0 0 2px var(--he-vidro-fio, #fff)" }}
    data-testid="hn-conquistas-novas"
    aria-label={`${n} figurinha${n > 1 ? "s" : ""} nova${n > 1 ? "s" : ""}`}
  >
    {n > 9 ? "9+" : n}
  </span>
) : null);

const PADRAO: Record<AbaNova, string> = { inicio: "Início", conquistas: "Conquistas", voce: "Você" };

const AbaVidro = ({ id, ativa, rotulo, onIr, children }: { id: AbaNova; ativa: AbaNova; rotulo: string; onIr: (aba: AbaNova) => void; children: ReactNode }) => {
  const on = id === ativa;
  return (
    <button
      type="button"
      onClick={() => onIr(id)}
      aria-current={on ? "page" : undefined}
      aria-label={rotulo}
      data-testid={`hn-aba-${id}`}
      className={`flex-1 h-full rounded-full flex flex-col items-center justify-center gap-[3px] transition-colors ${on ? "he-vidro-aba text-foreground" : "text-muted-foreground"}`}
      style={on ? { boxShadow: "inset 0 1px 0 var(--he-vidro-fio), 0 1px 3px rgb(0 0 0 / 0.06)" } : undefined}
    >
      {children}
      <span className={`text-[11px] leading-none ${on ? "font-bold" : "font-medium"}`}>{rotulo}</span>
    </button>
  );
};

export const BarraVidro = ({ ativa, iniciais, onIr, onMais, rotulos, dica, seloConquistas }: Props) => {
  const nome = { ...PADRAO, ...(rotulos ?? {}) };
  /* 26/10: a aba (AbaVidro) é um componente de FORA — antes era criada dentro da barra, e cada re-render da barra
     desmontava e remontava os botões (um re-render no meio do toque, como o da dica do "+" saindo, arriscava o clique) */
  return (
    <div
      className="hn-barra fixed inset-x-4 z-[60] flex items-center gap-3 max-w-lg mx-auto"
      /* rodada 3: mais embaixo, como no Cal AI — a base da pílula 6 px abaixo do topo da área segura (≈28 px da
         borda), nunca menos de 10 px em aparelho sem área segura; antes era área segura + 12 (46 px) */
      style={{ bottom: "max(10px, calc(var(--app-safe-bottom, 0px) - 6px))" }}
      data-testid="hn-barra"
    >
      <nav aria-label="Navegação principal" className="he-vidro rounded-full flex-1 h-[60px] p-1.5 flex items-center">
        <AbaVidro id="inicio" ativa={ativa} rotulo={nome.inicio} onIr={onIr}><Home className="w-[22px] h-[22px]" strokeWidth={ativa === "inicio" ? 2.2 : 1.75} aria-hidden /></AbaVidro>
        <AbaVidro id="conquistas" ativa={ativa} rotulo={nome.conquistas} onIr={onIr}><span className="relative inline-grid"><Trophy className="w-[22px] h-[22px]" strokeWidth={ativa === "conquistas" ? 2.2 : 1.75} aria-hidden />{seloConquistas}</span></AbaVidro>
        <AbaVidro id="voce" ativa={ativa} rotulo={nome.voce} onIr={onIr}>
          <span
            className="w-[22px] h-[22px] rounded-full grid place-items-center text-[9.5px] font-bold leading-none"
            style={{ background: "hsl(var(--fixo-tinta) / 0.12)", color: ativa === "voce" ? "hsl(var(--fixo-tinta))" : "hsl(var(--fixo-tinta) / 0.75)" }}
            aria-hidden
          >
            {iniciais}
          </span>
        </AbaVidro>
      </nav>
      <span className="relative shrink-0">
      {dica}
      <button
        type="button"
        onClick={onMais}
        aria-label="Registrar agora"
        data-testid="hn-mais"
        className="w-[56px] h-[56px] rounded-full grid place-items-center shrink-0 active:scale-95 transition-transform"
        style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)", boxShadow: "var(--he-vidro-sombra)" }}
      >
        <Plus className="w-7 h-7" strokeWidth={2.4} aria-hidden />
      </button>
      </span>
    </div>
  );
};
