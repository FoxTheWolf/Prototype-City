# Auditoria da luz: o que é físico e o que é remendo (2026-10-09)

> Pedido do usuário: agora que a luz adiada é a única, tirar as gambiarras que só existiam por causa da luz velha
> ("um reset no código de iluminação") e reajustar só na base da necessidade. Cada item: onde está, o que faz, o
> veredito. Ao tirar um, riscar aqui e anotar o que precisou de ajuste.

## Já tirados

- ~~Transbordo das vitrines na calçada~~ (`SHOP_LIGHT`, `raycaster.ts`): luz pintada na calçada em frente à loja, acesa mesmo com a loja fechada e a vitrine escura. A luz indireta (16.1c) faz de verdade.
- ~~Transbordo da janela acesa na parede~~ (`WIN_SPILL`, `wall.ts`): idem.
- ~~O par "escurecer de dia / desescurecer"~~ dos postes: `lightAt` (`lamps.ts`) multiplicava por `1 − 0,85·dia` e o `lampE` dividia pelo mesmo fator: os dois se anulavam. O escurecer ficou só no caminho "como desenhado" (item C1), que ainda precisa dele.
- ~~O brilho do neon pintado na parede~~ (`wall.ts`, em volta do tubo): contava duas vezes, porque o neon já é uma luz de verdade (`dyn.panel` em `raycaster.ts`) que ilumina a parede.
- ~~`SIGN_DAY`~~ (o letreiro iluminando a rua 2,5× mais forte ao meio-dia "para aparecer na sombra"): de dia um letreiro mal ilumina a rua.
- ~~`WALL_LAMP_HUE`~~ (tirava 10% da cor dos postes nas fachadas: resto da luz velha em sRGB).

## A raiz maior: as luzes somadas em gama (fazer na próxima sessão de luz)

- **`lightAt` (`lamps.ts`) soma as luzes em valores sRGB (gama) e só depois lineariza** (`lampE`: `pow(·, 2.2)`). Somar em gama é errado: duas luzes iguais dão 2^2,2 ≈ 4,6× a luz de uma, não 2×. Daí os dois remendos de compressão:
  - `LIGHT_KNEE` (150, `lamps.ts`, e a cópia na CPU em `raycaster.ts`) e `LAMP_OVER` (0,3, `lampE`): comprimem a soma para os faróis não estourarem no branco.
- **O certo:** cada luz vira linear antes de somar (`pow(c·f/255, 2,2)` por luz: uma luz sozinha sai idêntica, a soma passa a ser física), o `lampE` não eleva mais, e os dois joelhos saem. Quem lê o `lightAt`: o `light()` (o caminho aceso e o "como desenhado"), a chuva e a neve (`fall.ts`), o mapa de luz dos postes (a parte de cima do `lightAt`, que lê uma tabela feita na CPU, `lightmap.ts`). Conferir: avenida de noite com faróis (o carro não estoura), o cruzamento com 4 postes.

## Luzes que são pintadas na cor em vez de ser luz (converter em luz de verdade)

- **B1. Holofotes na base da fachada** (`wall.ts`, o cone pintado com sombra, `floodH`): a `dyn.flood` só ilumina a calçada e quem passa; a parede é pintada. Converter: a `dyn.flood` ilumina a parede (o cone com a sombra que já existe) e a pintura sai.
- **B2. A coroa iluminada no topo** (`cw`, `wall.ts`): uma lavagem pintada nos últimos 16 m. Converter num holofote para cima (uma luz como a B1).
- **B3. As luminárias de pescoço dos outdoors** (`al`, `wall.ts`): pintadas de baixo para cima. Converter em luzes pequenas sob o outdoor.

## O caminho "como desenhado" (o `else` do `light()`)

- **C1.** Pessoas, postes e placas pintadas não são iluminados como sólidos: a luz é **somada** à cor (`c += lamp`), a lua somada como cor, `amb = 1 + 0,7·dia`. Não é físico. **Quando:** as pessoas novas (16.3) já nascem no caminho aceso (albedo × luz, com normal); os postes e as placas vão junto (verificar quais objetos ainda caem aqui pelo F7).

## A paleta feita para a noite (correções do dia)

- **D1.** `DAY_ALBEDO` (2), `DAY_SAT` (1,12), `DAY_ALB_MAX` (0,8), `DAY_GROUND` (1,8 + 20% cinza no chão): a paleta foi desenhada para parecer certa sob a luz da noite, então de dia ela é "corrigida". O físico é cada material ter um albedo de verdade (0,04 asfalto, 0,3 concreto, etc.). **Quando:** junto dos materiais PBR (23.3), ou antes se a luz indireta (16.1c) pedir albedos reais (pede: o rebote usa o albedo).

## Aproximações que a luz indireta (16.1c) substitui (manter até lá)

- `AMB_FACE` e o `cityAmb` direcional (o brilho da cidade vindo do centro), `SKY_BOUNCE`/`gBncA`/`gBncS` (o rebote das paredes), `MOON_SHADE`.
- Nos cômodos (`roomE`): `ROOM_WRAP` (0,35), a queda `k = (0,5 + 0,9/(1 + d²/5))/(1 + 0,03·d)`, o ambiente azulado da noite (`a = 0,14`), `SKY_IN_WIN`/`SKY_IN_DEEP`/`SUN_IN`/`DAYLIGHT_FALL`.
- `glassBeyond` (a cor fixa do que fica além do vidro) e `GLASS_SHEEN`.

## Ficam (não são luz, ou são princípio documentado)

- **A escala comprimida:** `artK`/`ART_KEEP`, `EMIT_KEEP`, `SIGN_EYE`, `EV_NIGHT`/`evDayNight` (a noite do jogo é ~300× mais escura que o dia, não 10 000×: escolha de jogo, nas lições da 16.1b).
- **O estilo do ASCII:** o `display()` (fundo e glifo por tipo), `SIGN_FILL`, o brilho do glifo nos blocos.
- **O espelho do chão molhado:** `WET_MIRROR`/`WET_BLUR_MIN` (o Fresnel é físico; o teto é pela falta de várias amostras por célula) e `WIN_MIRROR` (o olho ajustado para a rua: o cômodo atrás parece mais escuro).
- **O brilho especular dos postes nas superfícies lisas** (`LAMP_GLOSS`/`CAR_GLOSS`/`LAMP_SPEC`): hoje sem direção (o `El` vezes o Fresnel); o físico é o GGX por luz. Rever junto da soma linear (barato fazer junto).
