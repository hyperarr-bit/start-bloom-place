import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import logo from "@/assets/core-logo-black.png";
import { EMPRESA } from "@/lib/empresa";
import { BotaoLoja } from "@/pages/porta/SucessoPorta";
import {
  AVALIACOES, BANCOS, BOTAO_PIX, CHIPS, CHIPS_A_MAIS, CORES_CARD, CONFIANCA_PAGAMENTO, CONFIANCA_PREFIXO,
  CONSENTIMENTO, CTA_ESCOLHA, CTA_EXTREMO, EMOJI, EXTRATO_COMO, EXTRATO_ERRO, EXTRATO_TEXTO, EXTRATO_TITULO,
  EXTRATO_VOLTAR, EXTREMO_SUB, EXTREMO_TITULO, FAQ, GARANTIA, LINHAS_CALCULO, LINK_EMAIL, LINK_EXTRATO, META_TITULO,
  PASSOS_PLANO, PERGUNTAS, PRECO_DESTAQUE, PRECO_TEXTO, PROMESSA_Q1, RODAPE_Q1, ROTULO, SUB_PIX, SUCESSO_TITULO,
  reais, type Chave, type Pergunta,
} from "./conteudo";
import type { ResumoRaiox } from "./estimativa";
import "./raiox.css";

const SERIF: CSSProperties = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontWeight: 400 };

export function Shell({ passo, fundo, fonte, demo, reservaCta, children, cta }: {
  passo: string;
  fundo: string;
  fonte?: string;
  demo?: string;
  reservaCta?: boolean;
  children: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] text-[#262626] antialiased" style={{ background: fundo }} data-testid="raiox" data-passo={passo} data-fonte={fonte} data-demo={demo}>
      <div className="mx-auto w-full max-w-[440px] px-5" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))", paddingBottom: cta || reservaCta ? "calc(108px + env(safe-area-inset-bottom))" : "32px" }}>
        <div key={passo} className="raiox-entra">
          {children}
        </div>
      </div>
      {cta && (
        <div className="fixed inset-x-0 bottom-0 z-20" style={{ background: fundo, paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto w-full max-w-[440px] px-5 pt-2">{cta}</div>
        </div>
      )}
    </div>
  );
}

export function Logo() {
  return <img src={logo} alt="CORE" width={24} height={24} className="h-6 w-6" />;
}

export function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-testid="raiox-voltar" aria-label="Voltar" className="mb-3 inline-flex items-center gap-0.5 text-[13px] text-[#737373]">
      <ChevronLeft className="h-4 w-4" aria-hidden /> Voltar
    </button>
  );
}

export function Barra({ n }: { n: number }) {
  return (
    <div className="mb-5" data-testid="raiox-progresso">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < n ? "#D22D80" : "#E5E5E5" }} />
        ))}
      </div>
      <p className="mt-2 text-[12px] font-semibold tracking-wide text-[#737373]">{n} de 5</p>
    </div>
  );
}

export function Cta({ children, onClick, testid, sub }: { children: ReactNode; onClick: () => void; testid: string; sub?: string }) {
  return (
    <div>
      <button
        type="button" onClick={onClick} data-testid={testid}
        className="raiox-opcao h-14 w-full rounded-full bg-[#333333] text-[17px] font-semibold text-white"
      >
        {children}
      </button>
      {sub && <p className="mt-2 text-center text-[13px] text-[#737373]">{sub}</p>}
    </div>
  );
}

export function Quiz({ pergunta, selecionada, onEscolher, onVoltar }: {
  pergunta: Pergunta;
  selecionada: number | null;
  onEscolher: (faixa: number) => void;
  onVoltar?: () => void;
}) {
  const primeira = pergunta.n === 1;
  return (
    <>
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-[11px] font-bold tracking-[0.14em] text-[#737373]">{META_TITULO}</span>
      </div>
      {onVoltar && <div className="mt-3"><Voltar onClick={onVoltar} /></div>}
      <div className={primeira ? "mt-8" : "mt-4"}>
        <Barra n={pergunta.n} />
        {primeira && (
          <p data-testid="raiox-promessa" className="mb-4 text-[28px] leading-[1.15] text-[#262626]" style={SERIF}>
            {PROMESSA_Q1}
          </p>
        )}
        <h1 data-testid="raiox-pergunta" className="text-[26px] font-extrabold leading-[30px] text-[#262626]">
          {pergunta.pergunta}
        </h1>
        <div className="mt-5 flex flex-col gap-2.5">
          {pergunta.opcoes.map((op, i) => {
            const on = selecionada === i;
            return (
              <button
                key={op} type="button" onClick={() => onEscolher(i)} data-testid={`raiox-opcao-${i}`} data-selecionada={on ? "1" : "0"}
                className="raiox-opcao min-h-14 rounded-2xl border bg-white px-4 text-left text-[16px] font-semibold text-[#262626]"
                style={{ borderColor: on ? "#D22D80" : "#E5E5E5" }}
              >
                {op}
              </button>
            );
          })}
        </div>
        {primeira && <p data-testid="raiox-rodape" className="mt-6 text-center text-[13px] text-[#737373]">{RODAPE_Q1}</p>}
      </div>
    </>
  );
}

export function Calculando() {
  const [feitos, setFeitos] = useState(0);
  useEffect(() => {
    const tempos = [200, 450, 700, 950, 1200];
    const ids = tempos.map((ms, i) => window.setTimeout(() => setFeitos(i + 1), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);
  return (
    <div data-testid="raiox-calculando">
      <div className="flex items-center gap-2"><Logo /></div>
      <h1 className="mt-8 text-[26px] font-extrabold leading-[30px]">Calculando seu Raio-X…</h1>
      <ul className="mt-6 flex flex-col gap-3" aria-live="polite">
        {LINHAS_CALCULO.map((linha, i) => (
          <li key={linha} className="flex items-center gap-3 text-[16px]" data-testid={`raiox-calc-${i}`} data-feito={i < feitos ? "1" : "0"}>
            <span className="grid h-6 w-6 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: i < feitos ? "#30A65B" : "#E5E5E5" }}>
              {i < feitos ? <span className="raiox-check">✓</span> : ""}
            </span>
            {linha}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Resultado({ resumo, quando, email, onEscolha, onExtrato, onEmail, enviandoEmail }: {
  resumo: ResumoRaiox;
  quando: string;
  email: string | null;
  onEscolha: () => void;
  onExtrato: () => void;
  onEmail: (email: string) => void;
  enviandoEmail: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(email ?? "");
  const [mandou, setMandou] = useState(false);
  return (
    <div data-testid="raiox-resultado" data-extremo={resumo.extremo ? "1" : "0"} data-fonte={resumo.fonte}>
      <div className="flex items-center gap-2"><Logo /></div>
      {resumo.extremo ? (
        <>
          <h1 data-testid="raiox-extremo" className="mt-8 text-[32px] leading-[1.15]" style={SERIF}>{EXTREMO_TITULO}</h1>
          <p className="mt-2 text-[17px] text-[#262626]">{EXTREMO_SUB}</p>
          {resumo.vazou_mes > 0 && (
            <p className="mt-3 text-[14px] text-[#737373]">Sua estimativa ficou em R$ {reais(resumo.vazou_mes)} por mês.</p>
          )}
        </>
      ) : (
        <>
          <p className="mt-6 text-[12px] font-semibold tracking-wide text-[#737373]" data-testid="raiox-selo">
            Seu Raio-X · {quando} · {resumo.fonte === "extrato" ? "com os seus números" : "estimativa"}
          </p>
          <p data-testid="raiox-numero" className="mt-3 text-[60px] leading-none text-[#D22D80]" style={SERIF}>
            R$ {reais(resumo.vazou_mes)}
          </p>
          <p className="mt-1 text-[18px] text-[#262626]">por mês</p>
          <p className="mt-2 text-[15px] text-[#737373]">escapam do seu bolso sem você perceber.</p>
          <p data-testid="raiox-ano" className="mt-3 text-[17px] font-semibold">Isso dá R$ {reais(resumo.vazou_ano)} por ano.</p>
        </>
      )}
      <div className="mt-5 flex flex-col gap-2.5">
        {resumo.vazamentos.map((v, i) => (
          <article key={v.chave} data-testid={`raiox-vazamento-${v.chave}`} className="rounded-2xl px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_-16px_rgba(0,0,0,.18)]" style={{ background: CORES_CARD[i % CORES_CARD.length] }}>
            <p className="text-[15px] font-semibold">{v.emoji} {v.rotulo} · R$ {reais(v.mes)}/mês</p>
            <p className="mt-0.5 text-[13px] text-[#262626]/80">{v.dica}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-start gap-3">
        <button type="button" data-testid="raiox-link-extrato" onClick={onExtrato} className="text-left text-[13px] text-[#737373] underline underline-offset-2">
          {LINK_EXTRATO}
        </button>
        {mandou ? (
          <p className="text-[13px] text-[#30A65B]" data-testid="raiox-email-ok">Anotado. Te mando neste e-mail.</p>
        ) : aberto ? (
          <form className="flex w-full gap-2" onSubmit={(ev) => { ev.preventDefault(); onEmail(valor); setMandou(true); }}>
            <input
              type="email" required value={valor} onChange={(ev) => setValor(ev.target.value)} data-testid="raiox-email"
              placeholder="seu e-mail" aria-label="Seu e-mail" autoComplete="email"
              className="h-12 flex-1 rounded-2xl border border-[#E5E5E5] px-3 text-[15px]"
            />
            <button type="submit" data-testid="raiox-email-enviar" disabled={enviandoEmail} className="h-12 rounded-full bg-[#333] px-4 text-[14px] font-semibold text-white">
              Enviar
            </button>
          </form>
        ) : (
          <button type="button" data-testid="raiox-link-email" onClick={() => setAberto(true)} className="text-left text-[13px] text-[#737373] underline underline-offset-2">
            {LINK_EMAIL}
          </button>
        )}
      </div>
      <div className="sr-only">{CTA_ESCOLHA}</div>
      <CtaFixo testid="raiox-cta-escolha" onClick={onEscolha}>{resumo.extremo ? CTA_EXTREMO : CTA_ESCOLHA}</CtaFixo>
    </div>
  );
}

function CtaFixo({ children, onClick, testid, sub }: { children: ReactNode; onClick: () => void; testid: string; sub?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-white" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
      <div className="mx-auto w-full max-w-[440px] px-5 pt-2">
        <Cta testid={testid} onClick={onClick} sub={sub}>{children}</Cta>
      </div>
    </div>
  );
}

export function Escolha({ chaves, micro, onEscolher }: { chaves: Chave[]; micro: string | null; onEscolher: (c: Chave) => void }) {
  return (
    <div data-testid="raiox-escolha" data-fase={micro ? "micro" : "lista"}>
      <div className="flex items-center gap-2"><Logo /></div>
      {micro ? (
        <p data-testid="raiox-micro" className="mt-16 text-[28px] leading-[1.2]" style={SERIF}>Fechado 🤝 Seu plano começa pelo {micro}.</p>
      ) : (
        <>
          <h1 className="mt-8 text-[26px] font-extrabold leading-[30px]">Qual vazamento você fecha primeiro?</h1>
          <div className="mt-5 flex flex-col gap-2.5">
            {chaves.map((c, i) => (
              <button
                key={c} type="button" data-testid={`raiox-escolha-${c}`} onClick={() => onEscolher(c)}
                className="raiox-opcao min-h-14 rounded-2xl border border-[#E5E5E5] bg-white px-4 text-left text-[16px] font-semibold"
              >
                <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: CORES_CARD[i % CORES_CARD.length] }} />
                {EMOJI[c]} {ROTULO[c]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Preco({ rotulo, projecao, passos, ancoraDias, onPix }: {
  rotulo: string;
  projecao: number;
  passos: readonly string[];
  ancoraDias: number | null;
  onPix: () => void;
}) {
  const [faq, setFaq] = useState<number | null>(null);
  return (
    <div data-testid="raiox-preco">
      <div className="flex items-center gap-2"><Logo /></div>
      <h1 className="mt-6 text-[26px] font-extrabold leading-[30px]">Seu plano: fechar o {rotulo} em 30 dias</h1>
      <p data-testid="raiox-projecao" className="mt-3 text-[18px] leading-snug" style={{ ...SERIF, color: "#30A65B" }}>
        Se fechar metade, sobram R$ {reais(projecao)} no ano.
      </p>
      <ol className="mt-5 flex flex-col gap-2" data-testid="raiox-passos">
        {passos.map((p, i) => (
          <li key={p} className="rounded-2xl bg-[#F7F5F3] px-3.5 py-3 text-[15px] font-semibold">
            <span className="mr-2 text-[#D22D80]">{i + 1}</span>{p}
          </li>
        ))}
      </ol>
      <div className="mt-5" data-testid="raiox-modulos">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#737373]">16 módulos inclusos</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => <span key={c} className="rounded-full bg-[#F7F5F3] px-3 py-1 text-[13px] font-semibold">{c}</span>)}
          <span className="rounded-full bg-[#F7F5F3] px-3 py-1 text-[13px] font-semibold">+{CHIPS_A_MAIS}</span>
        </div>
      </div>
      <article className="mt-5 rounded-2xl border-2 border-[#D22D80] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_-16px_rgba(210,45,128,.35)]" data-testid="raiox-card-preco">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D22D80]">Plano anual</p>
        <p data-testid="raiox-preco-valor" className="mt-1 text-[22px] font-extrabold leading-snug">{PRECO_DESTAQUE}</p>
        <p className="mt-1 text-[14px] text-[#737373]">R$ {PRECO_TEXTO} uma vez · 1 ano de CORE</p>
        {ancoraDias != null && (
          <p data-testid="raiox-ancora" className="mt-2 text-[14px] text-[#262626]">
            Menos do que você gasta em {rotulo} em {ancoraDias} dias.
          </p>
        )}
      </article>
      <p data-testid="raiox-garantia" className="mt-4 text-[13px] leading-snug text-[#737373]">{GARANTIA}</p>
      <p data-testid="raiox-confianca" className="mt-3 text-[12px] leading-snug text-[#737373]">
        {CONFIANCA_PREFIXO} · CNPJ {EMPRESA.cnpj} · {CONFIANCA_PAGAMENTO}
      </p>
      {AVALIACOES.length > 0 && (
        <div className="mt-4 flex flex-col gap-2" data-testid="raiox-avaliacoes">
          {AVALIACOES.map((a) => (
            <blockquote key={a.nome} className="rounded-2xl bg-[#F7F5F3] px-3.5 py-3">
              <p className="text-[14px] leading-snug">“{a.texto}”</p>
              <p className="mt-1 text-[12px] text-[#737373]">{a.nome} · {a.loja}</p>
            </blockquote>
          ))}
        </div>
      )}
      <div className="mt-4" data-testid="raiox-faq">
        {FAQ.map((item, i) => (
          <div key={item.p} className="border-b border-[#E5E5E5]">
            <button type="button" className="flex w-full items-center justify-between py-3 text-left text-[15px] font-semibold" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)} data-testid={`raiox-faq-${i}`}>
              {item.p}
              <span className="text-[#737373]">{faq === i ? "–" : "+"}</span>
            </button>
            {faq === i && <p className="pb-3 text-[14px] leading-snug text-[#737373]">{item.r}</p>}
          </div>
        ))}
      </div>
      <CtaFixo testid="raiox-cta-pix" onClick={onPix} sub={SUB_PIX}>{BOTAO_PIX}</CtaFixo>
    </div>
  );
}

export function Extrato({ erro, onArquivo, onVoltar, lendo }: {
  erro: boolean;
  lendo: boolean;
  onArquivo: (file: File) => void;
  onVoltar: () => void;
}) {
  const [bancos, setBancos] = useState(false);
  return (
    <div data-testid="raiox-extrato" data-fase={erro ? "erro" : lendo ? "lendo" : "form"}>
      <div className="flex items-center gap-2"><Logo /></div>
      <Voltar onClick={onVoltar} />
      <h1 className="mt-4 text-[26px] font-extrabold leading-[30px]">{EXTRATO_TITULO}</h1>
      <p className="mt-3 text-[15px] leading-snug text-[#737373]">{EXTRATO_TEXTO}</p>
      {lendo ? (
        <p className="mt-6 text-[16px] font-semibold" data-testid="raiox-lendo">Lendo aqui no seu celular…</p>
      ) : (
        <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#E5E5E5] bg-white text-[15px] font-semibold">
          Escolher arquivo OFX ou CSV
          <input
            data-testid="raiox-arquivo" type="file" accept=".ofx,.csv,.txt" className="sr-only"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = "";
              if (f) onArquivo(f);
            }}
          />
        </label>
      )}
      {erro && (
        <div className="mt-4" role="alert">
          <p data-testid="raiox-extrato-erro" className="text-[15px] text-[#262626]">{EXTRATO_ERRO}</p>
          <button type="button" data-testid="raiox-extrato-voltar" onClick={onVoltar} className="mt-3 text-[14px] font-semibold underline underline-offset-2">
            {EXTRATO_VOLTAR}
          </button>
        </div>
      )}
      {!erro && (
        <button type="button" data-testid="raiox-extrato-voltar" onClick={onVoltar} className="mt-4 text-[14px] text-[#737373] underline underline-offset-2">
          {EXTRATO_VOLTAR}
        </button>
      )}
      <button type="button" data-testid="raiox-bancos-abrir" onClick={() => setBancos(true)} className="mt-5 block text-[14px] font-semibold text-[#262626]">
        {EXTRATO_COMO} →
      </button>
      {bancos && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/30" data-testid="raiox-bancos" role="dialog" aria-label={EXTRATO_COMO}>
          <div className="max-h-[80dvh] w-full overflow-auto rounded-t-3xl bg-white px-5 py-5">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E5E5]" />
            <h2 className="text-[18px] font-extrabold">{EXTRATO_COMO}</h2>
            <p className="mt-1 text-[13px] text-[#737373]">Nunca pedimos senha do banco. A leitura fica neste celular.</p>
            <ul className="mt-4 flex flex-col gap-3">
              {BANCOS.map((b) => (
                <li key={b.nome}>
                  <p className="text-[15px] font-semibold">{b.nome}</p>
                  <p className="text-[13px] text-[#737373]">{b.nota}</p>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-4 h-12 w-full rounded-full bg-[#333] text-[15px] font-semibold text-white" onClick={() => setBancos(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sucesso({ email, rotulo, plataforma, abrirApp, consentir, mostraConsentir, onConsentir, hrefLoja, onLoja, onAbrir }: {
  email: string | null;
  rotulo: string;
  plataforma: "ios" | "android" | "web";
  abrirApp: string | null;
  consentir: boolean;
  mostraConsentir: boolean;
  onConsentir: (v: boolean) => void;
  hrefLoja: (loja: "ios" | "android") => string;
  onLoja: (loja: "ios" | "android") => void;
  onAbrir: () => void;
}) {
  const lojas: Array<"ios" | "android"> = plataforma === "android" ? ["android", "ios"] : ["ios", "android"];
  return (
    <div data-testid="raiox-sucesso" className="text-center">
      <Confete />
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-[28px] text-white" style={{ background: "#30A65B" }} aria-hidden>✓</div>
      <h1 data-testid="raiox-sucesso-titulo" className="mt-4 text-[32px] leading-none" style={SERIF}>{SUCESSO_TITULO}</h1>
      <p className="mt-3 text-[16px] leading-snug text-[#262626]">
        Entre com <b data-testid="raiox-sucesso-email">{email}</b>. Seu desafio de {rotulo} já está te esperando.
      </p>
      {mostraConsentir && (
        <label className="mt-5 flex items-start gap-2 rounded-2xl bg-[#F7F5F3] px-3 py-3 text-left text-[14px]">
          <input data-testid="raiox-consentir" type="checkbox" checked={consentir} onChange={(ev) => onConsentir(ev.target.checked)} className="mt-1" />
          <span>{CONSENTIMENTO}</span>
        </label>
      )}
      <div className="mt-4 flex flex-col items-center">
        {abrirApp && (
          <a href={abrirApp} data-testid="raiox-abrir" onClick={onAbrir} className="inline-flex h-14 items-center justify-center rounded-full bg-[#333] px-8 text-[17px] font-semibold text-white no-underline">
            Abrir o CORE
          </a>
        )}
        {lojas.map((loja) => (
          <BotaoLoja key={loja} android={loja === "android"} href={hrefLoja(loja)} onClick={() => onLoja(loja)} testid={`raiox-loja-${loja}`} />
        ))}
      </div>
    </div>
  );
}

function Confete() {
  const pecas = [
    { x: -70, c: "#D22D80" }, { x: -36, c: "#30A65B" }, { x: 20, c: "#F0A500" }, { x: 64, c: "#D22D80" }, { x: -10, c: "#7C5CFF" },
  ];
  return (
    <div className="pointer-events-none relative mx-auto h-8 w-full" aria-hidden>
      {pecas.map((p, i) => (
        <span key={i} className="raiox-check absolute left-1/2 top-0 h-2.5 w-1.5 rounded-sm" style={{ background: p.c, marginLeft: p.x }} />
      ))}
    </div>
  );
}
