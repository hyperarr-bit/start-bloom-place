import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  ANO_SEM_ANO, CIRCULOS, circuloDaRelacao, ehDiaValido, mesLongo, montarAniversario, type Circulo, type Pessoa, type SugestaoDeInicio,
} from "@/lib/relacoes";
import type { CamposPessoa } from "./use-relacoes";
import { BotaoAcao, FaixaDaFolha, Lacre, Rotulo } from "./kit";
import { CAMPO, focarNaFolha, FOLHA } from "./kit-estilos";

/**
 * Adicionar / editar pessoa (29/09). O aniversário vira DIA + MÊS em rodas do
 * celular, com o ANO opcional — a avaliação da Play de 07/09 dizia que "a data
 * de nascimento é difícil de colocar", e muita gente não sabe o ano da amiga.
 * Sem ano, a data é gravada com 2000 (bissexto) e `semAno`: o app antigo
 * continua lendo um "YYYY-MM-DD" normal.
 */

const RELACOES_RAPIDAS = ["Mãe", "Pai", "Meu amor", "Melhor amiga", "Amiga", "Amigo", "Irmã", "Irmão", "Avó", "Colega"];

type Estado = { name: string; relation: string; dia: string; mes: string; ano: string; notes: string; circulo: Circulo | null };

const vazio: Estado = { name: "", relation: "", dia: "", mes: "", ano: "", notes: "", circulo: null };

const doAniversario = (p: Pessoa): Pick<Estado, "dia" | "mes" | "ano"> => {
  if (!ehDiaValido(p.birthday)) return { dia: "", mes: "", ano: "" };
  const [a, m, d] = p.birthday.split("-").map(Number);
  return { dia: String(d), mes: String(m), ano: p.semAno ? "" : String(a) };
};

/** O formulário em si (fora da folha pra caber no começo pronto também). */
export function FormPessoa({
  inicial, sugestao, compacto, rotuloSalvar = "Salvar pessoa", onSalvar, onCancelar,
}: {
  inicial?: Pessoa;
  sugestao?: SugestaoDeInicio;
  compacto?: boolean;
  rotuloSalvar?: string;
  onSalvar: (c: CamposPessoa) => void;
  onCancelar?: () => void;
}) {
  const [e, setE] = useState<Estado>(() =>
    inicial
      ? { name: inicial.name, relation: inicial.relation, notes: inicial.notes ?? "", circulo: inicial.circulo ?? null, ...doAniversario(inicial) }
      : sugestao
        ? { ...vazio, name: sugestao.nome, relation: sugestao.relation, circulo: sugestao.circulo }
        : vazio,
  );
  const circulo: Circulo = e.circulo ?? circuloDaRelacao(e.relation);
  const anoAtual = new Date().getFullYear();

  const salvar = () => {
    const nome = e.name.trim();
    if (!nome) { toast.error("Escreve o nome"); return; }
    let birthday = "";
    let semAno = false;
    if (e.dia || e.mes) {
      if (!e.dia || !e.mes) { toast.error("Escolhe o dia e o mês do aniversário"); return; }
      const ano = e.ano ? Number(e.ano) : null;
      if (ano != null && (!Number.isInteger(ano) || ano < 1900 || ano > anoAtual)) { toast.error(`O ano vai de 1900 a ${anoAtual}`); return; }
      birthday = montarAniversario(Number(e.dia), Number(e.mes), ano);
      if (!birthday) { toast.error(`${e.dia} de ${mesLongo(Number(e.mes))} não existe${ano ? ` em ${ano}` : ""}`); return; }
      semAno = ano == null;
    }
    onSalvar({ name: nome, relation: e.relation, birthday, semAno, notes: e.notes, circulo });
  };

  const diasDoMes = e.mes ? new Date(ANO_SEM_ANO, Number(e.mes), 0).getDate() : 31;

  return (
    <div className="space-y-3.5" data-testid="form-pessoa">
      <div className="flex items-center gap-3">
        <Lacre nome={e.name || "?"} circulo={circulo} tamanho={44} />
        <div className="flex-1">
          <Rotulo htmlFor="rl-nome">Nome</Rotulo>
          <input
            id="rl-nome"
            className={CAMPO}
            value={e.name}
            placeholder={sugestao && !sugestao.nome ? `${sugestao.rotulo}: o nome` : "Como você chama essa pessoa"}
            onChange={(ev) => setE({ ...e, name: ev.target.value })}
            autoComplete="off"
            aria-label="Nome"
          />
        </div>
      </div>

      <div>
        <Rotulo>Aniversário</Rotulo>
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
          <select className="rl-select" aria-label="Dia do aniversário" value={e.dia} onChange={(ev) => setE({ ...e, dia: ev.target.value })}>
            <option value="">Dia</option>
            {Array.from({ length: diasDoMes }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="rl-select" aria-label="Mês do aniversário" value={e.mes} onChange={(ev) => {
            const mes = ev.target.value;
            const max = mes ? new Date(ANO_SEM_ANO, Number(mes), 0).getDate() : 31;
            setE({ ...e, mes, dia: e.dia && Number(e.dia) > max ? String(max) : e.dia });
          }}>
            <option value="">Mês</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{mesLongo(m)}</option>)}
          </select>
          <input
            className={CAMPO}
            inputMode="numeric"
            aria-label="Ano do aniversário (opcional)"
            placeholder="Ano"
            maxLength={4}
            value={e.ano}
            onChange={(ev) => setE({ ...e, ano: ev.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">O ano é opcional — sem ele, a gente só não mostra a idade.</p>
      </div>

      {!compacto && (
        <>
          <div>
            <Rotulo htmlFor="rl-relacao">Quem é pra você</Rotulo>
            <input
              id="rl-relacao"
              className={CAMPO}
              value={e.relation}
              placeholder="Mãe, amiga da faculdade, chefe…"
              onChange={(ev) => setE({ ...e, relation: ev.target.value })}
              autoComplete="off"
              aria-label="Relação"
            />
            <div className="mt-2 flex gap-1.5 overflow-x-auto rl-rolagem -mx-1 px-1 pb-0.5">
              {RELACOES_RAPIDAS.map((r) => (
                <button key={r} type="button" className="rl-chip border !min-h-[36px] !px-3 !text-[12.5px]" aria-pressed={e.relation === r}
                  onClick={() => setE({ ...e, relation: r, circulo: null })}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <Rotulo>Círculo</Rotulo>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Círculo">
              {CIRCULOS.map((c) => (
                <button key={c.id} type="button" className="rl-chip border !min-h-[40px] !px-3" aria-pressed={circulo === c.id} onClick={() => setE({ ...e, circulo: c.id })}>
                  <Lacre nome={c.rotulo} circulo={c.id} tamanho={18} />
                  {c.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Rotulo htmlFor="rl-notas">O que lembrar</Rotulo>
            <textarea
              id="rl-notas"
              rows={3}
              className="w-full rounded-[10px] border border-input bg-background px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring rl-pautado"
              value={e.notes}
              placeholder="Gostos, tamanho, alergias, o nome dos filhos…"
              onChange={(ev) => setE({ ...e, notes: ev.target.value })}
              aria-label="Notas"
            />
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        {onCancelar && <button type="button" onClick={onCancelar} className="rl-contorno border flex-1">Cancelar</button>}
        <BotaoAcao className="flex-[2]" onClick={salvar}>{rotuloSalvar}</BotaoAcao>
      </div>
    </div>
  );
}

/** A folha de adicionar/editar. */
export function FolhaPessoa({
  aberta, pessoa, sugestao, onFechar, onSalvar, onApagar,
}: {
  aberta: boolean;
  pessoa?: Pessoa;
  sugestao?: SugestaoDeInicio;
  onFechar: () => void;
  onSalvar: (c: CamposPessoa) => void;
  onApagar?: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => { if (!aberta) setConfirmando(false); }, [aberta]);
  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} onOpenAutoFocus={focarNaFolha} data-testid="folha-pessoa">
        <SheetTitle className="sr-only">{pessoa ? `Editar ${pessoa.name}` : "Nova pessoa"}</SheetTitle>
        <SheetDescription className="sr-only">Nome, aniversário, relação e o que lembrar.</SheetDescription>
        <FaixaDaFolha titulo={pessoa ? "✏️ Editar pessoa" : "💌 Nova pessoa"} sub={pessoa ? pessoa.name : "Só o nome é obrigatório."} onFechar={onFechar} />
        <div className="overflow-y-auto px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {aberta && (
            <FormPessoa
              key={pessoa?.id ?? sugestao?.id ?? "nova"}
              inicial={pessoa}
              sugestao={sugestao}
              rotuloSalvar={pessoa ? "Salvar alterações" : "Adicionar pessoa"}
              onSalvar={(c) => { onSalvar(c); onFechar(); }}
            />
          )}
          {pessoa && onApagar && (
            <div className="mt-5 border-t border-border pt-4">
              {confirmando ? (
                <div className="flex gap-2">
                  <button type="button" className="rl-contorno border flex-1" onClick={() => setConfirmando(false)}>Não apagar</button>
                  <button type="button" className="rl-contorno border flex-1 !text-destructive !border-destructive/40" onClick={() => { onApagar(); onFechar(); }}>
                    Apagar {pessoa.name}
                  </button>
                </div>
              ) : (
                <button type="button" className="w-full min-h-[44px] text-[13px] font-semibold text-destructive" onClick={() => setConfirmando(true)}>
                  Apagar pessoa
                </button>
              )}
              <p className="mt-2 text-[11.5px] text-muted-foreground text-center">Os presentes e momentos com ela continuam guardados.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
