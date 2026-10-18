import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Lock, Mail, Plus, ShieldCheck, X } from "lucide-react";
import {
  CTA_CARTAO, CTA_FERRAMENTA, CTA_PIX, CTA_PIX_SUB, CTA_RESULTADO, CUPOM_TITULO, EMAIL_PLACEHOLDER, FAQ, GARANTIA_LINHA,
  LINK_SEM_ASSINATURA, LINHA_RESULTADO, LISTA_DICA, LISTA_TITULO, MODULOS_CHIPS, MODULOS_LINHA, NOTA_PRECOS, OUTRA_TITULO,
  PASSOS_PRECO, PERGUNTA_NAO_USOU, PRECO_LINHA_1, PRECO_LINHA_2, PRECO_SUB, PRECO_TITULO, SELO_FERRAMENTA, SELO_PLANO,
  SELO_RESULTADO, SUB_FERRAMENTA, TITULO_FERRAMENTA, TOTAL_ROTULO, TRAVA_FERRAMENTA, VALORES_OUTRA, ZERO_LINHA, ZERO_TITULO,
  SERVICOS, type Servico,
} from "./conteudo";
import { ancoraPreco, brl, cupom, economia, equivalencia, mesRotulo, totalAno } from "./somatorio";
import { EMPRESA } from "@/lib/empresa";

/**
 * AS TELAS DO SOMA-ASSINATURAS (/funil-e) — tokens da marca (prompt 18/10):
 * fundo #F7F5F3, texto #262626, acento #D22D80, Inter + Instrument Serif
 * itálico SÓ no número grande e numa promessa por tela. CTA pílula #333, 56px,
 * fixo no rodapé com safe-area. Sucesso #30A65B. Sem vermelho.
 */
export const TINTA = "#262626";
export const ACENTO = "#D22D80";
export const SUCESSO = "#30A65B";
export const FUNDO = "#F7F5F3";
const MICRO = "#737373";
const BORDA = "#E5E5E5";

/** O ícone do app (o mesmo do manifest/PWA e da Porta: 5 KB — o core-logo-black pesa 138 KB). */
const LOGO = "/icon-192.png";

const SERIF: React.CSSProperties = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" };

/* ---------------------------------------------------------- peças-base */
export function LogoLinha() {
  return (
    <div className="flex items-center gap-2" data-testid="funile-logo">
      <img src={LOGO} alt="" width={26} height={26} decoding="async" className="w-[26px] h-[26px] rounded-[7px] border border-[#e9e6e1] bg-white" />
      <span className="text-[19px] font-black tracking-[-0.03em] leading-none" style={{ color: TINTA }}>CORE</span>
    </div>
  );
}

function SeloPill({ children, testid }: { children: ReactNode; testid: string }) {
  return (
    <p
      className="w-fit rounded-full px-3 py-[6px] text-[11.5px] font-bold uppercase tracking-[0.12em]"
      style={{ background: "rgba(210,45,128,0.09)", color: ACENTO }}
      data-testid={testid}
    >
      {children}
    </p>
  );
}

/** O CTA pílula fixo no rodapé (com o total, na ferramenta; sozinho, no resultado). */
export function CtaFixo({ texto, onClick, disabled, testid, sub, topo }: {
  texto: string;
  onClick: () => void;
  disabled?: boolean;
  testid: string;
  sub?: string;
  /** conteúdo à esquerda do botão (o total vivo da ferramenta) */
  topo?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e9e6e1] bg-white/95 backdrop-blur-sm"
      style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      data-testid={`${testid}-barra`}
    >
      <div className="mx-auto w-full max-w-[440px] px-5 pt-2.5">
        {topo}
        <button
          type="button" onClick={onClick} disabled={disabled} data-testid={testid}
          className="w-full h-[56px] rounded-full flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-[transform,opacity] active:scale-[.98] disabled:opacity-40 disabled:active:scale-100"
          style={{ background: "#333333" }}
        >
          {texto}
        </button>
        {sub && <p className="mt-1.5 text-center text-[12.5px]" style={{ color: MICRO }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- T1 · a ferramenta */
function CartaoServico({ s, on, onToggle }: { s: Servico; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle} aria-pressed={on}
      data-testid={`funile-servico-${s.id}`} data-on={on ? "" : undefined}
      className="relative w-full min-h-[64px] rounded-[16px] border bg-white px-3 py-2.5 text-left transition-[transform,border-color,box-shadow] active:scale-[.98]"
      style={{
        borderColor: on ? ACENTO : BORDA,
        boxShadow: on ? `0 0 0 1px ${ACENTO}` : "0 1px 2px rgba(38,38,38,.04)",
        background: on ? "rgba(210,45,128,0.045)" : "#fff",
      }}
    >
      <span className="flex items-center gap-2.5">
        <span className="text-[20px] leading-none" aria-hidden>{s.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold leading-tight" style={{ color: TINTA }}>{s.nome}</span>
          <span className="block text-[12px] leading-tight mt-[2px]" style={{ color: MICRO }}>{brl(s.preco)}/mês</span>
        </span>
      </span>
      {on && (
        <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-[20px] h-[20px] rounded-full text-white" style={{ background: ACENTO }} aria-hidden>
          <Check className="w-3 h-3" strokeWidth={3.4} />
        </span>
      )}
    </button>
  );
}

export function Ferramenta({ sel, extras, onToggle, onExtra, onTiraExtra, onVer, onSemAssinatura, total, rota }: {
  sel: string[];
  extras: number[];
  onToggle: (id: string) => void;
  onExtra: (v: number) => void;
  onTiraExtra: (i: number) => void;
  onVer: () => void;
  onSemAssinatura: () => void;
  total: number;
  rota: string;
}) {
  const n = sel.length + extras.length;
  return (
    <div data-testid="funile-ferramenta" data-rota={rota}>
      <div className="flex flex-col gap-3">
        <LogoLinha />
        <SeloPill testid="funile-selo">{SELO_FERRAMENTA}</SeloPill>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] leading-[1.12] text-balance" style={{ color: TINTA }} data-testid="funile-h1">
          {TITULO_FERRAMENTA}
        </h1>
        <p className="text-[16px] leading-[1.45] text-pretty" style={{ color: MICRO }}>{SUB_FERRAMENTA}</p>
        <p className="flex items-center gap-1.5 text-[13px]" style={{ color: MICRO }}>
          <Lock className="w-3.5 h-3.5" aria-hidden />{TRAVA_FERRAMENTA}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5" role="list" data-testid="funile-grade">
        {SERVICOS.map((s) => (
          <div role="listitem" key={s.id}>
            <CartaoServico s={s} on={sel.includes(s.id)} onToggle={() => onToggle(s.id)} />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[16px] border bg-white p-3.5" style={{ borderColor: BORDA }} data-testid="funile-outra">
        <p className="text-[13.5px] font-semibold" style={{ color: TINTA }}>{OUTRA_TITULO}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VALORES_OUTRA.map((v) => (
            <button
              key={v} type="button" onClick={() => onExtra(v)} data-testid={`funile-outra-${String(v).replace(".", "_")}`}
              className="h-[40px] rounded-full border bg-white px-3.5 text-[13.5px] font-semibold flex items-center gap-1 active:scale-[.97]"
              style={{ borderColor: BORDA, color: TINTA }}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />{brl(v)}
            </button>
          ))}
        </div>
        {extras.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2" data-testid="funile-extras">
            {extras.map((v, i) => (
              <button
                key={`${v}-${i}`} type="button" onClick={() => onTiraExtra(i)} data-testid={`funile-extra-${i}`}
                className="h-[32px] rounded-full px-3 text-[12.5px] font-semibold flex items-center gap-1.5 text-white"
                style={{ background: ACENTO }}
                aria-label={`Remover outra assinatura de ${brl(v)}`}
              >
                Outra · {brl(v)}<X className="w-3 h-3" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <button type="button" onClick={onSemAssinatura} className="text-[14px] underline underline-offset-4" style={{ color: MICRO }} data-testid="funile-sem-assinatura">
          {LINK_SEM_ASSINATURA}
        </button>
      </div>

      {/* espaço pro CTA fixo */}
      <div className="h-[132px]" aria-hidden />
      <CtaFixo
        texto={CTA_FERRAMENTA} onClick={onVer} disabled={n === 0} testid="funile-ver-total"
        topo={
          <div className="flex items-end justify-between pb-2" data-testid="funile-total-vivo">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: MICRO }}>{TOTAL_ROTULO}</span>
            <span className="text-[26px] leading-none" style={{ ...SERIF, color: ACENTO }} data-testid="funile-total-numero">{brl(total)}</span>
          </div>
        }
      />
    </div>
  );
}

/* ---------------------------------------------------------- T2 · o resultado */
export function Resultado({ sel, extras, naoUsadas, extrasNaoUsados, total, onAlternaNaoUsada, onAlternaExtraNaoUsado, onSeguir, email, onEmail, rota }: {
  sel: string[];
  extras: number[];
  /** chaves do cupom marcadas como "não usei no último mês" */
  naoUsadas: string[];
  extrasNaoUsados: number[];
  total: number;
  onAlternaNaoUsada: (chave: string) => void;
  onAlternaExtraNaoUsado: (i: number) => void;
  onSeguir: () => void;
  email: string | null;
  onEmail: (email: string) => void;
  rota: string;
}) {
  const itens = cupom(sel, extras);
  const marcadas = itens.filter((i) => naoUsadas.includes(i.chave));
  const eco = economia(marcadas);
  const ano = totalAno(total);
  const equiv = equivalencia(ano);
  const zero = itens.length === 0;
  const [campoEmail, setCampoEmail] = useState("");
  const [emailOk, setEmailOk] = useState(!!email);

  if (zero) {
    return (
      <div data-testid="funile-resultado" data-rota={rota} data-zero="">
        <div className="flex flex-col gap-3 pt-2">
          <LogoLinha />
          <h1 className="mt-4 text-[30px] font-extrabold tracking-[-0.03em]" style={{ color: TINTA }} data-testid="funile-zero-titulo">{ZERO_TITULO}</h1>
          <p className="text-[16px] leading-[1.5] text-pretty" style={{ color: MICRO }}>{ZERO_LINHA}</p>
        </div>
        <div className="h-[120px]" aria-hidden />
        <CtaFixo texto={CTA_RESULTADO} onClick={onSeguir} testid="funile-seguir-zero" />
      </div>
    );
  }

  return (
    <div data-testid="funile-resultado" data-rota={rota}>
      <LogoLinha />
      <div className="mt-5 flex flex-col gap-1.5">
        <SeloPill testid="funile-selo-resultado">{SELO_RESULTADO} · {mesRotulo()} · preços de hoje</SeloPill>
        <p className="mt-2 text-[56px] leading-[1.02] tracking-[-0.01em]" style={{ ...SERIF, color: ACENTO }} data-testid="funile-numero">
          {brl(total)}
        </p>
        <p className="text-[18px] font-semibold leading-snug" style={{ color: TINTA }}>por mês {LINHA_RESULTADO}</p>
        <p className="text-[16px] leading-snug" style={{ color: MICRO }} data-testid="funile-numero-ano">
          No ano, são <b style={{ color: TINTA }}>{brl(ano)}</b>{equiv ? <> — dá pra {equiv}</> : null}.
        </p>
      </div>

      {/* o cupom: o que ela mesma montou */}
      <div className="mt-5 rounded-[16px] border bg-white p-4" style={{ borderColor: BORDA }} data-testid="funile-cupom">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: MICRO }}>{CUPOM_TITULO}</p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {itens.map((i) => (
            <li key={i.chave} className="flex items-center gap-2.5 text-[14.5px]" data-testid={`funile-item-${i.chave}`}>
              <span aria-hidden>{i.emoji}</span>
              <span className="flex-1 min-w-0">
                <b style={{ color: TINTA }}>{i.nome}</b>
                <span className="block text-[12px]" style={{ color: MICRO }}>{i.plano}</span>
              </span>
              <span className="font-semibold" style={{ color: TINTA }}>{brl(i.preco)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* a pergunta que vira a economia dela */}
      <p className="mt-6 text-[17px] font-bold leading-snug" style={{ color: TINTA }} data-testid="funile-pergunta-nao-usou">{PERGUNTA_NAO_USOU}</p>
      <div className="mt-3 grid grid-cols-2 gap-2" data-testid="funile-nao-usadas">
        {itens.map((i) => {
          const on = naoUsadas.includes(i.chave);
          const ehExtra = i.chave.startsWith("extra-");
          const idx = ehExtra ? Number(i.chave.slice(6)) : -1;
          return (
            <button
              key={i.chave} type="button" aria-pressed={on}
              onClick={() => (ehExtra ? onAlternaExtraNaoUsado(idx) : onAlternaNaoUsada(i.chave))}
              data-testid={`funile-nao-${i.chave}`} data-on={on ? "" : undefined}
              className="min-h-[48px] rounded-[14px] border bg-white px-3 py-2 text-left text-[13.5px] font-semibold transition-[transform,border-color] active:scale-[.98] flex items-center gap-2"
              style={{
                borderColor: on ? SUCESSO : BORDA,
                color: on ? SUCESSO : TINTA,
                textDecoration: on ? "line-through" : "none",
                background: on ? "rgba(48,166,91,0.06)" : "#fff",
              }}
            >
              <span aria-hidden>{i.emoji}</span><span className="truncate">{i.nome}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {eco.n > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.22 }}
            className="mt-4 rounded-[16px] p-4" style={{ background: "rgba(48,166,91,0.1)", border: `1px solid rgba(48,166,91,0.35)` }}
            data-testid="funile-economia"
          >
            <p className="text-[15.5px] font-bold leading-snug" style={{ color: "#20713f" }}>
              Cancelando {eco.n === 1 ? "essa" : `essas ${eco.n}`}, voltam {brl(eco.mes)}/mês — <span style={{ whiteSpace: "nowrap" }}>{brl(eco.ano)} por ano</span>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* o artefato que ela guarda */}
      <div className="mt-5 rounded-[16px] border bg-white p-4" style={{ borderColor: BORDA }} data-testid="funile-lista">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: MICRO }}>{LISTA_TITULO}</p>
        {marcadas.length === 0 ? (
          <p className="mt-2 text-[14px] leading-snug" style={{ color: MICRO }} data-testid="funile-lista-vazia">
            Toque nas que você não usou: elas entram aqui, prontas pra cancelar uma a uma.
          </p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-2" data-testid="funile-lista-itens">
            {marcadas.map((i) => (
              <li key={i.chave} className="flex items-center gap-2.5 text-[14.5px]">
                <span className="grid place-items-center w-[18px] h-[18px] rounded-full text-white shrink-0" style={{ background: SUCESSO }} aria-hidden>
                  <Check className="w-3 h-3" strokeWidth={3.4} />
                </span>
                <span className="flex-1" style={{ color: TINTA }}>{i.nome}</span>
                <span className="font-semibold" style={{ color: SUCESSO }}>+{brl(i.preco)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] leading-snug" style={{ color: MICRO }}>{LISTA_DICA}</p>
        {emailOk ? (
          <p className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: SUCESSO }} data-testid="funile-email-ok">
            <Check className="w-4 h-4" aria-hidden />Anotado! Sua lista também chega no seu e-mail.
          </p>
        ) : (
          <div className="mt-3">
            <label className="text-[13.5px] font-semibold" style={{ color: TINTA }} htmlFor="funile-email-campo">{EMAIL_PLACEHOLDER}</label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="funile-email-campo" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                value={campoEmail} onChange={(ev) => setCampoEmail(ev.target.value)} placeholder="seu@email.com"
                data-testid="funile-email-campo"
                className="min-w-0 flex-1 h-[46px] rounded-[12px] border bg-white px-3.5 text-[15px] outline-none focus:border-[#333]"
                style={{ borderColor: BORDA, color: TINTA }}
              />
              <button
                type="button" data-testid="funile-email-cta"
                onClick={() => {
                  const em = campoEmail.trim().toLowerCase();
                  if (!/^\S+@\S+\.\S{2,}$/.test(em)) return;
                  setEmailOk(true);
                  onEmail(em);
                }}
                className="h-[46px] shrink-0 rounded-[12px] px-4 text-[14px] font-semibold text-white active:scale-[.98] flex items-center gap-1.5"
                style={{ background: "#333333" }}
              >
                <Mail className="w-4 h-4" aria-hidden />Enviar
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-[12px] leading-snug text-center" style={{ color: MICRO }}>{NOTA_PRECOS}</p>

      <div className="h-[120px]" aria-hidden />
      <CtaFixo texto={CTA_RESULTADO} onClick={onSeguir} testid="funile-seguir" />
    </div>
  );
}

/* ---------------------------------------------------------- T3 · o preço */
export function Preco({ total, caraNaoUsada, temCartao, onPix, onCartao, rota }: {
  total: number;
  caraNaoUsada: { nome: string; preco: number } | null;
  temCartao: boolean;
  onPix: () => void;
  onCartao: () => void;
  rota: string;
}) {
  const ancora = ancoraPreco({ totalMes: total, caraNaoUsada });
  return (
    <div data-testid="funile-preco" data-rota={rota}>
      <LogoLinha />
      <div className="mt-5">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em] leading-[1.12] text-balance" style={{ color: TINTA }} data-testid="funile-preco-titulo">
          {PRECO_TITULO}
        </h1>
        <p className="mt-2 text-[16px] leading-[1.45] text-pretty" style={{ ...SERIF, color: MICRO, fontSize: 19 }} data-testid="funile-preco-promessa">
          {PRECO_SUB}
        </p>
      </div>

      <ol className="mt-5 flex flex-col gap-2.5" data-testid="funile-passos">
        {PASSOS_PRECO.map((p, i) => (
          <li key={p.titulo} className="flex items-start gap-3 rounded-[16px] border bg-white px-4 py-3.5" style={{ borderColor: BORDA, boxShadow: "0 1px 2px rgba(38,38,38,.04), 0 8px 20px -14px rgba(38,38,38,.12)" }}>
            <span className="shrink-0 mt-[1px] grid place-items-center w-[26px] h-[26px] rounded-full text-white text-[12.5px] font-black" style={{ background: i === 0 ? ACENTO : "#333333" }}>{i + 1}</span>
            <span>
              <b className="block text-[15px] leading-tight" style={{ color: TINTA }}>{p.titulo}</b>
              <span className="block mt-1 text-[13.5px] leading-snug" style={{ color: MICRO }}>{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-1.5" data-testid="funile-modulos">
        <span className="text-[12px] font-bold uppercase tracking-[0.1em] mr-1" style={{ color: MICRO }}>{MODULOS_LINHA}:</span>
        {MODULOS_CHIPS.map((m) => (
          <span key={m} className="rounded-full border bg-white px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: BORDA, color: TINTA }}>{m}</span>
        ))}
      </div>

      <div className="relative mt-6 rounded-[18px] border-2 bg-white p-5" style={{ borderColor: ACENTO }} data-testid="funile-card-preco">
        <span className="absolute -top-[12px] right-4 rounded-full px-3 py-[4px] text-[11.5px] font-bold uppercase tracking-[0.08em] text-white" style={{ background: ACENTO }}>{SELO_PLANO}</span>
        <p className="text-[40px] font-extrabold tracking-[-0.03em] leading-none" style={{ color: TINTA }} data-testid="funile-preco-numero">R$ 97,90</p>
        <p className="mt-1.5 text-[14.5px]" style={{ color: MICRO }}>{PRECO_LINHA_1} · {PRECO_LINHA_2}</p>
        {ancora && (
          <p className="mt-3 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold leading-snug" style={{ background: "rgba(210,45,128,0.07)", color: ACENTO }} data-testid="funile-ancora">
            {ancora}
          </p>
        )}
        <button
          type="button" onClick={onPix} data-testid="funile-pagar-pix"
          className="mt-4 w-full h-[56px] rounded-full text-[17px] font-semibold text-white active:scale-[.98] transition-transform"
          style={{ background: "#333333" }}
        >
          {CTA_PIX}
        </button>
        <p className="mt-1.5 text-center text-[12.5px]" style={{ color: MICRO }}>{CTA_PIX_SUB}</p>
        {temCartao && (
          <button
            type="button" onClick={onCartao} data-testid="funile-pagar-cartao"
            className="mt-2.5 w-full h-[52px] rounded-full border bg-white text-[15.5px] font-semibold active:scale-[.99] transition-transform"
            style={{ borderColor: BORDA, color: TINTA }}
          >
            {CTA_CARTAO}
          </button>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-center" style={{ color: MICRO }} data-testid="funile-garantia">
        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden />{GARANTIA_LINHA}
      </p>
      <p className="mt-2 text-center text-[12px]" style={{ color: MICRO }} data-testid="funile-confianca">
        CORE Aplicativo · CNPJ {EMPRESA.cnpj} · Pagamento pela Asaas
      </p>

      <div className="mt-5 flex flex-col gap-2" data-testid="funile-faq">
        {FAQ.map((f) => (
          <details key={f.q} className="rounded-[14px] border bg-white px-4 py-3 group" style={{ borderColor: BORDA }}>
            <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-[14.5px] font-semibold" style={{ color: TINTA }}>
              {f.q}<ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 text-[13.5px] leading-snug" style={{ color: MICRO }}>{f.a}</p>
          </details>
        ))}
      </div>

      <div className="h-10" aria-hidden />
    </div>
  );
}

/** O fundo "papel" da marca + a coluna de 390px. `data-passo` é a régua dos testes (como o da /assinar). */
export function PaginaFunil({ children, testid, passo }: { children: ReactNode; testid: string; passo?: string }) {
  return (
    <div className="min-h-[100dvh] antialiased" style={{ background: FUNDO, color: TINTA }} data-testid={testid} data-passo={passo}>
      <div className="mx-auto w-full max-w-[440px] px-5 pb-8" style={{ paddingTop: "calc(18px + env(safe-area-inset-top))" }}>
        {children}
      </div>
    </div>
  );
}
