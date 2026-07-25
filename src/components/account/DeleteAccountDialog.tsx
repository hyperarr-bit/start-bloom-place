import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { toast } from "sonner";

/**
 * EXCLUIR CONTA (24/07) — exigência do Google Play: app com login precisa de
 * um caminho de exclusão DENTRO do app (e uma URL pública equivalente,
 * /excluir-conta). Chama a função delete-account, que apaga os dados e o
 * usuário do auth.
 *
 * A fricção é de propósito: digitar EXCLUIR evita o arrependimento de um
 * toque só numa ação irreversível — a base guarda finanças e saúde da pessoa.
 * No app a gente avisa que a assinatura da loja não morre junto (só o Google
 * cancela) pra ninguém achar que apagar a conta parou a cobrança.
 */
export function DeleteAccountDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [texto, setTexto] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const confirmar = async () => {
    if (texto.trim().toUpperCase() !== "EXCLUIR" || excluindo) return;
    setExcluindo(true);
    trackEvent("account_delete_confirm", {});
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirmar: true },
    });
    if (error || !data?.ok) {
      setExcluindo(false);
      toast.error("Não consegui excluir agora. Tenta de novo ou fala com o suporte.");
      return;
    }
    // Sessão morre junto com o usuário: limpa o local e recomeça do zero.
    try { await supabase.auth.signOut(); } catch { /* usuário já não existe */ }
    try { localStorage.clear(); } catch { /* noop */ }
    window.location.href = "/";
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!excluindo) { setTexto(""); onOpenChange(v); } }}>
      <AlertDialogContent className="z-[320]">
        <AlertDialogHeader>
          <div className="w-11 h-11 rounded-full bg-destructive/10 text-destructive grid place-items-center mb-1">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <AlertDialogTitle>Excluir minha conta</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Isso apaga <b>pra sempre</b> sua conta e tudo que você registrou: finanças,
              rotina, treinos, metas — tudo. Não tem como desfazer.
            </span>
            {isNativeShell() && (
              <span className="block text-[12px]">
                Se você tem assinatura ativa, cancele também na Play Store — excluir a
                conta aqui não interrompe a cobrança.
              </span>
            )}
            <span className="block">Digite <b>EXCLUIR</b> pra confirmar:</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="EXCLUIR"
          autoCapitalize="characters"
          disabled={excluindo}
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={texto.trim().toUpperCase() !== "EXCLUIR" || excluindo}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir conta"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
