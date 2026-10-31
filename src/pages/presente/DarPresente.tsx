import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { EMPRESA } from "@/lib/empresa";
import { useAuth } from "@/hooks/use-auth";
import type { EstadoPresente } from "@/lib/presente";
import { IlustraPresente } from "@/presente/IlustraPresente";
import { TelaCartao } from "@/presente/FluxoPresente";
import { copiarTexto, estadoDia3, nomeDia3, sairDia3, tokenDia3, type PixDia3 } from "@/presente/api";
import "@/pages/hoje/funil-hoje.css";
import "@/presente/presente.css";

/**
 * /presente/dar (31/10) — o PRESENTE NO DIA 3: "Leve alguém junto", o CORE pra sempre de presente por R$ 14,90.
 * Só na WEB (SoNaWeb), noindex. Entra pelo botão do e-mail do dia 3 (?t=<token>) ou pelo aviso da página Você (o app
 * pede o token da conta e abre com ?t=). Sem login de propósito: quem toca no e-mail quase nunca está logado no navegador
 * — o token diz de quem é (supabase/functions/_shared/presente-dia3.ts).
 *
 *   abre → o Pix já é gerado (pré-aquecido; 24 h, 1 por conta) → "Copiar o Pix" copia NO TOQUE → "Pagou? Volte aqui"
 *        → a tela confere sozinha (LACO_DAR: 4 s nos 10 primeiros minutos, 30 s até 30 min, depois para; sempre na volta do
 *          app do banco e no "Já paguei" — crítica r2: era 4 s sem teto por 24 h) → pago → o cartão do presente com o link
 *          /presente/<código> + "Enviar no WhatsApp" (o TelaCartao de 21/10) → "Pronto" abre o CORE.
 *   Sem token e logado (conta com o CORE pra sempre) → pede o token da conta. Sem os dois → "Abra pelo link do e-mail".
 *
 * Crítica r1: "Preço de presente, só pra quem já tem o CORE" (quem pagou R$ 27,90 pensava "paguei o dobro?"); o "Código
 * copiado" volta igual depois da recarga do banco (marca no aparelho por pedido); ?sair=1 (o rodapé do e-mail) grava
 * "Não quero ofertas por e-mail" e não gera Pix nenhum.
 *
 * Eventos: presente_d3_view {origem} · presente_d3_copiar {ok} · presente_d3_pago · presente_d3_erro {motivo}
 * (+ os do cartão com origem "dia3": presente_whatsapp, presente_link_copiado). Nenhum Purchase (recomendação, confirmar com o dono:
 * upsell não manda Purchase pra Meta; o servidor manda só a UTMify).
 */
type Fase = "carregando" | "pix" | "pago" | "sem_link" | "token" | "sem_acesso" | "erro" | "saiu";

/** O "Código copiado" sobrevive à recarga do banco (o Instagram/Safari recarregam a aba na volta). Por pedido. */
const CHAVE_COPIADO = "presente-d3-copiado";
const lerCopiado = (pedido: string): boolean => { try { return localStorage.getItem(CHAVE_COPIADO) === pedido; } catch { return false; } };
const gravarCopiado = (pedido: string) => { try { localStorage.setItem(CHAVE_COPIADO, pedido); } catch { /* fica na memória */ } };
const querSair = (): boolean => { try { return new URLSearchParams(window.location.search).get("sair") === "1"; } catch { return false; } };

/** O laço de conferência (crítica r2, o mesmo desenho do LACO_U2027 da /organizar): rápido nos 10 primeiros minutos (a Asaas
 *  1 a cada 3), devagar até 30 min (a Asaas a cada vez), depois para — ficam a volta da aba e o "Já paguei". */
export const LACO_DAR = { rapidoMs: 4000, lentoMs: 30_000, viraLentoMs: 10 * 60e3, paraMs: 30 * 60e3, asaasCada: 3 } as const;
/** "Vale por 24 h" num código novo (crítica r2: abria em "mais 23 h", que parece código velho; igual ao validadeU2027). */
export const valeAte = (iso: string, agora: number = Date.now()): string => {
  const ms = Date.parse(iso) - agora;
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const h = ms / 3_600_000;
  if (h >= 23.5) return "Vale por 24 h";
  return h >= 1 ? `Vale por mais ${Math.floor(h)} h` : `Vale por mais ${Math.max(1, Math.round(ms / 60_000))} min`;
};

export default function DarPresenteRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <DarPresente />;
}

export function DarPresente() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [t, setT] = useState<string | null>(() => {
    try { const v = new URLSearchParams(window.location.search).get("t"); return v && /^[A-Za-z0-9]{32}$/.test(v) ? v : null; } catch { return null; }
  });
  const [fase, setFase] = useState<Fase>("carregando");
  const [pix, setPix] = useState<PixDia3 | null>(null);
  const [pago, setPago] = useState<{ pedido: string; codigo: string; de: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  /** o navegador negou a cópia (crítica r2: dizia "Código copiado" mesmo assim) */
  const [copiaFalhou, setCopiaFalhou] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const origem = useRef<string>((() => { try { return new URLSearchParams(window.location.search).get("utm_source") ?? "direto"; } catch { return "direto"; } })());

  /* noindex + título */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow"; meta.setAttribute("data-presente", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "Leve alguém junto · CORE";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof estadoDia3>>, viaGerar: boolean) => {
    if (r.ok === false) {
      if (r.motivo === "rede" && !viaGerar) return; // conferência: a rede piscou, tenta na próxima
      trackEvent("presente_d3_erro", { motivo: r.motivo, origem: origem.current });
      setFase(r.motivo === "token" ? "token" : r.motivo === "sem_acesso" ? "sem_acesso" : "erro");
      return;
    }
    if (r.pago === true) {
      setPago((x) => {
        if (!x) trackEvent("presente_d3_pago", { origem: origem.current });
        return { pedido: r.pedido, codigo: r.codigo, de: r.de };
      });
      setFase("pago");
      return;
    }
    if (r.pix) { setPix(r.pix); if (lerCopiado(r.pix.orderId)) setCopiado(true); setFase("pix"); }
    else if (viaGerar) setFase("erro");
  }, []);

  /* o token: da URL, ou (logado com o CORE pra sempre, sem token) o da própria conta */
  useEffect(() => {
    if (t || loading) return;
    if (!user || (user as { is_anonymous?: boolean }).is_anonymous) { setFase("sem_link"); return; }
    let vivo = true;
    void tokenDia3().then((novo) => {
      if (!vivo) return;
      if (!novo) { setFase("sem_acesso"); return; }
      try { const u = new URL(window.location.href); u.searchParams.set("t", novo); window.history.replaceState(window.history.state, "", u.toString()); } catch { /* fica na memória */ }
      setT(novo);
    });
    return () => { vivo = false; };
  }, [t, user, loading]);

  /* com o token: o Pix já sai gerado (pré-aquecido) — o toque em "Copiar" só copia */
  const gerar = useCallback(async () => {
    if (!t) return;
    setGerando(true);
    const r = await estadoDia3(t, { gerar: true, conferir: true });
    setGerando(false);
    aplicar(r, true);
  }, [t, aplicar]);
  const viu = useRef(false);
  useEffect(() => {
    if (!t) return;
    if (querSair()) { // o rodapé do e-mail: só grava a recusa (nenhum Pix)
      void sairDia3(t).then((ok) => { trackEvent("presente_d3_sair", { ok }); setFase(ok ? "saiu" : "token"); });
      return;
    }
    if (!viu.current) { viu.current = true; trackEvent("presente_d3_view", { origem: origem.current }); }
    void gerar();
  }, [t, gerar]);

  /* confere sozinha (LACO_DAR): 4 s nos 10 primeiros minutos (Asaas 1 a cada 3), 30 s até 30 min (Asaas sempre), depois
   * para; só com a aba à vista. A volta do app do banco e o "Já paguei" conferem na Asaas e religam o laço (dentro dos 30 min). */
  const pedidoNaTela = pix?.orderId ?? null;
  const conferirAgora = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    if (!t || fase !== "pix" || !pedidoNaTela) return;
    let parado = false;
    let n = 0;
    let rodando = false;
    let timer: number | null = null;
    const desde = Date.now();
    const conferir = async (forcar = false): Promise<boolean> => {
      if (parado || rodando || (!forcar && document.visibilityState === "hidden")) return false;
      rodando = true;
      const lento = Date.now() - desde >= LACO_DAR.viraLentoMs;
      try {
        const r = await estadoDia3(t, { pedido: pedidoNaTela, conferir: forcar || lento || ++n % LACO_DAR.asaasCada === 0 });
        aplicar(r, false);
        return r.ok === true && r.pago === true;
      } finally { rodando = false; }
    };
    const proximo = () => {
      if (parado || timer !== null) return;
      const passou = Date.now() - desde;
      if (passou > LACO_DAR.paraMs || document.visibilityState === "hidden") return; // a volta da aba religa
      timer = window.setTimeout(() => {
        timer = null;
        if (Date.now() - desde > LACO_DAR.paraMs) return; // o último passo cairia depois dos 30 min
        void conferir().then(() => proximo());
      }, passou < LACO_DAR.viraLentoMs ? LACO_DAR.rapidoMs : LACO_DAR.lentoMs);
    };
    conferirAgora.current = () => conferir(true);
    proximo();
    const aoVoltar = () => { if (document.visibilityState === "visible") { void conferir(true); proximo(); } };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);
    return () => {
      parado = true;
      if (timer !== null) window.clearTimeout(timer);
      conferirAgora.current = async () => false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
    };
  }, [t, fase, pedidoNaTela, aplicar]);

  const copiar = async () => {
    if (!pix) return;
    const ok = await copiarTexto(pix.qrCode);
    // crítica r2: só diz "copiado" quando copiou; senão o código fica selecionável e a tela pede o toque nele
    setCopiado(ok);
    setCopiaFalhou(!ok);
    if (ok) gravarCopiado(pix.orderId);
    trackEvent("presente_d3_copiar", { ok, origem: origem.current });
  };
  const jaPaguei = async () => {
    trackEvent("presente_d3_ja_paguei", { origem: origem.current });
    setAviso(null);
    if (!(await conferirAgora.current())) setAviso("Ainda não chegou. Confere no app do banco: quando cair, esta tela muda sozinha.");
  };

  const topo = (
    <div className="pv-topo"><span className="pv-marca"><i />CORE</span></div>
  );

  let corpo: JSX.Element;
  if (fase === "pago" && pago) {
    const estado: EstadoPresente = { v: 1, compra: "dia3", etapa: "cartao", pix: null, pedido: pago.pedido, codigo: pago.codigo, de: pago.de, plano30: null };
    corpo = (
      <TelaCartao estado={estado} nomeSugerido={pago.de}
        evento={(nome, extra = {}) => trackEvent(nome, { ...extra, origem: "dia3" })}
        onCodigo={() => { /* o código já veio com o "pago" */ }}
        onNome={(de) => setPago((x) => (x ? { ...x, de } : x))}
        buscarPresente={async () => ({ codigo: pago.codigo, de: pago.de })}
        gravarNome={(pedido, nome) => (t ? nomeDia3(t, pedido, nome) : Promise.resolve(false))}
        rotuloContinuar="Pronto" onContinuar={() => navigate(ENTRADA_APP)}
        nota="O link também foi pro seu e-mail, se você fechar antes de mandar." />
    );
  } else if (fase === "pix" && pix) {
    const validade = valeAte(pix.expiresAt);
    corpo = (
      <div className="pv-tela" data-testid="dar-pix" data-copiado={copiado ? "" : undefined}>
        <div className="pv-col">
          {topo}
          <div className="pv-cena pv-cena-pequena"><IlustraPresente size={112} /></div>
          <h1 className="pv-titulo">Leve alguém <em>junto</em></h1>
          <p className="pv-sub">Dê o CORE pra sempre pra quem você quer bem. <b>R$ 14,90, uma vez.</b> Sem mensalidade.</p>
          <p className="dp-preco" data-testid="dar-preco-presente">Preço de presente, só pra quem já tem o CORE.</p>
          {copiado ? (
            <div className="dp-volte" data-testid="dar-volte" role="status">
              <b>Código copiado.</b> Cole no app do banco: Pix → Copia e Cola.
              <span><i />Pagou? Volte aqui. A tela muda sozinha.</span>
            </div>
          ) : copiaFalhou ? (
            <div className="dp-volte dp-falta" data-testid="dar-copia-falhou" role="status">
              <b>Toque no código pra copiar.</b> Depois cole no app do banco: Pix → Copia e Cola.
              <span><i />Pagou? Volte aqui. A tela muda sozinha.</span>
            </div>
          ) : (
            <div className="pv-como"><div><b>1</b>Você paga o Pix</div><div><b>2</b>Manda o link</div><div><b>3</b>A pessoa cria a conta</div></div>
          )}
          <div className="fn-codigo" data-testid="dar-codigo" style={{ margin: "14px 0 0", ...(copiaFalhou ? { userSelect: "all" as const, WebkitUserSelect: "all" as const } : {}) }}>{pix.qrCode}</div>
          <details className="fn-qr" data-testid="dar-qr" style={{ margin: "10px 0 0" }}>
            <summary><QrCode size={18} strokeWidth={2.2} />Pagar com QR Code<span>de outro aparelho</span></summary>
            <div className="fn-qr-caixa"><div>
              {pix.qrCodeBase64
                ? <img src={pix.qrCodeBase64} alt="QR code do Pix" width={156} height={156} style={{ display: "block" }} />
                : <QRCodeSVG value={pix.qrCode} size={156} level="M" />}
            </div></div>
          </details>
          {validade && <div className="fn-validade" data-testid="dar-validade" style={{ margin: "10px 0 0" }}>{validade}</div>}
          {aviso && <p className="dp-preco" role="status" data-testid="dar-aviso" style={{ marginTop: 10 }}>{aviso}</p>}
        </div>
        <div className="pv-rodape">
          <button type="button" className="pv-cta" data-testid="dar-copiar" data-ok={copiado ? "" : undefined}
            style={copiado ? { background: "#16a34a" } : undefined} onClick={() => { void copiar(); }}>
            {copiado ? <><Check size={19} strokeWidth={3} /><span>Copiado · copiar de novo</span></> : <><Copy size={19} strokeWidth={2.4} /><span>Copiar o Pix · R$ 14,90</span></>}
          </button>
          {(copiado || copiaFalhou) && <button type="button" className="pv-nao" data-testid="dar-ja-paguei" onClick={() => { void jaPaguei(); }}>Já paguei</button>}
          <p className="pv-miuda" data-testid="dar-cnpj" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><ShieldCheck size={13} strokeWidth={2.4} style={{ color: "#16a34a", flexShrink: 0 }} /><span>CORE · CNPJ {EMPRESA.cnpj}</span></p>
        </div>
      </div>
    );
  } else if (fase === "carregando" || gerando) {
    corpo = (
      <div className="pv-tela" data-testid="dar-carregando">
        <div className="pv-col">
          {topo}
          <div className="pv-cena pv-cena-pequena"><IlustraPresente size={112} /></div>
          <h1 className="pv-titulo">Leve alguém <em>junto</em></h1>
          <p className="pv-sub"><Loader2 size={14} className="fn-gira" style={{ verticalAlign: "-2px", marginRight: 6 }} />Preparando o seu Pix…</p>
        </div>
      </div>
    );
  } else {
    const textos: Record<Exclude<Fase, "carregando" | "pix" | "pago">, { titulo: string; texto: string; botao: string; acao: () => void }> = {
      // crítica r2 (honestidade): a recusa só vale pra este e-mail (o único de oferta hoje) — não prometer mais que isso
      saiu: { titulo: "Pronto, esse e-mail não chega mais", texto: "Os e-mails da sua conta continuam chegando.", botao: "Abrir o CORE", acao: () => navigate(ENTRADA_APP) },
      // crítica r2: a linha "Leve alguém junto" da página Você quase nunca existe (chave off, só site, some no ×) — não mandar procurar
      sem_link: { titulo: "Abra pelo link do e-mail", texto: "O botão do e-mail “Leve alguém junto” abre esta página. Dúvidas: contato@coreaplicativo.com.br", botao: "Abrir o CORE", acao: () => navigate(ENTRADA_APP) },
      token: { titulo: "Esse link venceu", texto: "Fale com a gente: contato@coreaplicativo.com.br", botao: "Abrir o CORE", acao: () => navigate(ENTRADA_APP) },
      sem_acesso: { titulo: "O presente é pra quem tem o CORE pra sempre", texto: "Dúvidas: contato@coreaplicativo.com.br", botao: "Abrir o CORE", acao: () => navigate(ENTRADA_APP) },
      erro: { titulo: "Não consegui gerar o Pix agora", texto: "Tenta de novo em alguns segundos.", botao: "Tentar de novo", acao: () => { void gerar(); } },
    };
    const x = textos[fase as keyof typeof textos] ?? textos.erro;
    corpo = (
      <div className="pv-tela" data-testid={`dar-${fase}`}>
        <div className="pv-col">
          {topo}
          <div className="pv-cena pv-cena-pequena"><IlustraPresente size={112} /></div>
          <h1 className="pv-titulo" style={{ fontSize: 26 }}>{x.titulo}</h1>
          <p className="pv-sub">{x.texto}</p>
        </div>
        <div className="pv-rodape"><button type="button" className="pv-cta" onClick={x.acao}>{x.botao}</button></div>
      </div>
    );
  }
  return (
    <div className="fn pv" data-testid="dar-pagina">
      <style>{CSS_DAR}</style>
      <div className="fn-corpo">{corpo}</div>
    </div>
  );
}

/* Só desta página (o presente.css e o funil-hoje.css não mudam). */
const CSS_DAR = `
.dp-preco { margin: 6px 0 0; font-size: 13.5px; line-height: 1.4; color: #6b6575; text-align: center; }
.dp-volte { margin-top: 18px; padding: 14px 16px; border-radius: 18px; background: #fff; box-shadow: 0 1px 2px rgba(22,18,28,.05), 0 10px 30px rgba(22,18,28,.09); font-size: 14.5px; line-height: 1.45; color: #3b3542; text-align: center; }
.dp-volte b { color: #15803d; }
.dp-volte.dp-falta b { color: #16121c; }
.dp-volte span { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; font-weight: 700; color: #16121c; }
.dp-volte span i { width: 8px; height: 8px; border-radius: 50%; background: #d97706; animation: fn-pulsa 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .dp-volte span i { animation: none; } }
`;
