import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, Lock, QrCode, ShieldCheck } from "lucide-react";
import { EMPRESA } from "@/lib/empresa";
import {
  DATA_PARCELA_1, DATA_PARCELA_2, SALARIO_MAX_ACEITO, SALARIO_MIN_ACEITO, SALARIO_MINIMO_2026, diasAte, lerSalario, reais,
  type Resultado13,
} from "./calculo";
import {
  BOTAO_CALCULAR, BOTAO_PIX, BOTAO_RESULTADO, DESTINOS, EXEMPLOS_SALARIO, FAQ, GARANTIA, LINHA_MODULOS, LINHA_TOTAL,
  LINK_ENTROU_2026, MAIS_MODULOS, MESES, MODULOS_INCLUSOS, POR_MES, POR_QUE_MENOR, PRECO, PRIVACIDADE, RODAPE_CALCULO,
  ROTULO_SALARIO, SELO_ENTRADA, SELO_ESFORCO, SELO_PLANO, SELO_PRECO, SELO_RESULTADO, SUB_BOTAO_PIX, SUB_ENTRADA,
  TITULO_DESTINO, TITULO_ENTRADA_A, TITULO_ENTRADA_B, TITULO_ENTRADA_DESTAQUE, TITULO_RECURSOS, dividir, percentualDoPreco,
  type ChaveDestino, type Destino,
} from "./conteudo";

/**
 * As telas do /funil-a na marca do CORE: papel #F7F5F3, texto #262626, UM destaque (#D22D80) no número e no
 * progresso, verde #30A65B só no dinheiro que sobra. Inter no corpo; Instrument Serif itálica só no número
 * grande e numa promessa por tela.
 */
export const COR = { papel: "#F7F5F3", texto: "#262626", sub: "#737373", borda: "#E7E3DF", destaque: "#D22D80", verde: "#30A65B" } as const;
export const SERIF = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" as const, fontWeight: 400 };
const ENTRA = "animate-[funilaEntra_280ms_cubic-bezier(.23,1,.32,1)_both] motion-reduce:animate-none";

export function EstilosFunilA() {
  return (
    <style>{`@keyframes funilaEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
  );
}

export function Topo({ onVoltar, progresso }: { onVoltar?: () => void; progresso: number | null }) {
  return (
    <header className="pt-1" data-testid="funila-topo">
      <div className="h-10 flex items-center justify-between">
        {onVoltar ? (
          <button type="button" onClick={onVoltar} aria-label="Voltar" data-testid="funila-voltar"
            className="w-9 h-9 -ml-1.5 grid place-items-center rounded-full active:bg-black/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : <span className="w-9" />}
        <span className="flex items-center gap-1.5">
          <img src="/icon-192.png" alt="" width={22} height={22} className="w-[22px] h-[22px] rounded-[6px] border border-[#e6e3e9] bg-white" />
          <span className="text-[17px] font-black tracking-[-0.03em]">CORE</span>
        </span>
        <span className="w-9" />
      </div>
      {progresso != null && (
        <div className="mt-1 h-[3px] rounded-full bg-black/[.06] overflow-hidden" aria-hidden data-testid="funila-progresso">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(progresso * 100)}%`, background: COR.destaque }} />
        </div>
      )}
    </header>
  );
}

export function BotaoPrincipal({ children, onClick, disabled, testid, icone }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; testid: string; icone?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testid}
      className="w-full h-14 rounded-full text-white text-[17px] font-semibold flex items-center justify-center gap-2 active:scale-[.97] transition-transform disabled:opacity-50"
      style={{ background: COR.texto }}>
      {icone}{children}
    </button>
  );
}

/** O CTA preso no rodapé (com a safe-area), pras telas que rolam. */
export function Rodape({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-28" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-20" style={{ background: `linear-gradient(to top, ${COR.papel} 70%, transparent)` }}>
        <div className="mx-auto max-w-[440px] px-5 pt-4" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </>
  );
}

const Card = ({ children, className = "", testid, style }: { children: ReactNode; className?: string; testid?: string; style?: React.CSSProperties }) => (
  <div data-testid={testid} style={style}
    className={`rounded-2xl bg-white border px-4 py-4 shadow-[0_1px_2px_rgba(38,38,38,.04),0_8px_24px_-14px_rgba(38,38,38,.18)] ${className}`}>
    {children}
  </div>
);

const dataCurta = (d: Date) =>
  d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");

/* ------------------------------------------------------------------ 1. entrada: o salário */
export function TelaEntrada({ salarioInicial, mesInicial, onCalcular }: {
  salarioInicial: string;
  mesInicial: number | null;
  onCalcular: (texto: string, mesEntrada: number | null, viaExemplo: boolean) => void;
}) {
  const [texto, setTexto] = useState(salarioInicial);
  const [mes, setMes] = useState<number | null>(mesInicial);
  const [abrirMes, setAbrirMes] = useState(mesInicial != null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const enviar = (t: string, viaExemplo = false) => {
    const v = lerSalario(t);
    if (!Number.isFinite(v) || v < SALARIO_MIN_ACEITO) { setErro("Digite o salário do mês, por exemplo 2.500"); ref.current?.focus(); return; }
    if (v > SALARIO_MAX_ACEITO) { setErro("Esse valor parece alto demais. Confere?"); ref.current?.focus(); return; }
    setErro(null);
    onCalcular(t, abrirMes ? mes : null, viaExemplo);
  };

  return (
    <div className={`pt-6 ${ENTRA}`} data-testid="funila-entrada">
      <p className="inline-flex rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ color: COR.destaque, background: "rgba(210,45,128,.09)" }}>{SELO_ENTRADA}</p>
      <h1 className="mt-3 text-[31px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance" data-testid="funila-titulo">
        {TITULO_ENTRADA_A} <span style={{ ...SERIF, color: COR.destaque }} className="text-[36px] tracking-normal">{TITULO_ENTRADA_DESTAQUE}</span> {TITULO_ENTRADA_B}
      </h1>
      <p className="mt-3 text-[16px] leading-[1.45]" style={{ color: COR.sub }}>{SUB_ENTRADA}</p>

      <label htmlFor="funila-salario" className="mt-6 block text-[13.5px] font-semibold">{ROTULO_SALARIO}</label>
      <div className={`mt-2 flex items-center h-16 rounded-2xl bg-white border-2 px-4 ${erro ? "border-[#b42318]" : "border-transparent focus-within:border-[#262626]"} shadow-[0_1px_2px_rgba(38,38,38,.05)]`}>
        <span className="text-[22px] font-bold mr-2" style={{ color: COR.sub }}>R$</span>
        <input
          id="funila-salario" ref={ref} data-testid="funila-salario" inputMode="decimal" autoComplete="off" enterKeyHint="go"
          placeholder="2.500" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(texto); }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[26px] font-bold tracking-[-0.02em] placeholder:text-[#c9c4bf]"
        />
      </div>
      {erro && <p className="mt-1.5 ml-1 text-[13px] font-semibold text-[#b42318]" role="alert" data-testid="funila-erro">{erro}</p>}

      <div className="mt-3 flex flex-wrap gap-2" data-testid="funila-exemplos">
        {EXEMPLOS_SALARIO.map((v) => (
          <button key={v} type="button" data-testid={`funila-exemplo-${v}`}
            onClick={() => { const t = v.toLocaleString("pt-BR"); setTexto(t); enviar(t, true); }}
            className="h-9 px-3.5 rounded-full bg-white border text-[14px] font-semibold active:scale-[.97] transition-transform" style={{ borderColor: COR.borda }}>
            {reais(v, 0)}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {!abrirMes ? (
          <button type="button" onClick={() => { setAbrirMes(true); setMes(1); }} className="text-[13.5px] underline underline-offset-2" style={{ color: COR.sub }} data-testid="funila-link-mes">
            {LINK_ENTROU_2026}
          </button>
        ) : (
          <label className="flex items-center gap-2 text-[14px]" data-testid="funila-mes">
            <span style={{ color: COR.sub }}>Entrei em</span>
            <select value={mes ?? 1} onChange={(e) => setMes(Number(e.target.value))} data-testid="funila-mes-select"
              className="h-9 rounded-lg bg-white border px-2 font-semibold" style={{ borderColor: COR.borda }}>
              {MESES.slice(0, 11).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <span style={{ color: COR.sub }}>de 2026</span>
            <button type="button" onClick={() => { setAbrirMes(false); setMes(null); }} className="ml-auto text-[13px] underline" style={{ color: COR.sub }}>antes</button>
          </label>
        )}
      </div>

      <div className="mt-6">
        <BotaoPrincipal onClick={() => enviar(texto)} testid="funila-calcular">{BOTAO_CALCULAR}</BotaoPrincipal>
        <p className="mt-2.5 text-center text-[13px] font-semibold">{SELO_ESFORCO}</p>
        <p className="mt-1 flex items-start justify-center gap-1.5 text-center text-[12.5px] leading-snug" style={{ color: COR.sub }}>
          <Lock className="w-3.5 h-3.5 mt-[1px] shrink-0" aria-hidden />{PRIVACIDADE}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2. resultado */
function useContador(alvo: number, ms = 700): number {
  const [v, setV] = useState(alvo);
  useEffect(() => {
    const reduz = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduz || typeof requestAnimationFrame !== "function") { setV(alvo); return; }
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(alvo * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    setV(0);
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return v;
}

export function TelaResultado({ r, hoje, onContinuar, onRefazer }: { r: Resultado13; hoje: Date; onContinuar: () => void; onRefazer: () => void }) {
  const total = useContador(r.liquido13);
  const dias1 = diasAte(DATA_PARCELA_1, hoje);
  return (
    <div className={`pt-5 ${ENTRA}`} data-testid="funila-resultado">
      <p className="text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: COR.destaque }}>{SELO_RESULTADO}</p>
      <p className="mt-1 text-[60px] leading-[1] tracking-[-0.01em]" style={{ ...SERIF, color: COR.destaque }} data-testid="funila-liquido13" aria-label={reais(r.liquido13)}>
        {reais(total)}
      </p>
      <p className="mt-1.5 text-[18px] font-semibold leading-snug">{LINHA_TOTAL}{r.avos < 12 ? ` (${r.avos}/12 avos)` : ""}.</p>

      <div className="mt-5 flex flex-col gap-2.5">
        <Card testid="funila-parcela1" style={{ borderColor: COR.borda }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-bold">1ª parcela</p>
            <p className="text-[22px] font-extrabold tracking-[-0.02em]">{reais(r.parcela1)}</p>
          </div>
          <p className="mt-0.5 text-[13.5px]" style={{ color: COR.sub }}>
            até <b className="text-[#262626]">{dataCurta(DATA_PARCELA_1)}</b>{dias1 > 0 ? ` · daqui a ${dias1} dias` : ""} · sem desconto
          </p>
        </Card>
        <Card testid="funila-parcela2" style={{ borderColor: COR.borda }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-bold">2ª parcela</p>
            <p className="text-[22px] font-extrabold tracking-[-0.02em]">{reais(r.parcela2)}</p>
          </div>
          <p className="mt-0.5 text-[13.5px]" style={{ color: COR.sub }}>
            até <b className="text-[#262626]">{dataCurta(DATA_PARCELA_2)}</b> · o dia 20 é domingo
          </p>
          <p className="mt-2 text-[13.5px]" data-testid="funila-descontos">
            INSS <b>−{reais(r.inss13)}</b>{r.ir13 > 0 ? <> · IR <b>−{reais(r.ir13)}</b></> : <> · IR <b>R$ 0</b></>}
          </p>
        </Card>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-snug" style={{ color: COR.sub }}>{POR_QUE_MENOR}</p>

      {r.economiaIrMes > 0 && (
        <div className="mt-4 rounded-2xl px-4 py-3.5" style={{ background: "#D1F0DC" }} data-testid="funila-economia-ir">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: "#1f7a43" }}>Você talvez nem notou</p>
          <p className="mt-1 text-[15px] leading-snug">
            A nova isenção do IR deixa <b>{reais(r.economiaIrMes)} a mais</b> no seu salário todo mês em 2026. No ano, com o 13º, são{" "}
            <b style={{ color: "#1f7a43" }}>{reais(r.economiaIrAno)}</b>.
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Card testid="funila-liquido-mes" style={{ borderColor: COR.borda }}>
          <p className="text-[12.5px]" style={{ color: COR.sub }}>Salário líquido</p>
          <p className="mt-0.5 text-[18px] font-extrabold tracking-[-0.02em]">{reais(r.liquidoMes)}</p>
          <p className="text-[12px]" style={{ color: COR.sub }}>por mês</p>
        </Card>
        <Card testid="funila-fgts" style={{ borderColor: COR.borda }}>
          <p className="text-[12.5px]" style={{ color: COR.sub }}>FGTS em 2026</p>
          <p className="mt-0.5 text-[18px] font-extrabold tracking-[-0.02em]">{reais(r.fgtsAno)}</p>
          <p className="text-[12px]" style={{ color: COR.sub }}>depositado no seu nome</p>
        </Card>
      </div>

      {r.bruto < SALARIO_MINIMO_2026 && (
        <p className="mt-3 text-[12.5px]" style={{ color: COR.sub }}>O salário mínimo de 2026 é {reais(SALARIO_MINIMO_2026)}. Confere se o valor é o do mês inteiro.</p>
      )}
      <p className="mt-4 text-[11.5px] leading-snug" style={{ color: COR.sub }}>{RODAPE_CALCULO}</p>
      <button type="button" onClick={onRefazer} className="mt-2 text-[13.5px] underline underline-offset-2" style={{ color: COR.sub }} data-testid="funila-refazer">
        Calcular com outro salário
      </button>

      <Rodape><BotaoPrincipal onClick={onContinuar} testid="funila-resultado-cta">{BOTAO_RESULTADO} →</BotaoPrincipal></Rodape>
    </div>
  );
}

/* ------------------------------------------------------------------ 3. destino */
export function TelaDestino({ r, hoje, inicial, onEscolher }: { r: Resultado13; hoje: Date; inicial: ChaveDestino | null; onEscolher: (c: ChaveDestino) => void }) {
  const [sel, setSel] = useState<ChaveDestino | null>(inicial);
  const semanas = Math.max(1, Math.round(diasAte(DATA_PARCELA_1, hoje) / 7));
  return (
    <div className={`pt-5 ${ENTRA}`} data-testid="funila-destino">
      <p className="text-[14px] font-semibold" style={{ color: COR.sub }}>
        {reais(r.liquido13)} chegam {diasAte(DATA_PARCELA_1, hoje) > 0 ? `em ${semanas} semana${semanas > 1 ? "s" : ""}` : "agora"}.
      </p>
      <h2 className="mt-1 text-[27px] leading-[1.12] font-extrabold tracking-[-0.03em]">{TITULO_DESTINO}</h2>
      <div className="mt-5 flex flex-col gap-2.5">
        {DESTINOS.map((d) => (
          <button key={d.chave} type="button" data-testid={`funila-destino-${d.chave}`} data-sel={sel === d.chave ? "" : undefined}
            onClick={() => { setSel(d.chave); window.setTimeout(() => onEscolher(d.chave), 260); }}
            className="w-full min-h-[58px] rounded-2xl bg-white border-2 px-4 flex items-center gap-3 text-left text-[16px] font-semibold active:scale-[.97] transition-[transform,border-color]"
            style={{ borderColor: sel === d.chave ? COR.destaque : "#ECE8E4" }}>
            <span className="text-[22px]" aria-hidden>{d.emoji}</span>{d.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4. plano + preço */
export function TelaPlano({ r, destino, onPagar }: { r: Resultado13; destino: Destino; onPagar: () => void }) {
  const potes = dividir(r.liquido13, destino);
  const pct = percentualDoPreco(r.liquido13);
  const [faq, setFaq] = useState<number | null>(null);
  const cores = ["#F6D5E6", "#FAF0D1", "#D1F0DC"];
  return (
    <div className={`pt-5 ${ENTRA}`} data-testid="funila-plano" data-destino={destino.chave}>
      <p className="text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: COR.destaque }}>{SELO_PLANO}</p>
      <h2 className="mt-1 text-[26px] leading-[1.12] font-extrabold tracking-[-0.03em]">
        {destino.emoji} <span style={SERIF} className="text-[30px] font-normal tracking-normal">{destino.plano}</span>
      </h2>

      <div className="mt-4 flex flex-col gap-2" data-testid="funila-potes">
        {potes.map((p, i) => (
          <div key={p.rotulo} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: cores[i] }}>
            <span className="text-[14.5px] font-semibold">{p.rotulo}</span>
            <span className="text-[16px] font-extrabold tracking-[-0.02em]">{reais(p.valor, 0)}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[12.5px]" style={{ color: COR.sub }}>Divisão do seu 13º líquido de {reais(r.liquido13)}. No app você ajusta.</p>

      <p className="mt-5 text-[15px] font-bold">{TITULO_RECURSOS}</p>
      <ul className="mt-2 flex flex-col gap-2" data-testid="funila-recursos">
        {destino.recursos.map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
            <span className="mt-[3px] grid place-items-center w-[18px] h-[18px] shrink-0 rounded-full text-white text-[11px] font-black" style={{ background: COR.destaque }} aria-hidden>✓</span>{t}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5" data-testid="funila-modulos">
        {MODULOS_INCLUSOS.map((m) => <span key={m} className="rounded-full bg-white border px-2.5 py-1 text-[12.5px] font-semibold" style={{ borderColor: COR.borda }}>{m}</span>)}
        <span className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: "rgba(210,45,128,.09)", color: COR.destaque }}>{MAIS_MODULOS}</span>
      </div>
      <p className="mt-1.5 text-[12.5px]" style={{ color: COR.sub }}>{LINHA_MODULOS}</p>

      <div className="relative mt-6 rounded-2xl border-2 bg-white px-4 pt-5 pb-4" style={{ borderColor: COR.destaque }} data-testid="funila-preco">
        <span className="absolute -top-[11px] left-4 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold uppercase tracking-[0.08em] text-white" style={{ background: COR.destaque }}>{SELO_PRECO}</span>
        <p className="flex items-baseline gap-2">
          <span className="text-[34px] font-extrabold tracking-[-0.03em] leading-none">R$ {PRECO}</span>
          <span className="text-[14px]" style={{ color: COR.sub }}>uma vez · 1 ano de CORE</span>
        </p>
        <p className="mt-1 text-[14px]" style={{ color: COR.sub }}>dá <b className="text-[#262626]">R$ {POR_MES} por mês</b></p>
        {pct && (
          <p className="mt-2.5 rounded-xl px-3 py-2 text-[14px] leading-snug" style={{ background: "#F7F5F3" }} data-testid="funila-ancora">
            É <b>{pct}% do seu 13º</b>{r.economiaIrMes >= 8.16 ? <>, e menos do que a nova isenção do IR te devolve em 1 mês ({reais(r.economiaIrMes)})</> : null}.
          </p>
        )}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-snug" style={{ color: COR.sub }} data-testid="funila-garantia">
        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden />{GARANTIA}
      </p>

      <div className="mt-5 flex flex-col divide-y rounded-2xl bg-white border" style={{ borderColor: COR.borda }} data-testid="funila-faq">
        {FAQ.map((f, i) => (
          <div key={f.p} className="px-4">
            <button type="button" onClick={() => setFaq(faq === i ? null : i)} className="w-full h-12 flex items-center justify-between text-left text-[14.5px] font-semibold" aria-expanded={faq === i}>
              {f.p}<ChevronDown className={`w-4 h-4 transition-transform ${faq === i ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {faq === i && <p className="pb-3 -mt-1 text-[14px] leading-snug" style={{ color: COR.sub }}>{f.r}</p>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[11.5px] leading-snug" style={{ color: COR.sub }} data-testid="funila-empresa">
        CORE · CNPJ {EMPRESA.cnpj} · Pagamento pela Asaas<br />{EMPRESA.email}
      </p>

      <Rodape>
        <BotaoPrincipal onClick={onPagar} testid="funila-pagar" icone={<QrCode className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden />}>{BOTAO_PIX}</BotaoPrincipal>
        <p className="mt-1.5 text-center text-[12.5px]" style={{ color: COR.sub }}>{SUB_BOTAO_PIX}</p>
      </Rodape>
    </div>
  );
}

/** O card branco onde moram as telas reaproveitadas do /assinar (dados, Pix, sucesso). */
export function CardVenda({ children }: { children: ReactNode }) {
  return (
    <section className={`mt-4 rounded-[20px] border bg-white px-5 pt-1 pb-6 shadow-[0_1px_2px_rgba(38,38,38,.04),0_10px_28px_-14px_rgba(38,38,38,.16)] ${ENTRA}`} style={{ borderColor: COR.borda }}>
      {children}
    </section>
  );
}
