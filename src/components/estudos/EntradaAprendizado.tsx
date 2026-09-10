/**
 * Uma entrada de "o que aprendi" — a mesma peça na linha do curso e no
 * Caderno, pra que editar/apagar seja igual nos dois lugares.
 *
 * Lápis e lixeira SEMPRE visíveis, alvo de 36px: o Tailwind daqui roda com
 * `hoverOnlyWhenSupported`, e no celular não existe hover — a lição do
 * "Restaurar compras" de 17px (v94) e da lixeira invisível dos cursos vale
 * aqui. Nada de `opacity-0 group-hover:opacity-100`.
 */
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { diaCurto, type Aprendizado } from "./aprendizados";

export interface RascunhoAprendizado {
  referencia: string;
  aprendi: string;
  porque: string;
}

/** Formulário compartilhado entre "novo" e "editar". `extra` é o checkbox de
 *  avançar aula, que só faz sentido no registro novo. */
export const FormularioAprendizado = ({ rascunho, onChange, onSalvar, onCancelar, extra, rotuloSalvar = "Salvar aprendizado" }: {
  rascunho: RascunhoAprendizado;
  onChange: (r: RascunhoAprendizado) => void;
  onSalvar: () => void;
  onCancelar: () => void;
  extra?: React.ReactNode;
  rotuloSalvar?: string;
}) => {
  const podeSalvar = rascunho.aprendi.trim() !== "";
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-testid="form-aprendizado">
      <Input value={rascunho.referencia} onChange={(e) => onChange({ ...rascunho, referencia: e.target.value })}
        placeholder="Referência: aula, slide, capítulo (ex: Aula 12 · slide 8)" aria-label="Referência"
        className="h-9 text-xs rounded-lg" />
      <Textarea autoFocus value={rascunho.aprendi} onChange={(e) => onChange({ ...rascunho, aprendi: e.target.value })}
        placeholder="O que aprendi" aria-label="O que aprendi"
        className="text-sm rounded-lg min-h-[64px] resize-none" />
      <Textarea value={rascunho.porque} onChange={(e) => onChange({ ...rascunho, porque: e.target.value })}
        placeholder="Por que é bom / como aplicar (opcional)" aria-label="Por que é bom ou como aplicar"
        className="text-xs rounded-lg min-h-[48px] resize-none" />
      {extra}
      <div className="flex items-center gap-2 pt-0.5">
        <button type="button" onClick={onSalvar} disabled={!podeSalvar}
          className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50">
          <Check className="w-3.5 h-3.5" /> {rotuloSalvar}
        </button>
        <button type="button" onClick={onCancelar} aria-label="Cancelar"
          className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
};

export const EntradaAprendizado = ({ entrada, cursoNome, onEditar, onApagar }: {
  entrada: Aprendizado;
  /** Só o Caderno mostra de qual curso veio; na linha do curso é redundante. */
  cursoNome?: string;
  onEditar: (novo: Aprendizado) => void;
  onApagar: () => void;
}) => {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoAprendizado>({ referencia: "", aprendi: "", porque: "" });
  /** Apagar em DOIS toques, sem window.confirm (que o app não usa em lugar
   *  nenhum): é texto que a pessoa escreveu, não pode ir embora num esbarrão. */
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);

  if (editando) {
    return (
      <FormularioAprendizado
        rascunho={rascunho}
        onChange={setRascunho}
        rotuloSalvar="Salvar"
        onSalvar={() => {
          const aprendi = rascunho.aprendi.trim();
          if (!aprendi) return;
          onEditar({
            ...entrada,
            aprendi,
            referencia: rascunho.referencia.trim() || undefined,
            porque: rascunho.porque.trim() || undefined,
          });
          setEditando(false);
        }}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  const meta = [diaCurto(entrada.data), cursoNome, entrada.referencia].filter(Boolean).join(" · ");
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2" data-testid="aprendizado">
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          {meta && <p className="text-[10px] text-muted-foreground truncate">{meta}</p>}
          <p className="text-sm whitespace-pre-wrap break-words">{entrada.aprendi}</p>
          {entrada.porque && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words mt-0.5">
              <span className="font-semibold">Por quê:</span> {entrada.porque}
            </p>
          )}
        </div>
        <div className="flex items-center shrink-0 -mr-1">
          <button type="button" aria-label="Editar aprendizado"
            onClick={() => {
              setRascunho({ referencia: entrada.referencia || "", aprendi: entrada.aprendi, porque: entrada.porque || "" });
              setConfirmandoApagar(false);
              setEditando(true);
            }}
            className="h-9 w-9 flex items-center justify-center rounded-lg">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {confirmandoApagar ? (
            <button type="button" onClick={onApagar} aria-label="Confirmar exclusão do aprendizado"
              className="h-9 px-1.5 rounded text-[9px] font-bold text-destructive border border-destructive/40">
              apagar?
            </button>
          ) : (
            <button type="button" aria-label="Apagar aprendizado" onClick={() => setConfirmandoApagar(true)}
              className="h-9 w-9 flex items-center justify-center rounded-lg">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
