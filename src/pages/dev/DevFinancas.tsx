import Index from "@/pages/Index";

/**
 * /dev/financas — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). O módulo Finanças de verdade, no modo convidado deste
 * navegador — o que o /dev/montar-financas gravou aparece aqui. Pra ver o PAINEL LIMPO do Dashboard
 * sem conta (convidado nunca é elegível): abrir com `?painel-limpo=on` (força de QA, só navegador;
 * `?painel-limpo=auto` volta à regra). Prints 390×844, claro e escuro.
 */
export default function DevFinancas() {
  return <Index />;
}
