# Notas técnicas, teclas e como testar

> Movido do CLAUDE.md em 2026-10-04 (enxugamento). As regras da arquitetura e o índice das lições continuam no CLAUDE.md.

## Teclas

- **Teclas:**
  - jogo: WASD, mouse, Shift corre (Q/E e as setas não giram mais a câmera desde 2026-10-06; `DEBUG.keyTurn` traz de volta); **F** na frente de um orelhão tira o fone (e desliga); **F** mirando um produto numa prateleira o põe na mochila (sem pagar), e no caixa abre o balcão (←/→ dinheiro ou cartão); **B** abre a mochila (arrastar, R gira, E come, botão direito devolve/joga fora); no balcão de quem serve comida, Tab alterna comer aqui / para viagem; **N** tira o notebook onde dá para sentar ou apoiar, **Esc** fecha; **Esc** sem nada nas mãos pausa (menu com salvar, opções e debug); relógio de pulso: **I** abaixa/ergue, e os quatro botões **J** modo (hora, alarme, cronômetro), **K** start/stop (no modo alarme alterna alarme e sinal de hora; segurado acerta o alarme ou zera o cronômetro), **L** luz, **Ç** (`Semicolon`) o mostrador de baixo (bússola, sol, lua, pulso); **Alt segurado** solta o mouse (o cursor clica nos botões do relógio, nas 3 teclas de música no topo do celular, que sai um pouco do bolso, e a roda do mouse perto da rodinha do fio muda o volume; soltar Alt recaptura); música: **Alt+↑/↓** volume, **Alt+←/→** anterior/próxima (segurar faz seek), **Alt+P** tocar/pausar, teclas de mídia do teclado, **0** no Tunes liga o shuffle; com o notebook aberto, **Insert** ergue/abaixa o celular (usado pelo mouse);
  - celular (como no GTA IV): **seta para cima**, **P** ou o **botão do meio** tiram; **P** abaixa (a tela e o estado ficam); **os estágios do manual do celular (seção 2): o botão do meio sobe um (tira do bolso fechado → abre o trilho → o discador, de qualquer tela); o clique direito desce um (de qualquer app para a tela de espera → fecha o trilho → guarda); segurar o botão do meio guarda de uma vez; segurar o direito só olha em volta (2026-10-07)**; um número digitado com o trilho fechado o abre; a seta para baixo na tela inicial limpa as notificações; no discador vazio, as setas escolhem uma chamada recente e a tecla verde liga; a tecla 1 tem os símbolos (`. , ? ! ' - @ _ : / & ( ) " # $ %`); com o notebook aberto, o celular continua clicável (o teclado vai para o notebook); com ele fora, o ponteiro do sistema fica livre e clica nas teclas (segurar o botão direito olha em volta; a roda anda pelo menu e pelas listas); com ele fora, setas = d-pad, Enter ou botão esquerdo = OK, Backspace ou botão direito = Voltar (na tela inicial, guarda), dígitos = teclado, + = \*, − ou . = #, **Space** = tecla verde (abre o discador, liga), **Delete** = tecla vermelha (volta à tela inicial); no menu (grade 4×4), 1–9 e 0 abrem os dez primeiros apps; na câmera, setas para cima e para baixo dão zoom, esquerda liga e desliga o flash; no mapa, 1–4, \*/# ou a roda do mouse = zoom, OK = lista de lugares (ou centralizar);
  - visual: **só no menu de opções** (13.13): som, STYLE (HIGH DEFINITION ou CLASSIC), SHARPNESS (SOFT ou SHARP: a fusão dos glifos distantes) e as linhas de debug (só nesta sessão); as câmeras de CCTV têm a resolução própria do modelo (`camRows`); a interface não muda de tamanho (10.9). **F3** mostra e esconde o painel de debug (o jogo sempre abre com ele escondido, e a escolha não é salva; 13.10p: um quadro no alto à esquerda, por grupos: versão, semente, desempenho, posição, rumo e inclinação do olhar, lugar, hora, sistemas, teclas). **F** de frente para uma tomada pluga ou despluga o celular (13.9c). **F** de frente para uma cadeira, banqueta, sofá ou banco senta (13.10f); andar ou F de novo levanta. **F8** escreve uma nota de playtest (pausa o jogo; só com o registro ligado: `jogar-playtest.bat`, `?playtest` no Vite ou o `.exe`). As opções ficam em `localStorage` (`tc.opts2`), separadas do save (IndexedDB);
  - interiores: entrar pela porta; subir de elevador (as escadas internas saíram por enquanto): mirar na botoeira e clicar (botão esquerdo); escadas de incêndio dos prédios de tijolo andando pela borda de fora do patamar;
  - jogo (14.8): **Espaço** pula, **C** (segurando) agacha;
  - debug: **F4** mostra a mesma vista ao meio-dia, no pôr do sol e à noite, lado a lado (para decidir as cores); **T** e Shift+T mudam a hora em ±1 h (o trânsito e os pedestres seguem a hora); **Y** percorre os climas fixos e volta ao automático; **F6** liga e desliga a subestação mais próxima (era o K até a F.7; a linha de debug acima do relógio diz qual, a que distância e para onde); **V** olha pela câmera de segurança mais próxima (V ou Esc sai; era o C até a 14.8, que virou agachar); no jornal do celular, as setas escolhem a manchete, OK abre a matéria, a tecla esquerda atualiza; **Shift+F6** liga e desliga a cidade toda; **PageUp/PageDown** sobem e descem um andar dentro de um prédio (até existirem escadas e elevadores).
  - A linha de status mostra semente, posição, `DRAW x ms (MAX y)` e os modos. A linha de cima dela mostra data, hora, clima e `POWER x/y`.

## Notas técnicas (para as próximas sessões)

### Lições aprendidas: índice (o texto está em `docs/licoes.md`)

Antes de mexer num sistema, ler só a seção dele em `docs/licoes.md` (`grep -n "^### " docs/licoes.md` dá as linhas). A seção `[HACKING]` só na Trilha de hacking.

- `[HACKING]` Lições da etapa 10 (notebook e hacking), para não repetir
- Lições da F.6 (salvamento e menu), para não repetir
- Lições da reescrita da luz (L), para não repetir
- Lições da etapa R (render na GPU), para não repetir
- Lições da 11.5 (gerador de textos e apps), para não repetir
- Lições da etapa 11 (cidadãos, rotinas e rede social), para não repetir
- Lições da 10.10 (direção sem trilhos), para não repetir
- Lições da segunda parte do bugfix, para não repetir
- Lições da primeira parte do bugfix, para não repetir
- Lições da etapa 9 (rede de telefones e celular), para não repetir
- Lições da etapa 8 (navegação e celular), para não repetir
- Lições da etapa 7 (trânsito), para não repetir

- **Regras da arquitetura:**
  - `src/sim/` nunca importa nada de `src/render/` nem do DOM. O render só lê o estado da simulação.
  - **Uma fonte só para cada geometria (2026-10-04):** a simulação calcula (portas, folhas, móveis, paredes) e a GPU só lê. Nunca recalcular no shader o que a CPU já calcula: os dois divergem (foi o bug das portas da 13.10d).
  - Toda aleatoriedade da simulação vem de `world.rng`, nunca de `Math.random`, para manter o determinismo.
  - Detalhes só visuais (textura do chão, janelas acesas) saem de `hash3` da posição. São fixos e não piscam.
  - A geração da cidade é a exceção a `world.rng`: a grade usa `mulberry32(seed)` e cada quarteirão usa `mulberry32(hash3(seed, i, j))`. Continua determinística, e cada prédio tem identidade pela posição.
- **Interpolação:** tudo o que se move na simulação guarda a posição do tick anterior (`px`, `py`), e o render interpola com `alpha`. Qualquer entidade nova que se mova deve seguir esse padrão, senão treme.
- **Projeção:**
  - O FOV é fixado na **vertical** (`VFOV = 60°`), e o horizontal segue a proporção da janela (~92° em 16:9). Antes era fixado na horizontal (72°), o que deixava só ~44° na vertical, e o usuário achou apertado ao olhar para cima e para baixo.
  - `scale = (rows/2) / tan(VFOV/2)` = linhas por unidade de altura à distância 1.
  - `plane = (cols/2) * cellAspect / scale` = tan(FOV horizontal / 2).
  - Olhar para cima e para baixo: desde a R.17, a câmera 3D de verdade da GPU (os raios giram pelo `pitch`), com o limite em ~77° (`Camera.MAX_PITCH = 1.35`). Antes era *y-shearing* no raycaster por coluna, limitado a ~40° pela distorção.
  - **Decidido na etapa 2: fica o raio por coluna.** A câmera com giro vertical de verdade volta a ser avaliada na etapa 6 (interiores: vista de andares altos, elevadores de vidro) ou na 10 (voo). O usuário decidiu esperar por ela para olhar mais para cima. A ideia original era: lançando um raio 3D por célula (ou fazendo o raycast no shader do GPU) em vez de um raio por coluna. As verticais passariam a convergir ao olhar para cima, e isso destravaria vistas do alto, voo e janelas de andares altos. O custo em JS é da ordem de 20 mil raios por frame, cada um com vários passos de DDA; no GPU seria trivial. Decidir junto com a reescrita do render para a cidade grande e o horizonte distante.
  - Uma célula pertence a uma parede ou sprite quando o *centro* dela está dentro do intervalo projetado (`Math.ceil(y - 0.5)`).
- **Unidades:** 1 unidade = 1 metro desde a etapa 2. As medidas estão em `city.ts` (`FLOOR_H`, `SIDEWALK`, `LANE_W`).
- **Atlas de glifos:** o índice do glifo é o próprio código do caractere (ASCII 33–126). Os blocos e as linhas de caixa estão nas posições 128+ (`BLOCK` em `atlas.ts`, usados pela tecla U). Um glifo novo precisa de uma posição livre do atlas.
- **`CharGrid`** usa `Uint8ClampedArray`: as cores saturam sozinhas em 0–255, então não precisa limitar valores antes do `put`.
- **Onde mexer na variedade:**
  - A geometria fica na simulação (`Building` em `city.ts`: caixa, cilindro ou caixa cortada (`cut`), altura, `style`, cores, `lit`, `shop`, `biz`, `feat`, `flood`). A aparência fica no render, em `wallColumn` (`raycaster.ts`), que recebe o prédio, a distância, o lado (0/1 = faces da caixa, 2 = cilindro, 3 = face cortada), a face (`faceSpan`), a luz da face e o ponto `along` onde o raio bateu (no cilindro, metros de arco).
  - Um estilo novo é um valor a mais em `Facade` e um ramo a mais em `wallColumn`. Todo estilo precisa funcionar nos dois níveis: o detalhado e o distante (`!detailed`), senão treme ao longe.
  - Formas que não partem do chão ainda não existem; tudo é caixa ou cilindro do chão até `h`, e as peças de telhado ficam escondidas dentro do prédio de baixo. Telhados inclinados ou formas flutuantes exigiriam um `z0` no teste de raio.
  - Postes, árvores, carros, holofotes e mobiliário são objetos com volume (`objects.ts` e `models.ts`, desde a etapa 4b). Um objeto novo é uma lista de peças `part(...)` em `models.ts` e um ramo em `collectObjects`. A fumaça tem passe próprio (`drawSmoke`) porque é vista até 2,5 km.
  - `burnGround`, `fenceColumn` e `drawSmoke` em `raycaster.ts` desenham a borda.
- **Defeitos visuais conhecidos, ainda não resolvidos:**
  - O letreiro de loja (faixa `=` a 2,7–3,3 m) vira uma listra diagonal larga quando visto de lado, porque é contínuo ao longo do prédio inteiro.
  - O nível de detalhe da fachada ignora a obliquidade da face, então fachadas vistas muito de lado usam o modo detalhado e as janelas se misturam.
  - O jogador não sai da cidade (`isSolid` é verdadeiro fora dela). A zona de fogo existe só no visual; o medidor de CO e as patrulhas ainda não.
  - Da rua, a zona de fogo aparece quase só como a faixa perto do horizonte, a fumaça e o céu. Deve ficar mais bonita vista do alto (com a câmera 3D).
  - Os objetos (postes, bancos, caçambas) ainda não são sólidos: o jogador os atravessa.
  - As faixas acesas das coroas e as costuras do cilindro (onde o ângulo dá a volta) podem tremer ao longe.
- **Textos dentro do jogo:** os nomes de lugares já vêm de `src/locale/en.json`. A tela de título e a linha de status ainda têm textos fixos em inglês no código.

## Como testar no navegador do app

- O painel tem só ~800×450, então as células ficam com ~3×5 px e o texto da linha de status é ilegível nas capturas. Serve para ver a composição, não para ler detalhes.
- **O pointer lock não funciona no painel** (`WrongDocumentError`); é esperado. Para testar:
  - Em modo dev, `window.world` e `window.camera` ficam expostos. Por exemplo: `camera.look(0, 2)` olha para cima, `world.player` mostra a posição.
  - Para posicionar: mudar `world.player.x/y` **e** `px/py` (senão a interpolação desliza), e `camera.yaw`/`targetYaw`, `pitch`/`targetPitch`.
  - `gridText(x0, y0, x1, y1)` devolve os caracteres de uma região da tela como texto. As capturas são pequenas demais para ver detalhes de fachada; isso resolve. Troque `\0` por outro caractere antes de imprimir e mantenha a região pequena (~90×40), senão a saída estoura o limite.
  - O zoom de captura não funciona no painel.
  - Teclas se simulam com `dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW'}))` e o `keyup` correspondente.
- O laço de quadros só roda com o painel visível. Se `world.tick` não sobe, tire uma captura de tela antes de medir.
- **Portas (pedido do usuário em 2026-09-30):** a **5173** é do usuário, que joga pelo `iniciar.bat` enquanto o Claude programa. O Claude testa sempre pela configuração **`claude-dev`** (porta **5180**). Se ela estiver ocupada por outra conversa, use a configuração `vite-auto` do `.claude/launch.json` (porta livre via `PORT`, lida no `vite.config.ts`); `vite-5174` e `vite-5175` também existem.
- **Desde a 0.15.10 o título não gera a cidade:** ela é feita só depois do clique em **CONTINUE** (a semente do save) ou **NEW GAME** (`?seed=42` fixa a semente; sem ele, sorteia uma). NEW GAME apaga o save (com save, pede um segundo clique), e o jogo entra sozinho quando o shader fica pronto. Para testar no painel: abrir `?seed=42&mute`, clicar NEW GAME (`find "NEW GAME"`) e esperar a compilação. `?new` não existe mais; o WATCH CCTV saiu do título (`watchCam(k)` no console continua).
- **Testar sem som (pedido do usuário em 2026-10-01):** o usuário acompanha os testes no navegador do app e ouve o som. Abrir sempre com `?mute` (por exemplo `http://localhost:5180/?seed=42&mute`).
- Para criar arquivos, use a ferramenta Write. Um heredoc grande pelo Bash falhou com erro de aspas nesta máquina. Para edições grandes em lote, grave um script Python no scratchpad com Write e rode-o.
- A pasta `referencias/` está no `.gitignore` (são quadros do vídeo de outra pessoa) e existe só no disco.
- **Lições desta máquina (2026-09-30):**
  - **O Vite às vezes serve um módulo velho** depois de edições por script (aparecem erros como "does not provide an export" ou funções com a assinatura antiga). Rodar `touch` nos arquivos editados e navegar de novo para a URL. Para conferir, `fetch('/src/...ts')` mostra o que está sendo servido.
  - **Esconder o overlay à mão** (`#overlay.hidden = true`) deixa o jogo no modo título, em que a câmera gira sozinha devagar. Reposicione a câmera logo antes de cada captura, ou entre de verdade: `find` em "ENTER THE CITY" e um clique (isso também cria o som).
  - **Uma edição de código faz o HMR recarregar a página** e perder o estado (posição, hora, clima). Reaplique depois de cada build.
  - **Painel oculto:** o laço para e a captura mostra um quadro velho; tire uma captura antes, para acordar o laço.
  - **Testes isolados:** dá para importar módulos direto no console (`await import('/src/render/objects.ts')`) e desenhar numa `CharGrid` própria. Foi assim que apareceu o erro de projeção dos objetos.
  - **Limite de 5 servidores de preview por pasta,** contando as outras conversas; reaproveite o que já está rodando (`preview_list`).
  - **Nunca use `git checkout <arquivo>` para desfazer uma linha de debug:** isso apaga também o trabalho não commitado do arquivo (aconteceu com o `main.ts`). Desfaça a linha com uma edição.
  - **Barra invertida em scripts Python que geram TypeScript:** `C('\\')` sai errado com facilidade; para strings com `\`, use a ferramenta Edit.
