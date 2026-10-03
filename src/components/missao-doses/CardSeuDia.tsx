import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, Flame } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { useUserData } from "@/hooks/use-user-data";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { abrirAcaoRapida } from "@/components/home/QuickActions";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { useConquistas, type Sequencia } from "@/components/conquistas/use-conquistas";
import { proximosDoAlbum } from "@/components/conquistas/album-paginas";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { localDayKey } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_DIA_QA, EVENTO_MISSAO_DOSES, MODULOS, apagarMissao, diaDaMissao, diaDeQa, eventoDaMissao, forcaDaMissaoDoses, gravarMissao,
  guardarForcaDaUrl, lerMissao, missaoCumprida, missaoDosesLigada, passoPendente, rotuloDoPasso, type DiaDaMissao,
} from "@/lib/missao-doses";
import "./missao-doses.css";

/**
 * O CARD "SEU DIA" — fixo no topo da Home enquanto a missão em doses está
 * ligada (D5/D6): a missão (1/3 → 3/3) com o passo de hoje e o botão que leva
 * a ele, as pendências de hoje (a MESMA conta das "Pendências de hoje" lá
 * embaixo), o score do dia, a sequência e o adesivo mais perto. Com a chave
 * desligada, não existe (null) — a Home de hoje, byte a byte.
 */
export function CardSeuDia({ lifeData, sequencia }: { lifeData: LifeHubData; sequencia: Sequencia }) {
  guardarForcaDaUrl();
  const ligada = missaoDosesLigada();
  return ligada ? <CardSeuDiaLigado lifeData={lifeData} sequencia={sequencia} /> : null;
}

const useMissaoDoses = () => {
  const [missao, setMissao] = useState(() => lerMissao());
  useEffect(() => {
    const reler = () => setMissao(lerMissao());
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
  }, []);
  return missao;
};

function CardSeuDiaLigado({ lifeData, sequencia }: { lifeData: LifeHubData; sequencia: Sequencia }) {
  const navigate = useNavigate();
  const { get } = useUserData();
  const missao = useMissaoDoses();
  const conq = useConquistas();
  const hoje = localDayKey();
  const pend = useMemo(() => pendenciasDeHoje(lifeData, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date()), [lifeData, get]);
  const proximoAdesivo = useMemo(() => proximosDoAlbum(conq.adesivos, 1)[0] ?? null, [conq.adesivos]);
  const qa = forcaDaMissaoDoses() === "on";

  // o score do começo (pra "ontem 20 → hoje 45" no final): grava uma vez
  useEffect(() => {
    if (missao && missao.scoreNoInicio === undefined) gravarMissao({ ...missao, scoreNoInicio: lifeData.dayScore });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missao?.inicio]);

  const dia = missao ? diaDaMissao(missao, hoje) : 1;
  const pendente = missao ? passoPendente(missao) : null;
  const cumprida = !!missao && missaoCumprida(missao);
  const feitos = missao ? ([1, 2, 3] as DiaDaMissao[]).filter((n) => missao.feitos[n]).length : 0;
  useEffect(() => {
    if (!missao) return;
    trackEvent("seu_dia_view", eventoDaMissao({ dia, missao: `${feitos}/3`, pendencias: pend.pending.length, score: lifeData.dayScore }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missao?.inicio]);

  if (!missao) return null;

  const irParaOPasso = (via: "botao" | "linha") => {
    if (!pendente) return;
    trackEvent("seu_dia_click", eventoDaMissao({ alvo: "passo", via, dia, passo: pendente.n, modulo: pendente.modulo }));
    // o "Pular" de hoje não vale mais: ela pediu o passo
    if (missao.pulados?.[pendente.n] === hoje) {
      const pulados = { ...missao.pulados };
      delete pulados[pendente.n];
      gravarMissao({ ...missao, pulados });
    }
    navigate(MODULOS[pendente.modulo].rota);
  };
  const tocarPendencia = (i: number) => {
    const item = pend.pending[i];
    trackEvent("seu_dia_click", eventoDaMissao({ alvo: "pendencia", rotulo: item.label }));
    if (item.action) abrirAcaoRapida(item.action);
    else if (item.route) navigate(item.route);
  };
  const totalPend = pend.pending.length + pend.done.length;
  const proximoNome = pendente ? MODULOS[missao.modulos[Math.min(2, pendente.n)]].nome : null;

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm" aria-labelledby="seu-dia-titulo" data-testid="seu-dia" data-dia={dia} data-feitos={feitos}>
      <div className="md-secao" data-cor="grafite">
        <span id="seu-dia-titulo" className="inline-flex items-center gap-2"><Quadradinho marcado={feitos > 0} claro tam={14} /> Seu dia</span>
        <b data-testid="seu-dia-resumo">{cumprida ? "Missão cumprida · 3 de 3" : `Dia ${Math.min(dia, 3)} de 3 · missão ${feitos}/3`}</b>
      </div>

      {!cumprida && (
        <div className="divide-y divide-border" data-testid="seu-dia-missao">
          {([1, 2, 3] as DiaDaMissao[]).map((n) => {
            const cfg = MODULOS[missao.modulos[n - 1]];
            const feito = missao.feitos[n];
            const ehHoje = pendente?.n === n;
            const rot = rotuloDoPasso(n, missao, hoje);
            return (
              <button key={n} type="button" className="md-linha" data-hoje={ehHoje ? "" : undefined} data-testid={`seu-dia-linha-${n}`} onClick={() => (ehHoje ? irParaOPasso("linha") : feito ? navigate(cfg.rota) : undefined)}>
                <Quadradinho marcado={!!feito} tam={18} />
                <span className="min-w-0 flex-1">
                  <span className="md-linha-rotulo">{rot} · {cfg.emoji} {cfg.nome}</span>
                  <span className="md-linha-texto" data-feito={feito ? "" : undefined}>{feito ? feito.rotulo : cfg.pedido}</span>
                </span>
                {/* (03/10) o próximo pendente pode ser o de AMANHÃ (o de hoje já foi feito): aí a pílula diz "Amanhã", nunca "Hoje" */}
                <span className="md-pill" data-tom={feito ? "feito" : ehHoje && rot !== "AMANHÃ" ? "hoje" : "dia"}>{feito ? "Feito" : rot === "AMANHÃ" ? "Amanhã" : ehHoje ? "Hoje" : `Dia ${n}`}</span>
              </button>
            );
          })}
          {pendente && (
            <div className="p-3">
              {/* o passo pendente é de HOJE (ou atrasado) → botão cheio; é o de AMANHÃ (ela já fez o de hoje) → "fazer o de amanhã agora", discreto */}
              <button
                type="button"
                className="md-botao"
                style={pendente.n > dia ? { minHeight: 44, fontSize: 14, background: "transparent", color: "hsl(var(--foreground))", border: "1.5px dashed hsl(var(--border))" } : { minHeight: 48, fontSize: 15 }}
                data-testid="seu-dia-fazer"
                data-amanha={pendente.n > dia ? "" : undefined}
                onClick={() => irParaOPasso("botao")}
              >
                {pendente.n > dia ? "Quero fazer o toque de amanhã agora" : "Fazer o toque de hoje"} <ArrowRight className="w-4 h-4" />
              </button>
              {missao.pulados?.[pendente.n] === hoje && <p className="text-[11px] text-muted-foreground text-center mt-1.5">Hoje: ainda não. Sem pressa — o toque fica aqui.</p>}
              {pendente.n < 3 && pendente.n <= dia && proximoNome && <p className="text-[11px] text-muted-foreground text-center mt-1.5">amanhã: {proximoNome}</p>}
            </div>
          )}
        </div>
      )}

      <div className="md-secao" data-cor="magenta">
        <span>Pendências de hoje</span>
        <b data-testid="seu-dia-pendencias-resumo">{totalPend ? `${pend.done.length} de ${totalPend} feitas` : "nada por hoje"}</b>
      </div>
      <div className="divide-y divide-border" data-testid="seu-dia-pendencias">
        {pend.pending.slice(0, 4).map((item, i) => (
          <button key={`p-${i}`} type="button" className="md-linha" style={{ padding: "8px 14px" }} onClick={() => tocarPendencia(i)}>
            <Quadradinho marcado={false} tam={16} />
            <span className="min-w-0 flex-1 text-[13px] font-medium truncate">{item.emoji} {item.label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
        {pend.pending.length === 0 && pend.done.slice(0, 2).map((item, i) => (
          <div key={`d-${i}`} className="md-linha" style={{ padding: "8px 14px" }}>
            <Quadradinho marcado tam={16} />
            <span className="min-w-0 flex-1 text-[13px] font-medium line-through text-muted-foreground truncate">{item.emoji} {item.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
        <div className="py-2.5 px-1">
          <div className="text-[20px] font-black leading-none tabular-nums" data-testid="seu-dia-score">{lifeData.dayScore}</div>
          <div className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mt-1">score</div>
        </div>
        <button type="button" className="py-2.5 px-1" onClick={() => navigate("/conquistas", { state: { origem: "home" } })}>
          <div className="text-[20px] font-black leading-none tabular-nums inline-flex items-center gap-1" data-testid="seu-dia-sequencia"><Flame className="w-4 h-4" style={{ color: "hsl(var(--streak, var(--warning)))" }} /> {sequencia.dias}</div>
          <div className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mt-1">{sequencia.dias === 1 ? "dia seguido" : "dias seguidos"}</div>
        </button>
        <button type="button" className="py-2.5 px-2 min-w-0" onClick={() => navigate("/conquistas", { state: { origem: "home" } })} data-testid="seu-dia-adesivo">
          <div className="text-[12px] font-bold leading-tight truncate">{proximoAdesivo ? `${proximoAdesivo.icon} ${proximoAdesivo.name}` : `${conq.abertos} adesivos`}</div>
          <div className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mt-1 truncate">{proximoAdesivo ? `perto · ${rotuloProgresso(proximoAdesivo) ?? "quase"}` : "colados"}</div>
        </button>
      </div>

      {qa && (
        <div className="border-t border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="seu-dia-qa">
          <span className="font-bold">QA</span>
          <span>dia:</span>
          {([1, 2, 3] as const).map((d) => (
            <button key={d} type="button" className={`underline underline-offset-2 ${diaDeQa() === d ? "font-extrabold text-foreground" : ""}`} onClick={() => { try { localStorage.setItem(CHAVE_DIA_QA, String(d)); } catch { /* noop */ } window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); }}>{d}</button>
          ))}
          <button type="button" className={`underline underline-offset-2 ${diaDeQa() === null ? "font-extrabold text-foreground" : ""}`} onClick={() => { try { localStorage.removeItem(CHAVE_DIA_QA); } catch { /* noop */ } window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); }}>relógio</button>
          <button type="button" className="underline underline-offset-2 ml-auto" data-testid="seu-dia-recomecar" onClick={() => { apagarMissao(); navigate("/home"); }}>recomeçar missão</button>
        </div>
      )}
    </section>
  );
}
