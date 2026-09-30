/**
 * "O QUE VOCÊ JÁ CONSTRUIU" — o paywall com o item que ela anotou na missão
 * da demo (28/09). Chunk próprio: o paywall só pede este arquivo quando existe
 * item (temItemDaDemo, em demo-guiada-volta.ts).
 *
 * Duas coisas acontecem aqui:
 *   1. o bloco no paywall: ✓ o item dela (por você) · ✓ o módulo pronto ·
 *      ✓ 16 módulos · "fica salvo quando liberar" — a perda concreta (efeito
 *      dotação) na hora do preço;
 *   2. o item VAI PRA CONTA: ela acabou de se cadastrar, então o item é gravado
 *      pela chave real do módulo (demo-guiada-registro.ts) — só o item dela,
 *      somado ao que a conta já tem, sem mudar o tipo de nenhuma chave. Espera
 *      a conta carregar do servidor antes (gravar antes apagaria o que uma
 *      conta antiga já tinha). Depois do Pix, ela abre o módulo e o item está lá.
 */
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { gravarEstadoDaMissao, itemDaDemo, rotuloDoItem, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { levarItemParaConta } from "@/lib/demo-guiada-registro";
import { ehFunilB, respostasDaUrl, type RespostasDoFunilB } from "@/lib/funil-b";
import { GASTO_ANCHOR, VICTORY_PHRASE } from "@/lib/funnel";
import { Faixa, SERIF_ITALICO } from "@/pages/funis/dia14/pecas-roi2";
import { Quadradinho } from "./Quadradinho";

const PRONTO: Record<TipoDoItem, string> = {
  gasto: "Finanças pronta",
  habito: "Rotina pronta",
  exercicio: "Treino pronto",
  agua: "Saúde pronta",
  meta: "Metas prontas",
};

/** Grava o item na conta uma vez, quando a conta está carregada. Devolve se já gravou. */
function useLevarItemParaConta(item: ItemDaDemo | null): boolean {
  const { user } = useAuth();
  const { get, set, loaded, isGuest } = useUserData();
  const feito = useRef(false);
  const [gravou, setGravou] = useState(false);
  useEffect(() => {
    if (!item || !user || isGuest || !loaded || feito.current) return;
    feito.current = true;
    let chaves: string[] = [];
    try {
      // {system:true}: é o registro que ELA fez na demo, mas não é gesto de agora —
      // não dispara ativação/sequência no paywall (isso fica pro 1º uso no app)
      chaves = levarItemParaConta(item, (k) => get<unknown>(k, undefined), (k, v) => set(k, v, { system: true }));
      gravarEstadoDaMissao({ item });
      setGravou(true);
    } catch (e) {
      trackEvent("demo_guia_conta", { guia: "on", tipo: item.tipo, ok: false, erro: String(e).slice(0, 120) });
      return;
    }
    trackEvent("demo_guia_conta", { guia: "on", tipo: item.tipo, ok: true, chaves: chaves.join(",") || "ja_tinha" });
  }, [item, user, isGuest, loaded, get, set]);
  return gravou;
}

const Linha = ({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) => (
  <div className={`flex items-center gap-2.5 px-3 py-2.5 text-[13.5px] leading-snug ${destaque ? "bg-[#FFF8D6]" : ""}`}>
    <Quadradinho marcado tam={16} />
    <span className="min-w-0 flex-1">{children}</span>
  </div>
);

/** Fail-open: qualquer erro aqui dentro = o bloco some; o paywall (e o Pix) seguem. */
class SemFalha extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  componentDidCatch() { /* o paywall é mais importante que o bloco */ }
  render() { return this.state.falhou ? null : this.props.children; }
}

export default function ConstruiuNaDemoSemFalha() {
  return <SemFalha><ConstruiuNaDemo /></SemFalha>;
}

/** FUNIL B (30/09): as respostas do quiz que viraram toques na demo também
 *  são registros dela — entram como linhas do bloco (até 3 itens no total). */
function linhasDasRespostas(r: RespostasDoFunilB): ReactNode[] {
  const out: ReactNode[] = [];
  if (r.gasto) {
    const a = GASTO_ANCHOR[r.gasto];
    out.push(a
      ? <><strong className="font-bold">Seu mês:</strong> ~{a.month} saindo sem você ver</>
      : <><strong className="font-bold">Seu mês:</strong> descobrir pra onde vai o dinheiro</>);
  }
  if (r.vitoria) out.push(<><strong className="font-bold">Vitória da semana:</strong> {VICTORY_PHRASE[r.vitoria] ?? r.vitoria}</>);
  return out;
}

function ConstruiuNaDemo() {
  const [item] = useState<ItemDaDemo | null>(() => itemDaDemo(window.location.search));
  const [b] = useState(() => ehFunilB(window.location.search));
  const [respostas] = useState<RespostasDoFunilB>(() => (b ? respostasDaUrl(window.location.search) : {}));
  useLevarItemParaConta(item);
  const extras = b ? linhasDasRespostas(respostas) : [];
  useEffect(() => {
    if (item || extras.length) trackEvent("paywall_construiu_view", { guia: "on", ...(item ? { tipo: item.tipo } : {}), ...(b ? { funil: "b", respostas: extras.length } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  if (!item && !extras.length) return null;
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 text-left overflow-hidden" data-testid="construiu">
      <div className="flex items-center justify-between gap-2">
        <Faixa cor="verde">O que você já construiu</Faixa>
        {/* o 🔥 do chip preto da comemoração da Missão (sem adesivo: 28/09) */}
        <span aria-hidden className="grid place-items-center w-7 h-7 rounded-full bg-[#16121c] text-[13px] leading-none shrink-0">🔥</span>
      </div>
      {/* tabela com grade, quadradinho marcado — a folha do planner */}
      <div className="mt-3.5 rounded-xl border border-border overflow-hidden divide-y divide-border">
        {item && (
          <Linha destaque>
            <strong className="font-bold">{rotuloDoItem(item)}</strong>{" "}
            <span className="text-accent text-[16px] leading-none whitespace-nowrap" style={SERIF_ITALICO}>por você</span>
          </Linha>
        )}
        {extras.map((l, i) => <Linha key={i}>{l}</Linha>)}
        {item && <Linha>{PRONTO[item.tipo]}</Linha>}
        <Linha>16 módulos no mesmo acesso</Linha>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Lock className="w-3.5 h-3.5 shrink-0" /> Fica salvo quando liberar.
      </p>
    </div>
  );
}
