/**
 * /vendas (29/10) — o painel do dono no iPhone: aviso de cada venda (Web Push da PWA "CORE Vendas") + 5 abas
 * (Vendas · Dias · Turmas · Campanhas · Web). 02/11: "Dias" = cada dia desde a campanha bid (28/10) com o vendido e o
 * lucro (já com o imposto da Meta e o da empresa); as Turmas também vão até 28/10. Tudo é calculado no servidor (vendas-painel / vendas-push, só admin); aqui só
 * se mostra. Atualiza ao abrir, ao voltar pro app (se passou 60 s), no botão e no puxar-pra-atualizar — sem polling.
 *
 * Acesso: sem sessão → entrar (a PWA da Tela de Início tem armazenamento próprio no iPhone, então o login é aqui);
 * com sessão de quem não é admin (user_roles, a mesma checagem do /admin) → volta pra home, nada é mostrado.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { desligarAvisos, estaInstalada, inscricaoAtual, ligarAvisos, suportaPush } from "./push";

/* ------------------------------------------------------------ tipos da resposta do vendas-painel */
type Cor = "verde" | "amarelo" | "vermelho" | "neutro";
type Origem = "pix" | "apple" | "play";
type ItemVenda = { hora: string; valor_cents: number; origem: Origem; plano: string; renovacao: boolean };
type RespVendas = { dia: string; itens: ItemVenda[]; total_cents: number; porOrigem: Record<Origem, { n: number; cents: number }> };
type Turma = {
  dia: string; situacao: "fecha_hoje" | "aberta" | "fechada"; fechaEm: string; testes: number; pagaram: number; pctPagaram: number | null;
  recusas: number; cancelaram: number; emTeste: number; outros: number; mensais: number; gasto: number; custoPorTeste: number | null;
  liquido: number; retorno: number | null; cor: Cor;
};
type RespTurmas = { dia: string; turmas: Turma[]; semEstadoRC: number; errosMeta: string[] };
type Campanha = {
  nome: string; conta: string; tipo: "app" | "site" | "outra"; status: string; orcamentoDia: number | null; gasto: number;
  cpm: number | null; ctr: number | null; cpc: number | null; testes: number; custoPorTeste: number | null; compras: number;
  valorCompras: number; roas: number | null; cor: Cor;
};
type RespCampanhas = { periodo: string; desde: string; ate: string; campanhas: Campanha[]; fusos: Record<string, string>; errosMeta: string[]; totais: { gasto: number; gastoApp: number; testes: number; custoPorTeste: number | null } };
type PeriodoWeb = { vendas: number; receita: number; gasto: number; retorno: number | null; cor: Cor };
type RespWeb = { dia: string; hoje: PeriodoWeb; semana: PeriodoWeb; dias: Array<PeriodoWeb & { dia: string }>; landing: { sessoes: number; viuOferta: number; gerouPix: number; pagou: number; robos: number }; vida?: { sessoes: number; viuOferta: number; gerouPix: number; foiHotmart?: number; pagou: number; bracos?: Record<"v3" | "atual" | "sem_braco", BracoVida> }; errosMeta: string[] };

type DiaResumo = {
  dia: string; vendido: number; vendas: number; porOrigem: Record<Origem, { n: number; valor: number }>;
  site: { vendas: number; bruto: number; liquido: number; gasto: number; gastoComImposto: number; imposto: number; lucro: number; retorno: number | null; cor: Cor };
  iphone: { turma: string | null; testes: number; pagaram: number; situacao: string; liquido: number; gasto: number; gastoComImposto: number; imposto: number; lucro: number; parcial: boolean };
  android: { vendas: number; liquido: number; imposto: number; lucro: number };
  lucro: number;
};
type RespDias = { dia: string; desde: string; dias: DiaResumo[]; total: { vendido: number; vendas: number; lucro: number; lucroSite: number; lucroIphone: number; lucroAndroid: number }; semEstadoRC: number; errosMeta: string[] };

type Aba = "vendas" | "dias" | "turmas" | "campanhas" | "web";
const ABAS: Array<{ id: Aba; nome: string }> = [
  { id: "vendas", nome: "Hoje" }, { id: "dias", nome: "Dias" }, { id: "turmas", nome: "Turmas" }, { id: "campanhas", nome: "Campanhas" }, { id: "web", nome: "Web" },
];

/* ------------------------------------------------------------ formato */
const brl = (v: number | null | undefined, casas = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
const brlC = (c: number) => brl(c / 100);
const vezes = (r: number | null | undefined) => (r === null || r === undefined ? "—" : `${r.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`);
const num = (v: number | null | undefined, casas = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const NOME_ORIGEM: Record<Origem, string> = { pix: "Pix do site", apple: "Apple", play: "Google Play" };

/* ------------------------------------------------------------ servidor */
async function chamar<T>(fn: "vendas-painel" | "vendas-push", body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
}
const chavePublica = async (): Promise<string | null> => {
  const doBuild = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (doBuild) return doBuild;
  return (await chamar<{ publica: string | null }>("vendas-push", { acao: "chave" })).publica;
};

/* ============================================================ raiz: acesso */
export default function VendasApp() {
  const [fase, setFase] = useState<"carregando" | "entrar" | "admin" | "fora">("carregando");

  const conferir = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) { setFase("entrar"); return; }
    const ok = await checkIsAdmin(user.id);
    if (!ok) {
      setFase("fora");
      try { window.location.replace("/"); } catch { /* jsdom */ }
      return;
    }
    setFase("admin");
  }, []);

  useEffect(() => { conferir(); }, [conferir]);

  if (fase === "carregando") return <div className="v-tela v-centro"><div className="v-giro" aria-label="carregando" /></div>;
  if (fase === "fora") return null;
  if (fase === "entrar") return <Entrar onEntrou={conferir} />;
  return <Painel />;
}

function Entrar({ onEntrou }: { onEntrou: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIndo(true); setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setIndo(false);
    if (error) {
      const m = String(error.message ?? "").toLowerCase();
      const st = (error as { status?: number }).status;
      setErro(
        st === 429 || m.includes("rate limit") ? "Muitas tentativas seguidas. Espere uns 5 minutos e tente de novo."
          : m.includes("not confirmed") ? "Este e-mail ainda não foi confirmado."
          : m.includes("invalid login") ? "E-mail ou senha não conferem."
          : `Não deu pra entrar agora (${st ?? "rede"}). Confira a internet e tente de novo.`,
      );
      return;
    }
    onEntrou();
  };
  return (
    <div className="v-tela v-centro">
      <form className="v-entrar" onSubmit={enviar}>
        <Marca />
        <input className="v-campo" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="v-campo" type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <p className="v-erro">{erro}</p>}
        <button className="v-botao" disabled={indo || !email || !senha}>{indo ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

function Marca({ sub }: { sub?: string }) {
  return (
    <div className="v-marca">
      <img src="/icon-192.png" alt="" width={36} height={36} />
      <div>
        <div className="v-marca-nome">CORE <span>Vendas</span></div>
        {sub && <div className="v-marca-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ============================================================ painel */
function Painel() {
  const [aba, setAba] = useState<Aba>("vendas");
  const [periodo, setPeriodo] = useState<"hoje" | "ontem" | "7d">("hoje");
  const [dados, setDados] = useState<Record<string, { at: number; d: unknown }>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chave = aba === "campanhas" ? `campanhas|${periodo}` : aba;
  const atual = dados[chave];

  const carregar = useCallback(async (forcar = false) => {
    setCarregando(true); setErro(null);
    try {
      const d = await chamar<Record<string, unknown>>("vendas-painel", { aba, periodo, forcar });
      if ((d as { error?: string }).error) throw new Error(String((d as { error?: string }).error));
      setDados((x) => ({ ...x, [chave]: { at: Date.now(), d } }));
    } catch {
      setErro("Não consegui atualizar. Puxe pra tentar de novo.");
    } finally {
      setCarregando(false);
    }
  }, [aba, periodo, chave]);

  // ao abrir a aba (se não tem ou passou 60 s) e ao voltar pro app
  const atualRef = useRef(atual);
  atualRef.current = atual;
  useEffect(() => { if (!atualRef.current || Date.now() - atualRef.current.at > 60_000) carregar(); }, [carregar]);
  useEffect(() => {
    const f = () => { if (document.visibilityState === "visible" && (!atualRef.current || Date.now() - atualRef.current.at > 60_000)) carregar(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [carregar]);

  const puxar = usePuxarParaAtualizar(() => carregar(true));

  return (
    <div className="v-tela" {...puxar.handlers}>
      <div className="v-puxar" style={{ height: puxar.distancia }} aria-hidden>{puxar.distancia > 50 ? "Solte pra atualizar" : ""}</div>
      <header className="v-topo">
        <Marca sub={atual ? `Atualizado às ${new Date(atual.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Carregando…"} />
        <button className="v-atualizar" onClick={() => carregar(true)} disabled={carregando} aria-label="Atualizar">
          <span className={carregando ? "v-girando" : ""}>↻</span>
        </button>
      </header>

      <AvisoPush />

      <nav className="v-abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? "ativa" : ""} onClick={() => setAba(a.id)}>{a.nome}</button>
        ))}
      </nav>

      {erro && <p className="v-erro v-erro-bloco">{erro}</p>}
      {!atual && carregando && <div className="v-centro v-altura"><div className="v-giro" /></div>}
      {atual && aba === "vendas" && <AbaVendas d={atual.d as RespVendas} />}
      {atual && aba === "dias" && <AbaDias d={atual.d as RespDias} />}
      {atual && aba === "turmas" && <AbaTurmas d={atual.d as RespTurmas} />}
      {aba === "campanhas" && (
        <>
          <div className="v-seg">
            {(["hoje", "ontem", "7d"] as const).map((p) => (
              <button key={p} className={periodo === p ? "ativa" : ""} onClick={() => setPeriodo(p)}>{p === "7d" ? "7 dias" : p === "hoje" ? "Hoje" : "Ontem"}</button>
            ))}
          </div>
          {atual && <AbaCampanhas d={atual.d as RespCampanhas} />}
        </>
      )}
      {atual && aba === "web" && <AbaWeb d={atual.d as RespWeb} />}
    </div>
  );
}

function usePuxarParaAtualizar(aoSoltar: () => void) {
  const [distancia, setDistancia] = useState(0);
  const inicio = useRef<number | null>(null);
  return {
    distancia,
    handlers: {
      onTouchStart: (e: React.TouchEvent) => { inicio.current = window.scrollY <= 0 ? e.touches[0].clientY : null; },
      onTouchMove: (e: React.TouchEvent) => { if (inicio.current !== null) setDistancia(Math.max(0, Math.min(80, (e.touches[0].clientY - inicio.current) * 0.5))); },
      onTouchEnd: () => { if (distancia > 50) aoSoltar(); inicio.current = null; setDistancia(0); },
    },
  };
}

/* ------------------------------------------------------------ aviso (push) */
function AvisoPush() {
  const instalada = estaInstalada();
  const [estado, setEstado] = useState<"conferindo" | "desligado" | "ligado" | "sem_suporte">("conferindo");
  const [msg, setMsg] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    if (!instalada) return;
    if (!suportaPush()) { setEstado("sem_suporte"); return; }
    (async () => {
      const sub = await inscricaoAtual();
      if (!sub) { setEstado("desligado"); return; }
      try {
        const r = await chamar<{ inscrito: boolean }>("vendas-push", { acao: "estado", endpoint: sub.endpoint });
        setEstado(r.inscrito ? "ligado" : "desligado");
      } catch { setEstado("ligado"); }
    })();
  }, [instalada]);

  if (!instalada) {
    return (
      <section className="v-cartao v-instalar">
        <h2>Receba um aviso a cada venda</h2>
        <ol>
          <li>Toque em <b>Compartilhar</b> <span className="v-icone-share" aria-hidden>⬆︎</span> no Safari</li>
          <li>Escolha <b>Adicionar à Tela de Início</b></li>
          <li>Abra o <b>CORE Vendas</b> pela Tela de Início e ligue os avisos</li>
        </ol>
        <p className="v-nota">Precisa de iPhone com iOS 16.4 ou mais novo.</p>
      </section>
    );
  }
  if (estado === "conferindo") return null;
  if (estado === "sem_suporte") return <section className="v-cartao"><p className="v-nota">Este aparelho não aceita avisos. Atualize o iOS (16.4+) e abra pela Tela de Início.</p></section>;

  const ligar = async () => {
    setIndo(true); setMsg(null);
    try {
      const insc = await ligarAvisos(chavePublica);
      await chamar("vendas-push", { acao: "inscrever", ...insc });
      setEstado("ligado");
    } catch (e) {
      const m = String((e as Error)?.message ?? "");
      setMsg(m === "negado" ? "Os avisos estão bloqueados. Ajustes → Notificações → CORE Vendas → Permitir." : "Não deu pra ligar agora. Tente de novo.");
    } finally { setIndo(false); }
  };
  const testar = async () => {
    setIndo(true); setMsg(null);
    try {
      const r = await chamar<{ enviados: number }>("vendas-push", { acao: "teste" });
      setMsg(r.enviados > 0 ? "Aviso de teste enviado — chega em segundos." : "Nenhum aparelho recebeu. Desligue e ligue de novo.");
    } catch { setMsg("Não deu pra mandar o teste."); } finally { setIndo(false); }
  };
  const desligar = async () => {
    setIndo(true);
    const endpoint = await desligarAvisos();
    if (endpoint) await chamar("vendas-push", { acao: "desinscrever", endpoint }).catch(() => {});
    setEstado("desligado"); setIndo(false); setMsg(null);
  };

  if (estado === "ligado") {
    return (
      <section className="v-cartao v-ligado">
        <div className="v-linha-aviso"><span className="v-ponto" /> <b>Avisos ligados neste aparelho</b></div>
        <div className="v-botoes">
          <button className="v-botao v-botao-claro" onClick={testar} disabled={indo}>Mandar aviso de teste</button>
          <button className="v-link" onClick={desligar} disabled={indo}>Desligar</button>
        </div>
        {msg && <p className="v-nota">{msg}</p>}
      </section>
    );
  }
  return (
    <section className="v-cartao">
      <h2>Aviso a cada venda</h2>
      <p className="v-nota">Pix do site, Apple e Google Play — com o valor, na hora.</p>
      <button className="v-botao" onClick={ligar} disabled={indo}>{indo ? "Ligando…" : "Ligar avisos"}</button>
      {msg && <p className="v-erro">{msg}</p>}
    </section>
  );
}

/* ------------------------------------------------------------ abas */
const Erros = ({ e }: { e?: string[] }) => (e && e.length ? <p className="v-nota v-alerta">Meta: {e.join(" · ")}</p> : null);

function AbaVendas({ d }: { d: RespVendas }) {
  return (
    <section>
      <div className="v-cartao v-total">
        <div className="v-rotulo">Vendas de hoje</div>
        <div className="v-numero-grande">{brlC(d.total_cents)}</div>
        <div className="v-sub">{d.itens.length} {d.itens.length === 1 ? "venda" : "vendas"}</div>
        <div className="v-chips">
          {(Object.keys(d.porOrigem) as Origem[]).filter((o) => d.porOrigem[o].n > 0).map((o) => (
            <span key={o} className={`v-chip v-chip-${o}`}>{NOME_ORIGEM[o]} · {d.porOrigem[o].n} · {brlC(d.porOrigem[o].cents)}</span>
          ))}
        </div>
      </div>
      {d.itens.length === 0 && <p className="v-vazio">Nenhuma venda ainda hoje.</p>}
      <ul className="v-lista">
        {d.itens.map((i, k) => (
          <li key={k}>
            <span className="v-hora">{i.hora}</span>
            <span className={`v-tag v-chip-${i.origem}`}>{NOME_ORIGEM[i.origem]}</span>
            <span className="v-plano">{i.renovacao ? `renovação ${i.plano}` : i.plano}</span>
            <span className="v-valor">{brlC(i.valor_cents)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const sinal = (v: number) => `${v < 0 ? "−" : "+"}${brl(Math.abs(v), 0)}`;
const corLucro = (v: number, parcial = false): Cor => (parcial ? "neutro" : v > 0 ? "verde" : v < 0 ? "vermelho" : "neutro");
const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (d: string) => DIA_SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()];

function AbaDias({ d }: { d: RespDias }) {
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <section>
      <div className="v-cartao v-total">
        <div className="v-rotulo">Desde {ddmm(d.desde)} · {d.dias.length} dias</div>
        <div className="v-numero-grande">{brl(d.total.vendido, 0)}</div>
        <div className="v-sub">{num(d.total.vendas)} vendas · lucro <b className={`v-cor-${corLucro(d.total.lucro)}`}>{sinal(d.total.lucro)}</b></div>
        <div className="v-chips">
          <span className="v-chip v-chip-pix">Site {sinal(d.total.lucroSite)}</span>
          <span className="v-chip v-chip-apple">iPhone {sinal(d.total.lucroIphone)}</span>
          <span className="v-chip v-chip-play">Android {sinal(d.total.lucroAndroid)}</span>
        </div>
      </div>
      {d.dias.map((x) => {
        const ab = aberto === x.dia;
        return (
          <article key={x.dia} className="v-cartao v-dia" onClick={() => setAberto(ab ? null : x.dia)}>
            <header>
              <div>
                <div className="v-titulo">{ddmm(x.dia)} <span className="v-sub">{x.dia === d.dia ? "hoje" : diaSemana(x.dia)}</span></div>
                <div className="v-sub">{x.vendas} vendas</div>
              </div>
              <div className="v-retorno-caixa">
                <div className="v-dia-vendido">{brl(x.vendido, 0)}</div>
                <div className={`v-sub v-cor-${corLucro(x.lucro, x.iphone.parcial)}`}>lucro {sinal(x.lucro)}{x.iphone.parcial ? " · parcial" : ""}</div>
              </div>
            </header>
            <ul className="v-lista v-lista-dia">
              <li>
                <span className="v-tag v-chip-pix">Site</span>
                <span className="v-plano">{x.site.vendas} vendas · anúncio {brl(x.site.gastoComImposto, 0)}</span>
                <span className={`v-valor v-cor-${corLucro(x.site.lucro)}`}>{sinal(x.site.lucro)}</span>
              </li>
              <li>
                <span className="v-tag v-chip-apple">iPhone</span>
                <span className="v-plano">turma {x.iphone.turma ? ddmm(x.iphone.turma) : ""}: {x.iphone.testes} testes · {x.iphone.pagaram} pagaram{x.iphone.parcial ? " (cobrando hoje)" : ""}</span>
                <span className={`v-valor v-cor-${corLucro(x.iphone.lucro, x.iphone.parcial)}`}>{sinal(x.iphone.lucro)}</span>
              </li>
              {x.android.vendas > 0 && (
                <li>
                  <span className="v-tag v-chip-play">Android</span>
                  <span className="v-plano">{x.android.vendas} {x.android.vendas === 1 ? "venda" : "vendas"}</span>
                  <span className="v-valor v-cor-verde">{sinal(x.android.lucro)}</span>
                </li>
              )}
            </ul>
            {ab && (
              <div className="v-grade v-dia-detalhe">
                <Dado n={brl(x.site.bruto, 0)} r="site · vendido" />
                <Dado n={brl(x.site.gasto, 0)} r="site · anúncio (Meta)" />
                <Dado n={vezes(x.site.retorno)} r="site · retorno líquido" cor={x.site.cor} />
                <Dado n={brl(x.iphone.liquido, 0)} r={`iPhone · turma ${x.iphone.turma ? ddmm(x.iphone.turma) : ""}`} />
                <Dado n={brl(x.iphone.gasto, 0)} r={`iPhone · anúncio de ${x.iphone.turma ? ddmm(x.iphone.turma) : ""}`} />
                <Dado n={brl(x.site.imposto + x.iphone.imposto + x.android.imposto, 0)} r="imposto 15,5%" />
              </div>
            )}
          </article>
        );
      })}
      <p className="v-nota">Vendido = tudo que entrou no dia (Pix do site + Apple + Google Play, como no “Hoje”). Lucro = líquido − anúncio com o imposto da Meta (+12,15%) − 15,5% de imposto. Site = vendas e anúncio do próprio dia. iPhone = a turma COBRADA no dia (começou 3 dias antes), com o anúncio de app do dia em que ela começou; “parcial” = a cobrança ainda está caindo hoje. Toque num dia pra ver os detalhes.{d.semEstadoRC ? ` ${d.semEstadoRC} sem resposta do RevenueCat.` : ""}</p>
      <Erros e={d.errosMeta} />
    </section>
  );
}

function AbaTurmas({ d }: { d: RespTurmas }) {
  return (
    <section>
      {d.turmas.map((t) => (
        <article key={t.dia} className="v-cartao v-turma">
          <header>
            <div>
              <div className="v-titulo">Turma {ddmm(t.dia)}</div>
              <div className="v-sub">{t.situacao === "fechada" ? `cobrou em ${ddmm(t.fechaEm)}` : t.situacao === "fecha_hoje" ? "fecha hoje" : `em andamento · fecha ${ddmm(t.fechaEm)}`}</div>
            </div>
            <div className="v-retorno-caixa">
              <div className={`v-retorno v-cor-${t.cor}`}>{vezes(t.retorno)}</div>
              {t.situacao === "aberta" && <div className="v-sub">parcial</div>}
            </div>
          </header>
          <div className="v-grade">
            <Dado n={num(t.testes)} r="testes" />
            <Dado n={`${t.pagaram}`} r={`pagaram${t.pctPagaram !== null ? ` · ${num(t.pctPagaram, 0)}%` : ""}`} />
            <Dado n={num(t.recusas)} r="cartão recusado" />
            <Dado n={num(t.cancelaram)} r="cancelaram" />
            <Dado n={num(t.emTeste)} r="ainda em teste" />
            <Dado n={brl(t.custoPorTeste)} r="custo por teste" />
            <Dado n={brl(t.gasto, 0)} r="gasto do dia" />
            <Dado n={brl(t.liquido, 0)} r={`líquido${t.mensais ? ` (+${t.mensais} mensal)` : ""}`} />
          </div>
        </article>
      ))}
      <p className="v-nota">Turma = testes do iPhone iniciados no dia (Brasília); cobra em 3 dias. Retorno = líquido Apple de quem pagou (97,90 → 80,30 · 69,90 → 57,34 · 24,90 → 20,42) ÷ gasto das campanhas de app do dia.{d.semEstadoRC ? ` ${d.semEstadoRC} sem resposta do RevenueCat.` : ""}</p>
      <Erros e={d.errosMeta} />
    </section>
  );
}

function AbaCampanhas({ d }: { d: RespCampanhas }) {
  const fusoNova = d.fusos?.nova;
  return (
    <section>
      <div className="v-cartao v-resumo">
        <Dado n={brl(d.totais.gasto, 0)} r="gasto total" grande />
        <Dado n={num(d.totais.testes)} r="testes (Meta)" grande />
        <Dado n={brl(d.totais.custoPorTeste)} r="custo por teste" grande />
      </div>
      {d.campanhas.length === 0 && <p className="v-vazio">Nenhuma campanha ativa.</p>}
      {d.campanhas.map((c, k) => (
        <article key={k} className="v-cartao v-camp">
          <header>
            <div className="v-titulo">{c.nome}</div>
            <div className="v-sub">{c.conta} · {c.tipo === "app" ? "app" : c.tipo === "site" ? "site" : "outra"} · {c.status === "ACTIVE" ? "ativa" : c.status.toLowerCase()}{c.orcamentoDia ? ` · ${brl(c.orcamentoDia, 0)}/dia` : ""}</div>
          </header>
          <div className="v-grade">
            <Dado n={brl(c.gasto, 0)} r="gasto" />
            <Dado n={brl(c.cpm)} r="CPM" />
            <Dado n={c.ctr === null ? "—" : `${num(c.ctr, 2)}%`} r="CTR" />
            <Dado n={brl(c.cpc)} r="CPC" />
            {c.tipo === "site" ? (
              <>
                <Dado n={num(c.compras)} r="compras (pixel)" />
                <Dado n={vezes(c.roas)} r="ROAS (pixel)" cor={c.cor} />
              </>
            ) : (
              <>
                <Dado n={num(c.testes)} r="testes" />
                <Dado n={brl(c.custoPorTeste)} r="custo por teste" />
              </>
            )}
          </div>
        </article>
      ))}
      <p className="v-nota">Testes = “Iniciar teste” da Meta (inclui orgânico; serve pra comparar campanhas).{fusoNova && fusoNova !== "America/Sao_Paulo" ? ` Conta nova no fuso ${fusoNova}: o “dia” dela começa umas 4–5 h depois do de Brasília.` : ""}</p>
      <Erros e={d.errosMeta} />
    </section>
  );
}

type BracoVida = { visitas: number; foiHotmart: number; vendas: number; receita: number; porVisita: number | null };
/** 04/11: o A/B da /vida (AB_VIDA) — uma linha por braço: visitas · foram pra Hotmart · vendas · R$ por visita */
function VidaPorBraco({ b }: { b: Record<"v3" | "atual" | "sem_braco", BracoVida> }) {
  const nomes: Array<["v3" | "atual" | "sem_braco", string]> = [["v3", "v3"], ["atual", "atual (97,90)"], ["sem_braco", "sem braço"]];
  return (
    <ul className="v-lista" data-testid="vida-bracos">
      {nomes.filter(([k]) => k !== "sem_braco" || b.sem_braco.vendas > 0 || b.sem_braco.visitas > 0).map(([k, nome]) => (
        <li key={k}>
          <span className="v-hora">{nome}</span>
          <span className="v-plano">{num(b[k].visitas)} visitas · {num(b[k].foiHotmart)} foram pra Hotmart · {num(b[k].vendas)} vendas</span>
          <span className="v-valor">{b[k].porVisita === null ? "—" : `${brl(b[k].porVisita!)}/visita`}</span>
        </li>
      ))}
    </ul>
  );
}

function AbaWeb({ d }: { d: RespWeb }) {
  const l = d.landing;
  const passos = [
    { r: "sessões reais", n: l.sessoes },
    { r: "viu a oferta", n: l.viuOferta },
    { r: "gerou Pix", n: l.gerouPix },
    { r: "pagou", n: l.pagou },
  ];
  return (
    <section>
      <div className="v-duas">
        <PeriodoCartao t="Hoje" p={d.hoje} />
        <PeriodoCartao t="7 dias" p={d.semana} />
      </div>
      <article className="v-cartao">
        <div className="v-titulo">Landing /organizar · hoje</div>
        <div className="v-funil">
          {passos.map((p, k) => (
            <div key={p.r} className="v-funil-passo">
              <div className="v-funil-barra" style={{ width: `${l.sessoes ? Math.max(4, (p.n / l.sessoes) * 100) : 4}%` }} />
              <span className="v-funil-n">{num(p.n)}</span>
              <span className="v-funil-r">{p.r}{k > 0 ? ` · ${pct(p.n, passos[k - 1].n)}` : ""}</span>
            </div>
          ))}
        </div>
        {l.robos > 0 && <p className="v-nota">{l.robos} sessões de robô de revisão (Right_Column) fora da conta.</p>}
      </article>
      {d.vida && d.vida.sessoes > 0 && (
        <article className="v-cartao">
          {/* 04/11: a /vida (LP v3 + Hotmart) num funil próprio — "pagou" = vendas da Hotmart de hoje */}
          <div className="v-titulo">Landing /vida · hoje</div>
          <div className="v-funil">
            {[
              { r: "sessões reais", n: d.vida.sessoes },
              { r: "viu a oferta", n: d.vida.viuOferta },
              (d.vida.foiHotmart ?? 0) > 0 ? { r: "foi pra Hotmart", n: d.vida.foiHotmart ?? 0 } : { r: "gerou Pix", n: d.vida.gerouPix },
              { r: "pagou", n: d.vida.pagou },
            ].map((p, k, arr) => (
              <div key={p.r} className="v-funil-passo">
                <div className="v-funil-barra" style={{ width: `${d.vida!.sessoes ? Math.max(4, (p.n / d.vida!.sessoes) * 100) : 4}%` }} />
                <span className="v-funil-n">{num(p.n)}</span>
                <span className="v-funil-r">{p.r}{k > 0 ? ` · ${pct(p.n, arr[k - 1].n)}` : ""}</span>
              </div>
            ))}
          </div>
          {d.vida.bracos && <VidaPorBraco b={d.vida.bracos} />}
        </article>
      )}
      <article className="v-cartao">
        <div className="v-titulo">Dia a dia</div>
        <ul className="v-lista v-lista-dias">
          {d.dias.map((x) => (
            <li key={x.dia}>
              <span className="v-hora">{ddmm(x.dia)}</span>
              <span className="v-plano">{x.vendas} vendas · {brl(x.receita, 0)} / {brl(x.gasto, 0)}</span>
              <span className={`v-valor v-cor-${x.cor}`}>{vezes(x.retorno)}</span>
            </li>
          ))}
        </ul>
      </article>
      <p className="v-nota">Web = vendas do site do banco (Pix e Hotmart, valor real) ÷ gasto das campanhas de site (objetivo de vendas/tráfego) nas 2 contas.</p>
      <Erros e={d.errosMeta} />
    </section>
  );
}

function PeriodoCartao({ t, p }: { t: string; p: PeriodoWeb }) {
  return (
    <article className="v-cartao v-periodo">
      <div className="v-rotulo">{t}</div>
      <div className={`v-numero-grande v-cor-${p.cor}`}>{vezes(p.retorno)}</div>
      <div className="v-sub">{brl(p.receita, 0)} de {p.vendas} vendas</div>
      <div className="v-sub">gasto {brl(p.gasto, 0)}</div>
    </article>
  );
}

function Dado({ n, r, grande, cor }: { n: string; r: string; grande?: boolean; cor?: Cor }) {
  return (
    <div className={`v-dado${grande ? " v-dado-grande" : ""}`}>
      <div className={`v-dado-n${cor ? ` v-cor-${cor}` : ""}`}>{n}</div>
      <div className="v-dado-r">{r}</div>
    </div>
  );
}
