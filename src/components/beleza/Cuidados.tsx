/**
 * A aba CUIDADOS (28/09, Onda 1 — aba própria, no lugar do DIÁRIO). A tabela
 * PRÓXIMOS CUIDADOS (CUIDADO | ÚLTIMA | PRÓXIMA | FALTA), com o que vence primeiro no
 * topo; tocar abre a ficha (FEITO, MARQUEI HORÁRIO, histórico). Os modelos do dono
 * entram em 1 toque: unha 7 dias · unha em gel 21 · sobrancelha 21 · cera 28 ·
 * laser 45 (com pacote) · retoque de raiz 35 — tudo editável — ou "+ cuidado" livre.
 */
import { useState } from "react";
import { CalendarClock, Home, Plus } from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_WIDGETS_HOME, comWidget } from "@/hooks/use-home-widgets";
import { trackEvent } from "@/lib/analytics";
import { cn, parseLocalDay } from "@/lib/utils";
import {
  EMOJI_DO_TIPO, MODELOS, faltaDoCuidado, proximaDoCuidado, textoDaFalta, textoDoPacote, type Cuidado,
} from "@/lib/beleza-cuidados";
import { BOTAO_PILULA, CartaoBeleza, Dica, FaixaBeleza, ROTULO_BZ } from "./kit";
import { FichaDoCuidado } from "./ficha-do-cuidado";
import { useCuidados } from "./use-cuidados";

const dm = (dia?: string) => (dia ? parseLocalDay(dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");

/** A pílula do FALTA: hoje/amanhã em magenta, vencido em alerta, o resto neutro. */
export function Falta({ n }: { n: number | undefined }) {
  const tom = n === undefined ? "text-bz-suave" : n < 0 ? "bg-bz-alerta text-bz-alerta-tinta" : n <= 1 ? "bg-bz-acento text-bz-acento-tinta" : n <= 3 ? "bg-bz-rose text-bz-rose-tinta" : "bg-bz-blush text-bz-tinta";
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight text-center", tom)} data-testid="falta">
      {textoDaFalta(n)}
    </span>
  );
}

export function LinhaDoCuidado({ c, hoje, onAbrir }: { c: Cuidado; hoje: string; onAbrir: () => void }) {
  const proxima = proximaDoCuidado(c);
  const sub = [c.pacote ? textoDoPacote(c.pacote) : "", c.horario ? `horário ${c.horario.hora}` : "", c.local ?? ""].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full grid grid-cols-[minmax(0,1fr)_2.6rem_2.9rem_4.4rem] items-center gap-1.5 px-3 min-h-[58px] py-2 border-t border-bz-linha text-left bg-transparent active:bg-bz-blush/60"
      data-testid="linha-cuidado"
      aria-label={`${c.nome}: ${textoDaFalta(faltaDoCuidado(c, hoje))}`}
    >
      <span className="min-w-0 flex items-center gap-2">
        <span className="hidden min-[380px]:grid w-8 h-8 shrink-0 rounded-full bg-bz-blush place-items-center text-[15px]" aria-hidden="true">{EMOJI_DO_TIPO[c.tipo]}</span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold leading-snug text-bz-tinta line-clamp-2">{c.nome}</span>
          {sub && <span className="block text-[11px] text-bz-suave truncate">{sub}</span>}
        </span>
      </span>
      <span className="text-[12px] tabular-nums text-bz-suave text-center">{dm(c.ultima)}</span>
      <span className={cn("text-[12px] tabular-nums text-center font-semibold", c.horario ? "text-bz-acento" : "text-bz-tinta")}>{dm(proxima)}</span>
      <span className="flex justify-end"><Falta n={faltaDoCuidado(c, hoje)} /></span>
    </button>
  );
}

export function Cuidados() {
  const x = useCuidados();
  const { get, set } = useUserData();
  const [aberto, setAberto] = useState<string | null>(null);
  const [livre, setLivre] = useState(false);
  const [nomeLivre, setNomeLivre] = useState("");
  const [diasLivre, setDiasLivre] = useState("30");
  const [ofertaHome, setOfertaHome] = useState(false);

  const naHome = (() => {
    const l = get<unknown>(CHAVE_WIDGETS_HOME, []);
    return Array.isArray(l) && l.some((w) => (w as { id?: string })?.id === "cuidados");
  })();
  const porNaHome = () => {
    const nova = comWidget(get<unknown>(CHAVE_WIDGETS_HOME, []), "cuidados", "large");
    if (nova) set(CHAVE_WIDGETS_HOME, nova);
    setOfertaHome(false);
    trackEvent("cuidados_widget_home", {});
    toast.success("\"Próximos cuidados\" está na sua Home", { description: "Tira quando quiser em Adicionar widget." });
  };

  const adicionar = (tipo: (typeof MODELOS)[number]["tipo"] | "outro") => {
    if (tipo === "outro") {
      const n = Math.round(Number(diasLivre));
      if (!nomeLivre.trim() || !(n >= 1)) return;
      const c = x.adicionar("outro", nomeLivre, n);
      setNomeLivre(""); setLivre(false);
      setAberto(c.id);
    } else {
      const c = x.adicionar(tipo);
      setAberto(c.id);
    }
    if (!naHome && x.cuidados.length === 0) setOfertaHome(true);
    trackEvent("cuidado_adicionado", { tipo });
  };
  const jaTem = new Set(x.cuidados.map((c) => c.tipo));

  return (
    <div className="space-y-4" data-testid="aba-cuidados">
      {ofertaHome && !naHome && (
        <Dica icone={<Home className="w-4 h-4" />} testId="oferta-cuidados-home" acao={<button type="button" onClick={porNaHome} className={BOTAO_PILULA}>Pôr</button>}>
          Ver os <b>próximos cuidados</b> na Home?
        </Dica>
      )}

      <CartaoBeleza data-testid="proximos-cuidados">
        <FaixaBeleza
          icone={<CalendarClock className="w-4 h-4 text-bz-acento" />}
          titulo="PRÓXIMOS CUIDADOS"
          direita={x.cuidados.length ? <span>{x.cuidados.length} {x.cuidados.length === 1 ? "cuidado" : "cuidados"}</span> : undefined}
        />
        {x.ordenados.length > 0 ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_2.6rem_2.9rem_4.4rem] gap-1.5 px-3 py-2 bg-bz-blush text-[9.5px] font-extrabold uppercase tracking-[.1em] text-bz-suave" aria-hidden="true">
              <span>Cuidado</span><span className="text-center">Última</span><span className="text-center">Próxima</span><span className="text-right">Falta</span>
            </div>
            {x.ordenados.map((c) => <LinhaDoCuidado key={c.id} c={c} hoje={x.hoje} onAbrir={() => setAberto(c.id)} />)}
          </>
        ) : (
          <p className="px-4 py-3 border-t border-bz-linha text-[13px] text-bz-suave">
            Unha, sobrancelha, depilação, raiz: o CORE conta os dias e avisa. Escolha abaixo o que você faz.
          </p>
        )}
      </CartaoBeleza>

      <CartaoBeleza data-testid="adicionar-cuidado">
        <FaixaBeleza tom="blush" icone={<Plus className="w-4 h-4 text-bz-acento" />} titulo="NOVO CUIDADO" direita={<span className="font-semibold opacity-80">1 toque, dá pra mudar</span>} />
        <div className="px-3 py-3 grid grid-cols-2 gap-2">
          {MODELOS.map((m) => (
            <button
              key={m.tipo}
              type="button"
              onClick={() => adicionar(m.tipo)}
              className={cn("min-h-[52px] rounded-2xl border px-3 py-2 text-left flex items-center gap-2 transition-colors active:bg-bz-blush", jaTem.has(m.tipo) ? "border-bz-linha bg-bz-papel opacity-70" : "border-bz-linha-forte bg-bz-cartao")}
              data-testid={`modelo-${m.tipo}`}
            >
              <span className="text-[18px]" aria-hidden="true">{m.emoji}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight text-bz-tinta">{m.nome}</span>
                <span className="block text-[11px] text-bz-suave">a cada {m.intervaloDias} dias{m.pacote ? " · pacote" : ""}</span>
              </span>
            </button>
          ))}
        </div>
        {livre ? (
          <div className="px-3 pb-3 space-y-2" data-testid="form-cuidado-livre">
            <p className={ROTULO_BZ}>Outro cuidado</p>
            <div className="flex gap-2">
              <input value={nomeLivre} onChange={(e) => setNomeLivre(e.target.value)} placeholder="Ex.: Cílios, limpeza de pele" aria-label="Nome do cuidado" className="flex-1 h-10 rounded-full border border-bz-linha-forte bg-bz-cartao px-4 text-[13px] text-bz-tinta" />
              <input value={diasLivre} onChange={(e) => setDiasLivre(e.target.value)} inputMode="numeric" aria-label="A cada quantos dias" className="w-16 h-10 rounded-full border border-bz-linha-forte bg-bz-cartao px-3 text-center text-[13px] font-bold text-bz-tinta" />
              <span className="self-center text-[12px] text-bz-suave">dias</span>
            </div>
            <button type="button" onClick={() => adicionar("outro")} className={cn(BOTAO_PILULA, "w-full")} data-testid="salvar-cuidado-livre">Adicionar</button>
          </div>
        ) : (
          <button type="button" onClick={() => setLivre(true)} className="w-full h-11 border-t border-bz-linha bg-transparent text-[13px] font-semibold text-bz-acento active:bg-bz-blush" data-testid="cuidado-livre">
            + outro cuidado
          </button>
        )}
      </CartaoBeleza>

      <p className="text-center text-[11.5px] text-bz-suave px-6">O CORE registra, lembra e soma o gasto — o horário você marca no salão.</p>
      <FichaDoCuidado x={x} id={aberto} onFechar={() => setAberto(null)} />
    </div>
  );
}
