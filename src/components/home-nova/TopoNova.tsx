import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { Fogo } from "@/components/conquistas/Fogo";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { semanaDaSequencia, type DiaDaSemana } from "@/lib/sequencia-semana";
import type { Faixa } from "@/lib/fogo-sequencia";

/**
 * TOPO DA HOME NOVA (mockup 25/10).
 *
 * Como no Cal AI: a saudação faz o papel do logo (é o nome da pessoa, não uma frase), e no canto
 * direito a pílula do fogo com a contagem de dias — na COR DA FAIXA (laranja → vermelho → roxo →
 * azul → dourado, lib/fogo-sequencia). Sem a frase embaixo (o dono mandou tirar).
 *
 * Direção "Semana": a semana Seg…Dom embaixo, cada dia como a sequência o vê (lib/sequencia-semana):
 * dia anotado = disco cheio na cor do fogo; hoje = cartão branco com sombra (o "você está aqui");
 * dia vazio = anel tracejado; futuro = só o número, apagado.
 * Direção "Fogo": só a saudação + a pílula (topo curto); a data entra como linha pequena em cima.
 */
interface Props {
  nome: string;
  seq: Sequencia;
  comSemana: boolean;
  /** Variação "Marca": a palavra CORE (o ícone do app é ela) no lugar da saudação, como o logo do Cal AI. */
  marca?: boolean;
}

const saudacao = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const dataPorExtenso = (): string => {
  const d = new Date();
  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const texto = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const rotuloCurto = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();

/** A pílula do fogo: "🔥 27" na cor da faixa, cartão flutuante; toque abre Conquistas. */
export const PilulaFogo = ({ seq }: { seq: Sequencia }) => {
  const navigate = useNavigate();
  const cor = { "--dias-c": seq.faixa.hojeTexto, "--dias-cd": seq.faixa.hojeTextoEscuro } as CSSProperties;
  return (
    <button
      type="button"
      onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
      aria-label={`${seq.dias} dias de sequência — abrir Conquistas`}
      data-testid="hn-pilula-fogo"
      className="hn-card !rounded-full h-11 pl-2.5 pr-3.5 flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
      style={cor}
    >
      {seq.dias > 0
        ? <Fogo faixa={seq.faixa} tamanho={22} viva />
        : <Flame className="w-[22px] h-[22px] text-muted-foreground" strokeWidth={2.2} aria-hidden />}
      <span className={`text-[17px] font-bold tabular-nums leading-none ${seq.dias > 0 ? "text-[var(--dias-c)] dark:text-[var(--dias-cd)]" : "text-muted-foreground"}`}>{seq.dias}</span>
    </button>
  );
};

const Disco = ({ d, faixa }: { d: DiaDaSemana; faixa: Faixa }) => {
  const numero = Number(d.dia.slice(8, 10));
  const base = "w-9 h-9 rounded-full grid place-items-center text-[14px] font-semibold tabular-nums leading-none";
  // dia feito: HOJE é o disco cheio (o que acabou de acontecer); os anteriores ficam em tinta suave da mesma cor —
  // cinco discos sólidos pesavam o topo inteiro, e o dono pediu uma Home que não pese
  if (d.estado === "feito" && d.ehHoje) {
    return (
      <span className={`${base} text-white`} style={{ background: `linear-gradient(180deg, ${faixa.meio}, ${faixa.escuro})` }} data-dia="feito-hoje">
        {numero}
      </span>
    );
  }
  if (d.estado === "feito") {
    const cor = { "--d-bg": `color-mix(in srgb, ${faixa.meio} 16%, transparent)`, "--d-bgd": `color-mix(in srgb, ${faixa.meio} 26%, transparent)`, "--d-c": faixa.hojeTexto, "--d-cd": faixa.hojeTextoEscuro } as CSSProperties;
    return (
      <span className={`${base} font-bold bg-[var(--d-bg)] dark:bg-[var(--d-bgd)] text-[var(--d-c)] dark:text-[var(--d-cd)]`} style={cor} data-dia="feito">
        {numero}
      </span>
    );
  }
  if (d.estado === "gelo") {
    return <span className={`${base} text-sky-700 dark:text-sky-300 bg-sky-400/15 dark:bg-sky-400/20`} data-dia="gelo">{numero}</span>;
  }
  if (d.estado === "hoje") {
    return <span className={`${base} text-foreground border-[1.5px] border-dashed`} style={{ borderColor: faixa.meio }} data-dia="hoje">{numero}</span>;
  }
  if (d.estado === "vazio") {
    return <span className={`${base} text-muted-foreground border-[1.5px] border-dashed border-foreground/20`} data-dia="vazio">{numero}</span>;
  }
  return <span className={`${base} text-muted-foreground/60`} data-dia="futuro">{numero}</span>;
};

export const TopoNova = ({ nome, seq, comSemana, marca }: Props) => {
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  return (
    <header data-testid="hn-topo">
      {!comSemana && !marca && (
        <p className="text-[13px] font-medium text-muted-foreground mb-1" data-testid="hn-data">{dataPorExtenso()}</p>
      )}
      <div className="flex items-center justify-between gap-3">
        {marca ? (
          <h1 className="text-[27px] leading-none font-black tracking-[-0.05em] pt-1" aria-label="CORE" data-testid="hn-marca">CORE</h1>
        ) : (
          <h1 className="text-[24px] leading-[1.15] font-bold tracking-[-0.02em] truncate min-w-0">
            {saudacao()}{nome ? `, ${nome}` : ""}
          </h1>
        )}
        <PilulaFogo seq={seq} />
      </div>

      {comSemana && (
        <div className="mt-5 grid grid-cols-7 gap-1" data-testid="hn-semana">
          {semana.map((d) => (
            <div
              key={d.dia}
              className={`flex flex-col items-center gap-2 py-2 rounded-2xl ${d.ehHoje ? "hn-card !rounded-2xl" : ""}`}
              data-hoje={d.ehHoje ? "true" : undefined}
            >
              <span className={`text-[12px] leading-none font-semibold ${d.ehHoje ? "text-foreground" : "text-muted-foreground"}`}>{rotuloCurto(d.rotulo)}</span>
              <Disco d={d} faixa={seq.faixa} />
            </div>
          ))}
        </div>
      )}
    </header>
  );
};
