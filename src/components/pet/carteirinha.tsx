/**
 * CARTEIRINHA (29/09) — a aba SAÚDE e o "próximos" da aba HOJE.
 *
 * Cada linha é um cuidado (vacina, vermífugo, antipulgas, remédio, consulta,
 * banho) com a última vez, a próxima e o carimbo. "Feito hoje" grava em
 * `pet-health` (a chave de sempre); intervalo e data marcada moram no plano
 * (`pet-cuidados`). Quem tinha vacina registrada antes vê tudo aqui sem
 * migração nenhuma.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dataSegura } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { especieDe, novoId, somarDias, type Pet } from "@/lib/pet";
import {
  GRUPOS, TIPOS, cuidadosDasSugestoes, familiaDe, linhasDaCarteirinha, proximosCuidados, rotuloIntervalo, sugerirCuidados,
  type Cuidado, type LinhaDaCarteirinha, type TipoCuidado,
} from "@/lib/pet-cuidados";
import { CampoData } from "@/components/ui/campo-data";
import { BotaoPet, CartaoPet, Carimbo, Chip, Etiqueta, FolhaPet, QuandoTexto, RotuloCampo, campoClasse } from "./kit";
import type { UsePet } from "./use-pet";

const ddmm = (dia?: string) => (dia ? dataSegura(dia, "dd/MM") : "—");
const ddmmaa = (dia?: string) => (dia ? dataSegura(dia, "dd/MM/yy") : "—");

/* ─────────────────────────────── HOJE › próximos ─────────────────────────────── */

export const ProximosCuidados = ({ pet, dados, onVerTudo }: { pet: Pet; dados: UsePet; onVerTudo: () => void }) => {
  const { cuidadosBrutos, registrosBrutos, hoje, aplicar, salvarCuidados } = dados;
  const linhas = useMemo(() => linhasDaCarteirinha(pet.id, cuidadosBrutos, registrosBrutos, hoje), [pet.id, cuidadosBrutos, registrosBrutos, hoje]);
  const proximos = proximosCuidados(linhas, 3);
  const semData = linhas.filter((l) => l.status === "sem-data").length;
  const [ficha, setFicha] = useState<string | null>(null);
  const linhaDaFicha = linhas.find((l) => l.chave === ficha);

  const feito = (l: LinhaDaCarteirinha) => {
    const { registro, desfazer } = aplicar(l, hoje);
    toast(`${l.nome}: feito hoje`, {
      description: registro.nextDate ? `Próxima: ${dataSegura(registro.nextDate, "dd/MM/yyyy")}` : undefined,
      action: { label: "Desfazer", onClick: desfazer },
      duration: 6000,
    });
  };

  return (
    <CartaoPet
      titulo="Carteirinha · próximos"
      direita={<button type="button" onClick={onVerTudo} className="inline-flex items-center gap-0.5 min-h-[40px] -my-1 px-1 hover:text-foreground">ver tudo <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" /></button>}
      dataCard="CARTEIRINHA PROXIMOS"
    >
      {linhas.length === 0 ? (
        <div className="px-3.5 py-3.5">
          <p className="text-[13.5px] leading-snug text-foreground">A carteirinha de {pet.name} está vazia.</p>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Com um toque ela ganha o básico pra espécie e a idade: vacinas, vermífugo, antipulgas e check-up.</p>
          <BotaoPet
            className="mt-3 w-full"
            onClick={() => { salvarCuidados(cuidadosDasSugestoes(pet.id, sugerirCuidados(pet, hoje))); onVerTudo(); }}
            data-testid="montar-carteirinha"
          >
            Montar a carteirinha
          </BotaoPet>
        </div>
      ) : (
        <ul>
          {proximos.map((l, idx) => (
            <li key={l.chave} className={`flex items-center gap-2.5 pl-3.5 pr-2 min-h-[56px] ${idx ? "border-t border-border" : ""}`}>
              <button type="button" onClick={() => setFicha(l.chave)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left min-h-[48px]">
                <Etiqueta tipo={l.tipo} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-tight truncate text-foreground">{l.nome}</span>
                  <QuandoTexto linha={l} className="block text-[12.5px] leading-tight mt-0.5" />
                </span>
              </button>
              {(l.status === "atrasado" || l.status === "hoje") ? (
                // só o que venceu (ou vence hoje) ganha o botão cheio: três magentas empilhados gritam igual e nenhum se destaca
                <BotaoPet onClick={() => feito(l)} className="shrink-0 px-3 min-h-[40px] text-[12.5px]" data-testid={`feito-${l.chave}`}>Feito hoje</BotaoPet>
              ) : l.status === "logo" ? (
                <BotaoPet variante="secundario" onClick={() => feito(l)} className="shrink-0 px-3 min-h-[40px] text-[12.5px]" data-testid={`feito-${l.chave}`}>Feito</BotaoPet>
              ) : (
                <span className="text-[12px] text-muted-foreground tabular-nums shrink-0 pr-1.5">{ddmmaa(l.proxima)}</span>
              )}
            </li>
          ))}
          {proximos.length === 0 && (
            <li className="px-3.5 py-3 text-[13px] text-muted-foreground">Nada com data por perto.</li>
          )}
          {semData > 0 && (
            <li className="border-t border-dashed border-border">
              <button type="button" onClick={onVerTudo} className="w-full text-left px-3.5 min-h-[44px] text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
                {semData === 1 ? "1 cuidado sem data" : `${semData} cuidados sem data`} — anote a última vez pra calcular a próxima
              </button>
            </li>
          )}
        </ul>
      )}
      {linhaDaFicha && <FichaDoCuidado linha={linhaDaFicha} pet={pet} dados={dados} onFechar={() => setFicha(null)} />}
    </CartaoPet>
  );
};

/* ─────────────────────────────── SAÚDE › carteirinha ─────────────────────────────── */

export const Carteirinha = ({ pet, dados }: { pet: Pet; dados: UsePet }) => {
  const { cuidadosBrutos, registrosBrutos, hoje, salvarCuidados } = dados;
  const linhas = useMemo(() => linhasDaCarteirinha(pet.id, cuidadosBrutos, registrosBrutos, hoje), [pet.id, cuidadosBrutos, registrosBrutos, hoje]);
  const [ficha, setFicha] = useState<string | null>(null);
  const [novo, setNovo] = useState<TipoCuidado | null>(null);
  const linhaDaFicha = linhas.find((l) => l.chave === ficha);

  // "completar": o que o básico da idade sugere e ainda não existe — pela FAMÍLIA (a V10 registrada
  // em 2025 já é a "V8 ou V10"; qualquer vermífugo já é o vermífugo)
  const faltando = useMemo(() => {
    const tem = new Set(linhas.map((l) => familiaDe(l.tipo, l.nome)));
    return sugerirCuidados(pet, hoje).filter((s) => !tem.has(familiaDe(s.tipo, s.nome)));
  }, [linhas, pet, hoje]);

  return (
    <div className="space-y-3">
      {GRUPOS.map((g) => {
        const doGrupo = linhas.filter((l) => TIPOS[l.tipo].grupo === g.id);
        if (!doGrupo.length && g.id !== "vacinas") return null;
        return (
          <CartaoPet key={g.id} titulo={g.titulo} direita={<span className="tabular-nums">{doGrupo.length || ""}</span>} dataCard={`CARTEIRINHA ${g.id.toUpperCase()}`}>
            {doGrupo.length === 0 ? (
              <p className="px-3.5 py-3 text-[13px] text-muted-foreground">Nenhuma vacina registrada ainda.</p>
            ) : (
              <ul>
                {doGrupo.map((l, idx) => <LinhaCarteirinha key={l.chave} linha={l} primeira={idx === 0} onAbrir={() => setFicha(l.chave)} />)}
              </ul>
            )}
          </CartaoPet>
        );
      })}

      {faltando.length > 0 && (
        <div className="rounded-xl border border-dashed border-border px-3.5 py-3">
          <p className="text-[12.5px] text-muted-foreground">Pra idade de {pet.name}, o básico também tem: <span className="font-semibold text-foreground">{faltando.map((f) => f.nome).join(", ")}</span>.</p>
          <BotaoPet variante="secundario" className="mt-2 w-full" onClick={() => salvarCuidados(cuidadosDasSugestoes(pet.id, faltando))} data-testid="completar-carteirinha">
            <Plus className="w-4 h-4" aria-hidden="true" /> Pôr na carteirinha
          </BotaoPet>
        </div>
      )}

      <BotaoPet variante="secundario" onClick={() => setNovo("vacina")} className="w-full border border-dashed border-border bg-card" data-testid="novo-cuidado-abrir">
        <Plus className="w-4 h-4" aria-hidden="true" /> Vacina, remédio, consulta, banho…
      </BotaoPet>
      <p className="text-[11.5px] text-muted-foreground leading-snug px-1">
        Orientação geral. O calendário certo é o do veterinário de {pet.name} — mude os intervalos quando ele indicar outro.
      </p>

      {linhaDaFicha && <FichaDoCuidado linha={linhaDaFicha} pet={pet} dados={dados} onFechar={() => setFicha(null)} />}
      <NovoCuidado tipoInicial={novo} pet={pet} dados={dados} onFechar={() => setNovo(null)} />
    </div>
  );
};

const LinhaCarteirinha = ({ linha: l, primeira, onAbrir }: { linha: LinhaDaCarteirinha; primeira: boolean; onAbrir: () => void }) => {
  const sub = l.tipo === "remedio" && l.cuidado?.horarios?.length
    ? [l.cuidado.dose, l.cuidado.horarios.join(" · "), l.cuidado.ate ? `até ${ddmm(l.cuidado.ate)}` : "uso contínuo"].filter(Boolean).join(" · ")
    : [
      l.doseDaSerie ? `dose ${l.doseDaSerie.atual} de ${l.doseDaSerie.total}` : rotuloIntervalo(l.intervaloDias),
      // em dia: o carimbo já mostra a última; a linha de baixo diz a PRÓXIMA
      l.status === "em-dia" ? `próxima ${ddmmaa(l.proxima)}` : l.ultima ? `última ${ddmmaa(l.ultima)}` : "sem data — toque pra anotar",
    ].filter(Boolean).join(" · ");
  return (
    <li className={primeira ? "" : "border-t border-border"}>
      <button type="button" onClick={onAbrir} className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[60px] text-left hover:bg-muted/40" data-testid={`linha-${l.chave}`}>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold leading-tight text-foreground">{l.nome}</span>
          <span className="block text-[12px] text-muted-foreground mt-0.5 leading-snug">{sub}</span>
        </span>
        <span className="text-right shrink-0">
          {l.status === "tratamento" ? <span className="text-[12px] font-bold text-[hsl(var(--pet-ok))]">em tratamento</span>
            : l.status === "encerrado" ? <span className="text-[12px] text-muted-foreground">encerrado</span>
            : l.status === "em-dia" && l.ultima ? <Carimbo data={ddmm(l.ultima)} ano={l.ultima.slice(0, 4)} className="scale-[0.86] -my-2" />
            : <span className="block text-[12.5px] leading-tight"><QuandoTexto linha={l} /></span>}
        </span>
      </button>
    </li>
  );
};

/* ─────────────────────────────── ficha do cuidado ─────────────────────────────── */

const INTERVALOS_DO_TIPO: Record<TipoCuidado, number[]> = {
  vacina: [365, 180, 0],
  vermifugo: [30, 60, 90, 120, 180],
  antipulgas: [30, 90, 120, 240],
  remedio: [7, 15, 30, 90, 0],
  consulta: [180, 365, 0],
  banho: [7, 15, 30],
  outro: [7, 15, 30, 90, 180, 365, 0],
};
const rotuloChip = (d: number) => (d === 0 ? "dose única" : rotuloIntervalo(d));

export const FichaDoCuidado = ({ linha, pet, dados, onFechar }: { linha: LinhaDaCarteirinha; pet: Pet; dados: UsePet; onFechar: () => void }) => {
  const { hoje, aplicar, apagarRegistro, salvarCuidado, apagarCuidado } = dados;
  const [outroDia, setOutroDia] = useState(false);
  const [dia, setDia] = useState(hoje);
  const [obs, setObs] = useState("");
  const [carimbado, setCarimbado] = useState<string | null>(null);
  const c = linha.cuidado;

  const registrar = (d: string) => {
    const { registro, desfazer } = aplicar(linha, d, obs);
    setCarimbado(registro.id);
    setObs(""); setOutroDia(false);
    toast(`${linha.nome}: registrado em ${dataSegura(d, "dd/MM")}`, {
      description: registro.nextDate ? `Próxima: ${dataSegura(registro.nextDate, "dd/MM/yyyy")}` : undefined,
      action: { label: "Desfazer", onClick: desfazer },
      duration: 6000,
    });
  };

  /** Mudar intervalo/data de uma linha que só existia no histórico cria o cuidado no plano (com o mesmo nome). */
  const comPlano = (mudanca: Partial<Cuidado>) => {
    const base: Cuidado = c ?? { id: novoId("c"), petId: pet.id, tipo: linha.tipo, nome: linha.nome, criadoEm: new Date().toISOString(), ...(linha.intervaloDias ? { intervaloDias: linha.intervaloDias } : {}) };
    salvarCuidado({ ...base, ...mudanca });
  };

  return (
    <FolhaPet aberta onFechar={onFechar} titulo={TIPOS[linha.tipo].rotulo} testId="ficha-cuidado">
      <div className="rounded-xl border border-border bg-card p-3.5 relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-extrabold leading-tight text-foreground">{linha.nome}</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              {linha.doseDaSerie ? `Filhote: dose ${linha.doseDaSerie.atual} de ${linha.doseDaSerie.total}, depois ${rotuloIntervalo(c?.intervaloDias)}` : rotuloIntervalo(linha.intervaloDias)} · {pet.name}
            </p>
          </div>
          {linha.ultima && <Carimbo data={ddmm(linha.ultima)} ano={linha.ultima.slice(0, 4)} novo={!!carimbado} />}
        </div>
        {linha.tipo !== "remedio" || !c?.horarios?.length ? (
          <div className="mt-3 pt-3 border-t border-dashed border-border flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Próxima</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground">{linha.proxima ? dataSegura(linha.proxima, "dd/MM/yyyy") : "sem data"}</span>
            {linha.proxima && (linha.diasAte ?? 99) <= 30 && <QuandoTexto linha={linha} className="text-[12.5px]" />}
          </div>
        ) : null}
      </div>

      {!(linha.tipo === "remedio" && c?.horarios?.length) && (
        <div className="mt-3 space-y-2">
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Lote, clínica ou produto (opcional)" className={campoClasse} aria-label="Observação" />
          {!outroDia ? (
            <div className="flex gap-2">
              <BotaoPet className="flex-1" onClick={() => registrar(hoje)} data-testid="ficha-feito-hoje">Feito hoje</BotaoPet>
              <BotaoPet variante="secundario" className="flex-1" onClick={() => { setDia(hoje); setOutroDia(true); }}>Foi em outro dia</BotaoPet>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <RotuloCampo htmlFor="dia-aplicacao">Quando foi</RotuloCampo>
                <CampoData id="dia-aplicacao" rotulo="Escolher a data" max={hoje} value={dia} onChange={(e) => setDia(e.target.value)} className={campoClasse} />
              </div>
              <BotaoPet onClick={() => dia && dia <= hoje && registrar(dia)} disabled={!dia || dia > hoje}>Registrar</BotaoPet>
            </div>
          )}
        </div>
      )}

      {c?.tipo === "remedio" && c.horarios?.length ? (
        <AjustesRemedio cuidado={c} onSalvar={(m) => salvarCuidado({ ...c, ...m })} />
      ) : (
        <div className="mt-4">
          <RotuloCampo>De quanto em quanto tempo</RotuloCampo>
          <div className="flex flex-wrap gap-1.5">
            {INTERVALOS_DO_TIPO[linha.tipo].map((d) => {
              const ativo = (linha.intervaloDias ?? 0) === d;
              return <Chip key={d} ativo={ativo} onClick={() => comPlano({ intervaloDias: d || undefined })} className="min-h-[40px] text-[12.5px]">{rotuloChip(d)}</Chip>;
            })}
          </div>
          <div className="mt-3">
            <RotuloCampo htmlFor="data-marcada">Data marcada (se o vet pediu outra)</RotuloCampo>
            <CampoData
              id="data-marcada"
              rotulo="Sem data marcada"
              value={c?.proxima ?? ""}
              min={hoje}
              onChange={(e) => comPlano({ proxima: e.target.value || undefined })}
              className={campoClasse}
            />
          </div>
        </div>
      )}

      <div className="mt-5">
        <RotuloCampo>Histórico</RotuloCampo>
        {linha.registros.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nada registrado ainda. Quando fizer, toque em “Feito hoje”.</p>
        ) : (
          <ul className="rounded-xl border border-border bg-card overflow-hidden">
            {linha.registros.map((r, idx) => (
              <li key={r.id} className={`flex items-center gap-3 pl-2 pr-1 py-1.5 ${idx ? "border-t border-border" : ""}`}>
                <Carimbo data={dataSegura(r.date, "dd/MM")} ano={r.date.slice(0, 4)} novo={carimbado === r.id} className="scale-[0.9] -my-1" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold truncate text-foreground">{r.name}</span>
                  <span className="block text-[12px] text-muted-foreground truncate">{[r.obs, r.nextDate ? `próxima ${dataSegura(r.nextDate, "dd/MM/yy")}` : ""].filter(Boolean).join(" · ") || " "}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Apagar o registro de ${dataSegura(r.date, "dd/MM/yyyy")}`}
                  onClick={() => { const volta = apagarRegistro(r.id); avisarApagado("Registro apagado", volta); }}
                  className="w-11 h-11 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {c && (
        <BotaoPet
          variante="perigo"
          className="mt-5 w-full"
          onClick={() => { apagarCuidado(c.id); onFechar(); avisarApagado(`${c.nome} saiu da carteirinha`, () => salvarCuidado(c)); }}
        >
          Parar de acompanhar {c.nome}
        </BotaoPet>
      )}
      {c && linha.registros.length > 0 && <p className="text-[11.5px] text-muted-foreground mt-1.5 text-center">O histórico continua guardado.</p>}
    </FolhaPet>
  );
};

/* ─────────────────────────────── remédio: horários ─────────────────────────────── */

const AjustesRemedio = ({ cuidado, onSalvar }: { cuidado: Cuidado; onSalvar: (m: Partial<Cuidado>) => void }) => {
  const [horarios, setHorarios] = useState<string[]>(cuidado.horarios ?? ["08:00"]);
  const [dose, setDose] = useState(cuidado.dose ?? "");
  const [ate, setAte] = useState(cuidado.ate ?? "");
  useEffect(() => { setHorarios(cuidado.horarios ?? ["08:00"]); setDose(cuidado.dose ?? ""); setAte(cuidado.ate ?? ""); }, [cuidado.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mt-4 space-y-3">
      <CamposRemedio horarios={horarios} setHorarios={setHorarios} dose={dose} setDose={setDose} ate={ate} setAte={setAte} />
      <BotaoPet
        variante="secundario"
        className="w-full"
        onClick={() => { onSalvar({ horarios: [...new Set(horarios.filter(Boolean))].sort(), dose: dose.trim() || undefined, ate: ate || undefined }); toast("Horários salvos"); }}
      >
        Salvar horários
      </BotaoPet>
    </div>
  );
};

const CamposRemedio = ({
  horarios, setHorarios, dose, setDose, ate, setAte,
}: { horarios: string[]; setHorarios: (h: string[]) => void; dose: string; setDose: (d: string) => void; ate: string; setAte: (d: string) => void }) => (
  <>
    <div>
      <RotuloCampo>Horários</RotuloCampo>
      <div className="flex flex-wrap gap-2">
        {horarios.map((h, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <input
              type="time"
              aria-label={`Horário ${i + 1}`}
              value={h}
              onChange={(e) => setHorarios(horarios.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${campoClasse} w-[108px] tabular-nums`}
            />
            {horarios.length > 1 && (
              <button type="button" aria-label={`Tirar o horário ${h}`} onClick={() => setHorarios(horarios.filter((_, j) => j !== i))} className="w-11 h-11 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {horarios.length < 4 && (
          <BotaoPet variante="secundario" onClick={() => setHorarios([...horarios, horarios.length === 1 ? "20:00" : "14:00"])} className="min-h-[44px]">
            <Plus className="w-4 h-4" aria-hidden="true" /> horário
          </BotaoPet>
        )}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <RotuloCampo htmlFor="rem-dose">Dose</RotuloCampo>
        <input id="rem-dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="1 comprimido" className={campoClasse} />
      </div>
      <div>
        <RotuloCampo htmlFor="rem-ate">Até (opcional)</RotuloCampo>
        <CampoData id="rem-ate" rotulo="Uso contínuo" value={ate} onChange={(e) => setAte(e.target.value)} className={campoClasse} />
      </div>
    </div>
  </>
);

/* ─────────────────────────────── novo cuidado ─────────────────────────────── */

const NOMES_SUGERIDOS: Record<TipoCuidado, { cao: string[]; gato: string[] }> = {
  vacina: { cao: ["V10", "V8", "Antirrábica", "Gripe canina", "Giárdia", "Leishmaniose"], gato: ["V4", "V5", "V3", "Antirrábica", "FeLV (leucemia)"] },
  vermifugo: { cao: ["Vermífugo"], gato: ["Vermífugo"] },
  antipulgas: { cao: ["Bravecto", "NexGard", "Simparic", "Credeli", "Seresto (coleira)", "Frontline"], gato: ["Bravecto Transdermal", "Revolution", "Frontline", "Seresto (coleira)"] },
  remedio: { cao: [], gato: [] },
  consulta: { cao: ["Check-up", "Retorno", "Limpeza de tártaro", "Exame de sangue"], gato: ["Check-up", "Retorno", "Limpeza de tártaro", "Exame de sangue"] },
  banho: { cao: ["Banho", "Banho e tosa", "Tosa higiênica"], gato: ["Banho", "Tosa"] },
  outro: { cao: [], gato: [] },
};
const INTERVALO_PADRAO: Record<TipoCuidado, number> = { vacina: 365, vermifugo: 90, antipulgas: 30, remedio: 0, consulta: 365, banho: 15, outro: 30 };

export const NovoCuidado = ({ tipoInicial, pet, dados, onFechar }: { tipoInicial: TipoCuidado | null; pet: Pet; dados: UsePet; onFechar: () => void }) => {
  const { hoje, salvarCuidado, aplicar } = dados;
  const [tipo, setTipo] = useState<TipoCuidado>("vacina");
  const [nome, setNome] = useState("");
  const [intervalo, setIntervalo] = useState(365);
  const [ultima, setUltima] = useState("");
  const [marcada, setMarcada] = useState("");
  const [diario, setDiario] = useState(true);
  const [horarios, setHorarios] = useState<string[]>(["08:00"]);
  const [dose, setDose] = useState("");
  const [ate, setAte] = useState("");
  useEffect(() => {
    if (!tipoInicial) return;
    setTipo(tipoInicial); setNome(tipoInicial === "vermifugo" ? "Vermífugo" : ""); setIntervalo(INTERVALO_PADRAO[tipoInicial]);
    setUltima(""); setMarcada(""); setDiario(true); setHorarios(["08:00"]); setDose(""); setAte("");
  }, [tipoInicial]);

  const esp = especieDe(pet.species) === "gato" ? "gato" : "cao";
  const ehRemedioDiario = tipo === "remedio" && diario;
  const podeSalvar = nome.trim().length > 0 && (!ehRemedioDiario || horarios.some(Boolean));

  const salvar = () => {
    if (!podeSalvar) return;
    const c: Cuidado = {
      id: novoId("c"),
      petId: pet.id,
      tipo,
      nome: nome.trim(),
      criadoEm: new Date().toISOString(),
      ...(ehRemedioDiario
        ? { horarios: [...new Set(horarios.filter(Boolean))].sort(), ...(dose.trim() ? { dose: dose.trim() } : {}), ...(ate ? { ate } : {}) }
        : { ...(intervalo ? { intervaloDias: intervalo } : {}), ...(marcada ? { proxima: marcada } : {}) }),
    };
    salvarCuidado(c);
    // "a última foi em…" vira o 1º registro, e a próxima já sai calculada
    if (!ehRemedioDiario && ultima && ultima <= hoje) {
      aplicar({ chave: c.id, petId: pet.id, tipo, nome: c.nome, cuidado: c, registros: [], status: "sem-data" }, ultima);
    }
    toast(`${c.nome} entrou na carteirinha de ${pet.name}`);
    onFechar();
  };

  return (
    <FolhaPet aberta={!!tipoInicial} onFechar={onFechar} titulo="Novo cuidado" sub={`Na carteirinha de ${pet.name}.`} testId="novo-cuidado">
      <RotuloCampo>O que é</RotuloCampo>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TIPOS) as TipoCuidado[]).map((t) => (
          <Chip key={t} ativo={tipo === t} onClick={() => { setTipo(t); setIntervalo(INTERVALO_PADRAO[t]); if (t === "vermifugo" && !nome) setNome("Vermífugo"); }} className="min-h-[40px] text-[12.5px]">
            <span aria-hidden="true">{TIPOS[t].emoji}</span> {TIPOS[t].rotulo.replace(" e carrapatos", "")}
          </Chip>
        ))}
      </div>

      <div className="mt-3">
        <RotuloCampo htmlFor="cuidado-nome">Nome</RotuloCampo>
        <input id="cuidado-nome" list="cuidado-nomes" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipo === "remedio" ? "Ex.: Apoquel" : "Ex.: V10"} className={campoClasse} />
        <datalist id="cuidado-nomes">{NOMES_SUGERIDOS[tipo][esp].map((n) => <option key={n} value={n} />)}</datalist>
        {NOMES_SUGERIDOS[tipo][esp].length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {NOMES_SUGERIDOS[tipo][esp].slice(0, 5).map((n) => (
              <button key={n} type="button" onClick={() => setNome(n)} className="rounded-full border border-border px-3 min-h-[36px] text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">{n}</button>
            ))}
          </div>
        )}
      </div>

      {tipo === "remedio" && (
        <div className="mt-3 flex gap-1.5">
          <Chip ativo={diario} onClick={() => setDiario(true)} className="flex-1 min-h-[40px] text-[12.5px]">Todo dia, com horário</Chip>
          <Chip ativo={!diario} onClick={() => { setDiario(false); setIntervalo(30); }} className="flex-1 min-h-[40px] text-[12.5px]">De tempos em tempos</Chip>
        </div>
      )}

      {ehRemedioDiario ? (
        <div className="mt-3 space-y-3">
          <CamposRemedio horarios={horarios} setHorarios={setHorarios} dose={dose} setDose={setDose} ate={ate} setAte={setAte} />
          <p className="text-[12px] text-muted-foreground">As doses aparecem no HOJE com o quadradinho. Com os avisos ligados, o celular lembra na hora.</p>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <RotuloCampo>De quanto em quanto tempo</RotuloCampo>
            <div className="flex flex-wrap gap-1.5">
              {INTERVALOS_DO_TIPO[tipo].map((d) => <Chip key={d} ativo={intervalo === d} onClick={() => setIntervalo(d)} className="min-h-[40px] text-[12.5px]">{rotuloChip(d)}</Chip>)}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <RotuloCampo htmlFor="cuidado-ultima">Última vez</RotuloCampo>
              <CampoData id="cuidado-ultima" rotulo="Não lembro" max={hoje} value={ultima} onChange={(e) => setUltima(e.target.value)} className={campoClasse} />
            </div>
            <div>
              <RotuloCampo htmlFor="cuidado-marcada">Ou data marcada</RotuloCampo>
              <CampoData id="cuidado-marcada" rotulo="Nenhuma" min={hoje} value={marcada} onChange={(e) => setMarcada(e.target.value)} className={campoClasse} />
            </div>
          </div>
          {ultima && intervalo > 0 && !marcada && (
            <p className="text-[12.5px] text-muted-foreground mt-2">Próxima: <span className="font-semibold text-foreground">{dataSegura(somarDias(ultima, intervalo), "dd/MM/yyyy")}</span></p>
          )}
        </>
      )}

      <BotaoPet className="mt-4 w-full" onClick={salvar} disabled={!podeSalvar} data-testid="salvar-cuidado">Pôr na carteirinha</BotaoPet>
    </FolhaPet>
  );
};
