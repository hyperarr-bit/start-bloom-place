import { useState, useEffect, startTransition, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Pencil, CreditCard, LogOut, UserCircle, ChevronLeft, ChevronRight, Mail, KeyRound, RotateCcw, Trash2, Bell, Sparkles, Monitor, Copy, LifeBuoy, Eraser, Star, Palette, Shield, FileText, NotebookPen, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { abrirPaginaDeAvaliacao } from "@/lib/avaliacao";
import { avaliacaoV14Ligada } from "@/lib/avaliacao-v14";
import { NameEditDialog } from "./NameEditDialog";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { ApagarDadosDialog } from "@/components/account/ApagarDadosDialog";
import { toast } from "sonner";
import { CHAVE_KIT, kitLiberado } from "@/lib/kit-primeiro-mes";
import { areaDoKit } from "@/lib/plano-30-areas";
import { useTheme, palettes } from "@/hooks/use-theme";
import { menuNovoLigado } from "@/lib/menu-novo";
import { linhaDoPlano } from "@/lib/linha-do-plano";
import { trialCartaoAtivo } from "@/lib/teste-gratis";
import { PainelAparencia } from "@/components/account/PainelAparencia";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { Fogo } from "@/components/conquistas/Fogo";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";

/**
 * 1.0.20 (2ª passada 26/10): com o menu da conta aberto na Home ANTIGA, a faixa do relógio (.app-safe-top-guard, por cima
 * de tudo) ficava BRANCA sobre o escurecido da folha. Montado DENTRO da folha (o Radix a mantém montada até o fim da
 * animação de saída), deixa a faixa transparente enquanto o menu está na tela — o escurecido (fixed inset-0) cobre até o
 * topo — e devolve a cor quando a folha sai de vez, como as folhas da Home nova, o álbum e o "Dia completo".
 */
const FaixaDoRelogioSobOMenu = () => {
  useFaixaDoRelogioTransparente(true);
  return null;
};

/* ───────────── 1.0.18: o MENU NOVO (lib/menu-novo) — 3 grupos, no desenho v1-menu ───────────── */

type GrupoDoMenu = "voce" | "app" | "ajuda" | "sair";
type ItemDoMenu = { id: string; grupo: GrupoDoMenu; Icone: LucideIcon; rotulo: string; detalhe?: ReactNode; onClick: () => void; spotlight?: string };

/** O título do grupo (APP, AJUDA) — o 1º grupo, o da pessoa, não tem título: o cartão com o nome já diz. */
const TituloDoGrupo = ({ children }: { children: ReactNode }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">{children}</h3>
);

const CaixaDoGrupo = ({ children, testid }: { children: ReactNode; testid: string }) => (
  <ul className="bg-card rounded-2xl border border-border/70 divide-y divide-border/60 overflow-hidden" data-testid={testid}>{children}</ul>
);

const LinhaDoMenu = ({ item }: { item: ItemDoMenu }) => (
  <li>
    <button
      type="button"
      onClick={item.onClick}
      data-testid={`menu-${item.id}`}
      data-track={`menu:${item.id}`}
      data-grupo={item.grupo}
      data-spotlight={item.spotlight}
      className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left text-foreground transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <item.Icone className="w-[18px] h-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 min-w-0 text-[15px] font-medium truncate">{item.rotulo}</span>
      {item.detalhe !== undefined && <span className="text-[13px] text-muted-foreground shrink-0 max-w-[55%] truncate flex items-center gap-1.5">{item.detalhe}</span>}
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
    </button>
  </li>
);

interface AccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName?: string;
  onNameChange?: (name: string) => void;
  onReplayTutorial?: () => void;
  /** 1.0.17 (aba Você): abre direto numa sub-tela; o "‹" dela fecha a folha em vez de cair no menu. */
  inicial?: Vista;
}

/** As telas da folha: o menu e as sub-telas ("aparencia" e "legal" só existem com o menu novo da 1.0.18). */
type Vista = "menu" | "account" | "computador" | "aparencia" | "legal";

export const AccountDrawer = ({
  open,
  onOpenChange,
  displayName = "",
  onNameChange,
  onReplayTutorial,
  inicial = "menu",
}: AccountDrawerProps) => {
  const { user, signOut } = useAuth();
  const { set: setUserData, get, isGuest } = useUserData();
  const navigate = useNavigate();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showApagarDados, setShowApagarDados] = useState(false);
  const [view, setView] = useState<Vista>(inicial);
  // 1.0.18: a chave é lida a cada abertura da folha (a resposta do RevenueCat pode chegar com o app aberto)
  const novo = menuNovoLigado();

  useEffect(() => {
    setView(inicial);
  }, [open, inicial]);
  const voltarAoMenu = () => (inicial === "menu" ? setView("menu") : onOpenChange(false));

  // Aquece os chunks lazy dos destinos do menu enquanto o drawer abre — sem
  // isso, clicar em "Conquistas"/"Assinatura" ainda baixa o chunk na hora e
  // trava junto com a animação de fechar.
  // 08/10: é só aquecimento — se o chunk sumiu (deploy novo) ou a rede caiu, a
  // falha aqui não pode virar unhandledrejection (era js_error no painel sem
  // ninguém recarregar); quem decide recarregar é a navegação de verdade.
  useEffect(() => {
    if (!open) return;
    const quieto = () => { /* noop */ };
    import("@/pages/Conquistas").catch(quieto);
    import("@/pages/Retrospectiva").catch(quieto);
    import("@/pages/Notificacoes").catch(quieto);
    import("@/pages/Ajuda").catch(quieto);
    if (isNativeShell()) import("@/pages/PlanosApp").catch(quieto);
    else import("@/pages/Planos").catch(quieto);
  }, [open]);

  // Fecha o drawer já e deixa o React montar a rota nova sem bloquear o frame
  const go = (path: string, state?: Record<string, unknown>) => {
    onOpenChange(false);
    startTransition(() => navigate(path, state ? { state } : undefined));
  };

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "?";

  const handleNameSave = (name: string) => {
    setUserData("core-user-name", name);
    onNameChange?.(name);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: getAuthRedirectUrl("/update-password"),
    });
    if (error) {
      toast.error("Erro ao enviar email de redefinição");
    } else {
      toast.success("Email de redefinição enviado!");
    }
  };

  const handleManageSubscription = () => go("/planos");

  const handleMinhaConta = () => {
    if (isGuest) {
      onOpenChange(false);
      setUserData("quicksignup-pending", "true");
    } else {
      setView("account");
    }
  };

  // Faxina 16/07 (ordem do dono): saem "Todos os módulos" (o drawer agora só
  // abre NO hub — a seta ← dos módulos leva até ele) e "Indique e ganhe"
  // (+30 dias não faz sentido pra base vitalícia). "Assinatura" vira
  // "Meu acesso" (produto é vitalício; /planos já mostra "VITALÍCIO 🎉").
  // "Rever tutorial" VOLTOU 19/07 (pedido de cliente) — agora pelo caminho
  // limpo do Home.handleReplayTutorial, que reseta as flags de verdade (o
  // antigo abria o overlay com tudo "feito" e nascia vazio).
  const handleReplayTutorial = () => {
    onOpenChange(false);
    onReplayTutorial?.();
  };
  // 10/10 (1.0.14, atrás de AVALIACAO_V14): "Avaliar o CORE" — a página da loja,
  // nunca a caixinha (botão que às vezes não faz nada é experiência quebrada).
  const itemAvaliar = isNativeShell() && avaliacaoV14Ligada()
    ? [{ icon: Star, label: "Avaliar o CORE", onClick: () => { onOpenChange(false); abrirPaginaDeAvaliacao("menu"); } }]
    : [];
  /* 21/10: o plano de 30 dias de OUTRA área (comprado no downsell do presente) tem porta aqui — o de Dinheiro mora na
     aba "KIT 30 DIAS" de Finanças. Sem a compra, o item não existe. */
  const kitDaConta = get<unknown>(CHAVE_KIT, null);
  const itemPlano30 = kitLiberado(kitDaConta) && areaDoKit(kitDaConta) !== "dinheiro"
    ? [{ icon: NotebookPen, label: "Plano de 30 dias", onClick: () => go("/plano-30") }]
    : [];
  const menuItems = isGuest
    ? [
        { icon: UserCircle, label: "Minha conta", onClick: handleMinhaConta, spotlight: "minha-conta" as const },
        // 17/08 (reclamação real): convidado definia o nome uma vez (lápis da
        // saudação, que some depois) e NUNCA MAIS conseguia alterar — a seção
        // "Nome" só existia na aba de conta, que convidado não tem. O nome é
        // local (core-user-name), não precisa de conta pra editar.
        // FECHA a gaveta antes (18/08, print do dono no iPhone): o dialog tem
        // z-50 e a gaveta z-300 — com as duas abertas, o TOQUE no Salvar morre
        // na camada da gaveta (digitar funciona, salvar não). Clique via JS no
        // emulador não enxerga disputa de z-index; só hit-test pega.
        { icon: Pencil, label: "Alterar meu nome", onClick: () => { onOpenChange(false); setShowNameDialog(true); } },
        // 16/08: no teste grátis de 3 dias o convidado usa o app inteiro sem
        // conta — e o menu não tinha nenhuma porta pro plano. Quem decidia
        // assinar no meio do teste só tinha a faixa fina do rodapé, que some
        // nas telas de funil. Quem quer pagar precisa de caminho.
        { icon: CreditCard, label: "Meu acesso", onClick: handleManageSubscription },
        { icon: LifeBuoy, label: "Ajuda e suporte", onClick: () => go("/ajuda") },
        ...itemAvaliar,
      ]
    : [
        { icon: UserCircle, label: "Minha conta", onClick: handleMinhaConta, spotlight: "minha-conta" as const },
        { icon: CreditCard, label: "Meu acesso", onClick: handleManageSubscription },
        // 27/07: a retrospectiva existia escondida dentro de Finanças — quem
        // não abria aquele módulo nunca soube. Agora tem porta no menu.
        { icon: Sparkles, label: "Retrospectiva", onClick: () => go("/retrospectiva") },
        // origem "menu" (26/09): o evento conquistas_open separa quem chega pelo menu de quem vem da Home
        { icon: Trophy, label: "Conquistas", onClick: () => go("/conquistas", { origem: "menu" }) },
        ...itemPlano30,
        // Notificações são LOCAIS do app da loja — na web/PWA não existe como
        // entregar (30/07, dono: some da web pra não virar ticket de suporte).
        ...(isNativeShell() ? [{ icon: Bell, label: "Notificações", onClick: () => go("/notificacoes") }] : []),
        // 07/09 (avaliação 4★ na Play: "instalei no computador e não consigo
        // sincronizar os 2"): os dados JÁ sincronizam — o site é o mesmo app
        // na mesma conta. O que faltava era alguém CONTAR isso: a raiz do
        // site é institucional e nada dizia "entre com a mesma conta". Só
        // dentro do app da loja; na web a pessoa já está no computador.
        ...(isNativeShell() ? [{ icon: Monitor, label: "Usar no computador", onClick: () => setView("computador") }] : []),
        // 07/09 (pedido de uma cliente pagante, por DM): "faz em algum local
        // suporte e coloca um formulário pra gente por o bug e anexar o
        // print". Dentro do app o único contato era um mailto: perdido na
        // página de termos — a /suporte do site é bloqueada no shell. Este
        // item é a porta que faltava, e vale na web também.
        { icon: LifeBuoy, label: "Ajuda e suporte", onClick: () => go("/ajuda") },
        ...itemAvaliar,
        { icon: RotateCcw, label: "Rever tutorial", onClick: handleReplayTutorial },
      ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        {/* 26/07: era um painel lateral de ALTURA CHEIA com 5 itens — sobravam
            ~400px de branco embaixo e parecia tela quebrada. Virou folha de
            baixo, do tamanho do conteúdo, com cantos arredondados em cima: é o
            gesto que a mão já espera no celular, e o menu encosta no polegar
            em vez de ficar no topo da tela. max-h protege a aba "Minha conta",
            que é mais alta e ganha rolagem própria. */}
        <SheetContent
          side="bottom"
          className="p-0 z-[300] rounded-t-[28px] border-x-0 border-b-0 max-h-[85dvh] overflow-y-auto
                     pb-[max(1.25rem,var(--app-safe-bottom))]"
          overlayClassName="z-[290]"
          // 1.0.18: o menu novo segue o desenho (sem o X do canto — fecha tocando fora, arrastando ou no ‹ das sub-telas)
          semFechar={novo}
        >
          <FaixaDoRelogioSobOMenu />
          {/* pegador: sinaliza que a folha desce arrastando */}
          <div className="pt-3 pb-1 flex justify-center" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
          </div>
          {view === "menu" && novo && (
            <MenuNovo
              isGuest={isGuest}
              nome={displayName}
              email={user?.email ?? ""}
              iniciais={initials}
              acoes={{
                conta: handleMinhaConta,
                alterarNome: () => { onOpenChange(false); setShowNameDialog(true); },
                plano: handleManageSubscription,
                conquistas: () => go("/conquistas", { origem: "menu" }),
                aparencia: () => setView("aparencia"),
                lembretes: () => go("/notificacoes"),
                plano30: itemPlano30.length ? () => go("/plano-30") : undefined,
                computador: () => setView("computador"),
                tutorial: handleReplayTutorial,
                ajuda: () => go("/ajuda"),
                avaliar: itemAvaliar.length ? itemAvaliar[0].onClick : undefined,
                legal: () => setView("legal"),
                sair: () => { void signOut(); },
              }}
            />
          )}

          {view === "aparencia" && (
            <>
              <CabecalhoDaSubtela titulo="Aparência" onVoltar={voltarAoMenu} />
              <div className="px-4 pb-4" data-testid="menu-tela-aparencia">
                <PainelAparencia origem="menu" />
              </div>
            </>
          )}

          {view === "legal" && (
            <>
              <CabecalhoDaSubtela titulo="Privacidade e termos" onVoltar={voltarAoMenu} />
              <div className="px-4 pb-4">
                <CaixaDoGrupo testid="menu-legal">
                  <LinhaDoMenu item={{ id: "privacidade", grupo: "ajuda", Icone: Shield, rotulo: "Política de privacidade", onClick: () => { trackEvent("menu_item_click", { item: "privacidade", grupo: "ajuda", menu: "novo" }); go("/privacidade"); } }} />
                  <LinhaDoMenu item={{ id: "termos", grupo: "ajuda", Icone: FileText, rotulo: "Termos de uso", onClick: () => { trackEvent("menu_item_click", { item: "termos", grupo: "ajuda", menu: "novo" }); go("/termos"); } }} />
                </CaixaDoGrupo>
              </div>
            </>
          )}

          {view === "menu" && !novo && (
            <>
              <SheetHeader className="px-5 pt-6 pb-4">
                <SheetTitle className="text-sm font-semibold">Menu</SheetTitle>
              </SheetHeader>

              <div className="px-5 space-y-1">
                {menuItems.map((item: any) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    data-spotlight={item.spotlight}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    {item.label}
                  </button>
                ))}

                {!isGuest && (
                  <div className="pt-2 mt-2 border-t border-border">
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {view === "computador" && (
            <>
              <SheetHeader className="px-5 pt-6 pb-4 flex-row items-center gap-2 space-y-0">
                <button
                  onClick={voltarAoMenu}
                  className="p-1 -ml-1 rounded-md hover:bg-muted transition-colors"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <SheetTitle className="text-sm font-semibold">Usar no computador</SheetTitle>
              </SheetHeader>
              <div className="px-5 pb-4 space-y-3">
                <p className="text-sm text-foreground leading-relaxed">
                  O CORE também funciona no navegador do computador, com a mesma conta.
                  Tudo que você lança aqui aparece lá, e vice-versa — sincroniza sozinho.
                </p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
                  <li>No computador, abra <span className="font-medium text-foreground">coreaplicativo.com.br/entrar</span></li>
                  <li>Entre com o <span className="font-medium text-foreground">mesmo e-mail</span> (ou o mesmo Google) que você usa aqui{user?.email ? `: ${user.email}` : ""}</li>
                  <li>Pronto. Não crie outra conta — senão ela nasce vazia.</li>
                </ol>
                <button
                  onClick={async () => {
                    try { await navigator.clipboard.writeText("https://coreaplicativo.com.br/entrar"); toast.success("Link copiado"); }
                    catch { toast.message("coreaplicativo.com.br/entrar"); }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Copy className="w-4 h-4" />
                  Copiar link do site
                </button>
              </div>
            </>
          )}

          {view === "account" && !isGuest && (
            <>
              <SheetHeader className="px-5 pt-6 pb-4 flex-row items-center gap-2 space-y-0">
                <button
                  onClick={voltarAoMenu}
                  className="p-1 -ml-1 rounded-md hover:bg-muted transition-colors"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <SheetTitle className="text-sm font-semibold">Minha conta</SheetTitle>
              </SheetHeader>

              <div className="px-5 pb-4">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{displayName || "Usuário"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 pl-1">Nome</p>
                  <button
                    onClick={() => { onOpenChange(false); setShowNameDialog(true); }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span className="truncate">{displayName || "Adicionar nome"}</span>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 pl-1">E-mail</p>
                  <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{user?.email}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 pl-1">Senha</p>
                  <button
                    onClick={handleResetPassword}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    Redefinir senha
                  </button>
                </div>

                {/* Exigência do Google Play (24/07): app com login precisa de
                    caminho de exclusão DENTRO do app. Fica no fim, discreto e
                    com confirmação por digitação — é irreversível. */}
                <div className="pt-2 mt-1 border-t border-border space-y-1">
                  {/* Começar do zero (26/09): apaga os registros, mantém conta e acesso. */}
                  <button
                    onClick={() => { trackEvent("dados_apagar_open", {}); setShowApagarDados(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Eraser className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    Apagar meus dados e começar do zero
                  </button>
                  <button
                    onClick={() => { trackEvent("account_delete_open", {}); setShowDeleteDialog(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                    Excluir minha conta
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NameEditDialog
        open={showNameDialog}
        onOpenChange={setShowNameDialog}
        currentName={displayName}
        onSave={handleNameSave}
      />

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
      <ApagarDadosDialog open={showApagarDados} onOpenChange={setShowApagarDados} />
    </>
  );
};

/** O cabeçalho das sub-telas do menu novo (‹ + título), igual ao das sub-telas de sempre. */
const CabecalhoDaSubtela = ({ titulo, onVoltar }: { titulo: string; onVoltar: () => void }) => (
  <SheetHeader className="px-5 pt-6 pb-4 flex-row items-center gap-2 space-y-0">
    <button onClick={onVoltar} className="p-1 -ml-1 rounded-md hover:bg-muted transition-colors" aria-label="Voltar">
      <ChevronLeft className="w-4 h-4" />
    </button>
    <SheetTitle className="text-sm font-semibold">{titulo}</SheetTitle>
  </SheetHeader>
);

interface AcoesDoMenu {
  conta: () => void;
  alterarNome: () => void;
  plano: () => void;
  conquistas: () => void;
  aparencia: () => void;
  lembretes: () => void;
  computador: () => void;
  tutorial: () => void;
  ajuda: () => void;
  avaliar?: () => void;
  /** só quando a conta comprou o plano de 30 dias de outra área no site */
  plano30?: () => void;
  legal: () => void;
  sair: () => void;
}

/**
 * O MENU NOVO (1.0.18): (1) você — cartão nome + e-mail, Meu plano, Conquistas com "🔥 N dias"; (2) APP — Aparência
 * (mostra "Claro · Original"), Lembretes e Usar no computador (só no app da loja), Rever tutorial; (3) AJUDA — Ajuda e
 * suporte, [Avaliar o CORE], Privacidade e termos; Sair separado. Componente próprio: só monta com a folha aberta
 * (a sequência e o tema não são lidos com a folha fechada). `menu_item_click {item, grupo, menu: "novo"}` em todo item.
 */
function MenuNovo({ isGuest, nome, email, iniciais, acoes }: { isGuest: boolean; nome: string; email: string; iniciais: string; acoes: AcoesDoMenu }) {
  const auth = useAuth();
  const seq = useSequencia();
  const { mode, palette } = useTheme();
  const nativo = isNativeShell();

  const clicar = (id: string, grupo: GrupoDoMenu, acao: () => void) => () => {
    trackEvent("menu_item_click", { item: id, grupo, menu: "novo" });
    acao();
  };

  const nomeDaPaleta = palettes[palette]?.name ?? "Original";
  const temaAtual = `${mode === "dark" ? "Escuro" : "Claro"} · ${nomeDaPaleta}`;
  const bolinhas = palettes[palette]?.preview ?? palettes.default.preview;
  const detalheAparencia = (
    <>
      <span className="flex -space-x-1" aria-hidden>
        {bolinhas.map((c, i) => <span key={i} className="w-3.5 h-3.5 rounded-full border border-border/70" style={{ backgroundColor: c }} />)}
      </span>
      <span data-testid="menu-aparencia-estado">{temaAtual}</span>
    </>
  );
  const detalheSequencia = seq.dias > 0 ? (
    <span className="inline-flex items-center gap-1 font-bold" data-testid="menu-conquistas-dias">
      <Fogo faixa={seq.faixa} tamanho={15} semBrilho />
      <span className="text-[var(--dias-c)] dark:text-[var(--dias-cd)]" style={{ "--dias-c": seq.faixa.hojeTexto, "--dias-cd": seq.faixa.hojeTextoEscuro } as CSSProperties}>
        {seq.dias} {seq.dias === 1 ? "dia" : "dias"}
      </span>
    </span>
  ) : undefined;

  const voce: ItemDoMenu[] = [
    ...(isGuest ? [{ id: "nome", grupo: "voce" as const, Icone: Pencil, rotulo: "Alterar meu nome", onClick: clicar("nome", "voce", acoes.alterarNome) }] : []),
    { id: "plano", grupo: "voce", Icone: CreditCard, rotulo: "Meu plano", detalhe: <span data-testid="menu-plano-status">{linhaDoPlano(auth, trialCartaoAtivo())}</span>, onClick: clicar("plano", "voce", acoes.plano) },
    ...(!isGuest ? [{ id: "conquistas", grupo: "voce" as const, Icone: Trophy, rotulo: "Conquistas", detalhe: detalheSequencia, onClick: clicar("conquistas", "voce", acoes.conquistas) }] : []),
    // 21/10 (main): o plano de 30 dias de outra área comprado no site — sem a compra, o item não existe
    ...(acoes.plano30 ? [{ id: "plano30", grupo: "voce" as const, Icone: NotebookPen, rotulo: "Plano de 30 dias", onClick: clicar("plano30", "voce", acoes.plano30) }] : []),
  ];
  const app: ItemDoMenu[] = [
    { id: "aparencia", grupo: "app", Icone: Palette, rotulo: "Aparência", detalhe: detalheAparencia, onClick: clicar("aparencia", "app", acoes.aparencia) },
    // Notificações são locais do app da loja — na web não existe como entregar (30/07)
    ...(nativo && !isGuest ? [{ id: "lembretes", grupo: "app" as const, Icone: Bell, rotulo: "Lembretes", onClick: clicar("lembretes", "app", acoes.lembretes) }] : []),
    ...(nativo && !isGuest ? [{ id: "computador", grupo: "app" as const, Icone: Monitor, rotulo: "Usar no computador", onClick: clicar("computador", "app", acoes.computador) }] : []),
    ...(!isGuest ? [{ id: "tutorial", grupo: "app" as const, Icone: RotateCcw, rotulo: "Rever tutorial", onClick: clicar("tutorial", "app", acoes.tutorial) }] : []),
  ];
  const ajuda: ItemDoMenu[] = [
    { id: "ajuda", grupo: "ajuda", Icone: LifeBuoy, rotulo: "Ajuda e suporte", onClick: clicar("ajuda", "ajuda", acoes.ajuda) },
    ...(acoes.avaliar ? [{ id: "avaliar", grupo: "ajuda" as const, Icone: Star, rotulo: "Avaliar o CORE", onClick: clicar("avaliar", "ajuda", acoes.avaliar) }] : []),
    { id: "legal", grupo: "ajuda", Icone: Shield, rotulo: "Privacidade e termos", onClick: clicar("legal", "ajuda", acoes.legal) },
  ];

  return (
    <>
    {/* a folha precisa de título (leitor de tela e a medição total, que lê "MENU"); o desenho não mostra */}
    <SheetTitle className="sr-only">Menu</SheetTitle>
    <div className="px-4 pt-2 pb-2 space-y-4" data-testid="menu-novo">

      {/* (1) você + plano + conquistas */}
      <section aria-label="Você" data-testid="menu-grupo-voce">
        <ul className="bg-card rounded-2xl border border-border/70 divide-y divide-border/60 overflow-hidden">
          <li>
            <button
              type="button"
              onClick={clicar("conta", "voce", acoes.conta)}
              data-testid="menu-conta"
              data-track="menu:conta"
              data-grupo="voce"
              data-spotlight="minha-conta"
              aria-label="Minha conta"
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
            >
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold shrink-0" style={{ background: "hsl(var(--fixo-tinta) / 0.08)", color: "hsl(var(--fixo-tinta))" }} aria-hidden>
                {iniciais}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-bold leading-tight truncate">{nome || (isGuest ? "Criar minha conta" : "Adicionar seu nome")}</span>
                <span className="block text-[13px] text-muted-foreground truncate mt-0.5">{email || (isGuest ? "Seus dados ficam salvos na conta" : "")}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
            </button>
          </li>
          {voce.map((i) => <LinhaDoMenu key={i.id} item={i} />)}
        </ul>
      </section>

      {/* (2) o app */}
      <section aria-label="App" data-testid="menu-grupo-app">
        <TituloDoGrupo>App</TituloDoGrupo>
        <CaixaDoGrupo testid="menu-caixa-app">{app.map((i) => <LinhaDoMenu key={i.id} item={i} />)}</CaixaDoGrupo>
      </section>

      {/* (3) ajuda */}
      <section aria-label="Ajuda" data-testid="menu-grupo-ajuda">
        <TituloDoGrupo>Ajuda</TituloDoGrupo>
        <CaixaDoGrupo testid="menu-caixa-ajuda">{ajuda.map((i) => <LinhaDoMenu key={i.id} item={i} />)}</CaixaDoGrupo>
      </section>

      {/* Sair, separado (convidado não tem conta pra sair — como no menu de antes) */}
      {!isGuest && (
        <button
          type="button"
          onClick={clicar("sair", "sair", acoes.sair)}
          data-testid="menu-sair"
          data-track="menu:sair"
          data-grupo="sair"
          className="w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl border border-border/70 bg-card text-left text-destructive transition-colors hover:bg-destructive/5 active:bg-destructive/10"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" aria-hidden />
          <span className="text-[15px] font-medium">Sair</span>
        </button>
      )}
    </div>
    </>
  );
}
