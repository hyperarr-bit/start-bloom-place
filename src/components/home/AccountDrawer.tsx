import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Pencil, CreditCard, RotateCcw, LogOut, UserCircle, ChevronLeft, Mail, KeyRound } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { NameEditDialog } from "./NameEditDialog";
import { toast } from "sonner";

interface AccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  onNameChange?: (name: string) => void;
  onReplayTutorial?: () => void;
}

export const AccountDrawer = ({
  open,
  onOpenChange,
  displayName,
  onNameChange,
  onReplayTutorial,
}: AccountDrawerProps) => {
  const { user, signOut } = useAuth();
  const { set: setUserData, isGuest } = useUserData();
  const navigate = useNavigate();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [view, setView] = useState<"menu" | "account">("menu");

  useEffect(() => {
    if (!open) setView("menu");
  }, [open]);

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

  const handleManageSubscription = () => {
    onOpenChange(false);
    navigate("/planos");
  };

  const handleReplayTutorial = () => {
    localStorage.removeItem("core-welcome-done");
    setUserData("core-onboarding-done", "");
    onOpenChange(false);
    onReplayTutorial?.();
  };

  const handleMinhaConta = () => {
    if (isGuest) {
      onOpenChange(false);
      setUserData("quicksignup-pending", "true");
    } else {
      setView("account");
    }
  };

  const menuItems = isGuest
    ? [
        { icon: UserCircle, label: "Minha conta", onClick: handleMinhaConta, spotlight: "minha-conta" as const },
      ]
    : [
        { icon: UserCircle, label: "Minha conta", onClick: handleMinhaConta, spotlight: "minha-conta" as const },
        { icon: CreditCard, label: "Assinatura", onClick: handleManageSubscription },
        { icon: Trophy, label: "Conquistas", onClick: () => { onOpenChange(false); navigate("/conquistas"); } },
        { icon: RotateCcw, label: "Rever tutorial", onClick: handleReplayTutorial },
      ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="w-[300px] sm:w-[340px] p-0 z-[300]"
          overlayClassName="z-[290]"
        >
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
    </>
  );
};
