import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WinbackWheel } from "./WinbackWheel";
import { WinbackOffer } from "./WinbackOffer";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  attemptId: string | null;
}

export function WinbackFlow({ open, onClose, attemptId }: Props) {
  const [step, setStep] = useState<"wheel" | "offer">("wheel");

  useEffect(() => {
    if (open) setStep("wheel");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md w-[calc(100%-2rem)] max-h-[95vh] overflow-y-auto p-6 gap-0 [&>button]:hidden z-[200]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Sua oferta especial</DialogTitle>
        <DialogDescription className="sr-only">
          Gire a roleta e descubra o desconto exclusivo que reservamos para você.
        </DialogDescription>

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {step === "wheel" ? (
          <WinbackWheel attemptId={attemptId} onSpinComplete={() => setStep("offer")} />
        ) : (
          <WinbackOffer attemptId={attemptId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
