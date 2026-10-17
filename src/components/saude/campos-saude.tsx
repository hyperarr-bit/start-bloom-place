/**
 * Peças do Log médico usadas por consultas, exames e documentos (16/10: os
 * documentos ganharam o mesmo médico, o mesmo resumo e as mesmas pastas dos
 * exames — então as peças saíram do MedicalLog pra um lugar só).
 */
import { useMemo, useState } from "react";
import { Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseLocalDay } from "@/lib/utils";
import { ESPECIALIDADES_COMUNS, TODOS, aoEscolherMedico, type MedicoConhecido, type PastaDeMedico } from "@/lib/saude-medicos";

/** dd/mm/aaaa (13/10: o ano inteiro — "22" e "26" se confundiam de relance). */
export const diaCompleto = (key?: string) =>
  typeof key === "string" && /^\d{4}-\d{2}-\d{2}/.test(key)
    ? parseLocalDay(key.slice(0, 10)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

/**
 * Médico + especialidade no formulário (exame: "Pedido por"; documento:
 * "Médico"). Sugere os médicos que já apareceram em consultas, exames e
 * documentos, e as especialidades mais comuns. Escolher um médico conhecido
 * preenche a especialidade (aoEscolherMedico).
 */
export const CamposPedidoPor = ({
  valor, onChange, conhecidos, idBase,
  titulo = "Pedido por", rotuloMedico = "Médico que pediu o exame",
  dica,
}: {
  valor: { medico?: string; especialidade?: string };
  onChange: (v: { medico: string; especialidade: string }) => void;
  conhecidos: MedicoConhecido[];
  idBase: string;
  titulo?: string;
  rotuloMedico?: string;
  /** Uma linha embaixo dizendo pra que serve (documento: "cria a pasta do médico"). */
  dica?: string;
}) => {
  const especialidades = useMemo(() => {
    const extras = conhecidos.map(m => m.especialidade).filter(Boolean);
    return [...new Set([...ESPECIALIDADES_COMUNS, ...extras])];
  }, [conhecidos]);
  return (
    <div className="grid gap-1.5" data-testid="pedido-por">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Stethoscope className="w-3 h-3" /> {titulo} <span className="font-normal normal-case tracking-normal">(opcional)</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={valor.medico ?? ""}
          onChange={ev => onChange(aoEscolherMedico(valor, ev.target.value, conhecidos))}
          placeholder="Médico (ex: Dr. Hélio)"
          aria-label={rotuloMedico}
          list={`${idBase}-medicos`}
          className="text-xs h-9"
        />
        <Input
          value={valor.especialidade ?? ""}
          onChange={ev => onChange({ medico: valor.medico ?? "", especialidade: ev.target.value })}
          placeholder="Especialidade"
          aria-label="Especialidade do médico"
          list={`${idBase}-especialidades`}
          className="text-xs h-9"
        />
      </div>
      {dica && <p className="text-[10px] leading-snug text-muted-foreground">{dica}</p>}
      <datalist id={`${idBase}-medicos`}>
        {conhecidos.map(m => <option key={m.nome} value={m.nome}>{m.especialidade}</option>)}
      </datalist>
      <datalist id={`${idBase}-especialidades`}>
        {especialidades.map(e => <option key={e} value={e} />)}
      </datalist>
    </div>
  );
};

/** Campo do resumo no formulário, com rótulo: preenchido, o placeholder some e
 *  a pessoa não saberia mais que aquilo é o que aparece na lista. */
export const CampoResumo = ({
  valor, onChange, titulo = "Resumo do resultado", rotulo = "Resumo do resultado",
  exemplo = "Ex: Ressonância normal, sem alterações. Vitamina D 24 (baixa).",
}: {
  valor: string; onChange: (v: string) => void; titulo?: string; rotulo?: string; exemplo?: string;
}) => (
  <div className="grid gap-1.5">
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      📄 {titulo} <span className="font-normal normal-case tracking-normal">(aparece na lista)</span>
    </p>
    <Textarea value={valor} onChange={ev => onChange(ev.target.value)} placeholder={exemplo} aria-label={rotulo} className="text-xs min-h-[60px]" />
  </div>
);

/** Resumo embaixo do item: 3 linhas, toque abre o texto inteiro. */
export const ResumoExpansivel = ({ texto, nome, testId = "exame-resumo" }: { texto: string; nome: string; testId?: string }) => {
  const [aberto, setAberto] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setAberto(!aberto)}
      aria-expanded={aberto}
      aria-label={`${aberto ? "Recolher" : "Ler"} resumo de ${nome}`}
      className="w-full text-left rounded-lg bg-muted/60 px-2.5 py-1.5"
      data-testid={testId}
    >
      {/* `block` e `line-clamp-3` brigam pelo display (o clamp precisa de -webkit-box) */}
      <span className={`text-[11px] leading-snug text-foreground/80 whitespace-pre-wrap ${aberto ? "block" : "line-clamp-3"}`}>
        {texto}
      </span>
    </button>
  );
};

/** Ícone do chip: médico, especialidade ou nenhum ("Todos", "Sem médico"). */
const iconeDaPasta = (p: PastaDeMedico) => (p.tipo === "especialidade" ? "🏷️ " : p.tipo === "medico" || (!p.tipo && p.chave !== TODOS && p.rotulo !== "Sem médico") ? "🩺 " : "");

/** Chips "Todos · Dr. X · Especialidade · Sem médico" (filtro de uma lista). */
export const ChipsDePasta = ({ pastas, total, ativa, onEscolher, rotulo, testId }: {
  pastas: PastaDeMedico[];
  total: number;
  ativa: string;
  onEscolher: (chave: string) => void;
  rotulo: string;
  testId: string;
}) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label={rotulo} data-testid={testId}>
    {[{ chave: TODOS, rotulo: "Todos", total } as PastaDeMedico, ...pastas].map(p => {
      const ativo = ativa === p.chave;
      return (
        <button key={p.chave} type="button" onClick={() => onEscolher(p.chave)} aria-pressed={ativo}
          className={`shrink-0 h-8 px-3 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors ${ativo ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted/60"}`}>
          {iconeDaPasta(p)}{p.rotulo} <span className={ativo ? "opacity-70" : "opacity-60"}>{p.total}</span>
        </button>
      );
    })}
  </div>
);
