import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { usePacote2027 } from "@/hooks/use-pacote-2027";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";
import {
  DICA_DO_MES, MESES_2027, SEMANAS_COFRINHO, TOTAL_COFRINHO, aberturaDoMes, alternarSemana, marcarTarefa, mesAberto, mesDaVez,
  metasPreenchidas, revisaoFeita, revisoesCompletas, tarefasDoMes, totalGuardado, valorDaSemana, type TarefaDaRevisao,
} from "@/lib/pacote-2027";
import { htmlDoPlanner2027, imprimirPlanner2027 } from "@/lib/pacote-2027-pdf";
import { Planejar2027 } from "./Planejar2027";

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/**
 * A ABA "📒 SEU 2027" de Desenvolvimento Pessoal (21/10, mockups e1–e3) — só existe pra conta com o pacote (a página
 * nem monta a aba sem a chave). Na 1ª abertura: a explicação curta (3 linhas + "Planejar meu 2027"), gravada na conta —
 * não volta ao reabrir. Depois: o Planejar (4 folhas), as 12 revisões (abrem no dia 1 de cada mês; cada tarefa abre a
 * tela certa), o cofrinho das 52 semanas e o Planner 2027 pra imprimir.
 */
export function Pacote2027() {
  const { pacote, plano, cofrinho, dicaVista, loaded, salvarProgresso, salvarCofrinho, salvarPlano, marcarDicaVista } = usePacote2027();
  const navigate = useNavigate();
  const [vista, setVista] = useState<"inicio" | "cofrinho" | number>("inicio");
  const [planejando, setPlanejando] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const contou = useRef(false);

  useEffect(() => {
    if (!pacote || contou.current) return;
    contou.current = true;
    trackEvent("plano2027_aba_view", { planejado: !!plano.salvoEm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacote]);

  if (!loaded || !pacote) return null;
  const hoje = new Date();

  if (planejando) {
    return (
      <Planejar2027 inicial={plano}
        onFechar={() => { trackEvent("plano2027_fechou", {}); setPlanejando(false); }}
        onSalvar={(p) => {
          const salvo = salvarPlano(p);
          trackEvent("plano2027_salvo", { metas: metasPreenchidas(salvo).length, datas: salvo.datas.length, hora: salvo.horaRevisao, gastar: salvo.gastarMes > 0, guardar: salvo.guardarMes > 0 });
          setPlanejando(false);
          toast.success("Seu 2027 tá salvo no seu CORE");
        }} />
    );
  }

  const abrirPlanejar = (via: string) => { if (!dicaVista) marcarDicaVista(); trackEvent("plano2027_aberto", { via }); setPlanejando(true); };
  const imprimir = async () => {
    const nativo = isNativeShell();
    trackEvent("plano2027_pdf", { nativo });
    const ok = await imprimirPlanner2027(htmlDoPlanner2027(plano, cofrinho), nativo);
    if (!ok) toast.error("Não deu pra abrir a impressão neste aparelho.");
  };
  const irPara = (t: TarefaDaRevisao, mes: number) => {
    trackEvent("plano2027_revisao_abrir", { mes, tarefa: t.id });
    if ("interno" in t.destino) setVista("cofrinho");
    else navigate(t.destino.rota);
  };

  /* ── a 1ª abertura: a explicação (tutorial curto), 1x na conta ── */
  if (!dicaVista && !plano.salvoEm) {
    return (
      <div className="space-y-4" data-testid="pacote-2027-boas-vindas">
        <div className="rounded-2xl border-2 border-accent/50 bg-accent/5 p-5">
          <p className="text-[10.5px] font-extrabold tracking-[.1em] text-accent">📒 SEU 2027 CHEGOU</p>
          <h2 className="text-[22px] leading-tight font-black tracking-tight mt-1.5">Seu ano inteiro, num lugar só</h2>
          <ol className="mt-3 space-y-2 text-[13px]">
            <li className="flex gap-2.5"><b className="w-6 h-6 rounded-full bg-foreground text-background grid place-items-center text-[11px] shrink-0">1</b><span><b>Planejar 2027</b>: 3 metas, dinheiro do mês e as datas. 5 minutos.</span></li>
            <li className="flex gap-2.5"><b className="w-6 h-6 rounded-full bg-foreground text-background grid place-items-center text-[11px] shrink-0">2</b><span><b>Revisão no dia 1</b> de cada mês, com o roteiro pronto.</span></li>
            <li className="flex gap-2.5"><b className="w-6 h-6 rounded-full bg-foreground text-background grid place-items-center text-[11px] shrink-0">3</b><span><b>Cofrinho das 52 semanas</b> e o <b>planner pra imprimir</b>.</span></li>
          </ol>
          <button type="button" onClick={() => abrirPlanejar("boas_vindas")} data-testid="pacote-2027-comecar"
            className="mt-4 w-full h-12 rounded-full bg-foreground text-background text-[14.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
            <span>Planejar meu 2027</span><ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { marcarDicaVista(); trackEvent("plano2027_depois", {}); }} data-testid="pacote-2027-depois"
            className="mt-1 w-full h-10 text-[13px] font-bold text-muted-foreground">Ver o pacote antes</button>
        </div>
      </div>
    );
  }

  /* ── uma revisão do mês ── */
  if (typeof vista === "number") {
    const mes = vista;
    const feitos = plano.revisoes[String(mes)] ?? {};
    const tarefas = tarefasDoMes(mes, plano, cofrinho);
    return (
      <div className="space-y-3" data-testid={`pacote-2027-revisao-${mes}`}>
        <button type="button" onClick={() => setVista("inicio")} className="text-[12px] font-bold text-muted-foreground inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /><span>Seu 2027</span></button>
        <div className="rounded-xl border-2 border-accent/60 bg-accent/5 p-4">
          <p className="text-[10.5px] font-extrabold tracking-[.08em] text-accent">REVISÃO DE {MESES_2027[mes - 1].toUpperCase()} · 5 MINUTOS</p>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-snug">{DICA_DO_MES[mes - 1]}</p>
        </div>
        <ul className="bg-card rounded-xl border border-border p-2 space-y-0.5">
          {tarefas.map((t, i) => {
            const feito = !!feitos[t.id];
            return (
              <li key={t.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2" data-testid={`pacote-2027-tarefa-${t.id}`}>
                <button type="button" aria-pressed={feito} aria-label={`${feito ? "Desmarcar" : "Marcar"} ${t.titulo}`}
                  onClick={() => {
                    salvarProgresso(marcarTarefa(plano, mes, t.id, !feito, localDayKey(new Date())));
                    if (!feito) trackEvent("plano2027_revisao_tarefa", { mes, tarefa: t.id });
                  }}
                  className={`grid place-items-center w-7 h-7 rounded-full border-2 text-[10.5px] font-bold shrink-0 ${feito ? "bg-emerald-500 border-emerald-500 text-white" : "border-border text-muted-foreground"}`}>
                  {feito ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </button>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] leading-tight ${feito ? "line-through text-muted-foreground" : "font-bold"}`}>{t.titulo}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.como}</span>
                  <button type="button" onClick={() => irPara(t, mes)} className="text-[11.5px] font-extrabold text-accent mt-1 inline-flex items-center gap-0.5">
                    <span>{t.destino.rotulo}</span><ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ── o cofrinho ── */
  if (vista === "cofrinho") {
    const total = totalGuardado(cofrinho);
    return (
      <div className="space-y-3" data-testid="pacote-2027-cofrinho">
        <button type="button" onClick={() => setVista("inicio")} className="text-[12px] font-bold text-muted-foreground inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /><span>Seu 2027</span></button>
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-bold mb-1.5">🐷 COFRINHO DAS 52 SEMANAS</h3>
          <div className="flex items-baseline gap-1.5"><strong className="text-[26px] font-black tracking-tight" data-testid="pacote-2027-cofrinho-total">{brl(total)}</strong><span className="text-[12px] text-muted-foreground">de {brl(TOTAL_COFRINHO)}</span></div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${(total / TOTAL_COFRINHO) * 100}%` }} /></div>
          <p className="text-[11px] text-muted-foreground mt-2">{cofrinho.invertido ? "Semana 1 = R$ 52, semana 52 = R$ 1." : "Semana 1 = R$ 1, semana 52 = R$ 52."} Toque quando guardar. A ordem é sua.</p>
          <div className="grid grid-cols-8 gap-1 mt-2.5">
            {Array.from({ length: SEMANAS_COFRINHO }, (_, i) => i + 1).map((s) => {
              const ok = cofrinho.marcadas.includes(s);
              return (
                <button key={s} type="button" aria-pressed={ok} aria-label={`Semana ${s}, R$ ${valorDaSemana(s, cofrinho.invertido)}`} data-testid={`pacote-2027-semana-${s}`}
                  onClick={() => { salvarCofrinho(alternarSemana(cofrinho, s)); trackEvent("plano2027_cofrinho", { semana: s, marcou: !ok }); }}
                  className={`aspect-square rounded-lg text-[10px] font-extrabold grid place-items-center ${ok ? "bg-accent text-white" : "bg-muted text-muted-foreground"}`}>
                  <span>{valorDaSemana(s, cofrinho.invertido)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-3">
            {[false, true].map((inv) => (
              <button key={String(inv)} type="button" aria-pressed={cofrinho.invertido === inv} onClick={() => salvarCofrinho({ ...cofrinho, invertido: inv })}
                className={`text-[12px] font-bold px-2.5 py-1.5 rounded-full border ${cofrinho.invertido === inv ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
                <span>{inv ? "Começar pelo R$ 52" : "R$ 1 → R$ 52"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── o início da aba ── */
  const completas = revisoesCompletas(plano);
  const daVez = mesDaVez(hoje);
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const visiveis = verTodos ? meses : meses.slice(Math.max(0, Math.min(daVez - 1, 6)), Math.max(0, Math.min(daVez - 1, 6)) + 6);
  const total = totalGuardado(cofrinho);
  return (
    <div className="space-y-3" data-testid="pacote-2027">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold">📒 SEU 2027</h3>
          <span className="text-[11px] font-semibold text-muted-foreground">{completas} de 12 revisões</span>
        </div>
        <div className="mt-2.5 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, (completas / 12) * 100)}%` }} /></div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => abrirPlanejar(plano.salvoEm ? "editar" : "aba")} data-testid="pacote-2027-planejar"
            className={`flex-1 h-10 rounded-lg text-[12px] font-bold inline-flex items-center justify-center gap-1 ${plano.salvoEm ? "border border-border bg-card" : "bg-foreground text-background"}`}>
            <span>{plano.salvoEm ? "✓ Planejado · editar" : "Planejar 2027 · 5 min"}</span>
          </button>
          <button type="button" onClick={() => void imprimir()} data-testid="pacote-2027-pdf"
            className={`flex-1 h-10 rounded-lg text-[12px] font-bold inline-flex items-center justify-center gap-1 ${plano.salvoEm ? "bg-foreground text-background" : "border border-border bg-card"}`}>
            <span>🖨️ Planner em PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4" data-testid="pacote-2027-revisoes">
        <h4 className="text-xs font-bold mb-2">🗓️ REVISÕES DO MÊS {plano.horaRevisao && <span className="text-muted-foreground font-semibold">· dia 1, às {plano.horaRevisao}</span>}</h4>
        <ul>
          {visiveis.map((m) => {
            const aberto = mesAberto(m, hoje);
            const feitas = revisaoFeita(plano, m);
            const completa = feitas >= 5;
            const daVezAgora = aberto && m === daVez;
            return (
              <li key={m}>
                <button type="button" disabled={!aberto} onClick={() => { trackEvent("plano2027_revisao_view", { mes: m }); setVista(m); }} data-testid={`pacote-2027-mes-${m}`}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-left ${aberto ? "" : "opacity-55"}`}>
                  <span className={`grid place-items-center w-7 h-7 rounded-full border-2 text-[10.5px] font-bold shrink-0 ${completa ? "bg-emerald-500 border-emerald-500 text-white" : daVezAgora || (!aberto && m === 1) ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                    {completa ? <Check className="w-3.5 h-3.5" /> : m}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-bold leading-tight">{MESES_2027[m - 1]}</span>
                    <span className="block text-[10.5px] text-muted-foreground mt-0.5">{aberto ? `${feitas} de 5 tarefas` : `abre ${ddmm(aberturaDoMes(m))}`}</span>
                  </span>
                  {aberto ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
        {!verTodos && <button type="button" onClick={() => setVerTodos(true)} className="w-full text-center text-[11.5px] font-semibold text-muted-foreground pt-1.5">Ver os 12 meses</button>}
      </div>

      <button type="button" onClick={() => setVista("cofrinho")} data-testid="pacote-2027-abrir-cofrinho" className="w-full text-left bg-card rounded-xl border border-border p-4">
        <span className="flex items-center justify-between"><span className="text-xs font-bold">🐷 COFRINHO DAS 52 SEMANAS</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></span>
        <span className="block text-[11.5px] text-muted-foreground mt-1">{brl(total)} de {brl(TOTAL_COFRINHO)} · {cofrinho.marcadas.length} de 52 semanas</span>
        <span className="block mt-2 h-2 rounded-full bg-muted overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(1, (total / TOTAL_COFRINHO) * 100)}%` }} /></span>
      </button>
    </div>
  );
}
