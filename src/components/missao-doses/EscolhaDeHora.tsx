import { useState } from "react";
import { EscolhaRapida, type OpcaoRapida } from "@/components/ui/escolha-rapida";
import { HORA_PROPRIA, minutosDoLembrete, type Lembrete } from "@/lib/missao-doses";

/**
 * A HORA DO LEMBRETE (1.0.17): os chips de sempre (8h · 12h · 20h, e "sem aviso" quando faz sentido) + "+ Outro" com um
 * stepper de hora cheia (6h–22h) — a mesma EscolhaRapida de todas as listas. A hora dela vira um chip marcado ("21h").
 */
export function EscolhaDeHora({ valor, aoMudar, comSem = true, testid = "missao-doses-hora" }: {
  valor: Lembrete;
  aoMudar: (l: Lembrete) => void;
  /** mostra o chip "sem aviso" */
  comSem?: boolean;
  testid?: string;
}) {
  const fixas: Lembrete[] = ["8h", "12h", "20h"];
  // a hora dela (do "+ Outro" agora ou de antes) aparece como chip, na frente do "+ Outro"
  const [propria, setPropria] = useState<Lembrete | null>(() => (fixas.includes(valor) || valor === "sem" ? null : valor));
  const opcoes: OpcaoRapida[] = [
    ...fixas.map((h) => ({ id: h, rotulo: h })),
    ...(propria ? [{ id: propria, rotulo: propria }] : []),
    ...(comSem ? [{ id: "sem", rotulo: "sem aviso" }] : []),
  ];
  const inicial = (() => { const m = minutosDoLembrete(valor); return typeof m === "number" ? Math.min(HORA_PROPRIA.max, Math.max(HORA_PROPRIA.min, m / 60)) : 21; })();
  return (
    <EscolhaRapida
      opcoes={opcoes}
      marcado={valor}
      tom="folha"
      radio
      rotulo="Hora do lembrete"
      testid={testid}
      testidDe={(op) => (op.sua ? undefined : `${testid}-${op.id}`)}
      numero={{ min: HORA_PROPRIA.min, max: HORA_PROPRIA.max, inicial, formatar: (n) => `${n}h`, rotulo: "Outra" }}
      aoEscolher={(op) => {
        if (op.sua) { const h = `${op.valor ?? inicial}h` as Lembrete; setPropria(fixas.includes(h) ? null : h); aoMudar(h); return; }
        aoMudar(op.id as Lembrete);
      }}
    />
  );
}
