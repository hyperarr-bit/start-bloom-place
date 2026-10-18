# FUNIL E — "SOMA-ASSINATURAS" (`/funil-e`)

> Proposta + protótipo do funil web ROI-positivo para o plano anual de R$ 97,90 (Pix Asaas `a97`).
> Branch `cursor/funil-e-soma-assinaturas-4e44` · 18/10/2026 · tráfego frio Instagram/Meta, Brasil.

**Resumo em 5 linhas**
1. A landing **JÁ É a ferramenta**: a pessoa toca nas assinaturas que paga (Netflix, Spotify…) e vê o **total EXATO** na hora, com os preços públicos de hoje — sem digitar valor, sem extrato, sem cadastro.
2. É o "CNPJ do LicitaCerta" das finanças pessoais: dado real da pessoa (a seleção dela × preços reais) **antes** do preço, e não estimativa por faixa nem quiz — a causa nº 2 do post-mortem ("valor de mentira") morre aqui.
3. A segunda pergunta — *"qual delas você NÃO usou no último mês?"* — transforma o número em **economia acionável** e entrega uma **lista de cancelamento** (artefato que ela guarda/recebe por e-mail) antes de qualquer pedido de dinheiro.
4. O preço (R$ 97,90/ano, Pix na página) entra **ancorado no número dela**: *"Cancelar a Netflix que você nem usou já paga 5,5 anos de CORE."*
5. O rabo (dados → Pix → sucesso) é **byte a byte o da `/assinar`** (Asaas `a97`, conta nasce no pagamento): zero lógica de dinheiro nova, zero risco de cobrança errada.

---

## 1. A tese — por que este converte onde os outros 15 falharam

O post-mortem (`ESTUDO_PROFUNDO_V2`) lista 5 causas de morte. Este funil foi desenhado causa por causa:

| # | Causa de morte | Como o Soma-Assinaturas mata |
|---|---|---|
| 1 | Esforço do lead (extrato, cadastro, digitação) | **Zero digitação até o e-mail.** Tocar em logos é a interação mais barata que existe — menos que digitar um CNPJ. Nada de banco, OFX ou senha (o FAQ responde isso na lata). |
| 2 | **Valor de mentira** (estimativa por faixa, demo com dados de exemplo) | O número é **conta exata** sobre a seleção dela: serviço × preço público de hoje. Não existe "estimamos que você gasta R$500+". É o mecanismo do LicitaCerta (2,6× ROAS): *dado real da pessoa antes do preço*. |
| 3 | Resultado adiado/abstrato | Resultado em **~15 segundos e 3 toques**, na primeira dobra, com o total vivo subindo a cada toque (dopamina de caixa registradora). |
| 4 | Preço contra valor percebido | A âncora é **o número dela**: o total por mês × o preço por ano, ou a assinatura não-usada que sozinha paga N anos de CORE. R$ 97,90 deixa de ser "caro" ao lado de R$ 347/mês. |
| 5 | Promessa que o app não cumpre | Os 3 bullets do preço foram **verificados no código** (contas a vencer com aviso na véspera, teto por categoria, desafio da semana). Nada de "o app lê seu extrato sozinho". |

Bônus estrutural: o criativo **é a gravação da própria ferramenta** (como o LicitaCerta filma o CNPJ→resultado). Anúncio e landing são a mesma experiência — zero quebra de expectativa no clique, que é onde o tráfego frio morre.

**Por que não é o quiz do `BRIEF_CLAUDE_FUNIL_WEB_V2` (rejeitado):** lá a pessoa respondia 5 perguntas pra receber uma *estimativa* do vazamento — esforço antes de valor, número inventado depois. Aqui não existe pergunta: existe uma **calculadora pública** cujo resultado pertence a ela.

## 2. Público

- **Quem:** 22–38 anos, Brasil, iPhone/Android, assinante de ≥2 streamings; já sentiu "o salário sumiu" mas nunca somou as assinaturas. Interesses: Netflix/Spotify/HBO, finanças pessoais, organização, "meu bolso é um ralo".
- **Temperatura:** fria, scroll de Reels/Stories. O gancho precisa criar a dor em <2 s ("você paga e nem lembra").
- **Por que qualifica sozinho:** quem marca 4+ serviços e toca em "ver quanto dá no ano" já declarou, com atos, que paga R$150+/mês em assinaturas — o ARPU potencial dela é alto e a dor é real. Quem não paga nada tem saída própria ("Não pago nenhuma assinatura") e recebe outra conversa (vazamento no dia a dia).
- **Placements:** Reels + Stories, Advantage+; otimização pra **Purchase** (caixa D0, sem esperar coorte) com Lead como evento auxiliar de remarketing.

## 3. Gancho do anúncio — 3 criativos (mesmo miolo, 3 ganchos)

Os três são **gravação de tela da ferramenta** (390×844, dedo tocando). O miolo é idêntico: toca 5–6 serviços → total vivo subindo → número grande → "toca nas que você não usou" → economia verde → CTA. Muda só o gancho dos primeiros 2 segundos:

1. **Dor visceral — "Some R$400 do salário".**
   Texto na tela: *"Todo mês some R$400 do meu salário e eu não sabia pra onde"*. Dedos tocam Netflix, Max, ChatGPT, iCloud, PS Plus → **R$ 274,58/mês → R$ 3.294,96/ano**. Fecha com: *"Faz a sua conta, de graça: coreaplicativo.com.br"*.
2. **Curiosidade — "9 em 10 erram pra menos".**
   Texto: *"Perguntei pra 10 pessoas quanto elas pagam de assinatura. 9 erraram pra menos."* Corta pra gravação: a pessoa chuta "uns R$150?" e a soma real passa de R$300. Gancho comentável (as pessoas marcam os amigos).
3. **Quebra de padrão — "eu pagava 6 e lembrava de 3".**
   UGC de rosto + tela: *"Eu achava que pagava 3 assinaturas. Eram 6. E 2 eu nem abria."* A gravação mostra a lista de cancelamento sendo montada. Termina na economia verde: *"cancelei 2 na hora: R$ 958,80 por ano de volta"*.

Legenda (os 3): *"Some as suas em 20 segundos, sem cadastro: link na bio. Quem fecha 1 vazamento já paga anos de CORE."* — CTA para o domínio de **preview** (o funil não abre no domínio de produção, ver §7).

## 4. As telas, com a copy

**T1 · A ferramenta (`/funil-e`)** — a dobra é o produto.
Selo: *"Grátis · sem cadastro · 20 segundos"* · H1: **"Quanto as suas assinaturas comem do seu mês?"** · Sub: *"Toque nas que você paga. O total sai na hora, com os preços de hoje."* · Trava: *"Nada sai do seu celular. A conta é feita aqui mesmo."*
Grade 2×N de 16 serviços (Netflix 44,90 · Spotify 21,90 · YouTube Premium 24,90 · Prime 19,90 · Disney+ 43,90 · Max 29,90 · Globoplay 24,90 · Apple TV+ 24,90 · iCloud 3,90 · ChatGPT Plus 100 · Canva Pro 54,90 · Crunchyroll 19,99 · Game Pass 44,99 · PS Plus 34,90 · Deezer 21,90 · Paramount+ 19,90) + chips "Outra" (9,90 a 99,90, para academia/app menor). **Total vivo** fixo no rodapé (Instrument Serif itálico, acento) + CTA *"Ver quanto dá no ano"* (só habilita com ≥1 seleção). Link: *"Não pago nenhuma assinatura"*.

**T2 · O resultado.** Selo: *"Seu somatório · out/2026 · preços de hoje"* → número grande **R$ XXX/mês** + *"por mês saem do seu bolso, sem você pedir"* + *"No ano, são R$ X.XXX — dá pra <equivalência: 2 meses de mercado / um celular novo / uma viagem em família>"*. **Cupom** itemizado (o que ela mesma montou, com o plano de cada preço). Pergunta: **"Qual delas você NÃO usou no último mês? Toque em cima."** → ao marcar: bloco verde *"Cancelando essas, voltam R$ XX/mês — R$ XXX por ano"* + **Lista de cancelamento** (com a dica de cancelar em 2 min no app do serviço e captura opcional de e-mail pra receber a lista). Nota de honestidade: *"Preços públicos dos planos mais comuns. O seu pode ser outro — e é justamente isso que o CORE te ajuda a ver."* CTA: *"Quero que pare de vazar"*.

**T3 · O preço.** Título: *"Pare de pagar o que não usa"* · promessa (serif itálico): *"O CORE é o app que vigia o seu dinheiro — e te avisa antes de vazar."* 3 passos verificados no código: **1.** contas a vencer com aviso **na véspera** · **2.** teto de gasto por categoria · **3.** desafio da semana ("Semana sem delivery"). Chips: *"16 módulos inclusos: Finanças · Rotina · Treino · Dieta · Metas +11"*. Card: **R$ 97,90** *uma vez · 1 ano de CORE · dá R$ 8,16/mês* + **âncora personalizada** (ver §6) + CTA *"Pagar R$ 97,90 no Pix"* (*"o código aparece aqui, sem sair da página"*) + cartão em até 12× (Cakto, se o link estiver configurado) + garantia de 7 dias + CNPJ + FAQ ("É mensal?" / "Funciona no iPhone e Android?" / **"Preciso conectar meu banco ou mandar extrato?" — "Não."**).

**Rabo (idêntico ao `/assinar`):** dados (nome + e-mail — e-mail já vem preenchido se ela pediu a lista) → **Pix na página** (QR + copia-e-cola, confirmação a cada 3 s) ou Cakto → sucesso (loja do aparelho + "entre com este e-mail" + "Abrir o CORE" com código no iPhone). Conta nasce no pagamento, nunca 2ª conta, já assinante não paga de novo — tudo herdado, nada reescrito.

## 5. Mecanismo de valor imediato

**O valor é a própria página, antes de qualquer pedido.** Três camadas, todas < 30 s:
1. **O número real dela** (seleção × preço público) — responde a pergunta que ela nunca soube responder ("quanto eu gasto de assinatura?").
2. **A economia acionável** ("cancela essas 2 → R$ 538,80/ano de volta") — transforma descoberta em decisão.
3. **A lista de cancelamento** — artefato concreto que ela leva (print ou e-mail) mesmo se nunca pagar: é a prova de boa-fé que sustenta a promessa do preço na tela seguinte.

Regra de ouro do rastreio (igual à do raio-x): **o Meta nunca vê os valores do somatório** — ViewContent e Lead sem valor, InitiateCheckout/Purchase com R$ 97,90 fixo. Os totais vão só para o nosso analytics (`funile_resultado` com faixa, não valor), para a régua do conceito.

## 6. Preço/oferta

- **Oferta única:** plano anual **R$ 97,90**, pagamento único. Pix na página (Asaas oferta `a97` = 9.790 centavos, 365 dias, `core-pro/annual`) ou cartão em até 12× na Cakto (mesma oferta do `/assinar`; depende de `VITE_VENDA_CAKTO_ANUAL` na Vercel).
- **Âncora personalizada** (nesta ordem):
  1. Marcou "não usei" e a mais cara cobre ≥1 ano: *"Cancelar a Netflix que você nem usou já paga 5,5 anos de CORE."*
  2. Total/mês ≥ R$ 97,90: *"Você paga R$ 347 por MÊS em assinaturas. O CORE é R$ 97,90 por ANO."*
  3. Senão, a linha "dá R$ 8,16/mês" trabalha sozinha (nunca inventar âncora fraca).
- **Garantia:** 7 dias, devolução total; sem renovação automática no Pix (objeção nº 1 de quem já foi queimado por assinatura — e o tema do funil).
- **Economia da conta:** líquido web ≈ R$ 91 (Pix, sem taxa de loja) → CAC de empate R$ 85–91; **CAC-alvo ≤ R$ 46** para ROAS líquido 2 (baseline do app em 13/10: CPP R$ 49,51 / ROAS líq 1,59 — este funil precisa bater isso para escalar).

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| **Preço de serviço desatualizado** (Netflix reajusta) → quebra de confiança ou âncora errada | Tabela única em `conteudo.ts` com data da foto (18/10/2026) e instrução de revisão; a nota "o seu pode ser outro" na T2 absorve divergência de plano. Revisar antes de ligar e a cada reajuste público. |
| **"É só pra assinatura"** (o app é 16 módulos) | A dor da assinatura é o *gancho*, não o produto: T3 abre com "vigia o seu dinheiro" + chips dos 16 módulos + os 3 passos são de finanças do dia a dia (não de streaming). |
| **Política da Meta (finanças pessoais)** | Nunca promessa de renda/economia garantida no criativo; número sempre "da sua conta, com preços públicos"; sem antes/depois de pessoa; pixel sem valores do somatório (§5). |
| **ARPU piso** (quem marca 1 serviço de R$3,90 tem dor fraca) | A âncora desliga sozinha em total baixo; a régua de medição lê conversão por **faixa** (`funile_resultado.faixa`) — se "ate_100" dominar e não converter, o criativo está atraindo o público errado. |
| **Seleção inventada** (a pessoa marca serviços que não paga, por curiosidade) | O número é dela por construção; o funil não promete "lê seu banco". A conversão do QR→pago (baseline 55,7% no Kenny G) é a prova: quem chega ao Pix com número inventado não paga. |
| **Instagram in-app zera storage** | Estado no heap + localStorage + atribuição anti-zerada da Porta (já provada); volta da Cakto reconstrói pelo `?pago=cartao`. |
| **Domínio de produção** | A rota só existe fora de `coreaplicativo.com.br` (a própria página redireciona para "/" preservando utm/fbclid). **A campanha deve apontar para o domínio de preview da Vercel.** noindex. |

## 8. Medição em 3 dias com ~R$750

**Setup:** campanha ABO, 1 campanha × 3 conjuntos (1 por criativo do §3) × R$ 82/dia ≈ **R$ 738 em 3 dias**. Público amplo 22–38 BR + interesses de streaming; otimização Purchase; URL = preview da Vercel com utm por criativo. Verdade = eventos `funile_*` no Supabase + `Purchase` (CAPI Asaas, `event_id` = id do QR) — nunca o relatório da Meta sozinho.

**Régua por dia:**
- **Dia 1 (criativo):** mata gancho com **hold < 30%** (3s/impressão) ou **CTR < 1%**; realoca verba no vencedor.
- **Dia 2 (página):** mata conjunto com ≥60 visitas e **0 `funile_resultado`** (a ferramenta não engata) ou **CPC > R$ 1,50**.
- **Dia 3 (conceito):** promove a iteração (novos serviços na grade, teste de H1) se o conjunto vencedor tiver **hold ≥ 35% + CTR ≥ 2% + ≥1 venda**; pausa tudo se **CAC > R$ 91 após R$ 700** (nem o empate) ou **visita→resultado < 20% em 600 visitas** (o mecanismo não funciona — mata o conceito, não ajusta copy).

**Metas do funil (baseline Kenny G como piso):** visita→1º toque ≥ 55% · visita→resultado ≥ 35% (vs 33,9% do quiz) · resultado→preço ≥ 45% · preço→QR ≥ 20% (vs 29% do paywall→QR; aqui há 1 tela a menos de fricção) · QR→pago ≥ 45% (vs 55,7%) → sessão→pago ≈ 1,4%+ já cobre o CAC-alvo com folga a CPC ≤ R$ 0,70.

**Leituras secundárias (já instrumentadas):** `funile_toque` por serviço (o que o Brasil paga), `funile_nao_usada` (o que o Brasil não usa — insumo de produto/copy), `funile_economia` (tamanho da dor resgatável), faixa do somatório × conversão (qualificação do público), `funile_email` (lista → recuperação).

**Pendências operacionais (não bloqueiam o protótipo):** confirmar preços da grade na semana do voo; `VITE_VENDA_CAKTO_ANUAL` na Vercel do preview (sem ele o cartão some por desenho); secrets Asaas/Meta já existem nas funções; e-mail da lista hoje é captura client-side (envio servidor-side fica para a iteração 2); Lead hoje é só pixel client-side (CAPI server-side com `event_id` de dedup entra na iteração 2 — Purchase já é CAPI via Asaas); o app ler `funile_meta` exige build de loja (não necessário para medir venda).

---

### Apêndice — o que está no protótipo (branch `cursor/funil-e-soma-assinaturas-4e44`)

- `src/pages/funil-e/` — `conteudo.ts` (copy + tabela de preços), `somatorio.ts` (matemática pura, 16 testes), `telas.tsx` (T1/T2/T3, mobile-first 390×844, tokens da marca), `FunilE.tsx` (máquina de estados + gate de domínio + rabo reusado da venda), `rastreio.ts` (eventos `funile_*`, Lead só no pixel, sessão própria).
- `src/test/funil-e.test.tsx` — 22 testes: gate de domínio, conta exata, economia, âncoras, e-mail, Pix a97 ponta a ponta, Cakto, já-assinante, regras (clipboard proibida, sem segredos, Meta sem somatório).
- Reuso integral: `PixVenda`/`DadosVenda`/`CartaoVenda`/`SucessoVenda`/`conta.ts`/`rastreio.ts` (venda) + atribuição da Porta. `/raio-x`, `/assinar`, `/comece`, `/assinatura`, `/liberar`, `/experimente` e o app: **intocados** (guardado por teste).
