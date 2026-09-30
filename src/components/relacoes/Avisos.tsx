import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { estadoPermissao, planejarAniversarios, type EstadoPermissao } from "@/lib/notificacoes";
import { lerDadosDasRelacoes, planejarRelacoes } from "@/lib/relacoes-lembrete";
import type { AvisosRelacoes } from "./use-avisos-relacoes";
import { diasEntre } from "@/lib/relacoes";
import { FaixaDaFolha } from "./kit";
import { focarNaFolha, FOLHA } from "./kit-estilos";

/**
 * Os avisos de Relações, ligados DE DENTRO do módulo (29/09). Até aqui o
 * "Aniversário chegando" só existia escondido na central de notificações — e
 * mesmo assim 21 pessoas foram lá ligar em 30 dias. Aqui ficam os três:
 *  - UMA SEMANA ANTES: com as ideias de presente (novo, `rel-lembrete-prefs.semana`);
 *  - NA VÉSPERA: o de sempre (mesmo interruptor da central, `notif-prefs.aniversario`);
 *  - NO DIA: pra mandar os parabéns (novo, `rel-lembrete-prefs.noDia`);
 *  - MANTER CONTATO: "faz tempo que não fala com…" (novo, `rel-lembrete-prefs.contato`).
 * Todos nascem desligados. No site só guarda a escolha (o aviso toca no app).
 */

const HORAS_VESPERA = [8, 10, 12, 18, 20];
const HORAS_NO_DIA = ["08:00", "09:00", "12:00", "18:00"];
const HORAS_SEMANA = ["09:00", "12:00", "18:00", "20:00"];
const HORAS_CONTATO = ["12:00", "18:30", "19:30", "21:00"];

const rotuloHora = (h: number | string) => (typeof h === "number" ? `${String(h).padStart(2, "0")}:00` : h);

function Horas<T extends number | string>({ opcoes, valor, onEscolher, rotulo }: { opcoes: T[]; valor: T; onEscolher: (h: T) => void; rotulo: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={rotulo}>
      {opcoes.map((h) => (
        <button
          key={String(h)}
          type="button"
          onClick={() => onEscolher(h)}
          aria-pressed={valor === h}
          className="rl-chip border !min-h-[40px] !px-3 tabular-nums"
        >
          {rotuloHora(h)}
        </button>
      ))}
    </div>
  );
}

function Linha({ titulo, descricao, ligado, onChange, children }: { titulo: string; descricao: string; ligado: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="rl-cartao p-3.5" data-testid={`aviso-${titulo}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight">{titulo}</p>
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{descricao}</p>
        </div>
        <Switch checked={ligado} onCheckedChange={onChange} aria-label={titulo} />
      </div>
      {ligado && children}
    </div>
  );
}

export function FolhaDeAvisos({ aberta, onFechar, avisos }: { aberta: boolean; onFechar: () => void; avisos: AvisosRelacoes }) {
  const { get } = useUserData();
  const nativo = isNativeShell();
  const [permissao, setPermissao] = useState<EstadoPermissao | null>(null);
  useEffect(() => { if (aberta && nativo) void estadoPermissao().then(setPermissao); }, [aberta, nativo, avisos.algumLigado]);

  // "o que o celular vai receber": a mesma conta do agendador, pra ninguém ligar no escuro
  const previa = useMemo(() => {
    if (!aberta) return [];
    const agora = new Date();
    const dados = lerDadosDasRelacoes(get);
    const lista: { quando: Date; title: string }[] = planejarRelacoes(dados, 0, agora).map((a) => ({ quando: a.quando, title: a.title }));
    if (avisos.vespera.ligado) {
      const pessoas = dados.pessoas.filter((p) => p.birthday).map((p) => ({ nome: p.name, aniversario: p.birthday }));
      lista.push(...planejarAniversarios(pessoas, avisos.vespera.hora, agora).map((a) => ({ quando: a.quando, title: a.title })));
    }
    return lista.sort((a, b) => a.quando.getTime() - b.quando.getTime()).slice(0, 4);
  }, [aberta, get, avisos.vespera.ligado, avisos.vespera.hora]);

  const quandoTexto = (d: Date) => {
    const n = diasEntre(new Date(), d);
    const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const dia = n === 0 ? "Hoje" : n === 1 ? "Amanhã" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `${dia}, ${hora}`;
  };

  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} onOpenAutoFocus={focarNaFolha} data-testid="folha-avisos">
        <SheetTitle className="sr-only">Avisos de Relações</SheetTitle>
        <SheetDescription className="sr-only">Escolha quando o CORE te lembra das datas e das pessoas.</SheetDescription>
        <FaixaDaFolha titulo="🔔 Avisos de Relações" sub="Tudo começa desligado. Ligue só o que você quer." onFechar={onFechar} />
        <div className="overflow-y-auto px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3">
          {!nativo && (
            <p className="rl-recado px-3 py-2.5 text-[12.5px] font-semibold leading-snug">
              No site o aviso não toca — ele toca no app do celular. O que você escolher aqui vale lá.
            </p>
          )}
          {nativo && permissao === "denied" && (
            <p className="rl-recado px-3 py-2.5 text-[12.5px] font-semibold leading-snug flex gap-2">
              <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
              O celular está bloqueando os avisos do CORE. Libere em Configurações → Aplicativos → CORE → Notificações.
            </p>
          )}
          <Linha
            titulo="Uma semana antes, com as ideias de presente"
            descricao="Sete dias antes do aniversário, com o que você guardou de ideia pra pessoa. Dá tempo de comprar sem correria."
            ligado={avisos.rel.semana.ligado}
            onChange={avisos.ligarSemana}
          >
            <Horas rotulo="Horário do aviso de uma semana antes" opcoes={HORAS_SEMANA} valor={avisos.rel.semana.hora} onEscolher={avisos.horaSemana} />
          </Linha>
          <Linha
            titulo="Na véspera do aniversário"
            descricao="Um dia antes, pra dar tempo do presente ou de separar um tempinho."
            ligado={avisos.vespera.ligado}
            onChange={avisos.ligarVespera}
          >
            <Horas rotulo="Horário do aviso da véspera" opcoes={HORAS_VESPERA} valor={avisos.vespera.hora} onEscolher={avisos.horaVespera} />
          </Linha>
          <Linha
            titulo="No dia, pra mandar os parabéns"
            descricao="No dia do aniversário (e das datas de casal). O toque abre o selo com o “Mandar parabéns”."
            ligado={avisos.rel.noDia.ligado}
            onChange={avisos.ligarNoDia}
          >
            <Horas rotulo="Horário do aviso do dia" opcoes={HORAS_NO_DIA} valor={avisos.rel.noDia.hora} onEscolher={avisos.horaNoDia} />
          </Linha>
          <Linha
            titulo="Pra mandar um oi"
            descricao="Pra quem tem “lembrar de falar” na ficha, contando da última conversa. Se não der, repete de 7 em 7 dias — nunca todo dia."
            ligado={avisos.rel.contato.ligado}
            onChange={avisos.ligarContato}
          >
            <Horas rotulo="Horário do aviso de manter contato" opcoes={HORAS_CONTATO} valor={avisos.rel.contato.hora} onEscolher={avisos.horaContato} />
          </Linha>

          {avisos.algumLigado && (
            <div className="pt-1">
              <p className="rl-mini text-muted-foreground mb-2 flex items-center gap-1.5"><Bell className="w-3 h-3" /> Os próximos avisos</p>
              {previa.length ? (
                <ul className="rl-cartao divide-y divide-border" data-testid="previa-avisos">
                  {previa.map((a, i) => (
                    <li key={i} className="flex items-center gap-3 px-3.5 py-2.5 min-h-[44px]">
                      <span className="text-[11px] font-bold tabular-nums text-[hsl(var(--rl-tinta))] w-[88px] shrink-0">{quandoTexto(a.quando)}</span>
                      <span className="text-[12.5px] leading-snug">{a.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">Nada nos próximos dias. Quando chegar perto de uma data, o aviso aparece aqui.</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
