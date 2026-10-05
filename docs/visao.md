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
- **O jogador aparece antes da 1.0**, no formato da Alex, com skin 64×64 importável.
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
