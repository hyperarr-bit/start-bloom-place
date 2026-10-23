import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { linkDoPresente, mensagemDoPresente, urlWhatsApp } from "@/lib/presente";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import { EMAIL_OK, abrirSessaoParaPagar, emailAtual, salvarEmailDaCompra, sessaoViva } from "@/pages/hoje/conta";
import { ConfetePresente, IconeZap, IlustraPresente } from "@/presente/IlustraPresente";
import { resgatar, verPresente, type MotivoResgate } from "@/presente/api";
import "@/pages/hoje/funil-hoje.css";
import "@/presente/presente.css";

/**
 * /presente/<código> (21/10) — a página que a PESSOA PRESENTEADA abre pelo link do WhatsApp. Só na WEB (SoNaWeb),
 * noindex. Mockups d1/d2/d3 em scratchpad/presente/mockups.
 *
 *   quem deu ("Ana te deu o CORE pra sempre 💛") + o que vem → e-mail → "Criar minha conta" (o cadastro sem senha do
 *   /hoje: sessão anônima + e-mail; e-mail que já tem conta → código no e-mail) → `presente-resgatar` dá o vitalício
 *   → pós-compra com App Store + Google Play e como entrar no app.
 *   Já tem o CORE pra sempre → mensagem gentil e o código segue valendo ("Passar pra outra pessoa").
 *   O próprio comprador → "Esse presente é pra você dar". Usado / não existe → mensagem curta.
 *
 * Eventos: presente_abriu {estado} · presente_resgatado {via} · presente_resgate_recusado {motivo}.
 */
type Fase = "carregando" | "livre" | "existe" | "ativando" | "ok" | "ja_tem" | "proprio" | "usado" | "nao_existe";

export default function ResgatePresenteRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <ResgatePresente />;
}

export function ResgatePresente() {
  const { codigo: cru = "" } = useParams();
  const codigo = cru.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const navigate = useNavigate();
  const [fase, setFase] = useState<Fase>("carregando");
  const [de, setDe] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [contaAtual, setContaAtual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const abriu = useRef(false);

  /* noindex + título */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow"; meta.setAttribute("data-presente", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "Você ganhou o CORE pra sempre";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const v = await verPresente(codigo);
      if (!vivo) return;
      const estado = v?.estado ?? "nao_existe";
      setDe(v?.de ?? null);
      if (!abriu.current) { abriu.current = true; trackEvent("presente_abriu", { estado, codigo_len: codigo.length }); }
      if (estado !== "livre") { setFase(estado === "usado" ? "usado" : "nao_existe"); return; }
      // já logada com e-mail (conta de verdade): ativa nela
      if (await sessaoViva()) { const atual = await emailAtual(); if (vivo && atual) { setContaAtual(atual); setEmail(atual); } }
      if (vivo) setFase("livre");
    })();
    return () => { vivo = false; };
  }, [codigo]);

  const aplicar = async (via: string) => {
    setFase("ativando");
    const r = await resgatar(codigo);
    if (r.de) setDe(r.de);
    const destino: Partial<Record<MotivoResgate, Fase>> = { ok: "ok", ja_e_seu: "ok", ja_tem: "ja_tem", proprio: "proprio", usado: "usado", nao_existe: "nao_existe" };
    const f = destino[r.motivo];
    if (r.motivo === "ok" || r.motivo === "ja_e_seu") trackEvent("presente_resgatado", { via, repetido: r.motivo === "ja_e_seu" });
    else trackEvent("presente_resgate_recusado", { motivo: r.motivo });
    if (f) { setFase(f); return; }
    setErro("Não consegui ativar agora. Tenta de novo em alguns segundos.");
    setFase("livre");
  };

  const criarConta = async () => {
    setErro(null);
    trackEvent("funnel_click", { funil: "presente", cta: "criar_conta" });
    if (contaAtual) { await aplicar("ja_logada"); return; }
    setFase("ativando");
    if ((await abrirSessaoParaPagar()) === "indisponivel") { setErro("Não consegui abrir agora. Tenta de novo em alguns segundos."); setFase("livre"); return; }
    const res = await salvarEmailDaCompra(email);
    if (res.ok === true) { await aplicar("nova"); return; }
    if ("existe" in res) { setFase("existe"); return; }
    setErro(res.erro);
    setFase("livre");
  };

  const quem = de?.trim() || null;
  const titulo = (txt: string) => <h1 className="pv-titulo">{quem ? <><em>{quem}</em> {txt}</> : "Você ganhou o CORE pra sempre 💛"}</h1>;
  const topo = (direita: React.ReactNode) => <div className="pv-topo"><span className="pv-marca"><i />CORE</span>{direita}</div>;
  const selo = <span className="pv-selo">PRESENTE</span>;
  const compartilhar = (
    <a className="pv-cta" data-zap="" style={{ background: "#1faa59" }} target="_blank" rel="noopener noreferrer"
      href={urlWhatsApp(mensagemDoPresente(codigo, quem))} data-testid="presente-passar"
      onClick={() => trackEvent("presente_whatsapp", { origem: "resgate", motivo: fase })}><IconeZap />Passar pra outra pessoa</a>
  );

  let corpo: React.ReactNode;
  if (fase === "carregando") {
    corpo = <div className="pv-tela"><div className="pv-col">{topo(selo)}<div className="pv-cena pv-cena-pequena"><IlustraPresente size={120} /></div></div></div>;
  } else if (fase === "ok") {
    corpo = (
      <div className="pv-tela" style={{ position: "relative" }} data-testid="presente-resgatado">
        <ConfetePresente />
        <div className="pv-col">
          {topo(<span className="pv-ok"><Check size={14} strokeWidth={3.4} />Presente ativado</span>)}
          <h1 className="pv-titulo" style={{ marginTop: 22 }}>O CORE é <em>seu</em> pra sempre 💛</h1>
          <p className="pv-sub">{quem ? <>Presente de <b>{quem}</b>. </> : null}Nada é cobrado de você</p>
          <div className="pv-lojas" data-testid="presente-lojas">
            <div className="pv-lojas-titulo">Baixe o CORE no celular</div>
            <p>É um app da <b>App Store</b> e da <b>Google Play</b>. Entre com este e-mail:</p>
            {email.trim() && <span className="pv-email-chip">{email.trim().toLowerCase()}</span>}
            <SelosDasLojas onde="presente_resgatado" prefixo="web" altura={44} className="pv-selos" />
            <div className="pv-passos"><b>Como entrar:</b> abra o app → toque em <b>Entrar</b> → <b>Entrar sem senha</b> e use o código que chega no e-mail</div>
          </div>
        </div>
        <div className="pv-rodape">
          <button type="button" className="pv-cta" onClick={() => { trackEvent("funnel_click", { funil: "presente", cta: "abrir_app" }); navigate("/"); }} data-testid="presente-abrir">Abrir meu CORE aqui</button>
          <p className="pv-miuda">No computador, é o mesmo CORE em coreaplicativo.com.br</p>
        </div>
      </div>
    );
  } else if (fase === "ja_tem" || fase === "proprio") {
    corpo = (
      <div className="pv-tela" data-testid={`presente-${fase}`}>
        <div className="pv-col">
          {topo(selo)}
          <div className="pv-cena pv-cena-pequena"><IlustraPresente size={120} /></div>
          <h1 className="pv-titulo">{fase === "ja_tem" ? "Você já tem o CORE pra sempre 💛" : "Esse presente é pra você dar 💛"}</h1>
          <div className="pv-aviso">{fase === "ja_tem"
            ? <>Que bom! Esse presente continua valendo — <b>mande o link pra outra pessoa</b> que você gosta</>
            : <>Mande o link pra quem você quer presentear: <b>{linkDoPresente(codigo).replace("https://www.", "")}</b></>}</div>
        </div>
        <div className="pv-rodape">
          {compartilhar}
          <button type="button" className="pv-nao" onClick={() => navigate("/")}>Abrir meu CORE</button>
        </div>
      </div>
    );
  } else if (fase === "usado" || fase === "nao_existe") {
    corpo = (
      <div className="pv-tela" data-testid={`presente-${fase}`}>
        <div className="pv-col">
          {topo(selo)}
          <div className="pv-cena pv-cena-pequena"><IlustraPresente size={120} /></div>
          <h1 className="pv-titulo">{fase === "usado" ? "Esse presente já foi aberto" : "Não achei esse presente"}</h1>
          <div className="pv-aviso">{fase === "usado"
            ? <>Cada link vale pra 1 pessoa. Se foi você, é só entrar no CORE com o seu e-mail</>
            : <>Confere se o link chegou inteiro. Dúvidas: <b>contato@coreaplicativo.com.br</b></>}</div>
        </div>
        <div className="pv-rodape"><button type="button" className="pv-cta" onClick={() => navigate("/entrar")}>Entrar no CORE</button></div>
      </div>
    );
  } else {
    const ativando = fase === "ativando";
    corpo = (
      <div className="pv-tela" data-testid="presente-livre" data-fase={fase}>
        <div className="pv-col">
          {topo(selo)}
          <div className="pv-cena pv-cena-pequena"><IlustraPresente size={132} /></div>
          {titulo("te deu o CORE pra sempre 💛")}
          <p className="pv-sub">Seu planner da vida inteira, sem pagar nada</p>
          <div className="pv-ganhou"><ul>
            <li><i style={{ background: "#fef3c7" }}>💰</i><span>Finanças, rotina, treino<small>e mais 13 áreas da sua vida</small></span></li>
            <li><i style={{ background: "#fde8f2" }}>♾️</i><span>Pra sempre<small>sem mensalidade, nunca</small></span></li>
            <li><i style={{ background: "#e0f2fe" }}>📱</i><span>No celular e no computador<small>App Store, Google Play e site</small></span></li>
          </ul></div>
          {fase === "existe" ? (
            <div className="pv-campo" data-testid="presente-existe">
              <label>Esse e-mail já tem conta no CORE</label>
              <p style={{ margin: "6px 0 8px", fontSize: 14, color: "#5b5560" }}>Confirme com o código que vamos mandar pra <b>{email.trim().toLowerCase()}</b></p>
              <EntrarComCodigo email={email} funil="presente_ja_tem_conta" rotulo="Receber código no e-mail" onSession={() => { void aplicar("codigo"); }} />
              <button type="button" className="pv-nao" onClick={() => setFase("livre")}>Usar outro e-mail</button>
            </div>
          ) : contaAtual ? (
            <div className="pv-aviso" style={{ textAlign: "left" }}>Vai ativar na sua conta <b>{contaAtual}</b></div>
          ) : (
            <div className="pv-campo">
              <label htmlFor="pv-email">Seu e-mail</label>
              <input id="pv-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com"
                value={email} onChange={(ev) => { setEmail(ev.target.value); setErro(null); }} data-testid="presente-email" />
            </div>
          )}
          {erro && <p className="pv-erro" role="alert">{erro}</p>}
        </div>
        {fase !== "existe" && (
          <div className="pv-rodape">
            <button type="button" className="pv-cta" disabled={ativando || (!contaAtual && !EMAIL_OK.test(email.trim()))} onClick={() => { void criarConta(); }} data-testid="presente-criar">
              {ativando ? "Ativando…" : contaAtual ? "Ativar meu presente" : "Criar minha conta"}
            </button>
            <p className="pv-miuda">Sem senha: você entra com um código no e-mail</p>
          </div>
        )}
      </div>
    );
  }
  return <div className="fn pv" data-testid="presente-pagina"><div className="fn-corpo">{corpo}</div></div>;
}
