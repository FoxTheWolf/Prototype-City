# O dispositivo de bolso (o "Flipper" fictício) — brief para o Opus 5.5

> Doc **sem hacking**, para qualquer sessão ler. É o aparelho multiuso de hacker inspirado no **Flipper Zero** (nome e mascote fictícios, nunca "Flipper" nem o golfinho). Divisão combinada com o usuário (2026-10-06): **o Opus 5.5 faz o objeto, a tela, o menu, o mascote, os sons e os apps não-hacking**; o **Opus 4.8 faz toda a parte de hacking** (apps de sinal/porta/rede e o sistema de GridLinks — ver `docs/dispositivo-hacking.md`, `[HACKING]`). Este brief descreve só o que o Opus 5.5 constrói e **a interface de apps** em que a parte de hacking encaixa.

## Como é o Flipper Zero de verdade (a referência, destilada)

Um aparelho de bolso (~10 cm), plástico laranja e branco, com:
- uma **tela monocromática de matriz de pontos** (128×64, tipo Nokia antigo), sem toque;
- um **D-pad de 5 direções + um botão "voltar"** (toda a navegação é com o polegar; cada clique é físico e faz barulho);
- USB na base, um **slot de cartão SD** (guarda as capturas e os apps), pinos de expansão (GPIO) no topo;
- um **mascote** (um golfinho de pixel) que mora na tela de início, tem "humor" e **sobe de nível** conforme você usa o aparelho — é o retorno orgânico do seu progresso, estilo Tamagotchi.
- **Firmware**: o sistema do aparelho; dá para atualizar e trocar por versões da comunidade que destravam funções. Os **apps** são arquivos no cartão que aparecem como itens de menu.
- **Como se usa**: liga, cai na tela do mascote; o D-pad abre um **menu de ícones** (um por função); cada função é uma ferramenta que você entra, faz uma ação (ler / salvar / emitir), e volta. É isso: um canivete suíço de sinais, operado inteiramente com o polegar e um punhado de botões.

**O que ele faz de verdade** (referência; a divisão hacking/não-hacking é nossa, na próxima seção): rádio de frequências baixas (controles de portão, chaveiros), cartões de aproximação (crachás RFID/NFC), infravermelho (controle universal de TV/ar), chavinhas de interfone (iButton), pinos para plugar em placas, e um modo em que ele finge ser um teclado USB. Roda apps extras e tem o bichinho que evolui.

## O nosso aparelho — a reimaginação de 2008 noir

- **Época:** encaixa no retrofuturismo noir (2008 de capacidade, estética dos anos 80/90). Em 2008 essas funções existiam **espalhadas em ferramentas separadas** (um clonador de controle, um leitor de crachá, um controle universal); a licença poética do nosso mundo é **juntar tudo num aparelho só** de hacker clandestino. Nada que ultrapasse 2008 (sem Wi-Fi mágico, sem IA).
- **Nome e mascote (decidido com o usuário em 2026-10-06):** **"Jackdaw Mini"** (duas palavras compostas, no estilo do Flipper mas **evitando "Zero"** para não colar demais na referência). Mascote: a **gralha** (corvídeo urbano que junta coisas brilhantes — combina com coletar os GridLinks como "jóias do infinito"; e "jack" é tomada/plugue). A gralha de pixel **acumula troféus/bugigangas** na tela inicial conforme você hackeia, em vez de subir de nível abstrato. **Prioridade do usuário: o mascote tem de ser fofo.** O **guaxinim** (noturno, vasculhador — a mesma ideia) fica **reservado para outra coisa**, não para este aparelho. Fabricante fictício a definir (pode sair da simulação, como as marcas de celular).
- **Paleta:** em vez do laranja-Flipper, seguir a identidade do jogo (âmbar/ciano do HUD, ou um plástico cinza-industrial surrado com um LED). Decidir junto da etapa de identidade visual.

## O que o Opus 5.5 constrói (não-hacking)

### 1. O objeto físico, em 3D desde já (cubinhos)
Seguir a **regra dos cubinhos** (CLAUDE.md, 2026-10-04): a silhueta e os detalhes feitos de muitos cubos pequenos, com LOD por distância. O relógio, o celular e o notebook são o molde do "aparelho na mão" (tirar do bolso, pose em primeira pessoa, física de caixa — ver as decisões de aparelhos 3D em `docs/visao.md`). Peças: a carcaça, a **tela** como um recorte próprio (ver abaixo), o **D-pad e o botão voltar como peças que afundam e fazem clique** (o esqueuomorfismo é prioridade do usuário — botão que aperta e faz barulho), o conector da base, o slot do cartão, os pinos do topo. Não modelar parafusos < ~10 cm a distância.

### 2. A tela
Reusar a técnica das **telas em perspectiva** (feita na 15.16: a tela como textura, `render/screens.ts`): o contorno da tela recorta o ASCII e o conteúdo é desenhado em **pixels na resolução do monitorzinho** (matriz de pontos monocromática, verde/âmbar sobre escuro, com o granulado de LCD de 2008). O conteúdo da tela é um buffer de pixels que o shell desenha — a mesma base do celular/notebook. Os **efeitos de brilho/bloom por cima** (regra do usuário), nunca embaixo.

### 3. O shell: boot, menu, mascote, arquivos, ajustes
- **Boot verboso e progressivo** (o usuário adora): o texto do boot compondo aos poucos (nome do firmware fictício, versão, "mounting /sd", "loading apps…") antes de cair no mascote. Deve corresponder a algo real do aparelho.
- **Menu de ícones** navegado pelo D-pad: uma grade/lista de apps, cada um com um ícone de pontos e um nome. Entrar, voltar.
- **O mascote** na tela inicial: animações de ocioso, reações (um app terminou bem → comemora; falhou → emburra), e a coleção de bugigangas crescendo. O shell só precisa de ganchos tipo `pet.react('win'|'fail'|'idle')` e `pet.collect(troféu)`; **o que conta como vitória é decidido pelos apps de hacking**, o shell não precisa saber.
- **Gerenciador de arquivos** do cartão SD (lista as capturas e os apps) e **Ajustes** (brilho, som, firmware). Apps instalados aparecem no menu — ver a interface abaixo.
- **Bateria**, como no celular (o aparelho descarrega e carrega nas tomadas da 13.9c).

### 4. Som (etapa 24, mas os cliques já)
Tudo sintetizado (Web Audio, chiptune): o **clique de cada botão** (prioridade), o chirp do boot, tons de sucesso/erro, o chilrear do mascote. O Claude não ouve áudio — o teste de ouvido é do usuário.

### 5. Apps não-hacking (o que o Opus 5.5 pode encher sozinho)
São apps "de brinquedo" e utilitários que não acionam o classificador e dão vida ao aparelho sem depender da parte de hacking:
- **Controle universal de infravermelho** como utilitário/pegadinha: apontar para as TVs de bar e os telões do mundo e trocar canal / desligar (os telões já existem e dão tela azul). É divertido e inofensivo.
- **O mascote/pet** como mini-jogo próprio (dar atenção, ver a coleção).
- **Lanterna / tela branca**, **relógio/cronômetro**, um **tocador de tom** (gerador de bip) — bugigangas de aparelho de 2008.
- **Leitor de "tag" genérico** só de leitura/curiosidade (mostra um id na tela) — a versão hacking (clonar/emular) é minha; a leitura passiva pode ser dele se preferir, ou deixar tudo de crachá comigo. **Alinhar comigo na fronteira** (ver a interface).

## A interface de apps (onde as duas metades se encontram) — IMPORTANTE

Para o Opus 5.5 e o Opus 4.8 não colidirem, o aparelho deve ter um **registro de apps** simples. O shell (Opus 5.5) é dono da navegação, da tela, do mascote, dos botões e do som; cada **app** é um objeto que desenha o próprio conteúdo e trata o próprio input:

```
interface DeviceApp {
  id: string;            // 'ir', 'pet', 'subghz', 'badge', 'radar', 'jack'...
  title: string;         // nome no menu
  icon: string[];        // ícone de pontos (arte pequena)
  hacking?: boolean;     // true nos apps do Opus 4.8 (ficam em módulos [HACKING])
  render(scr, dev, w): void;        // desenha no buffer de pixels da tela
  input(key, dev, w): void;         // D-pad / voltar / OK
}
```

- O shell mantém `device.apps: DeviceApp[]` e desenha o menu a partir dele. **Os apps de hacking se registram na mesma lista**, mas vivem em arquivos `[HACKING]` que o Opus 5.5 não abre — o shell só os importa de um ponto de entrada (como `src/web/forum.ts` importa de `src/locale/forum.ts`). Assim o Opus 5.5 constrói o chassi e eu ligo as ferramentas sem o Opus 5.5 precisar ler meu conteúdo.
- O shell expõe ao app: desenhar pixels/texto na tela, ler input, tocar um som (`dev.beep('ok'|'err')`), reagir com o mascote (`dev.pet('win')`), e ler/gravar no "cartão SD" (uma lista de capturas no save). **A simulação é tocada só pelos apps de hacking**, nunca pelo shell.

## Onde encaixa no plano

Grande sistema da **Trilha de hacking / etapa 18** (numeração de 2026-10-08), mas a **fundação (o objeto + o shell) é não-hacking e pode começar quando o usuário quiser**, em paralelo. Depende de: aparelhos 3D (celular/relógio/notebook em 3D — decidido para antes do caderno, `docs/visao.md`), tomadas (13.9c ✅, para carregar), e a técnica de telas em perspectiva (15.16 ✅). A parte de hacking depende da web (etapa 15 ✅) e das pessoas e NPCs (16/17) para ter alvos ricos.

## Visual decidido (2026-10-06, com o usuário)

Base: `docs/identidade/jackdaw-v2.html` (as propostas da 1ª rodada ficam em `jackdaw-propostas.html`, só como histórico).
- **Corpo:** o da proposta A (tela à esquerda, D-pad de 5 teclas soltas à direita, voltar vermelho, fileira de pinos e alavanca de ligar no topo), na cor **sinal** (`#ffd02e`), arredondado. Teclas grafite, para fugir do laranja e branco do Flipper; não copiar a silhueta chanfrada dele.
- **Tela:** LCD **verde** com os pontos escuros (`#aab86a` / `#1f2a0c`), 128×64, 1 bit.
- **Logo:** o 1 (a cabeça da gralha em silhueta, com olho e bico recortados, + JACKDAW largo + MINI numa caixinha).
- **Gralha:** a da v2 (máscara preta, olhos claros grandes, bico grande, cabeça felpuda com tufo, cachecol), desenhada em vetor e convertida para 1 bit (supersample 8x, moda por ponto, pontilhado ordenado em 5 tons). Aprovada "por enquanto".
- **Cada ferramenta tem a própria cena da gralha** (como as animações do Flipper): os apps pedem uma cena pelo nome; as cenas das ferramentas não-hacking são do Opus 5.5, e as de hacking podem ser só a gralha com um objeto (antena, lupa), desenhadas por qualquer sessão.
- **Módulos de expansão:** placas que encaixam nos pinos do topo (com antena etc.), candidatos a forma física dos upgrades.
- **No jogo:** a tela é uma textura própria de 128×64 lida pela GPU na resolução do monitor (a técnica das telas em perspectiva), não a camada HD; ver a resposta de 2026-10-06 em `docs/visao.md`.
- **Manual de identidade (2026-10-06):** `docs/identidade/jackdaw-manual.html` (o aparelho, as vistas, cores, logo, teclas e sons, a tela, a gralha, as telas do sistema, como levar ao jogo). **No topo, a fileira de pinos virou uma tampinha de borracha grafite** (o manual neutro não mostra o que há embaixo); o resto fica num arquivo à parte do Opus 4.8, junto das descrições visuais das cenas das ferramentas dele (pedido em `docs/feedback-opus48.md`).
