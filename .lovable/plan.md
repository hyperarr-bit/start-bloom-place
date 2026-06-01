Vou ajustar apenas `AccessGateUI.tsx` e, se necessário, a animação já existente no `tailwind.config.ts`.

Plano:
1. Reposicionar o container da seta para ficar totalmente dentro da largura da tela, sem gerar overflow horizontal.
2. Manter a seta apontando para os 3 pontos no canto superior direito, reduzindo/ajustando o deslocamento lateral que hoje empurra parte dela para fora.
3. Travar a tela contra movimento lateral usando overflow horizontal oculto e largura fixa do viewport no overlay.
4. Manter a animação sutil só no eixo vertical, sem mexer no eixo X, para ela não sair do espaço normal.

Não vou alterar copy, botões, logo, tema ou fluxo da tela.