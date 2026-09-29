/**
 * KIT VISUAL DO PET (29/09) — direção "RG do pet".
 *
 * A linguagem é a de DOCUMENTO: o bicho tem um RG (faixa de mel, guilhoché,
 * campos em caixa alta, Nº) e uma carteirinha (etiquetas, carimbo de
 * terracota). A cara de planner do CORE continua: rótulo pequeno em caixa
 * alta, quadradinho de marcar, linhas de tabela. Papel, cartão, tinta e borda
 * são SEMPRE os do tema; as cores do Pet (pet.css) são só acento e decoração.
 */
import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { EMOJI_DA_ESPECIE, especieDe, type Pet } from "@/lib/pet";
import { TIPOS, quandoTexto, type LinhaDaCarteirinha, type TipoCuidado } from "@/lib/pet-cuidados";
import "./pet.css";

/* ─────────────────────────────── ícones ─────────────────────────────── */

export const Pata = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <ellipse cx="6" cy="10" rx="2.2" ry="2.8" />
    <ellipse cx="10" cy="6" rx="2.2" ry="2.9" />
    <ellipse cx="14.5" cy="6" rx="2.2" ry="2.9" />
    <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" />
    <path d="M12.2 11.5c-2.9 0-6 3.4-6 6.1 0 1.7 1.3 2.4 2.8 2.4 1.3 0 2-.7 3.2-.7s1.9.7 3.2.7c1.5 0 2.8-.7 2.8-2.4 0-2.7-3.1-6.1-6-6.1z" />
  </svg>
);

/* ─────────────────────────────── foto ─────────────────────────────── */

/** A foto do bicho; sem foto (ou foto que não carrega), o emoji da espécie num fundo de mel. */
export const FotoDoPet = ({ pet, className = "", emojiClass = "text-2xl" }: { pet: Pick<Pet, "name" | "species" | "photoUrl">; className?: string; emojiClass?: string }) => {
  const [falhou, setFalhou] = useState(false);
  if (pet.photoUrl && !falhou) {
    return <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} onError={() => setFalhou(true)} className={`object-cover ${className}`} />;
  }
  return (
    <span role="img" aria-label={`Sem foto de ${pet.name}`} className={`grid place-items-center bg-[hsl(var(--pet-mel-suave))] ${className}`}>
      <span className={emojiClass} aria-hidden="true">{EMOJI_DA_ESPECIE[especieDe(pet.species)]}</span>
    </span>
  );
};

/* ─────────────────────────────── cartão ─────────────────────────────── */

/** Cartão com a linha de título do documento: marcador de mel + CAIXA ALTA + o que vai à direita. */
export const CartaoPet = ({
  titulo, direita, children, dataCard, className = "",
}: { titulo: ReactNode; direita?: ReactNode; children: ReactNode; dataCard?: string; className?: string }) => (
  <section data-card={dataCard} className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
    <div className="flex items-center gap-2 px-3.5 min-h-[40px] border-b border-border">
      <span aria-hidden="true" className="w-2 h-2 rounded-[2px] bg-[hsl(var(--pet-mel))] shrink-0" />
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">{titulo}</h3>
      {direita && <div className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">{direita}</div>}
    </div>
    {children}
  </section>
);

/* ─────────────────────────────── quadradinho ─────────────────────────────── */

/** O quadradinho de marcar do planner, com alvo de 44 px pro dedo. */
export const Quadradinho = ({ marcado, onClick, rotulo }: { marcado: boolean; onClick: () => void; rotulo: string }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={marcado}
    aria-label={rotulo}
    onClick={onClick}
    className="w-11 h-11 -my-1 shrink-0 grid place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span
      className={`w-[22px] h-[22px] rounded-[6px] grid place-items-center border-2 transition-colors ${
        marcado ? "pet-marcou bg-accent border-accent text-accent-foreground dark:text-background" : "border-foreground/30 bg-card"
      }`}
    >
      {marcado && <Check className="w-3.5 h-3.5" strokeWidth={3.2} aria-hidden="true" />}
    </span>
  </button>
);

/* ─────────────────────────────── etiqueta, status, carimbo ─────────────────────────────── */

export const Etiqueta = ({ tipo, children }: { tipo?: TipoCuidado; children?: ReactNode }) => (
  <span className="inline-flex items-center rounded-[5px] px-1.5 h-[20px] text-[9.5px] font-extrabold tracking-[0.07em] uppercase bg-[hsl(var(--pet-mel-suave))] text-[hsl(var(--pet-mel-tinta))] whitespace-nowrap">
    {children ?? (tipo ? TIPOS[tipo].etiqueta : "")}
  </span>
);

/** "venceu há 2 dias" em vermelho, "em 5 dias" em âmbar, o resto no cinza do tema. */
export const QuandoTexto = ({ linha, className = "" }: { linha: Pick<LinhaDaCarteirinha, "status" | "diasAte" | "proxima">; className?: string }) => {
  const cor = linha.status === "atrasado" ? "text-[hsl(var(--pet-atraso))] font-bold"
    : linha.status === "hoje" || linha.status === "logo" ? "text-[hsl(var(--pet-logo))] font-bold"
    : "text-muted-foreground";
  return <span className={`${cor} ${className}`}>{quandoTexto(linha)}</span>;
};

/**
 * Carimbo redondo de terracota — a marca de "aplicada" da carteirinha. O giro
 * mora no de fora (classe do Tailwind, que compõe com o scale de quem usa); a
 * "batida" do carimbo novo mora no de dentro — assim uma não apaga a outra.
 */
export const Carimbo = ({ topo = "APLICADA", data, ano, novo = false, className = "" }: { topo?: string; data: string; ano?: string; novo?: boolean; className?: string }) => (
  <span
    role="img"
    aria-label={`${topo.toLowerCase()} em ${data}${ano ? `/${ano}` : ""}`}
    className={`relative inline-block w-[58px] h-[58px] shrink-0 -rotate-[9deg] ${className}`}
  >
    <span className={`absolute inset-0 grid place-items-center text-center rounded-full border-2 border-[hsl(var(--pet-carimbo))] text-[hsl(var(--pet-carimbo))] leading-[1.05] ${novo ? "pet-carimbo-novo" : ""}`} aria-hidden="true">
      {/* anel de dentro: carimbo de verdade tem borda dupla */}
      <span className="absolute inset-[3px] rounded-full border border-[hsl(var(--pet-carimbo)/0.55)]" />
      <span>
        <span className="block text-[7.5px] font-extrabold tracking-[0.08em]">{topo}</span>
        <span className="block text-[12px] font-extrabold tabular-nums">{data}</span>
        {ano && <span className="block text-[8px] font-bold tabular-nums tracking-[0.06em]">{ano}</span>}
      </span>
    </span>
  </span>
);

/* ─────────────────────────────── botões ─────────────────────────────── */

type VarianteBotao = "principal" | "secundario" | "fantasma" | "perigo";
const VARIANTES: Record<VarianteBotao, string> = {
  // a ação principal no magenta da marca (o acento do tema); no escuro o texto é o papel, não branco
  principal: "bg-accent text-accent-foreground dark:text-background hover:opacity-90",
  secundario: "bg-muted text-foreground hover:bg-muted/70",
  fantasma: "text-foreground hover:bg-muted",
  perigo: "border border-destructive/40 text-destructive hover:bg-destructive/10",
};
export const BotaoPet = ({
  variante = "principal", children, className = "", ...resto
}: { variante?: VarianteBotao; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...resto}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 min-h-[44px] text-[13px] font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VARIANTES[variante]} ${className}`}
  >
    {children}
  </button>
);

/** Chip de escolha (espécie, sexo, porte, intervalo): marcado = tinta do tema, como a aba ativa. */
export const Chip = ({ ativo, onClick, children, className = "", ...resto }: { ativo: boolean; onClick: () => void; children: ReactNode; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) => (
  <button
    type="button"
    aria-pressed={ativo}
    onClick={onClick}
    {...resto}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 min-h-[44px] text-[13px] font-semibold transition-colors ${
      ativo ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:bg-muted"
    } ${className}`}
  >
    {children}
  </button>
);

/* ─────────────────────────────── folha ─────────────────────────────── */

/** A folha de baixo do Pet: título em caixa alta com a pata, conteúdo rolável. */
export const FolhaPet = ({
  aberta, onFechar, titulo, sub, children, testId,
}: { aberta: boolean; onFechar: () => void; titulo: string; sub?: string; children: ReactNode; testId?: string }) => (
  <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
    <SheetContent
      side="bottom"
      semFechar
      // sem foco automático no 1º campo: no celular ele abria o teclado por cima da folha inteira
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="tema-pet max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-background"
      data-testid={testId}
    >
      <div className="mx-auto w-10 h-1 rounded-full bg-border mb-1.5" aria-hidden="true" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[hsl(var(--pet-mel))]"><Pata className="w-4 h-4" /></span>
        <SheetTitle className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-foreground flex-1 min-w-0 truncate">{titulo}</SheetTitle>
        <SheetClose className="w-11 h-11 -mr-2 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Fechar">
          <X className="w-5 h-5" aria-hidden="true" />
        </SheetClose>
      </div>
      {sub ? <SheetDescription className="text-[13px] text-muted-foreground mb-3">{sub}</SheetDescription> : <SheetDescription className="sr-only">{titulo}</SheetDescription>}
      {children}
    </SheetContent>
  </Sheet>
);

/** Rótulo de campo em caixa alta (o "ESPÉCIE", "PESO" do RG), usado também nos formulários. */
export const RotuloCampo = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">{children}</label>
);

export const campoClasse = "w-full h-11 rounded-lg border border-input bg-card px-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring";
