## Causa do bug

No `index.html` existe um `<style>` inline que pinta `html, body, #root` antes do React carregar:

```text
html, body, #root { color: #1a1a1a; }   /* preto fixo */

@media (prefers-color-scheme: dark) {
  html.dark, html.dark body, html.dark #root { color: #f2f2f2; }
}
```

A regra escura está condicionada a `prefers-color-scheme: dark`, ou seja, só vale se o **sistema operacional** está em modo escuro. Se o Android está com tema claro do sistema e o usuário escolheu tema escuro só dentro do app, a media query não dispara — o `color: #1a1a1a` continua aplicado e todos os textos que herdam cor ficam pretos em cima de fundo preto.

No iPhone do usuário, o sistema está em escuro, então a media query ativa e a cor herda branco — por isso "funciona no iPhone".

Os textos que ainda aparecem no Android usam classes Tailwind com cor explícita (`text-muted-foreground`, `text-warning`, etc.), por isso sobrescrevem o preto. Os que somem (saudação "Olá, JO", "Vamos lá!", número do score, iniciais "JO") herdam cor do `<html>`.

## Correção

Remover a dependência de `prefers-color-scheme` no fallback do `index.html`: aplicar a cor escura sempre que a classe `.dark` estiver presente no `<html>`, independente da preferência do sistema.

Trocar o bloco para:

```text
html, body, #root { background-color: #ffffff; color: #1a1a1a; }
html.dark, html.dark body, html.dark #root { background-color: #0f1115; color: #f2f2f2; }
```

Sem `@media`. Isso garante que, quando o app marca `html.dark`, o texto base já nasce claro mesmo no Android com sistema em modo claro.

## Validação

Depois do fix, conferir no Android (modo claro do sistema + tema escuro no app) que: saudação, "Vamos lá!", número do score, iniciais do avatar e demais textos herdados aparecem em branco.