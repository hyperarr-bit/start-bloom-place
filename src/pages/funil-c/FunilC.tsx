import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isInAppBrowser } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP, destinoNaLanding } from "@/lib/rotas-web";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import type { Plataforma } from "@/pages/porta/SucessoPorta";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import { PLANOS } from "@/pages/venda/conteudo";
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "@/pages/venda/conta";
import { eventoMeta, novoEventId, sessaoDaVenda } from "@/pages/venda/rastreio";
import type { ResultadoDados } from "@/pages/venda/telas-venda";
import { PixVenda, type PixGerado } from "@/pages/venda/PixVenda";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import {
  calcularMapaDoMes,
  ehDominioProducao,
  formatarMoeda,
  type EscapeDinheiro,
  type ModoPlano,
  type NivelComprometido,
} from "./calculo";
import {
  COR_ACENTO,
  COR_FUNDO,
  COR_TEXTO,
  TelaCalculadora,
  TelaMapaDoMes,
  TelaOfertaPix,
  TopoFunilC,
} from "./telas-funil-c";

export type PassoFunilC = "calculadora" | "mapa" | "oferta" | "pix" | "sucesso";
const PASSOS_FUNIL_C: PassoFunilC[] = ["calculadora", "mapa", "oferta", "pix", "sucesso"];

const PROGRESSO_FUNIL_C: Partial<Record<PassoFunilC, number>> = {
  calculadora: 0.25,
  mapa: 0.58,
  oferta: 0.84,
  pix: 0.96,
};

const VOLTA_FUNIL_C: Partial<Record<PassoFunilC, PassoFunilC>> = {
  mapa: "calculadora",
  oferta: "mapa",
  pix: "oferta",
};

export interface EstadoFunilC {
  passo: PassoFunilC;
  renda: number;
  comprometidoPct: NivelComprometido;
  escape: EscapeDinheiro;
  modo: ModoPlano;
  nome: string | null;
  email: string | null;
  pix: PixGerado | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  fim?: string | null;
  jaAssinante?: boolean;
}

export const CHAVE_ESTADO_FUNIL_C = "funil-c-estado-v1";
let memoriaEstadoFunilC: EstadoFunilC | null = null;

export function _zerarEstadoFunilC(): void {
  memoriaEstadoFunilC = null;
}

const estadoInicialFunilC = (): EstadoFunilC => ({
  passo: "calculadora",
  renda: 4500,
  comprometidoPct: 55,
  escape: "pix_diario",
  modo: "equilibrio",
  nome: null,
  email: null,
  pix: null,
});

function lerEstadoFunilC(): EstadoFunilC | null {
  if (memoriaEstadoFunilC) return memoriaEstadoFunilC;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_FUNIL_C);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EstadoFunilC;
    if (parsed && PASSOS_FUNIL_C.includes(parsed.passo)) {
      memoriaEstadoFunilC = parsed;
      return parsed;
    }
  } catch {
    /* storage indisponível */
  }
  return null;
}

function gravarEstadoFunilC(e: EstadoFunilC): void {
  memoriaEstadoFunilC = e;
  try {
    localStorage.setItem(CHAVE_ESTADO_FUNIL_C, JSON.stringify(e));
  } catch {
    /* storage bloqueado */
  }
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
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
};

export const URL_QR_FUNIL_C = "https://coreaplicativo.com.br/baixar?origem=funil_c_qr";

/**
 * Rota `/funil-c`:
 * 1) Nunca roda no shell nativo (`isNativeShell()` → `ENTRADA_APP`).
 * 2) Desligada nos domínios de produção (`coreaplicativo.com.br` e `www.coreaplicativo.com.br`),
 *    redirecionando para `"/"` com a query preservada via `destinoNaLanding`.
 */
export default function FunilCRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  if (ehDominioProducao()) {
    const search = typeof window !== "undefined" ? window.location.search : "";
    return <Navigate to={destinoNaLanding(search)} replace />;
  }
  return <FunilC />;
}

export function FunilC() {
  const { user, loading: authLoading, isSubscribed } = useAuth();

  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    const s = sessaoDaVenda();
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { venda_session_id: sessao, funil: "funil_c", ...resto };
  }, [sessao]);

  const [estado, setEstadoCru] = useState<EstadoFunilC>(() => lerEstadoFunilC() ?? estadoInicialFunilC());
  const setEstado = useCallback((f: (e: EstadoFunilC) => EstadoFunilC) => {
    setEstadoCru((e) => {
      const n = f(e);
      gravarEstadoFunilC(n);
      return n;
    });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const ir = (passo: PassoFunilC, extra: Partial<EstadoFunilC> = {}) =>
    setEstado((e) => ({ ...e, ...extra, passo }));

  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);

  const mapa = useMemo(
    () =>
      calcularMapaDoMes({
        renda: estado.renda,
        comprometidoPct: estado.comprometidoPct,
        modo: estado.modo,
      }),
    [estado.renda, estado.comprometidoPct, estado.modo],
  );

  /* noindex + título editorial */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-funil-c", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Calculadora do Teto Diário";
    return () => {
      meta.remove();
      document.title = antes;
    };
  }, []);

  /* venda_view + ViewContent: 1x por sessão */
  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    trackEvent("venda_view", {
      ...a,
      atribuicao: origem,
      venda_session_id: sessao,
      funil: "funil_c",
      plataforma,
      in_app: emInApp,
      retomou: estado.passo !== "calculadora" ? estado.passo : null,
    });
    eventoMeta(
      "ViewContent",
      novoEventId("vc"),
      { content_name: "venda_web", content_category: "venda" },
      inicio.current.attr.fbc || null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* jsdom */
    }
  }, [estado.passo]);

  /* telemetria por etapa */
  useEffect(() => {
    trackEvent("venda_passo", {
      passo: estado.passo,
      area: "dinheiro",
      resposta: "view",
      renda: estado.renda,
      comprometido_pct: estado.comprometidoPct,
      teto_diario: mapa.tetoDiario,
      sobra_anual: mapa.sobraAnual,
      ...ids(),
    });
    if (estado.passo === "oferta") {
      trackEvent("venda_paywall_view", {
        area: "dinheiro",
        cartao_anual: false,
        mensal: false,
        teto_diario: mapa.tetoDiario,
        sobra_anual: mapa.sobraAnual,
        ...ids(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  const montarVenda = (e: EstadoFunilC = estadoRef.current): VendaNaConta => ({
    v: 1,
    attr: capturarAtribuicao({ search: "" }),
    respostas: {
      area: "dinheiro",
      rota: "dinheiro",
      funil: "funil_c",
      renda_mensal: String(e.renda),
      comprometido_pct: String(e.comprometidoPct),
      escape: e.escape,
      modo: e.modo,
      teto_diario: String(mapa.tetoDiario),
      sobra_anual: String(mapa.sobraAnual),
    },
    plano: "anual",
    metodo: "pix",
    venda_session_id: sessao,
    criado_em: new Date().toISOString(),
  });

  const onCalcular = () => {
    trackEvent("venda_passo", {
      passo: "calculadora",
      area: "dinheiro",
      resposta: `${estado.renda}_${estado.comprometidoPct}_${estado.escape}`,
      teto_diario: mapa.tetoDiario,
      dia_apagao: mapa.diaApagao,
      sobra_anual: mapa.sobraAnual,
      ...ids(),
    });
    ir("mapa");
  };

  const onAvancarOferta = () => {
    const p = PLANOS.anual;
    trackEvent("venda_plano_click", {
      plano: "anual",
      metodo: "pix",
      valor: p.valor,
      teto_diario: mapa.tetoDiario,
      sobra_anual: mapa.sobraAnual,
      ...ids(),
    });
    eventoMeta(
      "InitiateCheckout",
      novoEventId("ic"),
      { content_name: p.conteudo, value: p.valor, currency: "BRL", content_category: "pix" },
      attrAgora().fbc || null,
    );
    ir("oferta");
  };

  const irJaAssinante = (nome: string, email: string, fim: string | null, via: string) => {
    trackEvent("venda_ja_assinante", { via, ...ids() });
    ir("sucesso", { nome, email: email.toLowerCase(), jaAssinante: true, fim, pix: null });
  };

  const conferirJaAssinante = async (): Promise<{ sim: boolean; fim: string | null }> => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      const d = data as { subscribed?: boolean; subscription_end?: string | null } | null;
      return { sim: !!d?.subscribed, fim: d?.subscription_end ?? null };
    } catch {
      return { sim: false, fim: null };
    }
  };

  const seguirPix = (nome: string, email: string) => {
    ir("pix", { nome, email: email.toLowerCase(), pix: null, jaAssinante: false });
  };

  const seguirOuJaAssinante = async (nome: string, email: string, via: string) => {
    const j = await conferirJaAssinante();
    if (j.sim) {
      irJaAssinante(nome, email, j.fim, via);
      return;
    }
    seguirPix(nome, email);
  };

  const onEnviarDados = async (nome: string, email: string): Promise<ResultadoDados> => {
    if (isSubscribed && user?.email && user.email.toLowerCase() === email.toLowerCase()) {
      irJaAssinante(nome, email, null, "sessao");
      return { ok: true };
    }
    const r = await prepararConta({ email, nome, venda: montarVenda() });
    if (r.ok === false) {
      if ("existe" in r) {
        trackEvent("venda_conta_existe", { ...ids() });
        return { ok: false, existe: true };
      }
      const erro = (r as { erro: string }).erro;
      trackEvent("venda_erro", { onde: "conta", msg: erro.slice(0, 120), ...ids() });
      return { ok: false, erro };
    }
    const nova = (r as { nova: boolean }).nova;
    trackEvent("venda_conta", { nova, via: "email", plano: "anual", metodo: "pix", ...ids() });
    if (nova) seguirPix(nome, email);
    else await seguirOuJaAssinante(nome, email, "sessao");
    return { ok: true };
  };

  const onEntrarSenha = async (email: string, senha: string, nome: string): Promise<boolean> => {
    const ok = await entrarComSenha(email, senha, nome, montarVenda());
    if (!ok) return false;
    trackEvent("venda_conta", { nova: false, via: "senha", ...ids() });
    await seguirOuJaAssinante(nome, email, "senha");
    return true;
  };

  const onEntrouCodigo = async (nome: string, email: string) => {
    await entrouPorCodigo(nome, montarVenda());
    trackEvent("venda_conta", { nova: false, via: "codigo", ...ids() });
    await seguirOuJaAssinante(nome, email, "codigo");
  };

  const pedirCodigo = async (): Promise<void> => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", {
        body: { acao: "criar", metodo: "codigo" },
      });
      const codigo = (data as { codigo?: unknown } | null)?.codigo;
      if (error || !codigoDaPortaOk(codigo)) {
        trackEvent("venda_codigo", { ok: false, erro: (error?.message || "sem_codigo").slice(0, 120), ...ids() });
        return;
      }
      const emailEnviado = !!(data as { email_enviado?: boolean } | null)?.email_enviado;
      setEstado((x) => ({ ...x, codigo, emailEnviado }));
      trackEvent("venda_codigo", { ok: true, email: emailEnviado, ...ids() });
    } catch (e) {
      trackEvent("venda_codigo", { ok: false, erro: String(e).slice(0, 120), ...ids() });
    }
  };

  const pediuCodigo = useRef(false);
  const onPixPago = useCallback(() => {
    trackEvent("venda_pago", {
      plano: "anual",
      metodo: "pix",
      valor: PLANOS.anual.valor,
      order_id: estadoRef.current.pix?.orderId ?? null,
      teto_diario: mapa.tetoDiario,
      sobra_anual: mapa.sobraAnual,
      ...ids(),
    });
    ir("sucesso", { jaAssinante: false });
    if (!pediuCodigo.current) {
      pediuCodigo.current = true;
      void pedirCodigo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, mapa.tetoDiario, mapa.sobraAnual]);

  const onPix = useCallback((p: PixGerado | null) => setEstado((e) => ({ ...e, pix: p })), [setEstado]);

  /* sucesso: fim do acesso + código handoff se recarregou */
  useEffect(() => {
    if (estado.passo !== "sucesso" || authLoading || !user) return;
    if (!estado.fim) {
      void supabase.functions
        .invoke("check-subscription")
        .then(({ data }) => {
          const fim = (data as { subscription_end?: string | null } | null)?.subscription_end;
          if (fim) setEstado((e) => ({ ...e, fim }));
        })
        .catch(() => {});
    }
    if (!pediuCodigo.current && !codigoDaPortaOk(estado.codigo)) {
      pediuCodigo.current = true;
      void pedirCodigo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, authLoading, user?.id]);

  const clicouLoja = useRef(false);
  const [voltou, setVoltou] = useState(false);
  useEffect(() => {
    const aoMudar = () => {
      if (document.visibilityState === "visible" && clicouLoja.current) setVoltou(true);
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);

  const hrefLoja = (loja: "ios" | "android" | null): string => {
    const a = attrAgora();
    const q = new URLSearchParams({ origem: "funil_c" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };

  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("venda_loja_click", { plataforma, loja, ...ids() });
  };

  const progresso = PROGRESSO_FUNIL_C[estado.passo] ?? null;
  const volta = VOLTA_FUNIL_C[estado.passo];

  return (
    <div
      className="min-h-[100dvh] antialiased"
      style={{ background: COR_FUNDO, color: COR_TEXTO }}
      data-testid="funil-c"
      data-passo={estado.passo}
    >
      <div
        className="mx-auto w-full max-w-[430px] px-4 pb-10"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}
      >
        <TopoFunilC
          passo={estado.passo}
          progresso={progresso}
          onVoltar={volta ? () => ir(volta) : undefined}
        />

        {estado.passo === "calculadora" && (
          <TelaCalculadora
            renda={estado.renda}
            comprometidoPct={estado.comprometidoPct}
            escape={estado.escape}
            mapaPreview={mapa}
            onChangeRenda={(renda) => setEstado((e) => ({ ...e, renda }))}
            onChangeComprometido={(comprometidoPct) => setEstado((e) => ({ ...e, comprometidoPct }))}
            onChangeEscape={(escape) => setEstado((e) => ({ ...e, escape }))}
            onCalcular={onCalcular}
          />
        )}

        {estado.passo === "mapa" && (
          <TelaMapaDoMes
            mapa={mapa}
            modo={estado.modo}
            escape={estado.escape}
            onChangeModo={(modo) => setEstado((e) => ({ ...e, modo }))}
            onAvancarOferta={onAvancarOferta}
          />
        )}

        {estado.passo === "oferta" && (
          <TelaOfertaPix
            mapa={mapa}
            nomeInicial={
              estado.nome ?? ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "")
            }
            emailInicial={estado.email ?? ""}
            emailLogado={!authLoading && user?.email ? user.email : null}
            onEnviar={onEnviarDados}
            onEntrarSenha={onEntrarSenha}
            onEntrouCodigo={onEntrouCodigo}
            onErroCampo={(campo, motivo) => trackEvent("venda_dados_erro", { campo, motivo, ...ids() })}
          />
        )}

        {estado.passo === "pix" && (
          <div className="space-y-3" data-testid="funil-c-tela-pix">
            <div
              className="rounded-[16px] border px-3.5 py-2.5 text-[13px]"
              style={{ borderColor: "#F2D0E2", background: "#FDF2F8" }}
              data-testid="funil-c-pix-contexto"
            >
              <p className="font-bold text-[#262626]">
                Ativando seu Teto Diário de <span style={{ color: COR_ACENTO }}>R$ {formatarMoeda(mapa.tetoDiario)}/dia</span>
              </p>
              <p className="text-[12px] text-[#5C5852]">
                Meta configurada: <b>+R$ {formatarMoeda(mapa.sobraMensal)}/mês</b> (R$ {formatarMoeda(mapa.sobraAnual)}/ano) · Conta:{" "}
                <b>{estado.email}</b>
              </p>
            </div>

            <div className="rounded-[20px] border border-[#E5E0D8] bg-white px-5 pt-1 pb-6 shadow-[0_6px_22px_-12px_rgba(38,38,38,0.12)]">
              <PixVenda
                pix={estado.pix}
                onPix={onPix}
                onPago={onPixPago}
                ids={ids}
                celular={plataforma !== "web"}
                oferta="a97"
                plano="anual"
                rotulo="Plano Anual CORE"
                preco={PLANOS.anual.preco}
                valor={PLANOS.anual.valor}
                acesso="1 ano de acesso completo (16 módulos)"
              />
            </div>
          </div>
        )}

        {estado.passo === "sucesso" && (
          <div className="rounded-[20px] border border-[#E5E0D8] bg-white px-5 pt-4 pb-6 shadow-[0_6px_22px_-12px_rgba(38,38,38,0.12)]">
            <SucessoVenda
              plataforma={plataforma}
              email={estado.email ?? user?.email ?? null}
              plano="anual"
              confirmado
              jaAssinante={!!estado.jaAssinante}
              voltou={voltou}
              abrirApp={
                plataforma === "ios" && codigoDaPortaOk(estado.codigo)
                  ? abrirAppComCodigo(estado.codigo as string)
                  : null
              }
              emailEnviado={plataforma === "ios" && codigoDaPortaOk(estado.codigo) && !!estado.emailEnviado}
              fimDoAcesso={dataBr(estado.fim)}
              hrefLoja={hrefLoja}
              qrUrl={URL_QR_FUNIL_C}
              onLoja={onLoja}
              onAbrirApp={() => trackEventBeacon("venda_abrir_app_click", { voltou, ...ids() })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
