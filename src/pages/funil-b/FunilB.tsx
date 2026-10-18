import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import coreLogo from "@/assets/core-logo-black.png";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { EMPRESA } from "@/lib/empresa";
import { localDayKey } from "@/lib/utils";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import { prepararConta, entrarComSenha, entrouPorCodigo, type VendaNaConta } from "@/pages/venda/conta";
import { DadosVenda } from "@/pages/venda/telas-venda";
import { PixVenda, type PixGerado } from "@/pages/venda/PixVenda";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import { eventoMeta, novoEventId, sessaoDaVenda } from "@/pages/venda/rastreio";
import { calcularMapa, dataDeInput, faixaEtaria, type MapaDoTempo } from "./calculo";
import { funilBPermitidoNoHost } from "./acesso";
import "./funil-b.css";

type Tela = "entrada" | "resultado" | "foco" | "oferta" | "dados" | "pix" | "sucesso";
type Foco = "projeto" | "corpo" | "dinheiro" | "rotina";

const PREVIEW_TELAS = new Set<Tela>(["entrada", "resultado", "foco", "oferta", "dados", "pix", "sucesso"]);
const FOCO: Record<Foco, { emoji: string; opcao: string; curto: string; oferta: string }> = {
  projeto: { emoji: "🚀", opcao: "Um projeto que nunca sai do papel", curto: "seu projeto", oferta: "tirar seu projeto do papel" },
  corpo: { emoji: "🏃", opcao: "Meu corpo sempre ficando pra depois", curto: "seu corpo", oferta: "cuidar do seu corpo" },
  dinheiro: { emoji: "💰", opcao: "Dinheiro sem direção", curto: "seu dinheiro", oferta: "colocar seu dinheiro em ordem" },
  rotina: { emoji: "🏠", opcao: "Casa e rotina no improviso", curto: "sua rotina", oferta: "organizar sua casa e rotina" },
};

const dataLonga = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const numero = (n: number) => n.toLocaleString("pt-BR");
const plataforma = (): "ios" | "android" | "web" =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "web";

function Topo({ voltar }: { voltar?: () => void }) {
  return (
    <header className="fb-topo">
      {voltar ? <button type="button" onClick={voltar} className="fb-voltar" aria-label="Voltar"><ArrowLeft /></button> : <span className="fb-topo-vazio" />}
      <img src={coreLogo} alt="CORE" width="72" height="24" />
      <span className="fb-topo-vazio" />
    </header>
  );
}

function Botao({ children, onClick, disabled = false, testid }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; testid?: string }) {
  return <button type="button" className="fb-cta" onClick={onClick} disabled={disabled} data-testid={testid}>{children}</button>;
}

function Entrada({ onResultado }: { onResultado: (mapa: MapaDoTempo) => void }) {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const seguir = () => {
    const data = dataDeInput(valor);
    if (!data) { setErro("Confere a data e tenta de novo."); return; }
    try { onResultado(calcularMapa(data)); }
    catch {
      setErro("O mapa está disponível para pessoas de 18 a 89 anos.");
    }
  };
  return (
    <main className="fb-tela fb-entrada" data-testid="funil-b-entrada">
      <div className="fb-conteudo">
        <div className="fb-selo">Grátis · sem cadastro · resultado na hora</div>
        <h1>Quantos sábados faltam para a sua próxima década?</h1>
        <p className="fb-sub">Digite sua data de nascimento. A gente transforma o tempo até os 30, 40, 50… em um mapa que cabe na tela.</p>
        <label className="fb-label" htmlFor="fb-nascimento">Sua data de nascimento</label>
        <input
          id="fb-nascimento" type="date" value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); }}
          min="1936-01-01" max={localDayKey(new Date())} className="fb-input" data-testid="funil-b-data"
        />
        {erro && <p className="fb-erro" role="alert">{erro}</p>}
        <div className="fb-mini-mapa" aria-hidden>{Array.from({ length: 52 }, (_, i) => <i key={i} className={i < 12 ? "aceso" : ""} />)}</div>
        <p className="fb-mini-legenda">Uma bolinha para cada sábado do seu próximo ano.</p>
      </div>
      <div className="fb-rodape">
        <Botao onClick={seguir} disabled={!valor} testid="funil-b-ver-mapa">Ver meu mapa <ChevronRight /></Botao>
        <p><LockKeyhole /> Sua data fica só neste navegador.</p>
      </div>
    </main>
  );
}

function Resultado({ mapa, onContinuar, onRefazer }: { mapa: MapaDoTempo; onContinuar: () => void; onRefazer: () => void }) {
  const pontos = Math.min(mapa.sabados, 530);
  return (
    <main className="fb-tela fb-resultado" data-testid="funil-b-resultado">
      <div className="fb-conteudo">
        <div className="fb-selo">Seu mapa · até os {mapa.marco} anos</div>
        <p className="fb-numero"><strong>{numero(mapa.sabados)}</strong> sábados</p>
        <h1>até {dataLonga(mapa.dataMarco)}.</h1>
        <div className="fb-metricas">
          <span><b>{numero(mapa.dias)}</b> dias</span>
          <span><b>{numero(mapa.semanas)}</b> semanas</span>
          <span><b>{mapa.anoDeVida}º</b> ano de vida</span>
        </div>
        <div className="fb-mapa" aria-label={`${mapa.sabados} sábados até os ${mapa.marco} anos`}>
          {Array.from({ length: pontos }, (_, i) => <i key={i} className={i < Math.min(52, pontos) ? "proximo" : ""} />)}
        </div>
        {mapa.sabados > pontos && <p className="fb-limite">+ {numero(mapa.sabados - pontos)} sábados</p>}
        <div className="fb-legenda"><span><i className="rosa" /> próximos 12 meses</span><span><i /> depois</span></div>
        <blockquote>“O tempo não está acabando hoje. Mas ele também não volta.”</blockquote>
      </div>
      <div className="fb-rodape">
        <Botao onClick={onContinuar}>Escolher o que eu não vou adiar <ChevronRight /></Botao>
        <button type="button" className="fb-link" onClick={onRefazer}>Refazer com outra data</button>
      </div>
    </main>
  );
}

function Escolha({ escolhido, onEscolher, onContinuar }: { escolhido: Foco | null; onEscolher: (f: Foco) => void; onContinuar: () => void }) {
  return (
    <main className="fb-tela fb-escolha" data-testid="funil-b-foco">
      <div className="fb-conteudo">
        <div className="fb-kicker">Uma escolha, não um quiz</div>
        <h1>O que você não quer levar igual para a próxima década?</h1>
        <div className="fb-opcoes">
          {(Object.keys(FOCO) as Foco[]).map((id) => (
            <button key={id} type="button" className={escolhido === id ? "selecionado" : ""} onClick={() => onEscolher(id)}>
              <span>{FOCO[id].emoji}</span><b>{FOCO[id].opcao}</b>{escolhido === id && <Check />}
            </button>
          ))}
        </div>
        {escolhido && <div className="fb-fechado">Fechado 🤝 Não precisa mudar tudo. Precisa proteger a próxima semana.</div>}
      </div>
      {escolhido && <div className="fb-rodape"><Botao onClick={onContinuar}>Ver como o CORE ajuda <ChevronRight /></Botao></div>}
    </main>
  );
}

function Oferta({ mapa, foco, onPagar }: { mapa: MapaDoTempo; foco: Foco; onPagar: () => void }) {
  return (
    <main className="fb-tela fb-oferta" data-testid="funil-b-oferta">
      <div className="fb-conteudo">
        <div className="fb-selo">Seu próximo ano</div>
        <h1>Faça as próximas 52 semanas contarem para <em>{FOCO[foco].oferta}.</em></h1>
        <p className="fb-sub">O CORE reúne o que você precisa para sair do “depois” e acompanhar a vida real.</p>
        <ul className="fb-beneficios">
          <li><Check /><span><b>Metas em partes menores</b>Quebre uma meta em tarefas e marcos.</span></li>
          <li><Check /><span><b>Sua semana à vista</b>Planeje compromissos e acompanhe hábitos.</span></li>
          <li><Check /><span><b>Volte antes de se perder</b>Use lembretes e faça sua revisão semanal.</span></li>
        </ul>
        <div className="fb-modulos"><b>16 módulos inclusos</b><div><span>Finanças</span><span>Rotina</span><span>Treino</span><span>Dieta</span><span>Metas</span><span>+11</span></div></div>
        <div className="fb-preco">
          <span className="fb-preco-selo">Plano anual</span>
          <p>R$ <strong>97,90</strong> <small>uma vez</small></p>
          <b>1 ano de CORE · R$ 1,88 por semana</b>
          <hr />
          <span>Seu mapa tem <b>{numero(mapa.sabados)} sábados</b> até os {mapa.marco}. Comece pelos próximos 52.</span>
          <Botao onClick={onPagar} testid="funil-b-pagar">Começar meu ano no Pix</Botao>
          <small>O código aparece aqui · sem renovação automática</small>
        </div>
        <div className="fb-garantia"><ShieldCheck /><span><b>7 dias de garantia.</b> Não gostou, devolvemos tudo.</span></div>
        <div className="fb-faq">
          <details><summary>É mensal?</summary><p>Não. É um pagamento único por 1 ano de acesso.</p></details>
          <details><summary>Funciona onde?</summary><p>No iPhone, Android e computador.</p></details>
          <details><summary>O CORE cria meu plano sozinho?</summary><p>Não. Você decide suas metas; o CORE reúne as ferramentas para planejar e acompanhar.</p></details>
        </div>
        <p className="fb-empresa">CORE Aplicativo · CNPJ {EMPRESA.cnpj}<br />Pagamento processado pela Asaas</p>
      </div>
    </main>
  );
}

function PixPreview() {
  return (
    <main className="fb-tela fb-checkout" data-testid="funil-b-pix-preview">
      <div className="fb-conteudo">
        <div className="fb-selo">Último passo</div>
        <h1>Pague com Pix pra liberar</h1>
        <p className="fb-sub">Plano anual · <b>R$ 97,90</b> · 1 ano de acesso</p>
        <div className="fb-qr"><QRCodeSVG value="000201CORE-PREVIEW-FUNIL-B" size={176} /></div>
        <div className="fb-copia">00020126••••••••••••••••••FUNILB</div>
        <button type="button" className="fb-cta">Copiar código Pix</button>
        <ol><li>Abra o app do seu banco e escolha Pix.</li><li>Cole em “Pix copia e cola”.</li><li>Confirme. O CORE libera aqui na hora.</li></ol>
        <div className="fb-esperando">Aguardando o pagamento…</div>
      </div>
    </main>
  );
}

export default function FunilB() {
  if (!funilBPermitidoNoHost(window.location.hostname)) return <Navigate to="/" replace />;
  return <FunilBConteudo />;
}

function FunilBConteudo() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const preview = PREVIEW_TELAS.has(params.get("preview") as Tela) ? params.get("preview") as Tela : null;
  const mapaPreview = useMemo(() => calcularMapa(new Date(1992, 3, 12)), []);
  const [tela, setTela] = useState<Tela>(preview ?? "entrada");
  const [mapa, setMapa] = useState<MapaDoTempo | null>(preview && preview !== "entrada" ? mapaPreview : null);
  const [foco, setFoco] = useState<Foco | null>(preview && ["foco", "oferta", "dados", "pix", "sucesso"].includes(preview) ? "projeto" : null);
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const { user, isSubscribed } = useAuth();
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string } | null>(null);
  if (!inicio.current) inicio.current = { attr: capturarAtribuicao(), sessao: sessaoDaVenda().id };
  const ids = useCallback(() => {
    const { porta_session_id: _porta, ...attr } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, inicio.current!.sessao);
    return { ...attr, funil: "b", funil_b_session_id: inicio.current!.sessao };
  }, []);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow"; document.head.appendChild(meta);
    const titulo = document.title; document.title = "CORE · Mapa dos Sábados";
    if (!preview) {
      trackEvent("funil_b_view", { ...ids() });
      eventoMeta("ViewContent", novoEventId("vc"), { content_name: "funil_b_mapa_sabados", content_category: "venda" }, inicio.current?.attr.fbc);
    }
    return () => { meta.remove(); document.title = titulo; };
  }, [ids, preview]);

  useEffect(() => { window.scrollTo(0, 0); }, [tela]);

  const venda = (): VendaNaConta => ({
    v: 1,
    attr: lerAtribuicao() ?? inicio.current!.attr,
    respostas: {
      variante: "funil_b",
      faixa_etaria: mapa ? faixaEtaria(mapa.idade) : null,
      marco: mapa ? String(mapa.marco) : null,
      foco,
    },
    plano: "anual",
    metodo: "pix",
    venda_session_id: inicio.current!.sessao,
    criado_em: new Date().toISOString(),
  });

  const jaAssinante = async () => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      return !!(data as { subscribed?: boolean } | null)?.subscribed;
    } catch { return false; }
  };
  const seguirPagamento = async (n: string, e: string) => {
    setNome(n); setEmail(e.toLowerCase());
    if (await jaAssinante()) { setTela("sucesso"); return; }
    setTela("pix");
  };
  const onDados = async (n: string, e: string) => {
    if (isSubscribed && user?.email?.toLowerCase() === e.toLowerCase()) { await seguirPagamento(n, e); return { ok: true } as const; }
    const r = await prepararConta({ nome: n, email: e, venda: venda() });
    if (!r.ok) return "existe" in r ? { ok: false, existe: true } as const : { ok: false, erro: r.erro } as const;
    await seguirPagamento(n, e);
    return { ok: true } as const;
  };

  let conteudo: React.ReactNode;
  if (tela === "entrada") {
    conteudo = <><Topo /><Entrada onResultado={(m) => {
      setMapa(m); setTela("resultado");
      trackEvent("funil_b_resultado", { faixa_etaria: faixaEtaria(m.idade), marco: m.marco, sabados_faixa: Math.floor(m.sabados / 50) * 50, ...ids() });
    }} /></>;
  } else if (tela === "resultado" && mapa) {
    conteudo = <><Topo voltar={() => setTela("entrada")} /><Resultado mapa={mapa} onContinuar={() => setTela("foco")} onRefazer={() => { setMapa(null); setFoco(null); setTela("entrada"); }} /></>;
  } else if (tela === "foco") {
    conteudo = <><Topo voltar={() => setTela("resultado")} /><Escolha escolhido={foco} onEscolher={(f) => { setFoco(f); trackEvent("funil_b_foco", { foco: f, ...ids() }); }} onContinuar={() => { setTela("oferta"); trackEvent("funil_b_oferta_view", { foco, ...ids() }); }} /></>;
  } else if (tela === "oferta" && mapa && foco) {
    conteudo = <><Topo voltar={() => setTela("foco")} /><Oferta mapa={mapa} foco={foco} onPagar={() => {
      trackEvent("funil_b_pagar_click", { metodo: "pix", valor: 97.9, foco, ...ids() });
      eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: "core_anual_funil_b", value: 97.9, currency: "BRL", content_category: "pix" }, inicio.current?.attr.fbc);
      setTela("dados");
    }} /></>;
  } else if (tela === "dados") {
    conteudo = (
      <><Topo voltar={() => setTela("oferta")} /><main className="fb-tela fb-checkout"><div className="fb-conteudo">
        <DadosVenda
          plano="anual" metodo="pix" nomeInicial={nome} emailInicial={email}
          emailLogado={user?.email ?? null} onEnviar={onDados}
          onEntrarSenha={async (e, senha, n) => {
            const ok = await entrarComSenha(e, senha, n, venda());
            if (ok) await seguirPagamento(n, e);
            return ok;
          }}
          onEntrouCodigo={async (n, e) => { await entrouPorCodigo(n, venda()); await seguirPagamento(n, e); }}
          onTrocarPlano={() => setTela("oferta")}
          onErroCampo={(campo, motivo) => trackEvent("funil_b_dados_erro", { campo, motivo, ...ids() })}
        />
      </div></main></>
    );
  } else if (tela === "pix" && preview) {
    conteudo = <><Topo voltar={() => setTela("dados")} /><PixPreview /></>;
  } else if (tela === "pix") {
    conteudo = (
      <><Topo voltar={() => setTela("dados")} /><main className="fb-tela fb-checkout"><div className="fb-conteudo">
        <PixVenda
          pix={pix} onPix={setPix} onPago={() => {
            trackEvent("venda_pago", { oferta: "a97", metodo: "pix", valor: 97.9, order_id: pix?.orderId ?? null, variante: "funil_b", ...ids() });
            setTela("sucesso");
          }}
          ids={ids} celular={plataforma() !== "web"} oferta="a97" plano="anual" rotulo="Plano anual"
        />
        <p className="fb-ajuda-pix">Pagou e a tela não mudou? O acesso chega no seu e-mail em até 2 minutos.</p>
      </div></main></>
    );
  } else {
    const p = plataforma();
    conteudo = (
      <><Topo /><main className="fb-tela fb-checkout"><div className="fb-conteudo">
        <SucessoVenda
          plataforma={p} email={email || "voce@email.com"} plano="anual" confirmado voltou={false} abrirApp={null} emailEnviado={false} fimDoAcesso={null}
          hrefLoja={(loja) => `/baixar?origem=funil_b${loja ? `&loja=${loja}` : ""}`} qrUrl="https://coreaplicativo.com.br/baixar?origem=funil_b"
          onLoja={(loja) => trackEvent("funil_b_loja_click", { loja, ...ids() })} onAbrirApp={() => {}}
          planoTexto="Plano anual · 1 ano de acesso"
        />
      </div></main></>
    );
  }

  return <div className="funil-b" data-tela={tela}>{conteudo}</div>;
}

