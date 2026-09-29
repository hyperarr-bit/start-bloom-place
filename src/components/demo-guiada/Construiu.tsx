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
import { gravarEstadoDaMissao, itemDaDemo, rotuloDoItem, ADESIVO_DO_TIPO, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { levarItemParaConta } from "@/lib/demo-guiada-registro";
import { Adesivo } from "@/components/conquistas/adesivos-arte";
import { Faixa, SERIF_ITALICO } from "@/pages/funis/dia14/pecas-roi2";
import { Quadradinho } from "./pecas";

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

function ConstruiuNaDemo() {
  const [item] = useState<ItemDaDemo | null>(() => itemDaDemo(window.location.search));
  useLevarItemParaConta(item);
  useEffect(() => {
    if (item) trackEvent("paywall_construiu_view", { guia: "on", tipo: item.tipo });
  }, [item]);
  if (!item) return null;
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 text-left overflow-hidden" data-testid="construiu">
      <Faixa cor="verde">O que você já construiu</Faixa>
      <span aria-hidden className="absolute right-3 top-2.5 leading-none" style={{ transform: "rotate(8deg)" }}>
        <Adesivo id={ADESIVO_DO_TIPO[item.tipo]} tamanho={46} />
      </span>
      {/* tabela com grade, quadradinho marcado — a folha do planner */}
      <div className="mt-3.5 rounded-xl border border-border overflow-hidden divide-y divide-border">
        <Linha destaque>
          <strong className="font-bold">{rotuloDoItem(item)}</strong>{" "}
          <span className="text-accent text-[16px] leading-none whitespace-nowrap" style={SERIF_ITALICO}>por você</span>
        </Linha>
        <Linha>{PRONTO[item.tipo]}</Linha>
        <Linha>16 módulos no mesmo acesso</Linha>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Lock className="w-3.5 h-3.5 shrink-0" /> Fica salvo quando liberar.
      </p>
    </div>
  );
}
