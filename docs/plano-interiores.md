# Plano técnico: o rework dos interiores pelo manual

> Escrito em 2026-10-08, no fim da sessão do manual de interiores. Absorve as subetapas 13.10c, d, d2, g e h.
> **Numeração nova (cronograma de 2026-10-08):** este plano fecha na etapa 13 (13.18–13.24, `docs/cronograma.md`):
> passo 9 → 13.18; passo 8 → 13.19; passo 3 → 13.20; o gerador único → 13.21; passo 5 → 13.22; passo 4d → 13.23;
> as escadas de incêndio → 13.24. O passo 7 (tipos que faltam) e as faixas `*` vão para a 23. Depois vem a 16 (pessoas).
> **Manual = lei:** ler `docs/identidade/interiores-manual.html` inteiro antes de começar.

## O que já existe

- **As plantas e as regras no código:** `src/sim/floorplans.ts` (os tipos, as tabelas de letras, `grow`, `checkFloor`,
  `checkBuilding`, `checkArrangement`) e `src/sim/floorplans.json` (19 andares, 72 arrumações, 5 prédios inteiros: 8×8, 8×10/12, 10×10, 10×12, 12×12),
  copiado do manual por `node tests/floorplans-sync.mjs`. O teste `tests/floorplans.ts` roda R1–R9 em tudo e confere
  que 7 plantas estragadas de propósito falham. **O manual é onde se desenha; o JSON é cópia.**
- **O gerador de hoje** (`makePlan` em `src/sim/interior.ts`) corta o andar por regras e mobilia por sorteio (`furnish`).
  As lojas já leem modelos em texto (`src/sim/layouts.ts`, 13.10c).
- **Um gerador só (regra do usuário em 2026-10-08):** a loja do térreo e os andares de cima saem do **mesmo** leitor e
  do mesmo formato. Os modelos de `layouts.ts` passam para a gramática das plantas (a camada de móveis dentro da `o`,
  com as letras de loja acrescentadas à tabela `FURN`) e são lidos por `planFromFloor`, não por um caminho à parte;
  `layoutShop` some quando a migração terminar. Vale também para o mobiliário: a biblioteca de arrumações e as
  arrumações de loja são a mesma coisa (uma sala de um tipo, com o contorno e os móveis).

## Os passos, em ordem (cada um com o seu commit e o seu teste)

1. ✅ **(0.13.10j) O catálogo na geração da cidade** (`src/sim/city.ts`, `lots` no laço dos quarteirões). Feito: 100% dos
   prédios com porta num tamanho do catálogo em 3 sementes (sobram 2 torres recuadas, que ficam para as plantas de torre); a população segue
   em ~94 mil (o teto é a meta); as lojas caíram 14% (1.618 → 1.387 na 42); motel + cybercafé em todas as sementes.
   **Como os lotes nascem hoje (lido em 2026-10-08):** `split` (dentro do laço dos quarteirões, ~linha 730) corta o
   quarteirão ao meio recursivamente em `bays(lw * t)` (múltiplos de 2 m, t entre 0,35 e 0,65) até `maxLot`
   (`K.lot + K.lotCore * core`); `lots()` marca como aberto o lote com lado < 8 m e junta lotes sem rua ao vizinho.
   **A regra sugerida:** a **largura na rua** é que precisa ser do catálogo (8, 10 ou 12 m; torres 16–24), porque o
   **fundo** já se ajusta pelas linhas `*` (é preciso dar faixas `*` a todas as famílias, de 8 a 24 m). Todo trecho
   par ≥ 16 m se escreve com 8, 10 e 12 (16 = 8 + 8, 18 = 8 + 10, …); um trecho de 14 m vira 12 m + 2 m de vão
   (um beco de ventilação, comum em 2008). Então: no `split`, ao cortar ao longo da rua, escolher o corte entre
   as larguras do catálogo, não por `t`. A junção de lotes de `lots()` (o vizinho sem rua vira os fundos) pode
   gerar fundos fora do catálogo: limitar o fundo a 24 m ou fazer o resto virar quintal.
   **Medido e decidido com o usuário (2026-10-08):** na semente 42 só 58% dos prédios caíam no catálogo; 30% eram
   mais largos que fundos (fileiras rasas do corte ao meio) e 5,5% tinham 6+ andares em lote de 8–12 m (precisariam de
   elevador). **Decisão:** o quarteirão passa a ser cortado como nas cidades americanas: lotes na ponta virados para a
   avenida (as esquinas inclusas), e no meio duas fileiras de costas, cada lote estreito e fundo virado para a rua, o
   resto do fundo vira quintal. **No centro os lotes são largos (16/20/24 m, as torres); na periferia, estreitos
   (8/10/12 m) e com no máximo 5 andares** (ideia do usuário: empurrar os finos para a periferia, sem mudar muito o
   horizonte). A face da porta fica gravada em `way`. Medição: `tests/lots.ts`.
   Antes, medir quantos lotes mudam de tamanho e se o motel/cybercafé continuam (o `tests/city.ts` já confere). O lote de cada prédio com interior é arredondado para o
   tamanho do catálogo mais perto (a tabela da seção 3 do manual; torres em 16 × 16, 16 × 24, 20 × 20, 24 × 24,
   24 × 32). Prédios sem planta desenhada para o tamanho/estilo continuam no gerador velho até a planta existir
   (a lista do que falta está na seção 11 do manual). Teste: `tests/city.ts` em 5 sementes, contando quantos prédios
   ficam fora do catálogo (a meta é 0) e se o motel com o cybercafé a 300–500 m continua existindo.
2. ✅ **(0.13.10k) Ler a planta** (`stackOf`, `planFromFloor`, `stackDoors` em `interior.ts`; `planOf` e `doorOf` passam por eles).
   Feito: a porta da rua é o `R` da planta; ambientes abertos (sem `+`) viram uma divisa de passagem, menos onde há
   móvel; a loja ganha um corredor livre até as portas de dentro dela (o banheiro dos funcionários); `tests/plans.ts`
   começa a andar também pela escada; 0 falhas em 3 sementes. **Cobertura: 12% dos prédios** (faltam os térreos
   residenciais e as faixas `*`; `tests/.out/cover.ts` mede). Os andares de cima só se alcançam com a escada (passo 4).
   **Térreos residenciais desenhados (2026-10-08):** A0R (8×10/12), F0R, D0R, B0R, no padrão do C0, e 6 pilhas novas;
   a cobertura subiu para ~50% (48–53% em 2 sementes). Falta: as faixas `*` dos lotes fundos (~25%), o 8×8 com loja,
   escritórios e torres.
   - Um caractere = 0,5 m = 2 × 2 células de 25 cm (`CELL`).
   - **Parede de dentro `+`:** fica na célula de baixo do caractere (a de menor x ou y), como hoje ("a wall between
     two rooms is the low room's last cell"); a outra célula é do cômodo vizinho.
   - **A primeira linha é a fachada da rua:** girar e espelhar a planta para a fachada que `doorOf`/`toStreet` dá
     (o mesmo que `layoutShop` já faz com as lojas). A escolha entre os andares do tamanho e o espelho vem da semente
     do prédio (`hash3`), igual em todos os andares (R9).
   - Letras → `RoomKind`: l `living`, k `kitchen`, b `bedroom`, h `bath`, s `living` (quitinete: precisa de um tipo
     novo `studio`?), e `foyer`, c/`.` `hall`, S `stair`, L `lift`, o `shop`, p `open`, m/n `office`, q `kitchen`,
     u `store`, r `office`. `unit` sai das portas `E` (cada E abre uma unidade).
   - Portas: `D` → vão com folha (`leavesOf`), `E` → porta de casa que tranca (`doorLocked`, a regra dos 75%),
     `R` → porta de rua (`exitsOf`). Janelas não se leem da planta: continuam saindo da fachada (R2 garante que batem).
3. ✅ **(13.20, 0.13.20; feito como está em `docs/historico.md`) Mobiliar pela biblioteca** (no lugar de `furnish` para as casas): para cada cômodo, as arrumações do mesmo
   contorno (o `frame` da arrumação, girado/espelhado) e escolher pela renda e pelo jeito do morador (`citizens.ts`;
   `homeUnit` ainda não existe, é preciso criar). Letras → `FurnKind`: B bed, A shelf (alto), Q desk, h chair,
   F sofa, r sofa (poltrona: tamanho 1), T tv, t table, K counter, O oven, N counter (pia), G fridge, V toilet?
   (precisa de `basin`), C toilet, H tub (chuveiro 2 × 2), P plant, w washer, y dryer, S shelf, X/Z/U novos.
   Rodar `checkArrangement` de novo depois de girar (deve passar sempre; se não passar é bug do giro).
4. **A escada volta, em cubinhos (replanejado com o usuário em 2026-10-08).** Por que a antiga saiu: era feita de
   primitivas sólidas até o chão (atravessava-se parte dela), não mostrava o andar de cima, e via-se a janela atrás
   dela. O desenho antigo só existia no render da CPU; **o shader da GPU não tem escada.** O plano:
   - **(a) Primeiro, os objetos do mundo em cubinhos na GPU** (o mesmo caminho dos aparelhos na mão, `gpu/voxBody.ts`,
     com uma grade de ocupação por modelo): a escada é o primeiro modelo, os móveis do manual (seção 10) vêm depois
     pelo **mesmo** sistema (um sistema só). Cada degrau é um bloco com o vão embaixo, nada sólido até o chão.
   - **(b) O lance:** dentro da área `S`, um lance reto ao longo do lado comprido (~35°, escada de prédio antigo) e um
     corredor no nível do andar ao lado, com corrimão; a ponta baixa fica do lado das entradas. A simulação dá a altura
     dos pés pelo degrau (como `escapeZ` da escada de incêndio: o andar mais perto da altura atual) e só deixa entrar
     no lance pelas pontas (entrar pelo meio ou por baixo bate).
   - **(c) O poço:** sobre o lance, o teto fica aberto e o shader desenha o andar de cima por ele (`roomWalk` com o
     andar vizinho só dentro do retângulo do poço). Medir a compilação antes e depois (o shader é caro de compilar).
   - **(d) O telhado** (a planta T1: a laje `x`, a casinha da escada, o parapeito) entra junto: é onde a última escada chega.
   - Antes do (a), a correção das janelas fantasmas (0.13.10l), que afetava qualquer objeto, a escada inclusa.
   - **Estado (2026-10-08):** (a) ✅ `Shape.Vox` em `gpu/objects.ts` (DDA na caixa da parte; a grade vai no lugar do texto,
     `world.ts` `packParts`), `stairModel` em `render/models.ts`; (b) ✅ `feetZ`/`STEP_UP`/`FLIGHT_TOP` em `sim/interior.ts`, `steep`
     em `world.ts`, `flightOf` (o lance de 1 m do lado oposto às entradas, a ponta baixa do lado delas), `tests/stairs.ts`;
     (c) ✅ (visto no painel; falta o usuário no PC); **(e) ✅ 0.13.10n, a escada em U** (pedido do usuário no playtest de 2026-10-08, referências `referencias/79–93`): dois lances lado a lado e o patamar do meio (`flightOf`/`stairRise` em `sim/interior.ts`, `stairModel` em `render/models.ts`), as entradas no patamar da mesma ponta (R11), a cabeça no poço sem o prédio sumir; o D com a escada de 3 × 4,5 m, o B com o hall à esquerda, o A0/F0 com um hall até a lavanderia, as portas dos telhados no patamar o buraco no piso/teto (`gWell` no `roomWalk`, campos 16–21 do bloco `IB`, `IN_LEAVES` = 22) e as
     escadas dos andares vizinhos como objetos, `roomWalk` num laço de duas voltas no `main` (compila em ~2 min); (d) falta (o telhado; hoje o lance do último andar entra no teto).
5. **(13.22) Interruptores (R10, 13.10g):** um por cômodo, na primeira parede que não é vidro, do lado da maçaneta; sala vazia
   e loja fechada apagadas.
6. **Testes:** `tests/plans.ts` (as invariantes de hoje) passa a rodar também `checkFloor` nas plantas lidas do jogo
   (depois de girar e converter), numa semente inteira. É o que garante "nada quebrado": a mesma regra no manual,
   no JSON e no jogo.

7. **(etapa 23) Os tipos que faltam (decidido com o usuário em 2026-10-08: o leitor primeiro, depois desenhar estes no manual
   e só então ler no jogo):** o leitor dos passos 1–2 serve a todos, então nada se refaz. Faltam desenhar: **hotel**
   (saguão + andares de quartos), **banco** (hoje na loja genérica), **delegacia** (a prisão fica para depois da 1.0:
   balcão, cela, sala de interrogatório, o caderno da fiança), **galpão industrial** (os lotes de 30 m), **estacionamento**,
   **oficina** (`autoparts`), **escritório grande e as outras torres**, e plantas de loja próprias para os que caem na
   genérica (farmácia, penhores, eletrônicos, celulares, livraria, alfaiate). O cinema fica para depois da 1.0.

8. ✅ **(13.19, 0.13.19) Portas, saída e orientação (pedido do usuário em 2026-10-08, depois do playtest):**
   - **A porta dos moradores precisa ser achável:** hoje, num prédio com loja, a escada só se alcança pela porta dos
     moradores, ao lado da vitrine, e a loja é uma caixa fechada; o usuário entrou em lojas e em prédios ainda sem planta
     (torres, lotes fundos) e nunca viu a escada. Dar à porta dos moradores cara de porta de prédio (número, interfone,
     luz em cima) e conferir se ela se distingue da loja.
   - **O vão entre o alto da porta e a fachada está alto demais** (a porta fica quase invisível): baixar o topo da
     fachada sobre a porta / a altura da verga.
   - **O vidro da porta não mostra o que está atrás** (outras portas, o cômodo seguinte): o vidro da folha tem de
     passar pelo mesmo caminho do vidro unificado (lições da 0.15.56).
   - **Placas EXIT pelo manual de sinalização** (regra 4 de `docs/identidade/sinalizacao-manual.html`: vermelho aceso,
     o homem saindo à esquerda, sobre as portas de saída e as escadas, aceso no apagão; a placa de andar ao lado da
     escada/elevador). O gerador traça o caminho de cada cômodo comum até a porta da rua (BFS na planta) e põe a placa
     sobre cada porta desse caminho e uma seta onde o caminho vira, como em prédio real. Absorve "EXIT e diretório" da 13.7.
     **Hoje o EXIT sobre a porta da rua é verde** (`exitPx` no `roomWalk`, visto no playtest de 2026-10-08); o manual de sinalização pede vermelho.

9. **(13.18) Retorno do playtest de 2026-10-08 à tarde (`playtest/2026-10-08_14-37-49_seed1393987109_report.md`), triado:**
   - **Agora (antes do passo 8 ou junto dele):**
     - ✅ (nota 1) softlock no motel: o F abria a conversa com o clerk antes da porta, cujo alcance ia até a porta;
       agora a porta vem primeiro (`main.ts`). Falta o usuário confirmar.
     - ✅ (0.13.18, notas 3, 4) **vão entre o topo da escada e o piso de cima**: o raio que saía do buraco pela lateral
       entre o teto (3,2 m) e o piso de cima (3,5 m) pulava para o andar de cima; agora encontra a face da laje (`slab`
       no `roomWalk`). O "piso de cima invisível" deve ser a mesma fresta; conferir no PC.
     - ✅ (0.13.18, notas 5, 6) **apartamento sem porta**: o `E` abria no patamar da escada e o `leavesOf` não punha folha
       em vão de escada (agora põe, se do outro lado for uma casa; as divisas abertas, `Plan.seams`, nunca têm folha).
       **Porta na cozinha:** era o desenho do A1, D1, E1, F1, F2; ganharam um hall `e` (manual v1.3) e a regra **R12**.
     - (nota 6) **EXIT verde sobre a porta do apartamento**: resolvido pelo passo 8 (EXIT só no caminho comum até a rua, vermelho).
     - ✅ (0.13.18, notas 2, 7) **móveis e escada afastados da parede**: o caractere de parede tem 0,5 m e a parede, uma
       célula de 0,25 m; o móvel e a escada agora vão até a parede real (`pastWall` em `planFromFloor`).
     - (notas 8, 9) **portas e entrada estreitas**: medido, todo vão `D`/`R`/`E` tem 2 caracteres (1 m). Decidido
       (13.19): as de dentro ficam; a da rua dos moradores vira uma folha de madeira de 1 m com bandeira (`docs/visao.md`).
     - (travou) "andando sem sair do lugar" no 4085, andar 2, `POS 869.9,1144.8`: não se reproduziu no Node; achado e
       corrigido um parecido (0.13.18: no alto do lance, encostado na parede, a colisão usava a planta do andar de baixo).
       `tests/stairs.ts` ganhou o percurso pela beirada.
   - **Depois (ficam no Plano, não agora):**
     - (nota 12) **escadas de incêndio coerentes com as plantas desenhadas** (as janelas e o patamar batendo com os
       cômodos): 13.24.
     - (nota 10) **os vãos grandes entre prédios** (terrenos abertos) viram feiras, mercados, quadras, barracos:
       etapa 23 (variedade), com um manual de lotes vazios.
     - (nota 11) **ASCII nas placas só quando só uma linha de pontos da letra é visível** (placas, semáforos de
       pedestre, letreiros): bloco C8.

## Riscos e o que conferir

- **A cidade muda em cada semente** (o catálogo mexe nos lotes): os saves de teste não importam (decidido), mas as
  "posições de ouro" e os `.bat` de teste com `POS` podem cair dentro de paredes; refazer.
- **O render lê a planta pela GPU** (`putPlan` em `gpu/world.ts`): manter o formato `Plan` (células, salas, móveis)
  para não mexer no shader no passo 2; só a origem dos dados muda.
- **Desempenho:** `planOf` é chamado sob demanda e em cache; ler texto é mais barato que o gerador de hoje.
- **Fora do catálogo hoje:** o 10 × 14…24 e o 12 × 14…24 (faixas), as outras
  torres, o hotel, o escritório grande, os térreos com loja maiores. Até existirem, ficam no gerador velho.
