# Plano: os manuais de identidade no jogo (15.16 a 15.21)

> Planejado em 2026-10-07, depois dos cinco manuais (`docs/identidade/`: celular, notebook e Osprey, fabricantes, Ferret, Jackdaw) e do da GridLink. O Plano do CLAUDE.md tem uma linha por subetapa; o detalhe técnico fica aqui. Ao fechar uma subetapa, o texto dela vai para `docs/historico.md`. A numeração começa em 15.16 porque o CHANGELOG já usou até a 0.15.15.

## A ordem geral, e por quê

| Subetapa | O quê | Depende de | Onde testar |
|---|---|---|---|
| **15.16** | Telas como textura própria (a fundação das três telas) | — | PC (WebGPU) |
| **15.17** | O Ferret e a web de 2008 (manual do Ferret) | 15.16 | Node + PC |
| **15.18** | Os fabricantes no código (manual dos fabricantes) | — | Node (dá para a nuvem) |
| **15.19** | Os objetos de cubinhos na GPU e o celular em 3D (manual do celular) | 15.16, 15.18 | PC |
| **15.20** | O notebook em 3D e o Osprey (manual do notebook) | 15.16, 15.18, 15.19 | PC |
| **15.21** | O Jackdaw Mini, a fundação não-hacking (manual do Jackdaw, `docs/dispositivo.md`) | 15.16, 15.19 | PC |
| etapa 19 | Os apps de hacking do Jackdaw e os GridLinks `[HACKING]` | 15.21 | agente `hacking` / Opus 4.8 |
| gradual | A GridLink no mundo (abertura, caixas nos postes, vans, conta, site) | ver abaixo | — |

- **Por que as telas primeiro:** os três aparelhos pedem a mesma coisa (a tela como textura própria, nítida e inclinada com o corpo, que recorta o ASCII do mundo). Feita uma vez, serve ao notebook (1280 × 800), ao celular (240 × 400) e ao Jackdaw (128 × 64). Ela estava na etapa 20 ("telas em perspectiva"); sobe para cá.
- **Por que o Ferret antes dos corpos:** o navegador é o centro do laço da 1.0 (receber trabalho, ver a cidade reagir) e só precisa da tela, não do corpo novo. O usuário pediu o Ferret primeiro.
- **Por que os fabricantes antes dos corpos:** o nome no aro do celular e na tampa do notebook é um decalque das fontes de pontos de cada família; os dados (`MAKERS = 4`, séries por família) são pequenos e testáveis no Node.
- **Por que o celular antes do notebook e do Jackdaw:** é o objeto que está sempre na tela, e o pipeline de cubinhos nasce nele (o maior: 4–5 mil cubos de face, grade de 1 mm). **Muda a regra antiga** ("1º alvo dos cubinhos: os carros, etapa 20"): o 1º alvo passa a ser o celular; os carros vêm na etapa 18 já com o pipeline pronto.
- **O Osprey pode adiantar:** a barra de cima, as bordas em HD e os selos do firmware só precisam da 15.16 (não do corpo). Se sobrar fôlego depois da 15.17, a 15.20a vem antes da 15.19.
- **Depois da 15.21: a etapa 16** (NPCs usando a cidade), como no Plano.

## 15.16 Telas como textura própria

**O quê.** Cada aparelho tem a sua tela como uma textura de pixels (notebook 1280 × 800; celular 240 × 400; Jackdaw 128 × 64), desenhada pelo programa do aparelho e amostrada pela GPU na resolução do monitor: o contorno da tela recorta o ASCII do mundo, e dentro dele os pixels aparecem nítidos e inclinados junto com o aparelho (a técnica de "telas em perspectiva" de `docs/visao.md`). Hoje a tela do notebook é uma grade de caracteres (160 × 50, `term` em `gpu/compositor.ts`, enviada em `tmCells`/`tmBg`), a do celular passa pela grade da interface com o `HdLayer` de 3 × 3 px por célula (`render/hd.ts`, `Lcd.hd`), e o Jackdaw não existe.

**Como.**
- **`src/render/screens.ts`** (novo): um registro de telas `{ id, w, h, px: Uint8ClampedArray, dirty: [y0, y1], quad: 4 cantos na tela do monitor, emit, lit }`. O aparelho pinta em `px`; o render sobe só as linhas sujas.
- **Texto na tela:** quem tem console (o notebook, o Ferret) continua escrevendo numa grade de células, e um rasterizador de glifos (`screens.ts`, com a fonte em bitmap gerada por código, 8 × 16 no notebook) passa as células para os pixels. Assim a 15.17 ganha a ordem fundo → HD de fundo → glifos → HD de frente. **O `HdLayer` ganha tamanho de célula próprio** (`cw`, `ch`) e vira a camada de cada tela (8 × 16 no notebook); o 3 × 3 da interface continua igual.
- **GPU:** cada tela é uma **textura** `rgba8unorm` (o notebook, 4 MB), nunca um storage buffer (o shader já está acima do limite de 8; ver "Arrumar o shader"). `writeTexture` só das faixas sujas. Um passe por tela: um quadrilátero com os 4 cantos projetados (`glass` já existe para o notebook), amostragem bilinear para ficar nítido inclinado, o brilho e o reflexo do vidro por cima (a regra "efeitos por cima" e o `HALO_TINT`).
- **Luz:** a tela emite (`emit`, a cor média para a luz nas mãos e no teclado, como `VIEW_LIGHT` faz hoje) e, apagada ou com a luz de fundo desligada (o LCD do Jackdaw), segue a luz da cena (`lit`).
- **Longe:** quando o quadrilátero fica pequeno (menos de ~6 células), a tela vira caracteres pela regra do texto no mundo (a cor média; depois um caractere).
- **Migração, nesta ordem:** o notebook (a grade `term` vira textura; o `glRenderer.ts` antigo só se ainda for usado), depois o celular (o `Lcd` pinta direto em 240 × 400, o desenho em caracteres fica como plano B). O Jackdaw nasce já assim (15.21).

**Conferir.** `DEBUG.screenTest`: um padrão em cada tela, de frente, de lado e de longe; `DRAW` antes e depois (a tela parada não sobe nada). O usuário confere no PC.

## 15.17 O Ferret e a web de 2008 (manual `ferret-manual.html` v2)

### Decisões que valem para todas as subetapas do Ferret

- **O manual é a referência visual.** Na dúvida sobre cor, tamanho ou ordem, abrir a seção do manual e copiar. O que o motor não conseguir fazer igual, anotar aqui e perguntar ao usuário, em vez de inventar.
- **Sem cache (decidido pelo usuário em 2026-10-07).** O índice do Lookwise guarda só título e trecho, nunca a página. Um site no escuro **não abre**: o furão cava até o tempo esgotar. Ver os sites caindo é como o jogador sente o estrago do apagão, e "derrubar um site" vira objetivo de trabalho (Trilha de hacking, ver o fim).
- **Apagão = tempo esgotado, como o código já faz** (`fetchUrl` devolve `error: 'down'` pelo `subAt` do prédio e o `Browser` espera `TIMEOUT = 8` s). "Server not found" fica para o endereço que não existe (`error: 'dns'`).
- **Três camadas por página:** o fundo em HD (brilho, abas, biséis, ladrilhos, sombra da coluna), desenhado **antes** dos glifos; o texto nas células; a frente em HD (fotos, anúncios, mapa, estrelas, ícones, selos), desenhada **depois** e só sobre células vazias.
- **Tudo é código:** fotos, mapa, ícones e logos são pintados por funções a partir da semente e dos dados da simulação; nada de PNG.
- **A simulação não conhece a tela:** `src/web/page.ts` e `sites.ts` continuam puros (sem DOM, sem GPU). Eles devolvem **operações de desenho** em coordenadas de célula; quem as rasteriza é o render.
- **Testar no Node o que não é visual** (`tests/`, empacotado com `npx rolldown`): o layout devolve as operações certas, o índice muda de madrugada, os resultados locais vêm por distância, o site apagado dá `down`. O visual é conferido pelo usuário no PC (a nuvem não tem WebGPU).
- **Medir antes e depois** (`DRAW` na linha de status): as páginas só se redesenham quando mudam; o HD sobe só as linhas sujas.

### Ordem dentro da 15.17

```
15.16 telas como textura ──► 15.17b pintor 2D ──► 15.17c moldura e Ferret ──► 15.17d estados e erros
                                          └─► 15.17e blocos com camadas ──► 15.17f moldes
                                                                          ├─► 15.17g canônicas
                                                                          └─► 15.17h Lookwise
15.17i Ferret Mini (celular) e 15.17j selos e Burrow Labs: depois de f–h
```

(Não há 15.17a: a superfície de pixels virou a 15.16, comum às três telas.)

---

### 15.17b Pintor 2D (`src/render/paint2d.ts`)

**O quê.** As funções que o kit do manual usa, escritas em TypeScript puro sobre um `HdLayer` (sem canvas, para rodar no Node e no worker): retângulo, retângulo arredondado, degradê vertical e horizontal (com paradas), linha (com espessura), círculo e elipse cheios e em anel, polígono (a estrela do "NEW!"), mistura com alfa sobre o que já está na camada, e um recorte (o retângulo da página na janela).

**Detalhes.**
- Antisserrilhado barato: cobertura 2 × 2 nas bordas de círculos e cantos; o resto é pixel cheio (o visual de 2008 era serrilhado mesmo).
- **Texto em HD** (títulos grandes, o WordArt, a manchete do herói, o "Hoo?"): fonte de bitmap gerada por código. Começar pela 5 × 7 de `fontRows` (`signs.ts`), ampliada com suavização de cantos; uma segunda fonte, mais grossa, se a 5 × 7 ficar pobre (perguntar ao usuário com uma captura).
- **Imagens pequenas pintadas** (`paintPhoto`, `paintMap` do manual): portar para funções que escrevem num `Uint8ClampedArray` em baixa resolução (≈ 4 px por célula de largura) e uma cópia ampliada por vizinho mais próximo para a camada. Guardar em cache por `(url, índice)` num `Map` limitado (as fotos não mudam enquanto a página está aberta).
- O grão da câmera sai de `hash3`, nunca de `Math.random` (determinismo).

**Conferir.** `tests/paint2d.ts`: cada primitiva num `HdLayer` pequeno e um somatório (hash) dos pixels; a mesma semente dá a mesma foto.

### 15.17c A moldura e o nome Ferret

**O quê.** O navegador vira o do manual (seções 4 e 5): **Ferret 2.0** (`NAME` em `web/browser.ts`), a moldura prata com abas, navegação em 2 linhas, favoritos e status; o furão animado no canto.

**Como.**
- `Browser` ganha **abas**: `tabs: TabState[]` (cada uma com `url`, `back`, `got`, `laid`, `at`, `top`, `sel`, `vals`), `cur`; Ctrl+T, Ctrl+W, Ctrl+Tab e o "+" (já estavam nos retoques da 15).
- **Favoritos** de fábrica: Lookwise, o webmail, o portal, "Ferret Help" (a página do Burrow Labs, 15.17j); Ctrl+D acrescenta; guardar no save do notebook (`laptop.save`). O fórum nunca vem de fábrica. Os atalhos de debug ficam marcados (retoques da 15).
- **Links visitados em roxo**, pelo histórico das abas (retoques da 15).
- A moldura desenhada no `termHd` (`Under`) com o texto nas células: o voltar redondo de 28 px, avançar, recarregar/parar, início, o campo do endereço (amarelo com cadeado em https), a busca do Lookwise com o ícone da coruja.
- **O furão** em HD, 28 px, quatro estados (espiando, cavando em 6 quadros a ~8 fps, saindo, perdido). Desenhado à mão em pixels a partir do vetor do manual (como os ícones de 16 e 32 px), um quadro por estado; trocar pelo `at` do carregamento, nunca por enfeite.
- **Sons** sintetizados (`audio.ts`): o "tum" grave do voltar, o clique das abas. O teste de ouvido é do usuário.
- **Renomear:** `src/web/browser.ts`, `src/locale/en.json`, `laptop/wm.ts` (o título da janela), o comando `ferret` no `shell.ts` com `lodestar` como apelido escondido (só a linha do nome, pela emenda segura de `docs/mapa-shell.md`; `syncPrograms` re-instala o binário nos saves antigos).

**Conferir.** `tests/browser-tabs.ts` (abrir, trocar, fechar, voltar por aba; favoritos no save). Visual no PC.

### 15.17d Estados e erros

**O quê.** As páginas do próprio Ferret (manual, seção 6), com o furão perdido.

- Carregando: "Looking up host…", "Connecting…", "Waiting for…", "Transferring data from…", "Loading 24 of 52 items…" (os itens são as fotos e anúncios da página, ver 15.17e); a barra de progresso marrom-terra; a velocidade em kB/s.
- **Apagão → tempo esgotado** (já é `error: 'down'`): o furão cava 8 s e cai em "The connection has timed out".
- Endereço inexistente → "Server not found" (`error: 'dns'`).
- Sem rede → "Offline" (`this.offline`).
- **Certificado:** novo `error: 'cert'` para sites https com certificado vencido (por semente: alguns sites pequenos de https; o webmail e o banco grande nunca). Faixa amarela, "This Connection is Untrusted", "Add Exception…" deixa entrar e guarda a exceção por host.
- 404 continua do próprio site, nas cores dele.

**Conferir.** `tests/web-errors.ts`: apagar a subestação de um site e conferir `down`; voltar a luz e conferir que abre. Uma host inexistente dá `dns`.

### 15.17e Blocos com camadas (`src/web/page.ts`)

**O quê.** O modelo de página ganha as peças do kit, e o `layout` passa a devolver, além de `rows`/`links`/`fields`, as operações de HD.

**Como.**
- `Laid` ganha `back: HdOp[]` e `front: HdOp[]`, em coordenadas de célula da página (o navegador soma a rolagem e recorta na janela). `HdOp` é um tipo de dados (`{ k: 'gloss', x, y, w, h, col }`, `{ k: 'photo', x, y, w, h, subj, seed }` …), nunca uma função, para o layout continuar puro e testável.
- `Theme` ganha `tile` (o ladrilho do fundo), `gloss` (se as barras brilham) e `era` (1998, 2001, 2003, 2005, 2008, `bare`), que decide quais peças um bloco usa.
- Blocos novos: `photo`, `map`, `stars`, `burst`, `rss`, `icon`, `hero` (manchete grande + foto com reflexo + botão), `tabs` (o menu em abas), `box` (caixa arredondada com título em degradê), `marquee`, `badges`. O `ad` que já existe passa a ser o anúncio desenhado (468 × 60 na proporção da coluna) com o botão que pisca.
- **As imagens chegam depois do texto**, como em 2008: o `kb` da página soma o peso das fotos e anúncios; o navegador mostra cada operação de frente só quando os bytes dela chegaram ("Loading 24 of 52 items…").
- O pisca e o letreiro correm pelo relógio do jogo (`now`), não por `setInterval`.

**Conferir.** `tests/web-layout.ts`: uma página com cada bloco; as operações caem nas células certas, nenhuma operação de frente fica sobre texto, os links continuam onde estavam.

### 15.17f Os seis moldes como anos da web (`src/web/sites.ts`, `bizPage`)

**O quê.** Refazer `bizPage` pela tabela da seção 8 do manual: Center = 1998, Classic = 2001, LeftNav = 2003, Side = 2005, Corporate = 2008, Bare = hospedagem grátis.

**Como.**
- O molde continua sorteado entre os prováveis do tipo (`TPLS`, `h(n)` pela semente da empresa); cada molde monta os seus blocos com a `era` certa.
- **Foto pelo tipo do lugar:** a tabela `GROUP` do manual (`food`, `store`, `bar`, `tech`, `room`) liga ao `PLACES` de `sim/placeTypes.ts`; a semente é a da empresa.
- **Conteúdo da simulação:** horário e "OPEN NOW" (`isOpen`), endereço (`addressOf`), o que vendem com preço (`PLACES[kind].sells` e os preços da 13.1), a oferta do dia pela gramática (`locale/text/`, `#web.special.<kind>#`), as notícias do blog pelos eventos da cidade perto da loja.
- **Anúncios de empresas que existem:** escolher em `city.businesses` (pela semente e pelo dia); na etapa 17 o anúncio vira um gasto da empresa e some quando ela vai mal.
- O mapa do "Find us" usa o raster do Maps (`phone/mapdata.ts`, `mapRaster`/`groundAt`) recortado em volta do endereço, com o pino.
- Textos novos entram como peças da gramática (regra "toda frase pela gramática").

**Conferir.** `tests/web-sites.ts`: para 200 empresas da semente 42, todo site monta sem erro, cada molde aparece, a foto bate com o tipo, nenhum anúncio é da própria empresa. `tests/sample-sites.ts` grava uma amostra de páginas em texto para o usuário ler.

### 15.17g As páginas canônicas

- **Portal** (`portalPage`): brilho, o anúncio do provedor, a manchete com foto (o assunto pela notícia: apagão → cidade escura, batida → rua), o tempo com o ícone (`sim/weather`), a busca com a coruja, o diretório. **As ações só depois da etapa 17** (sem provisório).
- **Streetwire** (`web/streetwire.ts`): o selo "beta", a caixa "What are you doing right now?", **avatares tirados da aparência do cidadão** (`pedLook`: pele, cabelo, roupa viram o rosto pixelado), a foto do post quando houver, os assuntos em alta pelas palavras dos posts do dia.
- **Webmail** (`web/webmail.ts`): o login em caixa com degradê, os campos afundados, o botão aqua, o "25 MB!".
- **GridLink** (o site da empresa de energia e telefone fixo, pelo manual `manual.html`: a marca sem a pichação, POWER · TELECOM, o mapa dos 9 setores, "report an outage"); fora do ar quando o setor dela apaga.
- **Switchboard** (`web/forum.ts`, a casca normal): pastas acesas para tópicos novos, barras de categoria, "Who is online". O conteúdo (`locale/forum.ts`) é `[HACKING]` e não muda aqui.

### 15.17h O Lookwise com a coruja (`searchPage`, `indexOf` em `sites.ts`)

- **Logo e ícone** em HD pelo pintor 2D (os dois "o" como anéis com a íris âmbar, tufos, bico); o ícone de 16 px do manual vai para a aba, os favoritos e a busca da moldura.
- **Páginas:** a inicial (logo, frase, campo, "Lookwise Search" e "Owl's Pick"), os resultados (locais com mapa e pinos A–C, a web com o trecho em negrito, os patrocinados à direita, a paginação de pares de olhos) e o "Hoo?" sem resultado.
- **O índice de madrugada:** hoje `indexOf` é feito uma vez por cidade (`WeakMap`). Passa a ser refeito uma vez por noite, quando o relógio cruza as 3 h, juntando as páginas iniciais das empresas, as seções do portal, **os posts públicos do Streetwire e as manchetes do dia**. Entre 2 h e 5 h a página inicial mostra a coruja voando e a conta do que entrou. Medir o tempo de montar; se passar de alguns ms, espalhar por quadros (ver o bug "Travada à meia-noite").
- **Sem cache:** o resultado de um site apagado continua listado (o índice é de ontem); o clique dá tempo esgotado.
- **Locais:** as empresas do tipo buscado mais perto do ponto de acesso em que o notebook está (`sim/wifi.ts`), por distância.
- **Patrocinados:** três empresas pela semente e pelo dia (na 17, por orçamento).
- **A coruja animada** (estados do manual): parada seguindo o cursor do campo, procurando enquanto a busca lenta trabalha (a busca ganha um tempo de servidor), achou, "Hoo?".

**Conferir.** `tests/lookwise.ts`: um site novo só aparece depois das 3 h; o post do dia entra no índice da noite seguinte; locais ordenados pela distância do AP; site apagado listado e `down`.

### 15.17i Ferret Mini (celular)

- `phone/webapp.ts`: "Lodestar Mini" vira **Ferret Mini**; a moldura mínima do manual (faixa marrom-terra com o endereço, teclas de função), o furão como um ponto que cava.
- O aviso de preço antes da página pesada ("This page is about 120 KB and may cost $0.60 of data. Continue?"), pelo `kb` da página e a tarifa da operadora.
- Usa a camada HD do celular (`Lcd.hd`) com o mesmo pintor 2D; as páginas `mobile` ficam leves (sem fotos grandes); a página inteira chega espremida e cara.

### 15.17j Os selos e a Burrow Labs

> **Feito em 2026-10-07.** Mudança do plano, decidida com o usuário: a Burrow Labs **não** fica em cima da lavanderia (o Ferret é o navegador de todo mundo, e uma empresa de fundo de quintal destoava dos selos nos sites grandes). Meio-termo: começou numa sala sobre uma lavanderia em 2004 (a história no "About"), hoje é um andar de um prédio de escritórios (`burrowHome`: um `Workplace` de escritório pela semente, a equipe = 10 do `staff`). Um modo/plugin escondido que os hackers conhecem fica para a etapa 19 (`[HACKING]`).

- Os selos de 88 × 31 (manual, seção 9) como operações de HD de frente, pela semente e pelo molde ("Best viewed with Ferret", "Get Ferret", "Valid HTML 4.01", o contador que cresce com o tempo de jogo, o "under construction" com 2 quadros, o "powered by" do provedor).
- **burrow-labs.net:** o site da empresa (o "Get Ferret", as notas de versão, o fórum de bugs), num prédio de escritórios de verdade, para cair no apagão como os outros. É o "Ferret Help" dos favoritos.

---

## 15.18 ✅ Os fabricantes no código (manual `fabricantes-manual.html`, seção 11; feito em 2026-10-07, detalhe em `docs/historico.md`)

- **Dados** (`sim/device.ts`, `sim/computer.ts`, `locale/names.ts`): `MAKERS = 4` e `LOOK_MAKER = [0, 1, 0, 2, 3, 2]` (o índice é a família: gigante, executivo, moda, robusta); `SERIES` por família, com o formato de cada uma; `LAPTOP_MAKERS` com papel (0 = o de trabalho, sempre o do jogador; 1 = o de vitrine); a operadora 0 (a megacorp) com o nome cunhado (`coin`: a 1ª sílaba da raiz + um sufixo de corporação); `watchMakerName`, `cctvMakerName` e `BOARDS` só ganham símbolo e tipografia.
- **Fontes de pontos por família** (`render/signs.ts`, ao lado da 5 × 7): o "jeito" de cada tipografia (estêncil com cortes, fina arredondada, condensada…) em bitmap gerado por código, para letreiros de perto e decalques nos aparelhos.
- **Símbolos de 16 × 16 com 4 variantes pela semente**, desenhados em pixels, para as fachadas, as telas de abertura e os decalques.
- **Saves:** a mudança de `MAKERS` muda a marca dos aparelhos já sorteados; a população fica em cache por hash do código (`popCache.ts`, `?raw` de `device`), então ela se refaz sozinha. Conferir se algum save guarda o índice do fabricante.
- **Conferir:** `tests/makers.ts` (a semente 42 dá as 4 famílias, nomes estáveis, a megacorp com nome cunhado). Dá para fazer na nuvem.

## 15.19 Os objetos de cubinhos na GPU e o celular em 3D (manual `celular-manual.html`)

**15.19a ✅ (2026-10-07, na CPU para o aparelho na mão, em pixels HD; ver `docs/historico.md`) O pipeline de cubinhos** (a regra "objetos de cubinhos" das decisões):
- Um modelo é uma **grade de ocupação** (bits por célula de 1 ou 2 mm) com uma paleta por cubo, mais "caixas inteiras" para os miolos (o manual do celular: face em cubos de 1 mm, miolo em caixas). Gerado por código a partir do desenho (a cor no centro de cada casa), nunca de arquivo.
- Na GPU: os modelos ficam numa **textura 3D** (ou atlas 2D em fatias) e o raio de cada célula anda pela grade do modelo (DDA) dentro da caixa que a contém. É a "grade de ocupação por modelo" que a regra pedia acima de dezenas de cubos. Partes móveis (as teclas que afundam, a placa que desliza) são instâncias com transformação própria.
- **LOD por distância:** cubos < ~10 cm somem a 20 m; de longe o modelo vira as poucas caixas de hoje (`render/objects.ts`); mais longe, um caractere.
- Medir o custo por célula antes e depois (o celular ocupa boa parte da tela quando levantado).

**15.19b O celular**, pelo manual: o deslizante e os estágios pelo botão do meio/direito, a tela 240 × 400 como textura (já da 15.16), o fone, as variações por família (15.18), o nome do fabricante pintado sobre a face, de longe um caractere escuro com um ponto azul-gelo. `phone/draw.ts` e `phone/shells.ts` deixam de desenhar o corpo em caracteres; o `Lcd` continua dono do conteúdo da tela.
- **Depois disto:** o "repensar as interfaces para a camada HD" (os apps do celular usando a tela de pixels) e o caderno (etapa 22), que esperavam os aparelhos em 3D.

## 15.20 O notebook em 3D e o Osprey (manual `notebook-manual.html`)

- **15.20a O Osprey** (só precisa da 15.16; pode vir antes da 15.19): a barra de cima com os números simulados (áreas, título, rede, CPU, memória da máquina virtual, bateria, hora); as bordas das janelas em linhas finas no HD (a janela em foco em âmbar claro); as duas tintas (âmbar e verde); o logo "OSprey" em ASCII no boot; os selos do POST em HD (o firmware fica como está). Arquivos: `laptop/wm.ts`, `laptop/draw.ts`, `laptop/bios.ts` (não tocar nas faixas de hacking do `shell.ts`; ver `docs/mapa-shell.md`).
- **15.20b O corpo** em cubinhos (o tijolo inspirado no ThinkPad, 310 × 225 mm; hoje `DECK_D = 0.2` em `look3d.ts` vira 0,225 com o touchpad): teclas, nub âmbar, botões, dobradiças e LEDs como peças, cada uma com o seu som; a luz do teclado na tampa com tecla própria (vista de longe: as luzes do jogador o entregam); o desgaste e 1–2 adesivos pela semente.
  - **Plano técnico (2026-10-07, fim da sessão da 15.20a):** o passe do celular (`render/gpu/voxBody.ts`) é **ortográfico** (raios paralelos, `dir` constante, um retângulo na tela), o que serve a um objeto de frente para o olho. O notebook é visto **em perspectiva** pela câmera do `look3d.ts` (hoje partes em caixas, `drawObjects`, na resolução das células, e a tela encaixada pela homografia do vidro). Então:
    1. **Generalizar o raio do `voxBody`:** por pixel, `origem = olho no quadro do modelo` e `dir = normalize(F + R·u + D·v)` (uma flag por modelo: orto para o celular, perspectiva para o notebook). O resto (o DDA na grade, a paleta, a luz, o decal) fica igual. Conferir no Node antes com `castVox` ganhando o mesmo modo (`tests/phone3d.ts` como molde).
    2. **Dois modelos de 2 mm** (o celular usa 1 mm; a 2 mm o notebook dá ~155 × 113 × 10 por placa, ~175 mil células, contra 1,4 milhão a 1 mm): a **base** (caixa, teclas com 9 × 9 células e 1 de altura, que afundam como no celular; nub; os três botões do nub; o touchpad e os dois botões; a faixa de cima com vol−/vol+/mudo/luz e o botão de ligar com o anel de LED; os LEDs; o selo do Osprey e a etiqueta como decal) e a **tampa** (a moldura, a luz do teclado, os dois fechos, a marca do fabricante como decal pela família de `brands.ts`; o vidro com uma paleta própria, como o `GLASS_MAT` do celular, onde a textura da tela 15.16 é posta). A tampa gira na dobradiça: a sua matriz entra no uniform (o raio é levado ao quadro da tampa).
    3. **Juntar com a tela:** hoje o vidro é um quadrilátero projetado em `look3d.ts` (`glassBox`) e o compositor faz a homografia. Com a tampa em cubinhos, o mais simples é manter a homografia (os cantos do vidro vêm da mesma matriz da tampa), e só deixar o passe dos cubinhos pular a paleta do vidro.
    4. **LOD:** na mão, os cubinhos; na mesa a 1–3 m, as caixas atuais (`render/objects.ts`); de longe, a luz da tela (o manual, seção 10).
    5. **Peças e sons:** cada peça clicável pelo mouse, como o `pickBody` do celular (o id da paleta = a peça); os sons novos da tabela da seção 5 (vol, mudo, luz, nub, touchpad, rádio, disco, ventilador; o teste de ouvido é do usuário).
    6. **Desgaste e adesivos de fábrica:** as teclas gastas (W A S D, E, Enter, Espaço, Bksp, Ctrl) com 7% de brilho; 1–2 adesivos pela semente (bandas da cidade, empresas de `city.businesses`, símbolos), pintados num decal da tampa (`paint2d`), como no `drawLid` do manual.
  - **Ordem sugerida:** (1)+(2) só a base com as teclas (o que mais aparece) → a tampa e a dobradiça → as peças clicáveis e os sons → o desgaste e os adesivos. Medir o DRAW antes e depois (o notebook ocupa metade da tela).
- **15.20c Os adesivos do jogador:** a interface 2D da tampa na mochila (arrastar e colar), adesivos achados ou comprados, e os importados do PC (até 64 × 64, até 16 cores, borda branca, guardados no save como dados, pela pasta ao lado do jogo, como o cartão SD da música).
- **De longe:** poucas caixas na mesa, a tela como um retângulo âmbar, de noite só a luz.

## 15.21 O Jackdaw Mini, a fundação não-hacking (manual `jackdaw-manual.html`, `docs/dispositivo.md`)

- **O objeto:** cubinhos de 2 mm (55 × 25 de frente, 11 de espessura), o corpo amarelo com os cantos em degraus, as teclas, a alavanca, a tampinha de borracha e o LED como peças móveis; tirar do bolso como o celular; de longe 3 células, depois 1.
- **A tela 128 × 64** (já da 15.16), atualizada no máximo 10 vezes por segundo, seguindo a luz da cena com o fundo apagado.
- **O shell:** boot verboso, o menu de ícones pelo D-pad, a gralha na tela inicial (animações, `pet.react('win'|'fail'|'idle')`, `pet.collect(trofeu)`), arquivos do cartão SD, ajustes, bateria e as tomadas da 13.9c.
- **Apps não-hacking:** o controle de infravermelho para as TVs e os telões, a gralha como mini-jogo, a lanterna, o relógio, o tocador de tom.
- **A interface de apps** (`docs/dispositivo.md`, "onde as duas metades se encontram"): fica pronta e documentada aqui, para os apps de hacking da etapa 19 (agente `hacking`, Opus 4.8) só se encaixarem. Até lá o aparelho se obtém pelo debug (como o Reynard).
- **Sons:** todo botão clica; o chirp do boot; a gralha. O teste de ouvido é do usuário.

## A GridLink, aos poucos (manual `manual.html`)

Sem subetapa própria: cada peça entra junto do sistema em que ela aparece.
- **A abertura animada no título** (o roteiro de som do manual): a qualquer momento, numa sessão curta (`src/titleFx.ts`).
- **O site da GridLink** no Ferret: na 15.17g, como uma página canônica (a empresa de energia e telefone fixo; nunca celular).
- **As caixas nos postes com o código do setor** (os 9 setores da grade 3 × 3 de `sim/power.ts`): junto da 13.9 (placas e endereços) ou da etapa 16 (as pessoas reagindo a quem mexe nos postes).
- **As vans:** com os carros refeitos (etapa 18).
- **A conta** (energia e HOME PHONE, sem o 0179): quando o jogador tiver apartamento (etapa 22), pelo correio ou pelo webmail.
- **No ASCII e de longe:** a regra do texto no mundo (pontos de perto, uma letra por célula de longe).

## Depois: derrubar um site como trabalho `[HACKING]`

Fica para a Trilha de hacking (agente `hacking`, perguntando antes): um contrato cuja condição é "o site X fora do ar por N minutos", conferida pelo mesmo `fetchUrl` → `down`. **Nota de balanceamento (usuário, 2026-10-07):** se o apagão for fácil de fazer quando se quer, ele banaliza esses trabalhos. Ideias para a hora de balancear (não fazer agora): sites grandes hospedados fora do setor ou com nobreak (o banco, a operadora), o apagão deixando rastro no calor, e trabalhos que pedem derrubar **só** o site sem apagar o quarteirão.
