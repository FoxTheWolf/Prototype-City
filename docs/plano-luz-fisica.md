# Plano da luz física (16.1c, do passo 1 em diante)

> Escrito em 2026-10-10 (Opus 5.5, conta C). **Pedido do usuário:** a luz mudou de "a superfície pinta a textura" para
> "adiada, uma função para tudo"; então **toda** a luz tem de ser reescrita do zero pela física, como a atmosfera foi
> (`src/render/atmosphere.ts`, o passo 0, feito), só com ajustes de calibração; a luz indireta "quase ray tracing".
> Referências dele (no chat de 2026-10-10 e em `referencias/98–101`): a rua de noite molhada com as janelas acesas
> (Matrix/UE5), a Sponza com o tecido tingindo o chão, a viela de dia com o rebote quente das paredes amarelas, a
> comparação direta × indireta × as duas.

## O princípio

Uma fórmula: **o que o olho vê = Σ luzes × visibilidade × BRDF(material) + emissão + o rebote**, em unidades físicas
(radiância relativa ao sol), exposta pelo olho e passada pela curva de tom. Nada pintado na cor, nenhum ambiente falso,
nenhum fator "de dia" na paleta. A **escala comprimida** (a noite ~300× mais escura que o dia, não ~10 000×) fica: é o
olho/a câmera (a exposição), não a luz (lições da 16.1b).

**Como reescrever sem quebrar o jogo:** por tipo de coisa, de uma vez ("um sistema só"): cada parte entra pela função
nova e **o caminho velho dela é apagado no mesmo passo**, nunca duas versões convivendo.

## Andamento

- **2026-10-10 (conta C): a infraestrutura da parte 2, só no debug (`DEBUG.giView` no console; o visual padrão não mudou).**
  `src/render/gpu/wgsl/gi.ts`: `skySH` (os harmônicos do céu, de `atmosphere.ts skySH`, recalculados quando o sol anda),
  `giTrace` (prédios + chão), `giHit` (o sol com sombra + o cache no ponto atingido), `giSample` (2 raios por célula, o
  cache por `giKey`/`giAdd`/`giGet`), e o passe `GI_RESOLVE_WGSL` (a média que esquece, 0,12 por quadro); dois buffers
  novos (`gia`, `gir`: 6º e 7º dos 8). `giView`: 1 o cache, 2 o céu pela normal, 3 a amostra crua. Conferido ao meio-dia
  (13 h, semente 42, `pos=810.9,344.8`): o chão aberto azulado pelo céu, as paredes mais escuras, a sombra de contato na
  base, sem ruído. **Falta antes de virar o padrão:** a normal das células de janela (usam a de cima: aparecem no debug),
  a parte 1 (os albedos reais; hoje `giHit` usa a cor da fachada × 1,6 e o chão 0,18), a convenção do `light()` (hoje
  não divide por π e tem `DAY_ALBEDO 2`: o chão ~2× mais claro que a física em relação ao céu visto), e a noite (as
  luzes e as janelas no ponto atingido). Aí troca o padrão e apagam-se `skyView`/`bounceFrom` e o resto da lista.

- **2026-10-10, mais tarde: a luz de dia trocada** (o padrão, não mais só debug): o céu e todo rebote vêm dos raios
  (`giE` no `light()`; longe de `SKY_FAR` 700 m, `skySH` pela normal); o sol com a força física (`SUN_E = GI_SUN/π`,
  a mesma do céu); o albedo = cor × `K_PAL` (6: a paleta foi desenhada ~6× mais escura que as refletâncias reais) sob
  `ALB_MAX` 0,85. **Apagados:** `skyView`, `horizonTan`, `bounceFrom`, `gBncA`/`gBncS`/`gSky`, `SKY_BOUNCE`,
  `BOUNCE_SKY`, `BOUNCE_SUN`, `DAY_ALBEDO`, `DAY_SAT`, `DAY_ALB_MAX`, `DAY_GROUND`, o `aSky` e o fade `ds`.
  **A noite ficou igual** por um fator de unidade (`E_UNIT` = o sol novo / o velho 4,2) nas constantes ainda velhas
  (`AMB_N`, `MOON_E`, `LAMP_E`, a luz do dia dos cômodos e do telhado): elas saem nos passos seguintes. Shader 26 s de
  compilação (era 34). Conferido: 13 h (como antes, as fachadas na sombra mais frias), 17h33 (a rua na sombra escura e
  azulada: o asfalto real na sombra; se ficar escuro demais, o ajuste é o olho, não luz falsa), 21h30 (igual).
- **2026-10-10, a noite pelos raios:** o ponto atingido recebe as poças dos postes (`giLamps`, a mesma conta do `lightAt`
  pela `lampPools` separada dele) e a fachada atingida dá a luz das janelas acesas (a média: `lit × litShare × WIN_AREA`).
  **Saiu o ambiente falso da noite** (`cityAmb` como luz em tudo, `aCity`, `AMB_FACE`); a lua fica. O xadrez de ruído que
  o usuário viu (print de 17h47, `POS 792.7,354.2`): a leitura do cache agora interpola as 4 células vizinhas no plano da
  superfície (`giRead`), e a média conta as amostras de cada célula (`gir` com 5 palavras; `GI_BLEND` 0,04 de piso).
- **2026-10-10, mais:** 4 raios estratificados por célula e `GI_BLEND` 0,025 (o usuário: o xadrez "diminuiu bastante,
  ainda visível"; se sobrar, o próximo é um filtro espacial no cache, que suaviza um pouco as transições). A normal das
  janelas já estava certa desde a troca (o `Nn` pela `KIND_WALL`). **Parte 1 começada:** `albedoOf` (`wgsl/head.ts`), o
  teto de refletância por material (`MAT_ALB`: asfalto 0,15, concreto 0,4, tijolo 0,35, pedra 0,45, folha 0,25, metal
  0,65, pintura 0,75), igual no `light()` e nos raios. GPU ~2,7 ms no painel (mais fraco que o PC do usuário).
  **A sombra no cânion de torres ao meio-dia sai quase preta:** falta o **reflexo especular do sol nas torres de vidro**
  nos raios (hoje as paredes são foscas para a luz indireta): o próximo item da parte 2.
- **O especular nos raios:** a fachada de vidro/metal atingida devolve o sol pelo lóbulo GGX (`GI_GLASS_ROUGH` 0,18, teto
  `GI_SPEC_MAX`) e o céu espelhado (Fresnel). Na avenida do centro ao meio-dia muda pouco (o sol a ~70° manda o reflexo
  ao pé da torre): **a sombra do cânion é escura pela física** (a luz do céu ~1/3 da rua aberta × asfalto 0,13); se o
  usuário achar escuro demais jogando, o ajuste é o olho (adaptar mais à sombra), não luz falsa.
  **Próximo:** as luzes como fontes (parte 3), os
  cômodos (parte 4: `AMB_N` ainda está no `roomE`/`roofE`, e `E_UNIT` nas constantes velhas que sobram).

## As partes, na ordem

### 1. Materiais e unidades (a base de tudo)
- **Albedo de verdade por material** (`MAT_ALBEDO` ao lado de `MAT_ROUGH`/`MAT_F0` em `wgsl/head.ts`): asfalto 0,07
  (molhado escurece, o Fresnel faz o resto), concreto 0,35, tijolo 0,25, pedra 0,3, metal pintado/carro pela cor,
  folha 0,15, vidro/janela pelo Fresnel. A cor da paleta passa a dar **o matiz e a variação** (a mancha, o tijolo
  mais claro), normalizada; a refletância vem do material. Saem `DAY_ALBEDO`, `DAY_SAT`, `DAY_ALB_MAX`, `DAY_GROUND`
  (a "correção do dia" da paleta da noite, D1 da `auditoria-luz.md`).
- **Uma BRDF:** Lambert + GGX/Fresnel (já existem `ggx`/`fres`) **para toda luz com direção** (o sol, cada poste, cada
  farol): sai o brilho especular sem direção dos postes (`LAMP_SPEC`/`LAMP_GLOSS`).
- O caminho "como desenhado" (`else` do `light()`, C1) só para o que é fonte (emissão); o resto aceso.

### 2. A luz indireta por raios (o rebote; tira o ambiente falso)
- **A cena dos raios** (`giTrace`): os prédios (caixas/cilindros/cortes) pelo DDA da grade de quarteirões, o mesmo de
  `dirLit`, devolvendo o ponto, a normal e o prédio; o chão; sem os cubinhos finos na primeira versão.
- **2 raios por célula por quadro**, pelo cosseno no hemisfério do ponto (`gPos`/`gNrm`).
  - **Escapou:** o céu físico naquela direção, por harmônicos esféricos L2 (27 números) calculados na CPU com
    `skyRadiance` a cada ~1 s, + o domo da cidade como emissão.
  - **Bateu:** albedo × (o sol com sombra `dirLit` + as luzes diretas no ponto + **o próprio cache ali**, que dá o 2º,
    3º rebote ao longo dos quadros) + a emissão (as janelas acesas pela média do prédio, o neon, os letreiros).
- **O cache no mundo** (à la SHaRC/Lumen): um buffer novo (o 6º dos 8), tabela de hash pelo ponto (0,5 m perto a ~4 m
  longe) e pela normal (6 faces), soma em ponto fixo com `atomicAdd` + contagem, média que esquece (~0,3 s).
  Estável e preso ao mundo: sem pisca-pisca de caractere, virar a câmera não recalcula.
- O sombreamento lê `E_indireta = cache(gPos, gNrm)`; **o céu direto sai do `light()`** (vem pelo cache).
- **Saem:** `skyView`/`horizonTan`/`bounceFrom`/`gBncA`/`gBncS`/`gSky` (`wgsl/occlusion.ts`), `SKY_BOUNCE`,
  `BOUNCE_SKY`, `BOUNCE_SUN`, `AMB_FACE`, `skyHue()` como luz chapada, e **`AMB_N` como luz** (a noite iluminada pelo
  que existe: o chão aceso pelos postes rebatendo nas fachadas, as janelas acesas, o domo, a lua). A exposição da noite
  (`EV_NIGHT`) fica (é o olho) e se recalibra olhando.

### 3. As luzes diretas como fontes fotométricas
- Cada luz: posição, cor (temperatura/lâmpada: sódio, mercúrio, LED, halógena), **fluxo (lúmens)** e **perfil de facho**
  (como um IES), com queda pelo inverso do quadrado e **sombra**. Já são assim: o farol (`headBeam`) e o holofote
  (`floodCone`). Faltam:
  - **Os postes:** hoje uma "poça" pintada num mapa (`lmap`/`lampCorner`, queda inventada, sombra só de perto). Viram
    luminárias de verdade (cabeça de cobra, perfil tipo II que joga a luz ao longo da rua), com sombra.
  - **As janelas acesas, o neon, os letreiros, as telas:** emissores de área com a luminância de verdade (o painel já é
    meio isso: `PANEL_S`); saem `SIGN_EMIT`, `SIGN_GLOW` como multiplicadores soltos, a coroa e as luminárias de
    pescoço pintadas (B2, B3) viram luzes.
  - **"As muitas luzes"** (cronograma): todas por ladrilho (cada pedaço da tela só olha as luzes perto dele).
  - Saem `LAMP_E`, `LAMP_RECV` e a soma em sRGB que sobrar.

### 4. Os cômodos na mesma luz
- As lâmpadas do cômodo como fontes com sombra (a planta já é percorrida em `roomWalk`); a luz do dia entra pelos raios
  da parte 2 que saem pela janela (batem no céu e na cidade); saem `ROOM_WRAP`, `SUN_IN`, `SKY_IN_*`, o `roomE` como
  conta à parte e o `artK` se a escala permitir.

### 5. As mãos
- O celular, o relógio, o notebook e o Jackdaw lêem a luz da GPU (o cache e as luzes no ponto da mão): sai a cópia na
  CPU (`viewLight`/`lightAt` em `raycaster.ts`).

## Como conferir (cada parte)
- As posições de ouro (`docs/tecnico.md`) ao meio-dia, 17 h, 19h30 e 22 h, antes e depois; uma chave de debug que
  mostra só a parte nova (só o indireto, só uma luz).
- Parado, a imagem não treme; andando, a luz não arrasta visivelmente.
- `DRAW` antes e depois (só para avisar; conteúdo antes de otimização). Compilação: funções grandes chamadas num lugar só.
- Um `teste-*.bat` por parte para o usuário.

## Estimativa
~5–7 sessões (a parte 2 e a 3 são as maiores). A 16.2 (pessoas) espera: as pessoas nascem nesta luz.
