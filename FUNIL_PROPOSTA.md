# Funil D — O preço da sua hora

Rota: `/funil-d`. Plano anual, R$ 97,90 uma vez, só Pix, oferta Asaas `a97`. Tráfego frio de Instagram/Meta, Brasil.

Não é o Raio-X do Mês. Não tem quiz, não estima vazamento, não pede extrato. A pessoa digita um número que já sabe — o que cai na conta — e vê a conta da CLT na hora.

## Tese

Os funis web anteriores morriam no mesmo esqueleto: promessa genérica, número de exemplo, vários passos, paywall pra ler e recusar. O LicitaCerta converte porque um identificador que a pessoa já tem (o CNPJ) vira um resultado real antes do preço.

Aqui o identificador é o salário líquido. A conta é fechada, não uma estimativa:

- hora CLT (art. 64) = salário ÷ 220 (44h/semana). Meio período = ÷ 110.
- dia = salário ÷ 30. Fatia igual do calendário. Não é o que sobrou na conta.
- o plano de R$ 97,90 vira minutos dessa hora. Em R$ 3.200: a hora sai R$ 14,55, o dia R$ 106,67, o ano do CORE cabe em 6h 44min e o mês em 34 min.

O preço deixa de ser "mais um app de R$ 97,90" e passa a ser uma fração de uma hora que a pessoa acabou de ver. O app entra depois, com o que ele faz de verdade: teto do dia, limite por categoria, desafio da semana.

## Público

CLT no Brasil, 25–40, que abre o Instagram no intervalo e sente que o salário some sem saber em quê. Não é o público de "organize sua vida em 6 áreas". O anúncio fala de hora barata, a página repete a mesma frase, e o resultado usa o número dela.

Meio período existe na própria tela (um toque). Quem ganha por fora da CLT ainda consegue uma conta útil: é o salário dividido pelas horas do mês, e a copy diz que é a conta da CLT pra 44h — não promete o holerite dela.

## Mecanismo de valor imediato

Um campo. Sem cadastro. Sem banco.

O número fica na aba (`sessionStorage` + memória do módulo). Pro pixel e pro analytics sai só a faixa (`ate_1500`, `1500_3000`, `3000_5000`, `5000_8000`, `8000_mais`). R$ 3.200 cai em `3000_5000`. O salário em si não vai pra Meta, nem pro `user_metadata`.

Opcional, na mesma tela: ela digita um preço (ou toca um exemplo marcado como exemplo, não como gasto dela). R$ 45 numa hora de R$ 14,55 = 3h 6min, 42% de um dia. A âncora do plano só compara com esse preço quando um mês de CORE cabe dentro dele. Um café de R$ 5 não ganha essa frase.

Exemplo travado nos testes, 18/10/2026 (outubro tem 31 dias, dia 18, faltam 14 contando hoje):

| Entrada | Saída |
| --- | --- |
| R$ 3.200, 44h | hora R$ 14,55 · dia R$ 106,67 · cabem R$ 1.493,33 até dia 31 |
| o mesmo, 22h | hora R$ 29,09 |
| plano R$ 97,90 | 6h 44min no ano · 34 min por mês |
| preço R$ 45 | 3h 6min · 42% de um dia · faixa `20_50` |

Limites aceitos: salário R$ 100–R$ 200.000. Preço R$ 1–R$ 100.000.

## Três criativos

Mesmo miolo nos três. Gravação de tela, vertical, com narração curta: digita R$ 3.200, aparece R$ 14,55, digita um preço, aparecem as horas. Dado de exemplo na gravação, conta de verdade. O H1 da página é o mesmo assunto do anúncio.

Campanha de teste separada do criativo que já vende o app. ABO, 1 conjunto por anúncio, otimização Purchase, pixel + CAPI que já existem (`event_id` do pedido no Pix).

1. **Dor com número.** "Seu salário não é pouco. Sua hora é que está barata." Os 3 primeiros segundos mostram o R$ 14,55 em rosa, antes de explicar o app.
2. **Quebra de padrão.** Um cupom (café, iFood) carimbado com horas em vez de reais. "R$ 45 não são R$ 45. São 3 horas suas."
3. **Curiosidade.** "A CLT já calculou quanto vale a sua hora. Você só não fez a divisão." A pessoa digita e a conta aparece.

URL do anúncio (o `fbclid` a Meta acrescenta):

```
/funil-d?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&c_id={{campaign.id}}&as_id={{adset.id}}&ad_id={{ad.id}}
```

Não falar em economia garantida. O anúncio mostra uma divisão, não uma promessa de quanto ela vai guardar.

## Telas

Fundo `#F7F5F3`, texto `#262626`, acento `#D22D80`, Inter + Instrument Serif no número e na promessa. 390×844. O botão fica fixo embaixo e o texto reserva a altura dele, pra hora, a tradução e o card de preço subirem inteiros.

### 1. Entrada

- Selo: "1 número · 10 segundos · sem cadastro"
- H1: "Quanto vale uma hora da sua vida?"
- Serif: "Você digita o que cai na conta. A conta sai na hora."
- "Sem extrato e sem estimativa. É a conta da CLT: salário dividido por 220 horas."
- Campo: "O que cai na sua conta por mês"
- "Jornada de 44h por semana" · link "Trabalho meio período"
- Botão: "Ver o preço da minha hora"
- "Esse número fica neste celular. A gente não pede banco, senha nem extrato."

Salário fora da faixa: "Digite o que cai na conta, em reais. Ex.: 3.200". A pessoa não avança.

### 2. Resultado

- Selo: "Sua hora · CLT · 44h · outubro 2026" (mês real)
- Número grande: "R$ 14,55" / "é o que uma hora sua vale."
- "R$ 3.200 ÷ 220 horas. A conta da CLT pra quem faz 44h por semana."
- Card do dia: "Cada dia do mês tem R$ 106,67" e os dias que faltam, com a ressalva "Não é o que sobrou na conta. É o salário repartido igual pelos 30 dias."
- "O ano do CORE (R$ 97,90) cabe em 6h 44min do seu trabalho. O mês sai por 34 min."
- "Quanto custou a última coisa que você comprou sem pensar?" Campo vazio. Chips: Café R$ 8, iFood R$ 45, Uber R$ 22, Netflix R$ 44,90. Legenda: "Exemplos pra preencher. Não é o seu gasto."
- Tradução, quando há preço: "R$ 45,00 = 3h 6min da sua hora. 42% de um dia seu."
- Botão: "Quero guardar essas horas"

### 3. Plano

- "Um teto pro que a hora compra"
- "A hora você já viu, de graça. O CORE segura o mês com o que você lançar."
- 1. Quanto posso gastar hoje — o painel de Finanças divide o que sobra pelos dias que faltam, contando hoje. (`Dashboard.tsx`)
- 2. Limite por categoria — a pessoa põe o teto; a barra muda de cor e avisa "Limite excedido". Delivery é categoria de verdade. (`CategoryBudgets.tsx`)
- 3. Desafio da semana — semana sem delivery, 3 dias sem gastar, gastar menos que a semana passada. Contas do mês por dia. (`challenges.ts`, `BillsDueCards.tsx`)
- "16 módulos inclusos" — os 5 primeiros ícones reais e "+11".
- Card: "Plano anual" · "R$ 97,90 uma vez · 1 ano de CORE" · "dá R$ 8,16 por mês" · "São 6h 44min do seu trabalho no ano. Por mês, 34 min."
- Se ela traduziu um preço em que o mês cabe: "Um mês de CORE (34 min) cabe dentro desse preço de R$ 45,00 (3h 6min)."
- "7 dias de garantia. Não gostou, devolvemos tudo. Sem renovação automática no Pix."
- Razão social e CNPJ reais, "Pagamento pela Asaas".
- FAQ: não é mensal; iPhone, Android e computador; a gente não viu extrato nem salário.
- Botão: "Pagar R$ 97,90 no Pix" · "O código aparece aqui, sem sair da página."

### 4. E-mail

- "Pra entrar no app com a conta já paga"
- "É com este e-mail que você abre o CORE. Sem senha agora."
- Botão: "Gerar o Pix de R$ 97,90"
- E-mail que já existe não ganha outra conta: pede a senha ou um código. Se já assina, pula o pagamento.

### 5. Pix e pago

O Pix é o `PixVenda` da oferta `a97` (R$ 97,90, 365 dias). QR na página, copia no toque, consulta a cada 3 segundos. `InitiateCheckout` dispara quando o e-mail é aceito, com valor 97,9. Pago: `SucessoVenda`, e no iPhone o código da porta pra abrir o app. Download: `https://coreaplicativo.com.br/baixar?origem=funild`.

## Preço

Fixo. R$ 97,90 uma vez. R$ 8,16 por mês é 97,90 ÷ 12 arredondado pra cima (8,158…), pra não prometer menos do que a divisão dá. Sem downsell. Sem cartão nesta rota.

Líquido web ~R$ 91 (o estudo: R$ 91,05 sem imposto, ~R$ 85 com imposto a confirmar). ROAS bruto 2 pede CAC ≤ ~R$ 49. A régua que vale a pena escalar é CAC ≤ ~R$ 46, perto do líquido depois do imposto. Na Apple o líquido é 82% (R$ 80,30) — esta rota não mexe na loja.

## O que a página não promete

Conferido no código em 18/10/2026. Não há teto automático de delivery, leitura de extrato, Open Finance, nem "sua hora" dentro do app. A hora mora só nesta página. O lembrete diário do limite existe, mas é opt-in e só no app — a copy não promete o push.

## Riscos

- A hora é um reenquadramento, não uma perda concreta como a licitação perdida. Se a pessoa olhar o R$ 14,55 e não sentir nada, o funil não cria desejo. A régua de resultado → Pix pega isso em 3 dias.
- Salário é dado sensível. Fica na aba. Faixa só, daqui pra fora. A copy diz isso antes do campo.
- 220 horas assume 44h. Quem foge disso tem o toque de meio período. PJ e hora extra não têm fórmula própria — a frase deixa claro que é a conta da CLT.
- "7 dias, devolvemos tudo" é a mesma garantia das outras vendas web. O estorno é operação, não está automatizado nesta rota. Sem honrar isso, o anúncio mente.
- Quem paga na web não pode cair no trial da Apple com a mesma conta. Esta rota não muda o app; isso continua sendo checagem de quem opera.
- Meta em financeiro: sem "você vai economizar X". Os exemplos (café, iFood, Uber, Netflix) estão rotulados como exemplo, não como tabela de preço.
- A cerca só desliga `coreaplicativo.com.br` e `www`. Preview da Vercel e localhost mostram o funil. Por isso o PR fica em draft e não entra na main sozinho: no ar de produção, qualquer host que não seja esses dois serviria `/funil-d`.

## Como medir em 3 dias com ~R$ 750

Régua do Thallis, antes de julgar a compra: hook ≥ 30–35%, hold ≥ 8–12%, CTR de link ≥ 2%. Orçamento de teste = 50% do preço ≈ R$ 49 por criativo por dia, por 3 dias.

Rodada: campanha ABO "WEB | HORA | TESTE", 3 conjuntos, 1 anúncio cada, R$ 49/dia, 3 dias = **R$ 441**. Os R$ 309 que sobram no envelope trocam o criativo cujo hook morrer no dia 1 (mesma verba, gancho novo, miolo igual) ou sobem dois ângulos reserva se os três passarem a régua de vídeo e o CTR. Não mistura com a campanha que já vende o app.

Verdade da compra: Supabase, `venda_pago` com oferta `a97` e `funil: d`. A Meta otimiza Purchase pelo pixel + CAPI atuais. Os eventos da página (`funild_view`, `funild_salario` com faixa, `funild_passo`, `funild_traduziu` com faixa de preço, `funild_pagar_click`, `funild_email`, `funild_conta`) servem pra achar onde quebrou. Nenhum deles carrega o salário.

Cortes, olhando o Supabase e não o gerenciador:

- Visita → salário digitado abaixo de 35% com ~400 visitas: a página não pagou a promessa do anúncio. Troca o H1 ou o criativo, não o preço.
- Visita → resultado abaixo de 15% depois de ~400 visitas: gancho ou primeira tela. Para esse criativo.
- Resultado → clique de Pix abaixo de 8% com ~200 resultados: o número não criou desejo. O conceito perde, não se "conserta" com mais passo.
- CAC acima de R$ 91 depois de ~R$ 700 gastos: para. Não escala.
- CAC ≤ ~R$ 46 com a régua de hook/hold/CTR batida: aí sim sobe pra uma CBO, separado do teste.

Um Pix pago por dia, três dias, com lucro, é a validação. Menos que isso com a verba gasta até o fim é um não.
