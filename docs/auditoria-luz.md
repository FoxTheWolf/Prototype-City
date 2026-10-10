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
- ~~**A raiz maior: as luzes somadas em gama**~~ (`lightAt`, `lamps.ts`): cada luz agora vira linear antes de somar (`linL`: uma luz sozinha sai idêntica; duas iguais dão 2×, não 4,6×); com isso saíram os dois joelhos que espremiam a soma (`LIGHT_KNEE`, `LAMP_OVER`). O `lightAt` devolve luz linear; o caminho "como desenhado" e a chuva (`fall.ts`) a convertem de volta (`srgb`) com o escurecer de dia deles. `LAMP_RECV` 1,2 → 1,5 (= 1,2^2,2). Conferido: a avenida de noite (semente 42, 828,800, 22h) igual antes e depois. **Falta:** a cópia na CPU para as mãos (`viewLight`/`lightAt` em `raycaster.ts`, ainda com o joelho), que vai junto da luz nas mãos pela GPU.
- ~~O holofote multiplicado pelo albedo duas vezes~~ (`wall.ts`): a luz já vinha "vezes a cor da parede" e o `light()` multiplica de novo; agora é só a luz (`FLOOD_K`).

## Luzes calculadas na própria parede (são luz de verdade, com sombra; não são pintura)

> Revisto: entram no `light()` pelo `gIl` como luz (vezes o albedo), então não são remendo. Ficam como estão; o
> que poderia mudar é passar para a lista de luzes (`DynLights`) se um dia a luz indireta precisar delas como fonte.

- **B1. Holofotes na base da fachada** (`wall.ts`, o cone pintado com sombra, `floodH`): a `dyn.flood` só ilumina a calçada e quem passa; a parede é pintada. 
- **B2. A coroa iluminada no topo** (`cw`, `wall.ts`): uma lavagem pintada nos últimos 16 m. 
- **B3. As luminárias de pescoço dos outdoors** (`al`, `wall.ts`): pintadas de baixo para cima. 

## O caminho "como desenhado" (o `else` do `light()`)

- **C1.** O `else` do `light()` (a luz **somada** à cor, a lua como cor, `amb = 1 + 0,7·dia`). Conferido: só caem nele o que brilha (`M_GLOW`, certo: é fonte) e os cômodos têm o caminho deles; ~~os objetos levantados (`zoff`: as coisas no telhado) herdavam o sol da parede atrás~~ e agora usam a própria normal. Se algo além do que brilha aparecer nele (F7: verde = objeto), passar para o caminho aceso.

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
- **O brilho especular dos postes** (`sp`, `LAMP_GLOSS`/`LAMP_SPEC`): sem direção (a luz vezes o Fresnel). ~~Nas superfícies que espelham (vidro, janela, pintura, chão molhado)~~ saiu: lá o raio de reflexo já mostra os postes (contava duas vezes; `CAR_GLOSS` saiu junto). Fica no metal e no seco liso; o físico seria o GGX pela direção da luz mais forte (rever com a luz indireta).
