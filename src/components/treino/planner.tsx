/**
 * Peças de PLANNER do Treino (26/09). O dono recusou o 1º mockup "estilo Hevy"
 * (cards brancos, steppers, anel de progresso): o que diferencia o CORE é a
 * cara de agenda. Faixa colorida do dia, tabela com grade fina, quadradinho de
 * marcar (não bolinha), post-it pra sugestão, linhas pautadas pra nota.
 *
 * Cores sempre por classe do Tailwind (o gerador do modo escuro remapeia) —
 * nada de hex solto, senão o escuro não acompanha.
 */
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DIAS_DA_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];

/** Faixa do dia — as mesmas cores do Treino/Dieta desde sempre. */
export const COR_DO_DIA: Record<string, string> = {
  SEGUNDA: "bg-blue-500", "TERÇA": "bg-indigo-500", QUARTA: "bg-green-500",
  QUINTA: "bg-yellow-500", SEXTA: "bg-pink-500", "SÁBADO": "bg-purple-500", DOMINGO: "bg-violet-500",
};
// Branco em cima do amarelo (QUINTA, 1,9:1) e do verde (QUARTA, 2,3:1) não se
// lia no claro; texto escuro nesses dois, a cor do dia fica (varredura 26/09).
export const textoDoDia = (dia: string) => (dia === "QUINTA" ? "text-yellow-950" : dia === "QUARTA" ? "text-green-950" : "text-white");
/** Em BOTÃO a cor do dia vira o tom do meio no escuro (o gerador clareia o fundo
 *  de botão) — o texto verde/amarelo-escuro, clareado junto, sumia (26/09). */
export const textoDoDiaEmBotao = (dia: string) =>
  dia === "QUINTA" || dia === "QUARTA" ? `${textoDoDia(dia)} dark:!text-neutral-950` : "text-white";

export interface TomDoDia {
  /** fundo pálido (cabeçalho da tabela, linha de hoje) */
  claro: string;
  /** grade fina da tabela */
  linha: string;
  borda: string;
  titulo: string;
  forte: string;
  /** botão cheio na cor do dia (texto já com contraste) */
  botao: string;
  anel: string;
  carimbo: string;
  parcial: string;
  miolo: string;
}

export const TOM_DO_DIA: Record<string, TomDoDia> = {
  SEGUNDA: { claro: "bg-blue-50", linha: "border-blue-100", borda: "border-blue-200", titulo: "text-blue-900", forte: "text-blue-700", botao: "bg-blue-600 text-white", anel: "ring-blue-500", carimbo: "bg-blue-100", parcial: "border-blue-500", miolo: "bg-blue-400" },
  "TERÇA": { claro: "bg-indigo-50", linha: "border-indigo-100", borda: "border-indigo-200", titulo: "text-indigo-900", forte: "text-indigo-700", botao: "bg-indigo-600 text-white", anel: "ring-indigo-500", carimbo: "bg-indigo-100", parcial: "border-indigo-500", miolo: "bg-indigo-400" },
  QUARTA: { claro: "bg-green-50", linha: "border-green-100", borda: "border-green-200", titulo: "text-green-900", forte: "text-green-700", botao: "bg-green-600 text-white", anel: "ring-green-500", carimbo: "bg-green-100", parcial: "border-green-500", miolo: "bg-green-400" },
  QUINTA: { claro: "bg-yellow-50", linha: "border-yellow-100", borda: "border-yellow-200", titulo: "text-yellow-900", forte: "text-yellow-700", botao: "bg-yellow-500 text-neutral-900", anel: "ring-yellow-500", carimbo: "bg-yellow-100", parcial: "border-yellow-500", miolo: "bg-yellow-400" },
  SEXTA: { claro: "bg-pink-50", linha: "border-pink-100", borda: "border-pink-200", titulo: "text-pink-900", forte: "text-pink-700", botao: "bg-pink-600 text-white", anel: "ring-pink-500", carimbo: "bg-pink-100", parcial: "border-pink-500", miolo: "bg-pink-400" },
  "SÁBADO": { claro: "bg-purple-50", linha: "border-purple-100", borda: "border-purple-200", titulo: "text-purple-900", forte: "text-purple-700", botao: "bg-purple-600 text-white", anel: "ring-purple-500", carimbo: "bg-purple-100", parcial: "border-purple-500", miolo: "bg-purple-400" },
  DOMINGO: { claro: "bg-violet-50", linha: "border-violet-100", borda: "border-violet-200", titulo: "text-violet-900", forte: "text-violet-700", botao: "bg-violet-600 text-white", anel: "ring-violet-500", carimbo: "bg-violet-100", parcial: "border-violet-500", miolo: "bg-violet-400" },
};
export const tomDoDia = (dia: string): TomDoDia => TOM_DO_DIA[dia] ?? TOM_DO_DIA.SEGUNDA;

/** Chip pastel de cada exercício (a ordem do dia dá a cor, como sempre foi). */
export const CORES_DOS_CHIPS: string[] = [
  "bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300",
  "bg-green-200 dark:bg-green-500/20 text-green-800 dark:text-green-300",
  "bg-purple-200 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300",
  "bg-red-200 dark:bg-red-500/20 text-red-800 dark:text-red-300",
  "bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300",
  "bg-cyan-200 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300",
  "bg-pink-200 dark:bg-pink-500/20 text-pink-800 dark:text-pink-300",
];
export const corDoChip = (i: number) => CORES_DOS_CHIPS[((i % CORES_DOS_CHIPS.length) + CORES_DOS_CHIPS.length) % CORES_DOS_CHIPS.length];

export function Chip({ indice, children, className, riscado }: { indice: number; children: ReactNode; className?: string; riscado?: boolean }) {
  return (
    <span className={cn("min-w-0 truncate rounded-md px-2 py-0.5 text-[14px] font-semibold", corDoChip(indice), riscado && "line-through opacity-70", className)}>
      {children}
    </span>
  );
}

/** O quadradinho de marcar do planner. O alvo de toque é 40 px; o desenho, 24. */
export function Quadradinho({
  marcado,
  parcial,
  onClick,
  rotulo,
  tom,
  className,
  testId,
  comoCaixa,
}: {
  marcado: boolean;
  parcial?: boolean;
  onClick?: () => void;
  rotulo: string;
  tom?: TomDoDia;
  className?: string;
  testId?: string;
  /** Lista de tarefas (28/09): anuncia como caixa de marcar (role="checkbox"), não botão de alternar. */
  comoCaixa?: boolean;
}) {
  const desenho = (
    <span
      className={cn(
        "w-6 h-6 rounded-md border-2 grid place-items-center transition-colors",
        // marca-grafico: no escuro o verde do ✓ fica no tom do meio (visível), não na tinta
        marcado ? "marca-grafico bg-green-500 border-green-500 text-white" : parcial ? cn("bg-card", tom?.parcial ?? "border-purple-500") : "bg-card border-blue-300",
      )}
    >
      {marcado ? <Check className="w-4 h-4" strokeWidth={3} /> : parcial ? <span className={cn("marca-grafico w-2.5 h-2.5 rounded-sm", tom?.miolo ?? "bg-purple-400")} /> : null}
    </span>
  );
  if (!onClick) return <span className={cn("w-10 h-10 shrink-0 grid place-items-center", className)} role="img" aria-label={rotulo}>{desenho}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      {...(comoCaixa ? { role: "checkbox", "aria-checked": marcado } : { "aria-pressed": marcado })}
      data-testid={testId}
      className={cn("w-10 h-10 shrink-0 grid place-items-center rounded-lg active:scale-95 transition-transform", className)}
    >
      {desenho}
    </button>
  );
}

/** Post-it amarelo colado torto — sugestão, nunca ordem. */
export function PostIt({ children, acao, className, testId }: { children: ReactNode; acao?: ReactNode; className?: string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-md bg-amber-100 px-3 py-2.5 flex items-center gap-2.5 -rotate-[1.2deg] shadow-[0_1px_0_rgba(0,0,0,.04),0_6px_14px_-8px_rgba(146,64,14,.45)]",
        className,
      )}
    >
      <span className="text-[15px] shrink-0" aria-hidden="true">📌</span>
      <p className="flex-1 min-w-0 text-[12.5px] leading-snug text-amber-900">{children}</p>
      {acao}
    </div>
  );
}

/** Linhas pautadas pra nota (as linhas rolam junto com o texto). */
export function Pautado({ className, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "block w-full resize-none bg-transparent outline-none text-[13.5px] leading-[28px] text-foreground/85 placeholder:text-muted-foreground",
        className,
      )}
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 27px, hsl(var(--border)) 27px 28px)",
        backgroundAttachment: "local",
        ...style,
      }}
    />
  );
}

/** Cabeçalho de seção: faixa cheia com título em CAIXA ALTA. */
export function FaixaDeSecao({ className, icone, titulo, direita }: { className: string; icone?: ReactNode; titulo: ReactNode; direita?: ReactNode }) {
  return (
    <div className={cn("min-h-[44px] px-4 py-2 flex items-center gap-2", className)}>
      {icone}
      <span className="text-[13px] font-extrabold tracking-wide uppercase min-w-0">{titulo}</span>
      {direita != null && <span className="ml-auto shrink-0 text-[12px] font-bold">{direita}</span>}
    </div>
  );
}

/** mm:ss */
export const minSeg = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
/** hh:mm:ss */
export const horaMinSeg = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
