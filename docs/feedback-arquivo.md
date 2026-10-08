# Arquivo de feedback processado

> Pedido do usuário em 2026-10-06 (item 30): ao processar `FEEDBACK.md`, em vez de só apagar, mover os itens crus para cá, com a data. Assim a caixa fica só com o que ainda não foi processado, e o texto original não se perde. O mais novo em cima.


## 2026-10-08 (tarde — playtest 14-37-49, 12 notas F8)

Texto cru no relatório `playtest/2026-10-08_14-37-49_seed1393987109_report.md`. Triagem em `docs/plano-interiores.md` passo 9:
agora = notas 1 (feito), 2–9 e o travamento; depois = 10 (etapa 20), 11 (13.7 render), 12 (escadas de incêndio, depois do passo 8).
Pedido no chat: um documento técnico e bonito (com infográficos) explicando a engine, a rasterização, a luz e os interiores → Plano, "Documento da engine".

## 2026-10-06 (tarde — processado por Opus 4.8, durante a entrevista do Jackdaw)

Destino de cada item entre colchetes no fim.

- Feedback. Uh, o negocinho que diz os status do notebook, ele não aparece mais, né? Quando você coloca o navegador. No canto ali. [listas-fixas: correções (draw.ts/wm.ts, não o shell)]
- Uh, E o, o tdump, ele não vem instalado por padrão, e isso causa um soft lock, quando você não acha nenhuma re, uma rede. Uma rede aberta. Então eu recomendo deixar o tdump e o wcrack como instalados por padrão. Mas aí, é, é tipo o mínimo necessário para. Pra crackear uma rede wep. O resto não precisa. [FEITO — tdump pré-instalado em HACK_TOOLS; lição em licoes.md]
- O celular parece que ele está utilizando o plano de dados também, mesmo quando está conectado no Wi-Fi, para navegar pelo Lodestar. [listas-fixas: correções (roteamento Wi-Fi x dados do celular)]
- que tal um Amber Alert ou algo assim quando você tem um apagão na cidade toda e seu celular recebe. Uma ideia que eu tô jogando por aí. [docs/dispositivo-hacking.md, brainstorm — apagão geral]
- A gente também tem que organizar a lista dos, dos jogos dos pedestres pensando assim, quais são os eventos que podem acontecer ao redor deles, quais eventos eles merecem reagir... se um carro bater, eles podem, eles deveriam ir olhar o carro, tirar foto, postar... Se tiver um blackout, eles podem ficar com medo, sair correndo... uma certa distância do player tem que ter essa IA, estilo GTA... ter animações e expressões e reagir aos eventos ao redor do mundo. Isso é uma coisa enorme que precisa ser feita. [CLAUDE.md etapa 16 — pedestres sem trilhos]

## 2026-10-06 (processado por Opus 4.8)

Destino de cada item entre colchetes no fim.

- também é reorganizar o celular. A gente vai tirar o aplicativo do Snake e colocar dentro de é, na pastinha de, do My Apps. E a gente vai trazer o Loadstar para a posição que está o Streetwire e a gente vai mover os aplicativos para a direita, né? Então a ordem do celular vai ser Calls, Contacts, Messages, Camera, Maps, aí o Loadstar Mini, e aí Streetwire, News, Weather, você entendeu? E o Snake vai para o MyApps. [Plano 15 / docs/retoques-14-15.md]
- E também é difícil lembrar qual que é o site de pesquisa, qual que é o site de fórum, né? ... Uma funcionalidade de barra de favoritos, que já vem pré-instalada com alguns favoritos importantes, mas não o fórum de hacking. O fórum de hacking você vai encontrar pelo mundo. Mas agora, por debug, essa barra também vai ter o fórum de hacking. Inclusive é bom organizar as coisas que são de debug para eventualmente a gente tirar elas. [Plano 15 / docs/retoques-14-15.md]
- Eu queria que você pesquisasse as qualidades de vida que tem em sistemas como o VS Code e zsh, bash, para você implementar os mesmos sistemas... quando você está escrevendo uma aspa e você digita algo, você sem querer apagar a aspa seguinte, se você apertar a aspa de novo, ele não cria duas aspas, ele completa a que já tem... Uma que não tem ainda é tab autocomplete em comando concatenado. [Plano 15.7e]
- O cliente de e-mail não descreveu o erro quando eu coloquei uma senha errada. Na verdade, quando eu coloquei uma senha com menos de seis caracteres. [listas-fixas: correções]
- Na interface do notebook, o celular ele deve ser mais fácil de tirar. Não tem uma tooltip dizendo qual que é a tecla do celular. Eu queria que quando você apertasse o botão do meio do mouse ele tirasse o celular, ou então quando aparecesse a notificação aqui embaixo e você está com o notebook aberto, quando ela levantasse um pouquinho, você clicasse nela e ela levantasse. [Plano 15 / docs/retoques-14-15.md]
- Fazer com que os endereços de e-mail sejam uma versão de no máximo 6 a 8 caracteres do nome. Porque o nome da cidade gerou como New Lockwood e aí meu endereço é arroba newlockwoodonline.com. É muito longo para digitar. [listas-fixas: correções]
- Também fazer um gerenciador de abas pro Loadstar, porque quando ele pede um e-mail de confirmação, eu tenho que sair completamente do site para ir pro e-mail. E colocar os atalhos, a barra de favoritos, o e-mail ser um deles. Pelo menos seria bom que sempre que ele mandar um e-mail de confirmação, tenha um hyperlink para abrir o seu e-mail. Se sua inbox já está aberta em outra aba, ir para ela. Ou deixar o e-mail como uma seção permanente do Loadstar. [Plano 15 / docs/retoques-14-15.md]
- o link de find na homepage n funciona [listas-fixas: correções]
- escurecer em roxo links ja clicados guardados na cache do navegador (e sessoes com tokens/cookies, porque isso possibilita hacks de credencial como rats no futuro) [roxo → Plano 15; tokens/cookies/RAT → docs/feedback-opus48.md HACKING]
- Uh, o Electron está capturando o botão de volta do mouse e acaba retornando a página. Quando eu estou no jogo, isso recarrega o jogo. Tem como desligar essa bind do Electron e ao invés disso usar só no navegador do notebook? [listas-fixas: correções]
- Para o sistema de diálogo, eles têm que ter uma certa memória para perguntas follow-up... pergunto qual foi o placar e eles estão entendendo essa segunda pergunta como algo separado da primeira. Também, melhorar as tooltips: faltou highlight de sintaxe (colorir os operadores com pesos, how, where, etc. enquanto digita). E um autocomplete para lugares que você conhece ou referencia, e lugares perto. Aumentar um pouquinho o tamanho das letras e das legendas. [Plano 14 / docs/retoques-14-15.md]
- Sobre o Tone, seria bom ele ter highlight (respectful → verde). O quadrante político... deixa ali mesmo. E vamos tirar o unrecognized: quando não reconhece fica só "type what you want to say", e quando reconhece aparece alguma coisa. As legendas dos pedestres em volta podem estar em outro lugar, ao invés daquela caixinha. [Plano 14 / listas-fixas]
- o quadrante político (o plano cartesiano do tom) não está centralizado no meio, o centro dele está na parte de baixo. [listas-fixas: correções]
- Quando você tá falando com a pessoa, apertar ESC ainda abre o menu. E seria legal que, andando por aí, se você segurar o botão direito por um tempo (para não causar problema com o celular), descer um zoom para você enxergar uma placa do outro lado da rua. [ESC → listas-fixas; zoom → Plano 13.9]
- Os lugares terem número na fachada, para achar melhor um prédio sem letreiro. E plaquinhas menores. E dentro ou fora dos prédios, um diretório dizendo o que tem em cada sala, em cada andar. Parte do princípio de que no começo o jogador não tem o Maps. Com o sistema de zoom e o de olhar o preço dos negócios, a gente pode usar isso para o diretório. [Plano 13.9]
- O T9 não reconhece motel. Seria bom dar uma passada no T9 e ver se todos os termos relevantes têm. E quem sabe baixar uma lista de dicionário T9 real. [listas-fixas: correções]
- Seria bom o orelhão dizer quanto custa cada ligação. Também dar uma olhada, com base no usuário de playtest, em situações em que ele deve devolver o dinheiro ou não e se elas estão cobertas. [listas-fixas: correções]
- As lojas não estão gerando na calçada, mas quando isso acontecer, elas só gerassem um letreiro no lado da fachada da loja. Nos casos em que não tem letreiro na rua, botar uma blade vertical com uma seta apontando para que lado está a loja. Fora dos becos deliberados, fazer os prédios por etapas: uma etapa verifica em que lado da rua está a porta da loja e rotaciona o prédio para a fachada ficar para a rua, e checa se todas as portas estão acessíveis. Skip a checagem quando o prédio foi gerado sem nenhum lado virado para a rua; aí o lado do beco teria a blade. [Plano 13]
- A geração de lojas está gerando prédios em que o letreiro está coberto por outro prédio. Vou tirar foto com o F8. [Plano 13 / notas F8 do playtest]
- toda vez que processar os feedbacks, mover eles para uma parte de feedback histórico (subpasta), deixando a pasta de feedbacks só com os não processados desde a última sessão. [feito: este arquivo + regra no cabeçalho do FEEDBACK.md]
- Sempre que você pausa e aperta ESC de novo, o mouse não está capturado. Em situação em que o mouse estava capturado antes e você aperta ESC, quando você aperta ESC de novo, ele deve recapturar o mouse automaticamente. [listas-fixas: correções]

### Notas F8 do playtest seed656322502 (2026-10-06)
- letreiro coberto por outro prédio (notas 1, 2) [Plano 13]
- céu preto visto por outra janela (nota 3) [Bugs conhecidos: interiores]
- portas não aparecem atrás do vidro das portas 3D (nota 4) [já 13.10d]
- colunas geram muito perto da parede → fundir com a parede (nota 5) [listas-fixas]
- loja com produtos e balcão separados por um elevador → talvez não gerar loja (notas 6, 7) [Plano 13.10i]
- placa GO a essa distância devia ser pontos em vez de letras (nota 8) [listas-fixas: legibilidade]
- letras do semáforo de pedestre e da placa ao lado quase invisíveis de perto → compor por blocos como letreiros, a placa retrorreflexiva (nota 9) [listas-fixas: legibilidade]
