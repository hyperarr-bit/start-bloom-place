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
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "@/pages/venda/conta";
import { eventoMeta, novoEventId, sessaoDaVenda } from "@/pages/venda/rastreio";
import { DadosVenda, type ResultadoDados } from "@/pages/venda/telas-venda";
import { PixVenda, type PixGerado } from "@/pages/venda/PixVenda";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import { calcular13, faixaDoSalario, lerSalario } from "./calculo";
import { RESUMO_PIX, TITULO_PAGINA, VALOR, avosDoMes, destinoDe, type ChaveDestino } from "./conteudo";
import { funilALiberadoNoHost } from "./liberado";
import { COR, CardVenda, EstilosFunilA, TelaDestino, TelaEntrada, TelaPlano, TelaResultado, Topo } from "./telas";

/**
 * /funil-a — "QUANTO DO SEU 13º CAI NA CONTA?" (18/10). Só na WEB (SoNaWeb + cinto aqui), noindex, e só FORA do
 * domínio de produção (./liberado.ts). A tese inteira está em FUNIL_PROPOSTA.md.
 *
 *   1 entrada    UM campo: o salário bruto (ou um toque num exemplo). Sem cadastro.
 *   2 resultado  o 13º líquido EXATO (tabelas oficiais de 2026), as 2 parcelas com as datas, o que o INSS e o IR
 *                levam, quanto a nova isenção do IR deixa no bolso, salário líquido e FGTS do ano.
 *   3 destino    "Pra onde vai o seu 13º?" (1 toque).
 *   4 plano      o 13º dela dividido em 3 potes + os recursos do app que seguram o plano + o preço ancorado no
 *                número DELA ("R$ 97,90 = 2,9% do seu 13º") → "Pagar R$ 97,90 no Pix".
 *   5 dados      nome + e-mail (a conta nasce aqui, pelo MESMO caminho do /assinar: ../venda/conta.ts).
 *   6 pix        o MESMO PixVenda (Asaas a97 = 1 ano; QR + copia-e-cola; confere a cada 3 s).
 *   7 sucesso    o MESMO SucessoVenda (loja do aparelho, "entre com este e-mail", "Abrir o CORE" no iPhone).
 *
 * O salário fica só neste aparelho: analytics e conta recebem a FAIXA (faixaDoSalario), nunca o número.
 * Eventos (todos com venda_session_id + ids do anúncio + variante "funil_a"):
 *   funil_a_view · funil_a_calculou {faixa, avos, exemplo, ir_zerou} · funil_a_passo {passo} ·
 *   funil_a_destino {destino} · funil_a_pagar_click {destino} · e os venda_* do PixVenda / da conta / do sucesso.
 * Meta: ViewContent (1ª carga, pixel + CAPI), Lead (calculou, pixel), InitiateCheckout (pagar, pixel + CAPI),
 * Purchase (CAPI do pagamento + pixel com o id do QR, dentro do PixVenda).
 */
export type PassoA = "entrada" | "resultado" | "destino" | "plano" | "dados" | "pix" | "sucesso";
const PASSOS: PassoA[] = ["entrada", "resultado", "destino", "plano", "dados", "pix", "sucesso"];
const PROGRESSO: Partial<Record<PassoA, number>> = { entrada: 0.12, resultado: 0.35, destino: 0.55, plano: 0.72, dados: 0.86, pix: 0.95 };
const VOLTA: Partial<Record<PassoA, PassoA>> = { resultado: "entrada", destino: "resultado", plano: "destino", dados: "plano", pix: "plano" };

export type EstadoA = {
  passo: PassoA;
  salario: string;
  mesEntrada: number | null;
  destino: ChaveDestino | null;
  nome: string | null;
  email: string | null;
  pix: PixGerado | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  fim?: string | null;
  jaAssinante?: boolean;
};

export const CHAVE_ESTADO_A = "funil-a-estado-v1";
const VARIANTE = "funil_a";
let memoria: EstadoA | null = null;
export function _zerarEstadoA(): void { memoria = null; }

const novo = (): EstadoA => ({ passo: "entrada", salario: "", mesEntrada: null, destino: null, nome: null, email: null, pix: null });
function ler(): EstadoA | null {
  if (memoria) return memoria;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_A);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoA;
    if (e && PASSOS.includes(e.passo)) { memoria = e; return e; }
  } catch { /* noop */ }
  return null;
}
function gravar(e: EstadoA): void {
  memoria = e;
  try { localStorage.setItem(CHAVE_ESTADO_A, JSON.stringify(e)); } catch { /* fica a memória */ }
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
const lead = (params: Record<string, unknown>) => {
  try {
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") fbq("track", "Lead", params);
  } catch { /* noop */ }
};

export const URL_QR_A = "https://coreaplicativo.com.br/baixar?origem=funil_a_qr";

export default function FunilARota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  if (typeof window !== "undefined" && !funilALiberadoNoHost(window.location.hostname)) {
    return <Navigate to={destinoNaLanding(window.location.search)} replace />;
  }
  return <FunilA />;
}

export function FunilA({ hoje: hojeProp }: { hoje?: Date } = {}) {
  const { user, loading: authLoading, isSubscribed } = useAuth();
  const hoje = useMemo(() => hojeProp ?? new Date(), [hojeProp]);

  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    const s = sessaoDaVenda();
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { venda_session_id: sessao, variante: VARIANTE, ...resto };
  }, [sessao]);
  const fbcAgora = () => (lerAtribuicao() ?? inicio.current!.attr).fbc || null;

  const [estado, setEstadoCru] = useState<EstadoA>(() => ler() ?? novo());
  const setEstado = useCallback((f: (e: EstadoA) => EstadoA) => {
    setEstadoCru((e) => { const n = f(e); gravar(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const ir = (passo: PassoA, extra: Partial<EstadoA> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));

  const plataforma = useMemo(plataformaDaWeb, []);
  const resultado = useMemo(() => {
    const v = lerSalario(estado.salario);
    return Number.isFinite(v) && v > 0 ? calcular13(v, avosDoMes(estado.mesEntrada)) : null;
  }, [estado.salario, estado.mesEntrada]);
  const destino = destinoDe(estado.destino);

  /* sem o cálculo (storage zerado no meio), as telas que dependem dele voltam pro começo */
  useEffect(() => {
    if (!resultado && (estado.passo === "resultado" || estado.passo === "destino" || estado.passo === "plano")) ir("entrada");
    else if (!destino && estado.passo === "plano") ir("destino");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, !!resultado, !!destino]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-funil-a", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = TITULO_PAGINA;
    return () => { meta.remove(); document.title = antes; };
  }, []);

  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    trackEvent("funil_a_view", { ...a, atribuicao: origem, venda_session_id: sessao, variante: VARIANTE, plataforma, in_app: isInAppBrowser(), retomou: estado.passo !== "entrada" ? estado.passo : null });
    eventoMeta("ViewContent", novoEventId("vc"), { content_name: "funil_a", content_category: "venda" }, inicio.current.attr.fbc || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { window.scrollTo(0, 0); } catch { /* jsdom */ }
    if (estado.passo !== "entrada") trackEvent("funil_a_passo", { passo: estado.passo, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  /* ---------------------------------------------------------- o funil */
  const onCalcular = (texto: string, mesEntrada: number | null, viaExemplo: boolean) => {
    const v = lerSalario(texto);
    const r = calcular13(v, avosDoMes(mesEntrada));
    const faixa = faixaDoSalario(v);
    trackEvent("funil_a_calculou", { faixa, avos: r.avos, exemplo: viaExemplo, ir_zerou: r.economiaIrMes > 0 && r.irMes === 0, ...ids() });
    lead({ content_name: "funil_a_13", content_category: faixa });
    ir("resultado", { salario: texto, mesEntrada });
  };
  const onDestino = (c: ChaveDestino) => {
    trackEvent("funil_a_destino", { destino: c, ...ids() });
    ir("plano", { destino: c });
  };
  const onPagar = () => {
    trackEvent("funil_a_pagar_click", { destino: estadoRef.current.destino, ...ids() });
    trackEvent("venda_plano_click", { plano: "anual", metodo: "pix", valor: VALOR, ...ids() });
    eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: "core_anual_web", value: VALOR, currency: "BRL", content_category: "pix" }, fbcAgora());
    ir("dados");
  };

  /* ---------------------------------------------------------- conta (o mesmo caminho do /assinar) */
  const montarVenda = (): VendaNaConta => {
    const e = estadoRef.current;
    const v = lerSalario(e.salario);
    return {
      v: 1,
      attr: capturarAtribuicao({ search: "" }),
      respostas: { funil: VARIANTE, faixa_salario: Number.isFinite(v) ? faixaDoSalario(v) : null, destino_13: e.destino, avos: String(avosDoMes(e.mesEntrada)) },
      plano: "anual",
      metodo: "pix",
      venda_session_id: sessao,
      criado_em: new Date().toISOString(),
    };
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
  const irProPix = (nome: string, email: string) => ir("pix", { nome, email: email.toLowerCase(), pix: null, jaAssinante: false });
  const seguirOuJaAssinante = async (nome: string, email: string, via: string) => {
    const j = await conferirJaAssinante();
    if (j.sim) { irJaAssinante(nome, email, j.fim, via); return; }
    irProPix(nome, email);
  };
  const onEnviarDados = async (nome: string, email: string): Promise<ResultadoDados> => {
    if (isSubscribed && user?.email && user.email.toLowerCase() === email.toLowerCase()) {
      irJaAssinante(nome, email, null, "sessao");
      return { ok: true };
    }
    const r = await prepararConta({ email, nome, venda: montarVenda() });
    if (r.ok === false) {
      if ("existe" in r) { trackEvent("venda_conta_existe", { ...ids() }); return { ok: false, existe: true }; }
      const erro = (r as { erro: string }).erro;
      trackEvent("venda_erro", { onde: "conta", msg: erro.slice(0, 120), ...ids() });
      return { ok: false, erro };
    }
    const nova = (r as { nova: boolean }).nova;
    trackEvent("venda_conta", { nova, via: "email", plano: "anual", metodo: "pix", ...ids() });
    if (nova) irProPix(nome, email);
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

  /* ---------------------------------------------------------- pago */
  const pedirCodigo = async (): Promise<void> => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: "codigo" } });
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
    trackEvent("venda_pago", { plano: "anual", metodo: "pix", valor: VALOR, order_id: estadoRef.current.pix?.orderId ?? null, destino: estadoRef.current.destino, ...ids() });
    ir("sucesso", { jaAssinante: false });
    if (!pediuCodigo.current) { pediuCodigo.current = true; void pedirCodigo(); }
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
    if (!pediuCodigo.current && !codigoDaPortaOk(estado.codigo)) { pediuCodigo.current = true; void pedirCodigo(); }
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
    const a = lerAtribuicao() ?? inicio.current!.attr;
    const q = new URLSearchParams({ origem: VARIANTE });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("venda_loja_click", { plataforma, loja, ...ids() });
  };

  /* ---------------------------------------------------------- render */
  const volta = VOLTA[estado.passo];
  const voltar = volta ? () => ir(volta) : undefined;

  let tela: React.ReactNode = null;
  if (estado.passo === "entrada" || !resultado) {
    tela = <TelaEntrada salarioInicial={estado.salario} mesInicial={estado.mesEntrada} onCalcular={onCalcular} />;
  } else if (estado.passo === "resultado") {
    tela = <TelaResultado r={resultado} hoje={hoje} onContinuar={() => ir("destino")} onRefazer={() => ir("entrada")} />;
  } else if (estado.passo === "destino" || (estado.passo === "plano" && !destino)) {
    tela = <TelaDestino r={resultado} hoje={hoje} inicial={estado.destino} onEscolher={onDestino} />;
  } else if (estado.passo === "plano" && destino) {
    tela = <TelaPlano r={resultado} destino={destino} onPagar={onPagar} />;
  } else if (estado.passo === "dados") {
    tela = (
      <CardVenda>
        <DadosVenda
          plano="anual" metodo="pix" resumo={RESUMO_PIX}
          nomeInicial={estado.nome ?? ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "")}
          emailInicial={estado.email ?? ""}
          emailLogado={!authLoading && user?.email ? user.email : null}
          onEnviar={onEnviarDados} onEntrarSenha={onEntrarSenha} onEntrouCodigo={onEntrouCodigo}
          onTrocarPlano={() => ir("plano")}
          onErroCampo={(campo, motivo) => trackEvent("venda_dados_erro", { campo, motivo, ...ids() })}
        />
      </CardVenda>
    );
  } else if (estado.passo === "pix") {
    tela = <CardVenda><PixVenda pix={estado.pix} onPix={onPix} onPago={onPixPago} ids={ids} celular={plataforma !== "web"} /></CardVenda>;
  } else if (estado.passo === "sucesso") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    tela = (
      <CardVenda>
        <SucessoVenda
          plataforma={plataforma} email={estado.email ?? user?.email ?? null} plano="anual" confirmado jaAssinante={!!estado.jaAssinante} voltou={voltou}
          abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
          emailEnviado={comCodigo && !!estado.emailEnviado}
          fimDoAcesso={dataBr(estado.fim)} hrefLoja={hrefLoja} qrUrl={URL_QR_A} onLoja={onLoja}
          onAbrirApp={() => trackEventBeacon("venda_abrir_app_click", { voltou, ...ids() })}
        />
      </CardVenda>
    );
  }

  return (
    <div className="min-h-[100dvh] antialiased" style={{ background: COR.papel, color: COR.texto }} data-testid="funila" data-passo={estado.passo}>
      <EstilosFunilA />
      <div className="mx-auto w-full max-w-[440px] px-5 pb-10" style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}>
        <Topo onVoltar={voltar} progresso={PROGRESSO[estado.passo] ?? null} />
        {tela}
      </div>
    </div>
  );
}
