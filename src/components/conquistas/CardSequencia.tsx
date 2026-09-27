import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Flame, Shield, Sparkles } from "lucide-react";
import { protetorGanhoNaSemana, semanaCompleta, semanaDaSequencia, type DiaDaSemana } from "@/lib/sequencia-semana";
import type { Sequencia } from "./use-conquistas";
import { LembreteDaSequencia } from "./LembreteDaSequencia";
import "./conquistas.css";

/**
 * Card SEQUÊNCIA (26/09; a semana entrou em 27/09): faixa laranja→rosa com os
 * dias e os protetores, a SEMANA SEG…DOM (dia feito = disco laranja com
 * chama; protetor = disco de gelo; hoje = anel tracejado com a chama
 * fantasma; futuro/vazio = disco cinza) e o que falta hoje. Quando hoje fica
 * garantido com o card na tela, o disco de hoje "acende" (anel gira e some,
 * disco cresce, chama entra, onda, faíscas), o contador rola e o texto troca.
 * Semana inteira fechada = faixa dourada "SEMANA COMPLETA · +1 PROTETOR".
 */

const CHAMA = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

const Cubo = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
    <path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="rgba(255,255,255,.55)" />
    <path d="M4 8l8 4 8-4M12 12v8" />
  </svg>
);

// 6 faíscas em arco com gravidade (dx/dy calculados aqui: `cos()` em CSS não é garantido no WebView antigo)
const FAISCAS = Array.from({ length: 6 }, (_, i) => {
  const ang = (i / 6) * Math.PI * 2 + 0.5;
  const dist = 20 + (i % 3) * 7;
  return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist + 12 };
});

const Dia = ({ d, indice, agora }: { d: DiaDaSemana; indice: number; agora: boolean }) => {
  const estado = agora && d.ehHoje ? "feito-agora" : d.estado;
  return (
    <div className="seq-dia" data-estado={estado} data-dia={d.dia} style={{ "--i": indice } as CSSProperties}>
      <span className="seq-dia-rot">{d.rotulo}</span>
      <span className="seq-disco">
        {estado === "feito" && <svg className="seq-glifo" viewBox="0 0 24 24"><path d={CHAMA} /></svg>}
        {estado === "gelo" && <Cubo className="seq-glifo-gelo" />}
        {(estado === "hoje" || estado === "feito-agora") && (
          <>
            <svg className="seq-anel" viewBox="0 0 40 40" aria-hidden><circle cx="20" cy="20" r="17.5" fill="none" stroke="#f97316" strokeWidth="2.2" strokeDasharray="4.6 3.4" /></svg>
            <svg className="seq-fantasma" viewBox="0 0 24 24" aria-hidden><path d={CHAMA} /></svg>
          </>
        )}
        {estado === "feito-agora" && (
          <>
            <span className="seq-fill" />
            <svg className="seq-glifo seq-chama-cheia" viewBox="0 0 24 24"><path d={CHAMA} /></svg>
            <span className="seq-ripple" />
            {FAISCAS.map((f, i) => <i key={i} className="seq-spark" style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px` } as CSSProperties} />)}
          </>
        )}
      </span>
    </div>
  );
};

/** O número que rola (12 → 13): o velho sobe, o novo entra por baixo. Fora do rolo é texto puro. */
const Rolo = ({ valor }: { valor: number }) => {
  const anterior = useRef(valor);
  const [par, setPar] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (anterior.current === valor) return;
    const de = anterior.current;
    anterior.current = valor;
    setPar([de, valor]);
    const t = setTimeout(() => setPar(null), 480);
    return () => clearTimeout(t);
  }, [valor]);
  if (!par) return <>{valor}</>;
  return (
    <span className="rolo" aria-hidden>
      <span className="rolo-in"><span>{par[0]}</span><span>{par[1]}</span></span>
    </span>
  );
};

export const CardSequencia = ({ seq, onAcao }: { seq: Sequencia; onAcao: (rota: string) => void }) => {
  const { dias, saldo, hojeFeito, acao, protegidoOntem, lista, usados, hoje } = seq;
  const reduzir = useReducedMotion();
  const semana = useMemo(() => semanaDaSequencia(lista, usados, hoje), [lista, usados, hoje]);
  const completa = semanaCompleta(semana);
  const ganhouProtetor = useMemo(() => completa && protetorGanhoNaSemana(lista, hoje), [completa, lista, hoje]);

  // "hoje garantido" com o card na tela → a micro-animação (nunca na 1ª pintura)
  const [agora, setAgora] = useState(false);
  const antes = useRef(hojeFeito);
  useEffect(() => {
    const era = antes.current;
    antes.current = hojeFeito;
    if (!hojeFeito || era || reduzir) return;
    setAgora(true);
    const t = setTimeout(() => setAgora(false), 820);
    return () => clearTimeout(t);
  }, [hojeFeito, reduzir]);

  // um <span> só: dentro do inline-flex com gap, dois pedaços de texto ganhavam espaço dobrado
  const protetores =
    saldo > 0 ? (
      <span>
        {saldo} {saldo === 1 ? "protetor" : "protetores"}
        <span className="hidden min-[400px]:inline"> {saldo === 1 ? "guardado" : "guardados"}</span>
      </span>
    ) : (
      <span>nenhum protetor</span>
    );

  const troca = reduzir ? { duration: 0.15 } : { duration: 0.32 };

  return (
    <section className="rounded-2xl border border-orange-200 overflow-hidden bg-card" aria-label="Sequência" data-testid="card-sequencia" data-semana={completa ? "completa" : undefined}>
      <div className="h-11 px-4 flex items-center text-white gap-2" style={{ background: "linear-gradient(90deg,#fb923c,#f43f5e)" }}>
        <Flame className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="text-[13px] font-extrabold tracking-wide whitespace-nowrap tabular-nums">
          SEQUÊNCIA · <Rolo valor={dias} /> {dias === 1 ? "DIA" : "DIAS"}
        </span>
        <span className="ml-auto text-[12px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
          <Shield className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
          {protetores}
        </span>
      </div>

      <div className="seq-dias" role="list" aria-label="Semana">
        {semana.map((d, i) => <Dia key={d.dia} d={d} indice={i} agora={agora} />)}
      </div>

      {completa && (
        <div className="seq-semana-ok" data-testid="semana-completa">
          <Sparkles className="w-3.5 h-3.5" aria-hidden /> SEMANA COMPLETA{ganhouProtetor ? " · +1 PROTETOR" : ""} <Cubo className="w-[15px] h-[15px]" />
        </div>
      )}

      <div className="px-4 pt-2.5 pb-3 text-[12.5px] text-muted-foreground leading-relaxed">
        <div className="relative min-h-[20px]">
          <AnimatePresence mode="wait" initial={false}>
            {hojeFeito ? (
              <motion.p key="garantido" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={troca}>
                <span className="text-success font-semibold inline-flex items-center gap-1.5">
                  Hoje já tá garantido <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
                </span>
                {completa
                  ? ` — e a semana fechou inteira${ganhouProtetor ? ": um protetor a mais no bolso" : ""}.`
                  : ` — ${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}.`}
              </motion.p>
            ) : (
              <motion.p key="falta" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={troca}>
                {dias > 0 ? (
                  <>Hoje falta <b className="text-foreground">1 coisa</b> pra manter: </>
                ) : (
                  <>Anote <b className="text-foreground">1 coisa</b> hoje pra começar: </>
                )}
                <button
                  type="button"
                  onClick={() => onAcao(acao.rota)}
                  className="whitespace-nowrap rounded bg-yellow-100 text-yellow-900 font-semibold px-1.5 underline-offset-2 hover:underline"
                >
                  {acao.texto}
                </button>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {protegidoOntem && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px]">
            <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden /> Ontem ficou vazio — um protetor segurou sua sequência.
          </p>
        )}
        {!protegidoOntem && saldo === 0 && dias < 7 && (
          <p className="mt-1.5 text-[11.5px]">A cada 7 dias seguidos você ganha 1 protetor: ele segura sozinho um dia que ficar vazio.</p>
        )}
        {dias > 0 && !completa && <LembreteDaSequencia />}
      </div>
    </section>
  );
};
