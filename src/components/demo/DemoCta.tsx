import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { voltaDaDemoShell, voltaMarcada, voltaFunilTeste } from "./rotas";

/** CTA fixo no rodapé da demo — no funil volta pro funil; fora dele, cria conta.
 *  27/07: a demo PROVA e devolve direto pro CADASTRO, como no dia 14. (Antes
 *  devolvia pra tela SEU PLANO, que saiu do funil do app.)
 *  05/09 (v105): saiu do Preview.tsx pra ser testável sem as 16 páginas. */
export const DemoCta = ({ funnel, tour, from }: { funnel?: boolean; tour?: boolean; from?: string }) => {
  // APP DA LOJA (26/07): todos os destinos abaixo são rotas da WEB, e as duas
  // usadas na prática — /funil-radar e /inicio — entraram na trava SoNaWeb
  // quando eu fechei o vazamento do Pix. A trava manda pra ENTRADA_APP, que
  // abre no welcome azul: a pessoa tocava em "Criar conta" no fim da demo e
  // era devolvida ao começo do funil. Bug que eu mesmo introduzi.
  //
  // O fallback do tour na web era "/inicio?step=plano" — e o /inicio (dia 14)
  // NUNCA entendeu "plano": caía em "start" e reiniciava o funil. Só não
  // explodia porque o dia 14 sempre carimba &from=dia14 e nunca chega aqui.
  // Corrigido de passagem.
  const shell = isNativeShell();
  const to = shell
    // v83.1 (dono, 28/08): a demo virou o passo do FUNIL Me+ — a volta cai no
    // "quer organizar sua vida?" (compromissos → contrato → paywall), não
    // direto no offer: o contrato assinado é o preditor de 3× da autópsia.
    // Funil W (29/08): quem armou a demo pode deixar outra volta em
    // core-demo-volta — senão, o /app de sempre.
    ? voltaDaDemoShell()
    /* 31/08 (bronca do dono: "na demo, quando clica em voltar, vai pra um
       funil diferente"). O W abre a demo com ?from=w, e `from` só é resolvido
       pela lista FUNIS_TESTE — que tem dia14/radar/v1 e NÃO tem o w. Sem
       correspondência, caía no /comecar: outro funil, outro paywall, outra
       oferta. A marca que o próprio funil deixou (core-demo-volta) vale mais
       que qualquer tabela, porque ela carrega o caminho REAL de origem. */
    : voltaMarcada()
      ?? (from && voltaFunilTeste(from, tour))
      ?? (funnel || tour ? "/comecar?step=signup" : "/comecar");
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center gap-3">
        <p className="text-xs text-muted-foreground leading-tight flex-1">
          {/* v105 (05/09): no shell a demo é um PASSO do plano — o texto diz de
              onde a pessoa veio e o botão diz pra onde volta. "Quero o meu
              assim" soava como compra e a demo já perdia 14% pro launcher. */}
          {shell
            ? <>Seu plano continua daqui.</>
            : <>Gostou? Crie sua conta e leve isso com os <strong className="text-foreground">seus números</strong>.</>}
        </p>
        <Link
          to={to}
          onClick={() => trackEvent("funnel_click", { cta: funnel ? "demo_quase_la" : "demo_create_account" })}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 hover:bg-primary/90 transition"
        >
          {shell ? "Voltar pro meu plano" : funnel ? "Quase lá" : "Criar conta"} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
