import { type ReactNode, useEffect, useRef } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import logo from "@/assets/core-logo-black.png";
import { ALL_MODULE_ICONS } from "@/lib/funnel";
import { EMPRESA } from "@/lib/empresa";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { EMAIL_OK } from "@/pages/venda/conta";
import {
  ancora, duracao, fatiaDoDia, reais, reaisSolto, type ContaDaHora, type Jornada, type Traducao,
} from "./horas";
import {
  CONFIANCA_GATEWAY, CTA_GERAR, CTA_GUARDAR, CTA_PAGAR, CTA_PAGAR_SUB, CTA_VER, EMAIL_PLACEHOLDER, EMAIL_SUB,
  EMAIL_TITULO, ERRO_EMAIL_INVALIDO, ERRO_EMAIL_VAZIO, EXEMPLOS, EXEMPLOS_ROTULO, FAQ, GARANTIA,
  H1, JORNADA_22, JORNADA_44, MODULOS_LINHA, PASSO_SUB, PASSO_TITULO, PASSOS_APP, PLACEHOLDER_PRECO, PLACEHOLDER_SALARIO,
  PRECO_LINHA, PRECO_MES, PRECO_SELO, PRIVACIDADE, PROMESSA, ROTULO_PRECO, ROTULO_SALARIO, SELO_ENTRADA, SUB_ENTRADA,
  TROCAR_22, TROCAR_44,
} from "./conteudo";

const SERIF_NUM = "fd-serif text-[60px] leading-none tracking-[-0.03em] text-[#D22D80]";

export function Moldura({ children, passo }: { children: ReactNode; passo: string }) {
  return (
    <div className="min-h-[100dvh] bg-[#F7F5F3] text-[#262626] antialiased" data-testid="funild" data-passo={passo}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-5" style={{ paddingTop: "calc(18px + env(safe-area-inset-top))" }}>
        {children}
      </div>
    </div>
  );
}

export function Topo({ onVoltar }: { onVoltar?: () => void }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {onVoltar && (
          <button type="button" onClick={onVoltar} aria-label="Voltar" data-testid="funild-voltar" className="mr-1 grid h-8 w-8 place-items-center rounded-full text-[#737373] active:scale-95">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        <img src={logo} alt="CORE" width={24} height={24} className="h-6 w-auto" />
      </div>
    </header>
  );
}

export function Selo({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 w-fit rounded-full bg-[#D22D80]/10 px-3 py-1 text-[12px] font-semibold tracking-wide text-[#D22D80]" data-testid="funild-selo">
      {children}
    </p>
  );
}

export function Cta({ children, onClick, disabled, teste, sub }: { children: ReactNode; onClick: () => void; disabled?: boolean; teste: string; sub?: ReactNode }) {
  return (
    <>
      {/* Reserva a altura da barra. O botão é fixed e pinta em cima deste vazio,
          então o último texto da tela sobe inteiro, sem ficar por baixo dele. */}
      <div aria-hidden className={`mt-auto w-full shrink-0 ${sub ? "h-[176px]" : "h-[132px]"}`} />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div
          className="pointer-events-auto mx-auto w-full max-w-[430px] px-5 pt-5"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))", background: "linear-gradient(to top, #F7F5F3 calc(100% - 20px), rgba(247,245,243,0))" }}
        >
          <button
            type="button" onClick={onClick} disabled={disabled} data-testid={teste}
            className="h-14 w-full rounded-full bg-[#333333] text-[17px] font-semibold text-white active:scale-[.97] disabled:opacity-60"
          >
            {children}
          </button>
          {sub && <p className="mt-2 text-center text-[12.5px] leading-snug text-[#737373]">{sub}</p>}
        </div>
      </div>
    </>
  );
}

export function Entrada({
  salario, onSalario, jornada, onJornada, erro, onVer,
}: {
  salario: string;
  onSalario: (v: string) => void;
  jornada: Jornada;
  onJornada: (j: Jornada) => void;
  erro: string | null;
  onVer: () => void;
}) {
  const meio = jornada === "22h";
  return (
    <>
      <Topo />
      <div className="fd-in">
        <Selo>{SELO_ENTRADA}</Selo>
        <h1 className="mt-4 max-w-[340px] text-[32px] font-extrabold leading-[1.12] tracking-[-0.03em]" data-testid="funild-h1">{H1}</h1>
        <p className="fd-serif mt-3 max-w-[320px] text-[22px] leading-[1.25] text-[#262626]">{PROMESSA}</p>
        <p className="mt-3 max-w-[340px] text-[15.5px] leading-snug text-[#737373]">{SUB_ENTRADA}</p>

        <label className="mt-6 block text-[13px] font-semibold text-[#737373]" htmlFor="funild-salario">{ROTULO_SALARIO}</label>
        <div className="mt-2 flex h-16 items-center rounded-2xl border border-[#E6E2DE] bg-white px-4 focus-within:border-[#333333]">
          <span className="text-[20px] font-semibold text-[#737373]">R$</span>
          <input
            id="funild-salario" data-testid="funild-salario" inputMode="decimal" autoComplete="off" enterKeyHint="go"
            placeholder={PLACEHOLDER_SALARIO} value={salario}
            onChange={(e) => onSalario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onVer(); }}
            className="ml-2 h-full w-full bg-transparent text-[28px] font-semibold tabular-nums outline-none placeholder:text-[#C4C0BA]"
            aria-invalid={erro ? true : undefined}
          />
        </div>
        {erro && <p className="mt-2 text-[13.5px] font-semibold text-[#D22D80]" role="alert" data-testid="funild-erro">{erro}</p>}

        <button
          type="button" data-testid="funild-jornada"
          onClick={() => onJornada(meio ? "44h" : "22h")}
          className="mt-3 text-left text-[13.5px] text-[#737373]"
        >
          <span className="font-semibold text-[#262626]">{meio ? JORNADA_22 : JORNADA_44}</span>
          <span className="ml-2 underline underline-offset-2">{meio ? TROCAR_44 : TROCAR_22}</span>
        </button>
      </div>
      <Cta onClick={onVer} teste="funild-ver" sub={PRIVACIDADE}>{CTA_VER}</Cta>
    </>
  );
}

export function Resultado({
  conta, precoTexto, onPreco, traducao, onExemplo, onJornada, onSeguir, onVoltar,
}: {
  conta: ContaDaHora;
  precoTexto: string;
  onPreco: (v: string) => void;
  traducao: Traducao | null;
  onExemplo: (centavos: number) => void;
  onJornada: (j: Jornada) => void;
  onSeguir: () => void;
  onVoltar: () => void;
}) {
  const meio = conta.jornada === "22h";
  const tradRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!traducao) return;
    try { tradRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* jsdom */ }
  }, [traducao?.precoCentavos, traducao?.minutos]);
  return (
    <>
      <Topo onVoltar={onVoltar} />
      <div className="fd-in pb-4">
        <Selo>Sua hora · {meio ? "22h por semana" : "CLT · 44h"} · {conta.mes} {conta.ano}</Selo>
        <p className={`${SERIF_NUM} mt-4`} data-testid="funild-hora">{reais(conta.horaCentavos)}</p>
        <p className="mt-2 text-[18px] font-semibold leading-snug">é o que uma hora sua vale.</p>
        <p className="mt-1 text-[13px] text-[#737373]">
          {reaisSolto(conta.salarioCentavos)} ÷ {meio ? "110" : "220"} horas. {meio ? "Meio período." : "A conta da CLT pra quem faz 44h por semana."}
        </p>
        <button type="button" data-testid="funild-jornada" onClick={() => onJornada(meio ? "44h" : "22h")} className="mt-1 text-[13px] text-[#737373] underline underline-offset-2">
          {meio ? TROCAR_44 : TROCAR_22}
        </button>

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(38,38,38,.04),0_8px_24px_rgba(38,38,38,.04)]" data-testid="funild-dia">
          <p className="text-[13px] font-semibold text-[#737373]">Cada dia do mês tem</p>
          <p className="fd-serif mt-1 text-[36px] leading-none text-[#262626]">{reais(conta.diaCentavos)}</p>
          <p className="mt-3 text-[14.5px] leading-snug text-[#262626]" data-testid="funild-cabe">
            Hoje é dia {conta.dia} de {conta.mes}. Contando hoje, faltam {conta.restantes} {conta.restantes === 1 ? "dia" : "dias"}. Nessa fatia igual, cabem {reais(conta.cabeCentavos)} até dia {conta.diasNoMes}.
          </p>
          <p className="mt-2 text-[12.5px] leading-snug text-[#737373]">Não é o que sobrou na conta. É o salário repartido igual pelos 30 dias.</p>
        </div>

        <p className="mt-5 text-[16px] font-semibold leading-snug text-[#30A65B]" data-testid="funild-plano-horas">
          O ano do CORE (R$ 97,90) cabe em {duracao(conta.planoMinutos)} do seu trabalho. O mês sai por {duracao(conta.mesMinutos)}.
        </p>

        <label className="mt-6 block text-[14.5px] font-semibold leading-snug" htmlFor="funild-preco">{ROTULO_PRECO}</label>
        <div className="mt-2 flex h-14 items-center rounded-2xl border border-[#E6E2DE] bg-white px-4 focus-within:border-[#333333]">
          <span className="text-[16px] font-semibold text-[#737373]">R$</span>
          <input
            id="funild-preco" data-testid="funild-preco" inputMode="decimal" autoComplete="off"
            placeholder={PLACEHOLDER_PRECO} value={precoTexto}
            onChange={(e) => onPreco(e.target.value)}
            className="ml-2 h-full w-full bg-transparent text-[20px] font-semibold tabular-nums outline-none placeholder:text-[#C4C0BA]"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="funild-exemplos">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex.id} type="button" data-testid={`funild-exemplo-${ex.id}`}
              onClick={() => onExemplo(ex.centavos)}
              className="rounded-full border border-[#E6E2DE] bg-white px-3 py-1.5 text-[13px] font-semibold active:scale-[.97]"
            >
              {ex.rotulo} · {reaisSolto(ex.centavos)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[#737373]">{EXEMPLOS_ROTULO}</p>
        {traducao && (
          <p ref={tradRef} className="mt-3 scroll-mb-36 rounded-2xl bg-[#DBD6F5] px-4 py-3 text-[15.5px] font-semibold leading-snug" data-testid="funild-traducao">
            {reais(traducao.precoCentavos)} = {duracao(traducao.minutos)} da sua hora. {fatiaDoDia(traducao.precoCentavos, conta.diaCentavos)}.
          </p>
        )}
      </div>
      <Cta onClick={onSeguir} teste="funild-seguir">{CTA_GUARDAR}</Cta>
    </>
  );
}

export function Plano({
  conta, traducao, aberto, onAbrir, onPagar, onVoltar,
}: {
  conta: ContaDaHora;
  traducao: Traducao | null;
  aberto: number | null;
  onAbrir: (i: number | null) => void;
  onPagar: () => void;
  onVoltar: () => void;
}) {
  const a = ancora(conta, traducao);
  const chips = ALL_MODULE_ICONS.slice(0, 5);
  return (
    <>
      <Topo onVoltar={onVoltar} />
      <div className="fd-in pb-2">
        <Selo>Seu plano</Selo>
        <h1 className="mt-3 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{PASSO_TITULO}</h1>
        <p className="fd-serif mt-2 text-[20px] leading-snug">{PASSO_SUB}</p>

        <ol className="mt-5 space-y-2.5">
          {PASSOS_APP.map((p) => (
            <li key={p.n} className="rounded-2xl bg-white p-4" data-testid={`funild-passo-${p.n}`}>
              <p className="text-[12px] font-bold text-[#D22D80]">{p.n}</p>
              <p className="mt-0.5 text-[16px] font-semibold">{p.titulo}</p>
              <p className="mt-1 text-[14px] leading-snug text-[#737373]">{p.texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5" data-testid="funild-modulos">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#737373]">{MODULOS_LINHA}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((m) => (
              <span key={m.label} className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold">{m.emoji} {m.label}</span>
            ))}
            <span className="rounded-full bg-[#D22D80]/10 px-3 py-1 text-[13px] font-semibold text-[#D22D80]">+11</span>
          </div>
        </div>

        <div className="mt-5 scroll-mb-36 rounded-2xl border-2 border-[#D22D80] bg-white p-4" data-testid="funild-preco-card">
          <p className="w-fit rounded-full bg-[#D22D80]/10 px-2.5 py-0.5 text-[12px] font-bold text-[#D22D80]">{PRECO_SELO}</p>
          <p className="mt-2 text-[22px] font-extrabold tracking-tight">{PRECO_LINHA}</p>
          <p className="text-[15px] text-[#737373]">{PRECO_MES}</p>
          <p className="mt-3 text-[14.5px] font-semibold leading-snug text-[#30A65B]" data-testid="funild-ancora">{a.ano}</p>
          {a.comparacao && <p className="mt-1.5 text-[14.5px] leading-snug">{a.comparacao}</p>}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[13.5px] leading-snug text-[#737373]" data-testid="funild-garantia">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#30A65B]" aria-hidden />
          <span>{GARANTIA}</span>
        </p>
        <p className="mt-3 text-[12.5px] leading-snug text-[#737373]" data-testid="funild-cnpj">
          CORE Aplicativo · {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj} · {CONFIANCA_GATEWAY}
        </p>

        <div className="mt-4 divide-y divide-[#E6E2DE] rounded-2xl bg-white" data-testid="funild-faq">
          {FAQ.map((item, i) => (
            <button key={item.p} type="button" onClick={() => onAbrir(aberto === i ? null : i)} className="block w-full px-4 py-3 text-left" data-testid={`funild-faq-${i}`} aria-expanded={aberto === i}>
              <span className="text-[14.5px] font-semibold">{item.p}</span>
              {aberto === i && <span className="mt-1 block text-[14px] leading-snug text-[#737373]">{item.r}</span>}
            </button>
          ))}
        </div>
      </div>
      <Cta onClick={onPagar} teste="funild-pagar" sub={CTA_PAGAR_SUB}>{CTA_PAGAR}</Cta>
    </>
  );
}

export function Email({
  email, onEmail, erro, existe, ocupado, senha, onSenha, onEnviar, onEntrar, onCodigo, onOutro, onVoltar,
}: {
  email: string;
  onEmail: (v: string) => void;
  erro: string | null;
  existe: boolean;
  ocupado: boolean;
  senha: string;
  onSenha: (v: string) => void;
  onEnviar: () => void;
  onEntrar: () => void;
  onCodigo: () => void;
  onOutro: () => void;
  onVoltar: () => void;
}) {
  return (
    <>
      <Topo onVoltar={onVoltar} />
      <div className={`fd-in ${existe ? "pb-8" : ""}`}>
        <Selo>Pix · R$ 97,90</Selo>
        <h1 className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]" data-testid="funild-email-titulo">
          {existe ? "Esse e-mail já tem conta no CORE" : EMAIL_TITULO}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[#737373]">
          {existe ? <>Entre na conta de <b className="break-all text-[#262626]">{email.trim().toLowerCase()}</b> pra pagar nela. A gente não cria outra.</> : EMAIL_SUB}
        </p>

        {!existe ? (
          <>
            <label className="mt-5 block text-[13px] font-semibold text-[#737373]" htmlFor="funild-email">E-mail</label>
            <input
              id="funild-email" data-testid="funild-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              placeholder={EMAIL_PLACEHOLDER} value={email}
              onChange={(e) => onEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onEnviar(); }}
              className="mt-2 h-14 w-full rounded-2xl border border-[#E6E2DE] bg-white px-4 text-[16px] outline-none focus:border-[#333333]"
            />
            {erro && <p className="mt-2 text-[13.5px] font-semibold text-[#D22D80]" role="alert" data-testid="funild-erro">{erro}</p>}
          </>
        ) : (
          <>
            <input
              type="password" autoComplete="current-password" value={senha} onChange={(e) => onSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onEntrar(); }}
              placeholder="Sua senha do CORE" aria-label="Sua senha do CORE" data-testid="funild-senha"
              className="mt-4 h-14 w-full rounded-2xl border border-[#E6E2DE] bg-white px-4 text-[16px] outline-none focus:border-[#333333]"
            />
            {erro && <p className="mt-2 text-[13.5px] font-semibold text-[#D22D80]" role="alert" data-testid="funild-erro">{erro}</p>}
            <button type="button" onClick={onEntrar} disabled={ocupado || !senha} data-testid="funild-entrar" className="mt-3 h-14 w-full rounded-full bg-[#333333] text-[17px] font-semibold text-white disabled:opacity-60">
              {ocupado ? "Entrando…" : "Entrar e continuar"}
            </button>
            <EntrarComCodigo email={email} funil="funil_d" rotulo="Entrar com um código no e-mail" className="mt-3" onSession={onCodigo} />
            <button type="button" onClick={onOutro} className="mt-2 h-10 w-full text-[14px] text-[#737373]" data-testid="funild-outro-email">Usar outro e-mail</button>
          </>
        )}
      </div>
      {!existe && (
        <Cta onClick={onEnviar} disabled={ocupado} teste="funild-gerar" sub={<>Já tem conta? Use o mesmo e-mail. Ao continuar, você aceita os <a href="/termos" className="underline underline-offset-2">Termos</a> e a <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>.</>}>
          {ocupado ? "Gerando…" : CTA_GERAR}
        </Cta>
      )}
    </>
  );
}

export function emailInvalido(email: string): string | null {
  const em = email.trim();
  if (!em) return ERRO_EMAIL_VAZIO;
  if (!EMAIL_OK.test(em)) return ERRO_EMAIL_INVALIDO;
  return null;
}
