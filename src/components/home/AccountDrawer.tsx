import { useState, useEffect, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Pencil, CreditCard, LogOut, UserCircle, ChevronLeft, Mail, KeyRound, RotateCcw, Trash2, Bell, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { NameEditDialog } from "./NameEditDialog";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { toast } from "sonner";

interface AccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName?: string;
  onNameChange?: (name: string) => void;
  onReplayTutorial?: () => void;
}

export const AccountDrawer = ({
  open,
  onOpenChange,
  displayName = "",
  onNameChange,
  onReplayTutorial,
}: AccountDrawerProps) => {
  const { user, signOut } = useAuth();
  const { set: setUserData, isGuest } = useUserData();
  const navigate = useNavigate();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [view, setView] = useState<"menu" | "account">("menu");

  useEffect(() => {
    if (!open) setView("menu");
  }, [open]);

  // Aquece os chunks lazy dos destinos do menu enquanto o drawer abre — sem
  // isso, clicar em "Conquistas"/"Assinatura" ainda baixa o chunk na hora e
  // trava junto com a animação de fechar.
  useEffect(() => {
    if (!open) return;
    import("@/pages/Conquistas");
    import("@/pages/Retrospectiva");
    import("@/pages/Notificacoes");
    if (isNativeShell()) import("@/pages/PlanosApp");
    else import("@/pages/Planos");
  }, [open]);

  // Fecha o drawer já e deixa o React montar a rota nova sem bloquear o frame
  const go = (path: string) => {
    onOpenChange(false);
    startTransition(() => navigate(path));
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
  const menuItems = isGuest
    ? [
        { icon: UserCircle, label: "Minha conta", onClick: handleMinhaConta, spotlight: "minha-conta" as const },
        // 17/08 (reclamação real): convidado definia o nome uma vez (lápis da
        // saudação, que some depois) e NUNCA MAIS conseguia alterar — a seção
        // "Nome" só existia na aba de conta, que convidado não tem. O nome é
        // local (core-user-name), não precisa de conta pra editar.
        { icon: Pencil, label: "Alterar meu nome", onClick: () => setShowNameDialog(true) },
        // 16/08: no teste grátis de 3 dias o convidado usa o app inteiro sem
        // conta — e o menu não tinha nenhuma porta pro plano. Quem decidia
        // assinar no meio do teste só tinha a faixa fina do rodapé, que some
        // nas telas de funil. Quem quer pagar precisa de caminho.
        { icon: CreditCard, label: "Meu acesso", onClick: handleManageSubscription },
      ]
    : [
        { icon: UserCircle, label: "Minha conta", onClick: handleMinhaConta, spotlight: "minha-conta" as const },
        { icon: CreditCard, label: "Meu acesso", onClick: handleManageSubscription },
        // 27/07: a retrospectiva existia escondida dentro de Finanças — quem
        // não abria aquele módulo nunca soube. Agora tem porta no menu.
        { icon: Sparkles, label: "Retrospectiva", onClick: () => go("/retrospectiva") },
        { icon: Trophy, label: "Conquistas", onClick: () => go("/conquistas") },
        // Notificações são LOCAIS do app da loja — na web/PWA não existe como
        // entregar (30/07, dono: some da web pra não virar ticket de suporte).
        ...(isNativeShell() ? [{ icon: Bell, label: "Notificações", onClick: () => go("/notificacoes") }] : []),
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
        >
          {/* pegador: sinaliza que a folha desce arrastando */}
          <div className="pt-3 pb-1 flex justify-center" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
          </div>
          {view === "menu" && (
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

          {view === "account" && !isGuest && (
            <>
              <SheetHeader className="px-5 pt-6 pb-4 flex-row items-center gap-2 space-y-0">
                <button
                  onClick={() => setView("menu")}
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
                    onClick={() => setShowNameDialog(true)}
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
                <div className="pt-2 mt-1 border-t border-border">
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
    </>
  );
};
