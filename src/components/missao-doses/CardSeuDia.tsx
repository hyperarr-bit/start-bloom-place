import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { localDayKey } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_DIA_QA, EVENTO_MISSAO_DOSES, MODULOS, apagarMissao, diaDaMissao, diaDeQa, eventoDaMissao, forcaDaMissaoDoses, gravarMissao,
  guardarForcaDaUrl, lerMissao, missaoCumprida, missaoDosesLigada, passoPendente, type DiaDaMissao,
} from "@/lib/missao-doses";
import "./missao-doses.css";

/**
 * A FAIXA "SEU DIA" da missão em doses — UMA linha no topo da Home, só enquanto a missão anda.
 * (03/10, dono vendo o print: "quebra totalmente a UI, o score fica lá embaixo") — o card do protótipo trazia de novo as
 * pendências, o score, a sequência e o adesivo, que a Home já mostra logo abaixo, e ficava lá depois da missão. Agora:
 * os 3 quadradinhos + "Missão · dia N de 3" + o passo (hoje: botão "Fazer"; já feito hoje: "amanhã: Rotina · fazer
 * agora"). Missão cumprida: a faixa fica só até a pessoa ver "O que você construiu"; depois some. Com a chave
 * desligada, não existe (null) — a Home de hoje, byte a byte.
 */
export function CardSeuDia({ lifeData, sequencia }: { lifeData: LifeHubData; sequencia: Sequencia }) {
  guardarForcaDaUrl();
  // (03/10, dono: "nas turmas boas isso aparecia? melhor deixar só o app, encher de coisa desnecessária") — no APP a
  // Home fica como é: nenhum card. A missão anda pelo lembrete do dia (o toque abre o módulo) e pelo passo que aparece
  // ao entrar no módulo do dia. A faixa só vive no protótipo da web (desligado).
  if (isNativeShell()) return null;
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

function CardSeuDiaLigado({ lifeData }: { lifeData: LifeHubData; sequencia: Sequencia }) {
  const navigate = useNavigate();
  const missao = useMissaoDoses();
  const hoje = localDayKey();
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
    trackEvent("seu_dia_view", eventoDaMissao({ dia, missao: `${feitos}/3`, score: lifeData.dayScore }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missao?.inicio]);

  // cumprida e o "O que você construiu" já visto: a faixa sai da Home
  if (!missao || (cumprida && missao.fimVisto)) return null;

  const amanha = !!pendente && pendente.n > dia;
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
  const cfg = pendente ? MODULOS[pendente.modulo] : null;
  const pulouHoje = !!pendente && missao.pulados?.[pendente.n] === hoje;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="seu-dia-titulo" data-testid="seu-dia" data-dia={dia} data-feitos={feitos}>
      <div
        role={pendente ? "button" : undefined}
        tabIndex={pendente ? 0 : undefined}
        className="flex items-center gap-3 px-3.5 py-2.5 min-h-[56px]"
        data-testid={pendente ? `seu-dia-linha-${pendente.n}` : undefined}
        onClick={() => irParaOPasso("linha")}
        onKeyDown={(e) => { if (e.key === "Enter") irParaOPasso("linha"); }}
      >
        <span className="inline-flex gap-[3px] shrink-0" aria-hidden>
          {([1, 2, 3] as DiaDaMissao[]).map((n) => <Quadradinho key={n} marcado={!!missao.feitos[n]} tam={14} />)}
        </span>
        <span className="min-w-0 flex-1">
          <span id="seu-dia-titulo" className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground" data-testid="seu-dia-resumo">
            {cumprida ? "Missão cumprida · 3 de 3" : `Missão · dia ${Math.min(dia, 3)} de 3 · ${feitos}/3`}
          </span>
          <span className="block text-[13.5px] font-semibold leading-snug truncate">
            {cumprida
              ? "Os 3 toques feitos — o app inteiro é seu."
              : amanha
                ? <>Feito hoje ✓ · amanhã: {cfg!.emoji} {cfg!.nome}</>
                : pulouHoje
                  ? <>Hoje: ainda não. Sem pressa — {cfg!.emoji} {cfg!.nome} fica aqui.</>
                  : <>{cfg!.emoji} {cfg!.nome} · {cfg!.pedido}</>}
          </span>
        </span>
        {pendente && (
          <button
            type="button"
            className={amanha ? "shrink-0 text-[12px] font-bold underline underline-offset-2 text-muted-foreground px-1" : "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold text-white"}
            style={amanha ? undefined : { background: "hsl(var(--accent))" }}
            data-testid="seu-dia-fazer"
            data-amanha={amanha ? "" : undefined}
            aria-label={amanha ? "Quero fazer o toque de amanhã agora" : "Fazer o toque de hoje"}
            onClick={(e) => { e.stopPropagation(); irParaOPasso("botao"); }}
          >
            {amanha ? "fazer agora" : "Fazer"}
          </button>
        )}
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
