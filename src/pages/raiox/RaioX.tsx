import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { RAIOX } from "@/lib/raiox";
import { ENTRADA_APP, destinoNaLanding } from "@/lib/rotas-web";
import { parseExtrato } from "@/lib/extrato-parser";
import { useAuth } from "@/hooks/use-auth";
import { lerAtribuicao } from "@/pages/porta/atribuicao";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import { entrarComSenha, entrouPorCodigo, prepararConta } from "@/pages/venda/conta";
import {
  CHAVES, PASSOS_PLANO, PERGUNTAS, PRECO, ROTULO, mesAno, type Chave,
} from "./conteudo";
import { diasDaAncora, estimar, type ResumoRaiox } from "./estimativa";
import {
  gravarEstado, gravarTxsLocais, guardarTxs, lerEstado, lerTxs, limparTxs, limparTxsLocais,
  novoEstado, resolverDemo, sessaoDoRaiox, type PassoRaiox, type VarianteDemo,
} from "./estado";
import { gravarLancamentosNaConta } from "./lancamentos";
import { PixRaioX } from "./PixRaioX";
import {
  capturar, dispararCheckout, dispararView, eventoRaiox, hashEmail, idsDaCampanha, montarMeta, montarVenda, payloadResultado,
} from "./rastreio";
import {
  Calculando, Escolha, Extrato, Preco, Quiz, Resultado, Shell, Sucesso,
} from "./telas";
import { detectarVazamentos } from "./vazamentos";
import "./raiox.css";

const Demo = lazy(() => import("./Demo"));

const ESPERA_QUIZ = 300;
const ESPERA_CALC = 1500;
const ESPERA_MICRO = 280;
const ESPERA_SALVAR = 600;

type ContaFase = "form" | "existe" | "abrindo" | "pix";
type Plataforma = "ios" | "android" | "web";

const plataformaDaWeb = (): Plataforma => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};

const FUNDO_CLARO = new Set(["q1", "q2", "q3", "q4", "q5", "calculando", "extrato", "leitura", "demo"]);

export default function RaioXRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  const search = typeof window !== "undefined" ? window.location.search : "";
  if (RAIOX !== "on") return <Navigate to={destinoNaLanding(search)} replace />;
  return <RaioX />;
}

export function RaioX() {
  const { user, isSubscribed } = useAuth();
  const search = useMemo(() => { try { return window.location.search; } catch { return ""; } }, []);
  const attrRef = useRef(capturar(search));
  const camp = useMemo(() => idsDaCampanha(search, attrRef.current), [search]);
  const sessaoRef = useRef(sessaoDoRaiox());
  const plataforma = useMemo(plataformaDaWeb, []);

  const [estado, setEstadoCru] = useState(() => {
    const v = resolverDemo({ search, fbclid: attrRef.current.fbclid });
    const salvo = lerEstado();
    if (salvo) return { ...salvo, variante_demo: v };
    return novoEstado(v);
  });
  const setEstado = useCallback((f: (e: typeof estado) => typeof estado) => {
    setEstadoCru((e) => {
      const n = f(e);
      const limpo = n.passo === "sucesso" ? { ...n, respostas: {}, pix: null } : n;
      gravarEstado(limpo);
      return limpo;
    });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const [micro, setMicro] = useState<string | null>(null);
  const [contaFase, setContaFase] = useState<ContaFase>("form");
  const [erroConta, setErroConta] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState(false);
  const [consentir, setConsentir] = useState(false);
  const [mostraConsentir, setMostraConsentir] = useState(false);
  const [abrirApp, setAbrirApp] = useState<string | null>(null);
  const [mandandoEmail, setMandandoEmail] = useState(false);

  const metaRef = useRef<Record<string, unknown> | null>(null);
  const avanco = useRef<number | null>(null);
  const microTimer = useRef<number | null>(null);
  const visto = useRef("");
  const metaGravada = useRef(false);
  const pediuCodigo = useRef(false);
  const emVoo = useRef(false);

  const ir = (passo: PassoRaiox, extra: Partial<typeof estado> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));

  /** `File.text()` falta no jsdom e em WebView antiga. O FileReader cobre os dois. */
  const lerArquivo = (file: File): Promise<string> => {
    if (typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result ?? ""));
      leitor.onerror = () => reject(leitor.error ?? new Error("leitura"));
      leitor.readAsText(file);
    });
  };

  const idsPix = useCallback((): Record<string, string> => {
    const e = estadoRef.current;
    return {
      raiox: "true",
      variante_demo: e.variante_demo,
      venda_session_id: sessaoRef.current.id,
      ...(camp.ad_id ? { ad_id: camp.ad_id } : {}),
      ...(camp.adset_id ? { adset_id: camp.adset_id } : {}),
      ...(camp.campaign_id ? { campaign_id: camp.campaign_id } : {}),
    };
  }, [camp.ad_id, camp.adset_id, camp.campaign_id]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-raiox", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Raio-X do mês";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  useEffect(() => {
    if (!sessaoRef.current.nova) return;
    dispararView(attrRef.current, camp, estadoRef.current.variante_demo);
    const t0 = performance.now();
    const id = requestAnimationFrame(() => {
      let ms = Math.round(performance.now() - t0);
      try {
        const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
        if (paint) ms = Math.round(paint.startTime);
      } catch { /* jsdom */ }
      trackEvent("raiox_first_paint", { ms });
    });
    return () => cancelAnimationFrame(id);
    // uma vez por sessão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [estado.passo]);

  useEffect(() => {
    if (estado.passo === "q4" || estado.passo === "q5" || estado.passo === "resultado" || estado.passo === "escolha") {
      void import("./Demo");
    }
  }, [estado.passo]);

  useEffect(() => {
    if (estado.passo !== "calculando") return;
    const t = window.setTimeout(() => {
      const atual = estadoRef.current;
      const resumo = estimar(atual.respostas);
      trackEvent("raiox_quiz_completo", { ms: Date.now() - atual.quizInicio, variante_demo: atual.variante_demo });
      setEstado((e) => ({ ...e, resumo, fonte: "estimativa", passo: "resultado" }));
    }, ESPERA_CALC);
    return () => window.clearTimeout(t);
  }, [estado.passo, setEstado]);

  useEffect(() => {
    const k = `${estado.passo}:${estado.fonte}:${estado.resumo?.vazou_mes ?? ""}:${estado.escolha ?? ""}`;
    if (visto.current === k) return;
    visto.current = k;
    const v = estado.variante_demo;
    if (estado.passo === "resultado" && estado.resumo) {
      trackEvent("raiox_resultado", { ...payloadResultado(estado.resumo), variante_demo: v });
      eventoRaiox("Lead", `raiox_ld_${Math.random().toString(36).slice(2)}`, { content_name: "raiox", content_category: estado.fonte }, attrRef.current.fbc || null);
    } else if (estado.passo === "plano_preco") {
      trackEvent("raiox_preco_view", { variante_demo: v, chave: estado.escolha });
    } else if (estado.passo === "demo") {
      trackEvent("raiox_demo_view", { chave: estado.escolha, variante_demo: v });
    } else if (estado.passo === "extrato") {
      trackEvent("raiox_extrato_abriu", { variante_demo: v });
    }
  }, [estado.passo, estado.fonte, estado.resumo, estado.escolha, estado.variante_demo]);

  useEffect(() => {
    if (estado.passo !== "sucesso" || metaGravada.current) return;
    metaGravada.current = true;
    const atual = estadoRef.current;
    const meta = metaRef.current ?? montarMeta({
      respostas: atual.respostas,
      resumo: atual.resumo,
      escolha: atual.escolha,
      fonte: atual.fonte,
      quando: mesAno(),
    });
    void supabase.auth.updateUser({ data: { raiox_meta: meta } }).catch(() => { /* a venda já está na conta */ });
  }, [estado.passo]);

  useEffect(() => {
    if (estado.passo !== "sucesso" || !consentir) return;
    const t = window.setTimeout(() => {
      const txs = lerTxs();
      if (!txs.length) return;
      limparTxs();
      void gravarLancamentosNaConta(txs).then(() => gravarTxsLocais(txs));
    }, ESPERA_SALVAR);
    return () => window.clearTimeout(t);
  }, [estado.passo, consentir]);

  useEffect(() => {
    if (estado.passo !== "sucesso" || pediuCodigo.current || plataforma === "web") return;
    pediuCodigo.current = true;
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: "codigo" } });
        const codigo = (data as { codigo?: unknown } | null)?.codigo;
        if (error || !codigoDaPortaOk(codigo)) return;
        setAbrirApp(abrirAppComCodigo(codigo));
        setEstado((e) => ({ ...e, codigo, emailEnviado: !!(data as { email_enviado?: boolean } | null)?.email_enviado }));
      } catch { /* a loja continua na tela */ }
    })();
  }, [estado.passo, plataforma, setEstado]);

  const responder = (faixa: number) => {
    const n = Number(estado.passo.slice(1));
    const p = PERGUNTAS[n - 1];
    if (!p) return;
    trackEvent("raiox_resposta", { q: p.n, faixa: p.opcoes[faixa], variante_demo: estado.variante_demo });
    setEstado((e) => ({ ...e, respostas: { ...e.respostas, [p.chave]: faixa } }));
    if (avanco.current) window.clearTimeout(avanco.current);
    avanco.current = window.setTimeout(() => {
      ir(p.n === 5 ? "calculando" : (`q${p.n + 1}` as PassoRaiox));
    }, ESPERA_QUIZ);
  };

  const voltarQuiz = () => {
    if (avanco.current) window.clearTimeout(avanco.current);
    const n = Number(estado.passo.slice(1));
    if (n > 1) ir(`q${n - 1}` as PassoRaiox);
  };

  const onEmailResultado = async (email: string) => {
    setMandandoEmail(true);
    const h = await hashEmail(email);
    trackEvent("raiox_email", { onde: "resultado", variante_demo: estadoRef.current.variante_demo });
    eventoRaiox("Lead", `raiox_em_${h.slice(0, 12)}`, { content_name: "raiox", em: h }, attrRef.current.fbc || null);
    setEstado((e) => ({ ...e, email: email.trim().toLowerCase() }));
    setMandandoEmail(false);
  };

  const escolher = (chave: Chave) => {
    trackEvent("raiox_escolha", { chave, variante_demo: estadoRef.current.variante_demo });
    setEstado((e) => ({ ...e, escolha: chave }));
    setMicro(ROTULO[chave]);
    if (microTimer.current) window.clearTimeout(microTimer.current);
    microTimer.current = window.setTimeout(() => {
      setMicro(null);
      ir(estadoRef.current.variante_demo === "com" ? "demo" : "plano_preco");
    }, ESPERA_MICRO);
  };

  const vendaAtual = () => montarVenda({
    attr: lerAtribuicao() ?? attrRef.current,
    ids: camp,
    variante: estadoRef.current.variante_demo,
    respostas: Object.fromEntries(CHAVES.map((c) => [c, estadoRef.current.respostas[c] != null ? PERGUNTAS.find((p) => p.chave === c)?.opcoes[estadoRef.current.respostas[c]!] ?? null : null])),
    sessao: sessaoRef.current.id,
  });

  const marcarMeta = () => {
    const atual = estadoRef.current;
    metaRef.current = montarMeta({
      respostas: atual.respostas,
      resumo: atual.resumo,
      escolha: atual.escolha,
      fonte: atual.fonte,
      quando: mesAno(),
    });
  };

  const irJaAssinante = (email: string) => {
    trackEvent("venda_ja_assinante", { via: "raiox", variante_demo: estadoRef.current.variante_demo });
    marcarMeta();
    setMostraConsentir(false);
    setConsentir(false);
    ir("sucesso", { email, jaAssinante: true });
  };

  const conferirAssinatura = async (): Promise<boolean> => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      const d = data as { subscribed?: boolean; subscription_end?: string | null } | null;
      if (d?.subscription_end) setEstado((e) => ({ ...e, fim: d.subscription_end ?? null }));
      return !!d?.subscribed;
    } catch {
      return false;
    }
  };

  const preparar = async (email: string) => {
    const limpo = email.trim().toLowerCase();
    if (emVoo.current) return;
    emVoo.current = true;
    setErroConta(null);
    setContaFase("abrindo");
    try {
      if (isSubscribed && user?.email && user.email.toLowerCase() === limpo) {
        irJaAssinante(limpo);
        return;
      }
      const r = await prepararConta({ email: limpo, nome: "", venda: vendaAtual() });
      if (r.ok === false) {
        if ("existe" in r) { setContaFase("existe"); setEstado((e) => ({ ...e, email: limpo })); return; }
        setErroConta((r as { erro: string }).erro);
        setContaFase("form");
        return;
      }
      setEstado((e) => ({ ...e, email: limpo }));
      if (!r.nova) {
        const ja = await conferirAssinatura();
        if (ja) { irJaAssinante(limpo); return; }
      }
      setContaFase("pix");
    } finally {
      emVoo.current = false;
    }
  };

  useEffect(() => {
    if (estado.passo !== "pix") return;
    if (estado.email) void preparar(estado.email);
    else setContaFase("form");
    // só ao entrar no Pix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  const onPixPago = useCallback((p?: { orderId?: string }) => {
    const atual = estadoRef.current;
    metaRef.current = montarMeta({
      respostas: atual.respostas, resumo: atual.resumo, escolha: atual.escolha, fonte: atual.fonte, quando: mesAno(),
    });
    trackEvent("venda_pago", {
      oferta: "a97", metodo: "pix", valor: PRECO, order_id: p?.orderId ?? atual.pix?.orderId ?? null,
      raiox: true, variante_demo: atual.variante_demo,
    });
    const temExtrato = atual.fonte === "extrato" && lerTxs().length > 0;
    setMostraConsentir(temExtrato);
    setConsentir(temExtrato);
    setEstado((e) => ({ ...e, passo: "sucesso" }));
  }, [setEstado]);

  const onArquivo = async (file: File) => {
    setErroArquivo(false);
    ir("leitura");
    const t0 = performance.now();
    try {
      const parsed = parseExtrato(await lerArquivo(file));
      if (!parsed.length) {
        trackEvent("raiox_extrato_erro", { motivo: "vazio" });
        setErroArquivo(true);
        ir("extrato");
        return;
      }
      const { resumo, txs } = detectarVazamentos(parsed);
      guardarTxs(txs);
      trackEvent("raiox_extrato_lido", { n_tx: parsed.length, ms: Math.round(performance.now() - t0), variante_demo: estadoRef.current.variante_demo });
      setEstado((e) => ({ ...e, resumo, fonte: "extrato", passo: "resultado" }));
    } catch {
      trackEvent("raiox_extrato_erro", { motivo: "leitura" });
      setErroArquivo(true);
      ir("extrato");
    }
  };

  const voltarEstimativa = () => {
    limparTxs();
    void limparTxsLocais();
    const resumo = estimar(estadoRef.current.respostas);
    setErroArquivo(false);
    setEstado((e) => ({ ...e, resumo, fonte: "estimativa", passo: "resultado" }));
  };

  const onDemoFim = useCallback(() => {
    trackEvent("raiox_demo_fim", { chave: estadoRef.current.escolha, variante_demo: estadoRef.current.variante_demo });
  }, []);
  const onDemoPular = useCallback((segundo: number) => {
    trackEvent("raiox_demo_pulou", { segundo, chave: estadoRef.current.escolha, variante_demo: estadoRef.current.variante_demo });
    ir("plano_preco");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pagar = () => {
    dispararCheckout(estadoRef.current.variante_demo, attrRef.current.fbc || null);
    setContaFase(estadoRef.current.email ? "abrindo" : "form");
    ir("pix");
  };

  const hrefLoja = (loja: "ios" | "android") => `/baixar?origem=raiox&loja=${loja}`;

  const nQuiz = estado.passo.startsWith("q") ? Number(estado.passo.slice(1)) : 0;
  const pergunta = nQuiz >= 1 && nQuiz <= 5 ? PERGUNTAS[nQuiz - 1] : null;
  const resumo: ResumoRaiox | null = estado.resumo;
  const chavesEscolha: Chave[] = resumo?.extremo || !resumo?.vazamentos.length
    ? [...CHAVES]
    : resumo.vazamentos.map((v) => v.chave);
  const escolha = estado.escolha;
  const mesEscolha = (() => {
    if (!escolha) return 0;
    const doResumo = resumo?.vazamentos.find((v) => v.chave === escolha)?.mes;
    if (doResumo != null) return doResumo;
    const faixa = estado.respostas[escolha];
    if (faixa == null) return 0;
    return estimar({ [escolha]: faixa }).vazamentos[0]?.mes ?? 0;
  })();

  let corpo: ReactNode = null;
  if (pergunta) {
    corpo = (
      <Quiz
        pergunta={pergunta}
        selecionada={estado.respostas[pergunta.chave] ?? null}
        onEscolher={responder}
        onVoltar={nQuiz > 1 ? voltarQuiz : undefined}
      />
    );
  } else if (estado.passo === "calculando") {
    corpo = <Calculando />;
  } else if (estado.passo === "resultado" && resumo) {
    corpo = (
      <Resultado
        resumo={resumo} quando={mesAno()} email={estado.email}
        onEscolha={() => ir("escolha")} onExtrato={() => ir("extrato")}
        onEmail={(email) => { void onEmailResultado(email); }} enviandoEmail={mandandoEmail}
      />
    );
  } else if (estado.passo === "escolha") {
    corpo = <Escolha chaves={chavesEscolha} micro={micro} onEscolher={escolher} />;
  } else if (estado.passo === "demo" && escolha) {
    const semanal = Math.round(mesEscolha / 4);
    corpo = (
      <Suspense fallback={<p data-testid="raiox-demo-carregando">Carregando…</p>}>
        <Demo chave={escolha} semanal={semanal} onPular={onDemoPular} onFim={onDemoFim} onCta={() => ir("plano_preco")} />
      </Suspense>
    );
  } else if (estado.passo === "plano_preco" && escolha && resumo) {
    corpo = (
      <Preco
        rotulo={ROTULO[escolha]} projecao={resumo.projecao} passos={PASSOS_PLANO[escolha]}
        ancoraDias={diasDaAncora(mesEscolha)} onPix={pagar}
      />
    );
  } else if (estado.passo === "extrato" || estado.passo === "leitura") {
    corpo = <Extrato erro={erroArquivo} lendo={estado.passo === "leitura"} onArquivo={(f) => { void onArquivo(f); }} onVoltar={voltarEstimativa} />;
  } else if (estado.passo === "pix") {
    corpo = (
      <PixRaioX
        fase={contaFase} email={estado.email ?? ""} erro={erroConta} celular={plataforma !== "web"}
        pix={estado.pix} onPix={(p) => setEstado((e) => ({ ...e, pix: p }))} onPago={onPixPago} ids={idsPix}
        onEnviar={(email) => {
          trackEvent("raiox_email", { onde: "pix", variante_demo: estadoRef.current.variante_demo });
          void preparar(email);
        }}
        onSenha={(senha) => {
          void (async () => {
            const ok = await entrarComSenha(estadoRef.current.email ?? "", senha, "", vendaAtual());
            if (!ok) { setErroConta("Senha não bateu. Confere ou receba um código no e-mail."); return; }
            const ja = await conferirAssinatura();
            if (ja) irJaAssinante(estadoRef.current.email ?? "");
            else setContaFase("pix");
          })();
        }}
        onCodigo={() => {
          void (async () => {
            await entrouPorCodigo("", vendaAtual());
            const ja = await conferirAssinatura();
            if (ja) irJaAssinante(estadoRef.current.email ?? "");
            else setContaFase("pix");
          })();
        }}
        onOutroEmail={() => { emVoo.current = false; setErroConta(null); setContaFase("form"); setEstado((e) => ({ ...e, email: null })); }}
      />
    );
  } else if (estado.passo === "sucesso") {
    corpo = (
      <Sucesso
        email={estado.email} rotulo={escolha ? ROTULO[escolha] : "mês"} plataforma={plataforma}
        abrirApp={abrirApp} consentir={consentir} mostraConsentir={mostraConsentir} onConsentir={setConsentir}
        hrefLoja={hrefLoja} onLoja={(loja) => trackEventBeacon("raiox_loja_click", { loja, variante_demo: estado.variante_demo })}
        onAbrir={() => trackEventBeacon("raiox_abrir_click", { variante_demo: estado.variante_demo })}
      />
    );
  }

  return (
    <Shell
      passo={estado.passo} fonte={estado.fonte} demo={estado.variante_demo}
      fundo={FUNDO_CLARO.has(estado.passo) ? "#F7F5F3" : "#FFFFFF"}
      reservaCta={estado.passo === "resultado" || estado.passo === "plano_preco"}
    >
      {corpo}
    </Shell>
  );
}
