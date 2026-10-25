import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { ATRIBUTO_RAIZ } from "@/lib/nav-abas";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { TRACO } from "./paleta";
import { useFundoDaTelaE } from "./fundo-da-tela";
import "../home-nova.css";
import "./home-e.css";

/**
 * A ABA VOCÊ NO ESTILO DA HOME NOVA (rodada 2, 26/10 — dono: "organizar melhor, categorias que abrem subcategorias;
 * enxuta"). Quatro categorias, cada uma um card que abre as suas linhas (uma aberta por vez): Início (Personalizar
 * início, Rever tutorial) · Conta (plano, aparência, lembretes, computador) · Progresso (conquistas, retrospectiva) ·
 * Ajuda. Sem linhas nem bordas: o relevo é o card branco sobre o fundo, cantos grandes, ícones Lucide 1,75.
 * Os destinos e os eventos são os mesmos da aba de hoje (pages/Voce monta as listas; aqui é só o desenho).
 */
export interface ItemVoce { id: string; Icone: LucideIcon; rotulo: string; detalhe?: string; onClick: () => void; perigo?: boolean }
export interface CategoriaVoce { id: string; Icone: LucideIcon; titulo: string; resumo: string; itens: ItemVoce[] }

interface Props {
  nome: string;
  email: string;
  iniciais: string;
  categorias: CategoriaVoce[];
  onConta: () => void;
  onSair: () => void;
  versao?: string;
  children?: ReactNode;
}

const Linha = ({ item }: { item: ItemVoce }) => (
  <li>
    <button
      type="button" onClick={item.onClick} data-testid={`voce-${item.id}`} data-track={`voce:${item.id}`}
      className={`w-full min-h-[52px] flex items-center gap-3 px-4 text-left rounded-2xl active:bg-muted/60 ${item.perigo ? "text-destructive" : "text-foreground"}`}
    >
      <item.Icone className={`w-[19px] h-[19px] shrink-0 ${item.perigo ? "" : "text-muted-foreground"}`} strokeWidth={TRACO} aria-hidden />
      <span className="flex-1 min-w-0 text-[15px] font-medium truncate">{item.rotulo}</span>
      {item.detalhe && <span className="text-[12.5px] text-muted-foreground shrink-0 max-w-[45%] truncate">{item.detalhe}</span>}
      {!item.perigo && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />}
    </button>
  </li>
);

export function VoceE({ nome, email, iniciais, categorias, onConta, onSair, versao, children }: Props) {
  const semMovimento = useReducedMotion();
  const [aberta, setAberta] = useState<string | null>(categorias[0]?.id ?? null);
  useFundoDaTelaE(); // adendo 26/10: a faixa do relógio e a casca na cor da E
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

        <div className="mt-4 space-y-3" data-testid="voce-categorias">
          {categorias.map((c) => {
            const on = aberta === c.id;
            return (
              <section key={c.id} className="hn-card overflow-hidden" data-testid={`voce-categoria-${c.id}`} data-aberta={on ? "1" : "0"}>
                <button type="button" onClick={() => setAberta(on ? null : c.id)} aria-expanded={on} aria-controls={`voce-cat-${c.id}`} className="w-full min-h-[60px] flex items-center gap-3.5 px-4 text-left">
                  <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-muted/60" aria-hidden><c.Icone className="w-[19px] h-[19px]" strokeWidth={TRACO} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] font-bold tracking-tight">{c.titulo}</span>
                    <span className="block text-[12.5px] text-muted-foreground truncate">{c.resumo}</span>
                  </span>
                  <ChevronDown className={`w-[18px] h-[18px] text-muted-foreground/60 shrink-0 transition-transform ${on ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden />
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div id={`voce-cat-${c.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <ul className="px-2 pb-2">{c.itens.map((i) => <Linha key={i.id} item={i} />)}</ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>

        <button type="button" onClick={onSair} data-testid="voce-sair" data-track="voce:sair" className="mt-5 w-full h-12 rounded-2xl text-[15px] font-semibold text-destructive active:bg-muted/60">Sair</button>
        {versao && <p className="mt-3 text-center text-[11px] text-muted-foreground/70">CORE {versao}</p>}
      </main>
      {children}
    </div>
  );
}
