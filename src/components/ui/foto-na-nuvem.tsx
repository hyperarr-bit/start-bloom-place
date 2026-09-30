import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { uploadImage } from "@/lib/image-upload";

/**
 * FOTO QUE VAI PRO STORAGE, NÃO PRA DENTRO DA CHAVE (30/09, integração do Pet).
 *
 * O `PhotoPicker` de sempre devolve a foto como data URL (base64, ~40–90 KB cada)
 * e ela era gravada DENTRO de `pet-list`/`pet-diary`. Uma foto já passa do limite
 * de chave pesada (50 KB, ver use-user-data) — foi a família do "cadastro o pet e
 * ele some" de julho/agosto. Aqui a foto sobe pro bucket privado `dream-board`
 * (o mesmo da Biblioteca e do Quadro dos sonhos, pasta da pessoa) e a chave
 * guarda só a URL assinada — um texto curto, no MESMO campo `photoUrl`, que o
 * app antigo mostra igual (`<img src>`). Foto antiga em base64 fica como está:
 * nada é reescrito sem a pessoa trocar a foto.
 *
 * Na demo (/preview) não há conta: a foto fica só na memória da demo, como antes.
 * Sem conta (convidado), avisa em vez de gravar base64 na chave.
 */
const BUCKET = "dream-board";

const emDemonstracao = () => {
  try { return window.location.pathname.startsWith("/preview"); } catch { return false; }
};

/** Na demo: miniatura em memória (nunca vai pro servidor — a demo não grava nada). */
const paraDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = (h / w) * MAX; w = MAX; } else { w = (w / h) * MAX; h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export interface FotoNaNuvemProps {
  value?: string;
  onChange: (url: string) => void;
  onClear: () => void;
  /** subpasta no bucket, dentro da pasta da pessoa (ex.: "pet", "pet-diario") */
  pasta: string;
  label?: string;
  className?: string;
  previewSize?: "sm" | "md";
}

export const FotoNaNuvem = ({ value, onChange, onClear, pasta, label = "Adicionar foto", className = "", previewSize = "sm" }: FotoNaNuvemProps) => {
  const { isGuest } = useUserData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // deixa escolher a mesma foto de novo
    if (!file) return;
    if (emDemonstracao()) {
      try { onChange(await paraDataUrl(file)); } catch { toast.error("Não deu pra abrir essa foto."); }
      return;
    }
    if (isGuest) {
      toast.error("Pra guardar foto, entre na sua conta.");
      return;
    }
    setSubindo(true);
    try {
      const url = await uploadImage(BUCKET, file, pasta);
      if (!url) { toast.error("Não deu pra subir a foto agora. Confere a internet e tenta de novo."); return; }
      onChange(url);
    } catch {
      toast.error("Não deu pra subir a foto agora. Confere a internet e tenta de novo.");
    } finally {
      setSubindo(false);
    }
  };

  const sizeClass = previewSize === "md" ? "w-full h-32" : "w-16 h-16";

  if (value) {
    return (
      <div className={`relative inline-block ${className}`}>
        <img src={value} alt="Foto escolhida" className={`${sizeClass} rounded-lg object-cover`} />
        <button
          type="button"
          onClick={onClear}
          aria-label="Tirar a foto"
          className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={escolher} data-testid={`foto-${pasta}`} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subindo}
        className={`flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
      >
        <Camera className="w-3.5 h-3.5" />
        {subindo ? "Subindo a foto…" : label}
      </button>
    </>
  );
};
