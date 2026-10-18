/**
 * DOCUMENTOS do Log médico (11/09 receita/laudo/atestado com foto; 16/10
 * completo como os exames). Regras de dado e compatibilidade: lib/saude-documentos.
 *
 * O que a pessoa vê, de cima pra baixo:
 *  - formulário: tipo → título (com sugestões do tipo) → data → médico +
 *    especialidade → "Resumo / notas" → foto ou PDF;
 *  - chips de pasta (Todos · Dr. X · Especialidade · Sem médico) quando algum
 *    documento tem médico;
 *  - cada documento: tipo, título, médico · especialidade, data dd/mm/aaaa,
 *    anexos e o resumo em 3 linhas (toque abre). Lápis edita — sem isso, quem
 *    já tinha documentos guardados não conseguia pôr o médico neles.
 */
import { useMemo, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { localDayKey } from "@/lib/utils";
import { caminhoEhPdf } from "@/lib/image-upload";
import { AnexosDeSaude } from "./AnexosDeSaude";
import { CampoResumo, CamposPedidoPor, ChipsDePasta, ResumoExpansivel, diaCompleto } from "./campos-saude";
import { TODOS, chaveMedico, naPasta, pastasDosItens, rotuloMedico, type MedicoConhecido } from "@/lib/saude-medicos";
import {
  EXEMPLO_RESUMO, EXEMPLO_TITULO, ORDEM_TIPOS, SUGESTOES_TITULO, TODAS_SUGESTOES,
  documentoParaGravar, documentoVazio, tipoDoDocumento,
  type Documento, type RascunhoDocumento,
} from "@/lib/saude-documentos";

const contagemDeAnexos = (fotos: string[]) =>
  fotos.length ? `${fotos.length} ${fotos.some(caminhoEhPdf) ? "anexo" : "foto"}${fotos.length > 1 ? "s" : ""}` : "";

const FormDocumento = ({ valor, onChange, conhecidos, idBase, rotuloAnexo, rotuloSalvar, onSalvar, onCancelar }: {
  valor: RascunhoDocumento;
  onChange: (v: RascunhoDocumento) => void;
  conhecidos: MedicoConhecido[];
  idBase: string;
  rotuloAnexo: string;
  rotuloSalvar: string;
  onSalvar: () => void;
  onCancelar?: () => void;
}) => {
  const tipo = tipoDoDocumento(valor.tipo).id;
  return (
    <div className="grid gap-2 p-3 rounded-xl bg-muted/40" data-testid="form-documento">
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Tipo do documento">
        {ORDEM_TIPOS.map(id => {
          const t = tipoDoDocumento(id);
          const ativo = tipo === id;
          return (
            <button key={id} type="button" aria-pressed={ativo} onClick={() => onChange({ ...valor, tipo: id })}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${ativo ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
              {t.emoji} {t.rotulo}
            </button>
          );
        })}
      </div>
      <Input value={valor.titulo} onChange={e => onChange({ ...valor, titulo: e.target.value })}
        placeholder={EXEMPLO_TITULO[tipo]} aria-label="Título do documento" list={`${idBase}-titulos`} className="text-xs h-9" />
      <datalist id={`${idBase}-titulos`}>
        {TODAS_SUGESTOES.map(s => <option key={s} value={s} />)}
      </datalist>
      {/* um toque preenche o título: "exame de sangue", "eletrocardiograma"… */}
      <div className="flex gap-1 flex-wrap" role="group" aria-label="Sugestões de título" data-testid="sugestoes-titulo">
        {SUGESTOES_TITULO[tipo].map(s => (
          <button key={s} type="button" onClick={() => onChange({ ...valor, titulo: s })}
            aria-pressed={valor.titulo === s}
            className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors ${valor.titulo === s ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground"}`}>
            {s}
          </button>
        ))}
      </div>
      <CampoData rotulo="Data" value={valor.date} onChange={e => onChange({ ...valor, date: e.target.value })} className="text-xs h-9" />
      <CamposPedidoPor idBase={idBase} valor={valor} conhecidos={conhecidos}
        titulo="Médico" rotuloMedico="Médico do documento"
        dica="Com o médico, o documento entra na pasta dele (em Pastas, aqui embaixo)."
        onChange={v => onChange({ ...valor, ...v })} />
      <CampoResumo valor={valor.notes} onChange={notes => onChange({ ...valor, notes })}
        titulo="Resumo / notas" rotulo="Resumo ou notas do documento" exemplo={EXEMPLO_RESUMO[tipo]} />
      <AnexosDeSaude caminhos={valor.fotos} onChange={fotos => onChange({ ...valor, fotos })} rotulo={rotuloAnexo} />
      <div className="flex items-center gap-2">
        <button onClick={onSalvar} disabled={!valor.titulo.trim()}
          className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
          <Check className="w-3.5 h-3.5" /> {rotuloSalvar}
        </button>
        {onCancelar && (
          <button onClick={onCancelar} className="h-9 px-4 rounded-xl border border-border text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

export const DocumentosDeSaude = ({ documentos, setDocumentos, conhecidos, onApagar }: {
  /** Já normalizados (normalizarDocumentos) — só pra exibir. */
  documentos: Documento[];
  setDocumentos: (f: (prev: Documento[]) => Documento[]) => void;
  conhecidos: MedicoConhecido[];
  onApagar: (id: string, texto: string) => void;
}) => {
  const [formAberto, setFormAberto] = useState(false);
  const [novo, setNovo] = useState<RascunhoDocumento>(() => documentoVazio(localDayKey()));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoDocumento>(() => documentoVazio(""));
  const [aberto, setAberto] = useState<string | null>(null);

  const guardar = () => {
    if (!novo.titulo.trim()) return;
    setDocumentos(prev => [...(Array.isArray(prev) ? prev : []), { ...documentoParaGravar(novo), id: Date.now().toString() }]);
    setNovo(documentoVazio(localDayKey(), novo.tipo));
    setFormAberto(false);
  };

  const comecarEdicao = (d: Documento) => {
    setEditandoId(d.id);
    setRascunho({ tipo: d.tipo, titulo: d.titulo, date: d.date, notes: d.notes, fotos: d.fotos, medico: d.medico ?? "", especialidade: d.especialidade ?? "" });
  };
  const salvarEdicao = () => {
    if (!rascunho.titulo.trim() || !editandoId) return;
    setDocumentos(prev => (Array.isArray(prev) ? prev : []).map(x => {
      if (String(x?.id) !== editandoId) return x;
      // médico apagado na edição tem que SAIR do dado (não ficar o antigo)
      const { medico: _m, especialidade: _e, ...base } = x;
      return { ...base, ...documentoParaGravar(rascunho), id: x.id };
    }));
    setEditandoId(null);
  };
  const fotosDe = (id: string, fotos: string[]) =>
    setDocumentos(prev => (Array.isArray(prev) ? prev : []).map(x => String(x?.id) === id ? { ...x, fotos } : x));

  /* PASTAS (16/10): os mesmos chips dos exames, só que dos documentos. */
  const pastas = useMemo(() => pastasDosItens(documentos), [documentos]);
  const [pasta, setPasta] = useState<string>(TODOS);
  const pastaValida = pasta === TODOS || pastas.some(p => p.chave === pasta) ? pasta : TODOS;
  const visiveis = documentos.filter(d => naPasta(d, pastaValida)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      <div className="bg-amber-200 dark:bg-amber-900/40 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-wide text-foreground">Documentos</h3>
        <span className="text-3xl">🗂️</span>
      </div>
      <div className="p-4 space-y-3">
        <button onClick={() => setFormAberto(!formAberto)}
          className="w-full h-10 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground flex items-center justify-center gap-1.5 hover:bg-muted/40 transition-colors">
          {formAberto ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {formAberto ? "Fechar" : "Guardar exame, laudo, receita ou atestado"}
        </button>
        {formAberto && (
          <FormDocumento valor={novo} onChange={setNovo} conhecidos={conhecidos} idBase="documento-novo"
            rotuloAnexo="documento novo" rotuloSalvar="Guardar" onSalvar={guardar} />
        )}
        {documentos.length === 0 && !formAberto && (
          <div className="text-center py-2 space-y-1" data-testid="documentos-vazio">
            <p className="text-xs text-muted-foreground">Guarde aqui exames, laudos, receitas, atestados e vacinas — com a foto ou o PDF, o médico e um resumo.</p>
            <p className="text-[10px] text-muted-foreground/80">Ex.: “Exame de sangue · Dra. Ana · Cardiologia”. Com o médico, ele entra na pasta dele.</p>
          </div>
        )}
        {pastas.length > 0 && (
          <ChipsDePasta pastas={pastas} total={documentos.length} ativa={pastaValida} onEscolher={setPasta}
            rotulo="Documentos por médico" testId="pastas-documentos" />
        )}
        {visiveis.map(d => {
          if (editandoId === d.id) {
            return (
              <FormDocumento key={d.id} valor={rascunho} onChange={setRascunho} conhecidos={conhecidos} idBase={`documento-${d.id}`}
                rotuloAnexo={d.titulo} rotuloSalvar="Salvar" onSalvar={salvarEdicao} onCancelar={() => setEditandoId(null)} />
            );
          }
          const tipo = tipoDoDocumento(d.tipo);
          const estaAberto = aberto === d.id;
          const temMedico = !!(chaveMedico(d.medico) || d.especialidade?.trim());
          return (
            <div key={d.id} className="rounded-xl border border-border bg-card" data-testid="documento">
              <div className="flex items-start gap-2 px-3 py-2">
                <span className="text-lg leading-8">{tipo.emoji}</span>
                <button type="button" onClick={() => setAberto(estaAberto ? null : d.id)} className="flex-1 min-w-0 text-left py-0.5">
                  <p className="text-xs font-bold line-clamp-2">{d.titulo}</p>
                  <p className="text-[10px] text-muted-foreground" data-testid="documento-linha">
                    {[tipo.rotulo, diaCompleto(d.date), contagemDeAnexos(d.fotos)].filter(Boolean).join(" · ")}
                  </p>
                </button>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setAberto(estaAberto ? null : d.id)} aria-label={`Abrir ${d.titulo}`}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${estaAberto ? "rotate-180" : ""}`} />
                  </button>
                  <button onClick={() => comecarEdicao(d)} aria-label={`Editar ${d.titulo}`}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => onApagar(d.id, "Documento apagado")} aria-label={`Apagar ${d.titulo}`}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                  </button>
                </div>
              </div>
              {/* médico numa linha inteira: ao lado dos 3 botões, "Dra. Ana Lima ·
                  Cardiologia" só cabia cortado */}
              {temMedico && (
                <div className="px-3 pb-2 -mt-0.5">
                  <span className="inline-block max-w-full truncate px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" data-testid="documento-medico">
                    🩺 {rotuloMedico(d.medico ?? "", d.especialidade)}
                  </span>
                </div>
              )}
              {d.notes.trim() && (
                <div className="px-3 pb-2">
                  <ResumoExpansivel texto={d.notes.trim()} nome={d.titulo} testId="documento-resumo" />
                </div>
              )}
              {estaAberto && (
                <div className="px-3 pb-3">
                  <AnexosDeSaude caminhos={d.fotos} onChange={fotos => fotosDe(d.id, fotos)} rotulo={d.titulo} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
