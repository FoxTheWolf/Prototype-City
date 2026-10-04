# Modelos do Blockbench: regras para importar no jogo

> Consulta do usuário em 2026-10-04. **Não decidido:** por enquanto todos os modelos são gerados pelo Claude
> em código (`src/render/models.ts`). O Blockbench entra só se um modelo gerado ficar ruim, ou para publicar.

## Como entraria no jogo

O jogo desenha os objetos como listas de caixas (`part(...)` em `render/models.ts`), testadas por raio na GPU.
O arquivo `.bbmodel` do Blockbench é um JSON com cubos. A ideia é **ler o `.bbmodel` direto** e converter cada
cubo numa peça, sem exportador nem malha (um script em `scripts/` gera a lista de peças, ou o jogo lê o JSON).

## Cuidados no Blockbench

1. **Só cubos.** Nada de malha livre (mesh): ela não vira peça. Formato "Generic Model" (ou "Bedrock").
2. **Escala:** 1 px = 1/16 m (16 px = 1 m). A origem no chão, no centro do objeto. A frente virada para o
   norte do Blockbench (o script gira para o +x do jogo).
3. **Rotações:** poucas, em múltiplos de 22,5°. Um cubo girado custa mais que um alinhado.
4. **Poucos cubos:** uns 30 para um objeto de rua; o carro e os objetos grandes podem ter mais, mas cada cubo
   custa em cada célula da tela onde o objeto aparece.
5. **Nada menor que ~10 cm.** A 20 m uma célula cobre ~17 × 29 cm: detalhe pequeno some ou pisca. Pensar em
   silhueta e em blocos de cor.
6. **Uma cor lisa por face.** Textura com padrão só vale para as skins (veja abaixo).
7. **Nomes dos grupos com sufixos,** para o material e a luz: `_glass` (vidro), `_lit` (acende de noite, emite),
   `_metal`, `_chrome`; e para as partes que se mexem: `wheel_`, `door_`, `lid_`.
8. **Sem faces coplanares sobrepostas** (dois cubos com a mesma face no mesmo plano fazem os glifos piscarem)
   e **sem cubos escondidos** dentro de outros (custam sem aparecer).
9. **Nível de detalhe:** se o modelo for detalhado (muitos cubinhos), marcar com `lod_far` um grupo com a forma
   simples (3–6 cubos) que o jogo usa de longe; o resto some com a distância.

## Skins de Minecraft (13.8)

- Formato do jogador do Minecraft, skin 64×64; o jogador pode usar o **padrão Alex** (braços de 3 px).
- A skin entra como textura amostrada (com média por célula para não piscar), não como cubos.
