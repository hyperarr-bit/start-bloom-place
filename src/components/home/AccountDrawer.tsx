import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Pencil, CreditCard, KeyRound, RotateCcw, LogOut, UserCircle } from "lucide-react";
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
      setShowNameDialog(true);
    }
  };

  const menuItems = isGuest
    ? [
        {
          icon: UserCircle,
          label: "Minha conta",
          onClick: handleMinhaConta,
          spotlight: "minha-conta",
        },
      ]
    : [
        {
          icon: UserCircle,
          label: "Minha conta",
          onClick: handleMinhaConta,
          spotlight: "minha-conta",
        },
        {
          icon: Pencil,
          label: "Editar nome",
          onClick: () => setShowNameDialog(true),
        },
        {
          icon: Trophy,
          label: "Conquistas",
          onClick: () => { onOpenChange(false); navigate("/conquistas"); },
        },
        {
          icon: CreditCard,
          label: "Gerenciar assinatura",
          onClick: handleManageSubscription,
        },
        {
          icon: KeyRound,
          label: "Alterar senha",
          onClick: handleResetPassword,
        },
        {
          icon: RotateCcw,
          label: "Rever tutorial",
          onClick: handleReplayTutorial,
        },
      ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[300px] sm:w-[340px] p-0">
          <SheetHeader className="px-5 pt-6 pb-4">
            <SheetTitle className="text-sm font-semibold">Minha Conta</SheetTitle>
          </SheetHeader>

          {/* Profile card */}
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

          {/* Menu items */}
          <div className="px-5 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <item.icon className="w-4 h-4 text-muted-foreground" />
                {item.label}
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-border">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>
            </div>
          </div>
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
