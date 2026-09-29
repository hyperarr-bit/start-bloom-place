import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ddmm, mesCurto, quandoFalta, rotuloDoFaz, semanaCurta, type Circulo, type ItemDeData,
} from "@/lib/relacoes";
import "./relacoes.css";

/**
 * O kit visual de Relações (29/09, direção "Correio"): faixa de carta aérea,
 * selo, lacre, quadradinho, pauta. Só visual — a conta mora em lib/relacoes.
 * Nada daqui é copiado de outro módulo; o que é da casa (caixa alta pequena,
 * tabela com grade, quadradinho de marcar, magenta na ação principal) vem
 * suavizado, com a cara do assunto.
 */

/** Tudo de Relações mora dentro disto (as cores próprias têm escopo aqui). */
export const TemaRelacoes = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("tema-relacoes", className)}>{children}</div>
);

/** Seção: cartão com a faixa listrada de carta aérea e o título em caixa alta azul-carta. */
export function Secao({
  titulo, direita, children, className, card, id,
}: {
  titulo: ReactNode;
  direita?: ReactNode;
  children: ReactNode;
  className?: string;
  /** chave da medição de cards (data-card) */
  card?: string;
  id?: string;
}) {
  return (
    <section className={cn("rl-cartao", className)} data-card={card} id={id}>
      <div className="rl-aviao" aria-hidden="true" />
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5 min-h-[36px]">
        <h2 className="rl-caps text-[hsl(var(--rl-tinta))]">{titulo}</h2>
        {direita != null && <span className="ml-auto text-[11px] text-muted-foreground text-right">{direita}</span>}
      </div>
      {children}
    </section>
  );
}

/** O lacre com a inicial — a cor é o círculo da pessoa. */
export function Lacre({ nome, circulo, tamanho = 34, className }: { nome: string; circulo: Circulo; tamanho?: number; className?: string }) {
  const inicial = (nome.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn("rl-lacre", `rl-lacre-${circulo}`, className)}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.56) }}
    >
      {inicial}
    </span>
  );
}

/** O selo de uma data que vem aí: dia grande, mês · dia da semana, nome, quanto falta, quantos anos faz. */
export function Selo({ item, onClick }: { item: ItemDeData; onClick?: () => void }) {
  const hoje = item.dias === 0;
  const faz = rotuloDoFaz(item);
  const quando = quandoFalta(item.dias);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rl-selo text-left", hoje && "rl-hoje")}
      aria-label={`${item.titulo}, ${ddmm(item.mes, item.dia)}, ${quando}${faz ? `, ${faz}` : ""}`}
      data-testid="selo"
    >
      <span className="rl-selo-in">
        <span className="rl-serif text-[31px] leading-none text-[hsl(var(--rl-lacre))]">{String(item.dia).padStart(2, "0")}</span>
        <span className="rl-mini text-[hsl(var(--rl-tinta))] mt-0.5">{mesCurto(item.mes)} · {semanaCurta(item.proxima)}</span>
        <span className={cn("rl-serif leading-[1.05] mt-1.5 max-w-full px-0.5 line-clamp-2 break-words", item.titulo.length > 11 ? "text-[16px]" : "text-[19px]")}>{item.titulo}</span>
        <span className={cn("text-[10.5px] font-bold", hoje ? "rl-carimbo mt-1" : "text-[hsl(var(--rl-lacre))] mt-0.5")}>
          {hoje ? "Hoje" : quando}
        </span>
        {faz ? <span className="text-[10px] text-muted-foreground leading-tight">{faz}</span> : <span className="text-[10px] leading-tight">&nbsp;</span>}
      </span>
    </button>
  );
}

/** Quadradinho de marcar (o da casa), no magenta da marca quando marcado. */
export function Quadradinho({ marcado, className }: { marcado: boolean; className?: string }) {
  return (
    <span className={cn("rl-quadradinho", className)} data-marcado={marcado ? "true" : "false"} aria-hidden="true">
      {marcado && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
    </span>
  );
}

/** Botão principal (magenta da marca). */
export function BotaoAcao({ children, className, ...resto }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("rl-acao bg-[hsl(var(--rl-acao))]", className)} {...resto}>
      {children}
    </button>
  );
}

/** Botão de contorno (ação secundária). */
export function BotaoContorno({ children, className, ...resto }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("rl-contorno border", className)} {...resto}>
      {children}
    </button>
  );
}

/** Faixa de cima das folhas de Relações: a carta aérea + título + fechar. */
export function FaixaDaFolha({ titulo, sub, onFechar }: { titulo: ReactNode; sub?: ReactNode; onFechar: () => void }) {
  return (
    <div className="shrink-0 border-b border-border">
      <div className="rl-aviao" aria-hidden="true" />
      <div className="flex items-start gap-3 px-4 pt-3 pb-3">
        <div className="min-w-0 flex-1">
          <p className="rl-caps text-[hsl(var(--rl-tinta))]">{titulo}</p>
          {sub && <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>}
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="-mr-2 -mt-2 grid h-11 w-11 place-items-center rounded-full hover:bg-muted">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/** Rótulo de campo em caixa alta pequena. */
export const Rotulo = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="rl-mini block text-muted-foreground mb-1.5">{children}</label>
);
