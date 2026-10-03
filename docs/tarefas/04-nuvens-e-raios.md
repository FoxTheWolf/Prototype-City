# 04: Segunda opinião técnica, nuvens volumétricas e raios de luz (Gemini)

Retorno esperado: Markdown com código WGSL, salvo em `docs/tarefas/retorno/04-nuvens-e-raios.md`. O Claude compara com o plano dele antes de implementar.

--- COLE DAQUI ---

Tenho um jogo de navegador que desenha uma cidade inteira em **caracteres ASCII** com **WebGPU**. O render é um **compute shader com uma invocação por célula** da grade de caracteres (até ~634×200 células = ~127 mil células). Cada célula lança **um raio 3D** pela cidade (um DDA numa grade de quarteirões e prédios-caixa) e escolhe um glifo e duas cores (frente e fundo). Depois há uma passada de composição (fragment shader) que desenha os glifos de um atlas e faz um **bloom** a partir de um canal de emissão. Orçamento: o mundo inteiro leva ~3–10 ms numa GPU média; quero gastar **no máximo ~1 ms** a mais com o que está abaixo. Já tenho: sol e lua com direção, céu em gradiente, uma camada de nuvens 2D (ruído no plano do céu), névoa por distância, chuva, sombras do sol por um raio extra (`sunLit`), e um reflexo por um segundo raio.

Quero a sua proposta concreta para:

1. **Nuvens volumétricas** só nas células de céu (um raymarch numa camada entre ~1200 e ~2500 m de altitude), com bordas acesas pelo sol (*silver lining*), base escura, cor do entardecer, e a lua por trás à noite. Diga: quantos passos, que ruído (3D Perlin/Worley em textura 3D pré-calculada ou procedural), como fazer a luz (quantos passos em direção ao sol, Beer-Powder, função de fase Henyey-Greenstein), e **como amortizar** (por exemplo, calcular 1/4 das células por quadro e reaproveitar, ou meia resolução), já que as células são grandes (cada uma é um caractere).
2. **Raios do sol (*god rays*)**: em espaço de tela, a partir de uma máscara "céu visível perto do sol" (blur radial na passada de composição). Como fazer numa grade de caracteres (a máscara pode ser a própria grade de células) e o custo.
3. **Cones de luz visíveis no ar** de postes e holofotes à noite (com névoa/chuva): uma marcha curta pelo raio da célula somando o espalhamento de cada luz próxima (tenho uma lista de luzes por quadro na CPU, com posição, cor, alcance e, para os holofotes, direção e abertura). Como limitar o custo (quantas luzes por célula, quantos passos, uma grade de luzes por tile?).

Para cada um: um esboço de **WGSL** (funções, não o shader inteiro), a estimativa de custo por célula, e as armadilhas (bandas, tremido entre quadros, ruído que pisca). Não proponha trocar de técnica de render (o raio por célula e os caracteres são a identidade do jogo).
