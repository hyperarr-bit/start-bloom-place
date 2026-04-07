import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface PhotoPickerProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  onClear: () => void;
  label?: string;
  className?: string;
  previewSize?: "sm" | "md";
}

export const PhotoPicker = ({ value, onChange, onClear, label = "Adicionar foto", className = "", previewSize = "sm" }: PhotoPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 2MB after compression
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = (h / w) * MAX; w = MAX; }
          else { w = (w / h) * MAX; h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        onChange(dataUrl);
        setLoading(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);

    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const sizeClass = previewSize === "md" ? "w-full h-32" : "w-16 h-16";

  if (value) {
    return (
      <div className={`relative inline-block ${className}`}>
        <img src={value} alt="Preview" className={`${sizeClass} rounded-lg object-cover`} />
        <button
          type="button"
          onClick={onClear}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className={`flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
      >
        <Camera className="w-3.5 h-3.5" />
        {loading ? "Processando..." : label}
      </button>
    </>
  );
};
