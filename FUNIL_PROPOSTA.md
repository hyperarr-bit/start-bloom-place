# Proposta de Funil Web ROI-Positivo — `/funil-c`
## **"O Número do Dia" (Calculadora Instantânea do Teto Diário & Dia do Apagão)**

---

## 1. A Tese: Por que este funil converte tráfego frio na web (e por que é radicalmente diferente dos anteriores)

### Por que os 15+ funis web anteriores e o Quiz de Vazamentos falharam?
1. **Quizzes longos de perfil (`/assinar`, `/comece`, `/assinatura`, `/comecar`)**: Fazem 4 a 8 perguntas abstratas (*"Qual área?"*, *"O que mais te atrapalha?"*, *"Como você se organiza?"*) para entregar uma tela genérica (*"Seu plano de 3 dias está montado"*) que todo lead percebe que é idêntica para qualquer pessoa. Não há revelação financeira real antes do paywall.
2. **Demos abertas sem diagnóstico (`/experimente`, `/liberar`)**: Jogam o lead frio do Instagram direto num app com 16 módulos e dados fictícios da "Ana". No navegador mobile in-app do Instagram, o usuário fica perdido sem saber qual é o ganho imediato para a vida *dele*.
3. **Por que o "Quiz de Vazamentos" (delivery, streaming, Uber, compras por impulso) é a abordagem errada**: Pedir para a pessoa somar gastos de iFood, Uber e Netflix em 5 telas exige esforço de memória, gera **culpa/defesa psicológica** (*"eu não gasto tanto assim"*) e entrega um número que parece "chute de marketing".

### A virada inspirada no caso LicitaCerta (Thallis Ribeiro, ROAS 2,6x)
No LicitaCerta, o lead não responde um questionário sobre os hábitos da empresa: ele faz **um único input que já sabe de cabeça (o CNPJ)** e recebe em segundos **um dado concreto, útil na hora e impossível de ignorar**, criando uma lacuna imediata que só o software resolve todos os dias.

No B2C brasileiro de finanças pessoais, qual é o equivalente exato ao CNPJ — o número que **100% dos adultos sabem de cabeça sem abrir o extrato do banco** e que responde à pergunta mais urgente do dia a dia?

> **A pergunta real de todo brasileiro antes de passar um Pix ou cartão:**
> *"Com o que eu ganho e as contas que eu tenho, **quanto eu posso gastar HOJE** sem faltar dinheiro antes do dia 30?"*

Essa é, literalmente, a funcionalidade número 1 já construída no código do CORE (`computeDailyBudget` em `src/lib/finance-totals.ts` e o card **"Quanto posso gastar hoje"** + **"Previsão Fim do Mês"** em `src/pages/Index.tsx`).

### O mecanismo psicológico da conversão em `/funil-c`:
1. **Esforço Zero na Tela 1 (2 toques, < 8 segundos, zero extrato bancário)**:
   - Toque 1: A faixa de renda mensal líquida (chips rápidos de 1 toque ou ajuste fino).
   - Toque 2: A fatia aproximada que já vai para contas fixas + parcelas do cartão (4 botões visuais com o valor em R$ já calculado ao vivo).
2. **Revelação Imediata e Valiosa na Tela 2 (Valor entregue ANTES de pedir e-mail ou pagamento)**:
   - Usando os **dias reais que faltam para acabar o mês corrente**, a página calcula e exibe na hora:
     - **O Seu Teto Diário Real hoje (`R$ X / dia`)**: Quanto a pessoa pode gastar por dia até o último dia do mês sem entrar no vermelho.
     - **O "Dia do Apagão" do Salário**: Sem um teto diário visível na tela do celular, o ritmo médio da 1ª quinzena (1,6x o limite diário) faz o dinheiro livre **acabar no dia X do mês** (deixando Y dias descobertos no fim do mês).
     - **Simulador Interativo ao Vivo ("Destrave sua Sobra")**: Com 1 toque, o lead alterna entre 3 metas reais no CORE (*Proteger Sobra do Mês*, *Cortar Parcelas de Cartão*, *Montar Reserva 50/30/20*) e vê sua **Sobra Mensal Protegida (`+R$ X/mês`)** e sua **Sobra Acumulada em 12 Meses (`+R$ X.XXX/ano`)**, junto com a prévia real das ferramentas do CORE preenchidas com os números dele.
3. **O "Pulo do Gato" para o Fechamento (Por que pagar R$ 97,90 agora?)**:
   - A calculadora entrega o número de **hoje**, mas todo gasto que a pessoa fizer hoje à tarde, amanhã ou no fim de semana **muda o teto diário dos dias seguintes**.
   - Calcular uma vez no site abre os olhos; **recalcular automaticamente a cada gasto, avisar vencimento de conta antes de atrasar e rastrear cada parcela de cartão** é o que o CORE faz os 365 dias do ano.
   - **Ancoragem matemática imbatível**: O plano anual de **R$ 97,90** custa **R$ 0,27 por dia** — ou seja, **basta seguir o Teto Diário do CORE por 2 dias no ano inteiro** para o aplicativo se pagar sozinho e colocar milhares de reais de volta no bolso do usuário.

---

## 2. Público-Alvo e Segmentação (Meta Ads — Brasil)

- **Perfil demográfico**: Homens e mulheres, **22 a 48 anos**, Brasil, renda mensal entre **R$ 2.000 e R$ 12.000**.
- **Comportamento psicográfico**:
  - Pessoas que **ganham o suficiente para viver**, pagam suas contas, mas chegam entre o **dia 18 e o dia 25 do mês** com a sensação de *"para onde foi o meu salário?"*.
  - Já tentaram planilha ou caderninho e desistiram na 1ª semana porque dá trabalho preencher.
  - Não querem um "curso de investimentos"; querem **um painel simples no celular que diga quanto podem gastar hoje** sem estourar a fatura do próximo mês.
- **Configuração de Campanha na Meta**:
  - **Objetivo**: Conversões (`Purchase` deduplicado Browser + CAPI via `asaas-pix`, `event_id = orderId`).
  - **Posicionamentos**: Instagram Reels, Instagram Stories e Feed mobile (98% do tráfego).
  - **Segmentação**: Advantage+ aberto (Brasil, 22–48 anos), deixando os **3 criativos de gancho numérico** fazerem a filtragem qualificada no clique (regra do Thallis: o criativo filtra o curioso e atrai quem quer ver o próprio número).

---

## 3. Ganchos do Anúncio (3 Criativos — Método Thallis Ribeiro)

Seguindo as 5 regras de ouro do estudo LicitaCerta:
1. Gancho de 3 segundos com número concreto e dor real;
2. Mostrar a ferramenta calculando ao vivo na tela nos primeiros 8 segundos;
3. Falar da transformação imediata ("descubra seu número de hoje em 10 segundos"), não listar dezenas de funções;
4. Filtrar curiosos mostrando que é uma ferramenta prática de organização diária;
5. CTA único espelhando exatamente a Tela 1 da página (`"Toque em Saiba Mais e veja quanto você pode gastar hoje"`).

### Criativo 1 — "A Conta de 10 Segundos (Salário de R$ 3.500 a R$ 6.000)" (UGC / Tela Gravada)
- **Gancho (0–3s)**: *"Se você ganha entre R$ 3.000 e R$ 6.000, sabe exatamente quanto pode gastar HOJE sem faltar dinheiro no dia 25?"*
- **Corpo (3–18s)**: (Mostra o dedo tocando na Tela 1 do `/funil-c`: escolhe `R$ 4.500` de renda e `~55% em contas fixas e cartão`). *"Quase ninguém sabe esse número de cabeça, e é por isso que o salário evapora na segunda semana. Nessa calculadora rápida do CORE, você toca na sua faixa de renda e, sem precisar abrir extrato de banco, ela mostra na hora o seu Teto Diário real até o fim do mês e em que dia seu salário zeraria sem controle."*
- **CTA (18–25s)**: *"Toque em Saiba Mais aqui embaixo e calcule seu limite de hoje em 10 segundos."*

### Criativo 2 — "O Dia do Apagão do Salário (Dia 19 vs. Dia 30)" (Contraste Visual)
- **Gancho (0–3s)**: *"Por que o salário cai no dia 5 e parece que acaba no dia 19? O motivo é matemático."*
- **Corpo (3–18s)**: (Tela dividida mostrando o gráfico do 'Dia do Apagão' na Tela 2 do `/funil-c`). *"Quando você não vê na tela do celular quanto pode gastar por dia, você gasta na primeira semana o que deveria durar o mês inteiro. Olha o que acontece quando você coloca sua renda aqui: ele separa suas contas fixas, suas parcelas de cartão e crava seu limite livre por dia até o dia 30."*
- **CTA (18–25s)**: *"Quer descobrir em que dia o seu mês fecha e quanto dá pra salvar ainda este mês? Toque no botão abaixo e faça o cálculo na hora."*

### Criativo 3 — "Fatura de Cartão + Teto Diário (Para quem vive preso em parcelas)"
- **Gancho (0–3s)**: *"Acha que ganha bem, mas todo mês metade do salário já nasce presa em conta fixa e parcela de cartão?"*
- **Corpo (3–18s)**: (Mostra a simulação interativa do `/funil-c` mudando o teto diário e exibindo a Previsão de Fim de Mês no CORE). *"Planilha nenhuma resolve isso porque ninguém abre Excel na fila do caixa. O CORE calcula sozinho quanto sobra por dia depois das suas contas fixas e parcelas, e reajusta seu limite diário a cada gasto. Faça o teste rápido com 2 toques."*
- **CTA (18–25s)**: *"Toque em Saiba Mais, descubra seu Teto Diário de hoje e veja quanto sobra no seu bolso neste mês."*

---

## 4. Arquitetura e Copy de Cada Tela do Funil (`/funil-c`)

Todas as telas foram desenhadas para viewport mobile-first **`390x844`**, respeitando estritamente a identidade editorial do CORE:
- **Fundo**: `#F7F5F3`
- **Texto principal**: `#262626`
- **Acento da marca**: `#D22D80`
- **Tipografia**: `Inter` (corpo, números tabulares e UI) + `Instrument Serif` em *itálico* (destaques editoriais nos títulos).

---

### TELA 1 — Calculadora Instantânea (Esforço Mínimo · 2 Toques · Sem Extrato)
- **Objetivo**: Fazer o visitante interagir nos primeiros 5 segundos com números que ele já tem na ponta da língua.
- **Header Editorial**:
  - Logo `CORE` + Selo: `CALCULADORA DO MÊS · SEM CADASTRO`
  - Headline (`Inter` + `Instrument Serif` itálico):
    **"Quanto você pode gastar *hoje* sem faltar dinheiro até o fim do mês?"**
  - Subheadline:
    *"Dois toques rápidos — sem abrir extrato nem somar centavos. Descubra na hora seu teto diário real para os próximos **[N] dias de [Mês Atual]** e em que dia seu salário acaba no ritmo atual."*
- **Input 1 — "1. Quanto entra no seu mês (salário/renda líquida)?"**:
  - Valor grande em destaque (`R$ 4.000/mês`) com **6 chips de 1 toque** (`R$ 2.500`, `R$ 3.500`, `R$ 4.500`, `R$ 6.000`, `R$ 8.500`, `R$ 12.000`) + slider suave e campo opcional para quem quiser digitar o valor exato.
- **Input 2 — "2. Quanto já começa o mês preso em contas fixas + parcelas do cartão?"**:
  - 4 cartões táteis que já exibem o valor em Reais calculado em tempo real sobre a renda do passo 1:
    1. **Controlado (~40% · R$ X)** — *"Aluguel/moradia e contas básicas sob controle"*
    2. **Metade do ganho (~55% · R$ X)** — *"Contas da casa + fatura do cartão comem metade"*
    3. **Apertado (~70% · R$ X)** — *"Sobra pouco depois de pagar contas e parcelas"*
    4. **No limite (~82% · R$ X)** — *"O salário cai e quase tudo já tem dono"*
- **Input 3 (1 toque rápido de contexto) — "Onde o dinheiro livre mais escapa sem você ver?"**:
  - 3 pílulas horizontais (já vem com a 1ª pré-selecionada para não travar o fluxo):
    - `Vou gastando no Pix/cartão sem saber o limite do dia`
    - `Parcelas de cartão acumulam de um mês pro outro`
    - `Esqueço vencimentos ou divido contas da casa no olho`
- **CTA Primário (`#262626` com detalhe `#D22D80`)**:
  - **`Calcular meu número de hoje →`**
  - Micro-copy de confiança: *"Cálculo instantâneo na tela · 100% privado"*

---

### TELA 2 — O Resultado Imediato e Valioso ("Seu Mapa do Mês") + Simulador Vivo do CORE
- **Objetivo**: Entregar o choque de clareza personalizado (efeito LicitaCerta) e provar visualmente que o motor do CORE resolve o problema todos os dias.
- **Bloco 1 — O Número do Dia (Card Principal de Alto Impacto)**:
  - Etiqueta: `SEU TETO DIÁRIO REAL · FALTAM [N] DIAS EM [MÊS]`
  - Destaque: **"Hoje você pode gastar até `R$ [Teto]/dia`"**
  - Explicação clara da conta real (`computeDailyBudget`):
    - Renda mensal: `R$ [Renda]`
    - (−) Contas fixas + parcelas reservadas: `- R$ [Comprometido]`
    - (−) Margem de segurança e sobra protegida do mês: `- R$ [Sobra Protegida]`
    - (=) **Saldo livre para os [N] dias restantes do mês**: `R$ [Saldo Livre]` (`R$ [Teto]/dia`)
- **Bloco 2 — O Contraste Visual ("Dia do Apagão" vs. "Mês no Azul com o CORE")**:
  - Barra comparativa do mês (Dia 1 ao Dia 30):
    - 🔴 **Sem limite diário visível (no olho)**: Nos primeiros 12 dias após o salário, quem gasta sem ver o teto diário consome ~1,6x o limite. Resultado: **seu saldo livre zera no dia [Dia do Apagão]** (faltando **[X] dias** para o mês acabar, empurrando você para o cartão ou cheque especial).
    - 🟢 **Com o Teto Diário do CORE**: O app recalcula seu limite a cada gasto e avisa antes de passar do ponto. Resultado: **você chega ao dia 30 no azul e fecha o mês com `+R$ [Sobra Mensal]` protegidos**.
- **Bloco 3 — Simulador Interativo ("Teste seu plano no CORE agora")**:
  - O usuário pode tocar em 3 modos reais do motor do CORE para ver os números mudarem na hora:
    - **`Equilíbrio (Padrão)`** · **`Quitar Fatura Rápido (+50% sobra)`** · **`Modo Econômico (Blindagem)`**
  - E mostra o card de impacto anual:
    - **Sobra protegida neste mês**: `+R$ [Sobra Mensal]`
    - **Acumulado em 12 meses seguindo seu teto**: **`+R$ [Sobra Anual] no seu bolso`**
- **Bloco 4 — Como o CORE mantém esse número vivo no seu celular (Recursos 100% reais do código)**:
  - Mini-preview fiel da tela real de Finanças do CORE (`src/pages/Index.tsx`) já com os números do usuário:
    1. **Card "Quanto posso gastar hoje"**: Recalcula sozinho em tempo real a cada gasto ou Pix registrado em 5 segundos.
    2. **Calendário "Meu Mês" + Alerta de Contas**: Mostra cada dia do mês com bolinhas de vencimento (`✓ paga` / `! vence amanhã`) e permite **dividir contas fixas** (*Você / Meio a meio / Outra pessoa*).
    3. **Rastreador de Parcelas (`k de N`) + "Cabe no Bolso?"**: Soma a fatura por cartão até a última parcela e calcula em quantos meses você compra o que deseja à vista, além de medir seu **Score Financeiro de 0 a 100**.
    4. **+ 15 Módulos da Vida Inteira inclusos**: Rotina, Treino, Dieta, Saúde, Casa, Estudos, Carreira, Hiperfoco, Biblioteca, Beleza, Viagens, Relações, Pet e Detox.
- **CTA da Tela 2**:
  - **`Ativar meu Teto Diário no CORE →`**
  - Subtexto: *"Libere seu painel completo por R$ 0,27/dia (menos de 2 dias da sua sobra)"*

---

### TELA 3 — Oferta de ROI Óbvio + Identificação Rápida (Plano Anual R$ 97,90 · Só Pix)
- **Objetivo**: Transformar a decisão de compra numa conta lógica impossível de recusar e criar a conta (`prepararConta`) no mesmo passo, sem fricção desnecessária.
- **Headline Editorial**:
  **"Proteja *R$ [Sobra Anual]/ano* do seu salário por *R$ 0,27 por dia*."**
- **Card de Comparação de ROI (Ancoragem Direta)**:
  - **O que você destrava em 12 meses com seu teto**: `+R$ [Sobra Anual]`
  - **O que você investe hoje por 1 ano inteiro de CORE**: **`R$ 97,90` (pagamento único no Pix)**
  - Equivalência clara: **R$ 8,16/mês** · **Sem cobrança surpresa no cartão** · **Acesso completo aos 16 módulos por 365 dias**.
- **Checklist enxuto do que libera imediatamente**:
  - ✓ **Seu Teto Diário (`R$ [Teto]/dia`) configurado** com recálculo automático a cada gasto
  - ✓ **Calendário Meu Mês + Lembretes de Vencimento** + Rateio de contas da casa
  - ✓ **Rastreador de Parcelas por Cartão**, Simulador *"Cabe no Bolso?"* e **Score Financeiro (0–100)**
  - ✓ **Todos os 16 módulos do CORE** (Finanças, Rotina, Treino, Dieta, Saúde, Estudos e mais) no app (iPhone/Android) e no navegador
- **Prova Social Verificada (Avaliações reais da App Store / Google Play)**:
  - Depoimentos reais verificados (`Sabryna1610`: *"Tô amando! É realmente um segundo cérebro"*, `Rebeca G.`: *"Substituiu 5 aplicativos que eu usava separados"*).
- **Garantia Incondicional**:
  - Escudo de **7 dias de garantia total**: *"Teste seu painel com seus números reais por 7 dias. Se não gostar, devolvemos 100% do seu Pix."*
- **Formulário Direto de Ativação (Reaproveita `prepararConta`, `entrarComSenha`, `EntrarComCodigo`)**:
  - Apenas **Nome** + **E-mail** (sem pedir CPF, sem pedir senha para contas novas, com suporte automático a contas existentes e verificação de `check-subscription` para não cobrar quem já é assinante).
  - Botão Principal (`#262626`): **`Gerar meu Pix de R$ 97,90`**

---

### TELA 4 — Pagamento Pix na Página (`PixVenda` com `oferta="a97"`)
- **Objetivo**: Maximizar a conversão de QR Gerado → Pix Pago (meta ≥ 35%).
- **Diferencial desta tela no `/funil-c`**:
  - Acima do componente oficial `<PixVenda oferta="a97" />`, exibe um **Banner de Contexto Personalizado** com o número que o usuário acabou de calcular:
    - *"Seu limite de **R$ [Teto]/dia** e sua meta de **+R$ [Sobra Mensal]/mês** já estão prontos para ativação assim que o Pix confirmar."*
  - Renderiza o `<PixVenda>` oficial (Asaas QR estático sem CPF, botão *"Copiar código Pix"* no topo no mobile, passo a passo de 3 linhas, contador de 30 minutos e polling automático a cada 3 segundos + listener de retorno de aba `visibilitychange`).

---

### TELA 5 — Sucesso Pós-Compra (`SucessoVenda` + Handoff Nativo)
- Renderiza o `<SucessoVenda>` oficial do ecossistema:
  - Confirmação imediata do Plano Anual (365 dias), data de vigência, e-mail da conta em destaque;
  - Botão direto para a loja do aparelho (`/baixar?origem=funil_c`) ou QR Code no desktop;
  - No iOS, gera automaticamente o código de 6 dígitos via `porta-handoff` para o botão **"Abrir o CORE"** entrar no app já logado na conta recém-paga.

---

## 5. Mecanismo de Valor Imediato (Resumo Técnico)

| Critério | Quiz Antigo (`/assinar`, `/comece`) | Quiz de Vazamentos (Rejeitado) | **`/funil-c` — O Número do Dia** |
| :--- | :--- | :--- | :--- |
| **O que pede na 1ª tela** | 4 telas de perguntas subjetivas | 5 telas chutando gastos de iFood/Uber | **2 toques rápidos: Renda + % Comprometido** |
| **Precisa olhar extrato?** | Não, mas não calcula nada real | Sim, pra saber quanto gasta em taxas/delivery | **Zero extrato (todo mundo sabe quanto ganha)** |
| **Tempo até o valor** | ~60s para ver um texto genérico | ~45s para ver uma soma de culpa | **< 8 segundos para ver o Teto Diário real** |
| **Conexão com o produto** | Fraca ("Plano de 3 dias") | Indireta ("Corte seus vazamentos") | **Direta: é a função #1 do CORE (`computeDailyBudget`)** |
| **Argumento de preço** | "Assine por R$ 97,90/ano" | "Perca menos dinheiro no ano" | **"Custa R$ 0,27/dia para proteger +R$ X.XXX/ano"** |

---

## 6. Preço, Oferta e Unit Economics

- **Produto**: CORE Anual Completo (Finanças + 15 módulos, acesso no App iOS/Android + Web por 365 dias).
- **Preço**: **R$ 97,90 à vista no Pix** (equivalente a **R$ 8,16/mês** ou **R$ 0,27/dia**).
- **Gateway & Oferta**: Função Supabase `asaas-pix` existente, oferta **`"a97"`** (`PRECOS_CENTAVOS.a97 = 9790`, `CONCESSAO.a97 = { plano: "core-pro", periodo: "annual", dias: 365 }`).
- **Receita Líquida por Venda**: ~**R$ 91,00** (já descontando taxa Asaas e impostos, sem comissão de 15–30% da Apple/Google).
- **Meta de CAC para ROAS 2,0x**: **CAC ≤ R$ 45,50** (mínimo de 1 venda a cada R$ 45,50 investidos; para ROAS 1,3x de validação inicial, CAC ≤ R$ 70,00).

---

## 7. Riscos Mapeados e Mitigações no Protótipo

1. **Risco 1 — Fricção ao digitar salário no celular**:
   - *Mitigação*: A Tela 1 já nasce com chips de 1 toque para as faixas salariais mais comuns do Brasil (`R$ 2.500` a `R$ 12.000`) + slider rápido + opção de digitar. O usuário não precisa abrir o teclado se não quiser; **2 toques resolvem**.
2. **Risco 2 — O usuário achar que já tem a resposta na Tela 2 e sair sem comprar**:
   - *Mitigação*: A Tela 2 entrega o número de **hoje** de verdade (gerando confiança imediata e reciprocidade), mas deixa explícito por que uma conta estática dura só até a próxima compra: *"Hoje seu teto é R$ X/dia. Mas cada Pix ou café que você passa hoje muda o teto de amanhã. No CORE, esse número recalcula sozinho em 5 segundos a cada gasto e avisa antes de vencer qualquer boleto."*
3. **Risco 3 — Queda entre Gerar Pix e Pagar no app do banco (abandono do QR Code)**:
   - *Mitigação*: Mantemos no topo da tela do Pix o resumo personalizado do usuário (*"Ativando seu Teto Diário de R$ X/dia + Previsão de +R$ Y/mês"*), reforçando a recompensa imediatamente acima do botão `"Copiar código Pix"`.
4. **Risco 4 — Tráfego de produção ou revisor da loja acessar a rota experimental**:
   - *Mitigação*: A rota `/funil-c` está envolvida em `<SoNaWeb>` no `src/App.tsx` E possui guarda explícita de hostname: em `coreaplicativo.com.br` e `www.coreaplicativo.com.br`, redireciona imediatamente para `destinoNaLanding(window.location.search)` preservando todas as UTMs/`fbclid`.

---

## 8. Plano de Medição em 3 Dias com ~R$ 750 (R$ 250/dia)

### Estrutura do Teste (3 Dias · R$ 250/dia = R$ 750 total)
- **Campanha CBO / Advantage+ de Conversão (`Purchase`)**:
  - 1 Conjunto de Anúncios (Brasil, 22–48 anos, Mobile Reels/Stories/Feed, atribuído via UTMs + `fbclid` + CAPI `asaas-pix`).
  - Os **3 Criativos** descritos na Seção 3 rodando em paralelo.

### Eventos Rastreáveis no Supabase (`analytics_events`)
O `/funil-c` dispara todos os eventos compatíveis com o funil de venda (`venda_view`, `venda_passo`, `venda_paywall_view`, `venda_plano_click`, `venda_conta`, `venda_pix_qr_view`, `venda_pix_copiado`, `venda_pago`) + metadados da calculadora (`renda_mensal`, `comprometido_pct`, `teto_diario`, `dia_apagao`, `sobra_anual`), além de `ViewContent`, `InitiateCheckout` (via `venda-capi`) e `Purchase` (via `asaas-pix`).

### Metas de Corte por Etapa (Benchmarks de Sobrevivência e Escala)

| Etapa do Funil | Métrica | Meta Saudável (ROAS ≥ 1,8x) | Alerta Amarelo (Ajustar tela) | Corte / Kill (Desligar) |
| :--- | :--- | :--- | :--- | :--- |
| **Anúncio → Página (`venda_view`)** | CTR de Link / CPC | CTR ≥ 1,5% · CPC ≤ R$ 1,20 | CPC entre R$ 1,20 e R$ 1,80 | CPC > R$ 2,00 após R$ 150 |
| **Tela 1 → Tela 2 (`passo: mapa`)** | Taxa de Cálculo (2 toques) | **≥ 65%** dos visitantes | 45% a 64% | < 45% (simplificar Tela 1) |
| **Tela 2 → Tela 3 (`passo: oferta`)** | Clique em "Ativar meu Teto" | **≥ 35%** de quem viu o Mapa | 20% a 34% | < 20% (reforçar contraste na Tela 2) |
| **Tela 3 → Tela 4 (`venda_pix_qr_view`)** | Geração do QR Pix (Nome+Email) | **≥ 25%** de quem abriu a Oferta | 15% a 24% | < 15% |
| **Tela 4 → Pago (`venda_pago`)** | Conversão de Pix Gerado → Pago | **≥ 35%** dos QRs pagos | 25% a 34% | < 25% |
| **Resultado Consolidado (72h / R$ 750)** | **Vendas / CAC / ROAS** | **≥ 12 vendas (CAC ≤ R$ 62 · ROAS ≥ 1,5x)** e evolução p/ **16+ vendas (CAC ≤ R$ 46 · ROAS ≥ 2,0x)** | 8 a 11 vendas (ROAS 1,0x–1,4x) → iterar criativo vencedor | **< 7 vendas após R$ 750 (ROAS < 0,9x) → matar abordagem** |

### Regra de Decisão Dia a Dia:
- **Dia 1 (R$ 250 · ~200–250 cliques)**: Validar se **Tela 1 → Tela 2 passa de 60%** e se geramos pelo menos **10–15 QRs Pix** e **3–4 vendas pagas**. Pausar qualquer criativo com mais de R$ 80 gastos e zero QRs gerados.
- **Dia 2 (R$ 250)**: Concentrar orçamento nos 2 melhores criativos; verificar conversão de QR → Pago (esperado ≥ 33%).
- **Dia 3 (R$ 250)**: Fechar leitura de 72h (incluindo quem pagou o Pix minutos depois ou voltou pelo e-mail). Se ROAS líquido ≥ 1,5x com tendência de queda no CAC para ≤ R$ 46, dobrar orçamento para R$ 500/dia; se ROAS < 1,0x, encerrar experimento.
