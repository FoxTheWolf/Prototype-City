# Plano da atmosfera física (16.1c, passo 0)

> Escrito em 2026-10-09 à noite (Opus 5.5, conta V no fim do semanal) para a próxima sessão começar direto no código.
> Pedido do usuário: o céu pela física (ele "comprou" a ideia) e o pôr do sol rosa de Miami (fotos dele no chat:
> céu rosa-roxo com nuvens tingidas, água refletindo). Depois disso vem a luz indireta (GI) e as luzes com sombra.

## O que entra (e o que o jogador vê)

1. **Espalhamento simples Rayleigh + Mie + absorção do ozônio**, por raio no shader (sem LUT na primeira versão:
   ~8 passos pela vista × ~4 até o sol só nas células de céu; medir; se pesar, virar LUT 64×32 recalculada quando o sol anda).
   Constantes da Terra (Hillaire 2020 / Bruneton): raio 6360 km, topo 6460 km; Rayleigh β = (5.802, 13.558, 33.1)e-6/m, H = 8 km;
   Mie β_s = 3.996e-6, β_a = 4.4e-6, H = 1,2 km, g = 0,8; ozônio β_a = (0.650, 1.881, 0.085)e-6 numa camada em 25 km (largura 30 km).
   **Ozônio é o que dá o azul-violeta do crepúsculo** (sem ele o céu depois do pôr do sol fica cinza-amarelado).
2. **Múltiplo espalhamento aproximado:** um termo isotrópico barato (céu × fator ~ albedo) para o céu não ficar escuro demais
   no crepúsculo; a versão boa (LUT de Hillaire) só se o barato ficar feio.
3. **A cor do sol = a transmitância até ele** (troca `kelvin(sunTemp())` / `sunLin()`): a cidade fica laranja no fim da tarde
   e vermelha no último minuto sem cor pintada. O disco do sol também.
4. **A sombra da Terra e o cinturão de Vênus** saem sozinhos do (1) olhando para o lado oposto ao sol.
5. **Perspectiva aérea:** `aerial()` passa a misturar com o céu daquela direção (já é `horizonCol`), então os prédios longe ficam
   rosados no pôr do sol e azulados ao meio-dia. Custo: `horizonCol` é chamado por célula de geometria distante → **não** marchar ali;
   calcular na CPU um anel de 32 azimutes do horizonte por quadro (ou a cada segundo) e mandar num uniforme/buffer; o shader interpola.
6. **As nuvens** (já marchadas em `skyCell`, `CLOUD_H` 1200–1900 m): `sunC` vira a transmitância até o sol **na altura da nuvem**
   (o raio do sol rasante a 1500 m de altura ainda passa por cima da Terra depois do pôr do sol no chão → as nuvens altas
   ficam rosa/vermelhas por alguns minutos depois que a rua já escureceu: **é o efeito de Miami**). `amb` (a luz do céu na nuvem)
   vira a média do céu calculado (o zênite basta). A névoa das nuvens longe (`hz`) usa a cor do horizonte nova.
7. **Umidade/aerossol:** Mie mais forte com `u.precip`/`u.cloud` e perto do mar (o oeste): mais rosa e mais névoa. Depois da chuva, ar limpo.

## Onde mexer (lido no código em 2026-10-09)

- `src/render/gpu/wgsl/sky.ts`: `skyGrad()` (l. ~61) é o céu claro inteiro: a parte do dia e o `dusk` saem e viram a física;
  **ficam** a noite (o gradiente escuro) e o domo de luz da cidade, como emissão somada. `horizonCol()` (l. ~85) idem.
  Em `skyCell()`: `sunK` (o brilho em volta do sol: vira o Mie para frente), `sunC`/`amb` das nuvens, o disco do sol (`kc`).
- `src/render/gpu/wgsl/shading.ts`: `sunTemp()`/`kelvin()`/`sunLin()` (l. 18–29) → a transmitância; usados em l. ~135 e ~226
  (a luz do sol nas superfícies). `aerial()`/`horizonSeen()` (l. ~108).
- Unidades: o céu hoje está em 0–255 "de tela" (sRGB); a luz em linear (`lin`/`srgb`). Calibrar uma constante para que o
  zênite ao meio-dia fique perto de hoje (~54, 88, 142) e deixar a exposição do olho (`u.adapt`, EYE) fazer o resto.
- A CPU já tem o sol (`sunDir` em `sim/clock.ts`; `u.sunX/Y/Z`, `u.sunEl`, `u.sunA`). `u.dusk` e `u.day` continuam para a noite e a cidade.
- **Um sistema só:** sai o caminho velho (`dusk` pintado, `SUN_K_*`), nada de duas versões com chave.

## Como conferir

- Posições: a semente 42 da captura do usuário (`pos=810.9,344.8 look=0`) e uma vista para o oeste com horizonte aberto
  (o mar ainda não existe: a borda é chão liso). Horas: 12:00, 17:00, pôr do sol −20 min, pôr do sol, +10, +25, 21:30.
  O pôr do sol do dia sai de `main.ts:1019` (a busca do `dusk`).
- Esperado: meio-dia azul com horizonte mais pálido; 17 h as fachadas douradas; no pôr do sol o horizonte laranja-vermelho,
  o lado oposto rosa sobre faixa azul-escura; +10 min as nuvens altas rosa com o céu roxo; de noite igual a hoje.
- Medir o `DRAW` antes e depois (só para avisar; conteúdo antes de otimização).
- Um `teste-ceu.bat` para o usuário com essas horas numeradas.

## Depois (não neste passo)

O mar refletindo (23.4), a luz indireta recebendo esse céu (16.1c passo 1), as estrelas/lua sob a mesma extinção (23.5).
