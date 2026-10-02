import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { protetorGanhoNaSemana, semanaCompleta, semanaDaSequencia, type DiaDaSemana } from "@/lib/sequencia-semana";
import { CHAVE_FOGO_VISTO, fraseDaProximaFaixa, lerFaixaVista, mudancaDeFaixa, type Faixa } from "@/lib/fogo-sequencia";
import { CHAVE_SEM_GASTO, diaSemGasto, marcarDiaSemGasto, type Chip } from "@/lib/acao-do-dia";
import type { Sequencia } from "./use-conquistas";
import { LembreteDaSequencia } from "./LembreteDaSequencia";
import { CHAMA, Fogo } from "./Fogo";
import "./conquistas.css";

/**
 * Card SEQUÊNCIA (26/09; a semana em 27/09; o FOGO POR FAIXAS e a AÇÃO DA
 * PESSOA em 02/10):
 *  - o fogo muda de cor com os dias seguidos (laranja 1–6 · vermelho 7–13 ·
 *    roxo 14–29 · azul 30–99 · dourado 100+): o cabeçalho, os discos da
 *    semana e a chama seguem a faixa; uma linha discreta diz quanto falta
 *    pra próxima cor; ao SUBIR de faixa o card comemora (o fogo cresce no
 *    meio do card, anel, "FOGO ROXO!") e manda `sequencia_faixa {faixa}`;
 *    perder a sequência volta pro laranja sem drama;
 *  - "Hoje falta 1 coisa pra manter:" agora é a ação DA PESSOA (módulos
 *    vivos, dia da semana, rodízio — lib/acao-do-dia.ts), com chips "ou …"
 *    de outros módulos dela e, pra quem usa Finanças, "não gastei nada hoje ✓"
 *    (grava um dia-sem-gasto de verdade, que conta pra sequência);
 *  - quando hoje fica garantido com o card na tela, o disco de hoje acende.
 * Semana inteira fechada = faixa dourada "SEMANA COMPLETA · +1 PROTETOR".
 */

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
// 10 faíscas da subida de faixa (saem do fogo grande)
const FAISCAS_SUBIDA = Array.from({ length: 10 }, (_, i) => {
  const ang = (i / 10) * Math.PI * 2;
  const dist = 54 + (i % 3) * 16;
  return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist };
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
            <svg className="seq-anel" viewBox="0 0 40 40" aria-hidden><circle cx="20" cy="20" r="17.5" fill="none" stroke="var(--fg-meio, #f97316)" strokeWidth="2.2" strokeDasharray="4.6 3.4" /></svg>
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

/** As variáveis de cor da faixa, pro CSS do card (claro e escuro). */
export const varsDaFaixa = (f: Faixa): CSSProperties => ({
  "--fg-a": f.cabecalho[0], "--fg-b": f.cabecalho[1], "--fg-texto": f.textoCabecalho,
  "--fg-claro": f.claro, "--fg-meio": f.meio, "--fg-escuro": f.escuro, "--fg-brilho": f.brilho,
  "--fg-borda": f.borda, "--fg-borda-escuro": f.bordaEscuro,
  "--fg-hoje": f.hojeFundo, "--fg-hoje-escuro": f.hojeFundoEscuro, "--fg-hoje-texto": f.hojeTexto, "--fg-hoje-texto-escuro": f.hojeTextoEscuro,
} as CSSProperties);

/** A SUBIDA DE FAIXA: o fogo novo cresce no meio do card, anel, faíscas e o rótulo — 1,6 s, por cima do card. */
const SubidaDeFaixa = ({ faixa }: { faixa: Faixa }) => (
  <div className="seq-sobe" data-testid="sequencia-subiu" aria-hidden>
    <span className="seq-sobe-anel" />
    <span className="seq-sobe-anel seq-sobe-anel-2" />
    {FAISCAS_SUBIDA.map((f, i) => <i key={i} className="seq-sobe-faisca" style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDelay: `${0.32 + (i % 4) * 0.04}s` } as CSSProperties} />)}
    <span className="seq-sobe-fogo"><Fogo faixa={faixa} tamanho={76} /></span>
    <span className="seq-sobe-rotulo">{faixa.rotulo}!</span>
  </div>
);

interface Props {
  seq: Sequencia;
  onAcao: (rota: string) => void;
}

export const CardSequencia = ({ seq, onAcao }: Props) => {
  const { dias, saldo, hojeFeito, acao, faixa, protegidoOntem, lista, usados, hoje } = seq;
  const { get, set, loaded } = useUserData();
  const reduzir = useReducedMotion();
  const semana = useMemo(() => semanaDaSequencia(lista, usados, hoje), [lista, usados, hoje]);
  const completa = semanaCompleta(semana);
  const ganhouProtetor = useMemo(() => completa && protetorGanhoNaSemana(lista, hoje), [completa, lista, hoje]);
  const proximaFaixa = fraseDaProximaFaixa(dias);

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

  /*
   * A FAIXA DO FOGO × a última vista: subiu → comemora + `sequencia_faixa`;
   * desceu (perdeu a sequência) → só grava, quieto; 1ª vez → só grava.
   */
  const vistaCru = get<unknown>(CHAVE_FOGO_VISTO, undefined);
  const [subindo, setSubindo] = useState<Faixa | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const vista = lerFaixaVista(vistaCru);
    if (vista === faixa.indice) return;
    const mudanca = mudancaDeFaixa(faixa.indice, vista);
    set(CHAVE_FOGO_VISTO, faixa.indice, { system: true });
    if (mudanca !== "subiu") return;
    trackEvent("sequencia_faixa", { faixa: faixa.id, dias });
    if (reduzir) return;
    setSubindo(faixa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, faixa.indice, vistaCru]);
  useEffect(() => {
    if (!subindo) return;
    const t = setTimeout(() => setSubindo(null), 1700);
    return () => clearTimeout(t);
  }, [subindo]);

  // a ação do dia vista (uma vez por montagem, só quando ainda falta)
  const vistaRegistrada = useRef(false);
  useEffect(() => {
    if (!loaded || hojeFeito || vistaRegistrada.current) return;
    vistaRegistrada.current = true;
    trackEvent("acao_do_dia_vista", { acao: acao.id, chips: acao.chips.map((c) => c.id).join(",") });
  }, [loaded, hojeFeito, acao]);

  const semGastoHoje = diaSemGasto(get<unknown>(CHAVE_SEM_GASTO, {}), hoje);
  const tocarPrincipal = () => {
    trackEvent("acao_do_dia_toque", { acao: acao.id, via: "principal" });
    onAcao(acao.rota);
  };
  const tocarChip = (chip: Chip) => {
    trackEvent("acao_do_dia_toque", { acao: chip.id, via: "chip" });
    if (chip.tipo === "sem-gasto") {
      const novo = marcarDiaSemGasto(get<unknown>(CHAVE_SEM_GASTO, {}), hoje);
      if (novo) set(CHAVE_SEM_GASTO, novo);
      try { toast.success("Dia sem gasto anotado — conta pra sequência 🙌", { id: "sem-gasto" }); } catch { /* sem toaster */ }
      return;
    }
    onAcao(chip.rota);
  };

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
    <section
      className="seq-card rounded-2xl overflow-hidden bg-card relative"
      aria-label="Sequência"
      data-testid="card-sequencia"
      data-faixa={dias > 0 ? faixa.id : "apagado"}
      data-semana={completa ? "completa" : undefined}
      style={varsDaFaixa(faixa)}
    >
      <div className="seq-cabecalho h-11 px-4 flex items-center gap-2" data-testid="sequencia-cabecalho">
        <Fogo dias={dias} faixa={dias > 0 ? faixa : undefined} tamanho={20} viva={!reduzir && dias > 0} semBrilho />
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

      {/* a faixa do fogo e quanto falta pra próxima cor (uma linha, discreta) */}
      {dias > 0 && (
        <div className="seq-faixa-linha" data-testid="sequencia-faixa">
          <span className="seq-faixa-selo">{faixa.rotulo}</span>
          {proximaFaixa && <span className="seq-faixa-prox">{proximaFaixa}</span>}
        </div>
      )}

      <div className="px-4 pt-2 pb-3 text-[12.5px] text-muted-foreground leading-relaxed">
        <div className="relative min-h-[20px]">
          <AnimatePresence mode="wait" initial={false}>
            {hojeFeito ? (
              <motion.p key="garantido" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={troca}>
                <span className="font-semibold inline-flex items-center gap-1.5" style={{ color: "hsl(var(--garantido, var(--success)))" }}>
                  Hoje já tá garantido <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
                </span>
                {completa
                  ? ` — e a semana fechou inteira${ganhouProtetor ? ": um protetor a mais no bolso" : ""}.`
                  : semGastoHoje && acao.modulo === "financas"
                    ? " — dia sem gasto anotado."
                    : ` — ${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}.`}
              </motion.p>
            ) : (
              <motion.div key="falta" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={troca} data-testid="acao-do-dia" data-acao={acao.id}>
                <p>
                  {dias > 0 ? (
                    <>Hoje falta <b className="text-foreground">1 coisa</b> pra manter: </>
                  ) : (
                    <>Anote <b className="text-foreground">1 coisa</b> hoje pra começar: </>
                  )}
                  <button type="button" onClick={tocarPrincipal} className="seq-acao" data-testid="acao-principal">
                    {acao.texto}
                  </button>
                </p>
                {acao.chips.length > 0 && (
                  <p className="seq-chips" data-testid="acao-chips">
                    <span className="seq-ou">ou</span>
                    {acao.chips.map((c) => (
                      <button key={c.id} type="button" onClick={() => tocarChip(c)} className="seq-chip" data-chip={c.id} data-tipo={c.tipo}>
                        {c.texto}{c.tipo === "sem-gasto" && <Check className="w-3 h-3 ml-0.5" strokeWidth={3} aria-hidden />}
                      </button>
                    ))}
                  </p>
                )}
                {acao.motivo && <p className="seq-motivo" data-testid="acao-motivo">{acao.motivo}</p>}
              </motion.div>
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

      {subindo && <SubidaDeFaixa faixa={subindo} />}
    </section>
  );
};
