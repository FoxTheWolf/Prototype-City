# Visão do jogo (entrevista com o usuário, 2026-10-04)

> Respostas do usuário na reunião + entrevista. É a base para planejar; ler ao começar uma etapa nova. As decisões curtas também estão no CLAUDE.md.
>
> **Atenção (2026-10-08):** a numeração das etapas aqui é a antiga, e várias decisões foram revistas na "Entrevista do cronograma" (no fim deste arquivo): polícia e calor depois da 1.0, os canais fórum/Reynard/SMS, um sistema só para veículo, física, roupa e vozes. Em caso de conflito, vale o fim do arquivo e o `docs/cronograma.md`.

## O que é a 1.0
- **Um mundo vivo que existe sem o jogador** (por isso o modo CCTV): as pessoas trabalham, ganham dinheiro e vivem. O jogador é **mais uma pessoa comum** nesse mundo. Faz quase tudo o que um NPC faz (dormir, trabalhar, comer, comprar, andar de carro, talvez lazer e minigames). O que o diferencia é **saber hackear e ter contatos**.
- **A sandbox de consequências é o coração.** O laço de trabalhos dá a estrutura, mas o que se quer provocar é a curiosidade do "e se eu…?" (seguir um NPC o dia todo e mexer na conta dele; derrubar as ações de uma empresa). O "Minecraft" da simulação social.
- **A origem:** Else Heart.Break() (tudo conectado, consequências) + Shadows of Doubt (cidade realmente simulada), que nunca se juntaram; o ASCII City juntou isso à estética do netrunning, da internet dos anos 90 e de Matrix.
- **2008 é mecânica, não só nostalgia:** as limitações (bateria, plano de dados, lentidão, o chip descartável que zera calor e reputação) criam decisões e planejamento. Regra: a lentidão sempre tem que gerar uma escolha, nunca ser só espera.

## Princípio: profundidade só onde o jogador percebe
Só se simula fundo o que o jogador **percebe, toca, ou que alimenta a curiosidade dele (ou uma missão)**. Um mercado completo só vale se a consequência aparece no mundo de um jeito notável (manchete, loja que fecha, NPC reclamando). Senão, uma versão rasa. É o segundo filtro do planejamento, junto do "alimenta o laço?".

## A história: no estilo Noita
- **De fundo, opcional, descoberta organicamente.** Sem cutscenes, sem empurrar. O jogo não tem fim obrigatório: é uma simulação eterna. Quem se interessa puxa o fio até o fim (talvez no Sarcófago).
- **O gancho tem que ser garantido, não sutil** (o jogador não é Sherlock Holmes; com 100 mil pessoas e milhares de prédios, uma anomalia escondida nunca é achada). **O gancho é a primeira quest:** o contratante comenta de passagem algo estranho que viu. O resto (posts, notícias, anomalias nos dados) é **confirmação** para quem foi atrás, não a porta de entrada.

## Os trabalhos
- **Lado legítimo: TI** (consertar modem, resolver conexão, montar a rede de um prédio, na linha do Tower Networking Inc). Paga pouco, é seguro, ensina as ferramentas.
- **Lado hacking:** paga bem mais e dá o equipamento melhor. O jogador é empurrado um pouco, mas a ideia é que, depois de sentir o poder de influenciar, ele mesmo vá atrás.
- **A ponte é orgânica:** um cliente satisfeito de TI vira o primeiro contato do outro lado.
- **Os trabalhos se acham no mundo** (fóruns, conversas, indicações), como no Shadows of Doubt, sem menu de missões.
- **Ordem de construção:** o hacking veio primeiro porque é só mudar um estado que já existe. A TI precisa de **computadores e modems físicos, ligados entre si, com telas de login e configuração e defeitos**: é a base comum dos dois lados e o foco da **próxima sessão da Trilha de hacking**.

## O começo do jogo
- O jogador **acabou de chegar à cidade**, num **quarto de motel** com poucos dias pagos, o notebook, um celular barato e pouco dinheiro (pressão suave: despejo, nunca game over).
- **O primeiro SMS é do cliente de TI**, o mentor que depois apresenta o hacking. O começo é mais guiado que o resto.
- **Pulável:** nada que a primeira quest ensina fica trancado por ela; quem já conhece o jogo vai direto.
- **A corrente da primeira hora (detalhada pelo usuário em 2026-10-05):** (1) o motel cobra a próxima noite: pouco dinheiro e a diária vencendo; (2) **o trabalho de TI já está aceito** (o SMS é a lembrança do compromisso), e é o caminho natural de quem não tem dinheiro; ensina o básico de redes; (3) o cliente de TI **pede um favor** que já é hacking, de forma direta (não espionando e-mail); (4) cumprido o favor, ele passa **o contato de um fixer** ou de um fórum, e **entrega em mão um pendrive** com os primeiros programas e o `start-here` (diegético: o equipamento vem de alguém); (5) **o fixer testa o jogador** com trabalhos pequenos; (6) com reputação (presa ao número), o jogador passa a achar trabalhos sozinho na web. O cliente de TI e o fixer também falam dos sites que ajudam (o fórum de tutoriais). **Atualizado em 2026-10-05:** o cliente é o dono de um cybercafé e entre ele e os fixers entra um **mentor** (veja "O teste das duas camadas, aplicado").
- **O veterano pula pelo mundo, não por um menu (sugestão do Claude):** o fórum e os sites existem desde o começo; quem já conhece o endereço vai direto e pega trabalho sem o favor. O caminho guiado é só o mais provável, nunca o único.

## Dificuldade
- **Realismo no nível do Hacknet, sem modo fácil nem comandos simplificados.** A ajuda ao iniciante vem de explicar melhor os conceitos e de qualidade de vida no terminal (ex.: clicar num IP o cola na linha de comando). Isso vem depois do hacking realista existir.

## Moral e violência (regra global, não caso a caso)
- **Nada de violência explícita; nunca mencionar feridos ou mortos.** Sem atropelamento (os carros freiam de forma progressiva). Batidas viram notícia sem vítimas.
- **Dilemas pesados se resolvem pelo mundo:** o hospital, se existir, tem gerador próprio fora da rede (sem acesso); um site com registros médicos basta.
- **O jogador é livre dentro disso;** o jogo não dá sermão. A reação da cidade é mecânica e implícita (calor, polícia, notícias, raiva no Streetwire).

## A web (etapa 15)
- **Foco em ler a vida das pessoas** (e-mail, mensagens, registros, perfis): é o tipo novo de hack que só a web abre (OSINT, senhas). Mexer na cidade já funciona fora da web, pelos acessos físicos. A web alimenta o diálogo (fingir ser alguém com o que se leu).

## Ordem das etapas
- **O diálogo (14) antes da web (15):** com o diálogo completo, a web se integra a ele.

## Esperar o tempo passar
- **Esperar acelera a simulação de verdade** (num banco, num café, no motel), parando sozinha quando algo diz respeito ao jogador (SMS, calor subindo, alguém se aproximando, a janela de um trabalho abrindo). Pular o tempo sem simular (como o T) invalida o calor, então não serve.
- **Primeiro passo:** medir no Node quantas vezes mais rápido a simulação aguenta (60× faria uma hora de jogo em um minuto real). Se não aguentar, apoiar-se no nível de detalhe longe do jogador.
- O tamanho do dia (hoje 2 h reais, `DAY_REAL_MIN`) é revisto depois disso; o Claude traz propostas.

## Dirigir
- **Decidir no rework de carros e transporte (etapa 18)** se entra antes ou depois da 1.0. As peças já convergem: a câmera no carro vem do táxi, a física do trânsito perto do jogador, o estacionamento dos carros ligados aos NPCs, as fotos do Streetwire. **Multas por foto da placa** (radar) também são alvo de hacking. Dá mais um destino ao dinheiro e combate o tédio do transporte público.

## Visual
- **O dia tem que ser tão bonito quanto a noite** (a noite veio primeiro só pela influência do ASCII City). O Claude sugere melhorias de luz e clima para o dia.
- A leitura do usuário: o jogo, mesmo em ASCII, lembra **PSX**, e as capturas viram "papel de parede antigo". O pôr do sol e as nuvens são o ponto alto.
- **O ASCII City é só referência visual e de clima** (já foi superado). A base de cidade e transporte é a **Liberty City do GTA IV** → o monotrilho vira **metrô com trem elevado**.
- **O Sarcófago e o lado de fora estão em aberto** (o usuário duvida: a megaestrutura contrasta com 2008). Revisitar depois; hoje é só uma barreira. A luz de aviação sai da lista até lá.

## Pessoas
- **O jogador aparece antes da 1.0, no mesmo modelo dos NPCs** (sem importar skins: a roupa pintada da skin brigaria com o disfarce); aparência pelo criador dentro do jogo; o rework dos NPCs vem antes.
- **Disfarce:** a roupa é dado (testemunhas e câmeras guardam a descrição); trocar de roupa confunde quem não conhece bem o jogador. O nome e o rosto ficam guardados separados do número: com chip novo, "Who are you?" → o nome → "Oh, it's you!".
- **Os NPCs ganham um formato próprio**, mais próximo de gente real (ainda em bloco), com proporções variáveis (altos, baixos, braços longos/curtos).

## A demo
- Para amigos que querem ajudar, com pouca experiência em hacking (o que tem é o do PC mais modesto). O primeiro contato precisa se explicar sozinho.
- **Desempenho na hora da demo:** um perfil leve separado (menos materiais e efeitos), preservando a versão completa. Os 8 storage buffers não são preocupação até lá.

## Nome
- **GRID DOWN é o favorito, mas fica em aberto** (falta a análise legal e a identidade do logo).
- **Reforçado em 2026-10-05:** GRID DOWN é o favorito para a busca de marca e os conceitos de logo. O nome aproveita o ponto fixo do jogo, a GridLink (o usuário não quer "GridLink" como nome, por lembrar de "Mmap"/"amp link"): "grid" é a rede elétrica, a grade da cidade e a GridLink; "down" é o apagão geral. Já existem obras com esse nome (romances de sobrevivência): conferir antes de fixar; um subtítulo pode diferenciar. Alternativas dadas: SODIUM GRID, DEAD GRID, GRIDFALL.
- **Tarefas:** a busca de marca e uns conceitos de logo (em código, sem arquivo de imagem no jogo).
- **Busca de marca (2026-10-06, Claude + retorno 10 do Gemini):** nenhum jogo nem registro "GRID DOWN" para software de jogo achado; existem filmes/documentários de sobrevivência e um jogo de mesa com o nome. **O risco real é a série GRID da Codemasters/EA** (corrida; "GRID" é marca registrada para jogos): gênero diferente, mas a palavra é a mesma. Para uso próprio, nada impede; **se um dia for vendido, consultar um advogado** (já é a regra para as pessoas em bloco). Subtítulos sugeridos pelo Gemini: *Low Voltage*, *Blackout '08*, *Dial Tone*. **Decidido pelo usuário (2026-10-06): GRID DOWN com subtítulo** (qual, a escolher); **pichação: spray à mão + risco** (LINK riscado com escorrido, DOWN em letras de bloco). Logo e cores: o usuário escolhe pela matriz `docs/identidade/logos-matriz.html` (4 direções × 3 paletas). **Ideia do usuário depois da matriz (2026-10-06):** o corporativo em duas linhas, GRID em cima e LINK embaixo, com o L sob o I e os dois ligados (setas/linhas); no logo do jogo, "OWN" pichado logo depois do D (o D é de GRID e de DOWN) e o LINK riscado com rabiscos. Variações em `docs/identidade/logos-v2.html` (4 ligações × 3 paletas). **Subtítulo:** quer "Terminal" nele (eco de Terminal City, o nome do protótipo): Terminal State, Terminal City… a escolher. **Fechado (2026-10-06): GRID DOWN: TERMINAL STATE**; logo = a haste contínua (o I desce e vira o L, juntas finas, o quadradinho no meio), GRID em azul-marinho `#1d3a6e`, LINK em teal `#0d6f6e`, o quadradinho e POWER · TELECOM em ciano `#3aa6d8`, linhas mais juntas; spray laranja `#ff6a13` (vermelho como alternativa). Página: `docs/identidade/logo.html`.

## Como trabalhar (mudanças da entrevista)
- **Mais sugestões e mais discordância:** o Claude contesta direto quando acha que algo não vale, explicando por quê (a fatia vertical foi um exemplo de contestação que salvou o projeto).
- **Grupos são relatórios de estado, não portões de teste:** seguir sem esperar aprovação; o usuário testa quando quiser, com mais coisa de uma vez, e deixa o retorno na caixa do CLAUDE.md.
- **Chats:** continuar no mesmo enquanto valer em contexto e limite; o Claude avisa quando não valer (não há regra fixa por etapa).
- **Toda captura passa por uma olhada de 5 s em busca de algo errado fora da tarefa:** não consertar, mas dizer numa linha e anotar em "Bugs conhecidos".
- **Delegar mais às outras IAs** o que é trabalhoso e sem código.
- **Prioridade dos problemas:** o feio pesa um pouco mais que o sem sentido; o desempenho está bom.
- **Preocupações do usuário:** a beleza dos interiores novos e do carro por dentro (começar a 18 com 2–3 referências escolhidas por ele, um esboço do painel e do banco, e só depois o resto; Blockbench como plano B) e os sons (análise por síntese, testada cedo com o pior som).
- **O que o usuário mais gostou:** o visual (pôr do sol, nuvens), o terminal Unix e a BIOS, os apps, o clima aconchegante de se proteger da chuva, o celular, o relógio, as skins.

## Continuação da conversa (2026-10-04)

### O caderno do jogador
- **Acessório diegético com interface 2D como a do relógio** (aberto junto dele), letra cursiva mas legível, **digitado pelo teclado** (só mouse limitaria demais; o mouse pode rabiscar/sublinhar se valer).
- **Clicar para copiar:** um nome, número ou IP em qualquer tela (SMS, Streetwire, terminal) vai para o caderno.
- **Afetado pelo escuro como o relógio.** Resolve o T9 do celular (ruim de propósito) e anotar senhas. Semente do mural de pistas (etapa 22).

### Stealth e luz
- **Em aberto, mas o Claude recomenda:** um medidor de exposição (como Thief) lendo a luz no lugar do jogador; a polícia acha mais fácil no claro. **As próprias luzes entregam o jogador** (tela do celular, luz do relógio, o celular tocando com uma ligação por engano). Depende da polícia sair dos trilhos (etapa 16).

### Sem trilhos (pedestres e carros)
- **A cidade muda devagar, puxada pela reação:** o fundo muda pouco (lojas fecham e abrem, pessoas se mudam); as mudanças grandes vêm das consequências do jogador. O save guarda só o que mudou em relação à semente (kilobytes). Empurrar a simulação até achar um limite real (como a população, de 20 para 100 mil).
- **Pedestres com objetivo:** um destino ("ir até a batida e fotografar para o Streetwire") e uma área caminhável com custos (calçada barata, rua cara mas permitida, praças), com desvio local entre todos; só perto do jogador. **É a fundação da etapa 16** (curiosos, polícia procurando, stealth): começar a 16 por ela.
- **Carros que decidem:** dar ré, contornar uma batida ou um carro parado, desviar do jogador no meio da rua (como o Cyberpunk depois do rework). Vai para o rework de carros (18), junto da freada progressiva.

### Prisão
- **Nunca apreender o notebook** (softlock: sem ele não há como ganhar dinheiro sem tédio). O custo da prisão é decidido no rework do calor e da polícia.

### Lazer (prioridade baixa, só por diversão)
- Fliperama com jogos em ASCII, sinuca e dardos no bar (depois que os interiores estiverem bons), jogos no celular, rádio. O bartender que conta o que sabe vem do diálogo (14). Sem medidor de estresse.
- **Cinema (depois da 1.0):** exibir um `.mp4` do jogador em ASCII (arquivo do jogador, como a pasta de músicas; não quebra "tudo é código").

### Princípio central: orgânico (o explícito guia, nunca governa)
- **Relações implícitas:** sem barra de amizade ou romance. O jogo **lembra** como o jogador trata cada pessoa (valores escondidos) e mostra pelas ações dela: cumprimenta, puxa conversa, manda SMS à toa, faz favores; ou evita, denuncia, expõe no Streetwire. O apego a um NPC deve surgir como nos Let's Plays: por uma situação, não por recompensa.
- **Como fica no código:** uma memória esparsa só dos NPCs com quem o jogador interagiu (afinidade, confiança, rancor, última vez que o viu, o que sabe dele: o rosto, o número). Trocar de chip também o apaga da agenda dessas pessoas. Nasce com o diálogo (14), que a alimenta e a lê.

### Clima sem estações fixas
- **O clima segue a temperatura do dia, não a estação** (uma noite fria pode nevar e o dia seguinte ter sol; dias quentes têm cara de verão). Os elementos de estação viram efeitos do clima do dia (neve nas bordas depois de nevar, névoa de calor, folhas depois de ventania).
- **Viés leve do calendário, nunca trava:** começar em dezembro dá neve de vez em quando, não todo dia (calibrar por número, ex.: até 1 em 4 nas noites frias de dezembro; conferir rodando um mês no Node). Talvez uma opção de novo jogo para desligar a neve.
- **Ideias de dia bonito (liberdade ao Claude):** neblina de manhã com raios de sol, asfalto molhado refletindo o céu claro, rastros de avião e pombos, fumaça das chaminés pegando a luz, sombras longas na hora dourada e o *Manhattanhenge* (o sol alinhado com a grade em certos dias; os NPCs fotografam).

### Lua e estrelas reais de 2008
- **Fazer logo, num lote de correções rápidas:** a posição da lua pelo algoritmo de baixa precisão de Meeus (latitude ~40° N) e as ~300 estrelas mais brilhantes numa tabela. Resolve o bug da lua que se esconde.

### Ritmo dos trabalhos
- **Misto e adaptativo:** guiado no começo, depois natural (fórum, indicações); se o jogador anda parado no hacking, um contato manda um SMS empurrando, no máximo um por dia de jogo (Trilha de hacking: a máquina de trabalhos mora lá).

### Segundo princípio: side grades, não upgrades
- Quase tudo é **um jeito diferente de fazer a mesma coisa, com prós e contras** (como o celular contra pedir direções). Acessórios que mudam como se joga, com manias (falham, gastam bateria, precisam ser usados do jeito certo).
- **Hardware diegético:** comprar RAM = virar o notebook, abrir a tampinha, trocar o pente. **Montar PC** (à la PC Building Simulator) como lazer para quem gosta; **PC pronto** para quem não gosta.
- **O esconderijo** com servidor próprio (acessado de fora), o computador do motel/apartamento; acessórios para o notebook, o celular e avulsos; o carro como compra grande (se vier).
- **Dois caminhos até um alvo:** chegar perto (fisicamente ou com antena direcional: rápido, expõe o corpo) ou pela rede até ele (lento, mais seguro para o corpo, mais logs). Detalhes na Trilha de hacking.
- **Invariante da rede, como a das plantas:** um teste em `tests/` garante que todo alvo tem uma porta de entrada e um caminho até ele.

### O nome da cidade (decidido em 2026-10-05: pela semente)
- O usuário vê benefícios nos dois lados; **a história não deve pesar nessa decisão** (é tempero, não o prato: o objetivo é o jogo que ele quer jogar).
- **Ideia do usuário:** o nome sorteado pela semente, às vezes um **easter egg de homenagem** (ex.: "Uplink City"), como os agradecimentos. **Decidido em 2026-10-05:** o nome sai da semente, com raras homenagens.

### O ano no jogo e o que é a 1.0 (conversa de 2026-10-05)
- **A 1.0 é a primeira versão completa, não o jogo acabado.** Depois vêm atualizações grandes, como o X4: Foundations (que já está na 6.0 ou 7.0). A demo para amigos não tem data: o usuário avisa quando considerar que chegou na 1.0.
- **O jogo não fica preso a um ano.** Contra-argumento do usuário: o GTA IV pode ignorar o ano porque só usa os dias da semana; aqui as datas importam (estações, lua, eclipses). A época (por volta de 2008) e o lugar (latitude de Nova York) são **pontos de referência, não regras**: dá para usar algo de 2009, ou o céu de outro ano que tenha eclipse lunar e solar.
- **Decidido (2026-10-05): um 2008 alternativo, explícito.** O ano aparece onde for natural (documentos, extratos, notícias), o tempo corre e o calendário vira para 2009; um ano do jogo leva ~290 h reais, então quase ninguém sai de 2008. A idade se lê pela data de nascimento, como na vida real. Ideia para depois da 1.0: a linha do tempo alternativa anda sozinha, com as empresas da simulação lançando aparelhos e serviços fictícios. O céu de 2008 continua; um eclipse solar visível pode ser emprestado de outro ano ou ganho mudando a latitude.
- *(Proposta anterior, descartada: o ano nunca aparece na tela (relógio, celular, notícias: dia da semana, dia e mês); por dentro, o céu segue as efemérides reais a partir de uma data inicial escolhida, sem salto na virada do ano, com a tecnologia e as manchetes paradas "por volta de 2008". A dificuldade são os documentos (data de nascimento, extrato do banco, "desde 1987"): mostrar a idade em vez da data de nascimento e datas sem ano onde der.)*

### A borda nova e o caderno (conversa de 2026-10-05)
- **Por que existia o Sarcófago (o usuário):** juntar megaestruturas a uma barreira natural, menos chata que uma ilha no oceano ou uma parede invisível. Ele destoava de 2008.
- **Decidido:** cada lado da cidade com uma barreira diferente. Escolhidos: uma **represa** colossal (comportas como alvo de hacking: abrir o vertedouro alaga as ruas baixas, sem vítimas) e um **pátio ferroviário e porto** (contêineres, guindastes pórticos). Os outros dois lados ficam em aberto (sugestões que não foram escolhidas: rio com pontes levadiças, escarpa com pedreira e túnel da ferrovia).
- **Atualização no fim da conversa: por enquanto, só mar** no lugar da zona de fogo e do Sarcófago; a represa e o porto ficam como ideias para depois, e a história fica de lado até uma etapa própria.
- **A zona de fogo sai do jogo**, com o cordão, o medidor de CO e o Sarcófago; a história de fundo do fogo que alguém alimenta cai junto e vai ser refeita (talvez em torno da represa ou do porto). O código atual fica até a etapa 20.
- **Texto antigo da decisão (2026-09-30):** a cidade ao lado de uma bacia de carvão em chamas (inspirada em Centralia), faixa abandonada com fumaça e crateras, medidor de CO, cordão com cerca, torres, holofotes e patrulhas; fendas laranja e colunas de fumaça no horizonte; sensores de gás, câmeras, rádio e listas de autorização como alvos.
- **O caderno:** só o jogador escreve (digitado ou copiado com um clique); o jogo nunca anota pistas sozinho.
- **Praia (2026-10-05):** a borda é uma praia de contorno natural, fora da grade, que vai ficando funda.
- **Lição do Sarcófago (retorno do usuário):** de tão longe, não parecia uma megaestrutura; não dava megalofobia, em parte por faltarem detalhes pequenos que dessem referência de tamanho (e, daquela distância, nem eles apareceriam). Megaestruturas futuras precisam ficar perto o bastante e ter detalhes em escala humana (escadas, janelas, guarda-corpos, luzes de aviso). Antes de desligá-lo, o usuário quer vê-lo de perto; o código fica guardado para uma possível expansão.
- **A praia vira lugar (2026-10-05):** calçadão de madeira com quiosques e um píer com farol (o parque de diversões ficou de fora por enquanto).

### O tamanho da 1.0 (conversa de 2026-10-05)
- **Decidido: completa em profundidade, não em largura.** O laço mínimo inteiro e polido, cada sistema que entra completo (sem "aperte 1" provisório), mas largura contida: poucos tipos de trabalho bem feitos, alguns distritos, os sistemas que o hacking usa. A largura vem nas atualizações, como no X4.
- **Dirigir entra na 1.0**, no fim da etapa 18: a física já existe, o interior do carro vem com o táxi, o estacionamento e a placa com os carros dos cidadãos. As multas por radar ficam para depois, como alvo de hacking.
- **Eclipse solar total** emprestado de outro ano, no 2008 do jogo.
- **O Sarcófago visto de perto (`ver-sarcofago.bat`, 2026-10-05):** de perto ele parece um morro de areia, não aço: placas planas grandes em retalhos marrom e cinza, sem nervuras nem vãos, os guindastes viram um palito, a fumaça são retângulos de borda dura, e de noite a cúpula toda fica laranja por igual. Ele foi desenhado como silhueta distante; se voltar numa expansão, precisa ser refeito (nervuras de aço, painéis faltando com o fogo atrás, escadas, passarelas e luzes de aviso para dar escala).
- **O mar (decidido em 2026-10-05):** o jogador entra andando, a câmera desce, fica lento, e para quando a água chega no peito (sem nadar). Entrar fundo com o celular no bolso o desliga até secar (o relógio é WATER RESIST); o notebook não molha. De noite: quase preto, com o reflexo da lua, do farol e do calçadão tremendo nas ondas, espuma clara na arrebentação, luzes de navios parados no horizonte e, em algumas noites, neblina vindo do mar engolindo o píer e o farol.
- **Costa num lado só (2026-10-05):** mar nos quatro lados faria uma ilha (o que o usuário acha chato); por enquanto, a praia fica num lado e os outros três ficam provisórios, sem a zona de fogo, até decidirmos (ideias: represa, porto, subúrbio sumindo na neblina com a rodovia e uma barreira).

### O diálogo (etapa 14; conversa de 2026-10-05)
- **Onde aparece a fala:** os dois. Na conversa de verdade, uma legenda embaixo que vai aparecendo aos poucos, com o nome de quem fala e as opções ou a caixa de texto logo abaixo (funciona também ao telefone). Na rua, balões ASCII curtos sobre a cabeça de quem passa e comenta.
- **O tempo não para** durante a conversa, como no celular: digitar devagar tem custo, o que dá tensão à engenharia social.
- **Os NPCs lembram o essencial**, pelo princípio orgânico (o implícito governa, o explícito guia): cada cidadão com quem o jogador falou guarda pouco no save (se ele foi grosso, mentiu e foi pego, disse um nome, quando foi) e reage depois ("you again"), sem barra nem número à mostra.
- **Voz:** um murmúrio sintetizado por sílaba enquanto o texto aparece, chiptune, com tom e ritmo pela idade, pelo gênero e pelo humor de quem fala (como Animal Crossing ou Undertale); tudo código.
- **O NPC encerra pela vida dele:** quem está com pressa corta ("Sorry, gotta go") e segue a rotina; quem foi tratado mal vai embora.
- **Opções ou caixa de texto primeiro:** o jogador escolhe o padrão no menu de opções (`tc.opts2`).
- **Os balões na rua:** reações ao mundo (apagão, batida, chuva, sirene), reações ao jogador (esbarrar, correr, mexer num poste, entrar molhado) e conversas entre NPCs, que o jogador pode ouvir de perto (e que podem trazer pistas).
- **Mentira, percebida pelos fatos:** o NPC confere a frase com o que ele sabe da simulação (dizer que é o técnico para quem conhece o técnico de verdade, ou que mora no prédio para o porteiro, é desmascarado); mentira sobre o que ele não sabe passa, pesada pela personalidade (desconfiado ou ingênuo). Sem sorteio.
- **O que dá credibilidade:** saber detalhes (o nome do chefe, o turno, o número do pedido, achados na investigação ou ouvindo conversas), a roupa (o uniforme da empresa, quando as roupas de profissão vierem), objetos (crachá ou documento na mochila, mostrado quando pedem) e, ao telefone, o número de onde se liga.
- **Mentira descoberta:** o NPC lembra, fica fechado com o jogador e conta aos colegas e conhecidos (a fofoca anda pelas relações); se for grave, chama a polícia e o calor sobe.
- **SMS a um NPC:** a resposta vem pela rotina dele (acordado e livre em minutos, no trabalho no intervalo, dormindo de manhã, alguns ignoram número desconhecido) e **vem justificada pelo que ele estava fazendo de verdade** ("sorry, I was at work", "just woke up"), tirado da rotina pela gramática.
- **Números:** pela lista telefônica (os fixos), perguntando (quem gosta do jogador dá o número e passa a conhecê-lo pelo dele), por cartões, cartazes e fachadas, e investigando (registros, lixo, o celular de alguém; a parte da operadora é da Trilha de hacking).
- **A ligação:** ao telefone a roupa e a aparência não contam, só o que se diz e o número de onde se liga; o NPC ouve o som de fundo de onde o jogador está (sirene, chuva, bar) e pode estranhar ("Where are you?"); ele pode desligar na cara, e ligar de volta custa confiança.
- **O que conversar rende na 1.0:** informação (quem trabalha onde, horários, o que aconteceu), acesso (entrar onde não devia por ter convencido alguém), favores e preço (desconto com quem gosta do jogador, um conhecido que guarda algo, um informante que avisa da polícia) e trabalhos pequenos pedidos por NPCs comuns (passam pela máquina de trabalhos, que é da Trilha de hacking).
- **Quem escreve as falas:** o Gemini em volume pelos briefings de `docs/tarefas/` (a 07 e a 08 já voltaram, em `docs/tarefas/retorno/`), o Claude confere por script (formato, palavrões, lacunas) e ajusta o tom, e **o usuário lê uma amostra antes de entrar**.

### A web (etapa 15; conversa de 2026-10-05)
- **Navegador:** um navegador fictício no notebook, com barra de endereço, abas e botão voltar; as páginas têm layout de site de 2008 (cabeçalho, menu, colunas, banners) desenhado nas células, com cores.
- **Sites das empresas:** uns 6–8 modelos de layout por tipo (restaurante, loja, banco, operadora, jornal…), com cores, nome, logo ASCII e conteúdo tirados da simulação pela semente; cada empresa parece única sem escrever site por site.
- **A web viva:** as manchetes saem da fila de eventos, preços e horários seguem a economia; um apagão no bairro do servidor derruba o site ("server not found"); o que o jogador causou aparece na web (a notícia do apagão, posts sobre o semáforo) sem nunca dizer que foi ele.
- **Internet no celular:** lenta e cara (EDGE/3G), abrindo as versões móveis dos sites aos poucos e gastando o pacote de dados pago; a web de verdade é no notebook, no Wi-Fi (motivo para ir ao cybercafé).
- **E-mail:** webmail no navegador, de um provedor que é empresa da cidade (hackeável), com spam gerado, newsletters das lojas, o banco e contratos longos; **só o celular estilo BlackBerry recebe e-mail** (push), os outros modelos não.
- **Músicas inclusas:** chiptune sintetizado pelo jogo, com nomes de bandas fictícias da cidade, mais as do jogador pela pasta.

### Os NPCs usando a cidade (etapa 16; conversa de 2026-10-05)
- **Dentro dos prédios:** trabalhar e comprar primeiro (funcionários nos postos, clientes comprando), depois morar (dormindo, vendo TV, luzes da rotina vistas de fora) e sentar e esperar (bancos, mesas, ponto, orelhões).
- **A polícia procura pela descrição:** testemunhas e câmeras dão roupa, lugar e hora; a polícia vai ao lugar e olha quem bate com a descrição; trocar de roupa e sair da área despista. Sem estrela de procurado na tela.
- **As pessoas reagem quando o jogador:** mexe num poste ou numa caixa (estranham, comentam, alguns ligam para a polícia, conforme a hora e quem é), corre ou esbarra, fica parado encarando ("Can I help you?") e entra onde não pode ("Employees only").

### A economia (etapa 17; conversa de 2026-10-05)
- **Cadeia curta na 1.0:** fornecedor → loja → cliente; o estoque acaba, o caminhão repõe, o preço sobe com a falta, os salários pagam as compras dos NPCs. O bastante para o hacking mexer em preços e entregas e a cidade reagir. Indústrias e empresas que quebram ficam para depois.
- **A bolsa segue as empresas:** as ações sobem e descem com o que acontece com elas (apagão na fábrica, notícia ruim); o jogador pode comprar, e mexer na notícia mexe no preço.

### O transporte (etapa 18; conversa de 2026-10-05)
- **O táxi:** o jogador senta atrás, vê a cidade passar pela janela, o taxímetro corre e o motorista (um cidadão) puxa conversa pelo diálogo; dá para pular a viagem pagando o mesmo.
- **O metrô elevado:** uma linha em volta do centro, com 6–8 estações, trens de verdade nos trilhos sobre a rua, passageiros cidadãos, cartão ou ficha e o vagão por dentro.
- **Carros dos cidadãos (princípio do usuário: tudo é simulado):** só alguns moradores têm carro, mas **todo carro na rua tem dono e está indo a algum lugar**; nenhum carro anônimo. Quem vê uma placa pode pesquisá-la e achar o dono. Os táxis e os veículos de empresa têm a empresa e o motorista como dono.

### A vida do personagem (etapa 22; conversa de 2026-10-05)
- **Apartamento na 1.0 = base segura + mural de pistas** (dormir sem pagar motel, guardar hardware, esfriar o calor; o mural para o que se descobriu). Mobiliar livremente fica para depois da 1.0; o apartamento vem mobiliado.
- **A mochila tem limite por design** (foi o motivo de ela ter física): os itens devem ganhar o formato real e colisão pela silhueta, girar ao encaixar, como a mochila do Cairn (`referencias/44`); hoje são quadrados. Guardar no apartamento só faz sentido por causa desse limite.
- **Necessidades, no modelo do Shadows of Doubt:** fome (fôlego rende menos, estômago ronca); sono (piscadas lentas, cochilar parado); **sede fica, bem mais leve que a fome**; frio e molhado com **efeito leve, nunca a tela tremendo** (incomoda no Shadows of Doubt), e que passa fácil entrando num prédio ou com roupa quente. Nada de erro aleatório: só lentidão previsível.
- **Roupas:** casaco e cabeça (sobretudo, jaqueta de couro, moletom, capa de chuva; boné, gorro, chapéu), compradas na prateleira e ocupando a mochila; protegem do frio e da chuva e **despistam a polícia, que procura pela roupa** (etapa 16), não pelo rosto. **Sem reconhecer pelo rosto** (decidido pelo usuário): não há como escondê-lo sem máscara, e trocar a roupa inteira e ainda ser reconhecido confundiria. Cada peça é side grade.
- **Interfaces 2D diegéticas são bem-vindas** (Ostranauts, `referencias/46–49`): o que é objeto no mundo e depende da luz em 3D; o resto pode ser painel 2D bonito, com sete segmentos e LEDs de verdade. Medicina profunda (Casualties: Unknown, NEO Scavenger) fica fora.
- **Investigações geradas (proposta do Claude, debatida em 2026-10-05):** o caso não é escrito: **as pistas são os dados reais da simulação** (um fato real acontece: desvio no caixa, alguém some por uma dívida, um rival causa um apagão; sem violência). O contratante só sabe uma ponta; 3–6 saltos pelos dados (turno → câmera → placa → endereço → ligações), em um ou dois dias do jogo; a verdade está nos dados, e acusar errado tem consequência. **O gerador confere antes de oferecer** que há um caminho até a resposta com as ferramentas que o jogador tem. **Sempre com um começo guiado** (gancho que desperta a curiosidade); casos achados sozinhos se perderiam no ruído (decidido pelo usuário). Depende das etapas 14–18, então vem perto da 1.0, ao lado dos trabalhos simples.
- **A variedade (a dúvida do usuário: quantos casos distintos?):** o jogador sente a diferença pela pergunta (~8 tipos), pelo caminho (~4–5: câmeras e placas, ligações e banco, conversa e mentira) e pela complicação (~5: mentira, álibi verdadeiro, o próprio contratante, dois culpados, pista apagada). Estimativa honesta: **20–30 casos que parecem diferentes, 15–25 horas**; cada sistema novo acrescenta perguntas. Um caso gerado nunca é tão bom quanto um escrito, mas é verdadeiro no mundo. Casos fixos pré-escritos estão fora (contra o "tudo é simulado").
- **O mural:** aberto para o jogador usar quando quiser, mesmo fora de um caso; só aceita coisas físicas (páginas do caderno, recortes, cartões, fotos impressas **só na impressora do apartamento**, que é mais uma compra). **Não prometido na 1.0** (contestação do Claude): casos de 3–6 pistas cabem no caderno; o mural só se os casos bons ficarem longos (mais de 10 pistas, várias pessoas) no teste. Um mural digital estilo Maltego seria atmosférico também, mas o usuário prefere o físico.

### O som (etapa 21; rodada rápida de 2026-10-05)
- **Música só diegética:** sai de algo no mundo (rádio de loja, bar, carro passando, o celular); nada de trilha de fundo.
- **Perseguição só com sirenes no mundo**, em som 3D de onde a polícia está; sem música de tensão.
- **O murmúrio das falas com timbre pela semente** (altura, velocidade e forma de onda pela idade, gênero e personalidade).
- **A análise por síntese, em ordem:** primeiro **a batida de carro** (o som que mais incomoda o usuário; nunca acertado; base royalty free/CC0), depois **os passos** (dependem dos materiais do chão: carpete, madeira, grama, asfalto, ladrilho, cada um com várias variações para não repetir; ligar à tabela de materiais da etapa 20), a **chuva** e os **carros e trânsito**.

### O refinamento e os materiais (etapa 20; rodada rápida de 2026-10-05)
- **Uma tabela de materiais só** (textura, som do passo, como molha), usada pelo render e pelo som.
- **Telões e outdoors alternam notícias (da fila de eventos) e anúncios** de empresas que existem.
- **O piso das praças varia por praça** pela semente (xadrez, faixas, pedra).
- **Os carros vão para a etapa 18** (já precisam ser refeitos para o táxi), e **os materiais saem do refinamento e vêm antes**: o usuário quer materiais PBR (cor, rugosidade, metal) como base para o metal dos carros (hoje um só valor de reflexo, que parece falso), o molhado, o vidro e os detalhes que o ASCII tem dificuldade de mostrar.
- **Os materiais PBR não furam a fila (decidido pelo usuário em 2026-10-05):** dão trabalho (dar material a tudo, sobre o shader frágil), então o ritmo de jogabilidade segue (14 diálogo, que o usuário considera o fator mais inovador do jogo, e 15); os materiais vão junto da arrumação do shader, antes da demo.
- **Neon de dia (contraproposta do usuário em 2026-10-05):** liberdade artística: **alguns neons apagam de dia e outros não** (pela semente/pelo dono); nos distritos de entretenimento, o neon aceso de dia é a identidade do lugar.
- **Faróis dos carros (2026-10-05, para a passada dos carros na etapa 18):** variar a cor dos faróis (halógeno amarelado, xenon branco-azulado); conferir se duas luzes vermelhas somadas tendem ao branco (não deveriam: o tom deve ficar vermelho, só mais forte) e se o lilás na traseira vem do farol do carro de trás.

### O diálogo: a ordem (rodada rápida de 2026-10-05)
- **O texto livre vem primeiro** (é o diferencial; o usuário quase pulou a etapa 13 por ele); as escolhas de assunto e tom viram atalhos de intenção depois, sobre a mesma máquina.
- **O primeiro teste é com o balconista da loja** (troca o balcão provisório da F.9): preço, quem trabalha aqui, horário.
- **A memória dura pelo impacto:** uma pergunta comum some em horas; uma grosseria ou uma mentira descoberta dura dias. Pelo número e pela roupa, nunca pelo nome.
- **Quando não entende:** o NPC estranha com uma fala própria e a tela sugere, discreta, os assuntos possíveis.

### A curva de tom (teste de 2026-10-05)
- **Fica o ACES na luminância** (a curva atual). A AgX foi testada lado a lado (F7, `referencias/72` x `73`): sem calibrar, desatura demais tudo; a única vantagem foi o brilho dos neons (o núcleo claro com a borda colorida). **Esse brilho será simulado** numa passada futura nos neons, com o diodo/núcleo visível, como os LEDs e os sete segmentos do Ostranauts, em vez de trocar a curva do jogo inteiro. O teste foi revertido.

### O que os NPCs sabem e como reconhecê-los (conversa de 2026-10-05)
- **O balconista conhece a vida inteira dele** (casa, colegas, o que viu); se conta a um estranho depende de quanto quer conversar no horário de trabalho (personalidade, movimento da loja, tom do jogador).
- **Serviço só no posto:** fora do trabalho, ele recusa tudo o que é atendimento (preço, estoque, vender), mesmo perto da loja; conhecimento do trabalho (o escritório, os colegas) ainda pode sair numa conversa. Distinguir "atendimento" de "saber do trabalho" nas intenções.
- **Reconhecer pessoas (proposta do usuário):** nenhum NPC tem rótulo, mas **quem o jogador associa rosto e nome** (conversou e soube o nome) ganha o nome sobre a cabeça ao ser visto, enquanto o jogador lembrar. Com 100 mil pessoas, o resto é anônimo; o hacking é o outro caminho para achar alguém.
- **Traços marcantes no rework dos NPCs (2026-10-05):** a maioria tem um traço marcante pela semente (cabelo de cor forte, óculos, chapéu, casaco marcante, altura, jeito de andar), poucos têm dois e uma minoria não tem nenhum. **Roupa, cabelo e barba como camadas 3D por cima do corpo**, misturando cubos e esferas (a barba vira volume em volta do queixo, com a boca à mostra).
- **A caixa de texto do diálogo é diegética**, no espírito do recibo do balcão; o balão de fala é candidato (decidir na etapa 14).

### A web no notebook e no celular (rodada rápida de 2026-10-05)
- **Princípio (do usuário):** o que faz sentido na vida real faz sentido no jogo; sem truques de videogame. O realismo fica; **a acessibilidade vem da qualidade de vida e dos sistemas de apoio**, não de simplificar.
- **Buscador de verdade**, lento, nome fictício, indexando os sites gerados. **Fora do índice:** lojas pequenas sem site (só lista telefônica, letreiro, cartão, boca a boca) e **páginas escondidas**, achadas só pelo endereço visto numa pista. Os endereços dos sites aparecem organicamente: toldos, cartões de visita, outdoors, jornal, lista telefônica.
- **O notebook ganha um gerenciador de janelas em mosaico** (estilo dwm/ratpoison de 2008): tela cheia, lado a lado, em cima/embaixo; sem janelas soltas. **Copiar e colar** entre as janelas.
- **Qualidade de vida contra a fadiga:** clicar num IP, numa porta, num login ou num endereço o leva à linha de comando ou ao navegador, como links de uma wiki; nunca obrigar a redigitar. (A parte que toca o shell é sensível: editar só o necessário de `laptop/shell.ts`, ou pelo agente `hacking`.)
- **O navegador é gráfico, desenhado em ASCII** (páginas de 2008 com layout, cores e imagens em blocos). **O celular navega na versão móvel** (lenta e cara; só alguns sites têm versão móvel, o resto aparece pesado ou quebrado).
- **Fórum de perguntas e respostas** (estilo Stack Overflow) com tutoriais das ferramentas, no lugar do manual em PDF; gerado da mesma fonte que a ajuda dos comandos, para não desatualizar. **O texto dos tutoriais é `[HACKING]`**: escrito pelo agente `hacking`/Opus 4.8; o fórum em si (páginas, usuários, datas) pode ser feito nas sessões normais.

### O jogador é só mais um (reforçado pelo usuário em 2026-10-05)
- **A cidade existe sem o jogador:** toda a web (fóruns, sites, páginas escondidas) nasce na geração, antes do primeiro segundo de jogo; o jogador influencia um sistema que já existe, nunca é o motivo de ele funcionar.
- **O veterano que pula a TI:** se ele começa a hackear sozinho, **um fixer que observava manda um SMS** ("vi o que você fez; tenho um trabalho"), pelo que o jogador fez de fato (não por um placar visível). Risco anotado pelo usuário: quem quer pular pode ficar perdido sem saber como "começar logo"; a decidir como dar uma pista sem tutorial (ideias: o cliente de TI menciona de passagem onde "o outro tipo de trabalho" se acha; um cartão ou pichação no motel com o endereço do fórum).

### A polícia e o calor como experiência (conversa de 2026-10-05)
- **Abordagem com conversa:** o policial que alcança o jogador manda parar e pergunta; a resposta vai pela caixa de texto (etapa 14): explicar, mentir ou fugir. Prisão se a roupa bate e a conversa falha.
- **Prisão = noite + fiança + confisco:** acorda de manhã na delegacia; fiança pelo calor; o ilegal da mochila é confiscado (pendrive, ferramentas, cabos), **nunca o notebook**; o calor zera, mas o jogador fica fichado (a próxima abordagem pega mais pesado).
- **A fuga a pé diverte por:** quebrar a linha de visão (a polícia vai ao último lugar visto e procura dali), trocar de roupa no caminho, sumir na multidão e no transporte (a vantagem do dia). **Usar a cidade contra eles** não é improviso: hackear na hora é lento e expõe; o caminho é a preparação (backdoors deixadas antes, ativadas por um aparelho; Trilha de hacking, `docs/feedback-opus48.md`).
- **Câmeras: olhando o mundo** (objetos visíveis, LED de noite), sem cone na tela. **A lista de Wi-Fi do celular como radar orgânico:** as câmeras IP aparecem como redes; em 2008 a maioria ainda é de cabo coaxial, então o radar é incompleto de propósito. Um aparelho de hacking físico (estilo Flipper, nome fictício) pode detectar mais (Trilha de hacking).
- **Colecionar os GridLinks até o apagão geral:** objetivo opcional que a cidade nota (auditorias, caixas trocadas, subestações vigiadas); pode ser o começo ou o fim de uma **sidequest separada da história principal**.
- **Sentir o calor sem barra:** mais polícia no bairro (viaturas paradas, patrulhas olhando as pessoas, sirenes), notícias e Streetwire com a descrição publicada ("grey jacket"), **rádio da polícia** como item (side grade: ocupa a mão e a mochila, faz barulho) e contatos que avisam por SMS.
- **Escala:** na 1.0, a pé, viaturas e cerco (bloqueios nas esquinas, busca loja por loja); **helicóptero depois da 1.0**.

### A economia do jogador (conversa de 2026-10-05)
- **Primeiro apartamento em ~5 a 7 dias de jogo** (4 a 6 h jogando): o marco de sair do motel numa primeira sessão longa.
- **Custo de vida apertado no começo, folgado depois:** diária, comida e crédito do celular comem quase todo o pagamento de TI; com o hacking sobra, e a pressão passa a ser o calor.
- **O hacking paga ~5x a TI, e a TI segue viável:** dinheiro limpo, sem calor, para quando o calor estiver alto; fachada e contatos. Side grade, não só tutorial.
- **Aluguel semanal na 1.0** pago ao síndico; atrasou, aviso e despejo de volta ao motel (nunca game over). Comprar e mobiliar livremente depois da 1.0.
- **Dinheiro vivo e no banco, com riscos diferentes:** o vivo é confiscado na prisão; o do banco é seguro mas deixa rastro (depósitos grandes chamam a investigação; detalhe na Trilha de hacking); esconder dinheiro no apartamento é mais um motivo para ter um.
- **Para onde vai a sobra na 1.0:** hardware e aparelhos (side grades), roupas e disfarces, informantes e favores (o balconista que avisa, o advogado que baixa a fiança), a bolsa e um apartamento melhor.
- **Os preços da etapa 17 valem para o jogador também:** se ele parar a entrega do bairro, a comida fica mais cara para ele.

### A GridLink e o aparelho estilo Flipper (conversa de 2026-10-05)
- **A GridLink é uma concessionária remendada, não um ctOS:** terceirizada e barata, ganhou a licitação de energia e telecomunicações e mantém um remendo de sistemas antigos e diferentes entre si (caixas velhas, modems discados, senhas de fábrica, corrupção na licitação). O noir vem do descaso, não de um olho que tudo vê; assim não lembra a Blume/ctOS de Watch Dogs. Cada caixa é diferente, nada de "hackear tudo" com um botão. A história continua adiada; isto só fixa o tom.
- **O aparelho estilo Flipper (nome fictício): o Opus 4.8 faz o sistema, o Opus 5.5 faz o desenho 2D** em código (como o relógio). Fluxo: numa sessão do Opus 5.5, o desenho; na mesma conversa, chamar o agente `hacking` com o desenho e a lista de funções que tocam a interface; ele devolve o que o sistema precisa (telas, botões, estados); o Opus 5.5 concilia. Só quando o limite semanal permitir.

### Os NPCs como contatos (conversa de 2026-10-05)
- **Alguém vira contato** pela conversa e pela frequência (voltar ao mesmo café, ser educado, lembrar o nome), por favores (uma dívida que ele lembra), por negócio (o informante pago, leal enquanto o dinheiro vier), pelo número trocado (o contato no celular é a prova, e some com o chip) e **pela rede social** (ideia do usuário): o diálogo livre também vale nos comentários dos posts dos NPCs; o jogador posta, NPCs comentam, ele pode ficar famoso; como quem comentou existe de verdade, uma conversa da rua continua no virtual e vice-versa.
- **Um contato se perde** por mentira descoberta, por ter sido prejudicado pelo jogador (o apagão que estragou a loja; ele pode descobrir pelas notícias e pela fofoca), por sumiço (esfria e esquece os detalhes aos poucos) e por calor demais (se afasta por medo e pode entregar o jogador se a polícia perguntar).
- **Expor quem ataca o jogador nas redes** (ideia do usuário: descobrir quem está por trás de uma conta e o NPC reagir) depende dos registros dos cidadãos, que são Trilha de hacking; o texto inteiro está em `docs/feedback-opus48.md`.
- **A fama na rede social (em aberto até a etapa 15):** o jogador fica famoso por fotos e furos, conversa e humor nos comentários, vazamentos (Trilha de hacking) e ajuda no fórum. O usuário temeu que uma conta separada do número vire "duas vidas" complexas demais; o Claude propôs **uma conta só, com o risco vindo do conteúdo** (a cidade liga fatos concretos: a foto tirada na cena e na hora em que te viram, o vazamento com dados que só o invasor teria); decidir depois.
- **Na 1.0, a rede social é só comentar e postar** (foto ou texto, NPCs respondendo pela máquina de intenções); a fama com efeitos e a exposição de haters ficam depois.

### A primeira hora no motel (conversa de 2026-10-05)
- **O jogo começa acordando no quarto,** sem cutscene: quarto escuro, a luz da rua pela janela, o celular vibrando na mesa com o SMS do motel (a diária) e o do cliente de TI. O primeiro gesto é tirar o celular, que já ensina a interface.
- **Às 18h, um pedido urgente** (ideia do usuário, para o jogador não ficar perdido até a manhã): o **dono de um cybercafé** com a rede caída liga desesperado. Cybercafé porque é ligado à tecnologia, apresenta o lugar onde o jogador vai usar a internet depois e justifica o dono ter contatos do meio. **A fome da primeira noite:** ele dá crédito na máquina de vendas do café.
- **Prazo real:** chegou tarde, perdeu o trabalho (não fere a regra do resultado: chegar a tempo é controle do jogador, não sorteio); para quem é novo não travar, outro cliente de TI aparece no dia seguinte.
- **O favor** pode ser o espelho do conserto (derrubar o café concorrente com o mesmo sistema); Trilha de hacking, `docs/feedback-opus48.md`.
- **O quarto do motel na primeira hora:** a tomada e a cama (13.9c, dormir), a mochila na cama com o notebook (pouca bateria) e um pouco de dinheiro, a recepção com o gerente (pagar a diária no balcão; o primeiro NPC, que ensina a caixa de texto) e, pela janela, **uma caixa da GridLink no poste com o LED piscando**: o ponto fixo plantado no primeiro minuto, sem explicação.
- **Dinheiro no começo:** a noite de hoje paga e dinheiro para 1–2 diárias e comida; o pagamento da TI chega antes de acabar.

### O ritmo de um dia comum (conversa de 2026-10-05)
- **Sem trabalho marcado, o jogador vai para a rua por:** reconhecimento (ler a rua: caixas da GridLink, câmeras, redes no Wi-Fi, horários; anotar no caderno), chamados de TI por SMS (renda limpa, contatos novos), vida comum (comer, roupa, carregar no café, conversar com conhecidos) e boatos (conversas na rua e Streetwire viram trabalho por conta própria).
- **Um trabalho grande de hacking a cada 1–2 dias de jogo,** com TI e preparação no meio; o calor esfria entre um e outro e cada trabalho pesa.

### Identidade visual e progressão (conversa de 2026-10-05)
- **O logo do jogo é o da GridLink vandalizado:** a empresa continua GridLink, com um logo corporativo sério no mundo (caixas, caminhões, contas de luz); o do jogo é o mesmo logo com "LINK" riscado e "DOWN" pichado ou em neon queimado. **Um manual de identidade visual só para os dois** (logo, tipografia, cores, usos no mundo), como uma etapa própria logo, para servir de inspiração desde já. Pode delegar ao Gemini a pesquisa de marcas de concessionárias de 2008.
- **A primeira compra grande é a antena Wi-Fi direcional:** hackear de mais longe (da escada, do café em frente) expõe menos o corpo, mas a antena é grande, chama a atenção e gasta bateria. Side grade.
- **Além das compras, o jogador progride** pelo conhecimento (fica na cabeça dele, não numa ficha), pelos contatos, pela reputação no meio (presa ao número) e pelos programas (pendrive, fórum, compra).
- **O caderno (respostas de 2026-10-05):** além do que o jogador escreve, **um diário automático mínimo** (uma página à parte, só fatos crus: "Oct 12: job done, $400", sem dicas); **páginas livres com abas que o jogador nomeia** (folhear pela roda do mouse); **confiscado na prisão e devolvido na saída**: a polícia folheia, e senhas e endereços de alvos pesam no calor e na ficha. Para o jogador aprender isso (princípio das duas camadas), o policial **lê em voz alta** o que achou e a fiança sobe na frente dele; jogar o caderno fora antes de ser pego vira uma escolha que ele descobre.

### Retornos do usuário durante a entrevista (2026-10-05)
- **Abertura do jogo:** um boot corporativo animado da GridLink (o logo montando, como o boot do celular), e uma pichação animada escreve "DOWN" por cima do "LINK", traço por traço. Vai para a etapa de identidade visual.
- **Aparelhos em 3D no mundo (decidido em 2026-10-05):** o celular, o aparelho estilo Flipper, o caderno, o notebook e o relógio (este para receber a luz) existem no mundo como objetos. **Com física de verdade** (o usuário: poucos objetos, só os do jogador, e é base para outros sistemas: jogar o caderno fora e voltar para procurar depois de solto, guardar na mochila, esquecer na mesa): cada um é uma caixa simples contra as paredes e as superfícies, para de simular quando assenta; a mobília e as prateleiras continuam fixas. **A tela fora do ASCII:** o contorno da tela recorta o ASCII e, dentro dele, o conteúdo é desenhado em pixels na **resolução do monitor** (não na camada de 240 linhas), **inclinado como uma tela real**: nítido de perto, sem os glifos repetidos que o notebook tem hoje ao olhar de lado. Na mão, a tela plana como hoje. Junta com "telas em perspectiva no mundo" (etapa 20) e o "refazer o celular e o relógio em 3D" (antes do caderno, etapa 22).
- **As duas camadas se comunicam** (princípio no topo do CLAUDE.md): todo efeito implícito tem um jeito orgânico de se mostrar (o NPC dizendo o que lembra e por que não gosta mais do jogador; o policial lendo o caderno).
- **Fofoca visível:** um NPC que o jogador nunca viu já sabe e diz a fonte ("You're the guy who lied to Marta"); o balconista fica frio (só junto de outro sinal); o NPC reclama no Streetwire com a descrição.
- **Calor esfriando visível:** o bairro volta ao normal, uma notícia de fim ("Police scale back search"), o contato avisa por SMS, o rádio da polícia para de citar a descrição.

### Salvar e errar (conversa de 2026-10-05)
- **Salvar a qualquer hora** (escolha do usuário, contra a recomendação do Claude de salvar dormindo): menu com slots livres; **recarregar é livre**. A tensão vem das consequências dentro do jogo, não do save.
- **O pior caso é recomeçar a vida, não o jogo:** prisão com ficha pesada, despejo, contatos perdidos, chip queimado levam de volta ao motel e ao pouco dinheiro; o mundo, o conhecimento e o equipamento escondido continuam. Nunca game over.

### Dificuldade e ajuda (conversa de 2026-10-05)
- **Uma dificuldade só:** o jogo como foi pensado, sem níveis nem alavancas (o tamanho da cidade é fixo desde 2026-10-06).
- **Quem ajuda o jogador travado:** contatos por SMS (no máximo um por dia), o fórum de tutoriais, perguntar aos NPCs pela caixa de texto ("where can I find work?") e as dicas da tela de carregamento (`tips.json`).
- **Nenhum objetivo na tela:** o que fazer está nos SMS, no e-mail, no caderno e na conversa; sem lista de missões no HUD.

### Respostas do usuário à crítica do Claude (2026-10-05)
- **A ordem dos princípios: a caixa de areia vem primeiro.** Salvar a qualquer hora com recarga livre fica (como o quicksave do Skyrim: experimentar sem medo, "e se eu apagar este quarteirão?", "e se eu disser algo absurdo?"). A consequência real é perder o progresso ao voltar: quem quer avançar tem que arcar com o que fez. **Modo ferro opcional** pode vir depois (é uma opção de save, não um nível de dificuldade).
- **O que se perde de vez:** o notebook e o celular nunca (achados e perdidos do motel); **o caderno sim** (comprar outro e perder o que estava escrito; não é softlock, é ajuda, como o aparelho estilo Flipper). O que mais pode ser perdido fica em aberto.
- **A polícia não lê o caderno (por ora);** perder o caderno não tem outra consequência. Se o caderno é 3D com física, decide-se depois (sem a leitura, não há por que jogá-lo fora). Ideia para o rework da polícia: uma memória limitada na cabeça do jogador (IPs e dados lembrados que se perdem com o tempo), com o risco de virar HUD pouco diegético.
- **A tela dos aparelhos no mundo:** o conteúdo continua sendo ASCII, mas desenhado em pixels (não pelo raycaster), legível na distância em que se espera ler; **fade para ASCII com a distância** (do outro lado do cômodo não se lê).
- **O aparelho estilo Flipper ganha funções por firmware e programas** achados ou recebidos como recompensa (Trilha de hacking).
- **Nove GridLinks numa grade 3×3 uniforme,** cada um alimenta um setor da cidade (é a subestação dele): para apagar uma loja, apaga-se o GridLink do setor dela, o que é previsível. **Mais segurança perto do centro.** Achados **por um mapa anotado** (do fórum, impresso; ou um texto/SMS de um hacker com a posição por pontos de referência), não pelo Maps nem pelo Wi-Fi; perguntar a moradores perto também ajuda; o jogador se acha no mapa de papel pelo Maps. **As caixas são do mesmo modelo** (o mesmo contratante); o que muda é a segurança, na rede e na fiscalização.
- **A economia se testa depois de existir:** medir o que o jogador ganha e o preço das coisas, quanto e com que frequência muda (o supermercado não muda o preço várias vezes por dia).
- **A primeira noite:** o trabalho do cybercafé **fica ativo desde o SMS** (sem espera); o prazo pode ser generoso, quase a noite toda, cobrindo um café do outro lado da cidade.
- **GRID DOWN:** o usuário não achou um jogo com esse nome (só outras obras); trocar depois é barato.

### Mapa, recuperação e tempo (conversa de 2026-10-05)
- **O mapa de papel é um upgrade** do mapa normal comprado; o que se acha no fórum (os GridLinks) o jogador põe no mapa. A impressão espera o quadro de investigação. Como marcar: clicar para copiar (marca à caneta) foi aceito como base; o usuário pensou em desenhar à mão num mapa de pixels com zoom, mas pesa controles e memória do desenho (a decidir; o Claude recomenda marcas com rótulo curto digitado na 1.0 e desenho livre depois).
- **A cidade se recupera, com cicatriz.** Duas ressalvas do usuário: (1) **o apagão hoje acaba antes de as torres de celular ficarem sem bateria** (medido no jogo), então a mecânica nunca aparece: ou as torres caem na hora, ou a bateria dura menos, ou o apagão dura mais; (2) **a loja falida vira outra do mesmo tipo** (mesmo interior, outro nome, outro dono, outra empresa), nunca outro tipo, para não quebrar o interior gerado.
- **O tempo corre com o notebook aberto,** como na conversa: hackear na rua é tenso, num lugar seguro não; escolher onde sentar importa.
- **O apagão geral não é um final:** a cidade reage em grande (uma noite inteira sem luz, lanternas, notícias por dias, a GridLink trocando tudo, a polícia em alerta máximo), depois a recuperação com cicatriz; o jogo segue.
- **Duração do apagão pela causa (decidido):** o disjuntor de poste volta em 1–2 h de jogo; o apagão pelo caminho da subestação que exige mais do jogador (detalhe na Trilha de hacking, `docs/feedback-opus48.md`) dura muitas horas e precisa de uma **equipe que vem de caminhão** (visível na rua). **As torres de celular duram ~2 h de jogo na bateria**, algumas com gerador.
- **O mapa de papel na 1.0: marcas com rótulo curto** (clicar para copiar do fórum, ou clicar no mapa e digitar "GL 4", "café bom"); desenho livre depois da 1.0.

### O teste das duas camadas, aplicado (conversa de 2026-10-05)
- **Implícito sem retorno explícito = sorteio, do ponto de vista do jogo** (o usuário): ao criar um sistema que afeta o jogo, perguntar se precisa de um retorno explícito natural e qual. **Preferir mecânicas que se associam pela vida real.**
- **O calor da investigação vem com um mentor:** o fixer (ou um contato mentor) avisa por SMS quando o jogador passa a ser investigado e diz por quê ("you left your face on the cameras", "you left logs on the system"). O calor pode subir depois do ato (a investigação), desde que o mentor conte.
- **Clima: só a tempestade derrubando a energia** (apagões naturais, que todo mundo já viveu e que escondem um apagão provocado no meio). **Recusados pelo usuário:** chuva esvaziando a rua, chuva e neblina cegando câmeras (subjetivo, impossível de medir, e esperar o clima não diverte), boné e guarda-chuva escondendo o rosto.
- **Fome extrema: desmaio raro** (o jogador acorda num banco ou no motel, perdendo tempo; sem hospital nem ferimento, pela regra de violência).
- **O mentor (decidido em 2026-10-05; atualiza "a corrente da primeira hora" no topo deste arquivo):** um **mentor separado do fixer**, porque o fixer tem reputação própria (o jogador que falha demais deixa de receber trabalhos dele) e o mentor fica. O jogador o conhece pelo dono do cybercafé da primeira noite: o dono diz que tem "um amigo que entende de tecnologia como você" com outro trabalho e passa o contato, sem contar o pedido em público; o **mentor** revela em particular, testa o jogador, dá os trabalhos iniciais (o tutorial) e depois o leva ao fórum, onde ele acha trabalhos e conhece fixers. Detalhes do pedido na Trilha de hacking (`docs/feedback-opus48.md`).
- **Os avisos do mentor são agrupados:** uma fila que junta os fatores (câmeras, logs, testemunhas) e manda um relatório só quando for relevante, com um intervalo mínimo; nunca uma mensagem por fator.

### Revisão das decisões com o teste das duas camadas (conversa de 2026-10-05)
- **A ficha na polícia aparece** pelo policial que reconhece ("You again?"), pelo relatório do mentor ("you're on file now") e por **um papel físico**: a cópia da ocorrência na mochila, que se pode ler.
- **O chip novo zerando a reputação aparece** pelos contatos que não reconhecem, pelo mentor que avisa antes ("clean slate; the cops lose you, but so does everyone else") e pelo balconista da loja de celular ("you'll have to tell your friends").
- **Os preços pela falta aparecem** pela prateleira meio vazia com a etiqueta riscada e o preço novo, pelo balconista que explica a causa sem acusar ("delivery didn't come, the blackout up on 12th") e pela notícia.
- **A etiqueta ampliada (ideia do usuário):** o preço deixa de ser uma caixa de texto; ao olhar um produto, uma versão ampliada da etiqueta aparece na tela, como no orelhão. **Antes, um mapa da tela:** quem ocupa cada canto e quem cobre quem (o celular aberto, o relógio, o notebook, as legendas, os balões, o close-up). Proposta do Claude: o close-up aparece **ao lado do próprio objeto** olhado, fugindo dos aparelhos abertos; um canto fixo só como reserva.
- **Stealth sem medidor:** o jogador sabe que está visível pela própria luz (a tela acesa iluminando o rosto, a sombra sob o poste) e pelas reações dos NPCs ("who's there?" no escuro, olhares no claro).
- **Close-up ao lado do objeto,** fugindo dos aparelhos abertos. **Regra: toda informação de um objeto do mundo aparece numa versão 2D desenhada do próprio objeto** (como o teclado do orelhão hoje: uma interface ao lado, não zoom no modelo 3D; etiqueta, cardápio, placa, recibo, teclado do orelhão); caixa de texto só para fala. Passar por todos os elementos do jogo que merecem interface diegética própria.
- **2D ou 3D (regra do usuário):** em 3D só o que precisa ser visto, mexido e carregado o tempo todo (o aparelho fechado, por fora); **abrir para modificar é interface 2D diegética** (estilo Ostranauts): o notebook aberto por dentro, a tampa traseira do celular, o servidor. Mais barato que modelar as peças em 3D, com o mesmo efeito.
- **O mapa da tela antes do diálogo (etapa 14):** inventário do que ocupa a tela hoje e um desenho das zonas, antes da legenda, dos balões, da caixa de texto e do medidor de tom.

### O diálogo na prática (conversa de 2026-10-05)
- **F para falar:** o F escolhe o alvo e o NPC para e espera enquanto o jogador digita (digitar direto deixaria o NPC ir embora no meio da frase).
- **Quem está perto ouve** (ideia do usuário): confessar um crime ao balconista com gente em volta cria testemunhas; é uma base da fofoca. Pelo teste das duas camadas, quem ouviu mostra (vira a cabeça, para, comenta "did he just say…?").
- **Nem todo NPC aceita conversar:** depende da vida dele (pressa, desconfiança à noite; quem está parado no ponto ou no balcão conversa), e a recusa diz o porquê ("sorry, I'm late").
- **Na tela:** a fala do NPC como legenda no centro de baixo (com o nome, se o jogador souber) e a caixa de texto logo abaixo, com a leitura de intenção e o medidor de tom acima dela.
- **Sussurrar com custo:** um modo de falar baixo (uma tecla ou a frase entre parênteses): só o alvo ouve, mas sussurrar parece suspeito ("why are you whispering?").
- **O barulho do lugar muda quem ouve,** pelo som que o jogo já tem: num bar ou numa avenida só quem está colado; numa loja vazia, todos.
- **A ligação é ouvida, o SMS não:** o lado do jogador numa ligação em voz alta é ouvido por quem está perto; o SMS é silencioso (só quem está colado vê a tela). Grampo é Trilha de hacking.

### O personagem do jogador (conversa de 2026-10-05)
- **O editor fica no espelho do motel:** o jogo começa direto no quarto com uma aparência sorteada pela semente; o espelho do banheiro abre o editor quando o jogador quiser.
- **Falas neutras sobre o jogador:** os NPCs o descrevem pela roupa e pelo número ("the one in the grey jacket lied to Marta", "0179"), como se descreve um estranho; sem gênero na gramática do jogador, sem papel de gênero, sem risco de expressão ofensiva. Pronomes como opção do espelho só depois da 1.0, se o usuário quiser.
- **Só a roupa e o estado mudam o tratamento** (molhada, suja, suspeita à noite), nunca idade ou rosto. **A roupa molhada tem que aparecer para o jogador** (manga escurecida, gotas no relógio), e **os carros passando em poças jogam água** e podem molhar o jogador (etapa 20, clima).

### Rosto, memória e testemunhas (conversa de 2026-10-05)
- **O rosto vale para as relações, não para a perseguição:** conhecidos reconhecem o jogador de qualquer roupa; a polícia, o calor e a perseguição funcionam só pela descrição (roupa, lugar, hora). O contato que entrega o jogador por medo (decidido antes) dá **informação** (onde mora, o número), não reconhecimento na perseguição.
- **A memória do NPC dura pelo peso do que aconteceu:** uma pergunta casual some em 1–2 dias; uma conversa boa, semanas; mentira descoberta ou prejuízo, muito tempo. O NPC diz o que lembra ("you asked me about the bus yesterday").
- **A testemunha reconhece só pela mesma roupa** perto do lugar ("that's him!"); com outra roupa, passa reto.

### Escala do tempo contra a distância (conversa de 2026-10-05)
- **O problema (achado pelo Claude):** o tempo do jogo corre 30x o real (dia de 48 min); atravessar 2 km a pé leva ~25 min reais = ~12 h de jogo. **Correção (2026-10-06):** o código já estava em 12x (dia de 2 h reais, `DAY_REAL_MIN` = 120): 2 km a pé ≈ 25 min reais ≈ 5 h de jogo; o problema é menor, mas a medida do playtest continua valendo. O prazo "da noite toda" não cobre a cidade a pé, e as caminhadas podem engolir o ritmo de um trabalho a cada 1–2 dias.
- **Decidido:** a geração garante **um cybercafé a 300–500 m do motel** inicial (2–3 h de jogo a pé), conferido por um teste em `tests/`. **A escala geral se mede com o registro de playtest (13.10p)**: quanto tempo de jogo os deslocamentos comem numa sessão real, e decidir com números, sem esperar a etapa 18 (ideia a testar: o tempo correr mais devagar na rua e mais rápido ao esperar).

### Os celulares do jogador (conversa de 2026-10-05)
- **O celular inicial é barato:** ligação, SMS e pouco mais; dura pouco no jogo e serve para apresentar as mecânicas (placas, endereços, perguntar o caminho, o mapa de papel; a primeira noite é achar o cybercafé pelo endereço do SMS).
- **Depois, upgrades por tiers, não side grades** (o usuário: "chamar atenção" não é interessante, e o plano de dados caro não pesa para quem ganha mais): o **smartphone atual** (o celular de hoje, com Maps e apps) vira o padrão; o topo é um **modelo BlackBerry com teclado**, que cumpre algumas funções do notebook. Ficam como porém o plano de dados mais caro e a bateria menor.
- **Um celular só:** dois aparelhos seriam dois números e duas reputações, confuso demais.
- **A regra de evolução (decidida):** celular e notebook são **upgrades diretos**; **os acessórios são todos side grades** (funcionais, com vantagens, desvantagens e manias), sem versão melhor do mesmo acessório, pelo menos até a 1.0. O princípio "side grades, não upgrades" vale para os acessórios.
- **O celular:** compra-se um melhor (tiers). **O notebook:** prontos (mais limitados, como na vida real; CPU fixa) com peças trocáveis (RAM, disco, rede) na interface 2D; e **montar o próprio notebook do zero** (como um Hackintosh, ou o Satsuma do My Summer Car): mais caro pelas peças avulsas, pede tempo e entendimento, totalmente customizável, compartilhando o modelo do notebook. Um projeto paralelo; montar um PC de mesa no lugar dele fica a decidir. O Claude sugere o notebook montado depois da 1.0 (é largura).

### O mapa da tela (entrevista de 2026-10-06)
- O inventário da tela e as zonas estão em `docs/mapa-da-tela.md`. Decidido: ao telefone o celular abaixa até a espiada e a conversa fica embaixo, como ao vivo; a conversa é uma legenda de filme (sem moldura, só a caixa de texto com borda); balões na rua até ~12 m (no máximo 3) e, a menos de ~3 m, a frase também vira legenda apagada embaixo; o close-up de um objeto aparece sozinho ao olhar ~0,5 s a até ~1,5 m.

### O tocador e o app cifrado (entrevista de 2026-10-06, 15.9)
- **Tocador:** é o **Tunes Player da loja** (14 MB, $4.99, só baixa no Wi-Fi), e não um app de fábrica. As músicas inclusas são **6–8 faixas chiptune compostas à mão** numa notação de tracker no código, com bandas fictícias da cidade; o usuário ouve e aprova.
- **Por onde sai:** sem fone, pelo **alto-falante** do celular (fraco, metálico; os NPCs ouvem, que é a base do easter egg do esconderijo); com fone (`headphones`/`hands_free`, que já são vendidos), só para o jogador. Continua tocando com o celular no bolso.
- **As músicas do jogador** ficam num **cartão SD**, fora da memória principal (decisão do usuário: ocupar a memória geraria soft lock e o jogador teria que gerenciar a pasta). O cartão espelha a pasta do PC (no Electron, uma pasta fixa ao lado do jogo; no navegador, escolhida).
- **O controle do fio do fone:** com o fone posto e a música tocando, aparece o controlezinho do fio (pausar e pular), que se clica.
- **Alt solta o mouse (proposta do usuário):** enquanto Alt está apertado, o cursor fica livre para clicar no celular, no controle do fone e no relógio; ao soltar, o mouse é recapturado. Os atalhos continuam valendo. Puxar o notebook continua soltando o mouse por padrão. É melhor do que ter regras para quando o mouse se solta.
- **O app cifrado se chama Reynard** (tema de bichos: o Osprey é o SO, o Jackdaw é o aparelho, o guaxinim fica reservado; Fennec foi evitado por ter sido o codinome real do Firefox Mobile). Na 15.9 entram **só o app e a cifra**: o registro pelo número com o código por SMS, as conversas, a verificação da chave do contato, as mensagens que somem e o apagar tudo. **Por enquanto só o debug instala o app** (com uma conversa de teste). O mentor e os contatos reais chegam na etapa 19, junto do jailbreak, que é `[HACKING]`.

### Telas dos aparelhos no jogo (2026-10-06)
- Pergunta do usuário: a gralha do Jackdaw fica bonita no jogo, com a resolução do ASCII? Ele aceitaria tudo na camada HD e sugeriu subir a camada HD para ~360 linhas.
- Hoje a camada HD tem `HD = 3` (80 linhas × 3 = 240 px de altura): a tela de 64 pontos caberia só ocupando quase a tela inteira. A recomendação do Claude é que **as telas dos aparelhos sejam texturas próprias** (o buffer de 128×64 do Jackdaw, a tela do celular), amostradas pela GPU **na resolução do monitor**, como as "telas em perspectiva" já decididas. Assim a nitidez não depende do tamanho do HD nem do ASCII, e cada ponto vira vários pixels reais quando o aparelho está levantado na mão. Subir o HD (4 → 320 linhas, 5 → 400) fica como opção separada para o resto da interface, medindo antes o custo e revendo a arte HD já feita para `HD = 3`.

### O celular em 3D (entrevista de 2026-10-07, para o manual)
- **O manual cobre o aparelho do jogador:** um corpo-base em 3D, com as capas atuais (`phone/shells.ts`) como variações de cor e material. Os outros modelos e as marcas ficam para o manual dos fabricantes.
- **Formato: deslizante** (o usuário estava em dúvida entre ele e a barra e deixou a escolha com o Claude). O custo calculado é de ~25–30% a mais no remake 3D (duas placas, o trilho, a animação com o clique e o estado aberto/fechado), e vale pelo gesto físico com som.
- **Fechado, a frente tem:** a tela, a cruz com OK, atender, desligar e duas teclas de função. Dá para fazer tudo fechado, menos digitar. O teclado numérico fica escondido embaixo.
- **Levantar em dois estágios (ideia do usuário):** a tecla do celular levanta o aparelho **fechado** (só a tela e as teclas da frente, ocupando pouco da tela, para espiar as horas ou mexer na música). Apertar de novo **desliza e abre**, mostrando o teclado numérico (o aparelho sobe mais e ocupa mais espaço). Usar o teclado numérico (as teclas de número, T9/ABC, ou clicar nelas) também abre sozinho. Digitar continua sendo pelo teclado numérico com T9/ABC, de propósito, para o notebook ser melhor para escrever e navegar.
- **Os botões do mouse (resposta do usuário):** o **botão do meio** avança os estágios: 1º levanta o celular fechado, 2º desliza e mostra o teclado, 3º abre o app de chamadas já no modo de digitar. O **botão direito** volta um estágio por vez (sai do app → fecha o trilho → desce o celular); **segurar o direito** abaixa o celular de uma vez, do jeito que estiver. (Com o celular guardado, segurar o direito continua livre para o zoom de ler placas da 13.17.)
- **A tela na mão vira textura própria** na resolução do monitor, como a do Jackdaw: nítida e inclinando com o corpo 3D. A arte atual (células + HD) é portada junto do remake.
- **O corpo-base:** a placa da tela em preto brilhante com aro cromado, e a de baixo em grafite fosco. **A luz das teclas e da tela é azul-gelo**, mas **atender é verde e desligar é vermelho**; as cores das outras teclas ficam a critério do Claude.
- **A frente, revista pelo usuário ao ver o manual:** a tela estava pequena. Saiu a plaqueta cromada embaixo da cruz; a cruz ficou menor e desceu até a base; atender e desligar foram para os cantos de baixo; a tela cresceu para baixo e virou **240 × 400** (2,8", o formato largo de 2008).

- **Decidido ao começar a 15.19 (2026-10-07):** (1) os cubinhos do celular são desenhados **em pixels da camada HD** (3×3 por célula), não em caracteres (os cubos de 1 mm sumiriam: 1 col = 1 mm, 1 linha = 2 mm) nem na resolução do monitor (destoaria do ASCII). O Claude traça os raios na CPU para o aparelho na mão (um modelo, ~23 mil raios, testável no Node); a GPU fica para os objetos do mundo. (2) **Um corpo só agora** (o deslizante, cada visual uma cor/material); as formas por família ficam para depois, no mesmo pipeline.

### O notebook e o Osprey (entrevista de 2026-10-07, para o manual)
- **Um manual só, em duas partes:** o aparelho (corpo, teclas, sons, tela como textura) e o SO **Osprey** (boot, firmware, janelas, terminal, cores).
- **O corpo é fortemente inspirado num ThinkPad** (escolha do usuário): o tijolo preto fosco, quadrado, de quem trabalha. Pela regra de originalidade, copia-se o gênero (a forma, o nub no teclado, a luz do teclado na tampa) e não a identidade (o nub vermelho, o pingo vermelho do logo, o nome).
- **Osprey:** console de texto com mosaico, como hoje (estilo dwm, barra no topo, boot verboso); o manual define as bordas, a barra, os ícones HD e as cores.
- **Tinta:** âmbar por padrão e verde como opção, como hoje; o manual fixa as duas paletas.
- **O nub é âmbar** (o detalhe de cor do aparelho, no lugar do vermelho); **nub + touchpad**, como os de 2008 (três botões em cima, dois embaixo).
- **A luz do teclado na tampa, com tecla própria:** ilumina as teclas no escuro, mas é vista de longe (as luzes do próprio jogador o entregam).
- **O notebook inicial é usado, com marcas:** teclas gastas brilhando, arranhões, a etiqueta meio descolada e **um ou dois adesivos já colados**, sorteados pela semente (bandas da cidade, empresas da simulação, símbolos).
- **O jogador cola os próprios adesivos** (o usuário mudou de ideia duas vezes até aqui): os **achados ou comprados no jogo** (lojas, brindes de bandas e empresas) e **imagens importadas do PC**, dentro de limites técnicos. Proposta do Claude: a imagem vira um adesivo de pixels (até 64×64, até 16 cores, recortado com borda branca), guardado no save como dados; importa-se por uma pasta ao lado do jogo, como o cartão SD da música (o precedente de conteúdo do jogador, que não fere "Tudo é código", porque o jogo não leva o arquivo). Colar é pela interface 2D da tampa (arrastar, girar); descolar deixa marca de cola.
- **Logo do Osprey:** águia-pescadora geométrica em mergulho, de asas fechadas, que vira ASCII de 6–8 linhas no boot.
- **A barra do topo** (o usuário deixou com o Claude, pedindo stats que mostrem que tudo é simulado): áreas de trabalho, título da janela em foco, rede com sinal, carga da CPU, memória usada/total da máquina virtual, bateria com o tempo restante e a hora do jogo.
- **Bordas das janelas em linhas finas na camada HD** (a janela em foco em âmbar claro); **a tela é um LCD fosco de 2008** (sem scanlines, preto acinzentado do backlight, escurece de lado).
- **Revisão do usuário ao ver o manual (2026-10-07):** a tampa e a base com o mesmo tamanho (310 × 225 mm); **o Lodestar com as cores das páginas** (sites de 2008 realistas), nunca a tinta do terminal; **a marca refeita** como a águia-pescadora vista de baixo, com o "M" das asas, e o nome escrito **"OSprey"** (OS na cor da marca, prey em branco: o sistema e a presa); **o firmware fica como já está no jogo** (POST cinza com a fita azul e o selo "powersave", SETUP azul e branco), porque é da placa-mãe e não do SO; o manual só passa os selos do POST para a camada HD, inspirados nas telas antigas de que o usuário gosta (a do selo de energia é a favorita).

### Os fabricantes (entrevista de 2026-10-07, para o manual)
- **Os nomes continuam sorteados pela semente** (escolha do usuário, contra a recomendação de nomes fixos). O manual não desenha logos de nomes fixos: define **as regras de geração** de cada família de marca (tipografia, símbolo, cores, como o nome sorteado vira logo). O Osprey e a GridLink seguem as únicas marcas canônicas.
- **Escopo:** celulares, notebooks, operadoras (chips) e as marcas pequenas (relógio, as 3 de câmera CCTV, as 3 placas de bootloader).
- **A personalidade vem dos arquétipos do mercado de 2008** (copia o gênero, não a identidade).
- **Os fabricantes de celular caem de 6 para 4**, cada um com 1 ou 2 dos 6 corpos de hoje (`LOOK_MAKER` em `sim/device.ts`).
- **O logo de uma família = o nome sorteado escrito na tipografia dela + um símbolo fixo da família**; a semente varia só um detalhe do símbolo (rotação, raios).
- **Os 4 de celular:** (1) a gigante confiável, do barato ao topo (Classic + Brushed); (2) a do executivo, de teclado completo, o topo dos tiers (Slate e o futuro corpo BlackBerry); (3) a da moda e da música, slider e cores (Slider + Pebble); (4) a robusta, de obra e de rua (Rugged).
- **Os 2 de notebook:** o tijolo de trabalho preto e fosco (o do jogador) e o de consumo, prata brilhante, de vitrine de loja de departamento.
- **Profundidade:** por família, as regras do logo com 3 exemplos de nomes sorteados, cores, tipografia e a marca aplicada (aparelho, caixa, tela de abertura, vitrine, site); as marcas pequenas só com o logo e um uso.
- **As 3 operadoras:** (1) a antiga estatal privatizada, dona das antenas, sóbria, loja de balcão e fila; (2) a pré-paga jovem, de cor viva, publicidade em todo canto e recarga na banca; (3) a de desconto, chip na farmácia, ligação internacional barata, sem perguntar o nome. As marcas pequenas (relógio, CCTV, placas) ficam com o Claude.
- **O relógio (revisão do usuário ao ver o manual):** fica o relógio atual, digital, de aço e resina, estilo Casio, e não um analógico. Como é uma das peças principais do HUD, o manual segue `watch/watch.ts` com as mesmas funções (LIGHT/MODE/START, hora/alarme/cronômetro, `(*)` e SIG, bússola e termômetro, segmentos-fantasma). A marca é só o nome impresso em maiúsculas largas cor de creme sobre o filete dourado, sem símbolo.
- **A operadora 0 virou a megacorp (revisão do usuário ao ver o manual; troca a "antiga estatal"; não é dona das antenas, veja abaixo):** enxuta, com um nome curto que todo mundo reconhece, como a Verizon. O nome é **cunhado**: a 1ª sílaba da raiz + um sufixo de corporação (-ion, -ix, -ora, -eon, -ent, -ara), com 5–7 letras ("pemion", "corix"). Não usa o molde `{r} Telecom`, e no código isso pede mudar `operatorName(city, 0)`. O letreiro é em Manrope 800 minúscula e apertada, e o símbolo é uma cunha de sinal violeta **depois** do nome (sólida ou em 2–4 barras, pela semente). Preto, branco e um violeta só. Loja-vitrine branca, contrato de 2 anos e a conta com o nome do cliente.
- **A cadeia das antenas (usuário, 2026-10-07, revista na mesma conversa):** a **GridLink é dona de todas as antenas** e da rede elétrica (senão ela perde relevância), e é fornecedora de hardware e software. Ao consumidor, ela vende só **energia e telefone fixo** (a conta do manual dela traz os dois; os orelhões são dela). Ela **não vende linha de celular**: as três operadoras, a megacorp inclusive, alugam a rede dela. A megacorp é a maior e a mais conhecida, mas **não tem torres**. Na rua, a marca é a da GridLink; na loja, no chip e na conta do celular, a da operadora.

### O navegador Ferret (entrevista de 2026-10-07, para o manual)
- **O Lodestar vira Ferret** (o furão; "to ferret out" = vasculhar até achar), no tema de bichos dos aparelhos (Osprey, Reynard, Jackdaw). O do celular vira **Ferret Mini**. A troca no código (`src/web/browser.ts`, `src/phone/webapp.ts`, `src/locale/en.json`, `laptop/wm.ts`, o comando no `shell.ts`) vem depois do manual.
- **É de uma empresa de software própria**, com marca, mascote e site, como a Mozilla ou a Opera em 2008: vem instalado no Osprey, mas não é da mesma casa.
- **A moldura tem o brilho de 2008** (Firefox 3, IE7): voltar grande e redondo, barra de endereço com cadeado e ícone do site, abas com brilho, barra de status; em HD, contrastando com o console do Osprey.
- **O manual cobre:** a marca e a moldura, os 6 layouts de site e como a semente os varia, as páginas canônicas (Lookwise, webmail, Streetwire, Switchboard), o Ferret Mini na tela de 240×400 e os estados e erros (carregando, "server not found" no apagão, sem sinal, certificado, fora do índice).
- **O símbolo:** o furão saindo da toca; o buraco redondo é ao mesmo tempo a toca, a lupa e o "O" (com meridianos de globo, em azul-petróleo). **Cores:** pelagem creme, máscara marrom-café, a toca azul-petróleo.
- **Carregando:** o furão animado em HD no canto da barra, cavando enquanto a página carrega (como o "N" do Netscape), com a barra de progresso e "Loading 34 of 52 items..." na barra de status.
- **A página inicial continua o portal da cidade**, com uma faixa do Ferret no topo.
- **A empresa é a Burrow Labs** (site burrow-labs.net com "Get Ferret").
- **Selos de 2008 nos sites, pela semente** ("Best viewed in Ferret at 1024x768", "Valid HTML 4.01", contador de visitas, o GIF "under construction"): mais nos layouts antigos, pouco nos corporativos.
- **O furão refeito pelas referências do usuário (2026-10-07):** a 1ª versão (cabeça em cunha, máscara como óculos) não agradou. O novo é um **sable**: cabeça larga e redonda, orelhas pequenas no alto dos lados, o alto da cabeça mais escuro e uma faixa clara na testa, a máscara pelos olhos descendo pela ponte do nariz (com borda em degradê), nariz grande e rosado, almofadas brancas com bigodes, pescoço escuro com a garganta clara e luvas brancas no aro. **A toca passa a ser de terra** (`#2e1d12`, aro `#6b4a2e`, meridianos `#8a6440`; escolhida entre petróleo, azul brilhante de 2008, noite com sódio e terra em `docs/identidade/ferret-propostas.html`); o marrom-terra vira também o acento da moldura (a seta do voltar, a barra de progresso, o "Get Ferret").
- **A web mais rica (pedido do usuário em 2026-10-07: "a web de 2008 está muito simples"):** cada página tem três camadas: o fundo em HD (brilho, abas, biséis, ladrilhos, a sombra da coluna; desenhado **antes** dos glifos), o texto nas células e a frente em HD (fotos pintadas pela semente a partir do tipo do lugar, anúncios de empresas da cidade, mapa, estrelas, ícones, selos). **Cada molde imita um ano**: Center = 1998, Classic = 2001, LeftNav = 2003, Side = 2005 (blog), Corporate = 2008 (Web 2.0), Bare = hospedagem grátis. Manual v2, seção 7 (o kit) e 8.
- **O buscador continua Lookwise, agora com a coruja (decidido pelo usuário em 2026-10-07):** "look wise", a coruja é sábia, e os dois "o" são os olhos dela (anéis de tinta azul-noite com a íris âmbar; tufos no alto dos olhos, o bico no vão). Letras sem cor fora dos olhos; nada de letras multicoloridas. Ícone de 16 px, versões cor/uma cor/negativa, os estados (parada seguindo o cursor, procurando, achou, "Hoo?", de madrugada), paginação de pares de olhos. Manual v2, seção 12.
- **Propostas do Claude confirmadas pelo usuário (2026-10-07), menos o cache:** o índice refeito de madrugada (2 h–5 h, a coruja voando), resultados locais pelo Wi-Fi em que o jogador está, links patrocinados pagos pelas empresas da cidade (gasto delas na etapa 17). **Sem cache:** "é mais satisfatório ver as páginas dando erro e caindo quando tem um apagão, para você perceber o dano que causou", e isso abre missões de derrubar um site. **Nota de balanceamento do usuário:** apagão a qualquer hora pode banalizar esses trabalhos; repensar ao balancear (ideias em `docs/plano-interfaces.md`, no fim).
- **A toca clareada (usuário, 2026-10-07):** o globo escuro se confundia com o pescoço do furão. A toca passa a um degradê de terra (claro atrás da cabeça, #A8845A, a #5A3C24 junto do aro), com o aro em café (#4A2C1A); chapada (#7A5838) nos ícones.
- **Plano dos manuais no jogo (2026-10-07):** 15.16 telas como textura → 15.17 Ferret → 15.18 fabricantes → 15.19 cubinhos e celular → 15.20 Osprey e notebook → 15.21 Jackdaw; a GridLink aos poucos. Detalhe em `docs/plano-interfaces.md`.

### O banco e a linha (decisão do usuário, 2026-10-07)
- O app do banco **não** recarrega o celular: os chips se trocam e o banco não teria como saber qual está no aparelho; a recarga é só pela operadora (o *100#). No lugar, o app mostra as agências do banco por perto (onde se saca dinheiro vivo no balcão).


## Entrevista rápida de 2026-10-07 (fim da sessão da 15.20)
- **Teclado do notebook:** 80 teclas (o desenho do manual) e o nub entre G, H e B (o texto do manual); corrigir a ficha do manual para 80.
- **Escopo da 15.20b:** o corpo na GPU, as teclas afundando, as peças clicáveis com som e a luz do teclado. O desgaste fino por tecla e o LOD na mesa ficam para as etapas 18 e 20.
- **Ordem dos aparelhos:** 15.20b → 15.20c (adesivos do jogador) → **15.21 o relógio** (manual primeiro, depois o 3D) → **15.22 o Jackdaw Mini** (era a 15.21).
- **O relógio:** o de hoje (de aço, com termômetro e barras), refinado e levado ao 3D, com o manual fixando a forma, as cores e os botões. **Botões:** luz de fundo (de longe, uma luzinha que entrega o jogador), alarme/despertador (dormir no motel, esperar), cronômetro (a janela de um trabalho) e trocar o mostrador (hora, data, temperatura, fase da lua). **Ideias do Claude, a confirmar no manual:** bússola (achar o caminho sem o Maps, 13.9), a hora do nascer e do pôr do sol (quando a noite protege) e os batimentos (o fôlego da corrida, ligado ao app de fitness da etapa 22).

## Entrevista da etapa 16 (2026-10-08)
- **Tamanho da 1.0 ("médio", opção B):** perto do jogador os pedestres saem do trilho para reagir a eventos **e** entram e saem dos prédios de verdade (lojas, casa, trabalho); longe, como hoje. Andar livre o tempo todo (atravessar fora da faixa) fica para depois.
- **A escada da testemunha (aprovada "por enquanto"):** a desconfiança é escondida, mas cada degrau aparece. (1) **Notar:** o NPC para, olha e solta um balão. (2) **Desconfiar:** ele se afasta e liga para a polícia, e o jogador **ouve a ligação**. Ainda dá para interromper. (3) **Denunciar:** a ligação termina e o calor sobe com a descrição (roupa, lugar, hora), que reaparece no rádio da polícia e no SMS do mentor. **Gatilhos:** mexer em poste ou caixa da rede, entrar onde não pode, correr perto das pessoas, encarar demais, ficar parado muito tempo no mesmo lugar à noite.
- **Interromper a testemunha (degrau 2):** sair da vista (a ligação sai vaga, calor menor e sem a descrição completa); **conversar** pelo diálogo da 14 (uma desculpa plausível faz ela desligar; vale mais com cara de técnico e menos se ela viu algo grave; ela lembra da mentira); **pagar** (às vezes funciona, mas ela passa a saber e pode falar depois). Sem intimidar. Cortar a ligação é um upgrade do Jackdaw (`[HACKING]`, anotado em `docs/feedback-opus48.md`).
- **Disfarce de técnico da GridLink na etapa 16:** colete e capacete comprados numa loja, o primeiro item de roupa com efeito (a desculpa convence mais e a testemunha nota menos). As outras roupas seguem na 22.
- **Apartamentos alheios entram na 1.0** (usuário: "abre portas para hacks físicos"). A fechadura (arrombar ou hackear) é da trilha de hacking.
- **Stealth: o usuário não está convencido** (2026-10-08). Teme NPCs pouco inteligentes para um stealth como o do Shadows of Doubt; é uma das maiores preocupações dele com o jogo. Pediu uma pesquisa antes de decidir o que os NPCs fazem. **O que a pesquisa achou (fóruns da Steam, guias; o SoD não documenta a IA):** o stealth do SoD se apoia em **regras simples e legíveis**, não em NPCs espertos: invasão marcada na tela, a luz da sala (desatarraxar a lâmpada deixa o cômodo "escuro" e o jogador quase invisível, mas o morador estranha e a polícia vem reacender), esconderijos (debaixo da mesa a pessoa olha para você e não vê), barulho que atrai gente (derrubar uma lata de lixo tira todos de casa), pagar para entrar e alarmes que os NPCs correm para acionar. **As queixas mais comuns são justamente da IA:** reage rápido demais, antes de o jogador entender que está invadindo; laços de pânico (o NPC aperta o alarme sem parar, dias depois); comportamento errático dentro dos apartamentos. **E o SoD mostra muito na tela** (medidor de visibilidade, aviso de invasão), o contrário do nosso princípio orgânico.
- **Stealth na 1.0 = opção B, "regras simples", com condições do usuário:** luz, barulho e linha de visão como na vida real, cada regra visível no mundo (o NPC vira a cabeça, pergunta "Who's there?", acende a luz). Sem esconderijos nem NPCs procurando cômodo por cômodo (o estilo SoD completo fica para depois da 1.0). **Condições:** (1) a linha de visão tem de ser **clara e previsível** para o jogador; (2) a trajetória dos NPCs **nunca errática**, senão frustra; (3) **em casa, os NPCs fazem várias atividades, cada uma com a própria animação.** Hackear a luz, a câmera ou o elevador para entrar sem ser visto é o papel do hacker nisso.
- **Casa feita de "postos" (aceito):** cada posto (sofá/TV, fogão, pia, mesa, cama, banheiro, escrivaninha, janela) fixa onde o NPC fica, para onde olha, a animação e a duração; o caminho entre postos é sempre o mesmo traçado. Barulho ou luz interrompem: o NPC olha, vai até a origem por caminho fixo e **volta ao posto** (nunca vaga). **As 11 atividades da 1.0:** ver TV, cozinhar, comer à mesa, lavar louça, computador, telefone, ler no sofá, dormir, banho (porta fechada, só som), olhar pela janela, fumar na janela/varanda. **Ordem:** o rework do modelo das pessoas (13.8/13.14) vem **antes** das animações.
- **Interiores: o usuário está muito insatisfeito** (parecem aleatórios, sem variação, fáceis de quebrar). Com stealth, o código de interiores (apartamentos inclusive) tem de estar **impecável**. **Decidido:** antes de aplicar no jogo, um **manual de design dos interiores** no estilo dos manuais de identidade (`docs/identidade/`), e o jogo segue o manual.
- **Mais manuais pedidos (2026-10-08):** (1) **aplicar o manual da GridLink** no jogo (ainda não foi); (2) um manual de **placas em geral** (ruas, avenidas, direção; hoje quebradas); (3) um manual de **landmarks** (marcos; hoje quebrados); (4) **fachadas e variações de prédio**, no rework das fachadas (etapa 20).

## Entrevista do manual de interiores (2026-10-08)
- **O objetivo (usuário):** "algo muito bem feito que elimine os bugs de geração", com bastante variação para evitar a mesmice, **contanto que faça sentido**.
- **Andares desenhados à mão, salas por tamanho (ideia do usuário):** cada andar é uma planta desenhada (onde ficam o corredor, o elevador e as vagas de sala); cada vaga tem um tamanho e recebe uma **sala desenhada** daquele tamanho. Variação nos dois níveis (vários andares por tamanho de prédio, várias salas por tamanho de vaga).
- **Catálogo fixo de tamanhos de prédio (aceito):** o gerador da cidade só faz prédios com tamanhos do catálogo, e cada tamanho tem os seus andares. Medido na semente 42: 8.848 prédios com interior em 143 tamanhos, mas seis (8×10, 8×12, 8×8, 10×12, 10×10, 12×12 m) cobrem 80% e os 20 mais comuns 92% (o módulo de 2 m já agrupa). A cidade de cada semente muda um pouco; os saves de teste não importam.
- **Autoria:** o Claude escreve as regras e o primeiro conjunto no manual (planta em texto, como as lojas de `layouts.ts`); as variações vêm do Gemini por briefing e só entram se passarem num teste automático (portas alcançáveis, nada bloqueando passagem, postos acessíveis).
- **Tipos de prédio no manual:** residencial (walk-up de tijolo e torres), escritórios, térreo com loja (o hall e o elevador junto da loja) e motel/hotel.
- **Apartamentos da 1.0:** quitinete, 1 quarto, 2 quartos; cobertura/loft só se der antes da 1.0.
- **O que varia entre casas do mesmo modelo:** a renda, quem mora (idade, trabalho, hobby: pistas para investigação), o distrito/prédio (tijolo velho x vidro) e a cor/decoração pela semente.
- **Móveis em cubinhos no manual:** cada móvel com medidas e a versão em cubinhos; o jogo segue quando o render de cubinhos do mundo chegar.
- **Escadas internas voltam em todos os prédios;** elevador só nos de 6+ andares, como em 2008 (o walk-up de tijolo não tem). Caminho alternativo para o stealth e para fugir.
- **Extras:** telhado acessível pela escada; lavanderia do prédio, as caixas de luz e telefone e a sala do zelador **nos fundos do térreo** (ou no 1º andar quando o térreo é loja); o subsolo de verdade fica para depois (a cidade não desenha nada abaixo da rua).
- **Objetos pequenos:** a maioria é cenário que diz quem mora ali; poucos se pegam ou se leem (bilhete, conta, post-it com senha), tirados dos dados do morador.
- **Referências visuais:** o Claude propõe 2–3 direções no manual e o usuário escolhe.
- **Direção visual escolhida (2026-10-08, pela recomendação do Claude):** **A, âmbar noir, como base** (abajur quente, madeira, sódio pela persiana), com **os objetos de 2008 da B** (TV de tubo, PC bege, radiador), e **C, retrofuturo, só nas torres de vidro e escritórios**.
- **As arrumações das salas o Claude gera ele mesmo** (pedido do usuário: "se é só texto não deve consumir muito"), com o validador das regras rodando junto; o briefing para o Gemini foi descartado.

## Modo cozy (conversa de 2026-10-08)
- **Pedido do usuário:** o jogo mais aconchegante para quando o jogador quiser descansar (ele gosta de andar na rua ouvindo a música do celular, olhando os letreiros). Pode virar **uma etapa própria, curta, depois da 16**; as outras ideias (sentar e olhar, ouvir conversas, chuva sob a marquise, fotos, diner, lavanderia, telhado, trem elevado) se conversa quando virar etapa.
- **Pesquisa (Cyberpunk 2077, Shadows of Doubt):** sentar em bancos e bares e só olhar é o pedido mais comum (virou mod); o rádio com DJ e comerciais é o que mais dá imersão; minijogos de bar (estilo Yakuza); no SoD, a chuva, o guarda-chuva, o apartamento decorável (com bugs) e o "melancólico, mas com calor humano".
- **"The usual?" (o usuário pôs a condição):** só vale se o NPC **lembrar de verdade** o que o jogador pede, e só aparece depois de **várias idas ao mesmo lugar**. Precisa da memória do diálogo (14) guardando o pedido por cliente.
- **Rádio da cidade:** um **modo rádio no celular, dentro do app de música** (Tunes). O DJ fala de eventos reais da simulação. **As vozes (ideia do usuário): um misto de sintetizador e Animal Crossing**, cada letra com um som parecido com o real dela. Antes, conferir que **as legendas dos NPCs ainda estão pequenas demais** (já nos retoques da 14) e aumentá-las.

## Entrevista do cronograma (2026-10-08)
- **A 1.0 é simulação e hacking, não fuga:** a dificuldade vem da profundidade do hacking; polícia, calor, testemunha, stealth, prisão e disfarce ficam para depois da 1.0 ("isto não é GTA; se esconder é chato").
- **O risco de hackear na 1.0 vem de duas fontes:** a reputação e a rede que reage (o administrador de sistemas que é um cidadão com turno e lê os logs; a cidade que aprende, trocando caixas atacadas por modelos novos). A referência é o Uplink (o rastro e os logs). O detalhe é da trilha de hacking (`docs/feedback-opus48.md`).
- **Reputação no fórum:** avaliações dos contratantes sobem ou descem o nível do jogador no fórum; o jogador é anônimo, e **os trabalhos de hacking vêm só do fórum**, menos na primeira hora (o tutorial).
- **Um sistema só** para veículos (NPC, táxi e jogador), para a física (aparelhos, bolas, decoração; com o celular carregando na tomada e o notebook na mesa antes de sentar) e para a roupa (vestir, disfarce, customização).
- **O jornal de papel:** comprado na banca de manhã, com as manchetes reais de ontem organizadas em páginas por assunto e as fotos impressas; planejar antes (um manual), pelo menos uma edição na 1.0, variações depois.
- **A rua mais cheia (essencial na etapa de refinamento):** bancas de jornal, vendedores de comida, as plaquinhas de calçada do Kamurocho, os terrenos vazios virando quadras e feiras.
- **O ASCII:** o usuário gosta da mistura atual com o PSX; a fidelidade maior veio para cortar a fadiga visual do ASCII grande em movimento, e ainda não cortou toda. O charme hoje é ser renderizado em ASCII e tudo ser sintetizado (nenhum arquivo de mídia), não ser 100% ASCII. **De dia, o fundo dos glifos deve seguir a luz do sol** (hoje fica escuro de dia; parece ser a cor do fundo dos glifos).
- **Travadas:** medir antes de mexer (um gravador de quadros lentos no registro de playtest, com o tempo de cada fase); se o culpado for a simulação, ela vai para um Web Worker. Entra na 16.1.
- **Os canais:** os trabalhos de hacking se pegam no fórum; a conversa com os fixers e o mentor, depois de aceitar, é no Reynard (se o primeiro contato começa por SMS ou já no Reynard, decidir antes da 1.0); o lado legítimo (TI, NPCs comuns) fica no SMS. NPCs comuns pedindo trabalhos pequenos: em aberto.
