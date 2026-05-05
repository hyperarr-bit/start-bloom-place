## Causa do flash bege

Ao navegar para `/inicio`:
1. `AnimatePresence mode="wait"` em `src/App.tsx` aguarda a página anterior terminar a animação de exit do `PageTransition` (~250–300ms).
2. Durante essa espera, nada está montado no slot da rota — só aparece o `bg-background` (bege) do body.
3. Quando o exit termina, o `WelcomeScreen` monta instantaneamente, dando a sensação de "tela bege e depois volta ao normal".

Fatores secundários que pioram:
- O poster `/videos/app-preview-poster.jpg` não está pré-carregado, então o mockup também aparece em branco por mais alguns ms.

## Plano

### 1. Tirar `/inicio` (e `/auth`) do `AnimatePresence` em `src/App.tsx`
Renderizar essas rotas públicas fora do `AnimatedRoutes`, em um bloco de `<Routes>` separado, sem `AnimatePresence`. Assim não há espera de exit nem flash.

Estrutura nova:
```text
<BrowserRouter>
  <Routes>
    <Route path="/inicio" element={<Inicio />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="*" element={<AnimatedRoutes />} />  // resto continua animando
  </Routes>
</BrowserRouter>
```

### 2. Preload do poster do mockup
Em `index.html`, adicionar:
```html
<link rel="preload" as="image" href="/videos/app-preview-poster.jpg" />
```
Garante que o mockup já apareça pintado na primeira frame.

### 3. Pintar o background imediatamente
No `WelcomeScreen.tsx`, manter `bg-background` mas garantir que o container raiz não dependa de nenhum estado assíncrono para renderizar (já está ok — só confirmar que nenhum `useEffect` esconde conteúdo).

## Arquivos afetados
- `src/App.tsx` — separar rotas públicas do `AnimatePresence`
- `index.html` — adicionar preload do poster

Sem mudanças visuais — apenas remove o flash de transição.