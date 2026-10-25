import { Home, Plus, Trophy } from "lucide-react";

/**
 * A BARRA FLUTUANTE (mockup 25/10) — no estilo do Cal AI: uma pílula clara com as abas, solta do fundo
 * (sombra, sem linha em cima), e um botão redondo escuro "+" separado à direita. Flutua ACIMA do
 * indicador de home do iPhone (bottom = área segura + 12 px).
 *
 * Abas: Início (a Home) · Conquistas (a tela que já existe) · Você (o menu da conta, que hoje abre pelo
 * avatar). A aba Você leva as iniciais da pessoa no lugar do ícone — é "você" mesmo.
 * O "+" substitui a fileira de Ações rápidas: abre a FolhaMais.
 *
 * Alvos: cada aba ≥ 44 pt de altura (a pílula tem 64), o "+" tem 60.
 * Nomes alternativos (pro dono decidir): "Hoje" no lugar de "Início" (é o que a barra da 1.0.17 usava);
 * "Álbum" no lugar de "Conquistas" (a tela é o álbum de figurinhas + a sequência).
 */
export type AbaNova = "inicio" | "conquistas" | "voce";

interface Props {
  ativa: AbaNova;
  iniciais: string;
  onIr: (aba: AbaNova) => void;
  onMais: () => void;
  rotulos?: Partial<Record<AbaNova, string>>;
}

const PADRAO: Record<AbaNova, string> = { inicio: "Início", conquistas: "Conquistas", voce: "Você" };

export const BarraFlutuante = ({ ativa, iniciais, onIr, onMais, rotulos }: Props) => {
  const nome = { ...PADRAO, ...(rotulos ?? {}) };
  const Aba = ({ id, children }: { id: AbaNova; children: React.ReactNode }) => {
    const on = id === ativa;
    return (
      <button
        type="button"
        onClick={() => onIr(id)}
        aria-current={on ? "page" : undefined}
        aria-label={nome[id]}
        data-testid={`hn-aba-${id}`}
        className={`flex-1 h-full rounded-full flex flex-col items-center justify-center gap-[3px] transition-colors ${on ? "bg-muted text-foreground" : "text-muted-foreground"}`}
      >
        {children}
        <span className={`text-[11px] leading-none ${on ? "font-bold" : "font-medium"}`}>{nome[id]}</span>
      </button>
    );
  };
  return (
    <div
      className="hn-barra fixed inset-x-4 z-[60] flex items-center gap-3 max-w-lg mx-auto"
      style={{ bottom: "calc(var(--app-safe-bottom, 0px) + 12px)" }}
      data-testid="hn-barra"
    >
      <nav aria-label="Navegação principal" className="hn-card !rounded-full flex-1 h-[64px] p-1.5 flex items-center" style={{ boxShadow: "var(--hn-sombra-forte)" }}>
        <Aba id="inicio"><Home className="w-[22px] h-[22px]" strokeWidth={ativa === "inicio" ? 2.4 : 1.9} aria-hidden /></Aba>
        <Aba id="conquistas"><Trophy className="w-[22px] h-[22px]" strokeWidth={ativa === "conquistas" ? 2.4 : 1.9} aria-hidden /></Aba>
        <Aba id="voce">
          <span
            className="w-[22px] h-[22px] rounded-full grid place-items-center text-[9.5px] font-bold leading-none"
            style={{ background: "hsl(var(--fixo-tinta) / 0.12)", color: ativa === "voce" ? "hsl(var(--fixo-tinta))" : "hsl(var(--fixo-tinta) / 0.75)" }}
            aria-hidden
          >
            {iniciais}
          </span>
        </Aba>
      </nav>
      <button
        type="button"
        onClick={onMais}
        aria-label="Registrar agora"
        data-testid="hn-mais"
        className="w-[60px] h-[60px] rounded-full grid place-items-center shrink-0 active:scale-95 transition-transform"
        style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)", boxShadow: "var(--hn-sombra-forte)" }}
      >
        <Plus className="w-7 h-7" strokeWidth={2.6} aria-hidden />
      </button>
    </div>
  );
};
