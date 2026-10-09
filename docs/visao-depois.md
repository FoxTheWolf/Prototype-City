# Visão: o que ficou para depois da 1.0

> Separado da `visao.md` na revisão de 2026-10-09: as decisões de polícia, calor, prisão, stealth, testemunhas, disfarce e a demo, que a entrevista do cronograma (2026-10-08) mandou para depois da 1.0. Nada foi apagado: quando essas etapas abrirem, o plano está aqui. As notas ⚠ dentro do texto são as da época.

## A demo
- Para amigos que querem ajudar, com pouca experiência em hacking (o que tem é o do PC mais modesto). O primeiro contato precisa se explicar sozinho.
- **Desempenho na hora da demo:** um perfil leve separado (menos materiais e efeitos), preservando a versão completa. Os 8 storage buffers não são preocupação até lá.

### Stealth e luz
> **⚠ 2026-10-08:** Stealth fica para **depois da 1.0** (a 1.0 é simulação e hacking, não fuga).
- **Em aberto, mas o Claude recomenda:** um medidor de exposição (como Thief) lendo a luz no lugar do jogador; a polícia acha mais fácil no claro. **As próprias luzes entregam o jogador** (tela do celular, luz do relógio, o celular tocando com uma ligação por engano). Depende da polícia sair dos trilhos (etapa 16).

### Prisão
> **⚠ 2026-10-08:** Prisão fica para **depois da 1.0** (a regra "nunca apreender o notebook" continua valendo quando vier).
- **Nunca apreender o notebook** (softlock: sem ele não há como ganhar dinheiro sem tédio). O custo da prisão é decidido no rework do calor e da polícia.

### A polícia e o calor como experiência (conversa de 2026-10-05)
> **⚠ 2026-10-08:** **Tudo nesta seção fica para depois da 1.0** (polícia, calor, fuga, prisão). Os GridLinks e as câmeras como objetos continuam na trilha de hacking (18).
- **Abordagem com conversa:** o policial que alcança o jogador manda parar e pergunta; a resposta vai pela caixa de texto (etapa 14): explicar, mentir ou fugir. Prisão se a roupa bate e a conversa falha.
- **Prisão = noite + fiança + confisco:** acorda de manhã na delegacia; fiança pelo calor; o ilegal da mochila é confiscado (pendrive, ferramentas, cabos), **nunca o notebook**; o calor zera, mas o jogador fica fichado (a próxima abordagem pega mais pesado).
- **A fuga a pé diverte por:** quebrar a linha de visão (a polícia vai ao último lugar visto e procura dali), trocar de roupa no caminho, sumir na multidão e no transporte (a vantagem do dia). **Usar a cidade contra eles** não é improviso: hackear na hora é lento e expõe; o caminho é a preparação (backdoors deixadas antes, ativadas por um aparelho; Trilha de hacking, `docs/feedback-opus48.md`).
- **Câmeras: olhando o mundo** (objetos visíveis, LED de noite), sem cone na tela. **A lista de Wi-Fi do celular como radar orgânico:** as câmeras IP aparecem como redes; em 2008 a maioria ainda é de cabo coaxial, então o radar é incompleto de propósito. Um aparelho de hacking físico (estilo Flipper, nome fictício) pode detectar mais (Trilha de hacking).
- **Colecionar os GridLinks até o apagão geral:** objetivo opcional que a cidade nota (auditorias, caixas trocadas, subestações vigiadas); pode ser o começo ou o fim de uma **sidequest separada da história principal**.
- **Sentir o calor sem barra:** mais polícia no bairro (viaturas paradas, patrulhas olhando as pessoas, sirenes), notícias e Streetwire com a descrição publicada ("grey jacket"), **rádio da polícia** como item (side grade: ocupa a mão e a mochila, faz barulho) e contatos que avisam por SMS.
- **Escala:** na 1.0, a pé, viaturas e cerco (bloqueios nas esquinas, busca loja por loja); **helicóptero depois da 1.0**.

### Rosto, memória e testemunhas (conversa de 2026-10-05)
> **⚠ 2026-10-08:** A memória do NPC fica (diálogo); a testemunha e a perseguição ficam para depois da 1.0.
- **O rosto vale para as relações, não para a perseguição:** conhecidos reconhecem o jogador de qualquer roupa; a polícia, o calor e a perseguição funcionam só pela descrição (roupa, lugar, hora). O contato que entrega o jogador por medo (decidido antes) dá **informação** (onde mora, o número), não reconhecimento na perseguição.
- **A memória do NPC dura pelo peso do que aconteceu:** uma pergunta casual some em 1–2 dias; uma conversa boa, semanas; mentira descoberta ou prejuízo, muito tempo. O NPC diz o que lembra ("you asked me about the bus yesterday").
- **A testemunha reconhece só pela mesma roupa** perto do lugar ("that's him!"); com outra roupa, passa reto.

(da "Entrevista da etapa 16")
- **A escada da testemunha (aprovada "por enquanto"):** a desconfiança é escondida, mas cada degrau aparece. (1) **Notar:** o NPC para, olha e solta um balão. (2) **Desconfiar:** ele se afasta e liga para a polícia, e o jogador **ouve a ligação**. Ainda dá para interromper. (3) **Denunciar:** a ligação termina e o calor sobe com a descrição (roupa, lugar, hora), que reaparece no rádio da polícia e no SMS do mentor. **Gatilhos:** mexer em poste ou caixa da rede, entrar onde não pode, correr perto das pessoas, encarar demais, ficar parado muito tempo no mesmo lugar à noite.

(da "Entrevista da etapa 16")
- **Interromper a testemunha (degrau 2):** sair da vista (a ligação sai vaga, calor menor e sem a descrição completa); **conversar** pelo diálogo da 14 (uma desculpa plausível faz ela desligar; vale mais com cara de técnico e menos se ela viu algo grave; ela lembra da mentira); **pagar** (às vezes funciona, mas ela passa a saber e pode falar depois). Sem intimidar. Cortar a ligação é um upgrade do Jackdaw (`[HACKING]`, anotado em `docs/feedback-opus48.md`).

(da "Entrevista da etapa 16")
- **Disfarce de técnico da GridLink na etapa 16:** colete e capacete comprados numa loja, o primeiro item de roupa com efeito (a desculpa convence mais e a testemunha nota menos). As outras roupas seguem na 22.

(da "Entrevista da etapa 16")
- **Stealth: o usuário não está convencido** (2026-10-08). Teme NPCs pouco inteligentes para um stealth como o do Shadows of Doubt; é uma das maiores preocupações dele com o jogo. Pediu uma pesquisa antes de decidir o que os NPCs fazem. **O que a pesquisa achou (fóruns da Steam, guias; o SoD não documenta a IA):** o stealth do SoD se apoia em **regras simples e legíveis**, não em NPCs espertos: invasão marcada na tela, a luz da sala (desatarraxar a lâmpada deixa o cômodo "escuro" e o jogador quase invisível, mas o morador estranha e a polícia vem reacender), esconderijos (debaixo da mesa a pessoa olha para você e não vê), barulho que atrai gente (derrubar uma lata de lixo tira todos de casa), pagar para entrar e alarmes que os NPCs correm para acionar. **As queixas mais comuns são justamente da IA:** reage rápido demais, antes de o jogador entender que está invadindo; laços de pânico (o NPC aperta o alarme sem parar, dias depois); comportamento errático dentro dos apartamentos. **E o SoD mostra muito na tela** (medidor de visibilidade, aviso de invasão), o contrário do nosso princípio orgânico.

(da "Entrevista da etapa 16")
- **Stealth na 1.0 = opção B, "regras simples", com condições do usuário:** luz, barulho e linha de visão como na vida real, cada regra visível no mundo (o NPC vira a cabeça, pergunta "Who's there?", acende a luz). Sem esconderijos nem NPCs procurando cômodo por cômodo (o estilo SoD completo fica para depois da 1.0). **Condições:** (1) a linha de visão tem de ser **clara e previsível** para o jogador; (2) a trajetória dos NPCs **nunca errática**, senão frustra; (3) **em casa, os NPCs fazem várias atividades, cada uma com a própria animação.** Hackear a luz, a câmera ou o elevador para entrar sem ser visto é o papel do hacker nisso.
