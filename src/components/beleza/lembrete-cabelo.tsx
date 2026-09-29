/**
 * 🔔 LEMBRETE DO CABELO (28/09, Onda 1): "Hoje é dia de HIDRATAÇÃO" no dia de lavar
 * e, se quiser, "umectação hoje à noite?" na véspera. Nascem DESLIGADOS (regra do
 * dono pra todo lembrete novo); ligar pede a permissão do celular aqui, no primeiro
 * sim. Mesma infraestrutura dos avisos do skincare (faixa própria de id, texto
 * congelado, série refeita a cada FEITO). No site, o recado de sempre.
 */
import { Bell, Moon, Droplets } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUserData } from "@/hooks/use-user-data";
import { armarAvisos } from "@/lib/armar-avisos";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { normalizarHora } from "@/lib/tarefas";
import { CHAVE_LEMBRETE_CABELO, lerDadosDoCabelo, planejarCabelo, type LembreteCabelo } from "@/lib/beleza-cabelo";
import { quandoDoAviso } from "./lembrete-skincare";
import { CartaoBeleza, FaixaBeleza, ROTULO_BZ, Serif } from "./kit";
import type { Cabelo } from "./use-cabelo";

export function LembreteDoCabelo({ c }: { c: Cabelo }) {
  const { get } = useUserData();
  const noApp = isNativeShell();
  const armar = (novo: LembreteCabelo, pedir: boolean) =>
    void armarAvisos(get, { [CHAVE_LEMBRETE_CABELO]: novo }, pedir, { nome: "cabelo_lembrete_permissao", total: 1 });

  const ligar = (qual: keyof LembreteCabelo, ligado: boolean) => {
    const novo = c.mudarLembrete(qual, { ligado });
    trackEvent("cabelo_lembrete", { qual, ligado, hora: novo[qual].hora });
    armar(novo, ligado);
  };
  const mudarHora = (qual: keyof LembreteCabelo, bruta: string) => {
    const hora = normalizarHora(bruta);
    if (!hora) return;
    armar(c.mudarLembrete(qual, { hora }), false);
  };

  // o próximo aviso, com o mesmo planejamento que o celular recebe
  const proximo = planejarCabelo({ ...lerDadosDoCabelo(get), prefs: c.lembrete }, 0)[0];
  const linhas: { qual: keyof LembreteCabelo; rotulo: string; icone: JSX.Element; tom: string }[] = [
    { qual: "dia", rotulo: "no dia", icone: <Droplets className="w-4 h-4 text-bz-hidra-tinta" />, tom: "bg-bz-hidra" },
    { qual: "vespera", rotulo: "na véspera", icone: <Moon className="w-4 h-4 text-bz-noite-icone" />, tom: "bg-bz-noite" },
  ];

  return (
    <CartaoBeleza data-card="lembrete-cabelo" data-testid="lembrete-cabelo">
      <FaixaBeleza tom="dica" icone={<Bell className="w-4 h-4 text-bz-acento" />} titulo="LEMBRETE" direita={<span className="font-semibold opacity-80">dia de lavar</span>} />
      {linhas.map(({ qual, rotulo, icone, tom }, k) => {
        const l = c.lembrete[qual];
        return (
          <div key={qual} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 min-h-[58px]", k > 0 && "border-t border-bz-linha")}>
            <span className={cn("w-8 h-8 rounded-full grid place-items-center", tom)} aria-hidden="true">{icone}</span>
            <span className="min-w-0">
              <Serif className={cn("block text-[19px] leading-none", l.ligado ? "text-bz-tinta" : "text-bz-suave")}>{rotulo}</Serif>
              <span className="block text-[11px] text-bz-suave mt-0.5">{qual === "dia" ? "a etapa do dia" : "umectação à noite"}</span>
            </span>
            <input
              type="time"
              value={l.hora}
              onChange={(e) => mudarHora(qual, e.target.value)}
              aria-label={qual === "dia" ? "Hora do lembrete no dia de lavar" : "Hora do lembrete da véspera"}
              className={cn(
                "h-10 w-[116px] rounded-full border border-bz-linha-forte bg-bz-cartao px-3 text-center text-[15px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring",
                l.ligado ? "text-bz-tinta" : "text-bz-suave",
              )}
            />
            <Switch checked={l.ligado} onCheckedChange={(v) => ligar(qual, v)} aria-label={qual === "dia" ? "Lembrete no dia de lavar" : "Lembrete na véspera"} />
          </div>
        );
      })}
      {proximo && (
        <div className="px-4 py-3 border-t border-bz-linha" data-testid="proximo-aviso-cabelo">
          <p className={ROTULO_BZ}>O próximo aviso</p>
          <div className="mt-1.5 rounded-2xl border border-bz-linha bg-bz-papel px-3.5 py-2.5">
            <p className="text-[11px] text-bz-suave">CORE · {quandoDoAviso(proximo.quando)}</p>
            <p className="text-[13.5px] font-bold leading-snug mt-0.5 text-bz-tinta">{proximo.title}</p>
            <p className="text-[12.5px] text-bz-suave leading-snug">{proximo.body}</p>
          </div>
        </div>
      )}
      {!noApp && (
        <p className="px-4 pb-3 pt-1 text-[11.5px] text-bz-suave" data-testid="lembrete-cabelo-so-no-app">
          No site o lembrete não toca — ele toca no app do celular.
        </p>
      )}
    </CartaoBeleza>
  );
}
