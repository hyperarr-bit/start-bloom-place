import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MontarFinancas } from "@/components/finance/montar/MontarFinancas";

/**
 * /dev/montar-financas — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). A tela "Vamos montar suas Finanças" solta, pra o dono
 * aprovar o visual e pros prints (390×844, claro e escuro). Sem conta: grava no modo convidado
 * deste navegador. `?espera=ms` segura o "Montando…" (padrão 2200), `?data=AAAA-MM-DD` fixa o dia.
 */
export default function DevMontarFinancas() {
  const [q] = useSearchParams();
  const [fim, setFim] = useState<string | null>(null);
  const espera = Number(q.get("espera") ?? 2200);
  const data = q.get("data");
  const agora = data ? new Date(`${data}T12:00:00`) : undefined;
  if (fim) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center bg-background text-foreground">
        <div>
          <p className="text-lg font-bold">{fim}</p>
          <button type="button" className="mt-4 underline" onClick={() => setFim(null)}>De novo</button>
        </div>
      </div>
    );
  }
  return (
    <MontarFinancas
      key={fim ?? "x"}
      agora={agora}
      esperaMs={Number.isFinite(espera) ? espera : 2200}
      onPronto={(r) => setFim(`Pronto: ${r.contas} contas · R$ ${r.porDia}/dia`)}
      onPular={() => setFim("Pulou")}
    />
  );
}
