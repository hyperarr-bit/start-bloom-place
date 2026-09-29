import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import type { WidgetSize } from "@/hooks/use-home-widgets";
import { localDayKey } from "@/lib/utils";
import {
  CHAVE_DATAS, CHAVE_MOMENTOS, CHAVE_PESSOAS, datasDoAno, datasValidas, haQuanto, mesCurto, momentosValidos, pessoasPraFalar,
  pessoasValidas, proximasDatas, quandoFalta, rotuloDoFaz,
} from "@/lib/relacoes";
import { TemaRelacoes } from "@/components/relacoes/kit";

/**
 * Relações na Home (29/09) — OPCIONAL, como todo widget (regra: a Home de
 * ninguém muda sozinha). As próximas datas em selinhos e quem está esperando
 * um "oi". Lê as mesmas chaves do módulo pelo `get` (ao vivo); não grava nada.
 */
export const RelacoesWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const { get } = useUserData();
  const hoje = localDayKey();
  const brutoP = get<unknown>(CHAVE_PESSOAS, []);
  const brutoD = get<unknown>(CHAVE_DATAS, []);
  const brutoM = get<unknown>(CHAVE_MOMENTOS, []);
  const { proximas, praFalar } = useMemo(() => {
    const pessoas = pessoasValidas(brutoP);
    const agora = new Date();
    return {
      proximas: proximasDatas(datasDoAno(pessoas, datasValidas(brutoD), agora), 30, 3, 3),
      praFalar: pessoasPraFalar(pessoas, momentosValidos(brutoM), agora),
    };
  }, [brutoP, brutoD, brutoM, hoje]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = () => navigate("/relacionamentos");
  const vazio = !proximas.length && !praFalar.length;

  if (size === "small") {
    const i = proximas[0];
    return (
      <TemaRelacoes className="h-full">
        <button onClick={abrir} className="rl-cartao w-full h-full text-left shadow-sm" data-testid="widget-relacoes">
          <div className="rl-aviao" aria-hidden="true" />
          <div className="p-3.5">
            <p className="rl-caps text-[hsl(var(--rl-tinta))] flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Relações</p>
            {i ? (
              <>
                <p className="rl-serif mt-1.5 text-[21px] leading-tight truncate">{i.titulo}</p>
                <p className="text-[11.5px] font-bold text-[hsl(var(--rl-lacre))]">{i.dias === 0 ? "hoje! 🎉" : `${String(i.dia).padStart(2, "0")} ${mesCurto(i.mes).toLowerCase()} · ${quandoFalta(i.dias)}`}</p>
              </>
            ) : praFalar[0] ? (
              <p className="mt-1.5 text-[12px] leading-snug">💌 Faz tempo que você não fala com <b>{praFalar[0].pessoa.name}</b></p>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-snug">Guarde os aniversários de quem você ama</p>
            )}
          </div>
        </button>
      </TemaRelacoes>
    );
  }

  return (
    <TemaRelacoes>
      <div className="rl-cartao shadow-sm" data-testid="widget-relacoes">
        <div className="rl-aviao" aria-hidden="true" />
        <button onClick={abrir} className="flex w-full items-center gap-2 px-3.5 pt-3 pb-2 text-left">
          <Mail className="w-4 h-4 text-[hsl(var(--rl-lacre))]" />
          <span className="rl-caps text-[hsl(var(--rl-tinta))]">Relações · próximas datas</span>
        </button>
        {vazio ? (
          <button onClick={abrir} className="block w-full px-3.5 pb-3.5 text-left text-[12.5px] text-muted-foreground leading-snug">
            Guarde os aniversários de quem você ama — o CORE te lembra antes.
          </button>
        ) : (
          <>
            {proximas.length > 0 && (
              <div className="flex gap-2.5 px-3.5 pb-3">
                {proximas.map((i) => (
                  <button key={i.id} onClick={abrir} className="rl-selo !w-auto flex-1 basis-0 min-w-0" aria-label={`${i.titulo}, ${quandoFalta(i.dias)}`}>
                    <span className="rl-selo-in !py-1.5">
                      <span className="rl-serif text-[22px] leading-none text-[hsl(var(--rl-lacre))]">{String(i.dia).padStart(2, "0")}</span>
                      <span className="rl-mini text-[hsl(var(--rl-tinta))]">{mesCurto(i.mes)}</span>
                      <span className="rl-serif text-[15px] leading-[1.05] max-w-full line-clamp-2 break-words">{i.titulo}</span>
                      <span className="text-[10px] font-bold text-[hsl(var(--rl-lacre))]">{i.dias === 0 ? "hoje" : quandoFalta(i.dias)}</span>
                      {rotuloDoFaz(i) && <span className="text-[9.5px] text-muted-foreground">{rotuloDoFaz(i)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {praFalar[0] && (
              <button onClick={abrir} className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-left text-[12.5px] min-h-[44px]">
                <span aria-hidden="true">💌</span>
                <span className="flex-1 leading-snug">
                  Faz tempo: <b>{praFalar[0].pessoa.name}</b>
                  {praFalar[0].situacao.desde != null && <span className="text-muted-foreground"> · {haQuanto(praFalar[0].situacao.desde)}</span>}
                  {praFalar.length > 1 && <span className="text-muted-foreground"> e mais {praFalar.length - 1}</span>}
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </TemaRelacoes>
  );
};
