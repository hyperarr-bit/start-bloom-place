import { Check, Flame, Shield } from "lucide-react";
import type { Sequencia } from "./use-conquistas";
import { LembreteDaSequencia } from "./LembreteDaSequencia";

/**
 * Card SEQUÊNCIA (26/09): faixa laranja→rosa com os dias e os protetores, e o
 * que falta hoje. A ação sugerida é do módulo que a pessoa mais usa e leva
 * direto pra ele.
 */
export const CardSequencia = ({ seq, onAcao }: { seq: Sequencia; onAcao: (rota: string) => void }) => {
  const { dias, saldo, hojeFeito, acao, protegidoOntem } = seq;
  // um <span> só: dentro do inline-flex com gap, dois pedaços de texto ganhavam espaço dobrado
  const protetores =
    saldo > 0 ? (
      <span>
        {saldo} {saldo === 1 ? "protetor" : "protetores"}
        <span className="hidden min-[400px]:inline"> {saldo === 1 ? "guardado" : "guardados"}</span>
      </span>
    ) : (
      <span>nenhum protetor</span>
    );

  return (
    <section className="rounded-2xl border border-orange-200 overflow-hidden bg-card" aria-label="Sequência" data-testid="card-sequencia">
      <div className="h-11 px-4 flex items-center text-white gap-2" style={{ background: "linear-gradient(90deg,#fb923c,#f43f5e)" }}>
        <Flame className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="text-[13px] font-extrabold tracking-wide whitespace-nowrap tabular-nums">
          SEQUÊNCIA · {dias} {dias === 1 ? "DIA" : "DIAS"}
        </span>
        <span className="ml-auto text-[12px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
          <Shield className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
          {protetores}
        </span>
      </div>
      <div className="px-4 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
        {hojeFeito ? (
          <p className="inline-flex items-center gap-1.5">
            Hoje já tá garantido <Check className="w-4 h-4 text-success" strokeWidth={3} aria-hidden />
          </p>
        ) : (
          <p>
            {dias > 0 ? (
              <>Hoje falta <b className="text-foreground">1 coisa</b> pra manter: </>
            ) : (
              <>Anote <b className="text-foreground">1 coisa</b> hoje pra começar: </>
            )}
            <button
              type="button"
              onClick={() => onAcao(acao.rota)}
              className="whitespace-nowrap rounded bg-yellow-100 text-yellow-900 font-semibold px-1.5 underline-offset-2 hover:underline"
            >
              {acao.texto}
            </button>
          </p>
        )}
        {protegidoOntem && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px]">
            <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden /> Ontem ficou vazio — um protetor segurou sua sequência.
          </p>
        )}
        {!protegidoOntem && saldo === 0 && dias < 7 && (
          <p className="mt-1.5 text-[11.5px]">A cada 7 dias seguidos você ganha 1 protetor: ele segura sozinho um dia que ficar vazio.</p>
        )}
        {dias > 0 && <LembreteDaSequencia />}
      </div>
    </section>
  );
};
