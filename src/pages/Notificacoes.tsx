import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellOff, Receipt, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { isNativeShell } from "@/lib/native-shell";
import {
  agendarContas, agendarRetrospectiva, estadoPermissao, listarAgendados, pedirPermissao,
  type EstadoPermissao,
} from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs, rotuloHora, type PrefsNotificacoes } from "@/lib/prefs-notificacoes";
import { trackEvent } from "@/lib/analytics";

/**
 * Central de notificações (27/07).
 *
 * A razão de existir está em `prefs-notificacoes.ts`: sem controle por tipo,
 * a única saída de quem se incomodou é desligar tudo no Android — e de lá o
 * app não volta. Aqui cada aviso tem chave própria.
 *
 * Duas decisões que valem registrar:
 *  1. A tela mostra o que está REALMENTE agendado no sistema, não só o que os
 *     interruptores dizem. Uma central que promete e não entrega é pior que
 *     nenhuma — e foi assim que descobri, testando, que sem permissão os
 *     interruptores ficavam felizes com zero notificação agendada.
 *  2. Sem permissão, os interruptores não somem: eles ficam visíveis e o
 *     primeiro toque PEDE a permissão. Esconder faria a pessoa achar que o
 *     app não tem lembrete nenhum.
 */

const HORAS = [6, 7, 8, 9, 10, 12, 18, 20];

const Notificacoes = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  const [prefs, setPrefs] = usePersistedState<PrefsNotificacoes>(CHAVE_PREFS, lerPrefs(undefined));
  const [permissao, setPermissao] = useState<EstadoPermissao | null>(null);
  const [agendados, setAgendados] = useState<{ contas: number; retrospectiva: number }>({ contas: 0, retrospectiva: 0 });

  const p = lerPrefs(prefs);
  const permitido = permissao === "granted";

  const atualizarEstado = async () => {
    setPermissao(await estadoPermissao());
    const lista = await listarAgendados();
    setAgendados({
      contas: lista.filter((n) => n.tipo === "contas").length,
      retrospectiva: lista.filter((n) => n.tipo === "retrospectiva").length,
    });
  };

  useEffect(() => { void atualizarEstado(); }, []);

  /** Aplica as prefs no agendador de verdade e relê o que ficou de pé. */
  const aplicar = async (novas: PrefsNotificacoes) => {
    setPrefs(novas);
    const dueDays = get<{ day?: number; bills?: { name?: string; paid?: boolean }[] }[]>("finance-dueDays", []) ?? [];
    await agendarContas(dueDays, { hora: novas.horaContas, ligado: novas.contas });
    await agendarRetrospectiva(novas.retrospectiva);
    await atualizarEstado();
  };

  /** Ligar sem permissão tem que PEDIR, não apenas mover o botão. */
  const alternar = async (campo: "contas" | "retrospectiva", valor: boolean) => {
    trackEvent("notif_pref", { campo, valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return; // negou: não finge que ligou
    }
    await aplicar({ ...p, [campo]: valor });
  };

  const naLoja = isNativeShell();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-background/85 backdrop-blur border-b border-border
                         pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate("/home")}
          aria-label="Voltar"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors"
        >
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
              você pode escolher as preferências — elas valem assim que você abrir o app.
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
          rodape={
            p.contas && naLoja && permitido
              ? agendados.contas > 0
                ? `${agendados.contas} ${agendados.contas === 1 ? "aviso agendado" : "avisos agendados"}`
                : "Nenhuma conta em aberto pra avisar por enquanto"
              : undefined
          }
        >
          {p.contas && (
            <div className="mt-3.5 pt-3.5 border-t border-border/60">
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Horário</p>
              <div className="flex flex-wrap gap-1.5">
                {HORAS.map((h) => (
                  <button
                    key={h}
                    onClick={() => void aplicar({ ...p, horaContas: h })}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition-colors ${
                      p.horaContas === h
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {rotuloHora(h)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </LinhaAviso>

        <LinhaAviso
          icone={<Sparkles className="w-4 h-4" />}
          titulo="Retrospectiva do mês"
          descricao="Todo dia 1º, seu mês anterior em números — pronto pra compartilhar."
          ligado={p.retrospectiva}
          onChange={(v) => void alternar("retrospectiva", v)}
          rodape={
            p.retrospectiva && naLoja && permitido && agendados.retrospectiva > 0
              ? `Próxima: dia 1º às ${rotuloHora(10)}`
              : undefined
          }
        />

        <p className="text-[11px] text-muted-foreground text-center pt-2 px-6 leading-relaxed">
          O CORE não manda propaganda por notificação. Só o que você pediu pra lembrar.
        </p>
      </div>
    </div>
  );
};

const LinhaAviso = ({
  icone, titulo, descricao, ligado, onChange, rodape, children,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
  rodape?: string;
  children?: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{titulo}</p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{descricao}</p>
      </div>
      <Switch checked={ligado} onCheckedChange={onChange} aria-label={titulo} />
    </div>
    {rodape && <p className="mt-2.5 pl-12 text-[11.5px] text-muted-foreground/80">{rodape}</p>}
    {children}
  </div>
);

export default Notificacoes;
