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
  As lojas já leem modelos em texto (`src/sim/layouts.ts`, 13.10c), que continuam valendo dentro da `o` do térreo.

## Os passos, em ordem (cada um com o seu commit e o seu teste)

1. **O catálogo na geração da cidade** (`src/sim/city.ts`).
   **Como os lotes nascem hoje (lido em 2026-10-08):** `split` (dentro do laço dos quarteirões, ~linha 730) corta o
   quarteirão ao meio recursivamente em `bays(lw * t)` (múltiplos de 2 m, t entre 0,35 e 0,65) até `maxLot`
   (`K.lot + K.lotCore * core`); `lots()` marca como aberto o lote com lado < 8 m e junta lotes sem rua ao vizinho.
   **A regra sugerida:** a **largura na rua** é que precisa ser do catálogo (8, 10 ou 12 m; torres 16–24), porque o
   **fundo** já se ajusta pelas linhas `*` (é preciso dar faixas `*` a todas as famílias, de 8 a 24 m). Todo trecho
   par ≥ 16 m se escreve com 8, 10 e 12 (16 = 8 + 8, 18 = 8 + 10, …); um trecho de 14 m vira 12 m + 2 m de vão
   (um beco de ventilação, comum em 2008). Então: no `split`, ao cortar ao longo da rua, escolher o corte entre
   as larguras do catálogo, não por `t`. A junção de lotes de `lots()` (o vizinho sem rua vira os fundos) pode
   gerar fundos fora do catálogo: limitar o fundo a 24 m ou fazer o resto virar quintal.
   Antes, medir quantos lotes mudam de tamanho e se o motel/cybercafé continuam (o `tests/city.ts` já confere). O lote de cada prédio com interior é arredondado para o
   tamanho do catálogo mais perto (a tabela da seção 3 do manual; torres em 16 × 16, 16 × 24, 20 × 20, 24 × 24,
   24 × 32). Prédios sem planta desenhada para o tamanho/estilo continuam no gerador velho até a planta existir
   (a lista do que falta está na seção 11 do manual). Teste: `tests/city.ts` em 5 sementes, contando quantos prédios
   ficam fora do catálogo (a meta é 0) e se o motel com o cybercafé a 300–500 m continua existindo.
2. **Ler a planta** (`planFromFloor` novo em `interior.ts`, no lugar de `makePlan` para os prédios do catálogo).
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

## Riscos e o que conferir

- **A cidade muda em cada semente** (o catálogo mexe nos lotes): os saves de teste não importam (decidido), mas as
  "posições de ouro" e os `.bat` de teste com `POS` podem cair dentro de paredes; refazer.
- **O render lê a planta pela GPU** (`putPlan` em `gpu/world.ts`): manter o formato `Plan` (células, salas, móveis)
  para não mexer no shader no passo 2; só a origem dos dados muda.
- **Desempenho:** `planOf` é chamado sob demanda e em cache; ler texto é mais barato que o gerador de hoje.
- **Fora do catálogo hoje:** o 10 × 14…24 e o 12 × 14…24 (faixas), as outras
  torres, o hotel, o escritório grande, os térreos com loja maiores. Até existirem, ficam no gerador velho.
