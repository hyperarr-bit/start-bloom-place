/**
 * FOTOS anexadas a um exame, receita ou laudo (11/09, pedido de cliente:
 * "documentos, receituário, fotos de exames").
 *
 * Privacidade em primeiro lugar, porque é dado de saúde: no user_data fica
 * só o CAMINHO dentro do bucket privado; a URL pra mostrar a miniatura é
 * assinada na hora e vale uma hora. Apagar remove do bucket também.
 *
 * FOTO OU ARQUIVO (13/10, chamado: "só deixa tirar foto, o laudo veio em PDF
 * no e-mail"). Até aqui o `capture="environment"` forçava a câmera. Sem ele, e
 * aceitando PDF, o iPhone oferece "Tirar foto / Fototeca / Escolher arquivo" e
 * o Android oferece câmera + arquivos. PDF sobe intacto (uploadImagePath) e a
 * miniatura vira um ícone de documento que abre a URL assinada.
 */
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { caminhoEhPdf, ehPdf, removeImage, signedUrlFor, uploadImagePath } from "@/lib/image-upload";
import { ehCaminhoDeDemo } from "@/lib/caminho-demo";

export const BUCKET_SAUDE = "dream-board";
export const PASTA_SAUDE = "saude";
/** O que o seletor aceita: foto (qualquer formato de imagem) e PDF. Sem `capture`. */
export const ACEITA_ANEXO = "image/*,application/pdf";
/** Teto do PDF: laudo escaneado passa de 10 MB fácil; acima de 20 MB é quase
 *  sempre um exame de imagem inteiro, que no 4G do celular não sobe. */
export const MAX_PDF_MB = 20;

/* FOTO NA DEMO (26/09, varredura): em /preview não existe conta nem bucket —
 * a galeria abria e nada acontecia (progresso) ou dizia "Tenta de novo"
 * (exame, documento). Na demo o toque só explica; o app logado não muda. */
export const estaNaDemo = () => {
  try { return ehCaminhoDeDemo(window.location.pathname); } catch { return false; }
};
export const avisarFotoNaDemo = () =>
  toast("Fotos funcionam depois de criar a conta", { description: "Aqui na demonstração nada é salvo." });

/** Cache de URLs assinadas por caminho: a lista re-renderiza a cada tecla no
 *  formulário e não pode pedir assinatura de novo a cada render. */
const urls = new Map<string, string>();

const Miniatura = ({ caminho, onRemover, rotulo }: { caminho: string; onRemover?: () => void; rotulo: string }) => {
  const [url, setUrl] = useState<string | null>(urls.get(caminho) ?? null);
  const pdf = caminhoEhPdf(caminho);
  useEffect(() => {
    let vivo = true;
    if (!url) void signedUrlFor(BUCKET_SAUDE, caminho).then((u) => { if (vivo && u) { urls.set(caminho, u); setUrl(u); } });
    return () => { vivo = false; };
  }, [caminho, url]);
  return (
    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted shrink-0" data-testid="anexo">
      {url && pdf ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${rotulo}`} data-testid="anexo-pdf"
          className="w-full h-full flex flex-col items-center justify-center gap-1 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300">
          <FileText className="w-7 h-7" strokeWidth={1.6} />
          <span className="text-[10px] font-black tracking-wide">PDF</span>
        </a>
      ) : url ? (
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
    const pdf = ehPdf(file);
    if (!pdf && file.type && !file.type.startsWith("image/")) { setErro("Dá pra anexar foto ou PDF."); return; }
    if (pdf && file.size > MAX_PDF_MB * 1024 * 1024) { setErro(`Esse PDF passa de ${MAX_PDF_MB} MB. Tente uma foto da página do resultado.`); return; }
    setSubindo(true); setErro(null);
    const caminho = await uploadImagePath(BUCKET_SAUDE, file, PASTA_SAUDE);
    setSubindo(false);
    if (!caminho) { setErro(pdf ? "Não deu pra enviar o PDF. Tenta de novo." : "Não deu pra enviar a foto. Tenta de novo."); return; }
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
        {caminhos.map((c, i) => <Miniatura key={c} caminho={c} rotulo={`${rotulo} · ${caminhoEhPdf(c) ? "PDF" : "foto"} ${i + 1}`} onRemover={() => remover(c)} />)}
        <button type="button" onClick={() => (estaNaDemo() ? avisarFotoNaDemo() : inputRef.current?.click())} disabled={subindo}
          aria-label={subindo ? "Enviando anexo" : "Anexar foto ou PDF"}
          className="w-20 h-20 rounded-lg border border-dashed border-border text-muted-foreground flex flex-col items-center justify-center gap-1 text-[10px] hover:bg-muted/50 disabled:opacity-60">
          {subindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          {subindo ? "Enviando" : "Anexar"}
          {!subindo && <span className="text-[9px] leading-none opacity-70">foto ou PDF</span>}
        </button>
      </div>
      {/* sem `capture`: o sistema oferece câmera, galeria E arquivos */}
      <input ref={inputRef} type="file" accept={ACEITA_ANEXO} className="hidden" onChange={anexar} aria-label={`Anexar foto de ${rotulo}`} />
      {erro && <p className="text-[11px] text-destructive">{erro}</p>}
    </div>
  );
};
