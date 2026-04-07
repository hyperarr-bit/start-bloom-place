
# Plano: Adicionar dados pre-preenchidos na aba Seguranca

## Mudanca

Alterar os defaults vazios `[]` em `SafetyChecks.tsx` para incluir os itens mostrados nas screenshots:

**Checklist de Seguranca (travelChecklist):**
1. Desligar gas
2. Tirar lixo da pia
3. Desligar eletronicos da tomada
4. Trancar janelas
5. Conferir torneiras
6. Pedir para alguem regar plantas

**Estoque de Emergencia (emergencyStock):**
1. Velas
2. Pilhas AA/AAA
3. Lanterna
4. Kit Primeiros Socorros
5. Agua mineral (reserva)
6. Fosforos/Isqueiro

## Arquivo alterado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/casa/SafetyChecks.tsx` | Trocar defaults `[]` pelos arrays com os itens acima |
