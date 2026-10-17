/**
 * PASTAS (16/10, chamado de cliente: "tem que ser didático sempre que eu abrir
 * qualquer pasta"). Uma estante com uma pasta por médico, por especialidade
 * (quando junta mais de um médico) e "Sem médico". Abrir uma pasta mostra TUDO
 * dela, separado por tipo — Consultas, Exames, Documentos — e cada item com
 * tipo, título, médico · especialidade, data dd/mm/aaaa, resumo (3 linhas,
 * toque abre) e o clipe dos anexos. Seção vazia diz o que vai ali e como pôr.
 *
 * É só uma VISTA: o dado continua nas três listas de sempre
 * (lib/saude-medicos: pastasDeSaude, conteudoDaPasta).
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { AnexosDeSaude } from "./AnexosDeSaude";
import { ResumoExpansivel, diaCompleto } from "./campos-saude";
import { conteudoDaPasta, pastasDeSaude, rotuloMedico, type PastaDeMedico } from "@/lib/saude-medicos";
import { tipoDoDocumento, type Documento } from "@/lib/saude-documentos";

export interface ConsultaDaPasta { id: string; doctor: string; specialty: string; date: string; time?: string; questions?: string; quem?: string }
export interface ExameDaPasta {
  id: string; name: string; date: string; time?: string; done?: boolean;
  medico?: string; especialidade?: string; resumo?: string; fotos?: string[];
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const resumoDaContagem = (c: { consultas: unknown[]; exames: unknown[]; documentos: unknown[] }) =>
  [
    c.consultas.length ? plural(c.consultas.length, "consulta", "consultas") : "",
    c.exames.length ? plural(c.exames.length, "exame", "exames") : "",
    c.documentos.length ? plural(c.documentos.length, "documento", "documentos") : "",
  ].filter(Boolean).join(" · ");

const iconeDaPasta = (p: PastaDeMedico) => (p.tipo === "especialidade" ? "🏷️" : p.tipo === "sem" ? "📂" : "🩺");

/** Um item dentro da pasta, do mesmo jeito pra consulta, exame e documento. */
const ItemDaPasta = ({ emoji, tipo, titulo, medico, data, hora, estado, resumo, fotos, onFotos }: {
  emoji: string; tipo: string; titulo: string; medico: string; data: string; hora?: string; estado?: string;
  resumo?: string; fotos?: string[]; onFotos?: (f: string[]) => void;
}) => {
  const [anexos, setAnexos] = useState(false);
  const n = fotos?.length ?? 0;
  return (
    <div className="rounded-xl border border-border bg-card p-2.5" data-testid="item-pasta">
      <div className="flex items-start gap-2">
        <span className="text-base leading-6">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold uppercase tracking-wide text-muted-foreground" data-testid="item-pasta-tipo">{tipo}</span>
            {estado && <span className="text-[9px] font-semibold text-muted-foreground">{estado}</span>}
            <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap" data-testid="item-pasta-data">
              {data || "sem data"}{hora ? ` · ${hora}` : ""}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-foreground line-clamp-2">{titulo}</p>
          {medico && <p className="mt-0.5 text-[10px] text-muted-foreground truncate" data-testid="item-pasta-medico">🩺 {medico}</p>}
        </div>
        {n > 0 && onFotos && (
          <button type="button" onClick={() => setAnexos(!anexos)} aria-expanded={anexos} aria-label={`Anexos de ${titulo}`}
            className="h-9 min-w-9 px-1.5 rounded-lg bg-muted flex items-center justify-center gap-0.5 shrink-0" data-testid="item-pasta-anexos">
            <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground">{n}</span>
          </button>
        )}
      </div>
      {resumo?.trim() && <div className="mt-2"><ResumoExpansivel texto={resumo.trim()} nome={titulo} testId="item-pasta-resumo" /></div>}
      {anexos && onFotos && <div className="mt-2"><AnexosDeSaude caminhos={fotos ?? []} onChange={onFotos} rotulo={titulo} /></div>}
    </div>
  );
};

const Secao = ({ emoji, titulo, total, vazio, children }: { emoji: string; titulo: string; total: number; vazio: string; children: React.ReactNode }) => (
  <section className="space-y-1.5" data-testid={`secao-${titulo.toLowerCase()}`}>
    <h5 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-foreground">
      <span>{emoji}</span> {titulo} <span className="font-semibold text-muted-foreground">{total}</span>
    </h5>
    {total ? children : (
      <p className="rounded-xl border border-dashed border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground" data-testid="secao-vazia">{vazio}</p>
    )}
  </section>
);

/** O que dizer numa seção vazia — ensina como o item chega na pasta. */
const textosVazios = (p: PastaDeMedico) => {
  if (p.tipo === "sem") return {
    consultas: "Nenhuma consulta sem médico.",
    exames: "Nenhum exame sem médico.",
    documentos: "Nenhum documento sem médico.",
  };
  if (p.tipo === "especialidade") return {
    consultas: `Nenhuma consulta de ${p.rotulo} ainda.`,
    exames: `Nenhum exame de ${p.rotulo}. No exame, preencha a especialidade em “Pedido por”.`,
    documentos: `Nenhum documento de ${p.rotulo}. Ao guardar, preencha a especialidade do médico.`,
  };
  const nome = p.rotulo.split(" · ")[0];
  return {
    consultas: `Nenhuma consulta com ${nome}. Ao marcar, escreva o nome do médico igual.`,
    exames: `Nenhum exame pedido por ${nome}. No exame, preencha “Pedido por”.`,
    documentos: `Nenhum documento de ${nome}. Em Documentos, escolha o médico ao guardar.`,
  };
};

export const PastasDeSaude = ({ consultas, exames, documentos, onFotosExame, onFotosDocumento }: {
  consultas: ConsultaDaPasta[];
  exames: ExameDaPasta[];
  documentos: Documento[];
  onFotosExame: (id: string, fotos: string[]) => void;
  onFotosDocumento: (id: string, fotos: string[]) => void;
}) => {
  const dados = useMemo(() => ({ consultas, exames, documentos }), [consultas, exames, documentos]);
  const pastas = useMemo(() => pastasDeSaude(dados), [dados]);
  const [aberta, setAberta] = useState<string | null>(null);
  const pasta = pastas.find(p => p.chave === aberta) ?? null;
  const totalDeItens = consultas.length + exames.length + documentos.length;
  const medicos = pastas.filter(p => p.tipo === "medico");
  const especialidades = pastas.filter(p => p.tipo === "especialidade");
  const sem = pastas.find(p => p.tipo === "sem");

  // função (não componente): componente declarado dentro do render remontaria a cada tecla
  const linhaDaPasta = (p: PastaDeMedico) => (
    <button key={p.chave} type="button" onClick={() => setAberta(p.chave)} aria-label={`Abrir pasta ${p.rotulo}`}
      className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-muted/40 transition-colors" data-testid="pasta">
      <span className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-base shrink-0">{iconeDaPasta(p)}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-foreground truncate">{p.rotulo}</span>
        <span className="block text-[10px] text-muted-foreground">{resumoDaContagem(conteudoDaPasta(p.chave, dados))}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card" data-testid="estante">
      <div className="bg-sky-200 dark:bg-sky-900/40 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-wide text-foreground">Pastas</h3>
        <span className="text-3xl">📁</span>
      </div>
      <div className="p-4 space-y-3">
        {pasta ? (() => {
          const c = conteudoDaPasta(pasta.chave, dados);
          const vazio = textosVazios(pasta);
          return (
            <div className="space-y-3" data-testid="pasta-aberta">
              <button type="button" onClick={() => setAberta(null)}
                className="h-8 -ml-1 px-1 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <ChevronLeft className="w-3.5 h-3.5" /> Todas as pastas
              </button>
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-lg shrink-0">{iconeDaPasta(pasta)}</span>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-foreground leading-tight">{pasta.rotulo}</h4>
                  <p className="text-[10px] text-muted-foreground">{resumoDaContagem(c) || "Pasta vazia"}</p>
                </div>
              </div>
              {pasta.tipo === "sem" && (
                <p className="text-[11px] leading-snug text-muted-foreground rounded-xl bg-muted/60 px-3 py-2">
                  Aqui fica o que foi guardado sem médico. Toque no lápis do item (em Exames ou Documentos) e escolha o médico: ele vai pra pasta certa.
                </p>
              )}
              <Secao emoji="👩‍⚕️" titulo="Consultas" total={c.consultas.length} vazio={vazio.consultas}>
                {c.consultas.map(a => (
                  <ItemDaPasta key={a.id} emoji="👩‍⚕️" tipo="Consulta"
                    titulo={a.specialty?.trim() ? `Consulta · ${a.specialty.trim()}` : "Consulta"}
                    medico={rotuloMedico(a.doctor ?? "", a.specialty)} data={diaCompleto(a.date)} hora={a.time}
                    estado={a.quem?.trim() ? `👤 ${a.quem.trim()}` : undefined}
                    resumo={a.questions?.trim() ? `Perguntar: ${a.questions.trim()}` : undefined} />
                ))}
              </Secao>
              <Secao emoji="💉" titulo="Exames" total={c.exames.length} vazio={vazio.exames}>
                {c.exames.map(e => (
                  <ItemDaPasta key={e.id} emoji="🔬" tipo="Exame" titulo={e.name}
                    medico={rotuloMedico(e.medico ?? "", e.especialidade)} data={diaCompleto(e.date)} hora={e.time}
                    estado={e.done ? "✓ feito" : undefined}
                    resumo={e.resumo} fotos={e.fotos} onFotos={f => onFotosExame(e.id, f)} />
                ))}
              </Secao>
              <Secao emoji="🗂️" titulo="Documentos" total={c.documentos.length} vazio={vazio.documentos}>
                {c.documentos.map(d => {
                  const t = tipoDoDocumento(d.tipo);
                  return (
                    <ItemDaPasta key={d.id} emoji={t.emoji} tipo={t.rotulo} titulo={d.titulo}
                      medico={rotuloMedico(d.medico ?? "", d.especialidade)} data={diaCompleto(d.date)}
                      resumo={d.notes} fotos={d.fotos} onFotos={f => onFotosDocumento(d.id, f)} />
                  );
                })}
              </Secao>
            </div>
          );
        })() : pastas.length ? (
          <>
            <p className="text-xs leading-snug text-muted-foreground">
              Cada médico tem uma pasta com tudo junto: <b className="text-foreground">consultas, exames e documentos</b>. Toque pra abrir.
            </p>
            {medicos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Por médico</p>
                {medicos.map(linhaDaPasta)}
              </div>
            )}
            {especialidades.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Por especialidade</p>
                {especialidades.map(linhaDaPasta)}
              </div>
            )}
            {sem && linhaDaPasta(sem)}
          </>
        ) : (
          <div className="text-center py-2 space-y-1.5" data-testid="estante-vazia">
            <p className="text-sm font-semibold text-foreground">Suas pastas aparecem aqui</p>
            <p className="text-xs leading-snug text-muted-foreground">
              {totalDeItens
                ? "O que você guardou ainda está sem médico. Edite um exame ou documento e preencha o médico pra criar a primeira pasta."
                : "Quando você põe o médico numa consulta, num exame ou num documento, a pasta dele aparece aqui — com tudo junto."}
            </p>
            <p className="text-[10px] text-muted-foreground/80">Ex.: 🩺 Dra. Ana · Cardiologia → 1 consulta · 2 exames · 1 documento</p>
          </div>
        )}
      </div>
    </div>
  );
};
