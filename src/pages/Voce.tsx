import { startTransition, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, ChevronRight, CreditCard, FileText, LifeBuoy, LogOut, Monitor, Palette,
  RotateCcw, Shield, Sparkles, Star, Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useTheme, palettes } from "@/hooks/use-theme";
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
