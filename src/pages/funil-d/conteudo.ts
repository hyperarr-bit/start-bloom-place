/**
 * COPY DO /funil-d. Tudo que a pessoa lê mora aqui.
 *
 * O que o app faz de verdade (conferido no código, 18/10/2026):
 *   · "Quanto posso gastar hoje" — Dashboard.tsx: o disponível dividido pelos
 *     dias que faltam, contando hoje. O aviso diário é o LembreteDoLimite
 *     (só no app, a pessoa liga).
 *   · Limite por categoria — CategoryBudgets.tsx: a barra muda de cor e, ao
 *     passar, mostra "Limite excedido". Delivery é categoria de verdade
 *     (finance-categories.ts).
 *   · Desafio da semana — challenges.ts: "Semana sem delivery", "3 dias sem
 *     gastar", "Registrar em 5 dias", "Gastar menos que semana passada".
 *   · Contas do mês por dia — BillsDueCards.tsx.
 *   · 16 módulos — ALL_MODULE_ICONS em lib/funnel.ts.
 * Nada aqui promete teto automático de delivery, leitura de extrato ou
 * "sua hora" dentro do app: a hora é desta página.
 */

export const SELO_ENTRADA = "1 número · 10 segundos · sem cadastro";
export const H1 = "Quanto vale uma hora da sua vida?";
export const PROMESSA = "Você digita o que cai na conta. A conta sai na hora.";
export const SUB_ENTRADA = "Sem extrato e sem estimativa. É a conta da CLT: salário dividido por 220 horas.";
export const ROTULO_SALARIO = "O que cai na sua conta por mês";
export const PLACEHOLDER_SALARIO = "3.200";
export const CTA_VER = "Ver o preço da minha hora";
export const ERRO_SALARIO = "Digite o que cai na conta, em reais. Ex.: 3.200";
export const PRIVACIDADE = "Esse número fica neste celular. A gente não pede banco, senha nem extrato.";
export const JORNADA_44 = "Jornada de 44h por semana";
export const JORNADA_22 = "Meio período · 22h por semana";
export const TROCAR_22 = "Trabalho meio período";
export const TROCAR_44 = "Voltar pra 44h";

export const CTA_GUARDAR = "Quero guardar essas horas";
export const ROTULO_PRECO = "Quanto custou a última coisa que você comprou sem pensar?";
export const PLACEHOLDER_PRECO = "";
export const EXEMPLOS_ROTULO = "Exemplos pra preencher. Não é o seu gasto.";

/** Preços de exemplo, só pra encher o campo com um toque. Não são tabela oficial. */
export const EXEMPLOS = [
  { id: "cafe", rotulo: "Café", centavos: 800 },
  { id: "ifood", rotulo: "iFood", centavos: 4500 },
  { id: "uber", rotulo: "Uber", centavos: 2200 },
  { id: "netflix", rotulo: "Netflix", centavos: 4490 },
] as const;

export const PASSO_TITULO = "Um teto pro que a hora compra";
export const PASSO_SUB = "A hora você já viu, de graça. O CORE segura o mês com o que você lançar.";

export const PASSOS_APP = [
  {
    n: "1",
    titulo: "Quanto posso gastar hoje",
    texto: "O painel de Finanças divide o que sobra pelos dias que faltam no mês, contando hoje.",
  },
  {
    n: "2",
    titulo: "Limite por categoria",
    texto: "Você põe um teto em delivery, lazer, mercado. A barra muda de cor e avisa quando passa.",
  },
  {
    n: "3",
    titulo: "Desafio da semana",
    texto: "Semana sem delivery, 3 dias sem gastar, ou gastar menos que a semana passada. As contas do mês ficam por dia.",
  },
] as const;

export const MODULOS_LINHA = "16 módulos inclusos";
export const PRECO_SELO = "Plano anual";
export const PRECO_LINHA = "R$ 97,90 uma vez · 1 ano de CORE";
export const PRECO_MES = "dá R$ 8,16 por mês";
export const CTA_PAGAR = "Pagar R$ 97,90 no Pix";
export const CTA_PAGAR_SUB = "O código aparece aqui, sem sair da página.";
export const GARANTIA = "7 dias de garantia. Não gostou, devolvemos tudo. Sem renovação automática no Pix.";
export const CONFIANCA_GATEWAY = "Pagamento pela Asaas";

export const FAQ = [
  {
    p: "É mensal?",
    r: "Não. É 1 ano de acesso, pagamento único no Pix. Não renova sozinho.",
  },
  {
    p: "Funciona no iPhone e no Android?",
    r: "Sim. E também no computador, com o mesmo e-mail.",
  },
  {
    p: "Vocês viram meu extrato ou meu salário?",
    r: "Não. A conta usa só o número que você digitou, neste celular. Nada de banco.",
  },
] as const;

export const EMAIL_TITULO = "Pra entrar no app com a conta já paga";
export const EMAIL_SUB = "É com este e-mail que você abre o CORE. Sem senha agora.";
export const CTA_GERAR = "Gerar o Pix de R$ 97,90";
export const EMAIL_PLACEHOLDER = "Seu e-mail";
export const ERRO_EMAIL_VAZIO = "Digite seu e-mail";
export const ERRO_EMAIL_INVALIDO = "Esse e-mail parece errado. Confere e tenta de novo.";

export const URL_QR = "https://coreaplicativo.com.br/baixar?origem=funild";
