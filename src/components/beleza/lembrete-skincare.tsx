/**
 * 🔔 LEMBRETE do skincare (28/09, protótipo). Manhã e noite, cada um com a hora
 * e o interruptor. Nasce desligado (diário = só com o sim da pessoa). Ligar
 * pede a permissão do celular AQUI, no primeiro sim — como as tarefas com
 * horário e os compromissos (no Android 13+ a recusa é definitiva, pedir na
 * abertura é jogar a chance fora).
 *
 * Embaixo, "O PRÓXIMO AVISO": o texto que o código vai agendar, pra pessoa ver
 * que o lembrete fala o passo do dia ("🌙 Hoje é noite de Retinol"). No site,
 * o recado de sempre: o aviso toca no app do celular.
 */
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CartaoBeleza, FaixaBeleza, IconePeriodo, ROTULO_BZ, Serif } from "./kit";
import { useUserData } from "@/hooks/use-user-data";
import { armarAvisos } from "@/lib/armar-avisos";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { cn, localDayKey } from "@/lib/utils";
import { normalizarHora } from "@/lib/tarefas";
import { CHAVE_LEMBRETE_SKINCARE, algumLigado, lerDadosDoSkincare, planejarSkincare, type LembreteSkincare } from "@/lib/beleza-lembrete";
import type { Periodo } from "@/lib/beleza-rotina";
import { DIAS_CURTOS, diaDaSemana } from "@/lib/beleza-rotina";
import type { Skincare } from "./use-skincare";

/** "hoje, 21:30" · "amanhã, 07:30" · "qua, 07:30" */
export const quandoDoAviso = (quando: Date, agora = new Date()): string => {
  const hh = `${String(quando.getHours()).padStart(2, "0")}:${String(quando.getMinutes()).padStart(2, "0")}`;
  const hoje = localDayKey(agora);
  const amanha = localDayKey(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  const dia = localDayKey(quando);
  if (dia === hoje) return `hoje, ${hh}`;
  if (dia === amanha) return `amanhã, ${hh}`;
  return `${DIAS_CURTOS[diaDaSemana(quando)].toLowerCase()}, ${hh}`;
};

export function LembreteDoSkincare({ s }: { s: Skincare }) {
  const { get } = useUserData();
  const noApp = isNativeShell();
  const armar = (novo: LembreteSkincare, pedir: boolean) =>
    void armarAvisos(get, { [CHAVE_LEMBRETE_SKINCARE]: novo }, pedir, { nome: "skincare_lembrete_permissao", total: 1 });

  const ligar = (periodo: Periodo, ligado: boolean) => {
    const novo = s.mudarLembrete(periodo, { ligado });
    trackEvent("skincare_lembrete", { periodo, ligado, hora: novo[periodo].hora });
    armar(novo, ligado);
  };
  const mudarHora = (periodo: Periodo, bruta: string) => {
    const hora = normalizarHora(bruta);
    if (!hora) return;
    armar(s.mudarLembrete(periodo, { hora }), false);
  };

  // o próximo aviso, com os dados de agora (o mesmo planejamento que o celular recebe)
  const proximo = algumLigado(s.lembrete) ? planejarSkincare(lerDadosDoSkincare(get, s.hoje), 0)[0] : undefined;

  return (
    <CartaoBeleza data-card="lembrete-skincare" data-testid="lembrete-skincare">
      <FaixaBeleza
        tom="dica"
        icone={<Bell className="w-4 h-4 text-bz-acento" />}
        titulo="LEMBRETE"
        direita={<span className="font-semibold opacity-80">com os passos do dia</span>}
      />
      {(["manha", "noite"] as const).map((periodo, k) => {
        const l = s.lembrete[periodo];
        const rotulo = periodo === "manha" ? "Manhã" : "Noite";
        return (
          <div key={periodo} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 min-h-[58px]", k > 0 && "border-t border-bz-linha")}>
            <IconePeriodo periodo={periodo} className={periodo === "manha" ? "bg-bz-manha" : "bg-bz-noite"} />
            <Serif className={cn("text-[20px] leading-none", l.ligado ? "text-bz-tinta" : "text-bz-suave")}>{periodo === "manha" ? "manhã" : "noite"}</Serif>
            <input
              type="time"
              value={l.hora}
              onChange={(e) => mudarHora(periodo, e.target.value)}
              aria-label={`Hora do lembrete da ${rotulo.toLowerCase()}`}
              className={cn(
                // 116 px: com 98 o relógio do seletor (Chrome/Android) comia o "07:30"
                "h-10 w-[116px] rounded-full border border-bz-linha-forte bg-bz-cartao px-3 text-center text-[15px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring",
                l.ligado ? "text-bz-tinta" : "text-bz-suave",
              )}
            />
            <Switch checked={l.ligado} onCheckedChange={(v) => ligar(periodo, v)} aria-label={`Lembrete da ${rotulo.toLowerCase()}`} />
          </div>
        );
      })}
      {proximo && (
        <div className="px-4 py-3 border-t border-bz-linha" data-testid="proximo-aviso">
          <p className={ROTULO_BZ}>O próximo aviso</p>
          <div className="mt-1.5 rounded-2xl border border-bz-linha bg-bz-papel px-3.5 py-2.5">
            <p className="text-[11px] text-bz-suave">CORE · {quandoDoAviso(proximo.quando)}</p>
            <p className="text-[13.5px] font-bold leading-snug mt-0.5 text-bz-tinta">{proximo.title}</p>
            <p className="text-[12.5px] text-bz-suave leading-snug">{proximo.body}</p>
          </div>
        </div>
      )}
      {!noApp && (
        <p className="px-4 pb-3 pt-1 text-[11.5px] text-bz-suave" data-testid="lembrete-so-no-app">
          No site o lembrete não toca — ele toca no app do celular.
        </p>
      )}
    </CartaoBeleza>
  );
}
