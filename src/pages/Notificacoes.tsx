import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, BellOff, BookOpen, CalendarCheck, Dumbbell, Receipt, Salad, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { isNativeShell } from "@/lib/native-shell";
import { estadoPermissao, listarAgendados, pedirPermissao, type EstadoPermissao, type TipoDeLembrete } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs, rotuloHora, type PrefsNotificacoes } from "@/lib/prefs-notificacoes";
import { trackEvent } from "@/lib/analytics";

/**
 * Central de notificações (27/07).
 *
 * A razão de existir está em `prefs-notificacoes.ts`: sem controle por tipo,
 * a única saída de quem se incomodou é desligar tudo no Android — e de lá o
 * app não volta. Aqui cada aviso tem chave própria.
 *
 * Três decisões que valem registrar:
 *  1. A tela mostra o que está REALMENTE agendado no sistema, não só o que os
 *     interruptores dizem. Uma central que promete e não entrega é pior que
 *     nenhuma — e foi assim que descobri, testando no aparelho, que nenhuma
 *     notificação estava sendo agendada de verdade.
 *  2. Sem permissão os interruptores não somem: ficam visíveis e o primeiro
 *     toque PEDE a permissão. Esconder faria a pessoa achar que o app não tem
 *     lembrete nenhum.
 *  3. Os quatro lembretes diários vêm DESLIGADOS e ficam abaixo de uma
 *     divisória própria. Quem abre a tela vê primeiro o que já está ligado,
 *     e o resto se apresenta como oferta — não como algo a desativar.
 */

const HORAS = [6, 7, 8, 9, 10, 12, 18, 20, 21, 22];

type ChaveLiga = "contas" | "retrospectiva" | "rotina" | "treino" | "leitura" | "dieta";

const Notificacoes = () => {
  // 30/07 (dono): na web/PWA não existe como ENTREGAR notificação local, e a
  // tela com interruptores "que valem no app" só gera ticket de suporte.
  // Fora do app da loja a rota nem abre. Antes de QUALQUER hook de propósito:
  // isNativeShell() é constante na sessão, então a contagem de hooks é
  // estável por ambiente. Reverter quando houver push web.
  if (!isNativeShell()) return <Navigate to="/home" replace />;
  const navigate = useNavigate();
  const { get } = useUserData();
  const [prefs, setPrefs] = usePersistedState<PrefsNotificacoes>(CHAVE_PREFS, lerPrefs(undefined));
  const [permissao, setPermissao] = useState<EstadoPermissao | null>(null);
  const [agendados, setAgendados] = useState<Partial<Record<TipoDeLembrete, number>>>({});

  const p = lerPrefs(prefs);
  const permitido = permissao === "granted";
  const naLoja = isNativeShell();

  const atualizarEstado = async () => {
    setPermissao(await estadoPermissao());
    const lista = await listarAgendados();
    const contagem: Partial<Record<TipoDeLembrete, number>> = {};
    lista.forEach((n) => { contagem[n.tipo] = (contagem[n.tipo] ?? 0) + 1; });
    setAgendados(contagem);
  };

  useEffect(() => { void atualizarEstado(); }, []);

  /**
   * A preferência ao vivo, fora do ciclo de render.
   *
   * Sem isto, dois toques rápidos leem o MESMO estado antigo e o segundo
   * desfaz o primeiro — `{...pAntigo, treino:true}` sobrescreve o `rotina`
   * que acabou de ser ligado. Apareceu ligando os interruptores em sequência
   * no aparelho: dos quatro, só o último ficava ligado.
   */
  const prefsRef = useRef<PrefsNotificacoes>(p);
  useEffect(() => { prefsRef.current = lerPrefs(prefs); }, [prefs]);

  /** Fila: um reagendamento por vez, na ordem em que os toques chegaram. */
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());

  /**
   * Aplica as prefs no agendador de verdade e relê o que ficou de pé.
   *
   * Reaproveita o MESMO caminho do `useLembretes` em vez de reimplementar o
   * agendamento aqui — duas fontes de verdade sobre "o que agendar" era como
   * a tela e o sistema acabariam discordando.
   */
  const aplicar = (mudanca: Partial<PrefsNotificacoes>) => {
    filaRef.current = filaRef.current.then(async () => {
      const novas = { ...prefsRef.current, ...mudanca };
      prefsRef.current = novas;
      setPrefs(novas);
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(get, novas);
      await atualizarEstado();
    });
    return filaRef.current;
  };

  /** Ligar sem permissão tem que PEDIR, não apenas mover o botão. */
  const alternar = async (campo: ChaveLiga, valor: boolean) => {
    trackEvent("notif_pref", { campo, valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return; // negou: não finge que ligou
    }
    await aplicar({ [campo]: valor });
  };

  const rodapeDe = (tipo: TipoDeLembrete, ligado: boolean, vazio: string) => {
    if (!ligado || !naLoja || !permitido) return undefined;
    const n = agendados[tipo] ?? 0;
    return n > 0 ? `${n} ${n === 1 ? "aviso agendado" : "avisos agendados"}` : vazio;
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-background/85 backdrop-blur border-b border-border
                         pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate("/home")} aria-label="Voltar" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Notificações</h1>
      </header>

      <div className="px-4 py-5 space-y-3 pb-[max(1.5rem,var(--app-safe-bottom))]">
        {!naLoja && (
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Disponível no aplicativo</p>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Os lembretes chegam pelo app instalado no celular. Aqui no navegador
              você escolhe as preferências — elas valem assim que você abrir o app.
            </p>
          </div>
        )}

        {/* Só quem foi BLOQUEADO vê o aviso pesado. Quem nunca foi perguntado
            ("prompt") não vê nada — o próprio interruptor pede a permissão. */}
        {naLoja && permissao === "denied" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BellOff className="w-4 h-4 shrink-0" /> Notificações bloqueadas
            </p>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
              O Android está bloqueando os avisos do CORE. Para liberar, vá em
              <strong className="text-foreground"> Configurações → Aplicativos → CORE → Notificações</strong> e
              ative. Depois volte aqui.
            </p>
          </div>
        )}

        <LinhaAviso
          icone={<Receipt className="w-4 h-4" />}
          titulo="Conta a vencer"
          descricao="Um aviso na véspera, com o nome das contas do dia. No máximo um por dia."
          ligado={p.contas}
          onChange={(v) => void alternar("contas", v)}
          rodape={rodapeDe("contas", p.contas, "Nenhuma conta em aberto pra avisar por enquanto")}
          hora={p.contas ? p.horaContas : undefined}
          onHora={(h) => void aplicar({ horaContas: h })}
        />

        <LinhaAviso
          icone={<Sparkles className="w-4 h-4" />}
          titulo="Retrospectiva do mês"
          descricao="Todo dia 1º, seu mês anterior em números — pronto pra compartilhar."
          ligado={p.retrospectiva}
          onChange={(v) => void alternar("retrospectiva", v)}
          rodape={rodapeDe("retrospectiva", p.retrospectiva, "Agenda no próximo dia 1º")}
        />

        <div className="pt-4 pb-1 px-1">
          <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Lembretes do dia a dia</p>
          <p className="text-[12px] text-muted-foreground/80 mt-1 leading-snug">
            Vêm desligados. Ligue só o que você quer ser lembrado — e no horário que for seu.
          </p>
        </div>

        <LinhaAviso
          icone={<CalendarCheck className="w-4 h-4" />}
          titulo="Fechamento do dia"
          descricao="Um toque à noite pra marcar os hábitos. Se você já marcou, o aviso do dia não vem."
          ligado={p.rotina}
          onChange={(v) => void alternar("rotina", v)}
          rodape={rodapeDe("rotina", p.rotina, "Tudo marcado por hoje")}
          hora={p.rotina ? p.horaRotina : undefined}
          onHora={(h) => void aplicar({ horaRotina: h })}
        />

        <LinhaAviso
          icone={<Dumbbell className="w-4 h-4" />}
          titulo="Dia de treino"
          descricao="Só nos dias que você marcou como treino, com o grupo muscular do dia."
          ligado={p.treino}
          onChange={(v) => void alternar("treino", v)}
          rodape={rodapeDe("treino", p.treino, "Marque seus dias de treino no módulo Treino")}
          hora={p.treino ? p.horaTreino : undefined}
          onHora={(h) => void aplicar({ horaTreino: h })}
        />

        <LinhaAviso
          icone={<BookOpen className="w-4 h-4" />}
          titulo="Hora de ler"
          descricao="Segunda, quarta e sexta — com quantas páginas faltam pro fim do livro."
          ligado={p.leitura}
          onChange={(v) => void alternar("leitura", v)}
          rodape={rodapeDe("leitura", p.leitura, "Marque um livro como 'lendo' na Biblioteca")}
          hora={p.leitura ? p.horaLeitura : undefined}
          onHora={(h) => void aplicar({ horaLeitura: h })}
        />

        <LinhaAviso
          icone={<Salad className="w-4 h-4" />}
          titulo="Diário da dieta"
          descricao="Um toque pra fechar o dia. Se você já preencheu, o aviso não vem."
          ligado={p.dieta}
          onChange={(v) => void alternar("dieta", v)}
          rodape={rodapeDe("dieta", p.dieta, "Diário de hoje já preenchido")}
          hora={p.dieta ? p.horaDieta : undefined}
          onHora={(h) => void aplicar({ horaDieta: h })}
        />

        <p className="text-[11px] text-muted-foreground text-center pt-3 px-6 leading-relaxed">
          O CORE não manda propaganda por notificação. Só o que você pediu pra lembrar.
        </p>
      </div>
    </div>
  );
};

const LinhaAviso = ({
  icone, titulo, descricao, ligado, onChange, rodape, hora, onHora,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
  rodape?: string;
  hora?: number;
  onHora?: (h: number) => void;
}) => (
  <div className={`rounded-2xl border p-4 transition-colors ${ligado ? "border-border bg-card" : "border-border/60 bg-card/40"}`}>
    <div className="flex items-start gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${ligado ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{titulo}</p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{descricao}</p>
      </div>
      <Switch checked={ligado} onCheckedChange={onChange} aria-label={titulo} />
    </div>
    {rodape && <p className="mt-2.5 pl-12 text-[11.5px] text-muted-foreground/80">{rodape}</p>}
    {hora !== undefined && onHora && (
      <div className="mt-3.5 pt-3.5 border-t border-border/60">
        <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Horário</p>
        <div className="flex flex-wrap gap-1.5">
          {HORAS.map((h) => (
            <button
              key={h}
              onClick={() => onHora(h)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition-colors ${
                hora === h ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {rotuloHora(h)}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default Notificacoes;
