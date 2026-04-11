

## Plano: Coletar nome, email e CPF antes de gerar o PIX

### O que muda
Após clicar em "Pagar com PIX", antes de chamar a edge function, aparece um formulário pedindo:
- **Nome completo**
- **Email** (pré-preenchido com o email do auth)
- **CPF** (com máscara XXX.XXX.XXX-XX e validação)

Só após preencher e validar, o PIX é gerado.

### Alterações

**1. `src/pages/Planos.tsx`**
- Adicionar estado `showForm` e campos `name`, `email`, `cpf`
- Ao clicar "Pagar com PIX", mostrar o formulário (nova tela animada entre plano e QR code)
- Pré-preencher email com `user.email` e nome com `displayName` se disponível
- Máscara de CPF no input (formato XXX.XXX.XXX-XX)
- Validação: nome não vazio, email válido, CPF com 11 dígitos
- Ao confirmar, enviar `name`, `email`, `cpf` junto com `billing` para a edge function

**2. `supabase/functions/abacatepay-pix/index.ts`**
- Receber `name`, `email`, `cpf` do body
- Salvar no `profiles` do usuário (display_name, tax_id) via supabaseAdmin
- Passar esses dados para a API da AbacatePay se o endpoint aceitar (metadata/customer)

**3. Salvar no perfil**
- Atualizar `profiles.display_name` e `profiles.tax_id` com os dados informados

### Fluxo
```text
Plano → "Pagar com PIX" → Formulário (nome/email/cpf) → "Confirmar" → QR Code PIX
```

