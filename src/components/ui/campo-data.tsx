import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de data com rótulo que NÃO se sobrepõe ao do navegador (30/07).
 *
 * O defeito que originou isto: em 14 lugares do app o mesmo padrão tinha sido
 * copiado — um `<Input type="date">` com um `<span>` absoluto por cima
 * dizendo "Data", "Aniversário", "Próxima". Só que campo de data VAZIO no
 * Chrome já desenha o próprio `dd/mm/aaaa`, e o rótulo caía em cima dele:
 * dois textos empilhados no mesmo pixel. Aparece no print do dono, na tela de
 * Relações, e estava igual em Finanças, Saúde, Carreira, Estudos, Casa, Pet,
 * Viagens e no widget da Home.
 *
 * (O `placeholder="dd/mm/aaaa"` que alguns tinham nunca fez nada: navegador
 * nenhum aplica placeholder em campo de data. Era decoração no código.)
 *
 * A correção: enquanto está VAZIO e SEM FOCO, esconde o texto nativo
 * (`::-webkit-datetime-edit`) e mostra o rótulo. Ao focar, o nativo volta e o
 * rótulo sai — a pessoa vê o formato na hora de digitar, que é quando ele
 * importa. Com valor preenchido, nada disso entra: mostra a data e pronto.
 *
 * Grupo NOMEADO (`group/data`): várias telas já usam `group` na linha pra
 * revelar a lixeira no hover. Um `group` anônimo aqui dentro sequestraria
 * aquele.
 */
type Props = Omit<React.ComponentProps<typeof Input>, "type" | "placeholder"> & {
  /** O que aparece enquanto está vazio: "Data", "Aniversário", "Próxima"… */
  rotulo: string;
};

export const CampoData = React.forwardRef<HTMLInputElement, Props>(
  ({ rotulo, value, className, ...resto }, ref) => {
    const vazio = value === "" || value === undefined || value === null;
    return (
      <div className="relative group/data">
        <Input
          ref={ref}
          type="date"
          value={value}
          className={cn(
            "appearance-none [&::-webkit-date-and-time-value]:text-left",
            vazio &&
              "[&::-webkit-datetime-edit]:opacity-0 focus:[&::-webkit-datetime-edit]:opacity-100",
            className,
          )}
          {...resto}
        />
        {vazio && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground group-focus-within/data:hidden">
            {rotulo}
          </span>
        )}
      </div>
    );
  },
);
CampoData.displayName = "CampoData";
