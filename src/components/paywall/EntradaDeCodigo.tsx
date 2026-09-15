/**
 * "Tenho um código" — a porta do "segue e ganha 7 dias" (14/09).
 *
 * Um link discreto no rodapé do paywall; tocou, vira um campo + botão. Dois
 * modos: `validar` (paywall de entrada, sem conta — só confere e guarda) e
 * `resgatar` (conta logada — cria o acesso na hora). Nos dois, `onOk(dias)`
 * é quem segue o fluxo. Some no iPhone (3.1.1).
 */
import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { ehApple } from "@/lib/loja";
import { MENSAGENS, normalizarCodigo, resgatarCodigo, validarCodigo } from "@/lib/codigo-promo";

export function EntradaDeCodigo({ modo, onOk, className = "" }: {
  modo: "validar" | "resgatar";
  onOk: (dias: number) => void;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (ehApple()) return null;

  const aplicar = async () => {
    const c = normalizarCodigo(codigo);
    if (!c) { setErro(MENSAGENS.invalido); return; }
    setEnviando(true); setErro(null);
    const r = modo === "validar" ? await validarCodigo(c) : await resgatarCodigo(c);
    setEnviando(false);
    if (r.ok) { onOk(r.dias ?? 7); return; }
    setErro(MENSAGENS[r.erro ?? "rede"]);
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`text-[12px] font-semibold text-muted-foreground underline underline-offset-2 ${className}`}
        data-testid="tenho-codigo"
      >
        Tenho um código
      </button>
    );
  }

  return (
    <div className={`text-left ${className}`} data-testid="entrada-codigo">
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
        <Ticket className="w-3.5 h-3.5" /> Código
      </label>
      <div className="flex gap-2">
        <input
          autoFocus
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErro(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void aplicar(); }}
          placeholder="Ex.: INSTA7"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          className="flex-1 min-w-0 h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold tracking-widest uppercase outline-none focus:ring-2 focus:ring-foreground/20"
          aria-label="Código"
        />
        <button
          type="button"
          onClick={() => void aplicar()}
          disabled={enviando || !codigo.trim()}
          className="h-11 px-4 rounded-xl bg-foreground text-background text-sm font-bold disabled:opacity-50 shrink-0"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
        </button>
      </div>
      {erro && <p className="text-[12px] text-destructive mt-1.5" role="alert">{erro}</p>}
    </div>
  );
}
