import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isInAppBrowser } from "@/lib/funnel";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao } from "@/pages/porta/atribuicao";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import type { Plataforma } from "@/pages/porta/SucessoPorta";
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "@/pages/venda/conta";
import { PLANOS } from "@/pages/venda/conteudo";
import { PixVenda, type PixGerado, type PixPago } from "@/pages/venda/PixVenda";
import { eventoMeta, novoEventId, sessaoDaVenda } from "@/pages/venda/rastreio";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import {
  calcularDia, centavosDe, precoAceito, reaisSolto, salarioAceito, traduzir, type ContaDaHora, type Jornada, type Traducao,
} from "./horas";
import { ERRO_SALARIO, URL_QR } from "./conteudo";
import { Email, Entrada, Moldura, Plano, Resultado, Topo, emailInvalido } from "./telas";
import "./funil-d.css";

/**
 * /funil-d — o preço da hora. Um número (o salário) e a conta da CLT.
 * Pix anual a97 reusa o PixVenda. A cerca de domínio mora em CercaFunilD.
 */

type Passo = "entrada" | "resultado" | "plano" | "email" | "pix" | "sucesso";

type Estado = {
  passo: Passo;
  salarioTexto: string;
  salarioCentavos: number | null;
  jornada: Jornada;
  precoTexto: string;
  precoCentavos: number | null;
  email: string | null;
  pix: PixGerado | null;
  jaAssinante: boolean;
  fim: string | null;
  codigo: string | null;
  emailEnviado: boolean;
};

const CHAVE = "funild-estado";
const PASSOS: Passo[] = ["entrada", "resultado", "plano", "email", "pix", "sucesso"];
let memoria: Estado | null = null;

const vazio = (): Estado => ({
  passo: "entrada", salarioTexto: "", salarioCentavos: null, jornada: "44h", precoTexto: "", precoCentavos: null,
  email: null, pix: null, jaAssinante: false, fim: null, codigo: null, emailEnviado: false,
});

function lerEstado(): Estado | null {
  if (memoria) return memoria;
  try {
    const raw = sessionStorage.getItem(CHAVE);
    if (!raw) return null;
    const e = JSON.parse(raw) as Estado;
    if (!e || !PASSOS.includes(e.passo)) return null;
    memoria = e;
    return e;
  } catch { return null; }
}

function gravar(e: Estado): void {
  memoria = e;
  try { sessionStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* a memória segura */ }
}

export function _zerarFunilD(): void {
  memoria = null;
  try { sessionStorage.removeItem(CHAVE); } catch { /* noop */ }
}

const plataformaDaWeb = (): Plataforma => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};

const dataBr = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getFullYear() > 2100) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
};

export default function FunilD() {
  const { user, loading: authLoading, isSubscribed } = useAuth();
  const inicio = useRef<{ sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    capturarAtribuicao();
    const s = sessaoDaVenda();
    inicio.current = { sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao(), sessao);
    return { funil: "d", venda_session_id: sessao, ...resto };
  }, [sessao]);

  const [estado, setEstadoCru] = useState<Estado>(() => lerEstado() ?? vazio());
  const setEstado = useCallback((f: (e: Estado) => Estado) => {
    setEstadoCru((e) => { const n = f(e); gravar(n); return n; });
  }, []);
  const ref = useRef(estado);
  ref.current = estado;
  const ir = (passo: Passo, extra: Partial<Estado> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));

  const plataforma = useMemo(plataformaDaWeb, []);
  const hoje = useMemo(() => new Date(), []);
  const conta: ContaDaHora | null = estado.salarioCentavos ? calcularDia(estado.salarioCentavos, estado.jornada, hoje) : null;
  const traducao: Traducao | null = conta && estado.precoCentavos ? traduzir(estado.precoCentavos, conta) : null;

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-funild", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Quanto vale a sua hora";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  useEffect(() => {
    if (!inicio.current?.nova) return;
    const a = lerAtribuicao();
    trackEvent("funild_view", { atribuicao: a?.origem ?? "nenhuma", plataforma, in_app: isInAppBrowser(), ...ids() });
    eventoMeta("ViewContent", novoEventId("vc"), { content_name: "funil_d", content_category: "funil_d" }, a?.fbc || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [estado.passo]);

  const visto = useRef<Passo | null>(null);
  useEffect(() => {
    if (visto.current === estado.passo) return;
    visto.current = estado.passo;
    if (estado.passo === "entrada") return;
    const c = ref.current.salarioCentavos ? calcularDia(ref.current.salarioCentavos, ref.current.jornada, hoje) : null;
    const base = c ? { faixa: c.faixa, jornada: c.jornada, dias_restantes: c.restantes } : {};
    trackEvent("funild_passo", { passo: estado.passo, ...base, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  const [erroSalario, setErroSalario] = useState<string | null>(null);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [existe, setExiste] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [senha, setSenha] = useState("");
  const [faq, setFaq] = useState<number | null>(null);
  const traduziuFaixa = useRef<string | null>(null);

  const onVer = () => {
    const c = centavosDe(estado.salarioTexto);
    if (!salarioAceito(c)) { setErroSalario(ERRO_SALARIO); return; }
    setErroSalario(null);
    const contaNova = calcularDia(c, ref.current.jornada, hoje);
    trackEvent("funild_salario", { faixa: contaNova?.faixa, jornada: ref.current.jornada, ...ids() });
    ir("resultado", { salarioCentavos: c });
  };

  const onPreco = (texto: string) => {
    const c = centavosDe(texto);
    const ok = precoAceito(c) ? c : null;
    setEstado((e) => ({ ...e, precoTexto: texto, precoCentavos: ok }));
    if (ok && conta) {
      const t = traduzir(ok, conta);
      if (t && traduziuFaixa.current !== t.faixa) {
        traduziuFaixa.current = t.faixa;
        trackEvent("funild_traduziu", { faixa_preco: t.faixa, ...ids() });
      }
    }
  };

  const onExemplo = (centavos: number) => {
    const texto = reaisSolto(centavos).replace(/^R\$\s?/, "");
    onPreco(texto);
  };

  const onJornada = (j: Jornada) => {
    trackEvent("funild_jornada", { jornada: j, ...ids() });
    setEstado((e) => ({ ...e, jornada: j }));
  };

  const montarVenda = (): VendaNaConta => {
    const e = ref.current;
    const c = e.salarioCentavos ? calcularDia(e.salarioCentavos, e.jornada, hoje) : null;
    return {
      v: 1,
      attr: capturarAtribuicao({ search: "" }),
      respostas: {
        funil: "d",
        faixa: c?.faixa ?? null,
        jornada: e.jornada,
        traduziu: e.precoCentavos ? "sim" : "nao",
      },
      plano: "anual",
      metodo: "pix",
      venda_session_id: sessao,
      criado_em: new Date().toISOString(),
    };
  };

  const seguirPix = (email: string) => {
    trackEvent("funild_email", { onde: "pix", ...ids() });
    eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: PLANOS.anual.conteudo, value: PLANOS.anual.valor, currency: "BRL" }, lerAtribuicao()?.fbc || null);
    ir("pix", { email: email.toLowerCase(), pix: null, jaAssinante: false });
  };

  const conferirAssinante = async (): Promise<{ sim: boolean; fim: string | null }> => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      const d = data as { subscribed?: boolean; subscription_end?: string | null } | null;
      return { sim: !!d?.subscribed, fim: d?.subscription_end ?? null };
    } catch { return { sim: false, fim: null }; }
  };

  const depoisDaConta = async (email: string, nova: boolean) => {
    if (!nova) {
      const j = await conferirAssinante();
      if (j.sim) {
        trackEvent("funild_ja_assinante", { ...ids() });
        ir("sucesso", { email: email.toLowerCase(), jaAssinante: true, fim: j.fim, pix: null });
        return;
      }
    }
    seguirPix(email);
  };

  const emailAtual = useRef(estado.email ?? "");
  emailAtual.current = estado.email ?? "";

  const onEnviarEmail = async () => {
    if (ocupado) return;
    const digitado = emailAtual.current.trim();
    const falha = emailInvalido(digitado);
    if (falha) { setErroEmail(falha); trackEvent("funild_email_erro", { motivo: digitado ? "invalido" : "vazio", ...ids() }); return; }
    setErroEmail(null);
    setOcupado(true);
    try {
      if (isSubscribed && user?.email && user.email.toLowerCase() === digitado.toLowerCase()) {
        trackEvent("funild_ja_assinante", { via: "sessao", ...ids() });
        ir("sucesso", { email: digitado.toLowerCase(), jaAssinante: true });
        return;
      }
      const r = await prepararConta({ email: digitado, nome: "", venda: montarVenda() });
      if (r.ok === false) {
        if ("existe" in r) { setExiste(true); trackEvent("funild_conta_existe", { ...ids() }); return; }
        setErroEmail("erro" in r ? r.erro : "Não consegui seguir agora. Tenta de novo.");
        return;
      }
      trackEvent("funild_conta", { nova: r.nova, ...ids() });
      await depoisDaConta(digitado, r.nova);
    } finally { setOcupado(false); }
  };

  const onEntrar = async () => {
    if (ocupado || !senha) return;
    setOcupado(true);
    setErroEmail(null);
    try {
      const ok = await entrarComSenha(emailAtual.current, senha, "", montarVenda());
      if (!ok) { setErroEmail("Senha não bateu. Confere ou receba um código no e-mail."); return; }
      trackEvent("funild_conta", { nova: false, via: "senha", ...ids() });
      await depoisDaConta(emailAtual.current, false);
    } finally { setOcupado(false); }
  };

  const onCodigo = async () => {
    await entrouPorCodigo("", montarVenda());
    trackEvent("funild_conta", { nova: false, via: "codigo", ...ids() });
    await depoisDaConta(emailAtual.current, false);
  };

  const pedirCodigo = async () => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: "codigo" } });
      const codigo = (data as { codigo?: unknown } | null)?.codigo;
      if (error || !codigoDaPortaOk(codigo)) return;
      const emailEnviado = !!(data as { email_enviado?: boolean } | null)?.email_enviado;
      setEstado((e) => ({ ...e, codigo, emailEnviado }));
    } catch { /* o botão da loja segue */ }
  };
  const pediu = useRef(false);
  const onPixPago = useCallback((p?: PixPago) => {
    trackEvent("venda_pago", { oferta: "a97", metodo: "pix", valor: 97.9, order_id: p?.orderId ?? ref.current.pix?.orderId ?? null, funil: "d", ...ids() });
    ir("sucesso", { jaAssinante: false });
    if (!pediu.current) { pediu.current = true; void pedirCodigo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPix = useCallback((p: PixGerado | null) => setEstado((e) => ({ ...e, pix: p })), [setEstado]);

  useEffect(() => {
    if (estado.passo !== "sucesso" || authLoading || !user) return;
    if (!estado.fim) {
      void supabase.functions.invoke("check-subscription").then(({ data }) => {
        const fim = (data as { subscription_end?: string | null } | null)?.subscription_end;
        if (fim) setEstado((e) => ({ ...e, fim }));
      }).catch(() => {});
    }
    if (!pediu.current && !codigoDaPortaOk(estado.codigo)) { pediu.current = true; void pedirCodigo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, authLoading, user?.id]);

  const clicouLoja = useRef(false);
  const [voltou, setVoltou] = useState(false);
  useEffect(() => {
    const aoMudar = () => { if (document.visibilityState === "visible" && clicouLoja.current) setVoltou(true); };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);
  const hrefLoja = (loja: "ios" | "android" | null): string => {
    const a = lerAtribuicao();
    const q = new URLSearchParams({ origem: "funild" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };

  const onPagar = () => {
    trackEvent("funild_pagar_click", { metodo: "pix", ...ids() });
    ir("email");
  };

  let miolo: React.ReactNode = null;
  if (estado.passo === "entrada") {
    miolo = (
      <Entrada
        salario={estado.salarioTexto} onSalario={(v) => { setErroSalario(null); setEstado((e) => ({ ...e, salarioTexto: v })); }}
        jornada={estado.jornada} onJornada={onJornada} erro={erroSalario} onVer={onVer}
      />
    );
  } else if (estado.passo === "resultado" && conta) {
    miolo = (
      <Resultado
        conta={conta} precoTexto={estado.precoTexto} onPreco={onPreco} traducao={traducao}
        onExemplo={onExemplo} onJornada={onJornada} onSeguir={() => ir("plano")} onVoltar={() => ir("entrada")}
      />
    );
  } else if (estado.passo === "plano" && conta) {
    miolo = <Plano conta={conta} traducao={traducao} aberto={faq} onAbrir={setFaq} onPagar={onPagar} onVoltar={() => ir("resultado")} />;
  } else if (estado.passo === "email") {
    miolo = (
      <Email
        email={estado.email ?? ""} onEmail={(v) => { emailAtual.current = v; setErroEmail(null); setEstado((e) => ({ ...e, email: v })); }}
        erro={erroEmail} existe={existe} ocupado={ocupado} senha={senha} onSenha={setSenha}
        onEnviar={() => { void onEnviarEmail(); }} onEntrar={() => { void onEntrar(); }} onCodigo={() => { void onCodigo(); }}
        onOutro={() => { setExiste(false); setSenha(""); setErroEmail(null); }} onVoltar={() => ir("plano")}
      />
    );
  } else if (estado.passo === "pix") {
    miolo = (
      <div className="pb-8">
        <Topo onVoltar={() => ir("email")} />
        <PixVenda pix={estado.pix} onPix={onPix} onPago={onPixPago} ids={ids} celular={plataforma !== "web"} oferta="a97" />
      </div>
    );
  } else if (estado.passo === "sucesso") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    miolo = (
      <div className="pb-8">
        <SucessoVenda
          plataforma={plataforma} email={estado.email ?? user?.email ?? null} plano="anual" confirmado jaAssinante={estado.jaAssinante}
          voltou={voltou} abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
          emailEnviado={comCodigo && estado.emailEnviado} fimDoAcesso={dataBr(estado.fim)}
          hrefLoja={hrefLoja} qrUrl={URL_QR} onLoja={() => { clicouLoja.current = true; trackEventBeacon("funild_loja", { ...ids() }); }}
          onAbrirApp={() => trackEventBeacon("funild_abrir", { ...ids() })}
          planoTexto="Plano anual · 1 ano · Pix"
        />
      </div>
    );
  } else {
    miolo = <Entrada salario={estado.salarioTexto} onSalario={(v) => setEstado((e) => ({ ...e, salarioTexto: v }))} jornada={estado.jornada} onJornada={onJornada} erro={null} onVer={onVer} />;
  }

  return <Moldura passo={estado.passo}>{miolo}</Moldura>;
}
