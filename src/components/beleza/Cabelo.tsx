/**
 * A aba CABELO (28/09, Onda 1). Sem cronograma: as 4 perguntas ali mesmo. Com
 * cronograma: CABELO DE HOJE (a etapa do dia e os passos), MEU MÊS (as 4 semanas,
 * editáveis), as últimas lavagens e o lembrete (desligado até a pessoa ligar).
 */
import { useState } from "react";
import { Bell } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { armarAvisos } from "@/lib/armar-avisos";
import { trackEvent } from "@/lib/analytics";
import { parseLocalDay } from "@/lib/utils";
import { CHAVE_LEMBRETE_CABELO, ETAPAS, ROTULO_POROSIDADE, resumoDaSequencia, type PlanoCapilar } from "@/lib/beleza-cabelo";
import { HAIR_RESULT_TAGS } from "./utils";
import { BOTAO_PILULA, CartaoBeleza, Dica, FaixaBeleza, LetraDaEtapa } from "./kit";
import { MontarCronograma } from "./montar-cronograma";
import { CabeloDeHoje } from "./cabelo-de-hoje";
import { MeuMesCabelo } from "./meu-mes-cabelo";
import { LembreteDoCabelo } from "./lembrete-cabelo";
import { useCabelo } from "./use-cabelo";

const diaMes = (dia: string) => parseLocalDay(dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function Cabelo() {
  const c = useCabelo();
  const { get } = useUserData();
  const [dia, setDia] = useState(c.hoje);
  const [refazendo, setRefazendo] = useState(false);
  const [pronto, setPronto] = useState<PlanoCapilar | null>(null);

  if (!c.plano || refazendo) {
    return (
      <MontarCronograma
        onPronto={(r) => {
          const plano = c.montar(r);
          setPronto(plano);
          setRefazendo(false);
          setDia(c.hoje);
          trackEvent("cabelo_cronograma_montado", { lavagens: plano.sequencia.length, ritmo: plano.ritmo.tipo, refeito: !!c.plano });
        }}
        onCancelar={c.plano ? () => setRefazendo(false) : undefined}
      />
    );
  }

  const ligarLembrete = () => {
    const novo = c.mudarLembrete("dia", { ligado: true });
    trackEvent("cabelo_lembrete", { qual: "dia", ligado: true, hora: novo.dia.hora, origem: "pronto" });
    void armarAvisos(get, { [CHAVE_LEMBRETE_CABELO]: novo }, true, { nome: "cabelo_lembrete_permissao", total: 1 });
  };
  const ultimas = [...c.lavagens].filter((l) => l.feita).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);

  return (
    <div className="space-y-4" data-testid="aba-cabelo">
      {pronto && (
        <Dica testId="cronograma-pronto">
          Cronograma pronto: <b>{resumoDaSequencia(pronto.sequencia)}</b> em 4 semanas
          {c.perfil ? <> · porosidade <b>{ROTULO_POROSIDADE[c.perfil.porosidade]}</b></> : null}. A etapa só anda quando você marca FEITO.
          <span className="block mt-1 text-[11.5px] opacity-80">Orientação geral — não substitui a avaliação de um dermatologista.</span>
        </Dica>
      )}
      {pronto && !c.lembrete.dia.ligado && (
        <Dica icone={<Bell className="w-4 h-4" />} testId="oferta-lembrete-cabelo" acao={<button type="button" onClick={ligarLembrete} className={BOTAO_PILULA}>Ligar</button>}>
          Quer que o CORE avise no dia de lavar, às <b>{c.lembrete.dia.hora}</b>?
        </Dica>
      )}

      <CabeloDeHoje c={c} dia={dia} onDia={setDia} />
      <MeuMesCabelo c={c} onAbrirDia={(d) => { setDia(d); document.querySelector('[data-testid="cabelo-de-hoje"]')?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }} onRefazer={() => { setRefazendo(true); setPronto(null); }} />

      {ultimas.length > 0 && (
        <CartaoBeleza data-testid="ultimas-lavagens">
          <FaixaBeleza tom="blush" titulo="ÚLTIMAS LAVAGENS" />
          {ultimas.map((l) => (
            <button key={l.id} type="button" onClick={() => setDia(l.data)} className="w-full text-left px-4 py-2.5 border-t border-bz-linha flex items-center gap-3 bg-transparent active:bg-bz-blush/60">
              {l.etapa ? <LetraDaEtapa etapa={l.etapa} tamanho="sm" feita={l.noPlano} /> : <span className="w-6 h-6 rounded-full bg-bz-base shrink-0" aria-hidden="true" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-bz-tinta">
                  {diaMes(l.data)} · {l.etapa ? ETAPAS[l.etapa].rotulo.toLowerCase() : "só lavei"}{l.noPlano ? "" : " · fora do plano"}
                </span>
                {(l.tags.length > 0 || l.nota) && (
                  <span className="block text-[12px] text-bz-suave truncate">
                    {l.tags.map((t) => HAIR_RESULT_TAGS.find((x) => x.id === t)).filter(Boolean).map((t) => `${t!.emoji} ${t!.label}`).join(" · ")}
                    {l.tags.length > 0 && l.nota ? " · " : ""}{l.nota}
                  </span>
                )}
              </span>
            </button>
          ))}
        </CartaoBeleza>
      )}

      <LembreteDoCabelo c={c} />
      <p className="text-center text-[11.5px] text-bz-suave px-6">Orientação geral — não substitui a avaliação de um dermatologista.</p>
    </div>
  );
}
