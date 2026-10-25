import { startTransition, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, ChevronRight, CreditCard, FileText, Home, LayoutGrid, LifeBuoy, ListChecks, LogOut, Monitor, Palette,
  RotateCcw, Shield, SlidersHorizontal, Sparkles, Star, Trophy, UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useTheme, palettes } from "@/hooks/use-theme";
import { useHomeNova } from "@/hooks/use-home-nova";
import { useHomeWidgets } from "@/hooks/use-home-widgets";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { CATALOGO_RESUMOS, CHAVE_RESUMOS, MAX_RESUMOS, alternarResumo, normalizarResumos } from "@/lib/home-resumos";
import { CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO } from "@/lib/home-pendencias";
import { VoceE, type CategoriaVoce } from "@/components/home-nova/e/VoceE";
import { EscolherWidgetsE } from "@/components/home-nova/e/EscolherWidgetsE";
import { PersonalizarPendenciasE } from "@/components/home-nova/e/PersonalizarPendenciasE";
import { TRACO } from "@/components/home-nova/e/paleta";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { abrirPaginaDeAvaliacao } from "@/lib/avaliacao";
import { avaliacaoV14Ligada } from "@/lib/avaliacao-v14";
import { trialCartaoAtivo } from "@/lib/teste-gratis";
import { ATRIBUTO_RAIZ, marcarVolta } from "@/lib/nav-abas";
import { AccountDrawer } from "@/components/home/AccountDrawer";
import { PainelAparencia } from "@/components/account/PainelAparencia";
import { linhaDoPlano } from "@/lib/linha-do-plano";

/**
 * ABA VOCÊ (1.0.17) — a página que substitui a folha "Menu" do avatar da Home.
 *
 * Benchmark: Cal AI/Structured/Duolingo (conta = aba própria, lista agrupada em página cheia), Apple
 * Saúde (perfil em página cheia) — nunca dropdown. Os mesmos destinos da folha antiga, agrupados em 4
 * blocos curtos: você + plano · seu progresso · o app (Aparência = modo escuro + cores, que saem do topo
 * da Home; Lembretes; Usar no computador; Rever tutorial) · ajuda (Ajuda e suporte, Avaliar, Privacidade,
 * Termos) · Sair. "Minha conta" (nome, e-mail, senha, apagar dados, excluir conta) e "Usar no computador"
 * reaproveitam as sub-telas da folha antiga (AccountDrawer com `inicial`), já testadas.
 *
 * Eventos: `voce_item_click {item}` em todo item; os de antes continuam (account_drawer_open via "voce",
 * conquistas com origem "voce", a avaliação com origem "voce").
 */

type Item = { id: string; Icone: typeof Trophy; rotulo: string; detalhe?: string; onClick: () => void; perigo?: boolean };

/** A linha curta do plano — hoje em lib/linha-do-plano (o menu da conta da 1.0.18 usa a mesma). */
export { linhaDoPlano };

function Grupo({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section>
      {titulo && <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">{titulo}</h2>}
      <ul className="bg-card rounded-2xl border border-border/60 divide-y divide-border/60 overflow-hidden">{children}</ul>
    </section>
  );
}

function Linha({ item }: { item: Item }) {
  return (
    <li>
      <button
        type="button"
        onClick={item.onClick}
        data-testid={`voce-${item.id}`}
        data-track={`voce:${item.id}`}
        className={`w-full min-h-[52px] flex items-center gap-3 px-4 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 ${item.perigo ? "text-destructive" : "text-foreground"}`}
      >
        <item.Icone className={`w-[18px] h-[18px] shrink-0 ${item.perigo ? "" : "text-muted-foreground"}`} aria-hidden />
        <span className="flex-1 min-w-0 text-sm font-medium">{item.rotulo}</span>
        {item.detalhe && <span className="text-xs text-muted-foreground shrink-0 max-w-[45%] truncate">{item.detalhe}</span>}
        {!item.perigo && <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />}
      </button>
    </li>
  );
}

export default function Voce() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user, signOut } = auth;
  const { get } = useUserData();
  const { mode, palette } = useTheme();
  const [folha, setFolha] = useState<null | "account" | "computador">(null);
  const nativo = isNativeShell();
  // rodada 2 da Home nova (26/10): com a chave ligada, a aba no estilo da E — categorias que abrem subcategorias
  const nova = useHomeNova(user).ligada;

  // aquece os destinos mais tocados (mesmo cuidado da folha antiga: falha aqui é silenciosa)
  useEffect(() => {
    const quieto = () => { /* noop */ };
    import("@/pages/Conquistas").catch(quieto);
    import("@/pages/Ajuda").catch(quieto);
    if (nativo) import("@/pages/PlanosApp").catch(quieto);
  }, [nativo]);

  const nome = (get<string>("core-user-name", "") || "").trim();
  const nomeOuEmail = nome || user?.email?.split("@")[0] || "";
  const partes = nomeOuEmail.split(/\s+/).filter(Boolean);
  const iniciais = partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase() : nomeOuEmail ? nomeOuEmail.slice(0, 2).toUpperCase() : "?";

  const clicar = (item: string) => trackEvent("voce_item_click", { item });
  const ir = (item: string, rota: string, state?: Record<string, unknown>) => {
    clicar(item);
    marcarVolta(rota, "/voce");
    startTransition(() => navigate(rota, state ? { state } : undefined));
  };

  const temaAtual = `${mode === "dark" ? "Escuro" : "Claro"} · ${palettes[palette]?.name ?? "Original"}`;

  const progresso: Item[] = [
    { id: "conquistas", Icone: Trophy, rotulo: "Conquistas", onClick: () => ir("conquistas", "/conquistas", { origem: "voce" }) },
    { id: "retrospectiva", Icone: Sparkles, rotulo: "Retrospectiva", onClick: () => ir("retrospectiva", "/retrospectiva") },
  ];
  const app: Item[] = [
    { id: "aparencia", Icone: Palette, rotulo: "Aparência", detalhe: temaAtual, onClick: () => ir("aparencia", "/voce/aparencia") },
    // Notificações são locais do app da loja — na web não existe como entregar (30/07)
    ...(nativo ? [{ id: "lembretes", Icone: Bell, rotulo: "Lembretes", onClick: () => ir("lembretes", "/notificacoes") }] : []),
    ...(nativo ? [{ id: "computador", Icone: Monitor, rotulo: "Usar no computador", onClick: () => { clicar("computador"); setFolha("computador"); } }] : []),
    { id: "tutorial", Icone: RotateCcw, rotulo: "Rever tutorial", onClick: () => { clicar("tutorial"); navigate("/home", { state: { reverTutorial: true } }); } },
  ];
  const ajuda: Item[] = [
    { id: "ajuda", Icone: LifeBuoy, rotulo: "Ajuda e suporte", onClick: () => ir("ajuda", "/ajuda") },
    ...(nativo && avaliacaoV14Ligada() ? [{ id: "avaliar", Icone: Star, rotulo: "Avaliar o CORE", onClick: () => { clicar("avaliar"); abrirPaginaDeAvaliacao("voce"); } }] : []),
    { id: "privacidade", Icone: Shield, rotulo: "Privacidade", onClick: () => ir("privacidade", "/privacidade") },
    { id: "termos", Icone: FileText, rotulo: "Termos de uso", onClick: () => ir("termos", "/termos") },
  ];

  const versao = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";

  if (nova) {
    const plano = linhaDoPlano(auth, trialCartaoAtivo());
    const categorias: CategoriaVoce[] = [
      {
        id: "inicio", Icone: Home, titulo: "Início", resumo: "Resumos, widgets, pendências e o tutorial",
        itens: [
          { id: "personalizar-inicio", Icone: SlidersHorizontal, rotulo: "Personalizar início", onClick: () => ir("personalizar-inicio", "/voce/inicio") },
          { id: "tutorial", Icone: RotateCcw, rotulo: "Rever tutorial", onClick: () => { clicar("tutorial"); navigate("/home", { state: { reverTutorial: true } }); } },
        ],
      },
      {
        id: "conta", Icone: UserRound, titulo: "Conta", resumo: plano,
        itens: [
          { id: "plano", Icone: CreditCard, rotulo: "Meu plano", detalhe: plano, onClick: () => ir("plano", "/planos") },
          { id: "aparencia", Icone: Palette, rotulo: "Aparência", detalhe: mode === "dark" ? "Escuro" : "Claro", onClick: () => ir("aparencia", "/voce/aparencia") },
          ...(nativo ? [{ id: "lembretes", Icone: Bell, rotulo: "Lembretes", onClick: () => ir("lembretes", "/notificacoes") }] : []),
          ...(nativo ? [{ id: "computador", Icone: Monitor, rotulo: "Usar no computador", onClick: () => { clicar("computador"); setFolha("computador"); } }] : []),
        ],
      },
      { id: "progresso", Icone: Trophy, titulo: "Progresso", resumo: "Conquistas e retrospectiva", itens: progresso },
      { id: "ajuda", Icone: LifeBuoy, titulo: "Ajuda", resumo: "Suporte, avaliação, privacidade e termos", itens: ajuda },
    ];
    return (
      <VoceE
        nome={nome} email={user?.email ?? ""} iniciais={iniciais} categorias={categorias} versao={versao}
        onConta={() => { clicar("conta"); trackEvent("account_drawer_open", { via: "voce" }); setFolha("account"); }}
        onSair={() => { clicar("sair"); void signOut(); }}
      >
        <AccountDrawer open={folha !== null} onOpenChange={(o) => { if (!o) setFolha(null); }} inicial={folha ?? "menu"} displayName={nome} />
      </VoceE>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col" {...{ [ATRIBUTO_RAIZ]: "voce" }} data-testid="tela-voce">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4 h-14 flex items-center">
          <h1 className="text-lg font-bold">Você</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg md:max-w-2xl mx-auto w-full px-4 pt-4 pb-6 space-y-6">
        {/* você + plano */}
        <section className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/60">
          <button
            type="button"
            onClick={() => { clicar("conta"); trackEvent("account_drawer_open", { via: "voce" }); setFolha("account"); }}
            data-testid="voce-conta"
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
            aria-label="Minha conta"
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "hsl(var(--fixo-tinta) / 0.08)", color: "hsl(var(--fixo-tinta))" }} aria-hidden>
              {iniciais}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-base font-bold truncate">{nome || "Adicionar seu nome"}</span>
              <span className="block text-xs text-muted-foreground truncate">{user?.email ?? ""}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => ir("plano", "/planos")}
            data-testid="voce-plano"
            className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left hover:bg-muted/40 transition-colors"
          >
            <CreditCard className="w-[18px] h-[18px] text-muted-foreground shrink-0" aria-hidden />
            <span className="flex-1 min-w-0 text-sm font-medium">Meu plano</span>
            <span className="text-xs text-muted-foreground shrink-0" data-testid="voce-plano-status">{linhaDoPlano(auth, trialCartaoAtivo())}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
          </button>
        </section>

        <Grupo titulo="Seu progresso">{progresso.map((i) => <Linha key={i.id} item={i} />)}</Grupo>
        <Grupo titulo="App">{app.map((i) => <Linha key={i.id} item={i} />)}</Grupo>
        <Grupo titulo="Ajuda">{ajuda.map((i) => <Linha key={i.id} item={i} />)}</Grupo>
        <Grupo>
          <Linha item={{ id: "sair", Icone: LogOut, rotulo: "Sair", perigo: true, onClick: () => { clicar("sair"); void signOut(); } }} />
        </Grupo>

        {versao && <p className="text-center text-[10px] text-muted-foreground">CORE {versao}</p>}
      </main>

      <AccountDrawer
        open={folha !== null}
        onOpenChange={(o) => { if (!o) setFolha(null); }}
        inicial={folha ?? "menu"}
        displayName={nome}
      />
    </div>
  );
}

/** /voce/aparencia — modo claro/escuro e a cor do tema, que moravam no sol e na paleta do topo da Home. */
export function Aparencia() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background flex flex-col" data-testid="tela-aparencia">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <button type="button" onClick={() => navigate("/voce")} aria-label="Voltar" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Aparência</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg md:max-w-2xl mx-auto w-full px-4 pt-4 pb-8">
        <PainelAparencia origem="aparencia" />
      </main>
    </div>
  );
}

/**
 * /voce/inicio — PERSONALIZAR INÍCIO (rodada 2 da Home nova, 26/10): os RESUMOS (os 3 cards de "Seu dia", até 3 entre
 * Hábitos · Água · Refeições · Sono · Gasto · Treino · Leitura — lib/home-resumos), os WIDGETS da página 3 e as
 * PENDÊNCIAS de hoje — as mesmas folhas da Home, as mesmas chaves. Só existe com a Home nova ligada.
 */
export function PersonalizarInicio() {
  const navigate = useNavigate();
  const { get, set } = useUserData();
  const lifeData = useLifeHubData();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize } = useHomeWidgets();
  const resumos = normalizarResumos(get<unknown>(CHAVE_RESUMOS, null));
  const prefs = lifeData.pendenciasPrefs ?? PREFS_PADRAO;
  const [widgets, setWidgets] = useState(false);
  const [pendencias, setPendencias] = useState(false);
  const alternar = (id: (typeof CATALOGO_RESUMOS)[number]["id"]) => {
    const lista = alternarResumo(resumos, id);
    if (lista === resumos) return;
    trackEvent("home_resumos", { resumos: lista.join(",") });
    set(CHAVE_RESUMOS, lista);
  };
  return (
    <div className="hn he min-h-dvh" data-testid="tela-personalizar-inicio" data-suave={SUAVIDADE_HOME_NOVA}>
      <main className="max-w-lg mx-auto px-4 pt-2 pb-10">
        <header className="flex items-center gap-2.5 pt-1">
          <button type="button" onClick={() => navigate("/voce")} aria-label="Voltar" className="w-10 h-10 -ml-1 rounded-full grid place-items-center bg-card shrink-0" style={{ boxShadow: "var(--hn-sombra)" }}>
            <ArrowLeft className="w-5 h-5" strokeWidth={TRACO} />
          </button>
          <h1 className="text-[24px] leading-[1.15] font-bold tracking-[-0.025em] truncate">Personalizar início</h1>
        </header>

        <section className="hn-card mt-5 p-4" data-testid="pi-resumos">
          <h2 className="text-[16px] font-bold tracking-tight">Resumos</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Os 3 cards de "Seu dia". Escolha até {MAX_RESUMOS}.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Resumos">
            {CATALOGO_RESUMOS.map((r) => {
              const on = resumos.includes(r.id);
              const cheio = !on && resumos.length >= MAX_RESUMOS;
              return (
                <button
                  key={r.id} type="button" onClick={() => alternar(r.id)} aria-pressed={on} disabled={cheio} data-testid={`resumo-${r.id}`}
                  className="h-10 px-4 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-40"
                  style={on ? { background: "var(--hn-mais)", color: "var(--hn-mais-texto)" } : { background: "hsl(var(--muted) / 0.7)" }}
                >
                  {r.rotulo}
                </button>
              );
            })}
          </div>
        </section>

        <section className="hn-card mt-3 p-2" data-testid="pi-atalhos">
          <button type="button" onClick={() => setWidgets(true)} data-testid="pi-widgets" className="w-full min-h-[56px] flex items-center gap-3.5 px-3 text-left rounded-2xl active:bg-muted/60">
            <span className="w-10 h-10 rounded-xl grid place-items-center bg-muted/60 shrink-0" aria-hidden><LayoutGrid className="w-[19px] h-[19px]" strokeWidth={TRACO} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold">Widgets</span>
              <span className="block text-[12.5px] text-muted-foreground">{activeWidgets.length === 0 ? "Nenhum na página 3" : `${activeWidgets.length} na página 3`}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />
          </button>
          <button type="button" onClick={() => setPendencias(true)} data-testid="pi-pendencias" className="w-full min-h-[56px] flex items-center gap-3.5 px-3 text-left rounded-2xl active:bg-muted/60">
            <span className="w-10 h-10 rounded-xl grid place-items-center bg-muted/60 shrink-0" aria-hidden><ListChecks className="w-[19px] h-[19px]" strokeWidth={TRACO} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold">Pendências de hoje</span>
              <span className="block text-[12.5px] text-muted-foreground">{prefs.ocultos.length === 0 ? "Tudo ligado" : `${prefs.ocultos.length} ${prefs.ocultos.length === 1 ? "oculta" : "ocultas"}`}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </section>
      </main>
      <div className="hn he he-so-vars" data-suave={SUAVIDADE_HOME_NOVA}>
        <EscolherWidgetsE aberta={widgets} onFechar={() => setWidgets(false)} activeWidgets={activeWidgets} onToggle={(id) => (isActive(id) ? removeWidget(id) : addWidget(id))} onToggleSize={toggleSize} />
        <PersonalizarPendenciasE open={pendencias} onOpenChange={setPendencias} prefs={prefs} onChange={(p) => set(CHAVE_PENDENCIAS_PREFS, p)} porModulo={lifeData.pendenciasPorModulo} />
      </div>
    </div>
  );
}
