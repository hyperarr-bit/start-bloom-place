## Problema

No `/inicio`:
1. O vídeo do mockup do iPhone não inicia automaticamente.
2. Quando o autoplay é bloqueado (Safari/iOS, Low Power Mode), nenhum botão de play aparece — o usuário fica preso no poster estático.

Causa: na última iteração eu forcei `showLoader = false` e removi o overlay de play button do JSX. Restou apenas o `<img>` do poster. Mesmo quando `videoState === "blocked"`, não há UI para o usuário disparar o play manualmente. Além disso, o `onClick` no container raiz pode não estar disparando o `play()` em alguns navegadores porque o `<video>` tem `pointer-events-none` e o clique no poster acaba sendo absorvido sem gesto "direto" no elemento de vídeo.

## Plano

Editar apenas `src/components/WelcomeScreen.tsx`:

1. **Re-adicionar overlay de Play button** sobre a tela do iPhone quando `videoState === "blocked"` ou `"error"`:
   - Botão circular semi-transparente centralizado com ícone `Play` do `lucide-react`.
   - `onClick` chama `attemptPlay()` e `stopPropagation`.
   - Aparece imediatamente, sem animação (estático, conforme preferência do usuário).

2. **Garantir gesto de play no primeiro toque**:
   - Manter listeners globais `touchstart`/`click` que já existem.
   - Adicionar `onClick` direto no container do iPhone (sem `pointer-events-none` no poster `<img>`) chamando `attemptPlay()`.

3. **Forçar tentativa de play imediata no mount**:
   - Chamar `attemptPlay()` uma vez logo após o mount (antes de esperar `canplay`), pois com `preload="auto"` + `<source>` já presente, em muitos browsers o vídeo já está pronto.
   - Manter o watchdog de 1.5s.

4. **Indicador sutil de "carregando"** (opcional, leve): se quiser, pequeno spinner só quando `videoState === "loading"` por mais de ~800ms. Posso pular se preferir 100% estático — recomendo pular para manter a regra "sem animação".

## Detalhes Técnicos

```tsx
// Snippet conceitual dentro de .iphone-screen
<video ref={videoRef} ... className="absolute inset-0 w-full h-full object-cover" />
<img src="/videos/app-preview-poster.jpg" alt=""
     className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
       isPosterVisible ? "opacity-100" : "opacity-0"
     }`} />
{showPlayButton && (
  <button
    onClick={handleManualPlay}
    aria-label="Reproduzir vídeo"
    className="absolute inset-0 flex items-center justify-center bg-black/20"
  >
    <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
      <Play className="w-7 h-7 text-black ml-0.5" fill="currentColor" />
    </span>
  </button>
)}
```

- Remover `pointer-events-none` do `<video>` para que o clique direto sobre ele conte como gesto do usuário.
- Re-importar `Play` de `lucide-react`.

## Arquivos modificados

- `src/components/WelcomeScreen.tsx`

Sem alterações em rotas, CSS global ou outros componentes.