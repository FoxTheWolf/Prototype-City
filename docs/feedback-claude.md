# Feedback do Claude

> O feedback do Claude sobre o jogo: técnico, de jogabilidade, criativo e temático. Datado, o mais novo em cima. Nada aqui está decidido: quando o usuário decidir algo, vai para o CLAUDE.md (Decisões ou Plano) e fica marcado aqui. Tudo o que entra aqui também é mandado no chat. O feedback antigo (até 2026-10-04) está na seção "Opiniões e sugestões do Claude" do CLAUDE.md.

## 2026-10-08 — as lojas na gramática das plantas (13.21)
- **A recepção do motel ficou certa, mas vazia:** numa loja larga sobra muito chão entre o sofá e o balcão. É a primeira sala que o jogador vê com gente (o gerente); na 25.1, junto do prédio M1, merece um modelo próprio com mais vida (o quadro de chaves, a máquina de vendas, o folheto de turismo, o sino do balcão), e o clutter depois da 1.0 completa.
- **Modelos próprios faltam para a farmácia, a livraria, a loja de celulares e a oficina:** hoje usam o das prateleiras. Barato agora (texto conferido por script); vale no C2 ou na 23.8, por ordem de quanto o jogador entra nelas (a farmácia e a de celulares primeiro, pelo laço: comprar chip).
- **O gerador de cortes é o que ainda produz lixo** (tiras de 1 m chamadas de loja, o elevador na porta): cada tamanho que ganha planta desenhada some com um pedaço dele. O 8 × 16 (62 lojas) e o 12 × 12/12 × 16 são os próximos que mais rendem.

## 2026-10-08 — uma camada de efeitos acima do ASCII (pergunta do usuário na 13.S)
- **Já existe e já é assim para o bloom:** o shader do mundo só grava quanto cada célula brilha (`gGlow`), e o borrado e a soma são do compositor (`gpu/compositor.ts`, `GLOW_K`), por cima das letras; o halo e o glare dos aparelhos também.
- **Não simplifica o shader do mundo:** medido com `tests/wgsl-inline.ts`, os cones das lâmpadas, a chuva por cima, o `display` e a mão somam menos de 2% do shader expandido. O peso está na geometria (a cidade, os interiores, os objetos, a luz), que precisa ficar onde está.
- **Mas é o lugar certo para os efeitos novos** (lens flare, god rays, o brilho do sol no vidro): em pixels, no compositor, como manda a regra da camada HD. God rays em tela são baratos (uma máscara do sol e um borrado radial a partir dele, com o céu e os prédios do buffer de saída). Recomendo fazer assim quando entrarem (23, refinamento), e passar para lá o que for só efeito ao revisar bugs como o do relógio atrás do notebook (que é de ordem de composição, e a camada de cima resolve).

## 2026-10-08 — brainstorming da reunião (Opus 5.5)
- **As janelas reais viram reconhecimento:** com a fachada lendo a luz dos cômodos (13.22), olhar um prédio da rua conta a rotina de quem mora lá ("o 4º andar apaga às 23h"). É a primeira ferramenta orgânica de reconhecimento, de graça para a 18; anotar no caderno (22.1).
- **Um binóculo (2008, barato):** aproximar a vista para ler a etiqueta da caixa da GridLink, a janela, a placa do carro. Alimenta o reconhecimento sem exigir chegar perto. Candidato a side grade na 19.
- **Fixar já as subetapas da 18 com o Opus 4.8** (numa conta com folga): pela regra 5, as etapas 13–17 deveriam saber o que o hacking vai pedir delas (portas com controle eletrônico, câmeras nos postos, a luz por cômodo, os registros dos moradores). Hoje a 18 é a única etapa sem plano fixo, e é o coração.
- **A 13.21 precisa do cybercafé e do motel como lojas de primeira classe:** são as duas do laço da primeira hora (a internet e a diária). Se a 13.21 tiver que cortar tipos, esses dois ficam.
- **Toda reação implícita da 18 com um rosto:** uma lista de conferência na 18: cada sistema hackeável tem pelo menos uma reação visível (manchete, NPC reclamando, luz apagando, fila na loja). É o teste das duas camadas aplicado ao hacking.
- **O mar a oeste:** o sol se pondo no mar visto da cidade no fim da tarde é a hora mais noir do dia; o leste daria o nascer, quando o jogador costuma estar dormindo.

## 2026-10-08 — a 13.20 (Opus 5.5)
- **A biblioteca precisa de uma passada no manual:** as molduras dela são das plantas antigas, e 16 cômodos de casa (as quitinetes grandes do térreo, o F2, o D0R, o G1) ficam com a camada fixa do andar, então todos os moradores deles têm a mesma casa. Sugiro, numa folga do C2/C3, que eu escreva 3 arrumações para cada um (texto conferido por script, barato) e atualize as molduras da biblioteca pelo jogo.
- **A renda é provisória:** sai do tipo de trabalho (escritório = alta). Na 19 (economia) o salário de verdade substitui isso; a casa passa a ser pista de quanto a pessoa ganha, que é ótimo para o hacking (quem vale a pena investigar).
- **O posto em pé é um ponto e uma direção, sem animação nem duração ainda:** a 17 lê isso. Se quiser, a duração da tabela da seção 8 do manual entra junto quando os NPCs entrarem nas casas.

## 2026-10-08 — a 13.19 (Opus 5.5)
- **A luz sobre a porta:** o manual pede "luz em cima"; hoje quem faz esse papel é a bandeira acesa pelo saguão. Uma arandela de verdade seria mais uma fonte de luz por prédio (o orçamento de luzes da rua): proponho deixar para a 23 e ver se a bandeira já basta no PC.
- **O EXIT no apagão:** a placa é desenhada sempre acesa (como deve, é bateria), mas não ilumina nada em volta; numa escada às escuras, um brilho vermelho fraco no chão e nas paredes perto da placa seria a cena mais noir do prédio. Barato se entrar junto da luz por cômodo da 13.22.
- **Número repetido nas portas vizinhas** (522 duas vezes): o quarteirão longo não cabe em 49 números por lado. Sugiro "522A" para o segundo lote no mesmo número, como nas cidades americanas; decidir no bloco de correção.

## 2026-10-08 — a 13.18 (Opus 5.5)
- **A 13.19 e as portas estreitas mexem de novo nas plantas:** a porta `D` tem 2 caracteres (1 m) no manual; se no jogo ela sai estreita, é a conversão para células (moldura, parede de 0,25 m), não o desenho. Medir primeiro no `tests/stack-print.ts` a largura livre de cada vão, e só então decidir entre alargar no leitor ou redesenhar (redesenhar 25 plantas custa caro).
- **O hall de entrada da R12 é pequeno (1 m):** lê como entrada, mas é um corredor junto da cozinha. Quando a 13.20 trouxer a biblioteca de arrumações, vale dar ao hall um cabideiro e um capacho (dois objetos baratos) para ele se ler como entrada mesmo no escuro.
- **A face da laje no topo da escada sai cinza (é teto):** o certo é madeira, como o último degrau; ficou para a 23.3 junto da parte de baixo dos lances, que vista de baixo fica quase preta.

## 2026-10-07 — o notebook em cubinhos (Opus 5.5)
- **As legendas na fonte 5 × 7 combinam com o resto (letreiros, Ferret), mas são pequenas:** as de 3+ letras saem a 1,75 mm (BKSP, SHIFT). Se no 1080p ficarem ilegíveis, o caminho barato é subir o decalque para 6 px/mm só nessas; não vale trocar por fonte do sistema (fugiria do "tudo em pixels do jogo").
- **Falta um realce da peça sob o cursor** (como o celular tem): com 86 peças clicáveis, o jogador não sabe o que é botão e o que é enfeite. Um brilho leve na paleta (o `mul` já existe) resolve com poucas linhas.
- **A luz do teclado é a primeira "luz do jogador" de verdade:** quando a etapa 16 fizer o stealth, ela e a tela já são as fontes que o entregam; vale dar desde já à polícia a regra "um leque quente num banco escuro chama atenção".
- **A chave do rádio na frente** (do manual) é um ótimo botão para o laço de hacking (cortar o rádio para sumir do log de um ponto de acesso), mas é `[HACKING]` no efeito: fica para o agente `hacking` decidir o que ela desliga na máquina virtual.

## 2026-10-07 — o fim da 3b (Opus 5.5)
- **"Branches nearby" alimenta o laço do dinheiro vivo:** hoje o saque é no balcão da agência; com a lista por distância e "aberta agora", o jogador aprende sozinho que de madrugada não há onde sacar, uma pressão orgânica para andar com dinheiro na mochila (e um alvo para quando houver caixas eletrônicos hackeáveis).
- **A câmera agora mostra exatamente o que a foto vai ser** (o visor no tamanho da foto): quando as fotos virarem pistas nas investigações, isso evita a frustração de "não era isso que eu enquadrei".
- **O mapa em pixels ficou bom o bastante para ser uma referência visual da cidade:** dá para usar a mesma imagem (`streetMap`) no mapa de papel da 13.9 e nos totens "YOU ARE HERE", em vez de inventar outro desenho.

## 2026-10-07 — 15.17g, as páginas canônicas (Opus 5.5)
- **O mapa da GridLink é uma ferramenta de jogo sem parecer uma:** é a forma orgânica de o jogador conferir se o apagão que causou "pegou" e quanto tempo dura, como qualquer morador faria. Sugiro que, quando o calor existir de verdade (etapa 16), a página também mostre "investigating the cause" depois de um apagão do jogador: o implícito (a investigação) aparecendo pelo explícito (o site da empresa).
- **Os rostos no Streetwire ligam a web à rua:** dá para reconhecer na calçada quem postou. Quando vierem as investigações, "ache a pessoa deste post" vira missão sem nenhuma interface nova.
- **Os assuntos em alta pelos dados** (evento, bairro, loja) são o começo natural do índice de madrugada do Lookwise (15.17h): proponho indexar os posts pelas mesmas tags.

## 2026-10-07 — manual dos fabricantes (Opus 5.5)
- **O custo dos nomes sorteados vai para o motor:** com nome fixo, bastaria um bitmap por logo. Com o nome sorteado, cada família precisa de uma **fonte de pontos própria** no jogo (como a 5×7 dos letreiros), com o jeito da tipografia: o estêncil, a fina arredondada, a condensada. São ~9 fontes pequenas. Proponho começar só pelas que aparecem na rua (as fachadas das operadoras) e deixar as dos aparelhos para o remake 3D.
- **A família vale mais que o nome:** como o jogador não pode decorar nomes que mudam de cidade para cidade, a cor e o símbolo é que dizem "operadora antiga" ou "celular robusto". É um bom caso do princípio das duas camadas: a regra fica escondida (o índice do fabricante), e o que aparece é o visual.
- **Uma ideia para depois:** a operadora de desconto é a do chip descartável. O cartaz amarelo na farmácia pode ser a dica orgânica de onde zerar a reputação, sem tutorial.

## 2026-10-06 — depois da 15.9 (Opus 5.5)
- **Eu não ouço as músicas.** Compus por teoria (a melodia cai em 82–97% nas notas do acorde, o `tests/music.ts` confere), mas o timbre e a mixagem precisam do seu ouvido. Se alguma soar sem graça, o caminho mais barato é me dizer "mais rápida", "mais triste" ou "a bateria alta demais", e eu mexo nos números, sem recompor.
- **O alto-falante é um sistema implícito com retorno natural:** a música sai de verdade do celular. Na etapa 16, os NPCs que reagirem a ela fecham o laço das duas camadas sem nenhuma barra.
- **O Reynard sem conteúdo é uma casca.** Ele só ganha vida quando o mentor passar a falar por ele. Proponho que a verificação do número de segurança seja um momento do tutorial: o mentor lê os dígitos numa ligação, e um número diferente um dia seria um gancho de história (alguém no meio).
- **O controle do fio fica sempre visível** com fone e música, como você pediu. Se no teste ele atrapalhar a vista, dá para mostrá-lo só com o Alt segurado.

## 2026-10-06 — depois do WEP crack

- **O WEP sem o "exposto = calor" ainda não morde.** Hoje capturar é parar ~20–60 s de jogo olhando o contador subir, sem risco. O que faz valer a pena é o follow-up (a): enquanto `tdump mon` roda, acumular calor em `heat.ts` (um ato contínuo, não pontual) e, melhor ainda, o mentor por SMS avisar "you've been sitting on that link too long". Sem isso, o crack é só uma espera. Sugiro fazer o calor contínuo logo após a 15.8c, junto com o resto do laço.
- **O contador de IVs é a parte gostosa** (sobe mais rápido quando você chega perto da subestação): é diegético e ensina sozinho que a distância importa, sem tutorial. Vale reusar esse padrão "número que reage à sua posição" em outros alvos.
- **Legibilidade das placas (notas F8 8 e 9) é um tema recorrente** — a placa "GO" e o semáforo de pedestre somem de perto. Já temos o princípio "pontos de perto, ASCII de longe" e a fonte 5×7; aplicá-lo às placas informativas é barato e resolve também o pedido do zoom (13.17): se a placa é legível, o zoom vira luxo, não necessidade.

---

## 2026-10-06, as lojas da 13.10i
- **Quase metade das lojas virou "térreo inteiro"** (769 de 1618 na semente 42): nos prédios de 8 a 12 m não cabem a vitrine e a porta dos moradores lado a lado, então os moradores passam pela loja até o elevador. É comum na vida real (a loja de família com a casa em cima), mas se ficar repetitivo, a saída é a cidade gerar menos lojas nos lotes pequenos ou lotes um pouco mais largos nas ruas comerciais.
- **Isso abre jogo:** a porta do prédio trancada à noite e a loja como único caminho até os andares de cima são um pequeno problema de acesso para o jogador resolver (pela escada de incêndio, por um morador, pelo horário), sem nenhuma regra nova.

## 2026-10-05, comparação com uma captura antiga (semente 711445483, POS 771.2,971.9)
- **Antes:** grade 272×80, silhuetas chapadas contra o céu, glifos legíveis como letras (`#`, `%`, `@`), paleta curta (âmbar, verde-água, rosa), sem chão, sem gente. **Agora:** 640×216, raio 3D na GPU, luz por fonte, gente e carros em bloco, semáforos, faixa de pedestre, o relógio na mão, 180 FPS com 3,7 ms de GPU.
- **Ganho enorme:** profundidade, escala de rua (os prédios sobem de verdade), luz que molda volume, vida no chão.
- **O que se perdeu (opinião):** (1) de longe o ASCII quase some: a 640×216 lê-se como pixel art, os glifos só aparecem de perto; (2) **contorno neon em quase toda aresta de torre** (roxo, verde, amarelo) dá cara de wireframe/Tron, não de noir de sódio; a captura antiga tinha mais identidade com menos cor; liga com o item "saturação demais" da lista de luz; (3) a composição antiga tinha silhuetas limpas contra o céu; hoje o céu quase não aparece entre as torres.
- **Sugestões:** neon só em alguns prédios (os comerciais, pela semente), não em toda aresta; testar um modo/opção de grade mais grossa para devolver a leitura de glifo de longe.

## 2026-10-05, crítica das decisões da segunda entrevista (pedida pelo usuário)
- **Contradição maior: salvar a qualquer hora + recarregar livre** esvazia o que a entrevista construiu (prazo real, mentira descoberta, prisão com confisco, o caderno lido, o chip que zera tudo). Com a caixa de texto livre, o jogador testa a mentira, recarrega e tenta outra. Proposta: salvar a qualquer hora **menos durante calor/perseguição/conversa** (a mesma trava de dormir), sem precisar de modo ferro.
- **Física x softlock:** decidimos nunca apreender o notebook por ser softlock, mas com física o notebook pode ser jogado no mar, cair num vão, ficar preso numa parede. Regra proposta: o notebook (e o celular) nunca se perdem de vez (achado e perdido do motel, volta depois de um tempo). O custo da física não é CPU, é engenharia: colisão contra paredes e móveis na simulação, objetos atravessando lajes; seguir "uma fonte só" (a CPU já sabe a geometria).
- **Tela em pixels x "só ASCII":** a identidade do jogo é tudo em ASCII; uma tela nítida no mundo pode parecer colada. Proposta: aplicar o princípio dos letreiros: **pixels de perto, ASCII de longe** (a tela vira glifos/faixa acesa com a distância). Na mão, como hoje.
- **O caderno lido pela polícia** pode fazer o jogador parar de usar o caderno, que o jogo quer que ele use. Só contam fatos que batem com segredos reais (uma senha verdadeira, um alvo real), nunca o texto qualquer; e o **diário automático não pode incriminar** (o jogador não escreveu): deixá-lo vago ou fora da leitura.
- **Escopo:** a sessão acrescentou física, aparelho estilo Flipper, rádio da polícia, postar na rede, diário, antena, fofoca, etapa de identidade. A maioria alimenta o laço, mas a coleção dos GridLinks e o Flipper são largura: limitar na 1.0 (poucos GridLinks, ~10–15, e o Flipper com 2–3 funções).
- **Incertezas:** (1) a economia (~5–7 dias, 5x a TI, apertado no começo) só se confirma medindo: um script em `tests/` que simula a semana do jogador; (2) o prazo real da primeira noite exige que a geração ponha um cybercafé a uma distância andável do motel em toda semente (conferir pelo teste de plantas); (3) GRID DOWN pode estar registrado; (4) se a GridLink é remendada e cada caixa difere, o conteúdo por caixa custa caro: talvez 3–4 modelos de caixa.

## 2026-10-05, olhar cego do clima (`referencias/63–71`, da manhã à madrugada)

- **O melhor:** o fim de tarde no Theater District (66: sol entre os prédios, sombras longas dos carros, nuvens douradas por baixo), a lua cheia sobre o neon (68) e a névoa alaranjada da cidade na chuva (69). O céu azul com nuvens de dia (63–65) também.
- **As bordas das nuvens granuladas e "pinceladas"** (64, 65, 67): de perto, as nuvens viram ruído serrilhado e arrastado, como tinta borrada; a forma de longe é boa, a borda não.
- **O céu limpo de madrugada é um buraco preto** (71, 05:37): entre nuvens marrons iluminadas pela cidade, o céu aberto fica preto chapado, lido como vazio. Às 5h30 já deveria haver um azul-escuro do pré-amanhecer, e ao menos algumas estrelas.
- **A chuva parece uma camada na tela** (69): os traços são todos do mesmo tamanho e densidade em toda a tela, do perto ao longe; não há profundidade. (Já no Plano, a chuva volumétrica.)
- **Os contornos de neon acesos de dia** (65, 66, 67): as linhas roxas e rosa nas quinas dos prédios ao meio-dia — é o que eu tinha lido como falha nas capturas anteriores. De dia, deveriam apagar ou quase sumir.
- **A sombra das copas** (63): no gramado, a sombra das árvores aparece como o contorno de uma caixa vazia, sem a mancha redonda da copa.
- **O carro lilás brilhando** (70): parece aceso por dentro, mais claro que tudo; e um poste preto alto sem luminária no meio da calçada.
- **A lua** (68): a mancha escura no disco ainda parece uma sombra, não um mar (já no Plano).
- **No horizonte**, de novo os pilares vermelhos (66) e um brilho avermelhado (70): a borda da cidade.

## 2026-10-05, olhar cego (capturas `referencias/52–60`, lidas como jogador, sem o código)

- **A rua vista de dentro parece água** (59, e o saguão em 55): pelo vidro, o asfalto fica azul-roxo e as faixas parecem ondas; quem está lá fora vira azul sólido. É o defeito que mais pesa nos interiores: deixa a loja com cara de aquário. O vidro deveria tingir pouco (um cinza-esverdeado leve) e deixar a rua com a cor dela.
- **Os telões mostram uma mancha borrada** (58: o verde enorme no Majestic; 60: o roxo no prédio da direita). Como jogador, li como tela quebrada ou imagem que não carregou. Se é de propósito, precisa de conteúdo legível (texto, um logo de empresa da cidade, a fonte de pontos).
- **O ciclista destoa** (58): cabeça redonda cor de pele sobre um bloco vermelho, sem braços, num mundo de pessoas em bloco. Parece um modelo provisório esquecido.
- **Bases brancas dos postes estouradas** (52, 58): a base do poste do ponto e a do semáforo de pedestres parecem acesas, mais claras que tudo em volta.
- **Linhas coloridas nas arestas dos prédios de dia** (60: roxo e rosa nas quinas do prédio vermelho e do bege): parecem aberração cromática ou falha.
- **A grama saturada demais na chuva** (60): verde vivo uniforme num dia cinza; deveria escurecer e dessaturar com o tempo fechado.
- **O que está bonito:** a rua do Majestic à noite (58: letreiros de lâmpadas, o semáforo de pedestres com o "60" em pontos, a profundidade das torres), o parque com chuva e as torres do centro (60), o relógio com os segmentos apagados.
- **"DRUGS 24H" no outdoor** (61): em inglês americano é farmácia, mas o jogador lê como "drogas 24 horas" (e esbarra na regra de conteúdo limpo). Trocar por "PHARMACY 24H" ou "DRUGSTORE" na gramática dos anúncios.
- **Uma fileira de pilares de tijolo vermelho no horizonte** (61, à esquerda): parecem ruínas ou chaminés soltas; provavelmente a borda da cidade (cerca ou zona de fogo). Some com a praia da 13.15.
- **A praça em xadrez** (61): o piso de ladrilhos enormes claro/escuro lê como tabuleiro; ladrilhos menores ou de duas cores próximas ficariam mais urbanos. As linhas coloridas nas quinas dos prédios aparecem de novo de dia.
- **O notebook** (62): o texto âmbar escuro sobre o preto tem pouco contraste (as linhas do boot quase somem); as manchas escuras borradas na tela parecem falha de render, não sujeira (se são sujeira, precisam de forma de dedo/gordura); o notebook parece flutuar sobre o chão da praça, sem mãos, colo ou mesa; uma forma verde à direita do teclado (provavelmente a cadeira da praça atrás) confunde com um LED.
- **O celular** (61) está legível e bonito (o tema escuro funciona); só os cantos de cima do corpo ficam serrilhados em degraus, mais grossos que o resto do desenho.
- O vulto verde da captura 54 era a planta vista pelo vidro da porta (confirmado pelo usuário): não é bug.

## 2026-10-05, depois da 13.10d2 (o céu real)

- **O céu virou um sistema, não um fundo.** Com a lua e as estrelas de verdade, a noite tem um calendário que o jogador pode aprender: noites sem lua são mais escuras (melhores para trabalhar sem ser visto), a lua cheia ilumina a rua. Sugiro que o stealth da etapa 16 leia a luz da lua (`moonlight` já existe) e que o caderno ou o app de clima mostre a fase.
- **O eclipse de 21/02/2008 é um presente:** além dos posts (já no Plano), a lua pode ficar vermelho-cobre durante a totalidade, e a cidade inteira olhando para cima é a cena mais "orgânica" possível (NPCs param na rua, as notícias falam). É barato: a sombra da Terra é um círculo na posição oposta ao sol.
- **Estrelas na cidade grande:** deixei as 320 mais brilhantes, mas a poluição luminosa já esconde as fracas. Num apagão geral, o céu poderia mostrar mais estrelas (é um efeito real e marcante, que aconteceu em Nova York em 2003); dá para incluir até a magnitude 5 e ligar o limite ao `cityLit`.
- **Compilação do shader:** cada mudança custou 3–4 min no painel; vale antecipar a sessão de "arrumar o shader" (dividir e juntar as chamadas grandes) antes da etapa 14, porque o diálogo e a web vão mexer pouco no shader, mas a 13.10e–h ainda mexem.

## 2026-10-04, depois da 13.10d (o que está no peito)

> **Resposta do usuário (2026-10-04):** concordou com tudo, menos o item 2: o hacking depende dos sistemas da cidade, e o principal (a web) ainda não existe; ele deve brilhar a partir das etapas 15 e 16. Os aceitos foram levados ao CLAUDE.md.

1. **O núcleo da 1.0 antes do resto.** As etapas 13 a 22 são muitas, e algumas são polimento (sound design, refinamento). Sugiro escrever numa linha o **laço mínimo da 1.0**: receber um trabalho → ir ao lugar → hackear → a cidade reage → calor → dinheiro → comprar equipamento → trabalho maior. Toda subetapa nova passa por uma pergunta: alimenta esse laço? Se não, vai para depois da 1.0, como o cinema.
2. **O hacking está ficando para trás.** O coração do jogo é o hacking, e ele anda devagar porque depende do Opus 4.8 e do agente. Hoje há três trabalhos; a cidade já tem muito mais sistemas para mexer (lojas com horário, portas trancadas, elevadores, câmeras, cidadãos com rotina). Proponho uma sessão da trilha logo depois da 13.10, só para desenhar 5 a 10 trabalhos novos com o que já existe (por exemplo, destrancar a porta do estoque de uma loja fechada, parar um elevador, apagar a câmera de uma esquina na hora certa).
3. **Uma fonte só para cada geometria.** O bug da porta de hoje nasceu de eu ter recalculado na GPU uma coisa que a CPU já calcula (as folhas de rua). Toda vez que dois lugares calculam a mesma geometria, eles divergem. Regra que sugiro: a simulação calcula, a GPU só lê.
4. **O shader é um monólito de ~3 mil linhas.** O travamento da compilação de hoje é um aviso: quanto mais ele cresce, mais lento compila e mais fácil é travar. Antes da demo, vale uma sessão de arrumação: separar em arquivos por assunto (céu, fachada, interior, objetos) e medir o tempo de compilação. Junto entram os 16 buffers para caber em 8, que já está no marco da demo.
5. **Testes visuais fixos.** Os testes no Node pegam a lógica; os bugs que você acha são visuais. Proponho uma lista de "posições de ouro" (semente 42, POS, hora, direção) para olhar a cada grupo: a porta da loja, um interior, um cruzamento, a borda. Eu tiro as capturas e comparo antes de pedir seu teste, e você recebe menos bugs óbvios.
6. **O ritmo do limite.** O limite semanal está apertando. Sessões menores com um objetivo só rendem mais que sessões longas, porque o contexto cresce e cada mensagem fica mais cara. Ler o CLAUDE.md custa ~45 mil tokens por sessão: vale uma passada para enxugar (levar o design já implementado e as listas longas para `docs/`).
7. **O que está muito bom.** O princípio do "um só espaço" está pagando: as portas, as janelas e a luz agora concordam de dentro e de fora, e os bugs que sobram são de acabamento, não de arquitetura. A identidade noir (a porta de enrolar à noite, a vitrine acesa) já tem cara de jogo. A decisão de cortar o que gera *workaround* (a diagonal, o cinema) foi a mais importante do mês.
8. **Ideia pequena:** a porta de enrolar como alvo. Ela já é controlada pelo horário; um controlador de horário hackeável numa rua comercial (todas as portas sobem às 3 da manhã) é uma consequência visível, barata e engraçada, no estilo Uplink.


## 2026-10-04 (7): depois da 13.10c

- **Os modelos em texto abrem uma porta boa para as outras IAs:** o formato é simples (meio metro por letra, legenda fixa) e o código já descarta o que não cabe e confere o caixa. Dá para pedir ao Gemini/ChatGPT variações por tipo (três diners, dois bares…) com um briefing curto em `docs/tarefas/`, e o teste no Node diz quais funcionam.
- **Banco, hotel, motel, cinema e estacionamento ainda usam o gerador antigo:** são saguões, e o modelo deles é diferente (balcão no fundo, sofás, plantas). Proponho um modelo para cada quando a etapa 14 trouxer o diálogo com o atendente.

## 2026-10-04 (6): depois da 13.10b2

- **A porta de rua fechada, vista de fora, parece uma placa marrom chapada:** o desenho dela é um brilho fixo do saguão (de antes do um só espaço), não o vidro com a sala atrás. Com a 13.10e (porta 3D de verdade) isso some de graça: proponho não mexer antes.
- **A rua de trás pela janela abre um caminho barato para o "interior falso" de longe (etapa 20):** o mesmo segundo raio poderia, depois dos 60 m, atravessar o prédio sem a planta (só a caixa), para as janelas de longe mostrarem um pouco do céu do outro lado. Só se as torres de longe parecerem chapadas demais.

---

## 2026-10-04 (5): depois da 13.10b

- **Uma janela de fora ainda não mostra a janela do outro lado:** vista da rua, a parede de fora do lado oposto tem vidro escuro, porque o shader não chama a cidade de dentro dele mesmo. Num prédio estreito com janelas dos dois lados (comum nos de tijolo), seria bonito ver a rua de trás através da sala. Dá para fazer com um segundo raio barato, como o do reflexo (R.24). Proponho deixar para a etapa 20, se fizer falta. **(Usuário: fazer agora, na 13.10b2.)**
- **A sala do jogador acesa vista de fora:** se você acende uma sala (entrando nela) e sai, ela continua acesa para quem está na rua só enquanto você está naquele andar. Uma luz que fica acesa depois que você sai seria um rastro bom para a polícia notar (combina com o calor da F.2). **(Usuário: sim, mas só quando a polícia e as missões amadurecerem; etapa 16.)**

---

## 2026-10-04 (4): o plano da 13.10 e o retorno dos testes

- **Um só espaço é a arquitetura certa.** Hoje o shader tem dois desenhos do interior (o do andar do jogador e o visto pela janela), e cada recurso novo era feito num só deles: daí a porta que parece janela e as portas internas que somem de fora. Com uma função só, cada coisa nova aparece dos dois lados de graça. O risco é o desempenho: hoje a vista pela janela é barata de propósito. Vou medir antes e depois, e de longe fica um nível de detalhe barato.
- **Paredes com volume rendem um ganho de graça:** a janela ganha profundidade (o vão na parede), que hoje é chapada; de perto isso se lê muito bem em ASCII.
- **Os modelos de planta em texto** (uma grade de caracteres por modelo) podem ser desenhados por você ou pelo Gemini, com um briefing do formato: é uma tarefa boa para delegar, porque não depende do código.
- **Notícias dominadas por batidas:** além do limite por assunto, as batidas em si estão frequentes demais; as duas coisas juntas devem resolver. Pus o limite nas correções e a frequência na etapa 18.
- **Efeitos da surge:** ótima ideia, combina com o apagão que já existe e dá o "aviso" antes do corte. Pus na etapa 20; é pequeno e pode vir antes se você quiser.

---

## 2026-10-04 (3): respostas à fila de feedback

- **Interiores por módulo (Lego):** concordo, é a causa de quase todos os remendos. Sugestão: módulo de 2 m com a parede *dentro* do módulo (0,2 m), corredor de 1 módulo, e o prédio com largura e fundo arredondados para baixo a um múltiplo; a sobra do lote vira recuo, calçada mais larga ou pátio, em vez de esticar a sala. Assim a cidade não precisa ser gerada de novo e as salas modelo encaixam em qualquer andar. Faço a 13.11 antes da 13.10, como você permitiu.
- **Skin pela simulação:** ótima base para missões de "achar o contato". Cuidado com um detalhe: a 64×64 é pequena, então só os traços que se leem de longe valem (pele, cabelo, cor da roupa, óculos, barba); cor dos olhos é 1 pixel e só vale de perto. Proponho que a ficha do cidadão tenha esses campos e a *descrição* da missão use só os que aparecem.
- **Haiku para os ajustes:** não recomendo. O custo de cada chamada é quase todo reler o contexto do projeto, e isso o Haiku paga igual; ele erra mais num código grande. O agente `bugfix` (Sonnet) já existe; o ganho está em juntar a lista, como você disse.
- **Chuva volumétrica:** concordo, é o certo agora que a câmera é 3D. No shader dá para fazer barato: as gotas vivem numa grade 3D presa ao mundo (não à câmera), e cada raio atravessa só as poucas células perto do jogador. Limitar o ângulo seria um remendo que quebra com o FOV. Fica depois dos materiais, como pediu.
- **Menu Style/Sharpness:** boa limpeza. Só um aviso de nome: "Sharpness: Soft" (a fusão de longe) e a nitidez SOFT antiga do High Definition são coisas diferentes com o mesmo nome; como a antiga some do menu, não deve confundir.
- **Reunião no fim do limite:** boa regra. Vou olhar o uso e propor a conversa perto de 90% da janela de 5 h.
- **Batimentos no relógio:** combina com o mostrador de 2008 (os relógios de corrida já tinham). Sugiro que a barra pisque no ritmo do batimento.

---

## 2026-10-04 (2): respostas ao retorno do usuário

- **Segundo eixo do tom:** calmo ↔ pressionando, no lugar de engraçado ↔ sério. Pressão se mede bem por palavras (urgência, insistência, exclamações, maiúsculas) e é a alavanca clássica da engenharia social; o humor fica como a marca "Banter". Foi para a etapa 14.
- **Nomes diretos para o jogo** (termos técnicos que se entendem sem pensar): **BACKDOOR**, **WIRETAP**, **ROOT ACCESS**, **HARDLINE**, **DIAL TONE**, **BLACKOUT** (o mais direto, mas muito usado), **GRID DOWN**. Minha preferência: **BACKDOOR** (todo mundo entende, e no jogo também é literal: portas de serviço, armários, a porta dos fundos da loja) ou **WIRETAP** (2008, telefone, vigilância; é o que o jogador faz e o que fazem com ele).
- **Sons:** consigo fazer a análise por síntese sozinho: leio o arquivo em Python, comparo espectrogramas da referência e da minha receita, e ajusto por número sem ouvir. Não recomendo transcrever amostra por amostra: funciona, mas é um WAV disfarçado de texto (1 s em 22 kHz são ~60 KB) e foge da regra "tudo é código". Plano na etapa 21; vale um teste curto antes com o som de que você menos gosta.
- **Dividir o CLAUDE.md (feito agora):** a diferença é que o CLAUDE.md é carregado inteiro em toda mensagem, enquanto um arquivo à parte só custa quando é lido, e só a seção necessária. As lições foram para `docs/licoes.md` (índice no CLAUDE.md, leitura por `grep` do título e não por número de linha, que muda), o mapa de módulos para `docs/mapa.md`, e as opiniões antigas para o fim deste arquivo. O CLAUDE.md caiu de 953 para ~720 linhas.

---

## 2026-10-04: depois da etapa 13 (lojas, mochila, fome, placas, gente, pedir direção)

### A tooltip do texto livre

Ótima ideia, e eu concordo sem ressalva. É exatamente o que torna o texto livre jogável: o maior defeito do Façade era o jogador não saber o que o jogo tinha entendido. Mostrar a leitura **antes** de enviar transforma o parser num instrumento que o jogador aprende a tocar. Duas sugestões em cima dela:

- **Mostrar também as palavras que pesaram**, sublinhadas ou coloridas na própria caixa (ex.: *where* e *know* acesas). Ensina o léxico sem tutorial.
- **Mostrar o alvo reconhecido**: "Question about a place's location: **Kessler Deli**". Se o nome não bateu, aparece "place: ?" e o jogador corrige a grafia.
- **O tom como um medidor pequeno**, e não só como palavra, porque o tom é contínuo (grosseiro ↔ respeitoso), e um "please" a mais move a agulha na hora: é tátil, combina com o gosto por interfaces físicas.

### Nome do jogo

"Terminal City" funciona, mas é genérico (existem outras coisas com esse nome) e fala só do terminal, não da cidade em chamas nem do noir. Sugestões, em ordem de preferência:

1. **LINE NOISE**: o ruído na linha telefônica de 2008, o chiado do modem, e "ruído" é o que a cidade inteira é em ASCII. Também diz "hacking" sem dizer.
2. **THE SEAM**: a camada de carvão em chamas sob a cidade. O jogo já gera o nome da camada ("{r} Seam"). Curto, misterioso, e vira o título da história (o que está por baixo).
3. **DEAD AIR**: rádio e telefone em silêncio, a cidade sufocada pela fumaça. Noir.
4. **BACKHAUL**: o termo técnico das ligações entre as antenas e a central. Para quem conhece, é perfeito; para quem não conhece, soa bem.
5. **BROWNOUT**: o apagão parcial; liga com a rede elétrica, que é o primeiro grande sistema hackeável.

Eu ficaria com **LINE NOISE** ou **THE SEAM**. "Terminal City" pode continuar como o nome da cidade no slogan ("Line Noise: a night in Terminal City"), se você gostar dele.

### O nome do jogador

Minha sugestão mais forte: **o protagonista não tem nome dito; a cidade o chama pelo número da linha.** O contratante escreve "0179" (os últimos quatro dígitos do celular). Quando você troca de chip, você vira outra pessoa para o contratante e para a polícia. A identidade do jogador é o número que ele carrega, e trocá-la é uma jogada. É diegético, é 2008 e liga com o sistema de calor que já existe.

Depois disso, o **apelido** que a cidade dá quando você ganha fama (a "lenda urbana" das minhas sugestões de 2026-10-02): o Streetwire e as manchetes inventam um nome ("the Brownout Man", "Static"), e ele muda conforme o que você faz. O jogador nunca escolhe o próprio nome de herói; a cidade escolhe.

Se quiser um nome de verdade para o personagem (para o editor de personagem), deixe o jogador digitar, com a semente sugerindo um nome comum da cidade.

### A história (um fio autoral discreto)

As histórias emergentes continuam sendo o centro. Mas um mistério de fundo dá direção a quem quiser segui-lo. Minha proposta, usando o que já existe:

- **O fogo da camada não apaga porque alguém não quer.** Décadas atrás uma mina pegou fogo. A cidade evacuou a borda, o governo cercou a zona, e o terreno ficou sem valor.
- **O Sarcófago**, a cúpula inacabada com a torre de tiragem, foi vendido como a solução: conter o fogo e gerar energia com o calor. A empresa que o construía faliu no meio da obra.
- **A virada:** a telemetria do Sarcófago ainda transmite, e os sensores mostram que **os poços de ventilação foram reabertos depois da falência**. Alguém está **alimentando** o fogo. Quem lucra? Quem comprou barato os terrenos evacuados da borda, esperando o dia em que o fogo "apagar sozinho" e a área valer de novo. Ou quem vende energia do calor por fora, para a GRIDLINK.
- **Como o jogador descobre:** pelos próprios sistemas. Uma manchete antiga num site de notícias, um e-mail no servidor da empresa falida, o log da RTU de uma subestação que recebe energia de um lugar que não devia existir, a estação de números no rádio de ondas curtas lendo coordenadas dos poços. Nada é obrigatório.
- **Os finais possíveis** (pelos sistemas, não por cutscene): vazar tudo para o jornalista (manchetes, o Streetwire explode, a polícia muda de alvo); sabotar a ventilação (o fogo diminui, a zona encolhe, mas quem lucrava vai atrás de você); ou vender o que sabe ao próprio dono do esquema (dinheiro e calor zerado, e a cidade continua sufocando). É o noir: nenhuma saída limpa.

Isso dá sentido ao Sarcófago, à zona de fogo, ao cordão e à agência que monitora o gás, sem inventar sistemas novos.

### A megaestrutura

- **Que ela se faça ouvir antes de ser vista.** O vento passando pela treliça, um uivo grave e longo nas noites de vento, audível nos bairros da borda. É o tipo de som de que você gosta, e anuncia a escala.
- **Uma luz vermelha de aviação piscando no topo do guindaste mais alto**, visível de qualquer lugar da cidade como um ponto vermelho no horizonte, sem mostrar a estrutura. Do centro, você não vê o Sarcófago; vê uma luz piscando onde não há prédio nenhum. Dá curiosidade sem mexer na skyline.
- **O laranja por baixo das nuvens** na direção da borda, à noite, como a cidade iluminada de baixo. Já existe o fogo no horizonte; nuvens baixas tingidas de laranja daquele lado seriam a assinatura da cidade.
- **Fim de jogo: subir nela.** Uma noite de missão na treliça, com o vento, os guindastes parados e a cidade inteira lá embaixo em ASCII. Pela câmera 3D, seria a imagem do jogo.

### Coisas que eu mudaria ou reforçaria

- **Dar destino ao dinheiro e à fama**, de novo: o laço dos trabalhos existe, as lojas agora existem, e a mochila também. O próximo passo de maior valor é o que eu sugeri na fatia vertical: o SMS de balanço depois de cada trabalho (o que a cidade sabe de você) e trabalhos que se renovam com alvos novos e pagamento pela reputação. Com a etapa 13, o dinheiro já tem onde ir.
- **A bateria do celular criou a primeira escolha de verdade** com o Maps: usar o mapa gasta, pedir direção é de graça e às vezes erra. Isso é exatamente o "atrito que vira decisão". Vale levar a mesma ideia ao notebook (já tem bateria) e ao frio (etapa 22).
- **Pedir direção pode virar a porta da engenharia social.** As mesmas pessoas que respondem "two blocks north" podem, com o tom certo, dizer quem trabalha na loja, a que horas o técnico passa, se viram alguém de casaco perto da subestação. O texto livre com a tooltip é o caminho natural.
- **O mapa de papel e o guia da cidade** podem ter erros e desatualizações de propósito (uma loja que fechou, uma rua renomeada). É um charme de 2008 e faz o jogador confiar na rua.

### Técnico

- **O CLAUDE.md pesa ~55 mil tokens em toda mensagem** (ele é lido inteiro como memória). É a maior parte do custo fixo de cada conversa e acelera o fim do limite. Sugiro uma limpeza:
  - levar as "Lições da etapa N" para `docs/licoes.md`, lido só quando se trabalha naquele sistema;
  - levar as "Opiniões" antigas para este arquivo;
  - levar o mapa de módulos para `docs/mapa.md`.

  O CLAUDE.md ficaria com as regras, as decisões e o plano, talvez com um terço do tamanho. Isso sozinho deve render bem mais trabalho por limite. Posso fazer isso numa sessão curta, se você aprovar.
- **Testes sem o navegador.** Metade do custo das minhas sessões é dirigir o painel do navegador (capturas, esperar o carregamento, o laço parando). Uma pasta `tests/` com scripts que rodam a simulação no Node (comprar, pagar, furtar, a fome, a bateria, pedir direção, os trabalhos) deixaria a maior parte das verificações rápida e barata. O navegador ficaria só para o que é visual.
- **O shader dos objetos está crescendo** (placas, letreiros, rodas, telas, agora a skin). A lição desta etapa (um vetor indexado custou 5 ms) mostra que ele está perto do limite de registradores. Antes de muitos materiais novos, vale separar os materiais raros num segundo passe, ou ao menos medir a cada material.
- **O marco da demo**: os 8 storage buffers continuam sendo o maior risco de tela preta no PC de um amigo.

### Pequenas coisas que notei nesta etapa

- As placas pintadas ficam escuras de dia quando estão viradas contra o sol; é física, mas o olho espera ler a placa. Um "retrorrefletivo" leve (as placas de rua de verdade brilham um pouco) resolveria.
- O primeiro item da lista de cada prateleira aparece pouco no desenho.
- Os balconistas ainda não aparecem atrás do caixa; a loja "atende" sem ninguém visível. É a etapa 16, mas é o que mais quebra a ilusão hoje nas lojas.

---

## Histórico: opiniões de 2026-10-02 a 2026-10-04 (antes no CLAUDE.md)


> O usuário pediu opinião de verdade: criativa, de gameplay e de rumo, não só técnica. Esta seção é minha (do Claude), para ele considerar; nada aqui está decidido. Quando ele decidir algo, o item vai para "Decisões tomadas" ou para o Roteiro, e aqui fica marcado. Sessões futuras podem acrescentar opiniões, sempre datadas.

#### O que eu acho do rumo (2026-10-02)

- **A cidade está ficando impressionante, e o jogo ainda não existe.** Já temos trânsito com física, 100 mil pessoas com rotina, rede elétrica, telefonia, Wi-Fi, câmeras, rede social, notícias. O que ainda não existe é um motivo para o jogador fazer alguma coisa numa noite qualquer. Meu maior medo pelo projeto é virar um simulador lindo em que se passeia e não se joga. **A minha sugestão mais forte: antes de mais largura (web inteira, economia completa), fazer uma "fatia vertical" de uma noite de trabalho**, do começo ao fim, com o que já existe: alguém pede um serviço → o jogador investiga → vai até o lugar → invade → a cidade reage → ele é pago (ou pego). Tudo o que vier depois fica mais fácil de decidir quando essa noite for divertida.
- **O realismo é a identidade do jogo, mas atrito só é bom quando vira decisão.** A partida a frio do GPS, a franquia de dados, a bateria do notebook, sentar para usar: tudo ótimo **se** em algum momento o jogador tiver que escolher por causa disso (ir pelo Wi-Fi do café e ser visto, ou pelo 3G caro e lento; comprar um receptor GPS melhor). Atrito que nunca vira escolha vira só espera. Sugiro sempre perguntar, para cada limite realista: "qual escolha ele cria?" e, se nenhuma, deixá-lo leve.
- **A cidade tem as mesmas ferramentas que o jogador — use isso contra ele.** É a ideia que mais me empolga. Câmeras, logs de telefone, posts com foto, testemunhas, registros de acesso Wi-Fi: o jogador usa tudo isso para hackear; a polícia (e quem ele prejudicou) deveria usar exatamente os mesmos dados para chegar nele. Isso transforma a simulação inteira em jogabilidade sem inventar nada: apagar o log, evitar a câmera da esquina, ligar do orelhão em vez do celular, não postar perto do crime, trocar de Wi-Fi. É o Shadows of Doubt ao contrário: você é o caso.

#### Depois do port para a GPU (2026-10-03)

- **O raio por célula abre portas que o raycaster por coluna não abria; usar isso antes de mais conteúdo.** Reflexo de verdade no vidro e no asfalto molhado (um segundo raio pela mesma grade) é a coisa de maior impacto visual que existe agora pelo menor custo de código: a cidade noturna refletida na rua molhada é exatamente o clima noir/Blade Runner do jogo, e a chuva já existe.
- **Emissão separada antes de PBR.** Antes dos materiais, separar o que é luz (letreiros, janelas, postes, holofotes) do que é cor de superfície. Isso conserta as luzes de dia, deixa o neon estourar de noite (bloom barato: borrar só o canal de emissão) e é a base que o PBR vai precisar.
- **Uma tela de calibração de debug** (uma tecla que mostra uma tabela de cores de fachada sob dia, entardecer e noite lado a lado) economizaria muitas rodadas de "está cinza / está saturado" entre nós dois: a paleta passa a ser decidida olhando a tabela, e não andando pela cidade.

#### Sobre a reescrita da luz: "3D por baixo, ASCII por cima" (2026-10-03)

- **Concordo com a visão do usuário** (cena 3D fotorrealista por baixo, o ASCII como o último estágio). O projeto já está no meio do caminho (raio 3D por célula, emissão separada, materiais, reflexos); o que falta é **um só caminho de luz**: hoje a noite soma luz em sRGB sobre cores "pintadas para a noite" e o dia tenta desfazer isso para achar o albedo. Dois caminhos são a origem dos cinzas e da saturação errada.
- **A geometria não deve virar voxel** (as caixas, cilindros e peças analíticas são mais nítidas e mais baratas nesta resolução). **Os voxels servem para a luz:** uma grade grossa em volta do jogador guardando a luz é o jeito barato de ter iluminação global.
- **A vantagem do ASCII:** ~70 mil células contra ~2 milhões de pixels de um jogo em 1080p; dá para pagar por célula o que um jogo comum não paga.
- **O cuidado:** ruído vira glifo piscando. A iluminação global tem que ser estável (acumulada devagar na grade), nunca sorteada por célula a cada quadro.

#### Ao fechar a fatia vertical (2026-10-04)

- **O laço existe; agora falta ele ter memória.** Os três trabalhos funcionam, mas cada um termina e some: o dinheiro só compra crédito do celular e o calor só cai. Um laço vira jogo quando o que sobra de um trabalho muda o seguinte. **A sugestão mais forte desta vez: três compras que mudam o jeito de fazer os trabalhos**, vendidas em lojas que já existem (penhor, eletrônicos): um **chip pré-pago descartável** (troca o número: a linha que a polícia segue no topo da escada some; o calor do "caso federal" cai), uma **antena direcional** para o notebook (pegar o Wi-Fi de manutenção de mais longe, fora da câmera do cruzamento) e uma **bateria extra** do notebook. Cada uma responde à pergunta "qual escolha ela cria?" e dá destino ao dinheiro.
- **O jogador precisa ver o que deixou para trás.** O calor sobe por rastros, mas hoje ele só sente o resultado (a polícia chegando). Um **SMS do contratante depois do serviço** dizendo o que a cidade sabe ("a câmera da 5th com a 12th te pegou; não use esse número de novo") ensina o sistema de calor pela própria história, sem tutorial, e é barato (texto pela gramática, lendo os rastros que já existem).
- **Achar o alvo deveria ser também físico, não só pelo mapa.** A busca do Maps resolve (F.8), mas o melhor é a rua contar: a placa da concessionária no portão da subestação, a antena da GRIDLINK num poste com um LED piscando, o armário de semáforos com o adesivo de manutenção. Quem aprende a ler a rua acha alvos sem o mapa; é a progressão por conhecimento das sugestões de 2026-10-02.
- **Os trabalhos não podem se esgotar em três.** Conferir (Trilha de hacking) se o contratante oferece outro depois do terceiro; se não, o mais barato é repetir os três tipos com alvos novos e pagamento que sobe com a reputação (quantos trabalhos limpos seguidos).
- **Antes de crescer, mostrar a amigos.** Um teste com alguém que não conhece o jogo vale mais que qualquer opinião minha: mostra onde a pessoa trava no primeiro minuto (o celular? o notebook? achar onde sentar?). Para isso faltam poucas coisas e quase todas técnicas (veja a Sessão G). *(O usuário adiou isso em 2026-10-04: quer mais missões antes.)*

#### Opiniões técnicas e visuais (2026-10-04)

- **O maior risco para o teste com amigos é o WebGPU com 16 storage buffers.** O mínimo garantido é 8; num notebook com placa integrada fraca, a tela fica preta sem aviso. Juntar buffers até caber em 8 é trabalho chato mas mecânico (as quatro listas de luzes dinâmicas num buffer só, `subs` com `lampCol`, mais coisas no `fx`); no mínimo, um aviso claro com o limite do adaptador.
- **O salvamento precisa saber de que código veio.** O cache da população já tem um hash do código que a gera (`popCache.ts`); o save deveria guardar o mesmo hash e avisar ("este save é de uma versão anterior; a cidade pode ter mudado") em vez de carregar índices que não batem. É pequeno e evita bugs fantasmas que vão parecer do jogo.
- **Uma regra para as interfaces** (anotada nas decisões): todo efeito de luz das telas (halo, reflexo, bloom) passa no fim do compositor e **tinge** o que é claro em vez de só somar. O relógio foi o terceiro aparelho com o mesmo problema; vale para o que vier (o rádio, o tocador de música).
- **Visual:** o próximo ganho grande barato continua sendo de luz (a tela do celular estourando, a marquise sem emissão, o apagão claro demais, L.11). Eu faria esses retoques junto da Sessão G, porque é o que o amigo vê no primeiro minuto à noite.

#### Sugestões de jogabilidade

- **Trabalhos que nascem da simulação (o laço principal).** Um "contratante" (fixer) que liga para o orelhão ou manda SMS de número desconhecido, e mais tarde um fórum na web. Os pedidos saem do que existe: o dono de um bar quer o concorrente sem luz na sexta à noite; uma seguradora quer saber se um cidadão foi mesmo ao trabalho no dia do acidente (os dados de câmera e de antena dizem); alguém quer apagar uma multa; um jornalista quer a telemetria do Sarcófago. Pagamento em dinheiro do jogo → hardware melhor (notebook, antena direcional, celular com Wi-Fi melhor, receptor GPS) → alvos mais difíceis.
- **Calor (heat) e investigação.** Cada ação deixa rastros na simulação (log no roteador, você numa câmera, sua linha na antena, uma testemunha que postou). Um detetive/NPC da polícia junta os rastros com o tempo; a investigação aparece nas notícias e no Streetwire ("polícia procura homem de casaco perto da subestação"). O jogador vê o cerco se fechar pelos mesmos canais que usa.
- **A lenda urbana.** Se o jogador causa apagões repetidos, a cidade lhe dá um apelido no Streetwire e nas manchetes ("o Fantasma da Rede"), teorias, posts de fãs e de quem odeia. É feedback diegético de "reputação" e de graça para quem gosta de ver as consequências.
- **Conhecimento como progressão (estilo Hacknet/Outer Wilds).** Mais do que upgrades, o jogador progride por saber coisas: o código secreto do celular achado numa oficina, a senha num post-it de um escritório, a chave do Wi-Fi escrita no quadro do café, o horário em que o técnico loga. Um **mural de pistas** no apartamento (ou no notebook) para ligar fatos ajudaria muito.
- **Coisas físicas de 2008 que são ótimas de jogar:** fuçar o lixo atrás de um prédio (recibos, papéis com senhas); grampear um orelhão; ligar para um ramal e enganar a recepcionista (engenharia social com escolhas de fala, pelo sistema de diálogo da 13c); um cartão de crachá clonado; a impressora de rede de um escritório imprimindo coisas.
- **O apagão como ferramenta, não só como espetáculo.** Sem luz, as câmeras com bateria duram pouco, as portas magnéticas abrem (ou trancam, pelo modelo), o trânsito para, as testemunhas olham para o céu. Planejar um serviço em volta de um apagão programado deveria ser uma das jogadas mais satisfatórias do jogo.
- **Um mistério de fundo, pouco e bom.** As histórias emergentes carregam o jogo, mas um fio autoral discreto dá direção: o Sarcófago parado, a empresa que o construía, a agência da zona de fogo, a telemetria que ainda transmite. Pistas espalhadas nos sistemas (e-mails, manchetes antigas, logs) para quem quiser seguir, sem obrigar.
- **Uma estação de números** (rádio de ondas curtas lendo números à noite) é perfeita para o tom noir de 2008 e pode ser a porta do mistério.
- **O apartamento do jogador como base:** onde ele dorme (pular o tempo), carrega tudo, guarda hardware, e onde o mural de pistas fica. Um lugar que vai ficando "dele".

#### Sugestões de rumo e ordem

- Depois do grupo B: **a fatia vertical de uma noite** (um contrato, investigação, invasão, reação, pagamento ou calor), antes da web completa e da economia completa. Ela vai mostrar quais partes da web e da economia são necessárias primeiro.
- **Salvar o jogo cedo.** Hoje nada persiste. O plano "semente + mudanças" está nas decisões; quanto antes existir, mais barato (cada sistema novo já nasce salvável).
- **Lugares com tipo de verdade** (o pedido do usuário sobre o Maps): concordo que é fundação. Um catálogo pequeno de tipos de lugar com interior coerente vale mais que muitos tipos sem interior.
- **Ritmo do tempo:** acho que o dia de 2 h está bom para jogar; com trabalhos, a noite vira o "turno" do jogador, e pular o dia dormindo resolve o resto.

#### Opiniões técnicas (o usuário liberou em 2026-10-02: podem ser numerosas e longas, é onde o Claude mais ajuda)

- O render em workers aguentou bem o crescimento; o próximo gargalo é a simulação no thread principal (carros: ~1,9 ms por 1000 carros por passo). Se a cidade crescer, a simulação de trânsito é a primeira candidata a ir para um worker.
- Um **console de debug** dentro do jogo (teletransporte para um lugar, ver um cidadão, forçar um evento) economizaria muito tempo de teste dos dois lados.

#### Sobre assinar o ChatGPT para código (pergunta do usuário em 2026-10-03; ele decidiu não assinar)

- **Onde ajudaria de verdade:** bugs pequenos e bem cercados (a lista de correções, que hoje vai para o Sonnet), scripts de conferência (validar JSON, contar combinações da gramática), e segunda opinião em planos. Com um briefing curto (o bug, os arquivos, como testar) ele resolve bem coisas desse tamanho.
- **Onde eu não delegaria:** o shader do mundo, a luz e tudo o que é identidade visual (dependem de muito contexto acumulado e de olhar o resultado), e mudanças que cruzam vários sistemas. O custo escondido é o contexto: o projeto tem convenções fortes (simulação sem render, semente, gramática para todo texto, "Lições da etapa N") que ele não conhece; o diff dele precisa de revisão, e uma revisão minha custa menos que um conserto meu, mas não é de graça.
- **O hacking:** a OpenAI também tem filtros para cibersegurança; para um jogo fictício provavelmente passa, mas não dá para garantir, e o Opus 4.8 já resolve sem bloqueio. Não trocaria o que funciona.
- **Regras se ele entrar:** um agente por vez no repositório, sempre a partir de um commit limpo; ele lê um `AGENTS.md` curto que aponta para as seções certas do CLAUDE.md (não o documento inteiro); eu reviso o diff antes do commit.
- **Recomendação:** antes de assinar, testar o grátis com um bug da lista de correções (por exemplo, a ligação atendida pelo mouse) e ver o diff. Se vier limpo, vale a assinatura sobretudo como substituto da fila do Sonnet.
