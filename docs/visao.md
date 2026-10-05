# Visão do jogo (entrevista com o usuário, 2026-10-04)

> Respostas do usuário na reunião + entrevista. É a base para planejar; ler ao começar uma etapa nova. As decisões curtas também estão no CLAUDE.md.

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
- O tamanho do dia (48 min) é decidido depois disso; o Claude traz propostas.

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
