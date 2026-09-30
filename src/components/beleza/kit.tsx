/**
 * O KIT VISUAL DA BELEZA (28/09). O dono recusou o visual anterior: "Beleza tem
 * que ser uma estética mais feminina, não azul… parece que você pegou o módulo
 * de Treino e transformou algumas coisas". As funções ficaram; a linguagem é
 * própria e mora aqui, pra todas as telas da Beleza (e as próximas) usarem:
 *
 *  - cores: tokens com escopo no módulo (beleza.css → `.tema-beleza`), claro e
 *    escuro (ameixa profundo, não cinza). Faixa do dia em rosé; MANHÃ em pêssego
 *    com sol, NOITE em malva com lua — a dimensão natural da beleza, no lugar da
 *    cor do dia da semana do Treino;
 *  - tipo: Inter de sempre + Instrument Serif itálica em poucos acentos
 *    ("Skincare de hoje", "manhã", "noite");
 *  - forma: cantos macios, chips em pílula, sombra leve, cartão de dica em papel
 *    blush (no lugar do post-it do Treino), gotas pros ativos na semana;
 *  - o que fica do CORE: o quadradinho de marcar, o rótulo pequeno em CAIXA
 *    ALTA, o ritmo de tabela e o magenta da marca na ação principal.
 *
 * Botão só-ícone leva classe `bg-*`: a regra global do alvo de toque (index.css)
 * infla botão "nu" com 8 px de cada lado.
 */
import "./beleza.css";
import { useState, type HTMLAttributes, type ReactNode } from "react";
import { Check, Droplet, Moon, Sparkles, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";

/** A classe que liga os tokens da Beleza (raiz da página, card da Home, folhas e diálogos — que abrem fora da página). */
export const TEMA_BELEZA = "tema-beleza";

/** Acento em serifa itálica — com parcimônia. */
export const Serif = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("bz-serif", className)}>{children}</span>
);

/** Rótulo pequeno em CAIXA ALTA (a assinatura de planner do CORE, mais leve). */
export const ROTULO_BZ = "text-[10.5px] font-extrabold tracking-[.14em] uppercase text-bz-suave";

/** O botão principal em pílula, no magenta da marca. */
export const BOTAO_PILULA =
  "shrink-0 h-10 px-4 rounded-full bg-bz-acento text-bz-acento-tinta text-[13px] font-bold active:scale-95 transition disabled:opacity-40";

/** O secundário: pílula com contorno. */
export const BOTAO_CONTORNO =
  "shrink-0 h-10 px-4 rounded-full bg-bz-cartao border border-bz-linha-forte text-bz-tinta text-[13px] font-semibold active:scale-95 transition";

/** Cartão da Beleza: canto macio, borda fininha rosada, sombra leve. */
export function CartaoBeleza({ className, children, ...resto }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...resto}
      className={cn(
        "bg-bz-cartao border border-bz-linha rounded-[var(--bz-raio,24px)] overflow-hidden shadow-[0_14px_34px_-26px_hsl(var(--bz-sombra)/0.6)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export type TomBz = "rose" | "manha" | "noite" | "dica" | "blush" | "alerta";
const FAIXA: Record<TomBz, string> = {
  rose: "bg-bz-rose text-bz-rose-tinta",
  manha: "bg-bz-manha text-bz-manha-tinta",
  noite: "bg-bz-noite text-bz-noite-tinta",
  dica: "bg-bz-dica text-bz-dica-tinta",
  blush: "bg-bz-blush text-bz-tinta",
  alerta: "bg-bz-alerta text-bz-alerta-tinta",
};

/** Cabeçalho de seção: faixa suave, ícone num círculo, título em CAIXA ALTA (+ acento em serifa) e o que vai à direita. */
export function FaixaBeleza({
  tom = "rose",
  icone,
  titulo,
  acento,
  direita,
  className,
}: {
  tom?: TomBz;
  icone?: ReactNode;
  titulo: ReactNode;
  acento?: ReactNode;
  direita?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(FAIXA[tom], "min-h-[48px] px-3.5 py-2 flex items-center gap-2.5", className)}>
      {icone && (
        <span className="shrink-0 grid place-items-center w-8 h-8 rounded-full bg-bz-cartao/75" aria-hidden="true">
          {icone}
        </span>
      )}
      <h2 className="min-w-0 flex items-baseline gap-1.5">
        <span className="text-[12px] font-extrabold tracking-[.14em] uppercase whitespace-nowrap">{titulo}</span>
        {acento && <Serif className="text-[16.5px] leading-none truncate opacity-90">{acento}</Serif>}
      </h2>
      {direita != null && <span className="ml-auto shrink-0 text-[11.5px] font-bold tabular-nums">{direita}</span>}
    </div>
  );
}

/** Ícone do período, num círculo claro sobre a faixa. */
export function IconePeriodo({ periodo, className }: { periodo: "manha" | "noite"; className?: string }) {
  return (
    <span className={cn("shrink-0 grid place-items-center w-8 h-8 rounded-full bg-bz-cartao/75", className)} aria-hidden="true">
      {periodo === "manha" ? <Sun className="w-4 h-4 text-bz-manha-icone" /> : <Moon className="w-4 h-4 text-bz-noite-icone" />}
    </span>
  );
}

/** A faixa de MANHÃ (pêssego, sol) e de NOITE (malva, lua): "manhã" em serifa + o resto em miúdo. */
export function FaixaDoPeriodo({
  periodo,
  extra,
  direita,
  testId,
}: {
  periodo: "manha" | "noite";
  extra?: ReactNode;
  direita?: ReactNode;
  testId?: string;
}) {
  const manha = periodo === "manha";
  return (
    <div
      className={cn(manha ? "bg-bz-manha text-bz-manha-tinta" : "bg-bz-noite text-bz-noite-tinta", "flex items-center gap-2 pl-2.5 pr-3.5 min-h-[46px]")}
      data-testid={testId}
    >
      <IconePeriodo periodo={periodo} />
      <Serif className="text-[20px] leading-none">{manha ? "manhã" : "noite"}</Serif>
      {/* "noite de Retinol", "noite de descanso", "noite sem ativos" */}
      {extra && <span className="min-w-0 truncate text-[12px] font-semibold opacity-85">{extra}</span>}
      {direita != null && <span className="ml-auto flex items-center gap-2 shrink-0 text-[11px] font-bold tabular-nums">{direita}</span>}
    </div>
  );
}

/** O quadradinho de marcar do CORE, na versão da Beleza: macio, marcado em magenta. Alvo de 40 px. */
export function Marcar({ marcado, onClick, rotulo, className }: { marcado: boolean; onClick: () => void; rotulo: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      onClick={onClick}
      className={cn("w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-transparent active:scale-95 transition-transform", className)}
    >
      <span
        className={cn(
          "w-6 h-6 rounded-[9px] border-2 grid place-items-center transition-colors",
          marcado ? "bg-bz-acento border-bz-acento text-bz-acento-tinta" : "bg-bz-cartao border-bz-linha-forte",
        )}
      >
        {marcado && <Check className="w-4 h-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

export type TomChip = "rose" | "manha" | "noite" | "blush" | "contorno" | "alerta" | "ok";
const CHIP: Record<TomChip, string> = {
  rose: "bg-bz-rose text-bz-rose-tinta",
  manha: "bg-bz-manha text-bz-manha-tinta",
  noite: "bg-bz-noite text-bz-noite-tinta",
  blush: "bg-bz-blush text-bz-tinta",
  contorno: "border border-bz-linha-forte text-bz-suave",
  alerta: "bg-bz-alerta text-bz-alerta-tinta",
  ok: "bg-bz-ok text-bz-ok-tinta",
};

/** Chip em pílula. */
export function Chip({ tom = "blush", children, className }: { tom?: TomChip; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 text-[10.5px] font-bold leading-[18px] whitespace-nowrap", CHIP[tom], className)}>
      {children}
    </span>
  );
}

/* CABELO (Onda 1, 28/09): as 3 etapas do cronograma — babosa (H), mel (N), ameixa (R). */
export type EtapaDoKit = "hidratacao" | "nutricao" | "reconstrucao";
export const TOM_DA_ETAPA: Record<EtapaDoKit, string> = {
  hidratacao: "bg-bz-hidra text-bz-hidra-tinta",
  nutricao: "bg-bz-nutri text-bz-nutri-tinta",
  reconstrucao: "bg-bz-recons text-bz-recons-tinta",
};
const LETRA_DA_ETAPA: Record<EtapaDoKit, string> = { hidratacao: "H", nutricao: "N", reconstrucao: "R" };

/** A letra da etapa (H/N/R) numa bolinha da cor dela; feita = contorno forte + ✓ ao lado. */
export function LetraDaEtapa({ etapa, feita, tamanho = "md", className }: { etapa: EtapaDoKit; feita?: boolean; tamanho?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 inline-grid place-items-center rounded-full font-extrabold tabular-nums",
        tamanho === "sm" ? "w-6 h-6 text-[11px]" : "w-8 h-8 text-[13px]",
        TOM_DA_ETAPA[etapa],
        feita && "ring-2 ring-bz-acento/70",
        className,
      )}
    >
      {LETRA_DA_ETAPA[etapa]}
    </span>
  );
}

export type TipoGota = "retinol" | "acido" | "serum" | "base";
const GOTA: Record<Exclude<TipoGota, "base">, string> = { retinol: "text-bz-retinol", acido: "text-bz-acido", serum: "text-bz-serum" };

/** A gota da semana: retinol em ameixa, ácido em pêssego, sérum em rosé; o passo de base, um pontinho nude. */
export function Gota({ tipo, className }: { tipo: TipoGota; className?: string }) {
  if (tipo === "base") return <span aria-hidden="true" className={cn("inline-block w-2 h-2 rounded-full bg-bz-base", className)} />;
  return <Droplet aria-hidden="true" fill="currentColor" strokeWidth={1.25} className={cn("inline-block w-[15px] h-[15px]", GOTA[tipo], className)} />;
}

/** Cartão de dica em papel blush (o lugar do post-it do Treino): ícone, texto e, se tiver, a ação em pílula. */
export function Dica({
  children,
  acao,
  icone,
  testId,
  className,
}: {
  children: ReactNode;
  acao?: ReactNode;
  icone?: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn("rounded-2xl border border-dashed border-bz-dica-borda bg-bz-dica px-3 py-2.5 flex items-center gap-3", className)}
    >
      <span aria-hidden="true" className="shrink-0 grid place-items-center w-8 h-8 rounded-full bg-bz-cartao/80 text-bz-acento">
        {icone ?? <Sparkles className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0 text-[13px] leading-snug text-bz-dica-tinta">{children}</div>
      {acao}
    </div>
  );
}

/**
 * As dicas do módulo, no papel da Beleza (o ModuleTip cinza destoava no topo).
 * Mesma chave do ModuleTip (`core-tip-seen-beleza`): quem já fechou não vê de novo.
 */
export function DicasDaBeleza({ dicas }: { dicas: string[] }) {
  const { get, set } = useUserData();
  const chave = "core-tip-seen-beleza";
  const [aberta, setAberta] = useState(() => !get<string>(chave, ""));
  if (!aberta) return null;
  return (
    <div className="relative rounded-2xl border border-dashed border-bz-dica-borda bg-bz-dica pl-4 pr-11 py-3.5" data-testid="dicas-beleza">
      <button
        type="button"
        aria-label="Fechar dicas"
        onClick={() => { set(chave, "true"); setAberta(false); }}
        className="absolute top-1 right-1 w-10 h-10 grid place-items-center rounded-full bg-transparent text-bz-dica-tinta/70"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold tracking-[.14em] uppercase text-bz-dica-tinta">
        <Sparkles className="w-3.5 h-3.5 text-bz-acento" aria-hidden="true" /> Dicas pra começar
      </p>
      <ul className="mt-1.5 space-y-1">
        {dicas.map((d) => (
          <li key={d} className="flex gap-1.5 text-[12.5px] leading-snug text-bz-dica-tinta/90">
            <span aria-hidden="true">·</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
