/**
 * FOTOS anexadas a um exame, receita ou laudo (11/09, pedido de cliente:
 * "documentos, receituário, fotos de exames").
 *
 * Privacidade em primeiro lugar, porque é dado de saúde: no user_data fica
 * só o CAMINHO dentro do bucket privado; a URL pra mostrar a miniatura é
 * assinada na hora e vale uma hora. Apagar remove do bucket também.
 * Câmera direto no celular (`capture`), galeria no computador.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { removeImage, signedUrlFor, uploadImagePath } from "@/lib/image-upload";

export const BUCKET_SAUDE = "dream-board";
export const PASTA_SAUDE = "saude";

/** Cache de URLs assinadas por caminho: a lista re-renderiza a cada tecla no
 *  formulário e não pode pedir assinatura de novo a cada render. */
const urls = new Map<string, string>();

const Miniatura = ({ caminho, onRemover, rotulo }: { caminho: string; onRemover?: () => void; rotulo: string }) => {
  const [url, setUrl] = useState<string | null>(urls.get(caminho) ?? null);
  useEffect(() => {
    let vivo = true;
    if (!url) void signedUrlFor(BUCKET_SAUDE, caminho).then((u) => { if (vivo && u) { urls.set(caminho, u); setUrl(u); } });
    return () => { vivo = false; };
  }, [caminho, url]);
  return (
    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted shrink-0" data-testid="anexo">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${rotulo}`}>
          <img src={url} alt={rotulo} className="w-full h-full object-cover" />
        </a>
      ) : (
        <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      )}
      {onRemover && (
        <button type="button" onClick={onRemover} aria-label={`Remover ${rotulo}`}
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export const AnexosDeSaude = ({ caminhos, onChange, rotulo }: {
  caminhos: string[];
  onChange: (novos: string[]) => void;
  rotulo: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const anexar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubindo(true); setErro(null);
    const caminho = await uploadImagePath(BUCKET_SAUDE, file, PASTA_SAUDE);
    setSubindo(false);
    if (!caminho) { setErro("Não deu pra enviar a foto. Tenta de novo."); return; }
    onChange([...caminhos, caminho]);
  };
  const remover = (caminho: string) => {
    onChange(caminhos.filter((c) => c !== caminho));
    urls.delete(caminho);
    void removeImage(BUCKET_SAUDE, caminho);
  };

  return (
    <div className="space-y-1.5" data-testid="anexos-saude">
      <div className="flex flex-wrap gap-2">
        {caminhos.map((c, i) => <Miniatura key={c} caminho={c} rotulo={`${rotulo} · foto ${i + 1}`} onRemover={() => remover(c)} />)}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={subindo}
          className="w-20 h-20 rounded-lg border border-dashed border-border text-muted-foreground flex flex-col items-center justify-center gap-1 text-[10px] hover:bg-muted/50 disabled:opacity-60">
          {subindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {subindo ? "Enviando" : "Foto"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={anexar} aria-label={`Anexar foto de ${rotulo}`} />
      {erro && <p className="text-[11px] text-destructive">{erro}</p>}
    </div>
  );
};
