# Terminal City — log de atualizações

Versão `0.ETAPA.SUB` (por exemplo, `0.12.4` é a subetapa 12.4). Uma linha por novidade, escrita para quem joga; o mais novo em cima. As regras de como manter este arquivo estão no CLAUDE.md, em "Como trabalhar neste projeto". Entradas da Trilha de hacking são escritas por uma sessão com o Opus 4.8; fora dela aparecem só como "(entrada da Trilha de hacking)". As versões até a 0.12.3 foram montadas depois, a partir do histórico e dos commits.

## 0.13.22 — Interruptores e luz por cômodo (2026-10-09)
- **O vidro é o mesmo visto de fora e de dentro:** a mesma cor, o mesmo reflexo e, na chuva, as mesmas gotas também por fora; de dia, da rua, o cômodo atrás do vidro parece mais escuro, como na vida real.
- **As luzes dos cômodos seguem quem está neles:** a casa acende quando alguém está acordado em casa, o quarto antes de dormir, e de madrugada os bairros apagam (o saguão e a escada ficam acesos a noite toda); os escritórios acendem no expediente, as lojas enquanto estão abertas. De longe, a cidade segue a mesma regra, em média.
- **Interruptores:** cada cômodo tem o seu, na parede ao lado da porta, do lado da maçaneta; F apaga e acende a luz, com um clique, e o jogo lembra (vai no save).
- **O olho se acostuma mais devagar ao entrar num lugar claro** (cerca de 1 s), sem o tranco de antes.

## 0.13.C3b — Diálogo e controles (em andamento)
- **Fechar o menu de pausa com Esc devolve o mouse ao jogo** (no Electron na hora; no navegador, na próxima tecla ou clique), sem precisar clicar na tela.

## 0.13.C2 — Correções de interiores (2026-10-09)
- **As portas da rua ficam na fachada**, não mais afundadas num recesso sem laterais.
- **Ao cruzar uma porta, o interior não some mais por um quadro** (aparecia a rua do outro lado do prédio).
- **A porta de madeira dos moradores tem o mesmo batente de madeira por dentro e por fora**, em vez de uma faixa cinza que parecia fresta.
- **As portas dos cômodos fecham até em cima**, sem a fresta escura sob o batente.
- **Uma porta da rua com uma parede logo atrás do batente abre só até a parede**, em vez de a folha entrar nela.
- **Acima de cada porta interna, a parede do cômodo**, com uma moldura fina de madeira, em vez de uma faixa de madeira até o teto.
- **Uma porta de vidro não esconde mais as portas atrás dela:** olhando por uma folha de vidro, as portas de dentro aparecem.
- **Dois prédios do mesmo lado da quadra não têm mais o mesmo número:** o segundo vira 522A, o terceiro 522B.
- **O mouse não dá um tranco ao ser capturado** (o giro rápido ao entrar no jogo).

## 0.13.21 — As lojas desenhadas como as casas (2026-10-08)
- **Toda loja é mobiliada por um modelo desenhado:** lanchonete, café, pizzaria, bar, mercearia, lavanderia, cybercafé, banco, a recepção do motel e os saguões, e as lojas de prateleiras; o modelo estica até o tamanho da loja e nunca fecha uma porta.
- **O cybercafé tem fileiras de computadores com cadeira**, de frente para quem senta; o caixa e a geladeira ficam junto da vitrine.
- **A recepção do motel e os saguões têm um balcão de 2 m**, o sofá e as plantas, em vez de um balcão que atravessava a loja.
- **Atrás de cada balcão há lugar para o balconista, e na frente do caixa, para o cliente:** é onde as pessoas vão trabalhar e pagar quando a cidade ganhar vida dentro das lojas.
- **Prédios de 8 × 8 m com loja ganharam planta própria:** a loja na frente, o corredor dos moradores até a escada e o banheiro dos funcionários; acabou o elevador plantado na porta da loja.
- **Cadeiras e vasos lado a lado nos apartamentos viraram dois**, em vez de uma peça só larga.

## 0.13.S — O shader arrumado (2026-10-08)
- **O jogo abre mais rápido na primeira vez depois de uma atualização:** o shader do mundo compila na metade do tempo.
- **Roda em placas de vídeo mais fracas:** o jogo não pede mais à placa um limite acima do padrão do WebGPU.
- **A borda da cidade sem as torres de holofote da antiga cerca nem o rugido do fogo** (sobras da zona de fogo).

## 0.13.20b — A borda sem fogo (2026-10-08)
- **A zona de fogo e o Sarcófago saíram:** em volta da cidade agora há chão de terra, sem rachaduras acesas, fumaça, cerca nem a cúpula no horizonte; as manchetes sobre eles também saíram. (O mar vem depois.)
- **Atalhos de teste podem destrancar todas as portas**, para visitar qualquer apartamento.

## 0.13.20 — Cada casa mobiliada por quem mora nela (2026-10-08)
- **Os apartamentos escolhem a arrumação pelo morador:** a mesma planta mobilia diferente para um casal de renda alta, um estudante ou um gamer (as arrumações do manual de interiores, giradas e espelhadas para caber no cômodo).
- **A quitinete do térreo ficou arrumada:** a sala, a cama e o guarda-roupa agrupados, e a mesa longe da porta de entrada.
- **Cada móvel sabe onde se usa** (a cama, o sofá, o fogão, a pia, a mesa com a cadeira): é onde os moradores vão ficar quando a cidade ganhar vida dentro dos prédios.

## 0.13.19b — Correções (C1) (2026-10-08)
- **Na recepção do motel, olhando para a porta, a dica diz "[F] OPEN"** (antes dizia para falar com o recepcionista, embora o F já abrisse a porta).
- **O jogo não congela mais** se o jogador aparecer dentro de uma loja por um atalho de teste.
- **Sai a dica da zona de fogo** da tela de carregamento (a borda da cidade não é mais a zona de fogo).
- **Atalhos de teste:** `teste-*.bat` abrem o jogo direto num lugar, num andar e numa direção, sem tocar no save.

## 0.13.19 — A porta do prédio e a saída (2026-10-08)
- **A porta dos moradores parece porta de prédio:** uma folha de madeira de 1 m com um vidro em cima, uma bandeira de vidro acesa sobre ela com o número da casa e o interfone ao lado. Dá para distinguir de longe da porta de vidro da loja.
- **Placas EXIT de verdade:** vermelhas, com o homenzinho saindo, só no caminho das partes comuns até a rua (da escada para o saguão, sobre a porta da rua). Acabou o EXIT verde dentro dos apartamentos.
- **Portas da rua menos apertadas:** o batente ficou mais fino em todas.

## 0.13.18 — A escada encostada e a porta de casa (2026-10-08)
- **Os apartamentos que abriam direto no patamar da escada ganharam a porta:** a entrada da casa tem folha de madeira, que tranca na maioria das casas, como as outras.
- **Não se entra mais em casa pela cozinha:** nos apartamentos de 1 e 2 quartos a porta dá num hall de entrada, com a cozinha aberta ao lado e a sala em frente. Uma regra nova das plantas (R12) garante isso daqui para a frente: toda casa tem a porta própria, num hall ou na sala.
- **Móveis e escada encostados na parede:** antes ficavam a um palmo dela; agora a cama, os armários, a geladeira e a escada vão até a parede (e a escada não deixa mais uma faixa de chão ao lado do lance).
- **Sem fresta no topo da escada:** olhando para cima pelo vão, a borda da laje do andar de cima aparece inteira (antes via-se uma fresta entre o teto e o piso de cima).
- **As portas fechadas não ficam mais pretas de um dos lados:** a folha pegava a luz do cômodo do outro lado (às vezes apagado); agora pega a do lado de onde se olha.
- **Não se prende mais no alto do lance encostado na parede:** chegando ao andar de cima pela beirada da escada, as paredes que contam são as desse andar.

## 0.13.10o — A porta do motel (2026-10-08)
- **Não fica mais preso no balcão do motel:** olhando para a porta, o F abre a porta; antes ele puxava conversa com o recepcionista, cujo alcance ia até a porta.

## 0.13.10n — A escada em U (2026-10-08)
- **A escada dos prédios de escada é em U, como nos prédios de verdade:** entra-se num patamar, sobe-se um lance até o patamar do meio, vira-se e sobe-se o outro, chegando ao andar de cima do mesmo lado em que se entrou. Acabou a escada que começava em cima da porta e chegava numa parede.
- **O prédio não some mais no meio da subida:** com a cabeça já acima do teto e ainda abaixo do andar de cima, as paredes continuam lá (antes aparecia a rua).
- **O vão da escada é um espaço só, do térreo ao último andar:** olhando por ele, as paredes do poço continuam entre o teto de um andar e o piso do outro (antes, no meio da subida, o prédio sumia e aparecia a rua), e as janelas do andar visto pelo vão mostram a rua lá fora.
- **Um corrimão de verdade entre os dois lances**, contínuo, e não dá para pular de um lance para o outro nem andar por baixo da escada.
- **As plantas acompanham:** nos prédios de 10 × 12 m a escada ficou maior; nos de 12 × 12 m o hall dos moradores foi para o lado da escada; a lavanderia dos térreos com loja agora se alcança por um corredor atrás da loja; a porta da casinha do telhado fica no patamar.

## 0.13.10m — A escada volta, em cubinhos (2026-10-08)
- **Os prédios de escada (walk-ups) têm escada de novo:** um lance reto de madeira nos fundos, feito de cubinhos, com os degraus vazados por baixo, as longarinas de aço e um corrimão do lado do corredor. Sobe-se andando de verdade, degrau por degrau, e o lance termina num patamar plano; pelo lado, o corrimão segura. Sobre o lance, o teto é aberto: de baixo vê-se o andar de cima, e de cima, o lance descendo até o térreo; no meio da subida, a vista já passa para o andar de cima.
- **Objetos de cubinhos no mundo:** o desenho por cubinhos, que já servia ao celular e ao relógio na mão, agora vale para objetos da cidade. A escada é o primeiro; os móveis vêm depois pelo mesmo caminho.
- **Os andares de baixo das plantas novas:** os prédios residenciais de 8 × 10 a 12 × 12 m ganharam o térreo desenhado (a porta da rua, o corredor dos moradores até a escada, a quitinete do térreo). Metade da cidade já usa os interiores desenhados.

## 0.13.10l — Janelas fantasmas (2026-10-08)
- **As janelas dos prédios de trás não aparecem mais desenhadas em cima de postes, placas e pessoas** que estão na frente delas.

## 0.13.10j — Quarteirões de cidade americana (2026-10-08)
- **Os quarteirões são loteados como nas cidades americanas de verdade:** nas pontas, lotes virados para a avenida (as esquinas inclusas); no meio, duas fileiras de lotes estreitos e fundos, de costas uma para a outra, cada um com a porta na rua, e os quintais no miolo do quarteirão. Acabaram os prédios rasos e largos com a porta no lado comprido.
- **Torres no centro, sobrados na periferia:** perto do centro os lotes são largos (16 a 24 m), onde nascem as torres; longe dele os lotes têm 8 a 12 m de frente e no máximo 5 andares (prédio de escada, sem elevador). De vez em quando sobra um beco estreito entre dois prédios.
- **A cidade de cada semente muda** (é a base para os interiores desenhados que vêm a seguir: todo prédio agora tem um tamanho que existe no catálogo de plantas).

## 0.13.7 — Placas de rua pelo manual de sinalização (2026-10-08)
- **A placa da esquina tem poste próprio**, uns 3 m calçada acima do semáforo: o poste para embaixo da placa (nada atravessa o nome), e as duas placas se cruzam em cima dele.
- **As placas de rua se leem:** sem a moldura escura dos outdoors (que fazia faixas pretas), letras mais altas e refletivas, que continuam legíveis à noite.
- **A centena do quarteirão** à direita do nome ("BLACKMOOR BLVD 1200"): os números daquele trecho vão de 1200 a 1299. A **faixa colorida do distrito** corre no topo da placa.
- **Placa suspensa no fim do braço do semáforo**, depois da última lanterna, com o nome da rua que se cruza, para quem vem dirigindo.
- **O PARE é octogonal**, com STOP em branco.
- **O semáforo de pedestre mostra XX** em vermelho (era um X só), do mesmo tamanho do GO.
- **Banners do distrito nos postes das avenidas:** dois panos com o número do distrito, dos dois lados do poste. A cor diz o tipo de bairro (dourado o financeiro, azul o comercial, verde o residencial, roxo o histórico, laranja o industrial, magenta o dos teatros), e a mesma cor corre no topo das placas de rua.
- **Aviso amarelo "CCTV" embaixo de cada câmera de segurança**, na parede ou no poste: dá para saber de longe onde há câmera.
- **Número sobre a porta de cada prédio**, contando da centena do quarteirão (o 531 fica no quarteirão do 500), par de um lado da rua e ímpar do outro.
- **OPEN / CLOSED no vidro ao lado da porta das lojas**, com o horário embaixo ("6-23"): segue o horário de verdade de cada loja, então dá para saber da calçada se vale entrar.
- **Bandeira azul BUS STOP sobre os abrigos de ônibus**, com o nome da rua que o ponto atende (a mesma que os ônibus usam para parar ali), legível dos dois lados da calçada.
- **Placa PHONE no capuz dos orelhões.**

## 0.15.59 — GRID DOWN na tela de título (2026-10-08)
- **O título agora é GRID DOWN: TERMINAL STATE.** Em vez do antigo "TERMINAL CITY", a tela de título mostra a abertura do manual da GridLink, como um letreiro de lâmpadas direto no escuro: GRID acende letra por letra, a haste desce até o LINK, POWER · TELECOM é digitado, alguém sacode a lata e picha o OWN em tinta laranja, risca o LINK, e a energia cai: as lâmpadas e o console do fundo se apagam, TERMINAL STATE acende em âmbar sozinho, e a luz volta piscando. Uns 8 segundos, com os sons sintetizados (bipes, o zumbido do transformador, as teclas, a lata, o spray, o zumbido caindo e o relé religando). Clique no logo para ver de novo.
- **O nome da janela e da aba também mudou** para GRID DOWN: Terminal State.

## 0.15.58 — Sem moiré nem fantasma (2026-10-08)
- **Tela do Jackdaw sem moiré:** cada pixel da tela agora é a média dos pontos que cobre; as listras que dançavam sobre a gralha somem.
- **Jackdaw em cubinhos de 1 mm** (eram de 2 mm), como o relógio: o OK fica redondo e centrado, a borda chanfrada em dois degraus, a alavanca inclina aos poucos.
- **O brilho da tela do celular não repete mais o relógio:** o halo era feito de cópias numa grade fixa, e os números grandes reapareciam fracos em volta; agora ele se espalha liso.

## 0.15.57 — Tudo virado para o olho (2026-10-08)
- **Jackdaw menor e inteiro na vista:** mais uns 25 % menor e mais alto, dá para ler a tela inteira.
- **Os aparelhos viram para o centro da tela:** o celular (à direita) gira para a esquerda, o relógio (à esquerda) para a direita, o Jackdaw (no meio) fica de frente.
- **Brilho da tela do notebook:** duas teclas novas (sol − e sol +) à esquerda da tecla da luz, 8 níveis, guardados no save. A luz que a tela joga no teclado caiu a um terço: a luz do teclado volta a fazer diferença, mesmo com uma página branca.
- **O teclado do notebook sente o sol:** o plástico escuro clareia no sol forte, como o do celular.
- **Botões com o que fazem escrito:** no notebook, VOL-, VOL+, MUTE, as duas de brilho com um solzinho e LIGHT; no celular, as três teclas de música do topo com |<, >|| e >|.

## 0.15.56 — Um vidro só para tudo (2026-10-08)
- **Glare no Jackdaw e no notebook:** como no celular, os postes acesos e o sol aparecem refletidos onde estão de verdade no visor do Jackdaw e na tela do notebook. O centro do reflexo agora estoura quase em branco (a cor da lâmpada fica no halo), também no celular.
- **Fim das manchas marrons na tela do notebook:** saíram a faixa diagonal antiga, as "marcas de dedo" e o reflexo borrado do mundo, que juntos pareciam sujeira.
- **De dia o notebook não escurece mais pela metade:** o ajuste do olho (mais claro no escuro, mais lavado no sol) vale para a tela inteira, texto e páginas da web juntos; de dia a tela fica bem menos escura.
- **Relógio e Jackdaw com a luz do celular:** o mesmo sombreamento (laterais que pegam a luz, plástico e aço que clareiam no sol) e o visor que fica mais claro de dia em vez de parar na cor pintada; menos lavagem branca do brilho sobre o visor do relógio.
- **Relógio 20 % menor.**
- **Notebook aberto:** o **botão do meio** ergue o celular (segurado, guarda) e um clique do **direito** o abaixa, como fora do notebook; o Insert ficou livre (a área de transferência do Osprey). Fechar a tampa é só no **Esc**.
- **A tela do notebook não apaga mais** ao virar a vista até metade dela sair da tela: a parte ainda à frente continua acesa.
- **Soltar o botão direito recentraliza o notebook direito:** o último movimento do mouse não desvia mais a vista, e ela volta pelo caminho curto.

## 0.15.55 — Retoques do Jackdaw e do relógio (2026-10-08)
- O Jackdaw na mão ficou ~35 % menor e de frente, sem virar para o lado.
- O relógio balança menos ao virar a câmera e ao andar/correr.

## 0.15.54 — O Jackdaw Mini (2026-10-07)
- **Um bichinho virtual de bolso:** o Jackdaw Mini, amarelo-sinal, em cubinhos de 2 mm, com a tela verde de 128 × 64 pontos onde mora a gralha. Por enquanto vem no bolso pelo modo debug (no jogo de verdade ele chega mais adiante). **G** tira e guarda; **O** é a alavanca de ligar; na mão, as **setas**, **Enter** (OK) e **Backspace** (VOLTAR).
- **A gralha:** pisca, olha para os lados, pula sozinha (ou com ↑), cochila depois de 2 minutos sem tecla ou com a bateria fraca, e comemora quando acha uma bugiganga.
- **O sistema:** a abertura com o logo e as linhas digitadas, a tela inicial com a hora, a data e as bugigangas, o menu de ícones, a tela de carregando com a gralha pulando pela barra e o aviso de bateria fraca.
- **Os apps de fábrica:** PET (troque a expressão com ←→, OK faz carinho), TONE (um gerador de bipe), LIGHT (a tela vira lanterna), CLOCK (a gralha olha o relógio), FILES (o cartão de memória) e SETTINGS. Cada app abre com a sua cena da gralha.
- **Toda tecla faz clique**, a alavanca faz clac, e há os bipes de entrar, voltar, o piado contente e o emburrado, tudo sintetizado. Qualquer tecla acende a luz verde da tela por 5 s; no escuro, sem a luz, a tela quase some. O LED vermelho pisca enquanto está ligado.

## 0.15.53 — Metal que reflete (2026-10-07)
- **O brilho do aço do relógio:** a luz mais forte por perto vira uma faixa de reflexo na caixa, que escorrega quando você vira a câmera e **sobe e desce com o balanço do braço** quando você anda (mais forte correndo).
- **O relógio balança como o celular:** ao virar a câmera ele se inclina um pouco para o outro lado e volta; andando e correndo, sobe e desce com o braço.
- **O visor como um LCD de verdade:** só reflete, então numa rua escura quase some (é para isso que serve o LIGHT); sob o poste fica apagado, de dia lê bem. O cristal por cima tem um leve véu de luz e o reflexo da luz passa por ele, lavando os números.
- **O cromo do celular reflete:** o degradê do aro, do botão central e das teclas de música escorrega com o balanço do aparelho, junto com o brilho.

## 0.15.52 — O relógio em cubinhos (2026-10-07)
- **O relógio virou um objeto de verdade:** a caixa de aço escovado com o aro chanfrado, a face escura com as legendas impressas, o visor rebaixado, os quatro botões de metal nos lados e a pulseira de resina com nervuras e furos, tudo em cubinhos de 1 mm, levemente inclinado na mão, com a luz da cena batendo de cima e da esquerda.
- **O visor em pixels:** os números agora são segmentos de verdade, com as pontas chanfradas e os apagados aparecendo de leve; a lua em fatias, o coração que pisca a cada batida, as setas do sol.
- **Os botões afundam** quando você aperta (com a tecla ou com o clique).
- **Com a luz acesa, o visor fica legível:** o azul não lava mais a caixa inteira.
- **O relógio por cima do notebook:** com o notebook aberto, o relógio fica na frente dele.

## 0.15.51 — O relógio ganha um quarto botão (2026-10-07)
- **DISPLAY (tecla Ç, ou clique com o Alt):** o novo botão embaixo à direita troca a linha de baixo do relógio, em qualquer modo: **bússola e temperatura → nascer e pôr do sol → lua → pulso**.
- **Sol:** a hora em que o sol nasce e se põe hoje, pelo céu de verdade do jogo; serve para saber quanto falta para a noite.
- **Lua:** o desenho da fase e a idade da lua em dias.
- **Pulso:** o coração bate mais rápido quando você corre e quando o fôlego está acabando, e desce devagar parado; o sinal pisca a cada batida. É o jeito de ver o fôlego sem barra nenhuma.
- **As legendas ao lado de cada botão:** LIGHT e START em cima, MODE e DISPLAY embaixo; a marca foi para o meio.
- **A luz do relógio voltou a mostrar o visor:** com o LIGHT aceso, o LCD sumia e aparecia a rua através dele; agora os números ficam na luz azul.

## 0.15.50 — O notebook no mundo de verdade (2026-10-07)
- **Perspectiva certa:** o notebook agora é visto pela mesma câmera do mundo, e não mais pela projeção antiga que esticava tudo ao olhar para baixo; de perto, de lado ou olhando para o teclado, ele parece um objeto na mesa.
- **A tampa abre inclinada,** uns 114°, de frente para os olhos, como se ajusta uma tela; o console continua nítido, pixel por pixel.
- **A tela não vaza mais para a moldura:** sumiu a faixa em volta da imagem em que a primeira coluna e a barra de cima se esticavam até a borda.
- **Todas as teclas com legenda,** todas no mesmo tamanho: apareceram `= [ ] \ ; < > ^` (as setas, com o ^ e o V empilhados), e F10, BKSP, SHIFT e as outras palavras saíram da letra miúda.
- **A antena USB e a bateria grande** agora também são de cubinhos (a haste preta, o LED azul piscando), e ficam escondidas atrás do corpo como deveriam.

## 0.15.49 — As peças do notebook se apertam (2026-10-07)
- **Clique nas peças do notebook** com o mouse: cada tecla digita (e afunda), o botão de ligar liga e desliga, e as teclas da faixa de cima funcionam: **volume − e +** (um clique de borracha e o bipe do sistema já no volume novo; o aviso no alto mostra o volume) e **mudo**.
- **A luz do teclado:** a tecla da luz na faixa de cima acende o LED da tampa, que joga um leque quente sobre as teclas (só com o notebook ligado).
- **Os botões do nub e do touchpad** clicam, cada um com o seu som (o do nub seco, o do touchpad abafado).
- **O som do notebook segue o volume dele:** o bipe do firmware e os cliques do Ferret saem pelas caixinhas, mais altos ou mais baixos, e somem no mudo. O volume, o mudo e a luz ficam no save.

## 0.15.48 — O notebook em cubinhos (2026-10-07)
- **O notebook ganhou corpo de verdade:** a base e a tampa agora são feitas de cubinhos de 2 mm, como no manual, desenhados na resolução do monitor: as 80 teclas com legenda cinza (as mais usadas pelo dono anterior brilham um pouco), o nub âmbar entre G, H e B com os três botões, o touchpad, a faixa de cima com volume, mudo, a tecla da luz e o botão de ligar com o anel verde aceso, as dobradiças de metal e o selo do Osprey no descanso de pulso.
- **As teclas afundam** quando você digita, tecla por tecla, e a luz da cena bate nelas de cima (as laterais das teclas aparecem).
- **A tampa gira de verdade** na dobradiça ao abrir e fechar; por fora, a marca, os riscos e os um ou dois adesivos de fábrica do dono anterior. Embaixo da tela, a marca do fabricante e os quatro LEDs (ligado, disco, rádio, bateria).
- **A luz da tela cai no teclado** conforme o que ela mostra: um console escuro acende pouco, uma página branca acende bem.
- **O celular na frente do notebook:** com os dois erguidos, o corpo do celular fica por cima da tela do notebook.

## 0.15.47 — O Osprey no notebook (2026-10-07)
- **A barra do Osprey** no alto da tela do notebook, como no manual: as três áreas de trabalho, o título da janela em foco (o diretório do terminal ou a página do Ferret), a rede Wi-Fi com as barras de sinal, a CPU, a memória (acende acima de 85%), a bateria com o tempo restante (um raio na tomada; pisca abaixo de 10%) e a hora. Tudo vem da máquina e do mundo; as linhas finas entre os campos são pixels.
- **Áreas de trabalho:** **Ctrl+1..3** mostra uma área; **Ctrl+Shift+1..3** manda a janela em foco para outra (o Ferret numa, o terminal noutra, cada um em tela cheia).
- **As bordas das janelas em pixels:** com o terminal e o Ferret lado a lado, uma linha fina entre eles e a janela em foco contornada em âmbar claro (saíram o `|` e a setinha `<`/`>`).
- **O logo do Osprey no boot:** a águia-pescadora em ASCII, com "OS" em âmbar e "prey" em branco, antes de o sistema carregar.
- **O POST com os selos nítidos:** a fita azul do fabricante e o selo "powersave" de economia de energia, desenhados em pixels (antes eram letras).
- **A tela é LCD:** saíram as linhas de varredura do terminal.

## 0.15.46 — Glare de verdade, galeria na câmera, banco e Maps (2026-10-07)
- **O reflexo do celular agora vem das luzes de verdade:** sumiu o brilho fixo no canto da tela (e a faixa falsa). No lugar, as lâmpadas de rua acesas e o sol refletem no vidro conforme o ângulo: uma mancha de luz na cor da lâmpada (âmbar no sódio), que desliza pela tela quando você vira e só aparece quando a luz está atrás e acima de você, como num espelho. Mais forte nas partes escuras da tela.
- **Câmera com galeria:** embaixo do botão, uma tira com as últimas fotos (a mais nova primeiro), três por vez; as setas nas pontas e a roda do mouse sobre a tira a fazem correr, e tocar numa foto a abre inteira.
- **Maps:** a barra de baixo (Search/Back) voltou a aparecer e a funcionar; o mapa a cortava.
- **Banco:** "Branches nearby" marca a sua agência (YOURS) e a sede (HQ); no lugar de "Branch & contact" entra **"Account details"**: o número da conta, o routing number, o cartão de débito, quando e em que agência a conta foi aberta.
- **A operadora na barra de cima** do celular, ao lado do sinal (na tela inicial ela já aparece embaixo da hora, então lá não repete).

## 0.15.45 — Dia mais branco, toques e links (2026-10-07)
- **O dia ainda mais claro** (exposição 1,2) e **o sol do meio-dia mais branco** (5800 K em vez de 4700 K): a tarde e o céu perto do sol deixam de ficar amarelados; o amanhecer e o pôr do sol continuam alaranjados.
- **Tocar a tela do celular:** o botão acende enquanto o mouse está apertado e some ao soltar; o app abre sem o destaque do toque por cima.
- **Ferret Mini:** um toque num link já o segue (sem tocar duas vezes), e um toque numa caixa já abre para escrever.
- **Links inteiros:** uma manchete com várias palavras acende inteira ao ser escolhida (antes só a palavra), também quando quebra em duas linhas.

## 0.15.44 — Dia mais claro (2026-10-07)
- **O dia mais claro e menos saturado** (a exposição de dia de 0,75 para 0,95; a saturação extra de 1,3 para 1,12), como sugerido no playtest: a noite fica como estava, e o pôr do sol passa de um para o outro.

## 0.15.43 — SMS sem repetição (2026-10-07)
- **As mensagens de número errado e as propagandas não chegam mais em dobro** quando a hora volta e avança de novo (Shift+T e T): só uma hora nova traz mensagens.
- **"Have you seen my my glasses?"** e "Can I borrow your my keys?" corrigidos.

## 0.15.42 — Celular mais leve na mão (2026-10-07)
- **O celular na mão não derruba mais o FPS:** a tela dele é pintada de novo a cada quadro, e o pintor de pixels gastava ~6–7 ms nisso (retângulos e degradês ponto a ponto). Agora preenche linhas inteiras de uma vez: a tela inicial caiu de ~5,7 para ~1,1 ms, o Tunes de 5,3 para 0,7 ms, a grade de apps de 2,9 para 1,5 ms. O desenho é idêntico, pixel por pixel (a mesma mudança acelera o Ferret no notebook).

## 0.15.41 — Telas de serviço em pixels (2026-10-07)
- **Teste de GPS:** o céu como um gráfico redondo (norte em cima), cada satélite um disco (verde quando em uso) e a lista com o sinal em barras.
- **Teste de teclas:** as teclas em botões, verdes depois de apertadas e brancas enquanto seguradas.
- **Teste de LCD:** as cores lisas e um degradê de verdade, pixel a pixel; tocar a tela passa para a próxima.
- **Com isso todas as telas do celular estão em pixels** (a 3b do manual v2).

## 0.15.40 — Reynard em pixels (2026-10-07)
- **O Reynard redesenhado, carvão, creme e ferrugem:** a raposa grande no registro com o código em seis dígitos; as conversas com a inicial num disco ferrugem, o visto verde de verificada, a hora e o começo da última mensagem; os balões (os seus em ferrugem à direita, os da outra pessoa à esquerda) com "sent"/"delivered" embaixo; a linha de escrever e a digitação; o número de segurança grande em três linhas; botões de toque para registrar, verificar, apagar e manter.

## 0.15.39 — Ferret Mini em pixels (2026-10-07)
- **O navegador do celular pelo manual do Ferret:** a página em 40 colunas de 6 × 12 pixels, letras nítidas; a faixa de terra com o rosto do furão (que mergulha e cava enquanto a página vem) e o endereço em creme; a barra de progresso embaixo ao carregar.
- **As figuras das páginas na ordem certa:** o brilho e as abas embaixo do texto, as fotos e os anúncios só em cima de células vazias (o botão "Contact us" não some mais embaixo da pílula).
- **Toque:** tocar num link o escolhe, tocar de novo o segue (o mesmo para as caixas de texto); a pergunta do preço tem Yes e No tocáveis; a lista Go to se toca direto.

## 0.15.38 — Mapa e busca em pixels (2026-10-07)
- **O mapa redesenhado como um mapa de celular de 2008:** as ruas exatas (brancas, as avenidas amarelas), os prédios contornados e mais azulados quanto mais altos, parques e praças com textura, os bairros tingidos de longe; continua se desenhando de cima para baixo. Por cima: a rota em azul, os marcos (estrela num disco vermelho), os nomes das ruas e dos bairros sem se sobrepor, o alfinete do lugar, a seta do GPS na direção em que você anda e o disco da precisão. Botões + e - para o zoom, a escala no cabeçalho.
- **O cartão do lugar** com aberto/fechado, telefone, distância, endereço e os botões Route e Call; **a barra da rota** com a próxima curva e uma seta dobrada.
- **O mapa de dentro dos prédios** com as salas na cor do tipo, as paredes, as portas entre as salas, a escada listrada e o elevador.
- **Andar com o mapa aberto não pesa:** a imagem cobre um pouco além da tela e só é refeita a cada ~40 m andados (no zoom mais perto), em vez de a cada quadro.
- **A busca de lugares:** o campo com a lupa e a digitação, e os resultados com alfinete (ou estrela), distância, tipo e aberto/fechado; um toque escolhe, outro mostra no mapa.

## 0.15.37 — Banco: agências por perto no lugar da recarga (2026-10-07)
- **Sai a recarga do celular pelo app do banco:** o banco não tem como saber qual chip está no aparelho (os chips se trocam); a recarga continua pela operadora, no *100#.
- **Entra "Branches nearby":** as agências do seu banco da mais perto para a mais longe, com a esquina, a distância e se estão abertas agora; é no balcão delas que se saca dinheiro vivo. O botão verde (ou o da tela) liga para a escolhida.

## 0.15.36 — Câmera e Fotos em pixels (2026-10-07)
- **Câmera:** o visor ocupa a largura da tela no tamanho da própria foto (o que se vê é o que sai), com as marcas dos cantos, os megapixels e as fotos que cabem; embaixo, botões de toque para o flash (o raio acende), o disparo e o zoom (- e +).
- **Fotos:** uma por vez, da largura da tela, com setas nos lados para passar (tocar passa), a data e o tamanho embaixo.

## 0.15.35 — Snake, Lanterna e Conversor em pixels (2026-10-07)
- **Snake na tela verde dos celulares antigos:** pontos de 5 px, a moldura grossa, o placar no topo e um direcional de quatro setas embaixo para jogar com o toque; o GAME OVER numa caixa (tocar joga de novo).
- **Lanterna:** a tela inteira branca, agora em pixels.
- **Conversor:** o que se converte com setas dos lados (tocar troca), o número digitado grande num poço escuro com o cursor, o resultado grande em verde.

## 0.15.34 — Banco em pixels (2026-10-07)
- **O app do banco com cara de banco:** papel creme, verde-escuro e dourado, o emblema da fachada com colunas na barra. O saldo aparece grande num cartão, o menu em botões; o extrato em linhas com as entradas em verde; a recarga em quatro botões (um toque escolhe, outro paga); a agência com o endereço, o horário, o telefone e um botão para ligar.

## 0.15.33 — Streetwire em pixels (2026-10-07)
- **O Streetwire redesenhado, ainda com cara de site de 2008:** a barra azul-marinho com o logo e o pontinho laranja, cartões brancos com a foto de cada pessoa (as iniciais num quadrado da cor dela), o texto, a foto do post (quando já foi aberta) e um coração de verdade para curtir. Um toque escolhe o post, outro abre; tocar no coração curte. O post aberto mostra a foto grande, o botão Like e os comentários em cartões (os seus em laranja); tocar no nome do autor abre o perfil, que tem a foto grande, a tabela (idade, bairro, trabalho, gostos), a bio e os posts da pessoa.

## 0.15.32 — Notícias em pixels (2026-10-07)
- **O Courier redesenhado:** a capa com o nome do jornal entre filetes, a data e a edição, as manchetes em negrito (a principal na faixa sombreada) com uma camerazinha onde há foto; um toque escolhe a matéria, outro abre. A matéria aberta tem a foto grande com moldura e legenda, o texto e a linha de data.

## 0.15.31 — Calendário em pixels (2026-10-07)
- **Calendário redesenhado:** o mês numa grade tocável (um toque escolhe o dia, outro abre), hoje em vermelho, o dia escolhido em azul, um ponto onde há lembrete e uma estrelinha onde a cidade tem algo; as setas do título mudam o mês e o título volta para hoje. O dia aberto e o novo lembrete (campos O quê e Quando, tocáveis) no mesmo papel.

## 0.15.30 — Clima em pixels (2026-10-07)
- **Skycast redesenhado:** o céu da hora no fundo, a figura grande do tempo agora, a temperatura em números grandes, o céu em palavras com máxima, mínima e vento, e as próximas horas em cartões com a figura de cada uma; o download mostra o registro e a barra.

## 0.15.29 — Ajustes, Calc, Notas e Store em pixels (2026-10-07)
- **Ajustes redesenhados:** a lista das páginas com setas, as opções com ◂ valor ▸ (tocar numa ponta muda para aquele lado), o Wi-Fi com as barras de sinal e o cadeado, o Sobre o aparelho, o cabo USB, as páginas de debug e as telas dos códigos secretos (IMEI, rede, sensores, versão).
- **Calculadora:** as operações viraram botões grandes na tela (+ − × ÷, C, ponto e =), cada um com a tecla do PC que faz o mesmo; os números continuam no teclado numérico.
- **Notas:** o bloco amarelo pautado com a margem vermelha, a tinta azul e as letras da tecla em fichas.
- **Store e My Apps:** a loja do fabricante em ameixa e rosa, com as abas tocáveis, o que o app faz e a barra do download; My Apps na grade do menu.
- Os apps do Store mostram o próprio ícone (a cobra, a lanterna, as setas do conversor…) em vez de uma letra; o Reynard ganhou o dele, uma raposa.
- As dicas voltaram a mostrar `<`, `>` e `^` (a fonte da tela não tinha esses sinais).

## 0.15.28 — Tunes em pixels (2026-10-07)
- **Tunes Player redesenhado:** o painel do que toca (título, banda, visualizador, andamento, volume) igual ao da tela de espera, e a lista das músicas e do cartão SD; um toque escolhe a música, outro toca ou pausa.

## 0.15.27 — Contatos em pixels (2026-10-07)
- **Contatos redesenhados:** a segunda aba do Phone, com o retrato, o nome e o número; um toque escolhe, outro liga. A aba Calls é tocável. O novo contato tem os campos Nome e Número (tocar num passa a escrever nele) e as letras da tecla em fichas.
- Os campos de texto apagados ganharam contorno, para não sumirem no fundo.

## 0.15.26 — Mensagens em pixels (2026-10-07)
- **Mensagens redesenhadas:** as caixas (entrada, enviadas, nova, limpar), a lista de conversas com o retrato, a hora e as primeiras palavras (as não lidas em azul-gelo com um ponto), a mensagem aberta num balão, e a tela de escrever com o campo do número e o do texto, as letras da tecla que você está tocando em fichas embaixo. Tocar escolhe; tocar num campo passa a escrever nele.
- **Sem a faixa reta ao lado da tela:** as bordas da tela não deixam mais um pedaço reto (a faixa azul à direita e a do topo) quando o celular inclina.

## 0.15.25 — A chamada em pixels (2026-10-07)
- **Tela de chamada nova:** o retrato grande com as iniciais na cor da pessoa, o nome e o número, como a ligação está (chamando, tocando, o tempo de conversa, o motivo do fim), o custo, e o que é dito em balões (gravações em âmbar). Recebendo, anéis se espalham do retrato.

## 0.15.24 — Controles do celular mais claros (2026-10-07)
- **O mouse mexe no aparelho, a tela mexe nos apps:** o botão do meio sobe um estágio (bolso → fechado → aberto) e o direito desce (fecha o teclado, depois guarda), sem nunca sair do app em que você está. Para voltar no app: o Back do rodapé, o botão central ou desligar.
- **O toque age ao soltar:** apertar acende o item (na grade, o app fica escolhido enquanto você segura); soltar abre. Arrastar para fora antes de soltar cancela.
- **A rodinha rola de novo** (a grade, as listas, as páginas). O volume fica sobre o balancim do lado do celular (ou a rodinha do fone) e, com música tocando, com o celular no bolso.
- **A moldura preta da tela não fica mais cinza sob os postes:** o clareamento do sol só vale para o plástico e só com luz forte.

## 0.15.23 — As telas do celular em pixels (2026-10-07)
- **Tela de espera nova:** a hora grande, a data e a operadora, e o que espera em cartões com a cor do app na borda (chamadas perdidas, mensagens, lembretes); o painel da música com o visualizador, o andamento e o volume. Os quatro papéis de parede foram redesenhados em pixels (a cidade sob o céu da hora, com a lua na fase certa).
- **Grade de apps nova:** 4 × 4 ícones grandes, alvos fáceis para o toque; o escolhido ganha a moldura azul-gelo.
- **Discador novo:** o número grande à direita com o cursor piscando, o nome do contato, e as chamadas recentes: um toque escolhe, outro toque liga de volta. A aba Contacts também é tocável.
- **Tocar num cartão, num ícone ou numa chamada responde no item tocado**, não mais na linha inteira.

## 0.15.22 — A tela inclina com o celular (2026-10-07)
- **A tela acompanha o aparelho:** a imagem fica no vidro e inclina e balança junto com o corpo, em vez de ficar reta por cima.
- **O brilho da tela fica por cima e sem borrões:** o bloom sai da própria imagem e inclina junto; as manchas cinzas em blocos sobre a página sumiram.
- **As teclas acertam onde estão desenhadas:** as de música no topo (antes a área de clique ficava acima delas), atender, desligar e o botão central, mesmo com o celular inclinado.
- **A rodinha do mouse é o volume:** com o celular na mão (no mapa, sobre a tela, ela continua dando zoom) e, com música tocando, também com ele no bolso.

## 0.15.21 — Retoques do celular de toque (2026-10-07)
- **Ao sol, o plástico escuro aparece:** o celular preto mostra o cinza do plástico na luz forte, em vez de continuar um buraco preto.
- **Clicar no corpo do celular não avança mais:** fora do celular o clique continua sendo OK; sobre a tela, a carcaça ou o teclado, só a tela e as teclas respondem (errar uma tecla por pouco não faz nada).
- **O quadradinho do botão central está no centro** (estava meio milímetro para a direita e para baixo).

## 0.15.20 — O celular de toque (2026-10-07)
- **Celular novo, igual ao manual:** uma tela de toque bem maior e, no lugar da cruz e das teclas de função, um botão central redondo (cromado, com um anel azul-gelo) entre atender e desligar. O botão central leva à grade de apps e, na grade, volta à tela inicial (no teclado do PC, Home).
- **Toque na tela com o mouse:** clicar num app da grade abre o app; os dois botões do rodapé da tela (Menu, Back…) são tocáveis; no resto, o toque escolhe a linha tocada. Todo toque responde com um tique do alto-falante e o item aceso em azul-gelo.
- **O corpo agora é nítido:** os cubinhos são desenhados pela placa de vídeo na resolução do monitor (antes borravam, principalmente as teclas quando o celular inclinava). O teclado tem o número grande e as letras pequenas, como num celular de verdade, e o aro, o botão central e as teclas de música são cromados de verdade (claro em cima, uma faixa escura no meio).
- **O celular de começo é preto brilhante** (o Slate, da marca do executivo). Jogos já salvos mantêm o aparelho que tinham.
- **As barras da tela foram refeitas em pixels:** sinal, rede, GPS, mensagens, Wi-Fi, fone, a hora e a bateria em cima; as ações embaixo, como botões. As letras dos apps não ficam mais espremidas.
- **Segurar o botão do meio guarda o celular de uma vez**; segurar o direito volta a só olhar em volta.
- **O sol aquece o que você segura:** ao sol o celular fica mais claro e amarelado (âmbar com o sol baixo); na sombra a tela não fica mais tão apagada.
- **O fone de ouvido é preto** e entra no topo, à direita das teclas de música; a rodinha de volume é cromada e acende em azul-gelo sob o cursor.

## 0.15.19 — O celular de cubinhos (2026-10-07)
- **O corpo do celular agora é feito de cubinhos de 1 mm**, desenhado em pixels: as duas placas do deslizante (a de cima com a cor e o material do visual escolhido, a de baixo grafite com o teclado numérico), a borda arredondada, o aro cromado em volta da tela nos visuais que têm, a fenda do alto-falante e a câmera da frente. Ele aparece um pouco inclinado, com a borda de cima e o topo das teclas à mostra.
- **As teclas saltam 1 mm e afundam de verdade quando apertadas**; os vãos entre elas ficam na sombra, e o brilho da luz mais próxima corre pela frente como antes.
- **O nome do fabricante aparece na frente, na letra da marca**, à esquerda do alto-falante.
- **Capinhas no celular novo:** a capinha é feita de cubinhos, uma peça em cada placa (elas deslizam separadas), com a borda em volta e um lábio sobre a frente; o couro tem costura, o bumper tem nervuras nas laterais, o glitter brilha e a transparente deixa a cor do aparelho aparecer.
- **As teclas de atender e desligar têm o telefone verde e o vermelho** desenhados em cubinhos no topo da tecla, acesos com a tela ligada (no lugar das palavras SEND e END).
- **O celular desliza de verdade:** ele sai do bolso fechado, só com a tela e as teclas de navegar; o botão do meio abre o trilho e o teclado numérico sai de baixo da tela com um "tchac" de mola; mais um clique na tela inicial abre o discador. Digitar um número com ele fechado abre o trilho sozinho, e o Voltar na tela inicial fecha o trilho antes de guardar.
- **O celular balança de leve na mão:** ao virar a câmera ele fica um pouquinho para trás e mostra a lateral ou o topo, e volta quando você para.
- **O celular fica na sombra dos prédios:** de dia, na sombra, ele perde a luz do sol (com nuvens a diferença é menor); antes ficava sempre como se estivesse ao sol.

## 0.15.18 — As marcas da cidade (2026-10-07)
- **Quatro fabricantes de celular em vez de seis, cada um com o seu jeito:** a gigante confiável (modelos só com números, "6230i"), a do executivo ("Courier 8820"), a da moda e da música ("glide 52") e a robusta de obra ("Anvil X3"). O nome de cada uma continua sendo da cidade; o seu celular de começo é sempre da gigante.
- **O notebook do jogador é sempre o "tijolo de trabalho"**, com modelo curto de catálogo de empresa ("T61", "X300").
- **A maior operadora ganhou um nome cunhado de corporação** (como "Kesion" ou "Garix"), em vez de "Fulano Telecom"; as duas pré-pagas continuam com o nome de molde.
- **Os logos já existem no jogo** (ainda sem aparecer no mundo): cada marca com a sua letra de pontos (estêncil, itálico, condensada, com serifa…) e o seu símbolo em pixels, com uma variação pela cidade. Eles entram nos aparelhos em 3D, nas fachadas e nas telas de abertura nas próximas versões.
- Ao carregar um save, o celular volta com o corpo **e o fabricante** de quando foi salvo.

## 0.15.17 — O Ferret (2026-10-07)
- **Os selos de 2008 nos sites:** os botõezinhos de 88×31 no pé das páginas, em pixels: "Best viewed with Ferret", "Valid HTML 4.01", "Sign my guestbook", o contador de visitas (que cresce com os dias da cidade), o "under construction" com o operário cavando e o "powered by" do provedor no portal. As páginas caseiras de 1998 têm vários; os sites corporativos, nenhum. O "Best viewed" e o "Get Ferret" levam ao site do Ferret.
- **burrow-labs.net, o site de quem faz o Ferret:** "Get Ferret", notas de versão, fórum de bugs e a equipe (dez moradores da cidade que trabalham num prédio de escritórios). Começou numa sala em cima de uma lavanderia; cai no apagão do quarteirão como qualquer site. Entra nos favoritos de fábrica como **Ferret Help** e aparece no Lookwise.
- **O Ferret Mini vem instalado no celular**, na grade entre o Tunes e o Streetwire; o **Snake** foi para a pasta My Apps, para abrir espaço.
- **"Go to" no Ferret Mini abre uma lista:** "Enter address..." para digitar, e embaixo os favoritos (Lookwise, Mail, o portal), escolhidos com as setas ou direto pelo número.
- **O brilho (bloom) das telas do notebook e do celular ficou bem mais fraco e tem um teto:** no escuro a tela ainda brilha em volta, mas não borra mais o texto nem as imagens.
- **O navegador do celular agora é o Ferret Mini:** o endereço numa faixa marrom-terra, o furão como um pontinho que cava enquanto a página vem, e o ícone do app é a cara do furão.
- **Antes de uma página pesada pelo EDGE, o Ferret Mini avisa o preço** ("This page is about 172 KB and may cost $0.10 of data. Continue?"); Yes baixa, No fica onde estava. No Wi-Fi não pergunta.
- **As páginas no celular ganharam imagens:** fotos, mapas, anúncios, os rostos do Streetwire, o mapa da GridLink, a coruja. Os sites feitos para celular continuam leves e sem fotos; os outros chegam inteiros, com tudo, e custam mais.
- **Lookwise com a coruja:** a página inicial com o logo (os dois "o" são os olhos da coruja, que acompanham o que você digita), "Lookwise Search" e **"Owl's Pick"** (vai direto ao primeiro resultado). Enquanto a busca pensa, a coruja procura na página vazia.
- **Os resultados:** os **locais** (as três lojas do tipo buscado mais perto de você, com o mapa da cidade e os pinos A, B, C), os sites com a palavra buscada marcada no trecho, o endereço em verde e "Similar pages", os **links patrocinados** de lojas da cidade à direita e as páginas como pares de olhos. Nada encontrado: a coruja de cabeça tombada, "Hoo?".
- **O índice anda de madrugada:** os posts do Streetwire e as manchetes do dia só aparecem na busca depois das 3 h; das 2 h às 5 h a coruja voa na página inicial com a conta do que achou. Um site num bairro sem luz continua listado, mas não abre (o Lookwise não guarda cópia).
- **A moldura do Ferret ficou creme e mais espaçosa:** abas e favoritos mais altos, o texto afastado dos ícones, o nome Ferret no canto, e a página branca agora se destaca da moldura.
- **Os banners dos sites trocaram o desenho em ASCII por um ícone em pixels** (um globo no portal, um balão no Streetwire, uma xícara no café, uma fatia na pizzaria...).
- **O navegador do notebook agora se chama Ferret** (`ferret` no terminal; `lodestar` ainda funciona) e ganhou a moldura de 2008 desenhada em pixels: abas, o botão voltar grande e redondo (com um "tum" grave), avançar, recarregar/parar, início, o campo do endereço (amarelo com cadeado em https), a busca do Lookwise com a coruja, a barra de favoritos e a linha de status com a barra de progresso cor de terra.
- **O furão no canto cava enquanto a página carrega**, sai da toca quando termina e fica perdido quando o site não responde.
- **Abas:** Ctrl+T abre, Ctrl+Tab passa para a próxima, Ctrl+W fecha (ou o x da aba e o +). Cada aba tem o próprio voltar/avançar.
- **Favoritos:** de fábrica, o Lookwise, o webmail e o portal da cidade; Ctrl+D ou a estrela acrescenta ou tira. Ficam guardados no disco do notebook (`~/.ferret`), junto do histórico.
- **Links já visitados ficam roxos.** Ctrl+K digita direto na busca do Lookwise.
- Ctrl+←/→ continua trocando entre o terminal e o navegador; Ctrl+Tab agora é das abas.
- **Páginas de erro do Ferret**, com o furão perdido: "The connection has timed out" (o site está num bairro sem luz: o furão cava 8 s antes de desistir), "Server not found" (o endereço não existe), "Offline" (sem rede) e o botão **Try Again**.
- **Sites seguros (https):** o webmail e os bancos têm cadeado. Alguns sites (um banco pequeno, umas lojas, um certo fórum) estão com o **certificado vencido**: aparece a faixa amarela "This Connection is Untrusted", e **Add Exception...** deixa entrar (o Ferret lembra a exceção).
- **As páginas ganharam pixels:** o anúncio do portal virou um banner de verdade (468 × 60, com o botão "CLICK HERE!" piscando), e os sites podem ter fotos granuladas de 2008 com moldura e reflexo, mapa com pinos, estrelas de avaliação, o "NEW!", o ícone RSS, abas, caixas arredondadas, o letreiro que corre e o fundo com padrão em volta da coluna. **As imagens chegam depois do texto**, uma por uma ("Loading 3 of 7 items...").
- **Os sites das lojas parecem anos diferentes da web:** o de 1998 (fundo de estrelas, letreiro correndo, nome em WordArt, régua arco-íris, contador de visitas), o de 2001 (botões em relevo, foto com moldura, a oferta do dia com o "NEW!"), o de 2003 (faixa de foto da cidade e menu de botões à esquerda), o blog de 2005 (abas, notícias com RSS, caixas de horário, mapa e avaliações), o corporativo de 2008 (manchete grande, foto com reflexo, botão brilhante e ícones) e o de hospedagem grátis (o anúncio do provedor, a imagem que não carregou, "under construction").
- **O conteúdo vem da cidade:** a oferta do dia é algo que a loja vende de verdade, com o preço; o mapa do "Find us" é o mapa real em volta da porta; e o blog conta o que aconteceu perto da loja nesta semana (o apagão do quarteirão, uma batida na esquina, o trânsito).
- **O portal da cidade de cara nova:** brilho e listras de 2008, a manchete principal com foto (a rua escura quando é um apagão), o tempo com o ícone (sol, lua, nuvem, chuva ou neve) e o vento, uma caixa de busca com a coruja que manda direto para o Lookwise, o diretório por grupos e, todo dia, anúncios de lojas que existem na cidade, nas cores do site delas.
- **Streetwire:** o selo "beta", **cada post com o rosto do autor** (a mesma pele, cabelo, olhos e roupa de quando você cruza com ele na rua), a foto quando o post tem, e os **assuntos em alta** do dia (#Blackout, #Traffic, o bairro, a loja); clicar num deles lista os posts.
- **Webmail:** o login numa caixa com degradê, campos afundados, o botão azul brilhante e o "25 MB!".
- **Novo site: a GridLink** (`www.gridlink-power.com`), a empresa de luz e telefone fixo: o **mapa dos 9 setores aceso como a rede está agora** (o setor apagado fica escuro), há quanto tempo cada um está sem luz, como reportar uma falta. Ela também cai quando o setor do centro apaga. O portal e o Lookwise apontam para ela.
- **Switchboard:** pastas acesas para tópicos novos, barras de categoria e o "Who is online".
- Nos sites com cara de 2008, os campos de texto agora são afundados e os botões, as pílulas brilhantes; e as bordas dos parágrafos não ficam mais com a cor do fundo.
- Por dentro: as peças com que as páginas do Ferret vão ser desenhadas em pixels (brilhos, degradês, cantos redondos, estrelas, fotos granuladas de 2008, mapas, letras grandes). Por ora só aparecem na amostra de teste da tela.

## 0.15.16 — A tela do notebook inclina junto (2026-10-07)
- **Olhando o notebook de lado, a tela acompanha a tampa em perspectiva**, com o texto inteiro, em vez de virar blocos de letras. De frente continua nítida, pixel por pixel.

## 0.15.15 — O fone isola, e o teclado livre (2026-10-06)
- **Com o fone, o mundo fica abafado e mais baixo** (a chuva não cobre mais a música); sem fone, nada muda.
- **A música no bolso ficou menos abafada** e um pouco mais alta.
- **Q/E e ←/→ não giram mais a câmera:** a vista é só pelo mouse, e essas teclas ficam livres (Alt+←/→ agora só mexe na música).

## 0.15.14 — Três teclas no canto e a rodinha do fone (2026-10-06)
- **Só três teclas de música no topo do celular**, no canto direito e desenhadas em pixels finos, levemente arredondadas: **anterior, tocar/pausar e próxima** (o ícone de tocar vira pausa quando a música toca).
- **O volume foi para o fio do fone:** um controle branco com uma **rodinha** no cabo. Com o mouse solto (Alt ou celular na mão), passe o cursor perto dela e **gire a roda do mouse**; a área é maior que a rodinha, então ela pode balançar à vontade. Sem fone, o volume segue em Alt+↑/↓ e no Tunes Player.
- **Segurar anterior/próxima avança ou volta dentro da música** (seek), cada vez mais rápido, tocando ou pausada; um toque rápido continua pulando de música. Vale para os botões do celular e para Alt+←/→.
- As teclas ficaram um pouco à direita do centro do topo, longe da curva do canto.
- **Dica no canto da tela:** "ALT  free the mouse", ou "ALT  free the mouse / music" quando há música carregada.

## 0.15.13 — Teclas de música no topo, shuffle e o fio que desce (2026-10-06)
- **As teclas de música foram para o topo do celular**, à direita da entrada do fone: **|<  >  >|** e o volume **-  +**. Com o celular no bolso, **segure Alt** e o topo dele sai um pouco do bolso para você clicar nelas; as teclas de atalho aparecem em cima de cada uma.
- **Atalhos de teclado:** **Alt+↑/↓** volume, **Alt+←/→** música anterior/próxima, **Alt+P** tocar/pausar. As **teclas de mídia do teclado** (como Fn+F9) também funcionam, e o Windows mostra a música que está tocando no controle de mídia dele.
- **Shuffle:** no Tunes Player, a tecla **0** liga e desliga; o "anterior" volta pelas que já tocaram.
- **Visualizador refeito em pixels finos:** barras mais finas que sobem e descem suavemente, num fundo escuro com cantos arredondados, e menos sensível (não fica mais no máximo o tempo todo).
- **O volume** virou dez barrinhas subindo, separadas da barra de progresso.
- **O fio do fone** agora faz uma volta para cima e desce pelo lado do celular até sair por baixo da tela; o plugue ficou maior.

## 0.15.12 — Título em 3D e o fio do fone (2026-10-06)
- **O fundo do título agora é 3D:** linhas do terminal da cidade flutuam em profundidade, com tamanhos diferentes, e vêm na sua direção, como se você avançasse entre elas. As mais próximas desfocam e somem antes de passar.
- **O fio do fone aparece:** com o fone posto, o plugue fica encaixado no topo do celular e o cabo branco sobe até sair da tela, em direção às orelhas.

## 0.15.11 — Visualizador, música que os outros ouvem, e o celular sempre à mão (2026-10-06)
- **Visualizador de espectro**, como os players de 2008: barras verdes, amarelas e vermelhas, com o pico caindo devagar, desenhadas em pixels finos (camada HD). Ele aparece no **Tunes Player** e no novo **painel de música da tela inicial**, que também mostra a barra de progresso, o tempo e o volume.
- **Tela inicial navegável:** **↑/↓** passam pelas notificações (ligação perdida, mensagens, lembrete, a música) e **OK** abre o app da escolhida. Sem nada escolhido, OK abre o menu. Para limpar as notificações agora é o **\***.
- **O celular fica sempre levantado por inteiro** quando está na mão (não sobe e desce mais para digitar). No bolso, ele continua espiando quando chega uma notificação.
- **Os NPCs ouvem a sua música** quando ela sai do alto-falante (mais longe com o celular na mão, pouco no bolso, nada com fone). Às vezes alguém comenta, e quem conhece a banda da cidade fala dela pelo nome.
- **Som de 2008:** a música passa por um MP3 de 128 kbps (nada acima de ~16 kHz) e, no fone, por fones baratos da época (grave fraco, médio na frente, agudo abafado). O **tamanho** de cada música no celular é calculado pela duração a 128 kbps (o arquivo não muda).
- **O controle no fio saiu** (os botões laterais fazem o mesmo). Com o fone posto, aparece um **`(o)` na barra do celular**, e o fone ganha a etiqueta **WORN** na mochila.
- **WATCH CCTV voltou ao título** (embaixo, com save): ele carrega a cidade do save e mostra as câmeras como antes; Esc volta ao título. O texto do fundo do título ficou desfocado e mais escuro.

## 0.15.10 — Título mais rápido e o celular mais fácil de usar com música (2026-10-06)
- **O título abre na hora:** a cidade não é mais gerada atrás do menu. Ela só é feita depois que você escolhe **CONTINUE** ou **NEW GAME**, e o jogo começa sozinho quando fica pronto. No fundo do título, agora há um terminal da cidade rolando. O botão **WATCH CCTV** saiu do título.
- **NEW GAME apaga o save** (depois de um segundo clique de confirmação): não dá mais para voltar ao jogo antigo pelo CONTINUE.
- **O app Phone:** Ligações e Contatos viraram um app só, com duas abas (**←/→** trocam). Na vaga que sobrou entrou o **Tunes Player, que agora vem instalado** em todo celular.
- **Botões laterais no celular** (à esquerda do aparelho, clique com o cursor): **+** e **−** mudam o volume da música, e o do meio **toca ou pausa**, em qualquer tela. O volume aparece na tela por um instante.
- **Tocando agora na tela inicial:** com uma música carregada, um cartão mostra o título e a banda, e se está tocando (`>`) ou pausada (`"`).
- **Digitar ficou mais claro:** no modo Abc, a letra escolhida na tecla fica acesa; no T9, aparecem **todas as sugestões** da sequência, com a escolhida acesa (**\*** passa para a próxima).
- *(debug)* Um jogo novo começa com um fone na mochila.

## 0.15.9e — Reynard, o mensageiro cifrado (2026-10-06)
- **Reynard** (em My Apps): mensagens cifradas de ponta a ponta, presas ao seu número. Para registrar, ele **manda um código por SMS** que você digita de volta, e o celular cria a sua chave.
- **Número de segurança:** em Options → Verify, 60 dígitos para comparar com o contato (pessoalmente, ou lidos numa ligação). Bateu, marque como verificado (aparece um `v` ao lado do nome).
- **Mensagens que somem** (1 hora, 1 dia, 1 semana), **apagar a conversa** e, no Menu, **apagar tudo** (as conversas e a chave). Sem rede, a mensagem fica esperando; depois vira `v` (enviada) e `vv` (entregue).
- *(por enquanto)* Ele não está na loja: no jogo de verdade virá depois de desbloquear o celular. Agora o modo debug o instala, com uma conversa de teste.

## 0.15.9d — Fone de ouvido e o controle do fio (2026-10-06)
- **Ponha o fone:** com fones (`headphones` da loja de eletrônicos, ou o `hands_free` da loja de celulares) na mochila, aperte **E** sobre eles para pôr ou tirar. Com o fone, a música fica limpa e em estéreo, e só você ouve.
- **O controle do fio:** com o fone posto e uma música carregada, o controlezinho aparece pendurado no cabo, embaixo da tela. **Segure Alt** (ou tire o celular) e clique: **−**/**+** volume, **|<**/**>|** pulam, o do meio pausa ou continua.
- Jogou o fone fora? Ele sai das orelhas, e a música volta para o alto-falante.

## 0.15.9c — Tunes Player e o cartão SD (2026-10-06)
- **O Tunes Player funciona:** compre-o na loja do celular (Wi-Fi) e abra. **↑/↓** escolhem, **OK** toca (ou pausa a que está tocando), **←/→** pulam a faixa, **\*** e **#** mudam o volume. A música **continua com o celular no bolso** e passa sozinha para a próxima. Tocar gasta um pouco de bateria.
- **Sem fone, ela sai do alto-falante do celular:** fininha e metálica na mão, e abafada no bolso. (O fone de ouvido vem na próxima.)
- **Suas músicas no cartão SD:** ponha MP3/OGG/WAV/M4A/FLAC na pasta **`music/`** ao lado do jogo, e elas aparecem na seção SD CARD. O cartão não ocupa a memória do celular.

## 0.15.9b — Músicas chiptune da cidade (2026-10-06)
- **Seis músicas chiptune de bandas da cidade** (Neon Paycheck, The Overpass Kids, Payphone Saints, Lowtide Signal, Grid Orphans, Kiosk Dreamers), tocadas em quatro vozes como num console antigo. **Ouça e diga quais ficaram boas e quais precisam de outra passada.**

## 0.15.9a — Alt solta o mouse (2026-10-06)
- **Segure Alt para soltar o mouse:** enquanto Alt está apertado, o cursor aparece e você pode **clicar nos botões do relógio** (LIGHT, MODE, START; segurar START acerta o alarme, como o K). Você continua andando, e ao soltar Alt a câmera volta para o mouse. (Se você segurar Alt por mais de uns 5 s, o navegador pode pedir um clique para recapturar o mouse.)
- O Alt não abre mais a barra de menus do Electron nem dispara atalhos do navegador (Alt+← voltava a página).

## 0.19.3 — Correção: o `tdump` já vem instalado (2026-10-06)
- **O `tdump` agora vem pré-instalado no notebook** (junto do `wcrack`): o primeiro trabalho pede para quebrar uma rede WEP, e isso precisa do `tdump` — mas, sem uma rede aberta por perto, não dava para instalá-lo pelo `apt` e o jogo **empacava**. Agora os dois já estão em `~/bin` desde o começo. (As outras ferramentas — `mmap`, `tnet`, `mbus` — seguem vindo do `apt` quando você estiver on-line.)

## 0.15.7e-f4 — Terminal: atalhos de edição (readline) (2026-10-06)
- **Edição de linha mais rápida no terminal:** **Ctrl+A/E** vão ao começo/fim, **Ctrl+U/K** apagam até o começo/fim, **Ctrl+W** (ou Ctrl+Backspace) apaga a palavra de trás, **Ctrl+←/→** (ou Ctrl+B/F) pulam palavra. (De quebra, Ctrl+tecla parou de digitar a letra solta por engano.)

## 0.15.7e-f3 — Terminal: menu de completar e clicar a rede no comando (2026-10-06)
- **Tab com várias opções abre um menuzinho** acima do comando, em vez de só listar: **↑/↓ ou Tab** passam pelas opções, **Enter** ou **→** escolhem. (Some ao digitar qualquer coisa.)
- **Clicar uma rede na lista do `iwlist` agora cai certinho** entre as aspas do `iwconfig` que o Tab montou — sem duplicar as aspas. (Vale para colar qualquer valor entre aspas.)
- *(Falta do bloco:)* o Tab pular entre os campos do comando montado e clicar direto numa opção do menu — próxima leva.

## 0.15.7e-f2 — Terminal: tdump que fica escutando, iwconfig sem chute (2026-10-06)
- **`tdump` sem `-c` agora fica escutando o canal** e mostrando os pacotes **até você apertar Ctrl+C** — para ficar de olho numa rede esperando uma credencial de login aparecer em texto claro. (Antes ele pegava um punhado de pacotes e parava sozinho. Com `-c N` ele continua pegando só N e para, como antes.)
- **`iwconfig` montado com o Tab não chuta mais a rede:** vem `iwconfig wlan0 essid "" key ` com o cursor **entre as aspas**, para você digitar (ou, em breve, clicar na rede certa na lista do `iwlist`) — a rede mais forte por perto raramente era a que você queria.
- *(ferramenta de playtest)* O registro de playtest agora anota as **teclas de navegação** que você usa no terminal (Tab, setas, Home/End, Backspace, Ctrl+…), para vermos onde a edição de comando ainda é desajeitada.

## 0.15.7e-f1 — Terminal: cores ao digitar e sugestão fantasma (2026-10-06)
- **O terminal agora se colore enquanto você digita:** o comando fica aceso quando o notebook sabe rodá-lo e **vermelho** quando não existe; opções (`-w`), textos entre aspas, operadores (`&&`, `;`, `>`) e alvos de rede (um IP ou o nome de uma rede por perto) ganham cada um a sua cor. Ajuda a ver o erro antes de apertar Enter.
- **Sugestão fantasma, estilo fish:** conforme você digita, o terminal mostra em cinza o resto mais provável do comando — do que você já rodou antes, ou o nome do comando que está começando. Aperte **→** ou **End** no fim da linha para aceitar. (Some quando não encaixa nada.)

## 0.15.7e — Terminal: encadear comandos e aspas (2026-10-06)
- **Encadeie comandos** no notebook: `&&` roda o próximo se o anterior começou (ex.: `iwconfig wlan0 essid "Cafe" && dhclient`), `||` roda se não começou, `;` roda sempre. (Antes, só o primeiro comando rodava.)
- **Aspas automáticas:** digitar `"` já põe o par `""` com o cursor no meio; digitar a aspa de novo em cima da que fecha só passa por ela; apagar a de abrir tira o par vazio junto.

## 0.15.7e-cd — Terminal: clicar campos e montar comandos (2026-10-06)
- **Clique em qualquer campo** do que o terminal mostra para colá-lo no comando — não só IP/host, mas também MAC/BSSID, o nome de rede entre aspas e a chave de Wi-Fi. (Antes só IP e host.)
- **Tab monta o comando:** digite `iwconfig`, `tdump` ou `wcrack` sozinho e aperte Tab — a linha vem pronta, com a rede mais forte por perto já no lugar e o cursor no próximo campo a preencher. (O menu suspenso de opções e o Tab entre campos vêm depois.)

## 0.15.8c — Entrar no fórum e responder (2026-10-06)
- **Agora dá para ter conta no Switchboard** — pelo seu número, como o resto da sua identidade na rua. Em **Sign up** você escolhe um apelido; o fórum te manda um **código por SMS**; você confirma e está dentro. (Perdeu o número, perdeu o apelido.)
- **Responder nos tópicos:** logado, cada tópico tem uma caixa de resposta. O que você escreve entra com o seu apelido, e o autor do tópico responde um tempo depois — do jeito dele, lendo o tom do que você disse (seco se você foi grosso, "np" se agradeceu).

## 0.19.2b — Debug: rede aberta no spawn, ferramentas no apt (2026-10-06)
- **(debug)** Uma rede Wi-Fi **aberta no ponto inicial**, para testar ficar online sem ter que craquear antes. E o `bruter`/`wcrack` agora também aparecem no `apt` (como atalho de teste; a entrega "de verdade" será pelo fórum). Tudo agrupado em um só lugar, para sair fácil antes de uma versão pública.

## 0.19.2 — Quebrar a chave WEP pelo ar (2026-10-06)
- **A rede da subestação (GRIDLINK-nn) é WEP — e dá para tirar a chave do ar.** Em vez de a chave aparecer de graça na tela de Wi-Fi do celular (muleta removida), agora: `tdump mon "GRIDLINK-nn" -w grid.cap` fica ouvindo **sem entrar na rede**, juntando os vetores (o contador de #Data sobe); quanto mais perto e mais forte o sinal, mais rápido enche. Quando tiver o bastante, **Ctrl+C** grava a captura; `wcrack grid.cap` resolve os 10 dígitos. Aí é o `iwconfig … key <chave>` + `dhclient` de sempre.
- O `wcrack` já está em `~/bin` (como o `bruter`). **WPA continua fora de alcance** por aí — essas chaves vêm de outra fonte. O que você consegue depende só de quanto tempo capturou, não da sorte do trânsito da rede.

## 0.19.1 — apt: instalar os programas (2026-10-06)
- **O notebook vem quase pelado.** As ferramentas comuns agora se instalam com `apt`, estando numa rede: `apt-get update` e depois `apt install mmap tdump tnet mbus` (ou `apt search` para ver o catálogo). Precisa de internet — baixa de um espelho pela linha, no tempo da conexão.
- O `bruter` continua em `~/bin` por ora; as ferramentas mais afiadas não se compram em loja — essas você acha por aí.
- (Adiantado da etapa 19 porque o laço da fatia vertical precisa dele.)

## 0.15.8 — Switchboard, o fórum (2026-10-06)
- **O fórum dos hackers da cidade**, em `www.switchboard.net`: não está no buscador nem no portal — você chega por alguém te passar o endereço. Três quadros: **Guides** (como as coisas se fazem, com os tutoriais fixos), **Contracts** (trabalhos abertos, sem nomes) e **Lounge** (conversa fiada).
- Por enquanto é só leitura: cada tópico abre com os posts sob apelidos. Criar conta pelo número (confirmada por SMS) e responder vêm a seguir.
- **Correções:** no notebook, **maximizar um painel agora é Ctrl+↑** (antes era F11, que abre/fecha a tela cheia do próprio jogo). E o navegador (`lodestar`) voltou a abrir em partidas salvas antes de ele existir.

## 0.15.7 — Janelas no notebook (2026-10-06)
- **Terminal e navegador lado a lado:** abra o Lodestar (`lodestar`) com o terminal aberto e os dois dividem a tela, com um traço no meio e uma seta apontando qual tem o teclado. **Ctrl+←/→** (ou Ctrl+Tab) troca o foco; **F11** deixa um só painel em tela cheia e volta.
- **O mouse funciona no notebook:** o cursor aparece ao abrir a tampa. Clique num painel para focá-lo; no navegador, clique nos botões da barra, no endereço e nos links; a rodinha rola o painel sob o cursor.
- **Copiar e colar:** arraste para marcar um trecho da tela (vale atravessar do terminal para o navegador) e, ao soltar, ele vai para a área de transferência (e a do sistema, quando dá). **Ctrl+V** cola no prompt ou no campo do navegador. **Insert** mostra o que você copiou.
- **Clicar num endereço** (um IP ou host no terminal) o digita no prompt, para não ter de redigitar.

## 0.15.6 — Streetwire na web (2026-10-06)
- O **site do Streetwire** (`www.streetwire.com`, link no portal): o feed, cada post com os comentários e o perfil de cada pessoa, no notebook e no celular.
- **Comente nos posts:** crie uma conta (o link de confirmação chega no seu e-mail da cidade) e escreva o que quiser. O autor lê do jeito dele e às vezes responde, um tempo depois (de manhã, se estava dormindo): agradece um elogio, diz onde fica o lugar se você perguntar, conta onde aconteceu a batida. Desconhecidos respondem menos que quem já conversou com você.
- Seja grosso e o autor bloqueia você dos posts dele. Seus comentários aparecem também no app do celular.

## 0.15.5 — A web no celular (2026-10-06)
- **Lodestar Mini**, app grátis na loja do celular: a web da cidade numa coluna só. Para cima/baixo passa de link em link, esquerda/direita rola uma tela, OK abre o link ou escreve no campo, a tecla da esquerda digita um endereço (no multi-tap; palavras viram busca), a da direita volta, * recarrega e 0 vai para a página inicial.
- É lento e caro, como em 2008: cada página sai do pacote de dados, a não ser no Wi-Fi. Os sites com versão para celular (o portal, o buscador, o e-mail, bancos e lojas de celular) pesam um quinto; os outros vêm inteiros, espremidos na tela.
- Dá para entrar no e-mail pelo celular, digitando no teclado numérico.

## 0.15.4 — E-mail (2026-10-06)
- **Webmail** do provedor da cidade: no navegador, o link "Mail" do portal. Crie uma conta com usuário e senha; o código de confirmação chega por SMS no seu celular. Tab passa entre os campos e Enter envia.
- A caixa de entrada tem o que existe de verdade: spam de 2008, newsletters das lojas onde você pagou com cartão e, toda segunda-feira, o extrato do banco com as suas compras.
- Esqueceu a senha? O código vai para o número da conta. Se você trocou o chip, ele não chega.

## 0.15.3 — O buscador (2026-10-06)
- **Lookwise**, o buscador da cidade: no navegador, digite palavras no endereço (F6), como "pizza kessler" ou o nome de uma loja, e aperte Enter. Ele só acha quem tem site; as lojinhas sem site você descobre na rua ou no diretório do portal.

## 0.15.2 — Sites com cara própria (2026-10-06)
- Os sites agora variam muito mais: bancos corporativos, bares caseiros com contador de visitas, lojinhas com a página "em construção". Cinemas têm as sessões da semana, hotéis e motéis as diárias, bancos as taxas e a lista de agências.
- Os sites dizem se a loja está aberta agora. Depois de um apagão no quarteirão, avisam que voltaram.

## 0.15.1 — A web no notebook (2026-10-06)
- No notebook, com o Wi-Fi conectado, digite **`lodestar`**: abre o navegador. A página inicial é o portal da cidade, com as notícias do dia, o tempo e um diretório das empresas. Cada empresa com site tem cardápio ou produtos com os preços de verdade, o horário, o endereço, o telefone e quem trabalha lá. As lojas pequenas quase nunca têm site.
- As páginas descem devagar, como em 2008, na velocidade do Wi-Fi. Se o prédio de uma empresa está sem luz, o site dela não responde.
- Teclas: **F6** digita um endereço, as **setas** rolam, **Tab** escolhe o link, **Enter** segue, **Backspace** volta, **F10** fecha.

## 0.14.9 — Memória, nomes e números (2026-10-06)
- Quem já falou com você lembra do que você perguntou ("Weren't you asking about Nguyen Pharmacy yesterday?") e esquece com o tempo; uma grosseria demora mais para ser esquecida.
- Quem te disse o nome aparece com ele sobre a cabeça quando você o vê de novo.
- Peça o número ("can I get your number?"): quem gosta de você dá, e ele entra nos contatos do celular.
- Por SMS, quem estava dormindo responde "just woke up"; ao telefone, de um bar ou na chuva, a pessoa estranha o barulho.
- Quando não entendem o que você disse, aparecem sugestões do que dá para conversar.

## 0.14.8 — Pular, agachar e andar entre as cadeiras (2026-10-06)
- **Espaço** pula e **C** (segurando) agacha: o olho desce, os passos ficam lentos e não dá para correr. Quem está perto estranha se você fica agachado ou pula do lado. A câmera de segurança de debug passou do C para o **V**.
- Cadeiras e banquinhos não bloqueiam mais o caminho: dá para andar entre as mesas de bares e lanchonetes.
- A etiqueta de perto não pula mais de um lado para o outro do produto: fica à direita da mira (à esquerda só sem espaço).

## 0.14.7 — Falar ao telefone (2026-10-06)
- Corrigido: na caixa da conversa, **Esc** abria o menu de pausa em vez de encerrar a conversa, e digitar **C** abria a câmera de segurança em vez de escrever a letra.
- Ligue para alguém e, quando atender, a conversa fica aberta: o celular desce para perto da orelha e você digita embaixo da tela, como na rua. A resposta vem pela ligação, com a voz dela. Se você ficar calado, ela pergunta se tem alguém na linha e depois desliga. **Esc** desliga.

## 0.14.6 — Conversar por SMS (2026-10-06)
- Depois do seu teste na calçada: "how are you today", "what's your age" e "did you watch the game?" agora são entendidos como conversa fiada (antes eram lidos como "o que você viu?" ou não eram entendidos).
- Mandar SMS a alguém agora é uma conversa: a pessoa entende o que você escreveu e responde no jeito dela de digitar. Um "hey" de um número que ela não conhece recebe "Who is this?". Dizer quem você é ("it's me, we talked on the street") só funciona com quem já falou com você pessoalmente. Por mensagem ninguém explica caminho, porque não sabe onde você está. No trabalho, alguns avisam que não podem falar muito; quem está dormindo responde bem depois; e quem perde a paciência para de responder.

## 0.14.5 — A etiqueta de perto (2026-10-06)
- Olhe um produto na prateleira por meio segundo, de perto, e a etiqueta dele aparece ao lado, ampliada: a loja, o nome, o preço grande na faixa amarela e o código de barras. Numa loja escura, ela também fica escura. A caixa de preço antiga saiu.

## 0.14.4 — Falar na rua e os balões (2026-10-06)
- **F** em quem está na calçada agora abre uma conversa, como no balcão: pergunte o caminho, o nome, o que a pessoa faz. Ela para, olha para você e aponta o caminho quando o diz. Se você se afastar, ela segue a vida. **Tab** abre a lista de lugares do "pedir direção". Tarde da noite, ou atravessando a rua, nem todo mundo para.
- **Balões** sobre a cabeça das pessoas: elas reclamam quando a chuva começa, comentam o apagão e a luz voltando, ouvem uma batida perto, reclamam se você esbarra correndo ou fica encarando, falam ao telefone, e duas esperando o mesmo sinal conversam entre si. Bem perto, a fala também aparece como legenda apagada embaixo.

## 0.14.3 — Conversar com o balconista (2026-10-06)
- Depois do seu primeiro teste: "I wanna pay" agora recebe uma resposta de caixa ("Sure. I'll ring you up.") em vez de "You can have that one.", e "where do you live?" é uma pergunta pessoal ("Around. Why do you want to know?"), não um pedido de direção.
- **F** no caixa agora é uma conversa: digite em inglês o que quiser dizer e aperte **Enter**. A resposta aparece embaixo, como legenda, letra por letra, com um murmúrio de chiptune (teste de ouvido seu). Acima da caixa, o jogo mostra o que entendeu da frase e o tom, com um ponto num pequeno quadro (mais à direita é mais educado, mais acima é mais pressionando), para você corrigir antes de enviar.
- Para pagar, peça ("I want to pay", "I'd like a coffee") ou aperte **Tab**; **Esc** sai. O nome do balconista aparece depois que ele o diz.

## 0.14.2 — As respostas (2026-10-06)
- Por baixo, ainda sem tela: os balconistas já respondem com a voz deles e com fatos do jogo (o preço da loja, o nome deles e de quem trabalha ali, o caminho de verdade até um lugar ou uma rua, a hora). Ficam mais simpáticos ou mais secos conforme o seu tom e se lembram de você. Perdem a paciência com quem grita bobagem. O que o jogo ainda não sabe fazer (emprestar dinheiro, deixar entrar) recebe um não educado.
- Pedir direção na rua: as pessoas não falam mais com erros de digitação.

## 0.14.1 — A leitura do que se digita (2026-10-06)
- Por baixo, ainda sem tela: o jogo já entende frases livres em inglês para os NPCs (cumprimentar, perguntar onde fica, o preço, quem trabalha aqui, pedir um favor...), com erros de digitação, abreviações de 2008 (u, thx, pls) e o tom (educado ou grosso, calmo ou pressionando). A conversa na tela vem nas próximas versões.

## 0.13.10f — Sentar (2026-10-06)
- Aperte **F** de frente para uma cadeira, uma banqueta, um sofá ou um banco de praça (ou o do ponto de ônibus) para sentar, virado para onde o assento está virado. Andar, ou **F** de novo, levanta.
- Sentado, o **N** abre o notebook ali mesmo: em cima da mesa ou do balcão da frente, se houver um, ou no colo.

## 0.13.10i — Toda loja tem sala (2026-10-06)
- Quase todas as empresas da cidade não tinham loja de verdade: entrando pela porta, só havia o saguão e apartamentos. Agora toda empresa tem a sua sala no térreo, com caixa e prateleiras.
- Nos prédios fundos e estreitos a loja fica na ponta que dá para a rua; nos prédios médios, o corredor dos moradores passou para os fundos e a porta deles fica ao lado da vitrine.
- Nos prédios pequenos, o térreo inteiro é a loja, com um corredor no fundo que leva ao elevador dos moradores. Fora do horário, a porta desses prédios fica trancada por fora.
- Lugares com mesas ganharam tomadas também nas lojas novas.
- A cidade de cada semente mudou por dentro (um save antigo pode começar dentro de uma parede: comece um jogo novo).

## 0.13.10q — Debug fechado ao abrir (2026-10-06)
- As linhas de debug começam sempre escondidas; **F3** as mostra (a escolha não fica mais salva entre sessões).

## 0.13.9c — Tomadas (2026-10-06)
- Cafés, bares, cybercafés, lanchonetes, lavanderias e motéis têm tomadas na parede, perto das mesas. Aperte **F** de frente para uma para plugar o celular; ele carrega enquanto você fica perto (afastar-se puxa o cabo).
- O notebook só carrega se você sentar perto de uma tomada.
- O carregador não é mais vendido nem ocupa a mochila: quem tem o aparelho tem o carregador.

## 0.13.10e — Todo prédio tem entrada (2026-10-06)
- Os prédios no miolo dos quarteirões não ficam mais sem porta nem com a porta dando num quintal fechado: entram por becos que chegam à rua, viram os fundos do prédio da frente, ou o terreno vira um quintal.
- A cidade de cada semente mudou (um save antigo pode começar dentro de um prédio: comece um jogo novo).

## 0.13.10p — Registro de playtest (2026-10-06)
- Novo atalho `jogar-playtest.bat`: o jogo grava um registro da sessão na pasta `playtest/` (por onde você andou, o que comprou, o dinheiro, mensagens, onde travou) para o Claude ler depois num relatório.
- **F8** escreve uma nota de teste: o jogo pausa, a tela é fotografada e a nota fica guardada com o lugar e a hora.
- O painel de debug (**F3**) foi redesenhado: um quadro organizado no canto, com a versão, a posição, para onde você olha (em graus) e a loja em que está.
- Novo atalho `atualizar.bat`: traz a versão mais nova do GitHub.
- Voltar ao título e fechar sem jogar não deixa mais um registro vazio na pasta `playtest/`.

## 0.13.10d3 — Estrelas e luar (2026-10-05)
- As estrelas brilham mais, e ainda mais num apagão; não aparecem mais duplicadas ao passar de uma célula para outra.
- A lua cheia solta raios de luz pequenos entre os prédios, como o sol.
- Olhar para o céu não deixa mais as bordas da tela vermelhas.
- Os holofotes de fachada não aparecem mais no chão dos corredores do prédio vizinho.
- Eclipses lunares: a sombra da Terra escurece a lua e a deixa cor de cobre na totalidade (o de 20/02/2008 é visível na cidade).
- O visor do relógio não fica mais escuro de dia; à noite continua precisando da luz.
- A lua ganhou mares escuros e textura; o eclipse ficou menos vermelho e com detalhe; raios do luar mais suaves; o céu é o de Nova York (40,7° N).

## 0.13.10d2 — O céu de 2008 e portas sem vidro fantasma (2026-10-05)
- A lua e o sol estão onde estavam de verdade em 2008, vistos da cidade: a lua nasce mais tarde a cada dia, some do céu da noite em parte do mês, e as fases batem com o calendário (em 21 de fevereiro, às 22h30, a lua cheia está alta no sudeste, na hora do eclipse daquele ano).
- As estrelas do céu são as de verdade: Órion, Sírius, a Ursa Maior, a Polar sempre ao norte; cada uma com a sua cor (azuladas, brancas, alaranjadas) e mais cintilantes perto do horizonte. Giram com a noite.
- Pela porta aberta, a loja vista da calçada tem as mesmas cores vistas de dentro: acabou o vidro invisível que lavava a sala.
- As lojas ficam com a luz acesa: não há mais loja escura que acende quando você entra.
- As folhas das portas de vidro giram a partir da face de dentro da parede, sem entrar no batente.
- A lanterna do celular ilumina a sala vista pela porta ou pela janela pela distância de verdade.

## 0.13.10d — Portas de verdade (2026-10-04)
- As portas giram de verdade na dobradiça, e a porta de rua vista da calçada é a mesma vista de dentro: as duas folhas de vidro se abrem para dentro, e de lado se vê a espessura da folha.
- Cada porta é feita de alguma coisa: vidro nas portas de rua, madeira nos apartamentos, aço com barra na porta do estoque, painel pintado nos escritórios e saguões. Cada uma tem o próprio som (o vidro tilinta ao fechar, a de aço bate pesada e fecha devagar com a mola).
- As lojas fechadas baixam a porta de enrolar de aço na frente da porta, no horário, com o barulho das lâminas; de manhã ela sobe antes de abrir.

## 0.13.10c — Plantas desenhadas (2026-10-04)
- Diners, cafés, delis, pizzarias, bares, mercearias, lavanderias, cybercafés e as lojas de prateleira têm agora um arranjo pensado: no diner, o fogão no fundo, o balcão com banquetas e as mesas perto da vitrine; no bar, as garrafas atrás do balcão; na mercearia, as geladeiras no fundo e os corredores saindo da porta.
- O caixa de toda loja fica sempre ao alcance de quem entra pela porta.
- Só vira loja o que tem frente para a rua: as salas dos fundos de um prédio com lojas são escritórios ou apartamentos, e toda loja tem a própria porta.
- Mais prédios ganharam porta para a rua (a porta procura um trecho livre da fachada em vez de desistir).

## 0.13.10b2 — Através da sala (2026-10-04)
- Num prédio com janelas dos dois lados, olhando de fora você vê a sala e, pela janela do outro lado, a rua de trás.
- Pela porta de rua aberta, a sala tem a mesma luz vista da calçada e vista de dentro; de dentro, o vão aberto não tem mais um vidro invisível.
- Não há mais um pedaço de janela em cima das portas de rua.
- Monitores, abajures e telas acesos dentro das salas brilham também vistos de fora, pela janela ou pela porta.

## 0.13.10b — Um só espaço (2026-10-04)
- O que você vê pela janela de fora é o mesmo andar que você encontra lá dentro: as mesmas salas, as mesmas lâmpadas acesas, as portas fechadas onde estão fechadas. Uma porta que você deixa aberta continua aberta para quem olha da rua.
- De fora, perto dos prédios, aparecem as folhas das portas, as placas EXIT, as portas do elevador com o mostrador e a mobília; mais longe, só as salas e a luz delas.
- As paredes de dentro têm espessura: os vãos das portas mostram o batente.

## 0.13.10a — Prédios na medida (2026-10-04)
- A cidade foi medida de novo em módulos de 2 m: ruas, quarteirões, terrenos e recuos das torres. Cada prédio tem largura e fundo inteiros, e as janelas ficaram um pouco mais largas. A mesma semente gera agora uma cidade diferente.
- As paredes de dentro e de fora têm espessura: você para encostado nelas, não no meio. Os móveis não entram mais nas paredes.

## 0.13.11 — Gente de verdade na calçada (2026-10-04)
- Os pedestres andam com joelhos e cotovelos: a perna dobra ao vir para a frente e os braços balançam.
- Perto de você, as pessoas desviam umas das outras (e de você) em vez de se atravessarem, e diminuem o passo atrás de quem anda devagar.
- A aparência de cada pessoa agora faz parte de quem ela é: famílias parecidas, cabelos grisalhos com a idade, barba, cabelo comprido.

## 0.13.13 — Opções mais simples e pessoas mais atentas (2026-10-04)
- O menu de opções agora tem Style (High Definition, o padrão, ou Classic, com menos linhas e o visual mais marcado) e Sharpness (Soft ou Sharp). As opções voltaram ao padrão uma vez.
- Com a mochila, o caixa ou a lista de direções abertos, o personagem não anda nem gira mais por trás da tela.
- Quem você para para pedir informação fica parado de frente enquanto você escolhe; quem está atravessando a rua segue andando.
- Os pedestres não trocam mais de roupa ao apontar o caminho, e o guarda-chuva agora fica na mão.

## 0.13.9b — Pedir informação (2026-10-04)
- Chegue perto de alguém na calçada e aperte F para pedir o caminho até um café, bar, farmácia, banco, mercearia, motel... ou um marco da cidade. A pessoa para, aponta e explica em quarteirões e nomes de rua.
- Nem todo mundo sabe, alguns erram o lado, e tarde da noite tem gente que nem para.

## 0.13.9a — Bateria do celular (2026-10-04)
- O celular agora tem bateria: gasta mais na mão, no mapa com GPS e em ligações. Avisa em 15% e 5% e desliga quando acaba.
- Para carregar, leve um carregador (lojas de eletrônicos e de celular) e fique num café, cybercafé, lanchonete, bar, lavanderia ou motel.

## 0.13.8 — Gente quadrada (2026-10-04)
- As pessoas da cidade agora têm o formato do Minecraft: cabeça, tronco, braços e pernas em blocos, cada uma com sua "skin" (cabelo, olhos, camisa ou jaqueta, mangas, calça e sapatos).

## 0.13.7 — Placas de rua (2026-10-04)
- As placas pintadas e os letreiros laterais não parecem mais de vidro, e a placa de direção saiu do meio da rua.
- Toda esquina tem as placas verdes com o nome das duas ruas, no poste do semáforo ou num poste próprio.
- Nos cruzamentos das vias largas, placas marrons apontam para o marco mais perto, com a distância.
- O portão das subestações mostra a placa da companhia elétrica com o número da subestação.

## 0.13.6 — Upgrades de verdade (2026-10-04)
- O chip, a antena e a bateria comprados vão para a mochila. Arraste a antena ou a bateria até o notebook para instalar: a antena USB aparece encaixada na lateral, com a luz piscando, e a bateria estendida atrás.
- Arraste o chip até o celular: a tampa sai, a bateria sai, o chip velho sai e o novo entra. O número muda e a operadora do chip novo pode ser outra (há três na cidade).

## 0.13.5 — Fome (2026-10-04)
- Você sente fome com o passar das horas. Com fome, a corrida dura menos (de 30 s bem alimentado a uns 4 s faminto); andando, o fôlego volta. Ninguém morre de fome.
- Nos diners, cafés e bares, o balcão tem EAT HERE / TO GO (Tab). Na mochila, E come o que está sob o cursor.
- O estômago ronca quando a fome aperta, e a mochila mostra como você está.

## 0.13.4 — Comprar de verdade e a mochila (2026-10-04)
- Nas lojas, mire num produto da prateleira e aperte F: ele vai para a mochila, ainda sem pagar (com uma etiqueta $).
- No caixa, F abre o balcão: pague tudo o que pegou em dinheiro ou no cartão (←/→ escolhe), ou deixe no balcão. Nos diners, cafés e bares, peça no balcão para viagem.
- Saindo da loja sem pagar, o que estava na mochila é furto (por enquanto ninguém vai atrás).
- B abre a mochila: as coisas caem e se empilham de verdade, e só entra o que cabe. Arraste com o mouse, R gira, o botão direito devolve à prateleira ou joga fora. Ao lado ficam o celular, o notebook e o chip.
- No caixa do seu banco dá para sacar dinheiro.

## 0.13.2d — Elevadores de verdade (2026-10-04)
- Cada prédio tem a sua cabine, parada num andar qualquer. No corredor, F chama o elevador: ele vem de verdade, toca a campainha e abre.
- Com a cabine em outro andar, as portas de aço ficam fechadas, o mostrador em cima mostra onde ela está e o botão de chamar acende.

## 0.13.2c — Portas com a mão (2026-10-04)
- As portas abrem e fecham com F, e fecham sozinhas quando você se afasta. Fechadas, não dá para atravessar.
- As portas da rua têm duas folhas de vidro que giram para dentro, e pelo vão aberto se vê a loja.
- Algumas portas estão trancadas: a maioria dos apartamentos, os escritórios fora do horário, as lojas fechadas.

## 0.13.2b — Lojas menos vazias (2026-10-04)
- O elevador das torres com recuo agora chega ao último andar.
- As geladeiras guardam só bebidas e frios.
- As lojas fundas têm uma sala de estoque nos fundos, e as lojas grandes ganham mais vitrines, prateleiras ou mesas em vez de chão vazio.

## 0.13.3 — Quem trabalha nas lojas (2026-10-04)
- Os balconistas são moradores da cidade com turno e folga: o caixa só atende quando alguém do turno está lá ("NOBODY AT THE TILL" quando não está).
- Cada turno de loja tem pelo menos duas pessoas, que tiram as folgas em dias diferentes, então a loja quase nunca fica sem ninguém.
- Fora do horário, a porta da loja fica trancada por fora; quem está dentro sempre consegue sair.

## 0.13.2 — Lojas por dentro (2026-10-04)
- Cada tipo de lugar tem o interior que combina com ele: diners com balcão e banquetas vermelhas, bares com a prateleira de garrafas, cafés e pizzarias com vitrine e forno, cybercafés com fileiras de computadores, lavanderias com lavadoras e secadoras, mercearias com geladeiras e corredores, lojas de eletrônicos e de penhor com vitrines.
- As prateleiras mostram o que a loja vende, cada produto com sua cor. Pegar e comprar vem na próxima parte.
- Dá para apoiar o notebook no balcão de um bar ou numa vitrine, e sentar numa banqueta.

## 0.13.1 — Lugares de verdade, primeira parte (2026-10-04)
- A cidade ganhou pizzarias, delis, lanchonetes de fast food, lojas de celular, cybercafés (poucos: procure no Maps) e motéis, cada um com nome, letreiro, horário e saudação ao telefone.
- Cada tipo de lugar agora sabe o que vende e quanto custa (preços de 2008). Por enquanto isso ainda não aparece no jogo: é a base para comprar pegando na prateleira, nas próximas atualizações.
- O chip pré-pago também é vendido nas lojas de celular.

## 0.F.9 — Onde gastar o dinheiro (2026-10-04)
- Lojas de eletrônicos e de penhor abertas têm um balcão: aperte F perto do caixa para ver o que vendem e comprar no cartão do banco (setas escolhem, Enter compra, F sai). Fechadas, o aviso diz a hora em que abrem.
- À venda: um chip pré-pago (número novo, com crédito e pacote de dados novos; a linha antiga fica para trás), uma antena Wi-Fi direcional para o notebook e uma segunda bateria do notebook (quase o dobro das horas).
- O balcão é provisório: quando existir conversa com os NPCs, a compra vai ser falando com o vendedor.
- O chip pré-pago agora serve de verdade: ao trocar de número, a pista que a polícia seguia pela sua linha de celular esfria (câmeras, testemunhas e outros rastros continuam valendo). Bom para quando o cerco aperta no "caso federal".
- A antena direcional aumenta o alcance do Wi-Fi do notebook: dá para pegar uma rede de mais longe (por exemplo, fora da câmera de um cruzamento). Ela aparece como um adaptador USB quando você lista o hardware.

## 0.F.8 — Fechando a fatia vertical (2026-10-04)
- Ser preso não te deixa mais travado dentro da prefeitura: você acorda na calçada em frente.
- O Maps acha as subestações (busque "substation" ou "gridlink"): a "Substation 03" é a da rede GRIDLINK-03, com rota a pé até ela.
- Uma subestação desligada não fica mais apagada para sempre: as equipes da concessionária a religam sozinhas entre 2 e 4 horas de jogo depois.
- A luz azul do relógio agora aparece por cima da caixa de aço, tingindo-a, em vez de sumir nela.
- A bússola do relógio lê a direção a cada meio segundo, como um sensor de verdade, em vez de seguir cada movimento da cabeça.
- As dicas do título e do menu de pausa trocam sozinhas a cada 15–20 segundos.

## 0.F.7 — Retoques do relógio e das teclas (2026-10-04)
- O relógio virou um modelo com bússola e termômetro: a última linha do visor mostra para onde você está olhando (N, NE, E… e os graus) e a temperatura (a do ar na rua, a do ambiente dentro dos prédios; o termômetro demora alguns segundos para acompanhar).
- O visor ficou mais escuro que a caixa e, no apagão, quase não se lê sem a luz. Na luz forte aparecem levemente todos os segmentos apagados, inclusive as marcas e os campos pequenos.
- A luz azul do relógio agora brilha em volta como a tela do celular.
- O relógio agora tem caixa de aço escovado que pega a luz da cena, com o reflexo da luz mais forte por perto deslizando nela e a sombra da moldura sobre o visor, como o celular.
- O visor some de verdade no escuro: para ler a hora à noite, use a luz (L). A luz agora é azul e deixa um leve brilho em volta.
- Teclas do relógio novas: I abaixa e ergue, J é MODE, K é START/STOP, L é LIGHT.
- Sinal de hora: no modo alarme, o START (K) alterna alarme, sinal de hora, os dois e nenhum (marcas `(*)` e `SIG` no visor). Com o sinal ligado (o padrão) o relógio bipa e sobe sozinho a cada hora; desligado, não faz nenhum dos dois.
- A correia aparece uma linha acima do relógio e uma linha abaixo, na borda da tela.
- Com o notebook aberto, Insert ergue e abaixa o celular, que se usa pelo mouse enquanto o teclado continua no notebook.
- As teclas de gráfico e de som (B, U, V, G, R, M) saíram: tudo isso fica no menu de opções. F3 continua ligando as linhas de debug. O apagão de debug saiu do K e foi para F6 (Shift+F6: a cidade toda).

## 0.F.6c — Salvar o jogo e o menu (2026-10-03)
- O jogo agora salva: a hora, onde você está, o dinheiro e a conta, o crédito do celular, os contatos, as mensagens, as fotos e as notas do celular, o disco e a BIOS do notebook, o relógio, as subestações e semáforos que você mexeu, as notícias e posts, e os trabalhos e o calor em que você estava.
- Na tela de título: CONTINUE volta ao jogo salvo (com a data em que foi salvo), NEW GAME começa uma cidade nova (pergunta antes, porque vai substituir o save), WATCH CCTV e OPTIONS.
- Esc no jogo pausa: continuar, salvar, opções, debug (os dados que ficavam nas linhas de status) e salvar e sair para o título. O mundo para enquanto o menu está aberto.
- As opções (som, fundo, glifos, nitidez, fusão, resolução, linhas de debug) ficam lembradas entre uma vez e outra; as linhas de debug começam desligadas (F3 ou o menu as liga).
- O jogo salva sozinho a cada 3 minutos, ao minimizar a janela e ao sair para o título. Por enquanto há um só save.
- O relógio de pulso ficou mais baixo na tela, com a correia de cima mais curta, e o "WATER RESIST" voltou.

## 0.F.6a — O relógio fica no pulso, o banco no celular (2026-10-03)
- O relógio de pulso agora fica sempre à vista, no canto de baixo à esquerda. H o abaixa para fora do caminho (e ergue de novo); abaixado, ele sobe sozinho na hora cheia, quando bipa, e quando o alarme toca.
- Três modos, como os de verdade, trocados pelo botão MODE (J): a hora, o alarme e o cronômetro. O botão da direita (I) liga e desliga o alarme e dispara e para o cronômetro.
- Acertar o alarme: no modo AL, segure I até aparecer SET; I avança a hora que pisca, J passa para os minutos e J de novo termina. O alarme toca 20 segundos; qualquer botão do relógio o cala.
- Cronômetro: I começa e para; parado, segure I para zerar. Ele continua contando mesmo em outro modo.
- O app de relógio saiu do celular (o alarme e o cronômetro foram para o pulso); no lugar dele, no menu, entrou o app do banco.

## 0.F.5 — O terceiro trabalho: seguir uma linha (2026-10-03)
- Pago o segundo trabalho, o mesmo número volta com o terceiro, o que paga melhor: descobrir em que distrito da cidade um certo celular estava a uma hora do dia. O SMS dá o número da linha e a hora.
- A pista não está na rua: é no registro da operadora. Procure o Wi-Fi de manutenção dela (o OMC) na torre mais alta do centro, entre na rede, `tnet` o host `omc-r` e rode `log <número>` — sai o registro de antena da linha hora a hora, com o distrito de cada uma.
- Leia o distrito da hora pedida e mande por SMS para o contratante. Acertou, o pagamento entra na conta; errou, ele manda olhar de novo; passou o prazo sem resposta certa, não há pagamento.
- O comando `job` no notebook descreve o contrato, o número e onde fica o OMC.

## 0.F.4b — O segundo trabalho: travar um cruzamento (2026-10-03)
- Pago o primeiro trabalho, o mesmo número volta com outro, maior: travar os semáforos de um cruzamento da cidade dentro de uma janela de 1 a 2 horas. O SMS diz qual cruzamento (pelo nome de um lugar ao lado) e até que horas.
- Aceite com YES, vá até o cruzamento, ache a GRIDLINK daquele trecho, entre no armário de semáforos e ponha os sinais em flash ou apagados antes do prazo. Feito isso, o pagamento entra na conta; se o prazo passar com os sinais normais, não há pagamento.
- Mexer no armário de semáforos deixa rastro como cortar um disjuntor: a câmera de trânsito do cruzamento e o Wi-Fi de manutenção registram você, e o calor sobe.
- O comando `job` no notebook já mostra os dois tipos de trabalho.

## 0.F.4 — Um relógio de pulso (2026-10-03)
- H ergue o relógio digital do pulso esquerdo (e abaixa de novo), sem parar de andar: a hora da cidade, o dia da semana e a data. O visor depende da luz em volta e some no escuro; L acende a luz dele por alguns segundos.
- Na hora cheia ele dá dois bipes baixinhos.

## 0.F.3 — Um guia dentro do notebook (2026-10-03)
- O notebook agora traz um guia: abra-o e leia `cat ~/start-here.txt` — os comandos para olhar em volta e o passo a passo do primeiro trabalho (achar a GRIDLINK de uma subestação, entrar, achar o disjuntor e cortar a luz).
- Um comando novo, `job`, mostra o trabalho que você aceitou: onde é, até que horas e quanto paga; depois, se foi feito ou se falhou.
- A tela de boas-vindas do sistema aponta os dois logo no login.

## 0.F.2 — A cidade começa a reagir (2026-10-03)
- Mexer com a cidade agora deixa rastro. Quem está por perto vê, as câmeras e as antenas registram, e quanto mais você faz, mais quente fica a sua situação — de nada, a um caso local, a um da cidade inteira, até um caso "federal".
- Quando você fica procurado, uma viatura começa a vir atrás de você, mirando onde foi visto por último; nos níveis mais altos ela chega mais perto do seu rastro. Fique dentro de um prédio e ela não te pega.
- Se a polícia te alcança na rua, você é preso: acorda na prefeitura mais próxima, perde a noite, paga uma multa e devolve o que ganhou na noite. Sem fim de jogo — a poeira abaixa e você continua.
- As notícias e o Streetwire passam a falar do caso: uma caçada ("estão atrás do 'Ghost of the Grid'") e, quando alguém é preso, o alívio da cidade.

## 0.F.1c — Maps com busca e rota a pé (2026-10-03)
- No Maps, o OK (ou Search) abre uma busca: digite pelo teclado do celular (Abc, T9 ou 123, com o #) o nome de um lugar ou o tipo dele ("bar", "pub", "pharmacy", "bank"...). A busca vai pelo EDGE ou pelo Wi-Fi, gasta um pouco do pacote de dados e demora conforme o sinal.
- Os lugares voltam do mais perto ao mais longe, cada um com o tipo, se está aberto e a distância. Escolher um mostra o lugar no mapa com uma ficha: nome, tipo e distrito, aberto ou fechado (até que horas ou quando abre), telefone (a tecla verde liga), endereço e distância.
- O botão do meio na ficha calcula a rota a pé (também pelos dados, com uma espera). O mapa mostra a rota em azul e embaixo a próxima curva ("In 80m turn left onto 9th St"), quanto falta e o destino; ao chegar, o celular avisa. Se você sair da rota, ele recalcula. "End" encerra a rota.
- O erro do GPS muda devagar (a cada ~6 s, suave) em vez de saltar todo segundo; na rua, uma posição que cairia dentro de um prédio vai para a calçada mais perto, e durante uma rota a posição fica presa nela, como num navegador.

## 0.F.1b — O primeiro trabalho (2026-10-03)
- Um número desconhecido manda um SMS oferecendo trabalho: deixar um lugar da cidade sem luz nesta noite, por um pagamento. Responda YES para aceitar, NO para recusar.
- Aceito o trabalho, o contratante confirma; corte a energia do alvo antes do prazo e, quando a luz cai, o pagamento entra na sua conta do banco.
- Se o prazo passar com as luzes acesas, não há pagamento, e o contratante não gosta.

## 0.F.1 — Uma conta no banco (2026-10-03)
- A cidade tem de dois a cinco bancos, cada um uma rede de agências com fachada na rua; as agências da mesma rede têm o mesmo nome no letreiro.
- Você tem uma conta no banco da agência mais perto de onde começa, aberta umas semanas antes, com o extrato desses dias: compras nas lojas da cidade, saques nos caixas e a tarifa do mês.
- O app do banco vem no celular (em My Apps): saldo, extrato, recarga do crédito do celular com o dinheiro da conta (a operadora avisa por SMS), e a agência, com endereço, horário e telefone (a tecla verde liga para ela). Ele precisa de sinal ou Wi-Fi e gasta um pouco do pacote de dados.
- No apagão, o olho só escurece à força de noite, e fica no escuro máximo por um segundo antes de se recuperar.
- O letreiro de notícias apagado não mostra mais as letras escuras.

## 0.L.13 — Um apagão que escurece de verdade (2026-10-03)
- Depois do surto, quando a escuridão chega até você, a visão fica muito escura em um segundo, e logo os olhos começam a se acostumar ao escuro.
- No surto, as luzes chegam ao dobro do brilho (antes, 1,5×).

## 0.L.12 — O apagão em três tempos (2026-10-03)
- O apagão não é mais imediato: por quase dois segundos todas as luzes do bairro ficam cada vez mais fortes, alguns telões já dão tela azul, e só então a escuridão corre pelas ruas.
- Quando a luz some à sua volta, os olhos demoram uns três segundos para se acostumar: fica tudo muito escuro no começo.
- A luz volta a partir de onde você está, prédio a prédio para longe, e por um instante tudo parece claro demais até os olhos se acostumarem.
- A luz que um telão joga na rua fica azul enquanto ele mostra a tela de erro.
- Os telões não são mais cortados pelas baias salientes das fachadas de tijolo (os prédios com telão ficam sem elas por enquanto).

## 0.L.11 — Apagão de verdade nas telas e luz nas praças (2026-10-03)
- No apagão, os telões mostram a tela azul de erro meio segundo antes de apagar e por alguns segundos depois que a luz volta, como se reiniciassem.
- O letreiro de notícias e os letreiros das lojas não parecem mais "invertidos" no apagão: apagados, viram placas escuras.
- Sumiu o brilho vermelho em volta das janelas no apagão (as luzes de emergência dos corredores não iluminam mais a parede de fora).
- As praças e os parques têm postes: a praça do Theater District ganhou uma grade deles, e os caminhos dos parques e praças, postes dos dois lados.
- De dia, os telões e as placas iluminam mais a rua; à noite, os cones dos postes aparecem também fora da chuva (mais fortes nela); as nuvens da noite ficam mais amareladas e escurecem no apagão.

## 0.L.10 — A praça do Theater District e as sombras da noite (2026-10-03)
- A avenida diagonal saiu por enquanto (o X dava problema no trânsito e nos prédios). No lugar, o Theater District ganhou uma praça grande dos dois lados da avenida, com piso xadrez, degraus vermelhos, mesas e bancos, cercada de telões e letreiros virados para ela.
- À noite, os postes fazem sombra: as pessoas, os carros, os bancos e os próprios postes deixam sombra na calçada.
- Na rua molhada aparecem os postes, os carros, as pessoas e as cabeças acesas dos postes refletidos.
- Com lua, os prédios fazem sombra no luar (aparece mais num apagão).
- Na chuva e na neve, dá para ver o cone de luz debaixo de cada poste.
- As cunhas retas de sombra que se amontoavam no chão de dia sumiram; as janelas não mostram mais uma bolinha de luz no meio de cada sala; os telões ficam mais fortes de dia; a sombra das árvores não pisca mais.

## 0.L.9 — Letreiros que parecem acesos e telas que seguem o olho (2026-10-03)
- Os letreiros, as placas verticais (e as lâmpadas das bordas delas), os neons nos cantos dos prédios, o letreiro de notícias e os telões brilham muito mais aos olhos e iluminam um pouco mais em volta. Continuam parecendo acesos mesmo numa rua clara, quando o olho se fecha.
- A tela do celular e a do notebook seguem a adaptação do olho: de dia ficam mais apagadas e sem brilho em volta; à noite brilham, mais ainda no escuro. Uma página branca não estoura mais: quanto mais clara a tela, menos ela espalha luz.

## 0.L.8 — Letreiros e telões que iluminam a rua (2026-10-03)
- Os letreiros, telões, placas verticais, neons dos cantos, molduras de lâmpadas e o letreiro de notícias iluminam a rua, as calçadas e as fachadas em volta com a cor que estão mostrando, a partir da altura em que estão e com alcance bem maior. Um telão grande tinge a rua inteira à frente dele.
- A moldura de lâmpadas de um letreiro ilumina a calçada mesmo quando as letras estão apagadas.
- A luz que volta dos prédios em volta pega a cor deles: no fim da tarde, a parede de tijolo ao sol esquenta a calçada e a parede da sombra do outro lado.

## 0.L.6 — Sombras, céu e luz do dia dentro dos prédios (2026-10-03)
- O fundo das ruas entre prédios altos e a base das paredes recebem menos luz do céu (como de verdade), e um pouco da luz volta das paredes em volta.
- Dentro dos prédios, de dia, a luz entra pelas janelas: perto delas fica claro, e vai escurecendo para o meio do prédio. Os escritórios ficam com as lâmpadas acesas no horário de trabalho.
- O anúncio do ponto de ônibus ilumina a calçada com a cor do que está mostrando.
- O farol de um carro não atravessa mais o carro da frente: acende a traseira dele, e o que está atrás fica na sombra.

## 0.L.3 — O olho se adapta (2026-10-03)
- Exposição automática: ao sair de um prédio para o meio-dia, a rua ofusca por um segundo; ao entrar num lugar escuro (ou num apagão), o olho vai se acostumando aos poucos. A linha de status mostra `EYE x…`.
- De dia, as salas iluminadas só pelas lâmpadas parecem mais escuras que a rua, e as janelas vistas de fora ficam escuras como de verdade.
- Um carro iluminado por vários faróis ao mesmo tempo não estoura mais para o branco.

## 0.L.2 — Cada luz com a sua temperatura (2026-10-03)
- Os postes seguem a temperatura de cor real do tipo de lâmpada: sódio laranja, sódio de baixa pressão amarelo, vapor metálico branco quente com um fundo verde, mercúrio verde-azulado e os primeiros LEDs brancos frios. As fachadas agora pegam o tom dos postes da rua delas.
- As janelas de escritório são mais de fluorescente (branco frio, esverdeado) e menos de cores inventadas; as casas continuam com a luz quente das lâmpadas incandescentes.

## 0.L.1 — Uma luz só para o dia e a noite (2026-10-03)
- Por baixo, a luz virou uma só conta física para o dia e a noite: cada superfície tem a sua cor, recebe a luz do céu, do sol, da lua, do brilho da cidade e das lâmpadas, e o olho a leva para a tela por uma exposição. O visual ficou quase igual; é a base para a exposição automática e a iluminação global.
- As poças de luz dos postes ficam um pouco mais alaranjadas sobre a calçada clara, e de dia as lâmpadas acesas iluminam um pouco (bem pouco) o que está perto.

## 0.L.0 — Medir a GPU (2026-10-03)
- A linha de status mostra `GPU x ms`, o tempo que a placa de vídeo leva de verdade para desenhar o mundo (o `DRAW` conta também a espera).

## 0.B.5 — Apagão por andares (2026-10-03)
- No apagão, as janelas de um prédio apagam e voltam juntas, por andar ou em grupos de algumas janelas, e bem mais rápido, em vez de uma a uma ao acaso.

## 0.F.1 — Hoje em 2008 (2026-10-03)
- Na primeira vez que o jogo abre no dia, a tela de carregamento mostra o que aconteceu no mundo nessa mesma data em 2008. Nas outras vezes, às vezes aparece uma curiosidade de 2008 no lugar da dica.

## 0.B.2 — Nuvens de verdade e raios de sol (2026-10-03)
- As nuvens ganharam volume: o lado virado para o sol acende (no pôr do sol fica laranja), a base fica cinza, e o contorno é limpo (sem o grão de antes). À noite, a base é iluminada pela cidade lá embaixo.
- Raios de sol: quando o sol baixo está atrás de uma árvore ou de um prédio, faixas de luz saem pelas frestas.
- A sombra de um poste ou de uma árvore não some mais quando você passa por ele (de dia, o que está até 60 m atrás continua fazendo sombra para a frente).

## 0.A.3 — Abrir mais rápido (2026-10-03)
- O jogo no Electron abre em ~2 s em vez de ~11 s a partir da segunda vez: os shaders compilados ficam guardados (eles só são compilados de novo quando o código deles muda).
- A população de uma cidade fica guardada: abrir de novo a mesma semente (`?seed=`) pula a parte de registrar os cidadãos. `?fresh` força gerar tudo de novo.
- O reflexo no asfalto molhado se estica na vertical, como as faixas de luz de verdade, em vez de tremer para todos os lados.

## 0.A.2 — Mais cor na cidade (2026-10-03)
- As fachadas residenciais, históricas e de escritório ganharam cores de verdade (terracota, creme, sálvia, azul, mostarda, arenito, brownstone, granito), no lugar dos tons quase cinzas.
- Os carros têm as cores de 2008: muitos prata, brancos e pretos, depois azul-escuro, vermelho, champanhe, verde e vinho.
- O céu do dia ficou mais azul no alto, ainda enevoado no horizonte.
- **F4** (debug) mostra a mesma vista ao meio-dia, no pôr do sol e à noite, lado a lado, para comparar as cores.

## 0.A.1 — Anúncios nos pontos de ônibus (2026-10-03)
- O cartaz dos pontos de ônibus virou uma tela de anúncio animada, dos dois lados, com as mesmas animações dos telões (e apaga num apagão). Antes era um quadrado branco que estourava de brilho.
- O Sarcófago não deixa mais a lua aparecer através dele, como se fosse de vidro.
- A dica da tela de carregamento fica perto da borda de baixo.

## 0.R.39 — Carregamento sem travar e F3 (2026-10-03)
- A cidade é gerada sem travar a janela: a tela de título mostra uma barra de progresso com o que está sendo feito (ruas, rede elétrica, cidadãos, shaders), e os botões aparecem quando tudo está pronto.
- A tela de carregamento mostra uma dica sobre o jogo embaixo da barra (e, em breve, o que aconteceu no mundo neste mesmo dia em 2008).
- **F3** esconde e mostra as linhas de debug (posição, FPS, relógio, subestação, endereço), para tirar capturas limpas.

## 0.R.38 — Tela inteira sem faixas pretas (2026-10-03)
- A cidade preenche a tela toda, sem as faixas pretas em cima e embaixo: a opção de linhas (R) passa a definir o tamanho dos caracteres, e o jogo acrescenta as linhas que faltam. O celular fica sempre encostado na borda de baixo.

## 0.R.37 — Electron (2026-10-03)
- O jogo pode rodar numa janela própria, em tela cheia, fora do navegador: `jogar-electron.bat` (F11 sai e volta da tela cheia, Alt+F4 fecha). A resolução fica sempre a mesma, sem as abas e a barra do navegador.

## 0.R.36b — Notebook: brilho de lado e BIOS inteira (2026-10-03)
- O brilho da tela do notebook continua quando você olha para o lado, seguindo a forma do vidro em perspectiva.
- A tela de configuração da BIOS ocupa a tela inteira, sem a faixa preta embaixo, e a tela do notebook tem a proporção de 16:10 em qualquer tamanho de janela.

## 0.R.36 — Telas que iluminam em volta (2026-10-03)
- O brilho das telas do celular e do notebook agora aparece de verdade: um halo na cor da tela espalha-se pela moldura, pelo teclado e pelo que está em volta, mais forte no escuro.
- As partes claras da tela (como o relógio grande do celular) brilham um pouco por cima dela, como uma tela acesa de verdade.

## 0.R.35 — Telas que brilham (2026-10-03)
- As telas do celular e do notebook entram no mesmo brilho (bloom) das luzes da cidade: uma tela clara à noite espalha luz sobre a moldura e o aparelho em volta.
- O vidro das telas reflete, fraco e desfocado, as luzes fortes da cena (letreiros, postes), só onde a tela está escura.

## 0.R.34 — Fachadas sem troca brusca (2026-10-03)
- A passagem do prédio visto de longe para o prédio com detalhes acontece numa faixa muito mais longa (de ~150 m a ~440 m), aos poucos, em vez de mudar de uma vez quando você se aproxima.
- As salas vistas pelas janelas são preparadas mais cedo (a 130 m), antes de começarem a aparecer, e há muito mais espaço para elas antes de tudo ser recarregado.

## 0.R.33 — Faróis assimétricos (2026-10-03)
- De perto, cada farol de carro tem o próprio facho, e o da direita vai mais longe, mais alto e um pouco para a calçada, como o farol baixo de verdade (ilumina as placas e quem está na beira da rua).

## 0.R.32 — Brilho das janelas mais discreto (2026-10-03)
- O brilho colorido que as janelas acesas guardam ao chegar perto de um prédio é mais fraco e some bem antes (a uns 35 m), sem parecer um efeito pintado por cima.

## 0.R.31 — Holofotes de verdade (2026-10-03)
- As fachadas iluminadas por baixo ganharam as luminárias: caixinhas de metal no chão, a pouco mais de um metro da parede, com a lente acesa na cor da luz.
- O feixe ilumina quem passa na frente e a calçada em volta da luminária, não só a parede.
- Quem passa entre o holofote e a parede projeta na fachada uma sombra grande, que sobe pela parede (só nos holofotes perto de você).

## 0.R.30 — Vidro sem cortes no reflexo (2026-10-03)
- Nas torres de vidro altas, o reflexo da cidade não acaba mais numa linha dura no meio da fachada (marrom embaixo, preto em cima): longe demais, ele se desfaz aos poucos no reflexo do céu.
- O mesmo vale para os cômodos vistos pelas janelas e para o detalhe da fachada no alto de uma torre: somem aos poucos com a distância, sem uma linha.

## 0.R.29 — Janelas que não perdem a cor (2026-10-03)
- Chegando perto de um prédio à noite, as janelas não trocam mais de repente de cores acesas para salas cinzas: a cor vista de longe some aos poucos no prédio inteiro, e as janelas acesas guardam um brilho dessa cor, que só se apaga bem de perto.
- A passagem do prédio distante para o prédio com detalhes ficou suave, sem o pontilhado de cores.

## 0.R.28 — Batida seca e carros mais nítidos (2026-10-03)
- A batida de carro soa como uma pancada seca e pesada, com o amassado da lataria e estalos de vidro, em vez de um sininho.
- O reflexo da cidade na pintura dos carros ficou mais nítido.

## 0.R.26 — Sombras dos objetos e sol com cor de verdade (2026-10-03)
- De dia, postes, árvores, carros, pessoas, bancos e abrigos fazem sombra no chão, nas paredes e uns nos outros; a copa das árvores deixa passar o sol em manchas.
- O sol tem a cor da hora: amarelado ao meio-dia, cada vez mais laranja perto do nascer e do pôr do sol, na luz e no disco do céu.
- Um objeto colorido ao sol fica com a cor mais forte, em vez de clarear para o branco.
- Os carros não são mais espelhos: a pintura reflete menos, mais desfocada, e só fica mais espelhada quando vista de lado.

## 0.R.25 — Fachadas sem cinza e carros brilhantes (2026-10-03)
- As fachadas iluminadas pelos postes e letreiros não ficam mais amareladas e acinzentadas (o efeito de "papel queimado"): a luz clareia a cor da própria parede.
- As vitrines mostram o interior da loja com a cor dele, em vez de um painel cinza; cada loja tem a parede pintada de uma cor.
- Os carros refletem a cidade na lataria, com o reflexo tingido pela cor da pintura, e brilham mais debaixo dos postes.
- O sol ilumina mais forte o que bate nele.
- Na chuva, cada pingo respinga no seu tempo, com um anel menor e mais transparente.

## 0.R.24 — Materiais e reflexos (2026-10-03)
- Com chuva, o asfalto molhado reflete a cidade de verdade: os letreiros de neon, as janelas acesas e as torres aparecem espelhados nas poças, tremendo com a chuva.
- As fachadas de vidro refletem os prédios da frente e o céu, mais forte quando vistas de lado, como vidro de verdade.
- De dia, o sol brilha na pintura dos carros, no vidro e no chão molhado.
- À noite, os carros e os objetos da rua não ficam mais com a cor estourada: a pintura escurece como as paredes, e o brilho dos postes aparece na lataria.
- O chão molhado escurece menos; agora é o reflexo que dá o tom.
- Tecla R: o modo de 180 linhas saiu (ficam 80, 120 e 200).

## 0.R.22b — Freadas e lanternas (2026-10-03)
- As lanternas traseiras ficam vermelhas e pintam de vermelho o carro de trás, em vez de branco.
- Na freada, ônibus e caminhões não enfiam mais o nariz no asfalto: o mergulho para a frente ficou bem mais contido (a inclinação nas curvas continua igual).
- As rachaduras em brasa da zona de fogo aparecem como traços de longe, e não mais como pontinhos.
- A névoa laranja da cidade à noite chega mais perto e cobre também os prédios da frente.
- Tecla R: as resoluções agora são 80, 120, 180 e 200 linhas (200 continua o padrão).

## 0.R.22 — A noite sem estouro (2026-10-03)
- À noite, paredes e calçadas sob luz forte não estouram mais para o cinza ou o branco: a luz forte clareia mantendo a cor, e o vidro escuro sob um poste continua escuro e azulado.

## 0.R.21d — Apagão suave e a cidade laranja de longe (2026-10-03)
- No apagão, a cidade escurece num ritmo constante até o anel chegar à borda, em vez de piscar enquanto escurece; na volta, clareia do mesmo jeito.
- As luzes não são mais escurecidas junto com a cidade: no apagão, o que continua aceso (faróis, prédios com gerador, letreiros voltando) brilha mais forte contra o escuro.
- De longe, a cidade à noite fica envolta numa névoa laranja das luzes da rua, e o brilho sobre ela no céu é bem mais forte.

## 0.R.21c — Luz na cor das coisas (2026-10-03)
- À noite, a luz dos postes e letreiros toma a cor da parede: o tijolo vermelho fica vermelho-alaranjado sob o sódio, em vez de cinza estourado, e as janelas acesas não deixam mais uma auréola cinza na fachada.
- Os postes de sódio estão mais laranjas e mais fortes.
- Sumiram as linhas retas de luz no chão e nas paredes entre um prédio e outro.

## 0.R.21 — Luzes que brilham (2026-10-03)
- À noite, o que é luz brilha de verdade: janelas acesas, neon, letreiros, postes e faróis ganham um halo que se espalha pelo ar em volta.
- De dia, os postes e os holofotes não pintam mais manchas de luz nas paredes, e os letreiros de neon apagados ficam escuros como de verdade.
- As portas acesas e as lâmpadas dos holofotes não estouram mais; os holofotes iluminam a parede na cor dela, e sumiram as faixas pretas verticais que apareciam em algumas paredes.
- No apagão, a escuridão geral chega no ritmo dos postes apagando em volta de você.
- De longe, nos limites da cidade, o céu sobre o centro tem um brilho laranja das luzes, que some num apagão.

## 0.R.20 — Cor de verdade de dia (2026-10-03)
- De dia, os prédios mostram a própria cor (o tijolo é vermelho, as torres de vidro azuis, verdes e roxas) em vez do cinza lavado; as torres distantes não ficam mais escuras, e as nuvens são brancas.
- Um prédio não muda mais de cor quando você se aproxima e as janelas aparecem.
- Os cômodos vistos pelas janelas ficam mais escuros que a fachada, como de verdade, e os móveis não ficam mais brancos (a planta verde é verde).

## 0.R.19 — Sombras e um dia de verdade (2026-10-03)
- Os prédios fazem sombra: de dia, as ruas entre as torres ficam na sombra e os topos e as fachadas viradas para o sol se acendem, e a sombra anda com o sol ao longo do dia.
- O dia foi refeito: as cores dos prédios aparecem (tijolo, vidro, pintura), o sol é quente e a sombra azulada, e a névoa só aparece ao longe. Acabou o cinza lavado.

## 0.R.18 — Móveis pelas janelas (2026-10-03)
- Olhando de fora, pelas janelas e vitrines, agora se veem os móveis dos cômodos (camas, sofás, mesas, balcões, prateleiras), iluminados pela lâmpada de cada cômodo.

## 0.R.17 — Só a GPU (2026-10-03)
- O mundo agora é sempre desenhado pela placa de vídeo, com a câmera 3D de verdade: dá para olhar quase reto para cima (até ~77°) sem distorção. A resolução padrão passou para 200 linhas.
- O jogo precisa de um navegador com WebGPU (Chrome, Edge ou outro Chromium).

## 0.R.16 — O fim do porte para a GPU (2026-10-03)
- No modo da GPU, o modo CCTV, a abertura, o visor da câmera do celular, as fotos que você tira e as fotos dos posts e das matérias do jornal também passam a ser desenhados pela placa de vídeo. Todo o jogo já roda no modo da GPU.

## 0.R.15 — Os interiores na GPU (2026-10-03)
- No modo da GPU, dá para entrar nos prédios: os cômodos com as paredes, as portas abrindo, as placas EXIT, a botoeira do elevador (os botões continuam clicáveis), os móveis iluminados pelas lâmpadas de cada cômodo, a porta de rua vista de dentro, e as janelas com a cidade lá fora, o reflexo no vidro e as gotas escorrendo quando chove (a chuva só cai do lado de fora). Com a câmera 3D, dá para olhar o teto do escritório e as torres em volta sem distorção.
- A luz da lanterna do celular e a luz nas mãos (que ilumina o celular e o notebook) agora também funcionam no modo da GPU.

## 0.R.14 — Fumaça, chuva e neve na GPU (2026-10-03)
- No modo da GPU, a fumaça da zona de fogo sobe no horizonte, a chuva e a neve caem (com a água escorrendo da borda dos pontos de ônibus e dos andaimes, e nada caindo debaixo deles), os respingos aparecem no chão molhado, o lixo volta às calçadas e às sarjetas, e as faixas do X da avenida diagonal ganham as linhas de parada.

## 0.R.13 — Objetos e carros na GPU (2026-10-03)
- No modo da GPU, as ruas ganham tudo o que é objeto: postes, árvores, bancos, orelhões, pontos de ônibus, entulho, placas perpendiculares com as letras em lâmpadas, outdoors nos telhados, semáforos com os sinais de pedestre, placas de PARE, câmeras de segurança, as subestações, os andaimes sobre a calçada, as escadas de incêndio de ferro, as pessoas e os carros (com as rodas girando, a carroceria balançando nas molas, os vidros e as setas piscando). Com a câmera 3D, dá para olhar um carro de cima sem distorção.

## 0.R.12 — Os cômodos pelas janelas na GPU (2026-10-03)
- No modo da GPU, as janelas dos prédios próximos mostram os cômodos de dentro (paredes, piso, teto e as lâmpadas acesas de cada um), e a luz dos cômodos acesos se espalha pela parede em volta da janela, como no desenho de sempre.

## 0.R.11 — Portas e escadas de incêndio na GPU (2026-10-02)
- No modo da GPU, as portas de rua dos prédios e das lojas aparecem nas fachadas, com o vidro aceso pela luz do saguão, e os prédios de tijolo mostram a escada de incêndio desenhada na parede.

## 0.R.10 — Andaimes e relevos na GPU (2026-10-02)
- No modo da GPU, os andaimes aparecem na frente das fachadas (tubos, tábuas e a rede colorida), e as fachadas ganham o relevo: as janelas salientes dos prédios de tijolo e dos residenciais, as pilastras dos prédios antigos e os pilares art déco dos escritórios.

## 0.R.9 — O Sarcófago na GPU (2026-10-02)
- No modo da GPU, o Sarcófago aparece no horizonte perto da borda, com os painéis faltando, o fogo pelas frestas e por baixo da borda, a torre de tiragem e os guindastes parados com a luz vermelha piscando.

## 0.R.8 — A cerca na GPU (2026-10-02)
- No modo da GPU, a cerca do cordão aparece na borda da cidade, com os postes, a tela e o arame farpado.
- No modo da GPU, os prédios distantes afundam com a curva do horizonte como no desenho de sempre (antes subiam um pouco).

## 0.R.7 — A zona de fogo na GPU (2026-10-02)
- No modo da GPU, o chão queimado além da cerca aparece com as fissuras em brasa pulsando, como no desenho de sempre.

## 0.R.6 — Letreiros na GPU (2026-10-02)
- No modo da GPU, os letreiros das lojas acendem com os nomes das empresas (com as lâmpadas de perto, os modos que piscam, correm ou falham, e as marquises dos cinemas e hotéis), os anúncios pintados aparecem no alto dos prédios, os telões passam as suas cenas e o letreiro de notícias corre em volta dos prédios.

## 0.R.5 — O céu na GPU (2026-10-02)
- No modo da GPU, o céu é o de verdade: estrelas, a lua com a fase, as nuvens andando com o vento e iluminadas por baixo pela cidade, o amanhecer e o entardecer coloridos e o brilho do sol. Com a câmera 3D, o céu acompanha o olhar para cima.

## 0.R.4 — Luzes, fachadas e câmera 3D na GPU (2026-10-02)
- No modo da GPU, os prédios ganham os estilos de verdade (tijolo, vidro, histórico, galpão, sacadas, cornijas, coroas, neon, holofotes), as janelas apagam uma a uma no apagão, e a luz dos postes e dos faróis cai na rua e nas paredes. O dia, o luar e os modos visuais (B, U, V, G) funcionam.
- A tecla J agora tem três passos: o desenho de sempre, o da GPU e o da GPU com uma câmera 3D de verdade (olhando para cima, as torres convergem em perspectiva).

## 0.R.3 — O mundo da GPU direto na tela (2026-10-02)
- No modo J, o mundo vai da placa de vídeo direto para a tela, no mesmo quadro: um quadro novo do mundo a cada atualização da tela, sem o atraso e sem os engasgos de esperar o desenho.

## 0.R.2 — Primeiro mundo desenhado na GPU (2026-10-02)
- Tecla J: um protótipo do mundo desenhado pela placa de vídeo (WebGPU), com ruas, prédios, janelas e céu, ainda sem luzes, carros, pessoas e letreiros. Serve para comparar com o desenho de hoje; aperte J de novo para voltar.

## 0.12.14 — Letras dentro da tela do notebook (2026-10-02)
- As letras do terminal não têm mais um fundo amarelado próprio: o fundo da tela é o mesmo atrás das letras e entre elas.
- O reflexo da luz, o véu do ambiente e as digitais caem igual sobre as letras e sobre o fundo da tela do notebook: as letras parecem estar dentro do vidro, e não coladas por cima dele.

## 0.12.13 — Pedestres na diagonal (2026-10-02)
- Agora há gente andando nos quarteirões cortados pela avenida diagonal: a calçada segue o meio-fio da diagonal e atravessa a avenida reto, com os carros parando para quem está passando.

## 0.12.12 — Manchetes clicáveis (2026-10-02)
- No jornal do celular, as setas escolhem a manchete e OK abre a matéria (a tecla esquerda atualiza): um texto curto com os lugares de verdade e um morador citado, sempre o mesmo para a mesma notícia.
- As notícias de coisas que aconteceram (apagão, energia de volta, batida, engarrafamento) têm foto maior, marcadas com [PHOTO]: tirada da câmera de segurança mais perto ("Security camera still") ou da rua; a do apagão é tirada do portão da subestação.

## 0.12.11 — Ajustes das câmeras, do notebook e outros (2026-10-02)
- Câmeras: cerca de um terço fica parada (aparece como FIXED); as outras giram mais devagar quanto menor o FPS do gravador. O FPS vai de 10 a 30.
- Elevadores bem mais rápidos (até 6 m/s).
- Texto feito de pontos de luz vira letra ASCII quando a letra teria menos de 3 linhas de altura (letreiros, placas, outdoors, números do elevador).
- Notebook: a tela fica no mesmo lugar e do mesmo tamanho na BIOS e no sistema; sem a linha transparente e sem cortar o texto de cima. O botão de ligar agora também desliga (no prompt, desliga o sistema direito; fora dele, corta a energia).

## 0.12.10 — Pedestres no celular e sons da cidade (2026-10-02)
- Pedestres usam o celular: falando com ele no ouvido, digitando com a tela acesa (que ilumina o rosto, de noite), e tocando. Quem digita anda mais devagar.
- Dá para ouvir o toque do celular de quem passa (cinco toques diferentes) e o clique das teclas de quem digita do seu lado.
- Carros passando ao longe nas outras ruas (menos de noite) e sirenes: uma a caminho de cada batida, um minuto depois, e de vez em quando uma em algum lugar da cidade.
- 100 mil pessoas na cidade e até 2000 carros no pico.

## 0.12.9 — Câmeras com modelo (2026-10-02)
- Cada câmera é de um modelo de um dos três fabricantes de segurança da cidade: caixa, domo ou bullet, preto e branco ou colorida, com resolução, FPS e um jeito próprio de mostrar cor e brilho; cada unidade ainda tem o seu desgaste.
- No modo CCTV a imagem tem mais resolução (pelo modelo) e fica no FPS do gravador; o painel do gravador está maior e mostra o fabricante e o modelo.

## 0.12.8 — Câmeras de segurança e modo CCTV (2026-10-02)
- A cidade tem câmeras de segurança: de trânsito, em postes próprios nas esquinas (braço sobre o cruzamento, girando devagar), e nas fachadas de bancos, casas de penhor, farmácias e outras lojas, sobre o letreiro. Cada uma tem a luz vermelha de gravação piscando.
- Nova opção na tela de título: **WATCH CCTV**. A cidade continua andando, vista só pelas câmeras, trocando de câmera a cada 14 s (as de poste bem mais vezes que as de loja). Esc volta ao menu.
- A imagem é a de uma câmera barata de 2008 num gravador: resolução baixa, quadro 4:3 com tarjas pretas, monocromática esverdeada, linhas de varredura, granulado no escuro, faixa de interferência e linhas rasgadas; por cima, o nome da câmera e o lugar, a data e a hora com segundos, REC piscando, canal e "CIF 352x288 7.5 FPS".
- Debug no jogo: **C** olha pela câmera mais próxima (C ou Esc sai).

## 0.12.7 — Notebook e subestações (2026-10-02)
- Só o notebook 3D (as aparências clássica e HD 2D saíram, e a tecla L também).
- O `nano` abre em tela cheia no console de 160×50, sem a linha de comando aparecendo embaixo.
- A tela do notebook reage à luz como a do celular, mais forte: fica mais clara e espalha brilho na moldura no escuro, mais apagada sob luz forte, e reflete a luz mais forte por perto numa faixa do lado de onde ela vem, na cor dela.
- As subestações agora são lugares de verdade: um pátio cercado num lote vazio, com transformadores, isoladores, pórtico, guarita com luz verde (vermelha quando desligada), placa DANGER no portão e um holofote que ilumina o pátio à noite. A cerca é sólida.
- Debug: a linha de baixo mostra a subestação mais próxima (distância, direção, ligada ou não).

## 0.12.6 — Sistema de arquivos do celular (2026-10-02)
- O celular tem arquivos de verdade: firmware (o carregador da placa, o baseband), sistema (o OS da marca, apps, toques, fontes) e dados.
- Contatos (vCard), registro de chamadas, mensagens recebidas e enviadas e notas são arquivos de texto; mudar o arquivo muda o que o celular mostra, e usar o celular muda o arquivo. Cada foto é um arquivo em `media/DCIM`; apagar o arquivo apaga a foto.
- Configurações → USB cable: com o cabo ligado e o notebook aberto, o celular aparece em `/mnt/phone` no notebook, onde dá para listar, ler, copiar e editar os arquivos.

## 0.12.5 — Celular: retorno da 12.4 (2026-10-02)
- A abertura está desligada por enquanto.
- O item escolhido nas listas (mensagens, ligações, contatos, Streetwire, calendário, lugares, loja) fica num destaque escuro com texto claro.
- Apps reordenados: Ligações, Contatos, Mensagens, Câmera e Mapas primeiro.
- A dica de limpar notificações foi para a barra de baixo, entre Menu e Hide.
- Menos ligações e SMS por engano (cerca de um terço do que era).
- Dois boots: o primeiro é da placa-mãe (três placas, cada uma com sua tela, compartilhadas entre marcas), só lista o que o aparelho tem e o Wi-Fi dá OK; o segundo é da marca, com estilo próprio por fabricante.
- Cada marca tem os seus corpos de celular; trocar de corpo troca de aparelho e de marca.
- Pedestres atravessam o jogador e andam em ritmos diferentes: uns com pressa, outros devagar (mais idosos, mais à noite).
- Seis fabricantes de celular, um para cada corpo, cada um com a animação de boot no estilo do corpo (os nomes vêm da cidade).
- Ícones dos apps e do clima em HD.
- Tela do notebook grande e perto: o terminal ocupa a maior parte da vista e o teclado fica embaixo (aparece olhando para baixo). O sistema usa um console de 160×50, como uma tela de 1280×800 com a fonte do console; a BIOS, a SETUP e o editor usam o modo texto de 80×25, com letras maiores, como num PC de verdade.
- Notebook 3D é o padrão: teclado mais curto (teclas mais largas que fundas), moldura menor, botão de ligar visível e clicável, a luz da tela no teclado. Segurando o botão direito para olhar em volta, a tela passa a ser desenhada na tampa, em perspectiva; soltando, a vista volta ao notebook com a tela centralizada e legível.
- Notebook em três aparências para comparar (tecla **L**, com ele fechado): a clássica em caracteres, a 2D em HD (corpo em pixels com acabamento metálico, fosco ou brilhante pela marca, teclas com relevo, alto-falantes, touchpad e botão de ligar) e a 3D (o corpo como objeto na mesa, com a luz da cena e a perspectiva; ele fica no lugar quando você olha em volta).
- Botão de ligar do notebook clicável (nas versões HD e 3D); a dica "Enter = ligar" foi para a linha de dicas.
- Tela do notebook com a luz da cena por cima, marcas de dedo que pegam a luz e, desligada, o reflexo da luz no vidro.
- Fotos guardadas em HD: na galeria e no Streetwire, a foto aparece com três vezes mais detalhe em cada direção (o visor da câmera continua como antes).
- Um dia de jogo agora dura 2 horas reais (eram 48 minutos). Quem você não está olhando alcança onde a rotina dele diz que devia estar; quem você segue anda normal.

## 0.12.4 — Celular: fila de feedback (2026-10-02)
- Discador com o registro de chamadas: feitas, sem resposta, recebidas e perdidas, com a hora; as setas escolhem e a tecla verde liga de volta.
- O número digitado some ao sair do discador; abaixar e levantar o celular mantém a tela e o estado.
- **P** volta a tirar e abaixar o celular; o botão do meio também abaixa, e na tela inicial abre o discador.
- Papel de parede segue a hora (céu de dia, entardecer, noite com lua); a lua e o sol saíram de trás do relógio.
- Tecla 1 com símbolos: `@ _ : / & ( ) " # $ %` além da pontuação.
- Limpar notificações: no app de mensagens ou com a seta para baixo na tela inicial.
- A maioria dos SMS não pedidos agora é propaganda das lojas da cidade.
- Ligar ou mandar SMS demais para a mesma pessoa a irrita: ela reclama e depois para de atender.
- Boot do celular redesenhado, ainda verboso; splash com brilho no logotipo.
- Cantos arredondados sem serrilhado nos ícones, botões e no corpo do celular.
- Com o notebook aberto, o celular continua clicável (dá para atender uma ligação).

## 0.12.3 (2026-10-02)
- Alarme em tela cheia com três toques próprios; câmera só em blocos e fotos que não apagam as luzes pequenas; segunda tecla abre o discador.

## 0.12.2 (2026-10-02)
- Câmera com flash opcional, zoom óptico e digital e mais resolução; o celular sobe nos apps que usam as teclas de baixo; notificações espiam do bolso; alarme no relógio; símbolos do clima.

## 0.12.1 — Celular redesenhado (2026-10-02)
- Tela inicial com papel de parede, menu 4×4, discador, mensagens e mapa novos; seis modelos de corpo e capinhas; apps de fábrica e a pasta "My Apps"; população de 60 mil.

## 0.11 — Cidadãos e rotinas (2026-10-02)
- 0.11.1: cidadãos com casa, emprego, família, amigos e telefone; ligar para alguém cai em quem está em casa ou na secretária.
- 0.11.2: o dia de cada um (trabalho, almoço, recados, saídas); os pedestres são os cidadãos, saindo e entrando pelas portas; ligações e SMS por engano.
- 0.11.3: 40 mil cidadãos.
- 0.11.4: a rede social Streetwire, com posts de rotina e de testemunhas dos eventos.
- 0.11.5: textos gerados com a voz de cada pessoa, manchetes de 2008, perfis, comentários e fotos no Streetwire, app de calendário, visual próprio dos apps.

## 0.10 — O notebook (2026-10-01/02)
- 0.10.1–0.10.4: o notebook como objeto (tecla N, só sentado ou apoiado), computador virtual com shell tipo Unix, BIOS na tela, HD e ventilador com som, temperatura e painel de status.
- 0.10.5: Wi-Fi no notebook (varrer redes, conectar, pegar endereço, ping).
- 0.10.6: (entrada da Trilha de hacking)
- 0.10.7: BIOS SETUP e menu de boot, bateria com tomada, editor de texto.
- 0.10.8: o mundo é desenhado em vários núcleos; 120 linhas como padrão.
- 0.10.9: a interface não encolhe com a resolução do mundo.
- 0.10.10: carros dirigidos de verdade perto do jogador, com seta, sinal de luz e dois faróis.
- 0.10.11: (entrada da Trilha de hacking)

## 0.9b — Luz do sol (2026-10-01)
- Faces ao sol e na sombra, Sarcófago mais perto, superfícies distantes em blocos, tecla R de resolução.

## 0.9 — Telefones e celular (2026-10-01)
- Antenas e sinal de verdade, dados móveis com franquia, ligações e SMS, operadora com `*100#`, orelhões, câmera, loja de apps, modelos e marcas de celular, abertura do jogo, agradecimentos escondidos.
- Correções e otimização: portas entre cômodos, placas EXIT, energia de reserva, Wi-Fi nas lojas e casas, T9, modos visuais (tecla V).

## 0.8 — Navegação (2026-10-01)
- O celular na mão com mapa em quatro zooms e de interior, lista de lugares, GPS com os limites de 2008, calculadora, relógio, notas e os outros apps.

## 0.7 — Trânsito (2026-10-01)
- Faixas, semáforos e o X da diagonal; ônibus, táxis, viaturas, caminhões, ciclistas e pedestres; física dos carros e batidas; sons do trânsito; 1500 carros.

## 0.6 — Interiores (2026-09-30/10-01)
- Entrar nos prédios sem carregamento, plantas e móveis, elevadores (alguns de vidro), escadas de incêndio, lojas abertas, interiores vistos de fora.
- Fachadas mais ricas: coroas acesas, anúncios pintados, outdoors, neon, andaimes, relevo e o theater district com telões e letreiro de notícias.

## 0.5 — Clima e céu; 0.5b — Blackout (2026-09-30)
- Avenida diagonal, placas perpendiculares e holofotes; relógio e calendário de 2008, céu com sol, lua e nuvens, chuva, neve e trovões; curvatura do horizonte e o Sarcófago.
- Rede elétrica com subestações e o blackout com som (tecla K).

## 0.4 — Visual sólido (2026-09-30)
- Fundo colorido atrás dos glifos, paleta de sódio, objetos com volume, mobiliário urbano, lixo, letreiros com o nome das empresas, luzes dinâmicas e o primeiro som.

## 0.3 — Estrutura da cidade (2026-09-30)
- Distritos com nomes, estilos de fachada, topos de torre, parques, praças, marcos e a borda com a zona de fogo.

## 0.2 — Cidade grande (2026-09-30)
- Cidade de ~2×2 km em metros, prédios com identidade fixa e horizonte distante.

## 0.1 — Motor (2026-09-30)
- Vite + TypeScript, raycaster por coluna em grade de caracteres desenhada pela GPU, câmera suave.
