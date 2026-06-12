## Diagnóstico (testei agora, com prova)

Abri **o site publicado** (`coreaplicativo.lovable.app/lp`) num iPhone 13 simulado real e tirei screenshots:

- ✅ Hero (3 iPhones) carrega
- ✅ Vídeo de Finanças toca (vi o frame com tabela de despesas)
- ✅ Vídeo de Rotina toca (vi 2 frames diferentes — calendário e rotina semanal — confirmando que tá rodando)
- ✅ Os 3 depoimentos (Marina, Pedro, Júlia) aparecem com foto
- ✅ Todos os arquivos no CDN respondem `200`, com `accept-ranges: bytes` (essencial pro Safari) e `cache-control: immutable`

**O site no ar tá correto.** O que você vê quebrado é o **navegador servindo a versão antiga do cache** — provavelmente um service worker que ficou registrado de uma versão passada do app (PWA "Roda sem instalar") e está interceptando as requisições e servindo arquivos velhos.

Por isso "só funciona no preview": o preview é um domínio diferente (`id-preview--...lovable.app`), não tem service worker antigo. Já `coreaplicativo.lovable.app` tem visitantes que abriram o site antes, registraram o SW antigo, e ele continua servindo HTML/JS velho mesmo depois do republish.

## O que vou fazer

Adicionar um **service worker "kill-switch"** que se desregistra sozinho e limpa caches velhos. Quem visitar o site uma vez vai ter o navegador auto-curado, e visitas futuras passam a buscar sempre a versão nova.

### Passos

1. **Criar `public/sw.js`** — service worker mínimo que, na ativação:
   - apaga todos os caches do próprio scope
   - força `clients.claim()` e recarrega a aba
   - `self.registration.unregister()` no `finally`

2. **Atualizar `src/main.tsx`** — em produção (não só preview), sempre rodar `getRegistrations().then(r => r.forEach(x => x.unregister()))` + `caches.keys().then(k => k.forEach(caches.delete))` no boot. Isso garante que qualquer SW antigo é morto na primeira visita pós-deploy, mesmo que nunca registremos o `sw.js` novo.

3. **Não registrar** nenhum service worker novo (você não pediu offline). O `sw.js` só existe pra ser servido como kill-switch caso o navegador ainda peça por ele.

### O que NÃO vou mexer

- Nada de design, copy, layout, vídeos, fotos — todos já estão funcionando, comprovado por screenshot.
- Nada nas tags `<video>` ou `<img>` — o código está correto.

### Como testar depois que eu fizer

1. Republicar.
2. No seu celular, abrir o site normalmente (sem modo anônimo). Vai parecer ainda quebrado **na primeira visita** — mas o kill-switch roda em background.
3. Fechar a aba completamente e abrir de novo. Agora vai funcionar tudo.
4. Como atalho pra confirmar AGORA que é cache: abre o site em **aba anônima/privada** do Safari/Chrome — vai funcionar de primeira, porque aba anônima não tem cache nem SW.

## Arquivos alterados

- `public/sw.js` (novo)
- `src/main.tsx` (mudar guarda do unregister)
