import { X, ZoomIn, Download } from "lucide-react";

interface ReceiptViewerProps {
  url: string;
  onClose: () => void;
}

export const ReceiptViewer = ({ url, onClose }: ReceiptViewerProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium">Comprovante</span>
            <div className="flex items-center gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <Download className="w-3.5 h-3.5" />
              </a>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="p-2">
            <img src={url} alt="Comprovante" className="w-full rounded-md object-contain max-h-[70vh]" />
          </div>
        </div>
      </div>
    </div>
  );
};
