## Plano: Gerar templates HTML de e-mail para o Supabase

### Contexto

O usuário quer templates HTML bonitos para colocar no painel do Supabase (Authentication → Email Templates), seguindo a identidade visual do app CORE: fonte Inter, estilo minimalista, cores neutras.

### O que será gerado

Um script Python que cria 4 arquivos HTML em `/mnt/documents/`:

1. **confirm-signup.html** — Confirmação de cadastro
2. **reset-password.html** — Redefinição de senha
3. **magic-link.html** — Link mágico de login
4. **change-email.html** — Confirmação de troca de e-mail
5. Trocar senha 

### Estilo dos templates

- Fundo branco, container