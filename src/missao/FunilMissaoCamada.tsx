import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronRight, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useUserData } from "@/hooks/use-user-data";
import { EVENTO_MISSAO_DOSES, MODULOS, lerMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { EVENTO_MISSAO_WEB, gravarMissaoWeb, lerMissaoWeb, missaoWebConvidada, type EstadoMissaoWeb } from "@/lib/missao-web";
import {
  BUMP_KIT, DOWNSELL_PRA_SEMPRE_27, LINHA_RENOVACAO, PRECO_KIT, UPSELL_PRA_SEMPRE, VALOR_OFERTA, ofertaDoPlano, preco,
  type OfertaHoje, type PlanoHoje,
} from "@/pages/hoje/conteudo";
import { PixHoje, PixIcone, type PixSalvo } from "@/pages/hoje/PixHoje";
import { TelaUpsell, proximoPosCompra, type EtapaHoje } from "@/pages/hoje/FunilHoje";
import { Confete, SeloPago } from "@/pages/hoje/UpsellAnimado";
import { EMAIL_OK } from "@/pages/hoje/conta";
import "@/pages/hoje/funil-hoje.css";
import "./missao.css";

/**
 * A CAMADA DO FUNIL DA MISSÃO (protótipo 18/10) — montada no App, só faz algo com o convidado da missão ativo.
 *
 *   1. mede: o tutorial apareceu (missao_web_tutorial) e a dose 1 terminou (missao_web_dose1 — a festa "Dia 1 de 3");
 *   2. depois que a festa fecha ("Continuar"), a OFERTA cobre o app (antes do tour da Home e do plano de amanhã):
 *      o recibo do que ela fez + o anual 27,90 (1º ano) × mensal 14,90 e o kit, iguais ao /hoje → Pix na página →
 *      upsells (pra sempre 47 → 27) → "Pronto!" + e-mail → "Continuar minha missão" → a camada some e o app segue
 *      de onde parou (tour curto da Home, plano de amanhã, intros dos módulos).
 *   "Ver o que fiz" minimiza a oferta numa faixa por cima do app; sair do módulo reabre a oferta.
 *
 * PROTÓTIPO: o Pix é SIMULADO (PixHoje simular) e a conta não é criada. Na versão de verdade o Pix abre a sessão
 * anônima (pages/hoje/conta) e o useUserData migra os guest:* pra ela sozinho — a convidada vira conta com tudo.
 */
type Etapa = "oferta" | "pix" | EtapaHoje;

const evento = (nome: string, dados: Record<string, unknown> = {}) => {
  const w = lerMissaoWeb();
  const d = { ...dados, area: w?.area ?? null, missao_session_id: w?.sessao ?? null };
  try { (window as unknown as { __eventosMissao?: unknown[] }).__eventosMissao?.push({ nome, ...d, t: Math.round(performance.now()) }); } catch { /* noop */ }
  trackEvent(nome, d);
};

const TUTORIAL_NA_TELA = "html[data-montar-financas], html[data-montar-rotina], html[data-missao-dose], [data-testid='missao-doses-festa'], [data-testid='missao-doses-passo']";

export function FunilMissaoCamada() {
  const [ativa, setAtiva] = useState(() => missaoWebConvidada());
  useEffect(() => {
    const reler = () => setAtiva(missaoWebConvidada());
    window.addEventListener(EVENTO_MISSAO_WEB, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_WEB, reler);
  }, []);
  return ativa ? <Camada /> : null;
}

function Camada() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [web, setWeb] = useState<EstadoMissaoWeb | null>(() => lerMissaoWeb());
  const [missao, setMissao] = useState<EstadoMissaoDoses | null>(() => lerMissao());
  const [festaFechou, setFestaFechou] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const rotaDaFaixa = useRef<string | null>(null);

  useEffect(() => {
    const reler = () => { setMissao(lerMissao()); setWeb(lerMissaoWeb()); };
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    window.addEventListener(EVENTO_MISSAO_WEB, reler);
    return () => { window.removeEventListener(EVENTO_MISSAO_DOSES, reler); window.removeEventListener(EVENTO_MISSAO_WEB, reler); };
  }, []);

  /* a MESMA animação em todo passo do tutorial: marca o <html> e reinicia a entrada do corpo da folha quando o passo
     (data-etapa da folha do Montar) muda — sem tocar no componente do app */
  useEffect(() => {
    document.documentElement.setAttribute("data-funil-missao", "1");
    const obs = new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        if (m.attributeName !== "data-etapa" || !(el.classList.contains("mf") || el.classList.contains("mrt"))) continue;
        const corpo = el.querySelector<HTMLElement>(".mf-corpo, .mrt-corpo");
        if (!corpo) continue;
        corpo.style.animation = "none"; void corpo.offsetWidth; corpo.style.animation = "";
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-etapa"], subtree: true });
    return () => { obs.disconnect(); document.documentElement.removeAttribute("data-funil-missao"); };
  }, []);

  /* o tutorial apareceu (1x): é o "app aberto" do funil — e a marca que a medição do Playwright espera */
  useEffect(() => {
    if (document.documentElement.hasAttribute("data-missao-tutorial")) return;
    const olhar = () => {
      if (!document.querySelector(TUTORIAL_NA_TELA)) return false;
      document.documentElement.setAttribute("data-missao-tutorial", "1");
      evento("missao_web_tutorial", { rota: window.location.pathname, ms: Math.round(performance.now()) });
      return true;
    };
    if (olhar()) return;
    const obs = new MutationObserver(() => { if (olhar()) obs.disconnect(); });
    obs.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  /* dose 1 feita (o "aha") */
  const dose1 = !!missao?.feitos[1];
  useEffect(() => {
    const w = lerMissaoWeb();
    if (!dose1 || !w || w.dose1) return;
    gravarMissaoWeb({ ...w, dose1: Date.now() });
    evento("missao_web_dose1", { modulo: missao?.modulos[0], rotulo: missao?.feitos[1]?.rotulo ?? null, segundos: Math.round((Date.now() - w.em) / 1000) });
  }, [dose1, missao]);

  /* a festa fechou? (a oferta entra DEPOIS do "Continuar", nunca por cima da comemoração) */
  useEffect(() => {
    if (!dose1 || festaFechou) return; // (pulou: não há festa — a oferta entra direto)
    const t = window.setInterval(() => {
      const festa = document.querySelector("[data-testid='missao-doses-festa']");
      const w = lerMissaoWeb();
      if (festa && w && !w.festa) {
        const texto = (festa.querySelector("[data-testid='missao-doses-festa-texto']")?.textContent ?? "").trim();
        gravarMissaoWeb({ ...w, festa: { em: Date.now(), texto } });
        evento("missao_web_festa", { segundos: Math.round((Date.now() - w.em) / 1000) });
      }
      const naTela = !!festa || document.documentElement.hasAttribute("data-missao-dose");
      if (!naTela) setFestaFechou(true);
    }, 250);
    return () => window.clearInterval(t);
  }, [dose1, festaFechou]);

  /* minimizada: sair da tela onde ela minimizou reabre a oferta */
  const chegouNaFaixa = useRef(false);
  useEffect(() => {
    if (!minimizada || !rotaDaFaixa.current) { chegouNaFaixa.current = false; return; }
    if (pathname === rotaDaFaixa.current) { chegouNaFaixa.current = true; return; }
    if (chegouNaFaixa.current) setMinimizada(false); // saiu do módulo depois de chegar nele → a oferta volta
  }, [pathname, minimizada]);

  const pagou = !!web?.pago;
  const terminou = pagou && !!web?.email;
  // pulou a dose ("Pular" no Montar / "Ainda não gastei") também chega na oferta — sem o recibo de "feito"
  const pulou = !dose1 && !!missao?.pulados?.[1];
  if (!(dose1 && festaFechou) && !pulou) return null;
  if (terminou) return null;

  if (minimizada && !pagou) {
    return (
      <div className="mo-faixa" role="region" aria-label="Ativar o CORE" data-testid="missao-faixa">
        <span>Dia 1 de 3 feito ✅<small>Ative pra seguir amanhã com o dia 2</small></span>
        <button type="button" className="mo-faixa-btn" onClick={() => { evento("missao_web_faixa_reabriu"); setMinimizada(false); }} data-testid="missao-faixa-ativar">Ativar</button>
      </div>
    );
  }

  return (
    <div className="mo-camada">
      <OfertaMissao
        missao={missao!}
        pulou={pulou}
        onMinimizar={() => {
          evento("missao_web_ver_o_que_fiz");
          const rota = MODULOS[missao!.modulos[0]].rota; // "o que fiz" = o módulo da dose, não a Home
          rotaDaFaixa.current = rota;
          setMinimizada(true);
          if (window.location.pathname !== rota) navigate(rota);
        }}
        onFim={() => { evento("missao_web_continuar"); if (window.location.pathname !== "/home") navigate("/home"); }}
      />
    </div>
  );
}

/* ───────────────────────── a oferta (o /hoje, depois do aha) ───────────────────────── */

type EstadoOferta = { etapa: Etapa; plano: PlanoHoje; kit: boolean; pix: PixSalvo | null; pagos: { oferta: OfertaHoje; orderId: string }[]; recusou: OfertaHoje[] };
const CHAVE_OFERTA = "missao-web-oferta-v1";
const lerOferta = (): EstadoOferta => {
  try { const e = JSON.parse(sessionStorage.getItem(CHAVE_OFERTA) || "null"); if (e && e.etapa) return e; } catch { /* noop */ }
  return { etapa: "oferta", plano: "anual", kit: false, pix: null, pagos: [], recusou: [] };
};

function OfertaMissao({ missao, pulou, onMinimizar, onFim }: { missao: EstadoMissaoDoses; pulou: boolean; onMinimizar: () => void; onFim: () => void }) {
  const { get } = useUserData();
  const [e, setE] = useState<EstadoOferta>(lerOferta);
  const set = useCallback((f: (x: EstadoOferta) => EstadoOferta) => setE((x) => { const n = f(x); try { sessionStorage.setItem(CHAVE_OFERTA, JSON.stringify(n)); } catch { /* noop */ } return n; }), []);
  const ir = (etapa: Etapa, extra: Partial<EstadoOferta> = {}) => set((x) => ({ ...x, ...extra, etapa }));
  const ids = useCallback(() => { const w = lerMissaoWeb(); return { missao_session_id: w?.sessao ?? null, area: w?.area ?? null }; }, []);

  useEffect(() => { evento(e.etapa === "oferta" ? "missao_web_oferta_view" : "missao_web_etapa", { etapa: e.etapa }); }, [e.etapa]);

  const oferta = ofertaDoPlano(e.plano, e.kit);
  const valor = VALOR_OFERTA[oferta];
  const modulo = missao.modulos[0];
  const cfg = MODULOS[modulo];
  const amanha = MODULOS[missao.modulos[1]];
  const recibo = reciboDoDia(modulo, missao.feitos[1]?.rotulo ?? "", get, lerMissaoWeb()?.festa?.texto ?? "");

  const aoPagar = (p: PixSalvo) => {
    if (e.pagos.some((x) => x.orderId === p.orderId)) return;
    const pagos = [...e.pagos, { oferta: p.oferta, orderId: p.orderId }];
    evento("missao_web_pago", { oferta: p.oferta, valor: VALOR_OFERTA[p.oferta] });
    const w = lerMissaoWeb();
    if (w) gravarMissaoWeb({ ...w, pago: { em: Date.now(), ofertas: pagos.map((x) => x.oferta) } });
    const prox = proximoPosCompra({ pagos: pagos.map((x) => ({ ...x, em: Date.now() })), recusou: e.recusou, parceiro: null }, false);
    set((x) => ({ ...x, pagos, pix: null, etapa: prox }));
  };
  const upsell = (o: OfertaHoje, sim: boolean) => {
    evento("missao_web_upsell", { oferta: o, acao: sim ? "aceitou" : "recusou" });
    if (sim) { ir(o === "hv47" ? "up1pix" : "downpix", { pix: null }); return; }
    set((x) => { const recusou = [...new Set([...x.recusou, o])]; return { ...x, recusou, pix: null, etapa: proximoPosCompra({ pagos: x.pagos.map((p) => ({ ...p, em: 0 })), recusou, parceiro: null }, false) }; });
  };
  const ultimo = e.pagos[e.pagos.length - 1];
  const confirmado = ultimo ? <div className="fn-confirmado"><Check size={15} strokeWidth={3} />Pagamento confirmado · {preco(VALOR_OFERTA[ultimo.oferta])}</div> : null;
  const total = e.pagos.reduce((s, p) => s + VALOR_OFERTA[p.oferta], 0);
  const praSempre = e.pagos.some((p) => p.oferta === "hv47" || p.oferta === "hv27");

  return (
    <div className={e.etapa === "up1" || e.etapa === "down" || e.etapa === "pago" ? "fn ua" : "fn"} data-testid="missao-oferta" data-etapa={e.etapa}>
      <div className="fn-corpo">
        {e.etapa === "oferta" && (
          <div className="fn-tela" key="oferta">
            <div className="fn-topo">
              <span className="fn-marca"><i />CORE</span>
              <button type="button" className="mo-ver" onClick={onMinimizar} data-testid="missao-ver">Ver o que fiz</button>
            </div>
            {!pulou && (
              <div className="mo-recibo" data-testid="missao-recibo">
                <div className="mo-recibo-tit"><Check size={14} strokeWidth={3.2} />Dia 1 de 3 feito · {cfg.emoji} {cfg.nome}</div>
                <ul>{recibo.map((t) => <li key={t}><Check size={15} strokeWidth={3} /><span>{t}</span></li>)}</ul>
              </div>
            )}
            <div className="mo-oferta-h1">
              <h1>Ative seu CORE pra continuar</h1>
              <p>{pulou ? `Seu plano de 3 dias começa por ${cfg.emoji} ${cfg.nome}, no seu ritmo.` : "O que você fez fica salvo na sua conta."}</p>
            </div>
            <div className="fn-planos" role="radiogroup" aria-label="Plano" style={{ paddingTop: 14 }}>
              <button type="button" className="fn-plano" aria-pressed={e.plano === "anual"} data-testid="missao-plano-anual" onClick={() => set((x) => ({ ...x, plano: "anual" }))}>
                <span className="fn-plano-selo">MELHOR PREÇO</span>
                <span className="fn-plano-nome">ANUAL<i>{e.plano === "anual" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>27,90</span>
                <span className="fn-plano-sub">1º ano, no Pix</span>
                <span className="fn-plano-mes">R$ 2,33/mês</span>
              </button>
              <button type="button" className="fn-plano" aria-pressed={e.plano === "mensal"} data-testid="missao-plano-mensal" onClick={() => set((x) => ({ ...x, plano: "mensal" }))}>
                <span className="fn-plano-nome">MENSAL<i>{e.plano === "mensal" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>14,90</span>
                <span className="fn-plano-sub">30 dias, no Pix</span>
                <span className="fn-plano-mes" data-cinza="">= R$ 178,80/ano</span>
              </button>
            </div>
            <div className="mo-amanha" data-testid="missao-amanha">
              <span>Amanhã: <b>{amanha.emoji} {amanha.nome}</b> · dia 2</span>
              <span className="mo-amanha-dias" aria-hidden><i data-on="" /><i /><i /></span>
            </div>
            {BUMP_KIT && (
              <button type="button" className="fn-postit" aria-pressed={e.kit} data-testid="missao-bump" onClick={() => set((x) => ({ ...x, kit: !x.kit }))}>
                <span className="fn-caixa">{e.kit && <Check size={15} strokeWidth={3.2} />}</span>
                <span className="fn-postit-txt">
                  <b>+ Kit Primeiro Mês Organizado</b>
                  <span>Plano de 30 dias dentro do seu CORE, planilha de dívidas e os desafios das 4 semanas.</span>
                </span>
                <span className="fn-postit-preco">+ {preco(PRECO_KIT)}</span>
              </button>
            )}
            <div className="fn-rodape" style={{ marginTop: 14 }}>
              <div className="fn-garantia-linha"><ShieldCheck size={15} strokeWidth={2.4} />Garantia de 7 dias: não gostou, devolvemos tudo</div>
              <button type="button" className="fn-cta" onClick={() => { evento("missao_web_pagar", { plano: e.plano, kit: e.kit, valor }); ir("pix", { pix: e.pix && e.pix.oferta === oferta ? e.pix : null }); }} data-testid="missao-pagar">
                <PixIcone /><span>Pagar {preco(valor)} com Pix</span>
              </button>
              <p className="fn-renova">{LINHA_RENOVACAO[e.plano]}</p>
            </div>
          </div>
        )}

        {e.etapa === "pix" && (
          <PixHoje simular oferta={oferta} valor={valor} rotulo={`${e.plano === "anual" ? "1º ano do CORE" : "30 dias de CORE"}${e.kit ? " + Kit Primeiro Mês" : ""}`}
            pix={e.pix} onPix={(p) => set((x) => ({ ...x, pix: p }))} onPago={aoPagar} onVoltar={() => ir("oferta")} ids={ids} />
        )}

        {e.etapa === "up1" && UPSELL_PRA_SEMPRE && (
          <TelaUpsell testid="missao-up1" confirmado={confirmado} kicker="Só pra quem acabou de entrar"
            titulo={e.plano === "anual" ? "Troque o 1º ano pelo CORE pra sempre" : "Troque os 30 dias pelo CORE pra sempre"}
            texto="Pague uma vez e nunca mais renove. Tudo que o CORE ganhar daqui pra frente já é seu."
            nome="CORE pra sempre" valor={VALOR_OFERTA.hv47} prefixo="+ " itens={["Acesso vitalício às 16 áreas", "No iPhone, no Android e no computador"]}
            visual="grafico" plano={e.plano} cta={`Quero o CORE pra sempre · ${preco(VALOR_OFERTA.hv47)}`}
            onSim={() => upsell("hv47", true)} onNao={() => upsell("hv47", false)} />
        )}
        {e.etapa === "down" && DOWNSELL_PRA_SEMPRE_27 && (
          <TelaUpsell testid="missao-down" confirmado={confirmado} kicker="Última chance"
            titulo={`O CORE pra sempre por ${preco(VALOR_OFERTA.hv27)} — só agora`}
            texto={`Em vez de ${preco(VALOR_OFERTA.hv47)}, o mesmo acesso pra sempre por ${preco(VALOR_OFERTA.hv27)}. Esta oferta não aparece de novo depois desta tela.`}
            nome="CORE pra sempre" valor={VALOR_OFERTA.hv27} prefixo="+ " riscado={VALOR_OFERTA.hv47}
            itens={["Acesso vitalício às 16 áreas", "Nunca mais renova, nunca mais paga"]} visual="etiqueta"
            cta={`Quero por ${preco(VALOR_OFERTA.hv27)}`} onSim={() => upsell("hv27", true)} onNao={() => upsell("hv27", false)} />
        )}
        {(e.etapa === "up1pix" || e.etapa === "downpix") && (() => {
          const o: OfertaHoje = e.etapa === "up1pix" ? "hv47" : "hv27";
          return <PixHoje simular key={o} oferta={o} valor={VALOR_OFERTA[o]} rotulo="CORE pra sempre" pix={e.pix} onPix={(p) => set((x) => ({ ...x, pix: p }))} onPago={aoPagar} onVoltar={() => ir(o === "hv47" ? "up1" : "down", { pix: null })} ids={ids} />;
        })()}

        {(e.etapa === "pago" || e.etapa === "parceiro" || e.etapa === "up2" || e.etapa === "up2pix") && (
          <TelaPagoMissao total={total} praSempre={praSempre} plano={e.plano} modulo={`${cfg.emoji} ${cfg.nome}`} onFim={onFim} />
        )}
      </div>
    </div>
  );
}

function TelaPagoMissao({ total, praSempre, plano, modulo, onFim }: { total: number; praSempre: boolean; plano: PlanoHoje; modulo: string; onFim: () => void }) {
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const acesso = praSempre ? "pra sempre" : plano === "anual" ? "por 1 ano" : "por 30 dias";
  const salvar = async () => {
    setSalvando(true);
    // PROTÓTIPO: na versão de verdade é o salvarEmailDaCompra do /hoje (a conta anônima do Pix ganha o e-mail;
    // e-mail que já tem conta → código no e-mail + pix-vincular). Aqui só fica neste navegador.
    await new Promise((r) => window.setTimeout(r, 500));
    const w = lerMissaoWeb();
    if (w) gravarMissaoWeb({ ...w, email: email.trim().toLowerCase() });
    evento("missao_web_email", {});
    onFim();
  };
  return (
    <div className="fn-tela" key="pago" data-testid="missao-pago">
      <Confete />
      <div className="fn-pago">
        <SeloPago />
        <h1 className="ua-entra" style={{ animationDelay: ".5s" }}>Pronto! Seu CORE é seu.</h1>
        <p className="ua-entra" style={{ animationDelay: ".65s" }}>{preco(Math.round(total * 100) / 100)} recebido · acesso {acesso}</p>
      </div>
      <div className="fn-folha fn-salvo ua-entra" style={{ animationDelay: ".85s" }}>
        <div className="fn-faixa-sec">Dia 1 salvo · {modulo}</div>
        <div className="fn-email">
          <label htmlFor="missao-email">Seu e-mail, pra entrar no celular e no computador</label>
          <input id="missao-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com"
            value={email} onChange={(ev) => setEmail(ev.target.value)} data-testid="missao-email" />
          <p>Sem senha: você entra com um código no e-mail.</p>
        </div>
      </div>
      <div className="fn-rodape">
        <button type="button" className="fn-cta" disabled={!EMAIL_OK.test(email.trim()) || salvando} onClick={() => { void salvar(); }} data-testid="missao-continuar">
          <span>{salvando ? "Salvando…" : "Continuar minha missão"}</span>{!salvando && <ChevronRight size={18} strokeWidth={2.6} />}
        </button>
      </div>
    </div>
  );
}

/** O recibo do dia 1, com o que ela fez de verdade (lido do guest:* pelo useUserData). */
function reciboDoDia(modulo: string, rotuloDoMontar: string, get: <T>(k: string, f: T) => T, textoDaFesta: string): string[] {
  // o número da FESTA (depois do 1º gasto) vence o do Montar (antes dele): "Pode gastar R$ 131 por dia"
  const porDia = textoDaFesta.match(/R\$\s?[\d.]+ por dia/)?.[0];
  const rotulo = modulo === "financas" && porDia ? `Pode gastar ${porDia}` : rotuloDoMontar;
  const n = (k: string) => { try { const v = get<unknown>(k, []); return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v as object).length : 0; } catch { return 0; } };
  const linhas: string[] = [];
  if (modulo === "financas") {
    if (n("finance-incomes") || n("finance-fixed-expenses")) linhas.push(`Renda e ${n("finance-fixed-expenses") || "as"} contas do mês montadas`);
    if (rotulo) linhas.push(rotulo);
    if (n("finance-expenses")) linhas.push("1º gasto anotado");
  } else if (modulo === "rotina") {
    if (n("rotina-habits")) linhas.push(`Rotina montada · ${n("rotina-habits")} hábitos`);
    if (rotulo) linhas.push(`1º marcado hoje: ${rotulo}`);
  } else if (modulo === "treino") {
    linhas.push("Treino da semana escolhido");
    if (rotulo) linhas.push(rotulo);
  } else {
    if (rotulo) linhas.push(rotulo);
    else linhas.push("1ª meta escrita");
  }
  return linhas.length ? linhas : ["Primeiro passo feito"];
}

export default FunilMissaoCamada;
