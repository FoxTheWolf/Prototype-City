# Terminal City — log de atualizações

Versão `0.ETAPA.SUB` (por exemplo, `0.12.4` é a subetapa 12.4). Uma linha por novidade, escrita para quem joga; o mais novo em cima. As regras de como manter este arquivo estão no CLAUDE.md, em "Como trabalhar neste projeto". Entradas da Trilha de hacking são escritas por uma sessão com o Opus 4.8; fora dela aparecem só como "(entrada da Trilha de hacking)". As versões até a 0.12.3 foram montadas depois, a partir do histórico e dos commits.

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
