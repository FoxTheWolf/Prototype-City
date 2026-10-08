# Cronograma mestre (2026-10-08)

> Feito a pedido do usuário depois do playtest de 2026-10-08, para acabar com etapas que crescem sem fim (a 13 teve 34 versões, a 15 teve 70; a lista de correções chegou a ~70 itens somando todas; os interiores estão no 4º rework). **Este arquivo é a fonte do que vem; o CLAUDE.md só aponta para cá.** O texto antigo do Plano (com os detalhes de cada pedido) está em `docs/plano-antigo.md`: cada subetapa daqui diz de onde vem ("antigo 16") para achar o detalhe lá.
>
> A Trilha de hacking (etapa 21) não foi lida para montar este cronograma (classificador); o Opus 4.8 fixa as subetapas dela na sessão dele.

## As regras (aprovadas pelo usuário em 2026-10-08)

1. **Plano fixo:** cada etapa tem de 5 a 8 subetapas, fixadas aqui antes de começar. Não crescem. Ideia nova no meio vira item de uma etapa futura já nomeada. Única exceção: o que quebra o jogo. Se uma etapa precisar de uma 9ª subetapa, outra sai para uma etapa futura, e o Claude avisa o usuário.
2. **Triagem de todo retorno em três caixas:**
   - **Quebra** (trava, crash, perde save, impede o laço): corrigir na hora.
   - **Ajuste** (rápido, sem mexer no shader): entra no próximo bloco de correção.
   - **Depois**: vai para uma etapa com número, nunca "algum dia". Polimento visual vai para a 23 por padrão.
3. **Cadência:** a cada **2 subetapas**, **1 bloco de correção** (C1, C2…), com teto de **~5 itens ou ~20% de uma janela de 5 h**. Os blocos já estão atribuídos abaixo e esvaziam o backlog até o fim da etapa 17. Item novo de "ajuste" entra no bloco seguinte que tiver vaga (ou no da área dele).
4. **O Claude contesta o perfeccionismo, inclusive o dele:** retoque que não alimenta o laço da 1.0 vai para a etapa 23, a não ser que o usuário insista.
5. **Manual antes do visual e do sistema grande** (lição dos 4 reworks de interiores): uma coisa que várias etapas vão usar é planejada uma vez, com tudo o que as etapas seguintes pedem dela, e feita uma vez.
6. **Cada sessão começa dizendo o que está previsto aqui**; se estourar o tempo, o Claude avisa e corta, em vez de esticar. No fim de cada etapa, **uma sessão de teste do usuário** com uma lista do que ver no PC (o Claude só monta a lista; custa pouco).
7. **Medir o ritmo:** ao fechar uma etapa, anotar abaixo quantas sessões levou contra a estimativa, e recalibrar o resto.

## A ordem e a estimativa

Uma "sessão" = uma janela de 5 h, em qualquer das contas do usuário (o horário de cada uma sai do `get_usage` dela, nunca deste arquivo). Uma subetapa ≈ 1 sessão; um bloco de correção ≈ ½ sessão. Estimativa inicial, para recalibrar pela regra 7.

| # | Etapa | Subetapas | Blocos | Sessões (estim.) | Plano antigo |
|---|---|---|---|---|---|
| 13 | Interiores: fechamento | 7 | C1–C3 | ~9 | 13 |
| 14 | Diálogo | ✅ | — | — | 14 |
| 15 | Web e celular | ✅ (fechada; restos distribuídos) | — | — | 15 |
| 16 | Pessoas (shader, manual, rework) | 6 | C4–C6 | ~8 | 13.8/13.11/13.14 |
| 17 | NPCs vivendo a cidade (sem polícia) | 5 | C7–C8 | ~6 | 16 (parte) |
| 18 | `[HACKING]` Hacking completo + TI (Opus 4.8) | o Opus 4.8 fixa | C9–C10 | ~10 | 19 |
| 19 | Economia | 6 | C11 | ~7 | 17 |
| 20 | Cozy e a física | 6 | C12 | ~7 | cozy |
| 21 | Transporte: um sistema de veículo para todos | 6 | 1 | ~7 | 18 |
| 22 | Vida do personagem | 7 | 2 | ~9 | 22 |
| 23 | Refinamento e variedade | 8 | 2 | ~10 | 20 |
| 24 | Som | 5 | 1 | ~6 | 21 |
| 25 | A primeira hora e o laço (integração e balanço) | 5 | — | ~6 | novo |

**Total até a 1.0: ~85 sessões**, contadas em sessões (cada conta tem o seu limite). A 18 é do Opus 4.8; partes dela podem correr em paralelo quando o limite deixar.

**Decisões que mudaram a ordem (usuário, 2026-10-08, na entrevista do cronograma):** (1) **polícia, calor, testemunha, stealth, prisão e disfarce ficam para depois da 1.0**: a dificuldade é a profundidade do hacking, não fugir da polícia ("isto não é GTA; se esconder é chato"); a 1.0 é simulação profunda e hacking realista que a influencia. O calor que já existe (`heat.ts`) fica como está, congelado. (2) **Um sistema só de controle de veículo** para NPCs, táxi e, um dia, o jogador (motor, tração, rodas), com pesquisa e manual antes; o jogador dirigir pode ficar para depois da 1.0, mas pelo mesmo sistema. (3) O hacking sobe para logo depois dos NPCs, com a TI legítima dentro; uma etapa final monta a primeira hora e o balanço.

**Por que esta ordem:** a 16 (pessoas) vem antes da 17 porque a vida dos NPCs depende do corpo (as 11 atividades animadas, sentar, a cabeça que olha, os traços combináveis). Os interiores fecham antes porque a 17 precisa dos postos nas casas e nas lojas. O hacking vem logo depois porque é o coração do jogo e precisa de pessoas e prédios vivos como alvo (registros, rotinas, luzes, portas).

---

## Etapa 13: Interiores, o fechamento (8 subetapas)
> Fecha o rework pelo manual (`docs/plano-interiores.md`) com o que a 17 precisa, e congela. O resto do rework (tipos que faltam, faixas `*` dos lotes fundos, escritórios e torres) vai para a 23.
- ✅ **13.18 O retorno do playtest de 2026-10-08 (0.13.18; a porta na cozinha virou hall nas 5 plantas e a regra R12; falta o usuário ver no PC):** a escada em U (vão no topo, o piso de cima invisível pelo poço), o travamento perto da escada, o apartamento sem porta e a porta principal na cozinha (e uma regra nova no validador para isso), o recuo dos móveis e da escada da parede. (`plano-interiores.md` passo 9)
- ✅ **13.19 Portas e saída (passo 8; 0.13.19, falta o usuário ver no PC):** a porta dos moradores achável, a verga, portas e entradas mais largas (~0,9 m), o vidro da porta, o EXIT vermelho só no caminho comum até a rua.
- → **C1**
- ✅ **13.20 (0.13.20) Mobiliar pela biblioteca, com postos (passo 3):** as arrumações do manual nos cômodos, pela renda e pelo morador (`homeUnit` nasce aqui), e **cada móvel com o posto dele** (onde o NPC fica, para onde olha), que é a base da casa da 17.
- **13.S A arrumação do shader (adiantada da 16.1 na reunião de 2026-10-08):** separar `gpu/shader.ts` por assunto, caber em 8 storage buffers, cortar a compilação de 3–4 min (as funções grandes copiadas em cada chamada); aproveitar e tirar o código desligado da zona de fogo e do Sarcófago (`FIRE_ZONE`). Por partes, comparando as posições de ouro antes e depois de cada passo. Motivo: o C2, a 13.22, a 16 e a 23 são quase só shader.
- **13.21 Um gerador só: as lojas na gramática das plantas** (regra "um sistema só"): `sim/layouts.ts` entra em `sim/floorplans.ts`; os postos de balconista e de cliente no mesmo formato. **Reunião de 2026-10-08:** o **cybercafé e o motel** são obrigatórios (a primeira hora); se cortar tipos, esses ficam.
- → **C2**
- **13.22 Interruptores e luz por cômodo (passo 5, R10):** um por cômodo, sala vazia e loja fechada apagadas; é a regra de luz do stealth. **Da reunião de 2026-10-08:** o morador acende ao entrar e apaga ao sair ou dormir, o jogador aperta F no interruptor; e **as janelas acesas da fachada passam a ler o estado real da luz dos cômodos** (um sistema só; hoje são sorteio por `hash3`), com prédios de luz automática (escada e saguão 24 h por norma de incêndio, escritórios com timer ou sensor de presença, vitrines com timer; pesquisar antes). Longe do jogador, a luz sai da rotina, como a posição das pessoas.
- **13.23 O telhado (passo 4d)** e a última escada chegando nele.
- → **C3**
- **13.24 Escadas de incêndio coerentes com as plantas** (nota 12): as janelas e os patamares batendo com os cômodos; é o caminho alternativo do stealth e da fuga.
- → **teste do usuário da 13** (reunião de 2026-10-08: o usuário já testou a maior parte da fila antiga "falta ver no PC"; o que for refeito sai em `teste-*.bat` com instruções claras, um por assunto, e não numa lista solta)

## Etapa 15: fechada
Os restos foram distribuídos: o boot do celular em pixels, o Jackdaw 100% pelo mouse e o Maps escuro → C4; a moldura nova do manual do Ferret, favoritos/abas/links roxos e as notas de versão → C5; as fotos das notícias apontadas → C6; o brilho do aço e o cristal do relógio → C9; postar na rede social e o eclipse no Streetwire → 18; os adesivos do notebook (15.20c) → 22; a tomada, o infravermelho, o brilho no mundo e o som abafado do Jackdaw, e o CCTV gravado no título → 23; o e-mail e o app cifrado do contratante, `tests/apt.ts` → 21. A pasta de música no navegador sai (o alvo é o Electron).

## Etapa 16: Pessoas, o manual e o rework (6 subetapas)
> Um rework só, planejado para tudo o que as etapas 17, 20 e 22 vão pedir do corpo. Junta 13.8, 13.11 e 13.14.
- **16.1 Travadas e o shader:** primeiro **medir as travadas** (um gravador dos quadros acima de ~8 ms no registro de playtest, com o tempo de cada fase: simulação, preparação, GPU, telas, e a posição); se a simulação for o culpado, levá-la para um **Web Worker**. (A arrumação do shader foi adiantada para a 13.S.) Logo depois, **o documento da engine** (pedido de 2026-10-08) sai daqui, com o shader já arrumado: o raio por célula, a luz, os interiores, os cubinhos, a camada HD e por que os bugs típicos acontecem.
- **16.2 O manual de pessoas** (`docs/identidade/pessoas-manual.html`): o corpo e as proporções variáveis (altos, baixos, braços), o esqueleto e as poses, os traços combináveis (cabelo, cor forte, óculos, chapéu, barba com a boca à mostra, tatuagem, cicatriz: a maioria com um, poucos com dois), a roupa em camadas 3D (cubos e esferas), como a roupa vira descrição em palavras, **um sistema só de roupa** (vestir, trocar de roupa, o disfarce e a customização são a mesma coisa; o disfarce e o editor só ganham uso depois), o corpo sentado no carro e o taxista (20), o jogador e o espelho (22). Regras testáveis, como R1–R9.
- → **C4**
- **16.3 O corpo novo:** o modelo, as proporções pela semente, o LOD de longe, a cabeça que vira de forma visível (a linha de visão da 17).
- **16.4 Traços e roupa em camadas** pelo sistema único de roupa (a base de trocar de roupa, do disfarce e do editor), e a descrição em palavras (`pedLook`, `mcSkin`).
- → **C5**
- **16.5 Poses e animação base:** andar, virar suave, sentar, deitar, o celular na mão (a pose irreal da 13.14a), as mãos ocupadas; o desvio entre pedestres na faixa.
- **16.6 O corpo do jogador** no mesmo modelo (visto ao olhar para baixo e no espelho, aparência pela semente) e os balconistas dentro das lojas, nos postos da 13.21.
- → **C6** → **teste do usuário da 16**

## Etapa 17: NPCs vivendo a cidade (5 subetapas, sem polícia)
> A parte de vida do antigo 16. A testemunha, o stealth, a polícia, a prisão e o disfarce foram para depois da 1.0 (decisão de 2026-10-08).
- **17.1 Pesquisa e pedestres sem trilhos:** como outros jogos fazem (GDC/postmortems: Hitman, Assassin's Creed, Shadows of Doubt, RDR2), depois o destino próprio, a área caminhável com custos e o desvio local.
- **17.2 Pessoas dentro dos prédios:** trabalhar e comprar nos postos das lojas; o elevador com NPCs (o jogador com prioridade).
- → **C7**
- **17.3 A casa em postos e as 11 atividades** (ver TV, cozinhar, comer, lavar louça, computador, telefone, ler, dormir, banho, janela, fumar), as luzes da rotina vistas de fora.
- **17.4 Reações a eventos** (olhar a batida, fotografar, postar; correr no apagão) **e ao jogador, sem polícia** ("Can I help you?", "Employees only", o morador que pede para sair).
- → **C8**
- **17.5 As caixas da GridLink nos postes** (o manual dela aplicado no mundo: caixas, vans, uniformes nos técnicos), a base física dos alvos da 18.
- → **teste do usuário da 17**

## Etapa 18: `[HACKING]` Hacking completo e a TI (Opus 4.8)
> O antigo 19, a Trilha de hacking (`docs/roteiro.md`); **o coração da 1.0**: profundo, realista, tudo simulado, a dificuldade vinda de achar o caminho no sistema. Fixar as 5–8 subetapas numa sessão do Opus 4.8 ou com o agente `hacking`. Recebe: **a TI legítima** (computadores e modems físicos com defeito, a base comum dos dois lados), o e-mail e o app cifrado do contratante (Reynard), `tests/apt.ts`, os trabalhos no registro de playtest (13.10p), o semáforo que reverte, o Ferret com o lado escondido, a antena direcional. **Reunião de 2026-10-08:** (a) **fixar as subetapas desta etapa já, numa sessão do Opus 4.8** (numa conta com folga), para que as etapas 13–17 construam o que o hacking pede (portas eletrônicas, câmeras, a luz por cômodo, os registros dos moradores); (b) **uma lista de conferência:** cada sistema hackeável tem pelo menos uma reação visível (manchete, NPC reclamando, luz apagando, fila na loja), o teste das duas camadas aplicado ao hacking.

## Etapa 19: Economia (6 subetapas)
> O antigo 17 (`plano-antigo.md`, `visao.md` "A economia"). Logo depois do hacking porque é o que ele mexe (preços, entregas, a bolsa); hackear o banco é da 18.
- **19.1 A cadeia curta:** fornecedor → loja → cliente, estoque, o caminhão que repõe.
- **19.2 Preços pela falta, visíveis:** a prateleira meio vazia com a etiqueta riscada, o balconista que explica, a notícia.
- **19.3 Salários e o dinheiro dos NPCs;** os bancos com os dias da semana.
- → **C11**
- **19.4 O custo de vida do jogador:** a diária do motel, a comida, o crédito do celular; apertado no começo.
- **19.5 A bolsa** (app e site), seguindo as empresas.
- **19.6 Medir:** um teste em `tests/` que simula a semana do jogador (~5–7 dias até o apartamento, o hacking ~5x a TI).

## Etapa 20: Cozy e a física (5 subetapas)
- **20.1 Um sistema só de física** (usuário, 2026-10-08), sobre os cubinhos: o celular, o notebook, uma bola de basquete, as bolas de sinuca e os itens de decoração caem, rolam e batem pelo mesmo código, que depois conversa com o controle de veículo (21). Manual e pesquisa antes. Primeiros usos: pôr o celular para carregar na tomada (fica lá com o cabo), pôr o notebook na mesa antes de sentar e clicar no que se quer pegar. Os itens de decoração ficam como clutter; os que se usam (a comida no micro-ondas, a sinuca) entram **um por vez**, cada um com o seu modelo e a sua animação, nas etapas seguintes.
- **20.2 Sentar e olhar** (bancos, mesas, balcão do diner), a chuva sob a marquise, ouvir conversas.
- **20.3 O rádio da cidade** no Tunes, com o DJ lendo os eventos reais, e **as vozes num sistema só**: o murmúrio das falas dos NPCs (pela semente) e a voz do DJ estilo Animal Crossing saem do mesmo sintetizador.
- → **C12**
- **20.4 "The usual?"** com memória de verdade, depois de várias idas.
- **20.5 Fotos e postar no Streetwire** (a rede social da 1.0: comentar e postar), e os cidadãos comentando o eclipse.
- **20.6 O jornal de papel:** um manual antes; na banca de manhã, as manchetes reais de ontem em páginas por assunto, com as fotos impressas; uma edição na 1.0, variações depois.

## Etapa 21: Transporte, um sistema de veículo para todos (6 subetapas)
> O antigo 18. **Regra (usuário, 2026-10-08):** um sistema só de controle de veículo (motor, tração, rodas, freio) para os NPCs, o táxi e o jogador; o táxi é um NPC dirigindo. Pesquisa e manual antes de implementar, pegando o melhor de vários jogos (originalidade: a técnica sim, a identidade não).
- **21.1 Pesquisa** (GTA IV/V, Cities: Skylines, a física de BeamNG e My Summer Car) **e o manual do veículo:** o controle (motor, tração, rodas), a IA que dirige por ele, o carro por fora e por dentro (2–3 referências do usuário).
- **21.2 O controle de veículo único** aplicado a todos os carros de hoje; a correção suave depois da curva, a freada progressiva, as batidas menos frequentes, ré e contornar.
- **21.3 Os carros refeitos em cubinhos,** ocos, faróis variados, os dois cones, as luzes do táxi no chão.
- **21.4 Os carros dos cidadãos:** todo carro com dono e destino, a placa, o estacionamento.
- **21.5 O táxi por dentro:** pedir, o banco de trás, o taxímetro, a conversa, pular pagando.
- **21.6 Reavaliar o ritmo do tempo** (no playtest de 2026-10-08, 75% do tempo de jogo foi andando, 42 min/km). **Decidido (2026-10-08): esperar até aqui.** Até lá, os trabalhos da 18 com prazo muito folgado; não balancear antes de os sistemas existirem (o balanço é a 25).
- **Depois da 1.0:** o jogador dirigir (pelo mesmo sistema) e o metrô elevado.

## Etapa 22: Vida do personagem (7 subetapas)
- **22.1 O caderno.** As janelas acesas da 13.22 viram reconhecimento ("o 4º andar apaga às 23h"): anotar no caderno o que se vê da rua.
- **22.2 Dormir no motel e esperar acelerando a simulação** (medir antes no Node).
- **22.3 Necessidades:** sede leve, sono, frio e molhado leves; o app de fitness.
- **22.4 Roupas** (casaco e cabeça) **e o editor no espelho do motel.**
- **22.5 O apartamento:** aluguel semanal, base segura, mobiliado; decorar com itens comprados ou achados, soltos pela física (20.1) e salvos onde ficaram; os adesivos do notebook (15.20c) com ele numa mesa.
- **22.6 A mochila com o formato real** (Cairn) e o mapa de papel com marcas.
- **22.7 Contatos e fofoca:** virar e perder um contato, a mentira pelos fatos, a fofoca pelas relações.

## Etapa 23: Refinamento e variedade (8 subetapas)
- **23.1 Manual de fachadas e de landmarks.**
- **23.2 Fachadas:** a loja virada para a rua com a blade no beco (13.16), o letreiro só do lado certo, as lâmpadas redondas, a fachada que muda ao chegar perto, as placas cinza soltas.
- **23.3 Materiais PBR** (uma tabela só: textura, passo, molhado); junto, a parte de baixo dos lances da escada (hoje quase preta vista de baixo, sem luz de rebote) e o último espelho da escada, que é a face da laje e sai cinza em vez de madeira (13.18).
- **23.4 A praia e o mar** (13.15), o calçadão e o píer; o mar **sempre a oeste** (reunião de 2026-10-08: o pôr do sol no mar visto da cidade). (O Sarcófago e a zona de fogo já foram desligados pela chave `FIRE_ZONE` em `sim/city.ts`, 2026-10-08; a borda é chão liso.)
- **23.5 Clima, 2ª passada:** chuva volumétrica, relâmpagos, a roupa molhada e as poças; a lua e as estrelas (os mares, os god rays, o rastro).
- **23.6 Letreiros, neon e outdoors** com notícias, a surge apagando aparelhos, o neon de dia.
- **23.7 Sinalização e orientação:** o totem YOU ARE HERE, os símbolos 15×15, o diretório e o zoom de ler placas (13.17), a lista telefônica; os terrenos vazios virando feiras, mercados e quadras (nota 10); **a rua mais cheia** (essencial): bancas de jornal, vendedores de comida, as plaquinhas de calçada do Kamurocho. **O zoom (reunião de 2026-10-08, troca o binóculo):** o zoom do olhar subiu para o C8; aqui, para ver longe, a câmera do celular com zoom (que estimula usar a câmera). E dar zoom nas fotos da galeria do celular, como no relógio. Um zoom só para os três.
- **23.8 Os tipos de prédio que faltam** (hotel, banco, galpão, estacionamento, oficina, escritórios e torres, as faixas `*`) e o distrito de entretenimento.

## Etapa 24: Som (5 subetapas)
- **24.1 A batida** por análise por síntese. **24.2 Os passos** por material. **24.3 A chuva e o trânsito.** **24.4 Reverb por lugar e mixagem.** **24.5 A interferência GSM no notebook** e a revisão de ouvido dos sons com o usuário (o murmúrio das falas foi para a 20.3).

## Etapa 25: A primeira hora e o laço (5 subetapas)
> Nova (2026-10-08): a etapa que transforma os sistemas num jogo. Partes tocam o contratante (`[HACKING]`): combinar com o agente `hacking`.
- **25.1 A primeira hora:** acordar no motel, o SMS da diária, o dono do cybercafé às 18h, a máquina de vendas, o mentor (`visao.md`).
- **25.2 O caminho do veterano** (o fórum desde o começo, o fixer que observa) e a ajuda ao jogador travado (contatos, fórum, perguntar aos NPCs).
- **25.3 Investigações geradas** (o começo guiado, o gerador que confere o caminho).
- **25.4 Balanço:** a economia, o ritmo dos trabalhos (um grande a cada 1–2 dias), o tempo andando, pelo registro de playtest.
- **25.5 A sessão longa de teste** com o usuário, do motel ao apartamento.

## Depois da 1.0
**Polícia e calor completos** (a testemunha, o stealth B, a abordagem, a prisão, o disfarce; o plano está no antigo 16 e na entrevista da etapa 16 em `visao.md`), o jogador dirigir e o metrô elevado, cinema, shopping e o resto do catálogo de lojas, a diagonal, o helicóptero, a represa e o porto, o celular inicial barato e o modelo BlackBerry com teclado (tiers), o notebook montado, o mural (só se os casos ficarem longos), o stealth estilo SoD completo.

---

## Os blocos de correção (o backlog, já atribuído)
> ~5 itens cada. Detalhe de cada item em `docs/listas-fixas.md`, `docs/retoques-14-15.md` ou "Bugs conhecidos" do CLAUDE.md. Os que forem feitos saem de lá. Os blocos podem ir ao agente `bugfix` quando forem só correções localizadas.

- ✅ **C1 (o que quebra; 0.13.19b):** confirmar o softlock do motel; `aimedGood` congelando o jogo; CONTINUE sem save; a dica da zona de fogo no título; `tests/makers.ts` falhando.
- **C2 (interiores):** colunas coladas na parede; móveis vazando o relevo (`POS 806.4,905.9`); a chuva nas paredes internas e a chuva decidindo o "dentro" pelo raio (13.10b); as portas de rua que não abrem sozinhas; os postes do andaime e do ponto que não são sólidos. o número de porta repetido vira **522A** no segundo lote (reunião de 2026-10-08); **Do playtest 18-01/18-06 (2026-10-08):** a escada de cima que some e volta no andar 3 do prédio 4375 (`POS 858.7,1187.3`); a cor diferente na faixa da parede da porta (`POS 854.6,1187.4`, andar 2); a porta do motel ainda recuada e com parede invisível (`POS 849.2,1179.6`); a porta que esconde as de trás (`POS 847.3,1177.7`); o vão entre a parede e a porta no 4085 (`POS 866.8,1156.0`). **Os bugs de porta antigos (2026-10-08, do "Bugs conhecidos" do CLAUDE.md):** o quadro da fachada ao cruzar a porta e o vidro da vitrine que some; a coluna escura e o vão preto entre salas; as folhas da 13.10d2 (dobradiça no meio da parede fina). ⚠ C2 passou de 5 itens: os de chuva e postes descem para o C3.
- **C3 (diálogo):** a memória de follow-up ("who won?"); ESC fechando a conversa antes do menu; recapturar o mouse ao despausar; tirar "unrecognized" e centralizar o quadrante do tom (com cor); letras maiores na fala e nas legendas.
- **C4 (celular):** atender e rejeitar pelo mouse; o nome por cima do número no discador; o misclick; o plano de dados gasto no Wi-Fi; o T9 sem "motel"; o Jackdaw 100% pelo mouse; o boot do celular em pixels; o Maps escuro e buscar esquinas.
- **C5 (web e notebook):** a senha curta no webmail; o domínio de e-mail longo; o link "find" do portal; a barra de status do notebook com o navegador; favoritos, abas e links roxos no Ferret; a moldura nova no manual do Ferret; as notas de versão.
- **C6 (simulação e notícias):** limite de manchetes por assunto (e a do apagão depois da luz voltar); posts repetidos no Streetwire; fotos das notícias apontadas; o som do apagão só no quarteirão; a travada à meia-noite.
- **C7 (luz 1):** **o fundo dos glifos seguindo a luz do sol de dia** (hoje escuro; a fadiga visual); a tela do celular clara demais; o bloom do relógio; o blackout claro demais; postes acesos no blackout; a lâmpada das marquises verdes.
- **C8 (placas):** a letra vira ASCII só com uma linha de pontos visível (nota 11, vale para semáforos de pedestre e letreiros); as placas retrorrefletivas (e o fundo pintado do glifo); a placa dentro do braço do semáforo; o OPEN/CLOSED longe da porta; a placa de rua de longe e o "7". **Reunião de 2026-10-08:** o **zoom do olhar** (botão direito segurado sem nada na mão, ~1,5–2×; subiu da 23.7); **uma fonte mais legível nas placas**; e **o contraste: texto escuro em placa escura** some (a placa retrorrefletiva já obriga a mexer no desenho, então os três entram juntos).
- **C9 (relógio e camadas):** os dígitos em sete segmentos na HD; as barras de fome, cansaço e batimento; a luz acendendo com o alarme; o relógio e as legendas atrás do notebook; o brilho do aço e o cristal.
- **C10 (o resto):** o menu com o CCTV de fundo; o botão "voltar" do mouse no Electron; o custo da ligação no orelhão; os agradecimentos pelo sobrenome; os itens do notebook em `draw.ts` (olhar para baixo, teclas através da tampa, luzes maiores).
- **C9 e C10** caem durante a 18 (hacking), mas são correções normais (Opus 5.5 ou agente `bugfix`). **C11, C12 e os blocos das etapas seguintes:** os bugs novos daquelas etapas. Ficam fora do backlog: os retoques grandes de luz (nuvens, cones, sombras, saturação da noite) → 23; o semáforo que reverte → 18.

## O ritmo medido
| Etapa | Estimado | Real | Nota |
|---|---|---|---|
| 13 | ~9 | | |
