# Plano técnico: o rework dos interiores pelo manual

> Escrito em 2026-10-08, no fim da sessão do manual de interiores. É o passo (2) da ordem antes da etapa 16
> (manual → **rework dos interiores** → rework das pessoas → 16). Absorve as subetapas 13.10c, d, d2, g e h.
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
3. **Mobiliar pela biblioteca** (no lugar de `furnish` para as casas): para cada cômodo, as arrumações do mesmo
   contorno (o `frame` da arrumação, girado/espelhado) e escolher pela renda e pelo jeito do morador (`citizens.ts`;
   `homeUnit` ainda não existe, é preciso criar). Letras → `FurnKind`: B bed, A shelf (alto), Q desk, h chair,
   F sofa, r sofa (poltrona: tamanho 1), T tv, t table, K counter, O oven, N counter (pia), G fridge, V toilet?
   (precisa de `basin`), C toilet, H tub (chuveiro 2 × 2), P plant, w washer, y dryer, S shelf, X/Z/U novos.
   Rodar `checkArrangement` de novo depois de girar (deve passar sempre; se não passar é bug do giro).
4. **A escada volta** (decisão da entrevista: escada em todos; elevador só com 6+ andares). O desenho do poço está
   dormente em `render/interior.ts` (nenhum cômodo `stair` era gerado desde 2026-10-01) e no shader (`roomWalk`).
   Subir e descer: como o elevador hoje muda `v.floor`, a escada muda o andar ao chegar no patamar. **Medir antes**
   (o shader é caro de compilar). Telhado: a planta T1 (laje `x`, casinha da escada, parapeito).
5. **Interruptores (R10, 13.10g):** um por cômodo, na primeira parede que não é vidro, do lado da maçaneta; sala vazia
   e loja fechada apagadas.
6. **Testes:** `tests/plans.ts` (as invariantes de hoje) passa a rodar também `checkFloor` nas plantas lidas do jogo
   (depois de girar e converter), numa semente inteira. É o que garante "nada quebrado": a mesma regra no manual,
   no JSON e no jogo.

7. **Os tipos que faltam (decidido com o usuário em 2026-10-08: o leitor primeiro, depois desenhar estes no manual
   e só então ler no jogo):** o leitor dos passos 1–2 serve a todos, então nada se refaz. Faltam desenhar: **hotel**
   (saguão + andares de quartos), **banco** (hoje na loja genérica), **delegacia** (a prisão da etapa 16: balcão,
   cela, sala de interrogatório, o caderno da fiança), **galpão industrial** (os lotes de 30 m), **estacionamento**,
   **oficina** (`autoparts`), **escritório grande e as outras torres**, e plantas de loja próprias para os que caem na
   genérica (farmácia, penhores, eletrônicos, celulares, livraria, alfaiate). O cinema fica para depois da 1.0.

## Riscos e o que conferir

- **A cidade muda em cada semente** (o catálogo mexe nos lotes): os saves de teste não importam (decidido), mas as
  "posições de ouro" e os `.bat` de teste com `POS` podem cair dentro de paredes; refazer.
- **O render lê a planta pela GPU** (`putPlan` em `gpu/world.ts`): manter o formato `Plan` (células, salas, móveis)
  para não mexer no shader no passo 2; só a origem dos dados muda.
- **Desempenho:** `planOf` é chamado sob demanda e em cache; ler texto é mais barato que o gerador de hoje.
- **Fora do catálogo hoje:** o 10 × 14…24 e o 12 × 14…24 (faixas), as outras
  torres, o hotel, o escritório grande, os térreos com loja maiores. Até existirem, ficam no gerador velho.
