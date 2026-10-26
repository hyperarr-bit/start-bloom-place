import { useRef, type ReactNode } from "react";
import { ChevronRight, Star, type LucideIcon } from "lucide-react";
import { ATRIBUTO_RAIZ } from "@/lib/nav-abas";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { TRACO } from "./paleta";
import { useFundoDaTelaE } from "./fundo-da-tela";
import "../home-nova.css";
import "./home-e.css";

/**
 * A ABA VOCÊ NO ESTILO DO MENU DO CAL AI (rodada 3, 26/10 — vídeo do dono): SEÇÕES com título e as linhas VISÍVEIS
 * (nada de acordeão), cada linha com o ícone fino (Lucide 1,75) + texto + › e abrindo uma SUBPÁGINA com a animação
 * de push do iOS (lib/navegacao-ios — quem navega é pages/Voce). Em cima o card da conta; logo abaixo, sozinho e em
 * destaque, "Avaliar o CORE" (o mesmo fluxo de avaliação de sempre); no fim, Sair e a versão.
 * Sem linhas nem bordas: o relevo é o card branco sobre o fundo, cantos grandes, sombras mínimas.
 */
export interface ItemVoce { id: string; Icone: LucideIcon; rotulo: string; detalhe?: string; onClick: () => void; perigo?: boolean }
export interface SecaoVoce { id: string; titulo: string; itens: ItemVoce[] }

interface Props {
  nome: string;
  email: string;
  iniciais: string;
  secoes: SecaoVoce[];
  onConta: () => void;
  onSair: () => void;
  /** o card "Gostando do CORE? Avalie na App Store" (só quando o fluxo de avaliação existe nesta plataforma) */
  onAvaliar?: () => void;
  versao?: string;
  /** 5 toques seguidos na versão: a opção escondida do dono (a variante do vidro) */
  onVersaoCincoToques?: () => void;
  children?: ReactNode;
}

const Linha = ({ item }: { item: ItemVoce }) => (
  <li>
    <button
      type="button" onClick={item.onClick} data-testid={`voce-${item.id}`} data-track={`voce:${item.id}`}
      className={`w-full min-h-[54px] flex items-center gap-3.5 px-4 text-left rounded-2xl active:bg-muted/60 ${item.perigo ? "text-destructive" : "text-foreground"}`}
    >
      <item.Icone className={`w-[20px] h-[20px] shrink-0 ${item.perigo ? "" : "text-foreground/80"}`} strokeWidth={TRACO} aria-hidden />
      <span className="flex-1 min-w-0 text-[15.5px] font-medium truncate">{item.rotulo}</span>
      {item.detalhe && <span className="text-[12.5px] text-muted-foreground shrink-0 max-w-[45%] truncate">{item.detalhe}</span>}
      {!item.perigo && <ChevronRight className="w-[18px] h-[18px] text-muted-foreground/45 shrink-0" strokeWidth={2} aria-hidden />}
    </button>
  </li>
);

export function VoceE({ nome, email, iniciais, secoes, onConta, onSair, onAvaliar, versao, onVersaoCincoToques, children }: Props) {
  useFundoDaTelaE(); // adendo 26/10: a faixa do relógio e a casca na cor da E
  const toques = useRef<number[]>([]);
  const tocarVersao = () => {
    if (!onVersaoCincoToques) return;
    const agora = Date.now();
    toques.current = [...toques.current.filter((t) => agora - t < 3000), agora];
    if (toques.current.length >= 5) { toques.current = []; onVersaoCincoToques(); }
  };
  return (
    <div className="hn he min-h-dvh" data-testid="tela-voce" data-layout="e" data-suave={SUAVIDADE_HOME_NOVA} {...{ [ATRIBUTO_RAIZ]: "voce" }}>
      <main className="max-w-lg mx-auto px-4 pt-2 pb-6">
        <header className="pt-1">
          <h1 className="text-[26px] leading-[1.15] font-bold tracking-[-0.025em]">Você</h1>
        </header>

        <button type="button" onClick={onConta} data-testid="voce-conta" aria-label="Minha conta" className="hn-card mt-4 w-full flex items-center gap-3.5 px-4 py-4 text-left active:scale-[0.99] transition-transform">
          <span className="w-12 h-12 rounded-full grid place-items-center text-[15px] font-bold shrink-0" style={{ background: "hsl(var(--fixo-tinta) / 0.1)", color: "hsl(var(--fixo-tinta))" }} aria-hidden>{iniciais}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-bold truncate">{nome || "Adicionar seu nome"}</span>
            <span className="block text-[12.5px] text-muted-foreground truncate">{email}</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />
        </button>

        {onAvaliar && (
          <button type="button" onClick={onAvaliar} data-testid="voce-avaliar" data-track="voce:avaliar" className="hn-card mt-3 w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:scale-[0.99] transition-transform">
            <span className="w-11 h-11 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(42 90% 60% / 0.16)" }} aria-hidden>
              <Star className="w-[22px] h-[22px]" strokeWidth={TRACO} style={{ color: "hsl(40 85% 46%)", fill: "hsl(42 90% 60% / 0.55)" }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15.5px] font-bold">Gostando do CORE?</span>
              <span className="block text-[12.5px] text-muted-foreground">Avalie na App Store — leva 10 segundos</span>
            </span>
            <ChevronRight className="w-[18px] h-[18px] text-muted-foreground/45 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        )}

        <div className="mt-6 space-y-6" data-testid="voce-secoes">
          {secoes.map((s) => (
            <section key={s.id} data-testid={`voce-secao-${s.id}`}>
              <h2 className="px-4 mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{s.titulo}</h2>
              <ul className="hn-card overflow-hidden py-1">{s.itens.map((i) => <Linha key={i.id} item={i} />)}</ul>
            </section>
          ))}
        </div>

        <button type="button" onClick={onSair} data-testid="voce-sair" data-track="voce:sair" className="mt-6 w-full h-12 rounded-2xl text-[15px] font-semibold text-destructive active:bg-muted/60">Sair</button>
        {versao && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground/70 select-none" data-testid="voce-versao" onClick={tocarVersao}>CORE {versao}</p>
        )}
      </main>
      {children}
    </div>
  );
}
