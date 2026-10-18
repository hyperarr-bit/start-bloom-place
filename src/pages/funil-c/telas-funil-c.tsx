import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { EMAIL_OK } from "@/pages/venda/conta";
import type { ResultadoDados } from "@/pages/venda/telas-venda";
import { LOGO_PORTA } from "@/pages/porta/telas";
import {
  FAIXAS_RENDA,
  MODOS_PLANO,
  OPCOES_COMPROMETIDO,
  OPCOES_ESCAPE,
  PRECO_POR_DIA_CENTAVOS,
  formatarMoeda,
  type EscapeDinheiro,
  type ModoPlano,
  type NivelComprometido,
  type ResultadoMapaMes,
} from "./calculo";

export const COR_FUNDO = "#F7F5F3";
export const COR_TEXTO = "#262626";
export const COR_ACENTO = "#D22D80";

const SERIF = "font-['Instrument_Serif',Georgia,serif] italic font-normal";

export function TopoFunilC({
  passo,
  progresso,
  onVoltar,
}: {
  passo: string;
  progresso: number | null;
  onVoltar?: () => void;
}) {
  return (
    <header className="pt-1 pb-3" data-testid="funil-c-topo">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onVoltar ? (
            <button
              type="button"
              onClick={onVoltar}
              aria-label="Voltar"
              data-testid="funil-c-voltar"
              className="grid place-items-center w-8 h-8 rounded-[9px] border border-[#E2DDD7] bg-white text-[#262626] active:bg-[#EFECE8]"
            >
              <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
          ) : (
            <img
              src={LOGO_PORTA}
              alt=""
              width={28}
              height={28}
              decoding="async"
              className="w-[28px] h-[28px] rounded-[7px] border border-[#E2DDD7] bg-white"
            />
          )}
          <span className="text-[19px] font-black tracking-[-0.03em] leading-none text-[#262626]">
            CORE
          </span>
        </div>

        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.11em]"
          style={{ background: "#FCE8F3", color: COR_ACENTO }}
          data-testid="funil-c-selo"
        >
          {passo === "calculadora"
            ? "Cálculo em 10s · Sem extrato"
            : passo === "mapa"
              ? "Diagnóstico do seu mês"
              : passo === "oferta"
                ? "Plano Anual · Pix"
                : "Ativação imediata"}
        </span>
      </div>

      {progresso != null && (
        <div
          className="mt-3 h-[4px] w-full rounded-full bg-[#E6E1DB] overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso * 100)}
          data-testid="funil-c-progresso"
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progresso * 100)}%`, background: COR_ACENTO }}
          />
        </div>
      )}
    </header>
  );
}

/* ============================================================================
 * TELA 1 — CALCULADORA INSTANTÂNEA (2 TOQUES, SEM EXTRATO BANCÁRIO)
 * ========================================================================== */
export function TelaCalculadora({
  renda,
  comprometidoPct,
  escape,
  mapaPreview,
  onChangeRenda,
  onChangeComprometido,
  onChangeEscape,
  onCalcular,
}: {
  renda: number;
  comprometidoPct: NivelComprometido;
  escape: EscapeDinheiro;
  mapaPreview: ResultadoMapaMes;
  onChangeRenda: (v: number) => void;
  onChangeComprometido: (v: NivelComprometido) => void;
  onChangeEscape: (v: EscapeDinheiro) => void;
  onCalcular: () => void;
}) {
  return (
    <section className="space-y-4" data-testid="funil-c-tela-calculadora">
      <div>
        <h1
          className="text-[27px] font-extrabold tracking-[-0.03em] leading-[1.12] text-[#262626]"
          data-testid="funil-c-titulo-calc"
        >
          Quanto você pode gastar{" "}
          <span className={`${SERIF} text-[31px]`} style={{ color: COR_ACENTO }}>
            hoje
          </span>{" "}
          sem faltar dinheiro antes do dia 30?
        </h1>
        <p className="mt-1.5 text-[14px] leading-[1.45] text-[#5C5852]">
          Toque na sua faixa de renda e no peso das suas contas. Sem abrir extrato nem fazer conta: veja na hora seu{" "}
          <b className="text-[#262626]">Teto Diário real para os {mapaPreview.diasParaCalculo} dias de {mapaPreview.nomeMes}</b>.
        </p>
      </div>

      {/* PASSO 1: RENDA MENSAL */}
      <div className="rounded-[18px] border border-[#E5E0D8] bg-white p-4 shadow-[0_2px_10px_rgba(38,38,38,0.04)]">
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor="funil-c-slider-renda"
            className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7A746C]"
          >
            1. Sua renda líquida no mês
          </label>
          <span
            className="text-[22px] font-extrabold tracking-[-0.03em] text-[#262626] tabular-nums"
            data-testid="funil-c-renda-valor"
          >
            R$ {formatarMoeda(renda)}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-1.5" role="group" aria-label="Faixas de renda mensal">
          {FAIXAS_RENDA.map((valor) => {
            const ativo = renda === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => onChangeRenda(valor)}
                data-testid={`funil-c-renda-${valor}`}
                data-ativo={ativo ? "" : undefined}
                className={`h-[38px] rounded-[10px] border text-[13.5px] font-bold tabular-nums transition-colors ${
                  ativo
                    ? "border-[#262626] bg-[#262626] text-white"
                    : "border-[#E5E0D8] bg-[#FAF8F6] text-[#262626] active:bg-[#EFECE8]"
                }`}
              >
                R$ {formatarMoeda(valor)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <input
            id="funil-c-slider-renda"
            type="range"
            min={1500}
            max={20000}
            step={250}
            value={renda}
            onChange={(e) => onChangeRenda(Number(e.target.value))}
            data-testid="funil-c-renda-slider"
            className="w-full accent-[#D22D80] cursor-pointer"
          />
        </div>
      </div>

      {/* PASSO 2: COMPROMETIMENTO COM CONTAS FIXAS E CARTÃO */}
      <div className="rounded-[18px] border border-[#E5E0D8] bg-white p-4 shadow-[0_2px_10px_rgba(38,38,38,0.04)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7A746C]">
          2. Quanto já vai pra contas fixas + parcelas do cartão?
        </p>

        <div className="mt-2.5 grid grid-cols-2 gap-2" role="group" aria-label="Nível de comprometimento">
          {OPCOES_COMPROMETIDO.map((op) => {
            const ativo = comprometidoPct === op.pct;
            const emReais = Math.round((renda * op.pct) / 100);
            return (
              <button
                key={op.pct}
                type="button"
                onClick={() => onChangeComprometido(op.pct)}
                data-testid={`funil-c-comp-${op.pct}`}
                data-ativo={ativo ? "" : undefined}
                className={`rounded-[12px] border p-3 text-left transition-all ${
                  ativo
                    ? "border-[#D22D80] bg-[#FDF2F8] shadow-[0_0_0_1px_#D22D80]"
                    : "border-[#E5E0D8] bg-[#FAF8F6] active:bg-[#EFECE8]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11px] font-extrabold"
                    style={{
                      background: ativo ? COR_ACENTO : "#EAE5DF",
                      color: ativo ? "#FFFFFF" : COR_TEXTO,
                    }}
                  >
                    ~{op.tag}
                  </span>
                  <span className="text-[13px] font-extrabold text-[#262626] tabular-nums">
                    R$ {formatarMoeda(emReais)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] font-bold leading-tight text-[#262626]">
                  {op.titulo.replace(/\s*\(~.*\)/, "")}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#6E6961]">{op.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* PASSO 3: ONDE O DINHEIRO MAIS ESCAPA (1 TOQUE RÁPIDO) */}
      <div className="rounded-[18px] border border-[#E5E0D8] bg-white p-4 shadow-[0_2px_10px_rgba(38,38,38,0.04)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7A746C]">
          3. Onde seu dinheiro livre mais escapa?
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {OPCOES_ESCAPE.map((op) => {
            const ativo = escape === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onChangeEscape(op.id)}
                data-testid={`funil-c-escape-${op.id}`}
                data-ativo={ativo ? "" : undefined}
                className={`flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5 text-left text-[13px] font-medium leading-snug transition-colors ${
                  ativo
                    ? "border-[#262626] bg-[#F5F2EE] text-[#262626] font-semibold"
                    : "border-[#E5E0D8] bg-white text-[#4A4640]"
                }`}
              >
                <span
                  className="grid place-items-center w-4 h-4 shrink-0 rounded-full border"
                  style={
                    ativo
                      ? { background: COR_ACENTO, borderColor: COR_ACENTO, color: "#fff" }
                      : { borderColor: "#C8C2B8" }
                  }
                >
                  {ativo && <Check className="w-2.5 h-2.5" strokeWidth={3.2} />}
                </span>
                <span className="flex-1">{op.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTÃO DE AÇÃO IMEDIATA */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onCalcular}
          data-testid="funil-c-calcular-cta"
          className="w-full h-[54px] rounded-[14px] flex items-center justify-center gap-2 text-[16px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(38,38,38,0.35)] active:scale-[0.985] transition-transform"
          style={{ background: COR_TEXTO }}
        >
          <span>Ver meu Teto Diário de hoje</span>
          <ArrowRight className="w-[18px] h-[18px]" style={{ color: COR_ACENTO }} strokeWidth={2.6} />
        </button>
        <p className="mt-2 text-center text-[12px] text-[#7A746C]">
          Resultado imediato na tela · Baseado no motor real do app CORE
        </p>
      </div>
    </section>
  );
}

/* ============================================================================
 * TELA 2 — RESULTADO IMEDIATO ("SEU MAPA DO MÊS" + SIMULADOR AO VIVO)
 * ========================================================================== */
export function TelaMapaDoMes({
  mapa,
  modo,
  escape,
  onChangeModo,
  onAvancarOferta,
}: {
  mapa: ResultadoMapaMes;
  modo: ModoPlano;
  escape: EscapeDinheiro;
  onChangeModo: (m: ModoPlano) => void;
  onAvancarOferta: () => void;
}) {
  const escapeItem = OPCOES_ESCAPE.find((e) => e.id === escape) ?? OPCOES_ESCAPE[0];
  const pctBarraApagao = Math.min(92, Math.max(25, Math.round((mapa.diaApagao / 30) * 100)));

  return (
    <section className="space-y-4" data-testid="funil-c-tela-mapa">
      {/* BLOCO 1: REVELAÇÃO DO TETO DIÁRIO REAL */}
      <div
        className="rounded-[20px] border-2 bg-white p-4 shadow-[0_10px_28px_-14px_rgba(38,38,38,0.16)]"
        style={{ borderColor: COR_ACENTO }}
        data-testid="funil-c-card-teto"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.09em]"
            style={{ background: "#FCE8F3", color: COR_ACENTO }}
          >
            Seu número de hoje · {mapa.nomeMes}
          </span>
          <span className="text-[12px] font-semibold text-[#6E6961]">
            Ciclo de {mapa.diasParaCalculo} dias
          </span>
        </div>

        <p className="mt-2.5 text-[14px] font-medium text-[#5C5852]">
          Para fechar o mês no azul e proteger sua sobra, seu limite livre hoje é:
        </p>

        <div className="mt-1 flex items-baseline gap-2">
          <span
            className="text-[40px] font-black tracking-[-0.04em] leading-none text-[#262626] tabular-nums"
            data-testid="funil-c-teto-diario"
          >
            R$ {formatarMoeda(mapa.tetoDiario)}
          </span>
          <span className={`${SERIF} text-[24px] text-[#5C5852]`}>por dia</span>
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-[12px] bg-[#F7F5F3] p-2.5 text-left">
          <div>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#7A746C]">
              Sua Renda
            </span>
            <span className="text-[13.5px] font-extrabold text-[#262626] tabular-nums">
              R$ {formatarMoeda(mapa.renda)}
            </span>
          </div>
          <div>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#7A746C]">
              Contas/Cartão
            </span>
            <span className="text-[13.5px] font-extrabold text-[#B42318] tabular-nums">
              -R$ {formatarMoeda(mapa.comprometidoReais)}
            </span>
          </div>
          <div>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#1F6B3A]">
              Sobra Blindada
            </span>
            <span
              className="text-[13.5px] font-extrabold text-[#1F6B3A] tabular-nums"
              data-testid="funil-c-sobra-mensal"
            >
              +R$ {formatarMoeda(mapa.sobraMensal)}
            </span>
          </div>
        </div>
      </div>

      {/* BLOCO 2: O "DIA DO APAGÃO" DO SALÁRIO VS. MÊS NO AZUL */}
      <div
        className="rounded-[18px] border border-[#E5E0D8] bg-white p-4"
        data-testid="funil-c-card-apagao"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706]" strokeWidth={2.4} />
          <h2 className="text-[15.5px] font-extrabold tracking-[-0.02em] text-[#262626]">
            Por que o dinheiro some antes do dia 30?
          </h2>
        </div>

        <p className="mt-1.5 text-[13px] leading-snug text-[#5C5852]">
          Sem ver o teto diário na tela do celular, a média nos primeiros 15 dias é gastar{" "}
          <b className="text-[#262626]">R$ {formatarMoeda(mapa.gastoDiarioSemControle)}/dia</b>. Olha o que acontece com o seu mês:
        </p>

        {/* Linha 1: Sem CORE */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-bold text-[#B42318]">
              Sem Teto Diário: acaba no dia {mapa.diaApagao}
            </span>
            <span className="font-semibold text-[#B42318]" data-testid="funil-c-dias-descobertos">
              {mapa.diasDescobertos} dias no aperto
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-[#FEE4E2] overflow-hidden flex">
            <div
              className="h-full bg-[#D92D20] rounded-l-full"
              style={{ width: `${pctBarraApagao}%` }}
            />
          </div>
        </div>

        {/* Linha 2: Com CORE */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-bold text-[#1F6B3A]">
              Com Teto do CORE: chega ao dia 30 no azul
            </span>
            <span className="font-extrabold text-[#1F6B3A]">
              +R$ {formatarMoeda(mapa.sobraMensal)} no bolso
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-[#D1FADF] overflow-hidden">
            <div className="h-full w-full bg-[#12B76A] rounded-full" />
          </div>
        </div>
      </div>

      {/* BLOCO 3: SIMULADOR INTERATIVO AO VIVO (3 MODOS DO CORE) */}
      <div
        className="rounded-[18px] border border-[#E5E0D8] bg-white p-4"
        data-testid="funil-c-simulador"
      >
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7A746C]">
            Simule sua meta no CORE (toque para ajustar)
          </p>
          <Sparkles className="w-4 h-4" style={{ color: COR_ACENTO }} />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Modo de economia">
          {MODOS_PLANO.map((m) => {
            const ativo = modo === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeModo(m.id)}
                data-testid={`funil-c-modo-${m.id}`}
                data-ativo={ativo ? "" : undefined}
                className={`rounded-[10px] border px-2 py-2 text-center transition-colors ${
                  ativo
                    ? "border-[#262626] bg-[#262626] text-white"
                    : "border-[#E5E0D8] bg-[#FAF8F6] text-[#262626]"
                }`}
              >
                <span className="block text-[12px] font-bold leading-tight">{m.nome}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-[12px] border border-[#F2D0E2] bg-[#FDF2F8] px-3.5 py-2.5">
          <div>
            <span className="block text-[11.5px] font-bold uppercase tracking-[0.06em]" style={{ color: COR_ACENTO }}>
              Sobra acumulada em 12 meses
            </span>
            <span className="text-[12.5px] text-[#5C5852]">
              Mantendo seu teto de R$ {formatarMoeda(mapa.tetoDiario)}/dia
            </span>
          </div>
          <span
            className="text-[22px] font-black tracking-[-0.03em] text-[#262626] tabular-nums"
            data-testid="funil-c-sobra-anual"
          >
            +R$ {formatarMoeda(mapa.sobraAnual)}
          </span>
        </div>
      </div>

      {/* BLOCO 4: COMO O CORE FAZ ISSO NO SEU CELULAR (RECURSOS REAIS VERIFICADOS NO CÓDIGO) */}
      <div className="rounded-[18px] border border-[#E5E0D8] bg-white p-4 space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7A746C]">
          Como o CORE guarda esse número por você todo dia
        </p>

        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 grid place-items-center w-6 h-6 shrink-0 rounded-[7px] text-white"
              style={{ background: COR_ACENTO }}
            >
              <Wallet className="w-3.5 h-3.5" />
            </span>
            <div>
              <p className="font-bold text-[#262626]">
                Card “Quanto posso gastar hoje” + Previsão Fim do Mês
              </p>
              <p className="text-[#5C5852] leading-snug">
                Passou um Pix ou café hoje? O CORE recalcula seu teto de amanhã na hora para sua sobra de{" "}
                <b className="text-[#262626]">R$ {formatarMoeda(mapa.sobraMensal)}/mês</b> nunca sumir.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid place-items-center w-6 h-6 shrink-0 rounded-[7px] bg-[#262626] text-white">
              <Calendar className="w-3.5 h-3.5" />
            </span>
            <div>
              <p className="font-bold text-[#262626]">
                {escapeItem.ferramentaCore}
              </p>
              <p className="text-[#5C5852] leading-snug">
                Calendário visual com alertas de vencimento, divisão de contas da casa e rastreador de parcelas (ex.: 3 de 10) por cartão.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid place-items-center w-6 h-6 shrink-0 rounded-[7px] bg-[#1F6B3A] text-white">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <div>
              <p className="font-bold text-[#262626]">
                Score Financeiro ({mapa.scoreAtual} → {mapa.scoreComCore}/100) + 16 Módulos da Vida
              </p>
              <p className="text-[#5C5852] leading-snug">
                Inclui simulador <i>“Cabe no bolso?”</i> e os 16 módulos completos (Finanças, Rotina, Treino, Dieta, Saúde, Estudos, Casa e mais).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA PARA A OFERTA */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onAvancarOferta}
          data-testid="funil-c-mapa-cta"
          className="w-full h-[54px] rounded-[14px] flex items-center justify-center gap-2 text-[16px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(38,38,38,0.35)] active:scale-[0.985] transition-transform"
          style={{ background: COR_TEXTO }}
        >
          <span>Ativar meu Teto Diário no CORE</span>
          <ArrowRight className="w-[18px] h-[18px]" style={{ color: COR_ACENTO }} strokeWidth={2.6} />
        </button>
        <p className="mt-2 text-center text-[12px] text-[#7A746C]">
          Apenas <b className="text-[#262626]">R$ {PRECO_POR_DIA_CENTAVOS}/dia</b> · Paga-se em{" "}
          <b className="text-[#262626]">{mapa.diasParaPagarCore} dias</b> da sua sobra protegida
        </p>
      </div>
    </section>
  );
}

/* ============================================================================
 * TELA 3 — OFERTA DE ROI ÓBVIO (R$ 97,90 ANUAL SÓ PIX) + NOME & E-MAIL
 * ========================================================================== */
const CAMPO_INPUT =
  "w-full h-[50px] rounded-[12px] border bg-white px-3.5 text-[15.5px] text-[#262626] outline-none focus:border-[#262626] placeholder:text-[#9E9890]";

export function TelaOfertaPix({
  mapa,
  nomeInicial,
  emailInicial,
  emailLogado,
  onEnviar,
  onEntrarSenha,
  onEntrouCodigo,
  onErroCampo,
}: {
  mapa: ResultadoMapaMes;
  nomeInicial: string;
  emailInicial: string;
  emailLogado: string | null;
  onEnviar: (nome: string, email: string) => Promise<ResultadoDados>;
  onEntrarSenha: (email: string, senha: string, nome: string) => Promise<boolean>;
  onEntrouCodigo: (nome: string, email: string) => Promise<void>;
  onErroCampo: (campo: "nome" | "email", motivo: string) => void;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [email, setEmail] = useState(emailInicial || emailLogado || "");
  const [erros, setErros] = useState<{ nome?: string; email?: string }>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [existe, setExiste] = useState(false);
  const [senha, setSenha] = useState("");
  const refNome = useRef<HTMLInputElement>(null);
  const refEmail = useRef<HTMLInputElement>(null);

  const enviar = async () => {
    if (ocupado) return;
    const e: { nome?: string; email?: string } = {};
    if (!nome.trim()) e.nome = "Digite seu nome";
    const em = email.trim();
    if (!em) e.email = "Digite seu e-mail";
    else if (!EMAIL_OK.test(em)) e.email = "E-mail inválido";
    setErros(e);
    if (e.nome || e.email) {
      if (e.nome) onErroCampo("nome", "vazio");
      if (e.email) onErroCampo("email", em ? "invalido" : "vazio");
      (e.nome ? refNome : refEmail).current?.focus();
      return;
    }
    setErro(null);
    setOcupado(true);
    try {
      const r = await onEnviar(nome.trim(), em);
      if (r.ok === false) {
        if (r.existe) {
          setExiste(true);
          return;
        }
        setErro(r.erro ?? "Não consegui seguir agora. Tenta de novo.");
      }
    } finally {
      setOcupado(false);
    }
  };

  const entrar = async () => {
    if (ocupado || senha.length < 1) return;
    setErro(null);
    setOcupado(true);
    try {
      const ok = await onEntrarSenha(email.trim(), senha, nome.trim());
      if (!ok) setErro("Senha não bateu. Confere ou receba um código no e-mail.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="funil-c-tela-oferta">
      <div>
        <h1
          className="text-[26px] font-extrabold tracking-[-0.03em] leading-[1.12] text-[#262626]"
          data-testid="funil-c-oferta-titulo"
        >
          Proteja{" "}
          <span className={`${SERIF} text-[30px]`} style={{ color: COR_ACENTO }}>
            R$ {formatarMoeda(mapa.sobraAnual)}/ano
          </span>{" "}
          do seu salário por R$ {PRECO_POR_DIA_CENTAVOS} ao dia.
        </h1>
        <p className="mt-1.5 text-[14px] leading-snug text-[#5C5852]">
          Em apenas <b className="text-[#262626]">{mapa.diasParaPagarCore} dias</b> seguindo o seu teto de{" "}
          <b className="text-[#262626]">R$ {formatarMoeda(mapa.tetoDiario)}/dia</b>, o CORE já se paga pelo ano inteiro.
        </p>
      </div>

      {/* CARD DE OFERTA ANUAL PIX */}
      <div
        className="relative rounded-[18px] border-2 bg-white p-4 shadow-[0_8px_24px_-12px_rgba(38,38,38,0.14)]"
        style={{ borderColor: COR_ACENTO }}
        data-testid="funil-c-card-plano"
      >
        <span
          className="absolute -top-[11px] right-4 rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.08em] text-white"
          style={{ background: COR_ACENTO }}
        >
          Acesso de 1 ano · Pagamento único
        </span>

        <div className="flex items-baseline justify-between gap-2">
          <div>
            <p className="text-[14px] font-bold text-[#262626]">Plano Anual CORE Completo</p>
            <p className="text-[12.5px] text-[#6E6961]">
              Equivale a <b className="text-[#262626]">R$ 8,16/mês</b> · Sem renovação automática
            </p>
          </div>
          <div className="text-right">
            <span
              className="text-[28px] font-black tracking-[-0.03em] leading-none text-[#262626] tabular-nums"
              data-testid="funil-c-preco-anual"
            >
              R$ 97,90
            </span>
            <span className="block text-[11.5px] font-semibold text-[#1F6B3A]">à vista no Pix</span>
          </div>
        </div>

        <ul className="mt-3.5 space-y-2 border-t border-[#EFECE8] pt-3 text-[13px] text-[#3D3A35]">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: COR_ACENTO }} strokeWidth={3} />
            <span>
              <b>Teto Diário (R$ {formatarMoeda(mapa.tetoDiario)}/dia)</b> + Previsão de Fim de Mês automática
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: COR_ACENTO }} strokeWidth={3} />
            <span>
              <b>Calendário Meu Mês</b> com lembretes de contas, rateio e controle de parcelas por cartão
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: COR_ACENTO }} strokeWidth={3} />
            <span>
              <b>Todos os 16 módulos liberados</b> (Finanças, Rotina, Treino, Dieta, Saúde, Estudos e mais) no iPhone, Android e Web
            </span>
          </li>
        </ul>
      </div>

      {/* FORMULÁRIO DE ATIVAÇÃO (NOME + E-MAIL -> PREPARAR CONTA -> ASAAS PIX) */}
      <div
        className="rounded-[18px] border border-[#E5E0D8] bg-white p-4 shadow-[0_2px_10px_rgba(38,38,38,0.04)]"
        data-testid="funil-c-form-card"
        data-fase={existe ? "existe" : "form"}
      >
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#262626]">
          {existe ? "Esse e-mail já tem conta no CORE" : "Onde ativamos seu acesso de 1 ano?"}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-[#5C5852]">
          {existe ? (
            <>
              Entre na conta de <b className="text-[#262626] break-all">{email.trim().toLowerCase()}</b> para liberar seu plano nela.
            </>
          ) : (
            "Você usa este mesmo e-mail para entrar no aplicativo assim que o Pix confirmar."
          )}
        </p>

        {!existe ? (
          <>
            <div className="mt-3 space-y-2.5">
              <div>
                <input
                  ref={refNome}
                  type="text"
                  autoComplete="name"
                  value={nome}
                  onChange={(ev) => setNome(ev.target.value)}
                  placeholder="Seu primeiro nome"
                  aria-label="Seu nome"
                  data-testid="venda-nome"
                  className={`${CAMPO_INPUT} ${erros.nome ? "border-[#E5484D]" : "border-[#DCD6CE]"}`}
                />
                {erros.nome && (
                  <p className="mt-1 ml-1 text-[12.5px] font-semibold text-[#B42318]" role="alert" data-testid="venda-erro-nome">
                    {erros.nome}
                  </p>
                )}
              </div>

              <div>
                <input
                  ref={refEmail}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") void enviar();
                  }}
                  placeholder="Seu melhor e-mail"
                  aria-label="Seu e-mail"
                  data-testid="venda-email"
                  className={`${CAMPO_INPUT} ${erros.email ? "border-[#E5484D]" : "border-[#DCD6CE]"}`}
                />
                {erros.email && (
                  <p className="mt-1 ml-1 text-[12.5px] font-semibold text-[#B42318]" role="alert" data-testid="venda-erro-email">
                    {erros.email}
                  </p>
                )}
              </div>
            </div>

            {erro && (
              <p className="mt-2.5 text-[13px] font-medium text-[#B42318]" role="alert" data-testid="venda-erro">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={() => void enviar()}
              disabled={ocupado}
              data-testid="venda-dados-cta"
              className="mt-3.5 w-full h-[54px] rounded-[14px] flex items-center justify-center gap-2 text-[16px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(38,38,38,0.35)] active:scale-[0.985] disabled:opacity-50 transition-transform"
              style={{ background: COR_TEXTO }}
            >
              {ocupado ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-label="Carregando" />
              ) : (
                <>
                  <Lock className="w-4 h-4" style={{ color: COR_ACENTO }} strokeWidth={2.5} />
                  <span>Gerar meu Pix de R$ 97,90</span>
                </>
              )}
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[#6E6961]">
              <ShieldCheck className="w-4 h-4 text-[#1F6B3A] shrink-0" />
              <span>Garantia de 7 dias · Reembolso de 100% no Pix se não se adaptar</span>
            </div>
          </>
        ) : (
          <>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(ev) => setSenha(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") void entrar();
              }}
              placeholder="Sua senha do CORE"
              aria-label="Sua senha do CORE"
              data-testid="venda-senha"
              className={`${CAMPO_INPUT} mt-3 border-[#DCD6CE]`}
            />
            {erro && (
              <p className="mt-2 text-[13px] text-[#B42318]" role="alert" data-testid="venda-erro">
                {erro}
              </p>
            )}
            <button
              type="button"
              onClick={() => void entrar()}
              disabled={ocupado || !senha}
              data-testid="venda-entrar"
              className="mt-3 w-full h-[50px] rounded-[12px] flex items-center justify-center text-[15.5px] font-bold text-white disabled:opacity-40"
              style={{ background: COR_TEXTO }}
            >
              {ocupado ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar e continuar"}
            </button>
            <EntrarComCodigo
              email={email}
              funil="venda_web"
              rotulo="Entrar com um código no e-mail"
              className="mt-2.5"
              onSession={() => {
                void onEntrouCodigo(nome.trim(), email.trim());
              }}
            />
            <button
              type="button"
              onClick={() => {
                setExiste(false);
                setSenha("");
                setErro(null);
              }}
              className="mt-1 w-full h-9 text-[13.5px] text-[#6E6961]"
              data-testid="venda-outro-email"
            >
              Usar <b className="text-[#262626]">outro e-mail</b>
            </button>
          </>
        )}
      </div>

      {/* PROVA SOCIAL REAL DA APP STORE / GOOGLE PLAY */}
      <div className="rounded-[16px] border border-[#E5E0D8] bg-[#FAF8F6] px-3.5 py-3 text-[12.5px] text-[#5C5852]">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#262626]">★★★★★ 4,9 nas lojas oficiais</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A746C]">
            Compra verificada
          </span>
        </div>
        <p className="mt-1 italic text-[#3D3A35]">
          “Substituiu minha planilha e 4 apps separados. Só de abrir e ver exatamente quanto posso gastar no dia, parei de entrar no cheque especial no dia 20.”
        </p>
        <p className="mt-0.5 text-[11.5px] font-semibold text-[#7A746C]">— Rebeca G. · Usuária CORE</p>
      </div>
    </section>
  );
}
