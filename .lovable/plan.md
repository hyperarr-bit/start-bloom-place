## Card "MÓDULO ROTINA" da landing page

### 1. Trocar o mockup pelo vídeo enviado
Hoje (linhas 801-805 de `src/pages/lp/LandingPage.tsx`) o card usa `<PhoneFrame><RoutinePhone /></PhoneFrame>` — um mockup desenhado em React que não mostra o app de verdade.

Substituir pela mesma estrutura usada no card de Finanças (linhas 781-794):
- Subir o `Cópia_de_Design_sem_nome.mp4` enviado como asset via `lovable-assets` → `src/assets/rotina-preview.mp4.asset.json`.
- Importar e renderizar com `<video autoPlay muted loop playsInline preload="auto" controls={false} className="w-full h-auto rounded-[2rem]" />` dentro de um wrapper `max-w-[320px]`.
- `RoutinePhone` segue existindo no arquivo; só não é mais usado nesse card (não vou removê-lo pra não mexer em nada fora do escopo).

### 2. Melhorar a copy do card
A frase "Heatmap visual de consistência (estilo GitHub)" sai. Novos textos focados nas vantagens reais do módulo (hábitos, semana, streaks, visão mensal, check rápido):

- **H2:** "Construa hábitos que ficam — sem depender de motivação."
- **Subtítulo:** "Marque seus hábitos em segundos, acompanhe sua semana inteira e veja seu progresso virar rotina de verdade."
- **Bullets (4):**
  1. "Check rápido dos hábitos do dia, sem fricção"
  2. "Visão semanal pra enxergar onde você travou"
  3. "Streaks que mostram sua sequência crescendo"
  4. "Calendário mensal pra acompanhar a evolução"

### Pontos técnicos
- Único arquivo de código editado: `src/pages/lp/LandingPage.tsx` (bloco linhas 798-833).
- Novo arquivo: `src/assets/rotina-preview.mp4.asset.json` (pointer gerado pelo CLI).
- Sem mudanças em outros módulos, rotas ou lógica.
