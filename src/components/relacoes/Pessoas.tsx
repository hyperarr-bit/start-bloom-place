import { useMemo, useState } from "react";
import { Bell, ChevronRight, Gift, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { cn } from "@/lib/utils";
import {
  CIRCULOS, COMECO_PRONTO, META_DO_COMECO, circuloDe, ddmm, ehDaPessoa, haQuanto, presentesDe,
  proximasDatas, rotuloCadencia, sugestaoUsada, CHAVE_COMECO_VISTO, faltaCurta, type Circulo, type ItemDeData, type Pessoa, type SugestaoDeInicio,
} from "@/lib/relacoes";
import { useNavegacaoRelacoes } from "./contexto";
import { FormPessoa } from "./FormPessoa";
import { BotaoAcao, BotaoContorno, Lacre, Quadradinho, Secao, Selo } from "./kit";
import type { AvisosRelacoes } from "./use-avisos-relacoes";

export function AbaPessoas({ avisos }: { avisos: AvisosRelacoes }) {
  const { rel } = useNavegacaoRelacoes();
  const { get } = useUserData();
  const comecoVisto = get<boolean>(CHAVE_COMECO_VISTO, false) === true;
  // completou o começo agora: o cartão fica pra comemorar até a pessoa fechar
  const [acabouDeCompletar, setAcabouDeCompletar] = useState(false);
  const mostraComeco = (rel.pessoas.length < META_DO_COMECO && !comecoVisto) || acabouDeCompletar;

  return (
    <div className="space-y-4">
      {mostraComeco && (
        <ComecoPronto
          completo={acabouDeCompletar}
          onCompletar={() => setAcabouDeCompletar(true)}
          onFechar={() => setAcabouDeCompletar(false)}
          avisos={avisos}
        />
      )}
      {/* com o começo pronto na tela, o convite pros avisos mora nele (não em dois lugares) */}
      <ProximasDatas avisos={avisos} semConvite={mostraComeco} />
      <FazTempo />
      {(rel.pessoas.length > 0 || !mostraComeco) && <MinhasPessoas />}
    </div>
  );
}

/* ------------------------------------------------------------------ começo pronto */

function ComecoPronto({ completo, onCompletar, onFechar, avisos }: { completo: boolean; onCompletar: () => void; onFechar: () => void; avisos: AvisosRelacoes }) {
  const { rel, abrirNovaPessoa, abrirAvisos } = useNavegacaoRelacoes();
  const { set } = useUserData();
  const [escolhida, setEscolhida] = useState<SugestaoDeInicio | null>(null);
  const feitas = Math.min(rel.pessoas.length, META_DO_COMECO);

  const salvar = (s: SugestaoDeInicio, c: Parameters<typeof rel.adicionarPessoa>[0]) => {
    rel.adicionarPessoa(c, "comeco");
    setEscolhida(null);
    toast.success(c.birthday ? `${c.name} está na lista, com a data` : `${c.name} está na lista`, { duration: 2500 });
    if (rel.pessoas.length + 1 >= META_DO_COMECO) onCompletar();
  };

  return (
    <Secao titulo="Comece por aqui" direita={`${feitas} de ${META_DO_COMECO}`} card="COMECO PRONTO">
      <div className="px-3.5 pb-4" data-testid="comeco-pronto">
        {completo ? (
          <div className="pt-1 space-y-3">
            <p className="rl-serif text-[26px] leading-tight">Pronto, suas pessoas estão guardadas.</p>
            <p className="text-[13px] text-muted-foreground leading-snug">
              As datas aparecem nos selos aqui embaixo. Quer que o CORE avise antes de cada aniversário?
            </p>
            <div className="flex gap-2">
              {!avisos.algumLigado && (
                <BotaoAcao className="flex-[2]" onClick={abrirAvisos}><Bell className="w-4 h-4" /> Me avisa antes</BotaoAcao>
              )}
              <BotaoContorno className="flex-1" onClick={() => { onFechar(); set(CHAVE_COMECO_VISTO, true); }}>Fechar</BotaoContorno>
            </div>
          </div>
        ) : escolhida ? (
          <div className="pt-1">
            <p className="text-[13px] font-semibold mb-3">{escolhida.emoji} {escolhida.rotulo}</p>
            <FormPessoa
              key={escolhida.id}
              sugestao={escolhida}
              compacto
              rotuloSalvar="Guardar"
              onSalvar={(c) => salvar(escolhida, c)}
              onCancelar={() => setEscolhida(null)}
            />
          </div>
        ) : (
          <>
            <p className="rl-serif text-[26px] leading-tight pt-0.5">Quem você não pode esquecer?</p>
            <p className="mt-1 text-[13px] text-muted-foreground leading-snug">
              Escolha {META_DO_COMECO} pessoas e o dia do aniversário de cada uma. Leva um minuto — e fica salvo na sua conta, mesmo trocando de celular.
            </p>
            <div className="mt-3 flex items-center gap-2" aria-hidden="true">
              {Array.from({ length: META_DO_COMECO }, (_, i) => {
                const p = rel.pessoas[i];
                return p ? (
                  <Lacre key={i} nome={p.name} circulo={circuloDe(p)} tamanho={30} />
                ) : (
                  <span key={i} className="h-[30px] w-[30px] rounded-full border-[1.5px] border-dashed border-[hsl(var(--rl-tinta)/0.45)]" />
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {COMECO_PRONTO.map((s) => {
                const usada = sugestaoUsada(s, rel.pessoas);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={usada}
                    onClick={() => setEscolhida(s)}
                    className={cn("rl-chip border justify-start !rounded-[12px]", usada && "opacity-50")}
                    aria-label={usada ? `${s.rotulo}: já guardada` : s.rotulo}
                  >
                    <span aria-hidden="true">{usada ? "✓" : s.emoji}</span> {s.rotulo}
                  </button>
                );
              })}
              <button type="button" className="rl-chip border justify-start !rounded-[12px]" onClick={() => abrirNovaPessoa()}>
                <Plus className="w-4 h-4" /> Outra pessoa
              </button>
            </div>
            {rel.pessoas.length > 0 && (
              <button type="button" className="mt-2 min-h-[44px] w-full text-[12.5px] font-semibold text-muted-foreground" onClick={() => set(CHAVE_COMECO_VISTO, true)}>
                Agora não
              </button>
            )}
          </>
        )}
      </div>
    </Secao>
  );
}

/* ------------------------------------------------------------------ próximas datas (os selos) */

function ProximasDatas({ avisos, semConvite }: { avisos: AvisosRelacoes; semConvite?: boolean }) {
  const { rel, abrirFicha, abrirAvisos, abrirMensagem, irPraAba } = useNavegacaoRelacoes();
  const itens = useMemo(() => proximasDatas(rel.itensDoAno, 30, 3, 8), [rel.itensDoAno]);
  if (!itens.length) return null;
  const dentro = itens.filter((i) => i.dias <= 30).length;
  const hojeAniv = itens.filter((i) => i.dias === 0 && i.tipo === "aniversario" && i.pessoaId);
  const primeiroAniv = itens.find((i) => i.tipo === "aniversario" && i.pessoaId && i.dias > 0);
  const pessoaDo = (i?: ItemDeData) => (i?.pessoaId ? rel.pessoas.find((p) => p.id === i.pessoaId) : undefined);
  const pPresente = pessoaDo(hojeAniv[0] ?? primeiroAniv);

  const abrir = (i: ItemDeData) => (i.pessoaId && i.origem === "pessoa" ? abrirFicha(i.pessoaId) : irPraAba("agenda"));

  return (
    <Secao titulo="Próximas datas" direita={dentro ? `${dentro} em 30 dias` : "as próximas"} card="PROXIMAS DATAS">
      <div className="flex gap-3 overflow-x-auto rl-rolagem px-3.5 pt-1.5 pb-3.5" data-testid="selos">
        {itens.map((i) => <Selo key={i.id} item={i} onClick={() => abrir(i)} />)}
      </div>

      {hojeAniv.map((i) => {
        const p = pessoaDo(i)!;
        return (
          <div key={i.id} className="mx-3.5 mb-3 flex items-center gap-3 rounded-xl border border-[hsl(var(--rl-lacre)/0.35)] px-3 py-2.5">
            <span className="text-[20px]" aria-hidden="true">🎉</span>
            <p className="flex-1 text-[13px] font-semibold leading-snug">{p.name} faz aniversário hoje{i.faz ? ` — ${i.faz} anos` : ""}</p>
            <BotaoAcao className="!px-3 !text-[12.5px]" onClick={() => abrirMensagem(p.id, "parabens")}>
              Mandar parabéns
            </BotaoAcao>
          </div>
        );
      })}

      {pPresente && <RecadoDePresente pessoa={pPresente} />}

      {!semConvite && <div className="px-3.5 pb-3.5">
        {avisos.algumLigado ? (
          <button type="button" onClick={abrirAvisos} className="flex min-h-[44px] w-full items-center gap-2 text-left text-[12.5px] text-muted-foreground">
            <Bell className="w-4 h-4 text-[hsl(var(--rl-tinta))]" />
            <span className="flex-1">Avisos ligados{avisos.rel.semana.ligado ? " · 1 semana antes" : ""}{avisos.vespera.ligado ? " · na véspera" : ""}{avisos.rel.noDia.ligado ? " · no dia" : ""}</span>
            <span className="font-semibold text-[hsl(var(--rl-tinta))]">Ajustar</span>
          </button>
        ) : (
          <BotaoContorno className="w-full" onClick={abrirAvisos}><Bell className="w-4 h-4" /> Me avisa antes dos aniversários</BotaoContorno>
        )}
      </div>}
    </Secao>
  );
}

function RecadoDePresente({ pessoa }: { pessoa: Pessoa }) {
  const { rel, abrirFicha } = useNavegacaoRelacoes();
  const lista = presentesDe(pessoa, rel.presentes);
  const comprados = lista.filter((g) => g.status !== "idea").length;
  const texto = lista.length
    ? `${pessoa.name}: ${lista.length} ${lista.length === 1 ? "ideia de presente guardada" : "ideias de presente guardadas"} · ${comprados ? `${comprados} ${comprados === 1 ? "comprada" : "compradas"}` : "nenhuma comprada"}`
    : `Nenhuma ideia de presente pra ${pessoa.name} ainda — guardar uma`;
  return (
    <button type="button" onClick={() => abrirFicha(pessoa.id)} className="rl-recado mx-3.5 mb-3 flex w-[calc(100%-1.75rem)] items-center gap-2 px-3 py-2.5 text-left text-[12.5px] font-semibold min-h-[44px]">
      <Gift className="w-4 h-4 shrink-0" />
      <span className="flex-1 leading-snug">{texto}</span>
      <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
    </button>
  );
}

/* ------------------------------------------------------------------ pra mandar um oi (manter contato) */

/*
 * "PRA MANDAR UM OI", não "faz tempo que…" (29/09): na pesquisa do Reddit, quem
 * esquece de responder vive culpa e vergonha — lista vermelha de atrasados
 * afasta. O tom é convite ("que tal mandar um oi?"), sem placar nem sequência.
 */
function FazTempo() {
  const { rel, abrirFicha, abrirMensagem } = useNavegacaoRelacoes();
  if (!rel.praFalar.length) return null;
  const lista = rel.praFalar.slice(0, 3);
  const n = rel.praFalar.length;
  return (
    <Secao titulo="Pra mandar um oi" direita={`${n} ${n === 1 ? "pessoa" : "pessoas"}`} card="PRA MANDAR UM OI">
      <ul className="divide-y divide-border">
        {lista.map(({ pessoa: p, situacao: s }) => {
          const ultimo = rel.momentos
            .filter((m) => m.date === s.ultimo && ehDaPessoa(p, m))
            .find((m) => m.description && m.description !== "Conversamos");
          return (
            <li key={p.id} className="px-3.5 py-3" data-testid="faz-tempo">
              <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => abrirFicha(p.id)}>
                <Lacre nome={p.name} circulo={circuloDe(p)} tamanho={36} />
                <span className="min-w-0 flex-1">
                  <span className="rl-serif block text-[22px] leading-tight text-[hsl(var(--rl-tinta))]">{p.name},</span>
                  <span className="block text-[13px] leading-snug">
                    {s.desde == null
                      ? <>você quis lembrar de falar {rotuloCadencia(s.cadencia).toLowerCase()}.</>
                      : <>a última conversa foi <b>{haQuanto(s.desde)}</b>.</>}
                  </span>
                  {ultimo && <span className="mt-0.5 block text-[12px] text-muted-foreground truncate">Da última vez: “{ultimo.description}”</span>}
                </span>
              </button>
              <div className="mt-2.5 flex gap-2">
                <BotaoContorno className="flex-1" onClick={() => {
                  const id = rel.alternarConversaDeHoje(p);
                  if (id) toast(`Anotado: você falou com ${p.name} hoje`, { action: { label: "Desfazer", onClick: () => rel.removerMomento(id) }, duration: 5000 });
                }}>
                  <Quadradinho marcado={false} /> Falei hoje
                </BotaoContorno>
                <BotaoContorno className="flex-1" onClick={() => abrirMensagem(p.id, "oi")}>
                  <MessageCircle className="w-4 h-4" /> Mandar um oi
                </BotaoContorno>
              </div>
            </li>
          );
        })}
      </ul>
      {n > lista.length && (
        <p className="px-3.5 pb-3 text-[12px] text-muted-foreground">e mais {n - lista.length} na lista de pessoas</p>
      )}
    </Secao>
  );
}

/* ------------------------------------------------------------------ minhas pessoas (a tabela) */

function MinhasPessoas() {
  const { rel, abrirFicha, abrirNovaPessoa } = useNavegacaoRelacoes();
  const [filtro, setFiltro] = useState<Circulo | "todos">("todos");
  const porId = useMemo(() => new Map(rel.itensDoAno.filter((i) => i.origem === "pessoa").map((i) => [i.pessoaId, i])), [rel.itensDoAno]);
  const circulosPresentes = useMemo(() => CIRCULOS.filter((c) => rel.pessoas.some((p) => circuloDe(p) === c.id)), [rel.pessoas]);
  const ordenadas = useMemo(() => {
    const lista = rel.pessoas.filter((p) => filtro === "todos" || circuloDe(p) === filtro);
    return lista.sort((a, b) => {
      const da = porId.get(a.id)?.dias;
      const db = porId.get(b.id)?.dias;
      if (da == null && db == null) return a.name.localeCompare(b.name, "pt-BR");
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [rel.pessoas, filtro, porId]);
  const ninguemComFrequencia = !rel.pessoas.some((p) => (p.cadencia ?? 0) > 0);

  return (
    <Secao titulo="Minhas pessoas" direita={String(rel.pessoas.length)} card="MINHAS PESSOAS">
      {rel.pessoas.length >= 6 && circulosPresentes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto rl-rolagem px-3.5 pb-2" role="group" aria-label="Filtrar por círculo">
          <button type="button" className="rl-chip border !min-h-[36px] !px-3 !text-[12px]" aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>Todas</button>
          {circulosPresentes.map((c) => (
            <button key={c.id} type="button" className="rl-chip border !min-h-[36px] !px-3 !text-[12px]" aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}>
              <Lacre nome={c.rotulo} circulo={c.id} tamanho={14} /> {c.rotulo}
            </button>
          ))}
        </div>
      )}
      <div className="px-3.5">
        {ordenadas.length > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_52px_64px] gap-2 border-b border-border pb-1.5 rl-mini text-muted-foreground" aria-hidden="true">
            <span>Quem</span><span>Aniv.</span><span className="text-right">Falta</span>
          </div>
        )}
        <ul data-testid="lista-pessoas">
          {ordenadas.map((p) => {
            const item = porId.get(p.id);
            const perto = item != null && item.dias <= 30;
            return (
              <li key={p.id} className="border-b border-border last:border-b-0">
                <button type="button" onClick={() => abrirFicha(p.id)} className="grid w-full grid-cols-[minmax(0,1fr)_52px_64px] items-center gap-2 py-2 min-h-[58px] text-left" aria-label={`Abrir ${p.name}`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Lacre nome={p.name} circulo={circuloDe(p)} />
                    <span className="min-w-0">
                      <span className="rl-serif block truncate text-[21px] leading-[1.1]">{p.name}</span>
                      <span className="rl-mini block truncate text-muted-foreground">{p.relation || CIRCULOS.find((c) => c.id === circuloDe(p))?.rotulo}</span>
                    </span>
                  </span>
                  <span className="text-[12.5px] font-semibold tabular-nums text-[hsl(var(--rl-tinta))]">{item ? ddmm(item.mes, item.dia) : "—"}</span>
                  <span className={cn("text-right text-[11.5px] font-bold", perto ? "text-[hsl(var(--rl-lacre))]" : "text-muted-foreground")}>
                    {item ? faltaCurta(item.dias) : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {rel.pessoas.length === 0 && <p className="py-4 text-center text-[13px] text-muted-foreground">Ninguém por aqui ainda.</p>}
      </div>
      <div className="px-3.5 pt-3 pb-3.5 space-y-2">
        <BotaoAcao className="w-full" onClick={() => abrirNovaPessoa()}><Plus className="w-4 h-4" /> Adicionar pessoa</BotaoAcao>
        {ninguemComFrequencia && rel.pessoas.length >= 3 && (
          <p className="text-[12px] text-muted-foreground leading-snug text-center">
            💌 Na ficha de cada pessoa dá pra pedir: “me lembra de falar com ela de tempos em tempos”.
          </p>
        )}
      </div>
    </Secao>
  );
}
