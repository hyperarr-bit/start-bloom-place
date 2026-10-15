import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, CreditCard, Loader2, Lock, QrCode, ShieldCheck } from "lucide-react";
import { BotaoCard, MAGENTA, TituloCard } from "@/pages/porta/telas";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import {
  BENEFICIOS, BOTAO_CARTAO, BOTAO_GERAR_PIX, BOTAO_IR_CARTAO, BOTAO_PIX, DADOS_SUB, DADOS_TITULO, GARANTIA, LINHA_CARTAO,
  MENSAL_LINHA, MONTADO_CTA, MONTADO_SELO, MONTADO_TITULO, PAYWALL_SUB, PAYWALL_TITULO, PLANOS, SELO_ANUAL, porMes,
  type MetodoVenda, type PlanoVenda,
} from "./conteudo";
import { EMAIL_OK } from "./conta";

/**
 * As telas da venda (/assinar, 15/10) DENTRO do card da Porta v5 (mesmo topo/card/botão grafite, magenta nos
 * detalhes, Inter herdada): o plano montado, o paywall, nome + e-mail e o "indo pro cartão"/"confirmando".
 * O Pix (PixVenda) e o sucesso (SucessoVenda) moram nos arquivos deles.
 */

/* ------------------------------------------------------------------ plano montado */
export function PlanoMontado({ dias, motivo, onContinuar }: {
  dias: { dia1: string; dia2: string; dia3: string };
  motivo: string | null;
  onContinuar: () => void;
}) {
  const linhas = [dias.dia1, dias.dia2, dias.dia3];
  return (
    <div className="mt-6" data-testid="venda-montado">
      <p className="text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: MAGENTA }}>{MONTADO_SELO}</p>
      <TituloCard testid="venda-montado-titulo" className="mt-1">{MONTADO_TITULO}</TituloCard>
      {motivo && <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]">Feito pra quem: <b className="text-[#16121c]">{motivo.toLowerCase()}</b>.</p>}
      <ol className="mt-4 flex flex-col gap-2.5" data-testid="venda-dias">
        {linhas.map((t, i) => (
          <li key={i} className="flex items-start gap-3 rounded-[12px] border border-[#ebe8ee] bg-[#faf9fb] px-3.5 py-3">
            <span className="shrink-0 mt-[1px] grid place-items-center w-[26px] h-[26px] rounded-full text-white text-[12.5px] font-black" style={{ background: i === 0 ? MAGENTA : "#16121c" }}>{i + 1}</span>
            <span className="text-[15px] leading-snug text-[#16121c]"><b className="block text-[12px] uppercase tracking-[0.08em] text-[#8a8490] font-bold">Dia {i + 1}</b>{t}</span>
          </li>
        ))}
      </ol>
      <BotaoCard texto={MONTADO_CTA} onClick={onContinuar} testid="venda-montado-cta" className="mt-5" />
    </div>
  );
}

/* ------------------------------------------------------------------ paywall */
const Beneficio = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-2.5 text-[14.5px] leading-snug text-[#3d3842]">
    <span className="shrink-0 mt-[2px] grid place-items-center w-[18px] h-[18px] rounded-full text-white" style={{ background: MAGENTA }} aria-hidden>
      <Check className="w-3 h-3" strokeWidth={3.4} />
    </span>
    <span>{children}</span>
  </li>
);

export function PaywallVenda({ temCartaoAnual, temMensal, onEscolher }: {
  /** o link da oferta anual da Cakto existe (senão o anual é só Pix) */
  temCartaoAnual: boolean;
  /** o link do mensal existe (senão a linha do mensal não aparece) */
  temMensal: boolean;
  onEscolher: (plano: PlanoVenda, metodo: MetodoVenda) => void;
}) {
  const anual = PLANOS.anual;
  const mensal = PLANOS.mensal;
  return (
    <div className="mt-6" data-testid="venda-paywall">
      <TituloCard testid="venda-paywall-titulo">{PAYWALL_TITULO}</TituloCard>
      <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]">{PAYWALL_SUB}</p>

      <div className="relative mt-5 rounded-[16px] border-2 bg-white px-4 pt-4 pb-4" style={{ borderColor: MAGENTA }} data-testid="venda-plano-anual" data-destaque="">
        <span className="absolute -top-[11px] right-4 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold uppercase tracking-[0.08em] text-white" style={{ background: MAGENTA }} data-testid="venda-selo-anual">{SELO_ANUAL}</span>
        <p className="text-[15px] font-bold text-[#16121c]">{anual.nome}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[32px] font-extrabold tracking-[-0.03em] leading-none text-[#16121c]" data-testid="venda-preco-anual">R$ {anual.preco}</span>
          <span className="text-[14px] text-[#6b6670]">{anual.periodo}</span>
        </p>
        <p className="mt-1 text-[14px] text-[#6b6670]" data-testid="venda-por-mes">equivale a <b className="text-[#16121c]">R$ {porMes(anual.valor)}/mês</b> <span className="whitespace-nowrap">· 1 ano de acesso</span></p>
        <BotaoCard
          texto={BOTAO_PIX} onClick={() => onEscolher("anual", "pix")} testid="venda-anual-pix" className="mt-4"
          icone={<QrCode className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden />}
        />
        {temCartaoAnual && (
          <>
            <button
              type="button" onClick={() => onEscolher("anual", "cartao")} data-testid="venda-anual-cartao"
              className="mt-2.5 w-full h-[52px] rounded-[12px] border border-[#d9d5dd] bg-white flex items-center justify-center gap-2 text-[16px] font-semibold text-[#16121c] active:bg-[#f5f3f7] active:scale-[.985] transition-transform"
            >
              <CreditCard className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden />{BOTAO_CARTAO}
            </button>
            <p className="mt-2 text-center text-[12.5px] text-[#8a8490]">{LINHA_CARTAO}</p>
          </>
        )}
      </div>

      <ul className="mt-5 flex flex-col gap-2.5" data-testid="venda-beneficios">
        {BENEFICIOS.map((b) => <Beneficio key={b}>{b}</Beneficio>)}
      </ul>

      {temMensal && (
        <button
          type="button" onClick={() => onEscolher("mensal", "cartao")} data-testid="venda-plano-mensal"
          className="mt-5 w-full flex items-center gap-3 rounded-[12px] border border-[#e3e0e6] bg-white px-4 py-3 text-left active:bg-[#f5f3f7]"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-semibold text-[#16121c]">{mensal.nome} · R$ {mensal.preco}/mês</span>
            <span className="block mt-0.5 text-[12.5px] text-[#8a8490]">Só no cartão. {MENSAL_LINHA}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#8a8490]" aria-hidden />
        </button>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-[#8a8490]" data-testid="venda-garantia">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden />{GARANTIA}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ nome + e-mail */
const CAMPO = "w-full h-[52px] rounded-[12px] border bg-white px-4 text-[16px] text-[#16121c] outline-none focus:border-[#16121c] placeholder:text-[#a9a3af]";

export type ResultadoDados = { ok: true } | { ok: false; existe?: boolean; erro?: string };

export function DadosVenda({ plano, metodo, nomeInicial, emailInicial, emailLogado, onEnviar, onEntrarSenha, onEntrouCodigo, onTrocarPlano, onErroCampo }: {
  plano: PlanoVenda;
  metodo: MetodoVenda;
  nomeInicial: string;
  emailInicial: string;
  /** já entrou neste navegador (conta com e-mail) */
  emailLogado: string | null;
  onEnviar: (nome: string, email: string) => Promise<ResultadoDados>;
  onEntrarSenha: (email: string, senha: string, nome: string) => Promise<boolean>;
  onEntrouCodigo: (nome: string, email: string) => Promise<void>;
  onTrocarPlano: () => void;
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
  const p = PLANOS[plano];
  const textoBotao = metodo === "pix" ? BOTAO_GERAR_PIX : BOTAO_IR_CARTAO;

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
        const f = r as { existe?: boolean; erro?: string };
        if (f.existe) { setExiste(true); return; }
        setErro(f.erro ?? "Não consegui seguir agora. Tenta de novo.");
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

  const girando = <Loader2 className="w-5 h-5 animate-spin" aria-label="Carregando" />;

  return (
    <div className="mt-6" data-testid="venda-dados" data-fase={existe ? "existe" : "form"}>
      <TituloCard testid="venda-dados-titulo">{existe ? "Esse e-mail já tem conta no CORE" : DADOS_TITULO}</TituloCard>
      <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]">
        {existe ? <>Entre na conta de <b className="text-[#16121c] break-all">{email.trim().toLowerCase()}</b> pra pagar nela.</> : DADOS_SUB}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-[#ebe8ee] bg-[#faf9fb] px-3.5 py-2.5" data-testid="venda-resumo">
        <span className="text-[14px] text-[#16121c]">
          <b>{p.nome}</b> · R$ {p.preco}{plano === "mensal" ? "/mês" : ""} · {metodo === "pix" ? "Pix" : "cartão"}
        </span>
        <button type="button" onClick={onTrocarPlano} className="text-[13.5px] font-semibold underline underline-offset-2 text-[#16121c]" data-testid="venda-trocar-plano">Trocar</button>
      </div>

      {!existe ? (
        <>
          <div className="mt-4 flex flex-col gap-2.5">
            <div>
              <input
                ref={refNome} type="text" autoComplete="name" value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Seu nome"
                aria-label="Seu nome" data-testid="venda-nome" className={`${CAMPO} ${erros.nome ? "border-[#e5484d]" : "border-[#e3e0e6]"}`}
              />
              {erros.nome && <p className="text-[13px] font-semibold text-[#b42318] mt-1 ml-1" role="alert" data-testid="venda-erro-nome">{erros.nome}</p>}
            </div>
            <div>
              <input
                ref={refEmail} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                value={email} onChange={(ev) => setEmail(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") void enviar(); }}
                placeholder="Seu e-mail" aria-label="Seu e-mail" data-testid="venda-email"
                className={`${CAMPO} ${erros.email ? "border-[#e5484d]" : "border-[#e3e0e6]"}`}
              />
              {erros.email && <p className="text-[13px] font-semibold text-[#b42318] mt-1 ml-1" role="alert" data-testid="venda-erro-email">{erros.email}</p>}
            </div>
          </div>
          {emailLogado && email.trim().toLowerCase() === emailLogado.toLowerCase() && (
            <p className="mt-2 ml-1 text-[13px] text-[#6b6670]" data-testid="venda-logado">Você já entrou com este e-mail neste aparelho.</p>
          )}
          {erro && <p className="text-[13px] text-[#b42318] mt-3" role="alert" data-testid="venda-erro">{erro}</p>}
          <BotaoCard
            texto={ocupado ? girando : textoBotao} onClick={() => { void enviar(); }} disabled={ocupado} testid="venda-dados-cta" className="mt-4"
            icone={ocupado ? undefined : <Lock className="w-4 h-4" strokeWidth={2.4} aria-hidden />}
          />
          <p className="text-[12.5px] text-[#8a8490] mt-3 leading-snug text-center">
            Já tem conta no CORE? Use o mesmo e-mail.<br />
            Ao continuar, você aceita os <a href="/termos" className="underline underline-offset-2">Termos</a> e a <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>.
          </p>
        </>
      ) : (
        <>
          <input
            type="password" autoComplete="current-password" value={senha} onChange={(ev) => setSenha(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") void entrar(); }} placeholder="Sua senha do CORE" aria-label="Sua senha do CORE"
            data-testid="venda-senha" className={`${CAMPO} mt-4 border-[#e3e0e6]`}
          />
          {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert" data-testid="venda-erro">{erro}</p>}
          <BotaoCard texto={ocupado ? girando : "Entrar e continuar"} onClick={() => { void entrar(); }} disabled={ocupado || !senha} testid="venda-entrar" className="mt-3" />
          <EntrarComCodigo
            email={email} funil="venda_web" rotulo="Entrar com um código no e-mail" className="mt-3"
            onSession={() => { void onEntrouCodigo(nome.trim(), email.trim()); }}
          />
          <button type="button" onClick={() => { setExiste(false); setSenha(""); setErro(null); }} className="mt-1 w-full h-10 text-[14px] text-[#6b6670]" data-testid="venda-outro-email">
            Usar <b className="text-[#16121c]">outro e-mail</b>
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ cartão: indo / confirmando na volta */
export function CartaoVenda({ fase, plano, urlCakto, onAbrirDeNovo, onTrocarPraPix }: {
  /** "indo": o redirect vai sair; "voltou": a pessoa voltou (ou a Cakto mandou pra página de obrigado) */
  fase: "indo" | "voltou";
  plano: PlanoVenda;
  urlCakto: string | null;
  onAbrirDeNovo: () => void;
  onTrocarPraPix: (() => void) | null;
}) {
  const [devagar, setDevagar] = useState(false);
  useEffect(() => {
    if (fase !== "voltou") return;
    const t = window.setTimeout(() => setDevagar(true), 20_000);
    return () => window.clearTimeout(t);
  }, [fase]);
  const p = PLANOS[plano];
  if (fase === "indo") {
    return (
      <div className="pt-8 pb-4 text-center" data-testid="venda-cartao" data-fase="indo">
        <Loader2 className="mx-auto w-8 h-8 animate-spin text-[#16121c]" aria-hidden />
        <TituloCard testid="venda-cartao-titulo" className="mt-4">Abrindo o pagamento seguro…</TituloCard>
        <p className="mt-2 text-[15px] leading-snug text-[#6b6670]">{p.nome} · R$ {p.preco}{plano === "mensal" ? "/mês" : ""} no cartão. O pagamento é feito na Cakto, com o seu e-mail já preenchido.</p>
        {urlCakto && (
          <a href={urlCakto} onClick={onAbrirDeNovo} className="mt-4 inline-flex h-10 items-center text-[14px] text-[#6b6670] no-underline" data-testid="venda-cartao-link">
            <span>Não abriu? <b className="text-[#16121c]">Toque aqui</b></span>
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="pt-6 pb-2 text-center" data-testid="venda-cartao" data-fase="voltou">
      <Loader2 className="mx-auto w-8 h-8 animate-spin text-[#16121c]" aria-hidden />
      <TituloCard testid="venda-cartao-titulo" className="mt-4">Confirmando seu pagamento</TituloCard>
      <p className="mt-2 text-[15px] leading-snug text-[#6b6670]">Assim que o cartão aprovar, seu CORE libera aqui sozinho.</p>
      {devagar && <p className="mt-2 text-[13.5px] text-[#8a8490]" data-testid="venda-cartao-devagar">Está demorando? O cartão pode levar alguns minutos. Você também recebe a confirmação no e-mail.</p>}
      {urlCakto && (
        <a href={urlCakto} onClick={onAbrirDeNovo} className="mt-5 flex items-center justify-center h-11 text-[14.5px] text-[#16121c] font-semibold no-underline rounded-[12px] border border-[#e3e0e6]" data-testid="venda-cartao-de-novo">
          Ainda não paguei · abrir o pagamento
        </a>
      )}
      {onTrocarPraPix && (
        <button type="button" onClick={onTrocarPraPix} className="mt-2 w-full h-10 text-[14px] text-[#6b6670]" data-testid="venda-cartao-pix">
          Prefiro pagar com <b className="text-[#16121c]">Pix</b>
        </button>
      )}
    </div>
  );
}
