

# Plano: Implementar animacao de reflexo (shine) no Detox e Pendencias

## Contexto
Nao encontrei nenhuma animacao de reflexo/shine no codigo atual. O usuario menciona que "era pra ser um reflexo so que fica parecendo so um pisco". Provavelmente foi uma tentativa anterior que nao ficou no codigo ou foi removida.

## Solucao: Criar animacao de shine CSS e aplicar

### 1. Criar keyframe `shine` no `index.css`

Adicionar um keyframe CSS que cria um reflexo branco translucido passando horizontalmente pelo texto/elemento:

```css
@keyframes shine {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.text-shine {
  background: linear-gradient(
    90deg,
    currentColor 0%,
    currentColor 40%,
    hsl(0 0% 100% / 0.8) 50%,
    currentColor 60%,
    currentColor 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shine 3s linear infinite;
}
```

### 2. Aplicar nos locais mencionados

**Detox — Conquistas (DetoxAchievements.tsx)**:
- Aplicar `text-shine` no titulo das conquistas desbloqueadas (ex: "1 Semana", "1 Mes")
- Somente nos milestones ja desbloqueados para dar destaque

**Home — Pendencias (NextHoursTimeline.tsx)**:
- Aplicar `text-shine` no titulo "Pendencias de hoje" para dar um brilho sutil

### 3. Alternativa dark mode
No dark mode, o reflexo branco funciona bem. No light mode, usar um reflexo mais sutil com opacidade menor para nao desaparecer no fundo claro.

## Arquivos alterados (3)

| Arquivo | Mudanca |
|---------|---------|
| `src/index.css` | Adicionar keyframe `shine` e classe `.text-shine` |
| `src/components/detox/DetoxAchievements.tsx` | Classe `text-shine` nos titulos de milestones desbloqueados |
| `src/components/home/NextHoursTimeline.tsx` | Classe `text-shine` no titulo "Pendencias de hoje" |

