import { useState } from "react";
import { Eraser, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

/**
 * COMEÇAR DO ZERO (26/09) — chamado do iPhone: "quero excluir tudo o que já
 * botei e iniciar o app novamente". Diferente de Excluir conta: apaga só os
 * registros (finanças, rotina, treinos, metas…) e mantém conta, e-mail e o
 * acesso pago. Mesma fricção do Excluir conta (digitar a palavra), porque
 * também é irreversível.
 */
export function ApagarDadosDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { apagarTudo } = useUserData();
  const [texto, setTexto] = useState("");
  const [apagando, setApagando] = useState(false);
  const pronto = texto.trim().toUpperCase() === "APAGAR";

  const confirmar = async () => {
    if (!pronto || apagando || !apagarTudo) return;
    setApagando(true);
    trackEvent("dados_apagar_confirm", {});
    const r = await apagarTudo();
    if (!r.ok) {
      setApagando(false);
      toast.error(r.erro ?? "Não deu pra apagar agora. Tenta de novo.");
      return;
    }
    trackEvent("dados_apagados", {});
    // Recarrega do zero: nenhum componente aberto fica com dado velho na memória.
    window.location.href = "/home";
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!apagando) { setTexto(""); onOpenChange(v); } }}>
      <AlertDialogContent className="z-[320]">
        <AlertDialogHeader>
          <div className="w-11 h-11 rounded-full bg-destructive/10 text-destructive grid place-items-center mb-1">
            <Eraser className="w-5 h-5" />
          </div>
          <AlertDialogTitle>Apagar meus dados e começar do zero</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Apaga <b>tudo o que você registrou</b> no app: gastos, contas, hábitos, treinos,
              dieta, metas, leituras — em todos os módulos. Não tem como desfazer.
            </span>
            <span className="block">
              Sua conta, seu e-mail e o seu acesso continuam iguais.
            </span>
            <span className="block">Digite <b>APAGAR</b> pra confirmar:</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="APAGAR"
          autoCapitalize="characters"
          disabled={apagando}
          aria-label="Digite APAGAR pra confirmar"
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={!pronto || apagando}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {apagando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apagar tudo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
