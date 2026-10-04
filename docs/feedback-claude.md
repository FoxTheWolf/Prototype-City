# Feedback do Claude

> O feedback do Claude sobre o jogo: técnico, de jogabilidade, criativo e temático. Datado, o mais novo em cima. Nada aqui está decidido: quando o usuário decidir algo, vai para o CLAUDE.md (Decisões ou Plano) e fica marcado aqui. Tudo o que entra aqui também é mandado no chat. O feedback antigo (até 2026-10-04) está na seção "Opiniões e sugestões do Claude" do CLAUDE.md.

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
