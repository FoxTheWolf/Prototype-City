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

| # | Etapa | Subetapas | Blocos | Sessões (estim.) | Antes era |
|---|---|---|---|---|---|
| 13 | Interiores: fechamento | 7 | C1–C3 | ~9 | 13 |
| 14 | Diálogo | ✅ | — | — | 14 |
| 15 | Web e celular | ✅ (fechada; restos distribuídos) | — | — | 15 |
| 16 | **Pessoas (manual + rework)** | 6 | C4–C6 | ~8 | 13.8/13.11/13.14 |
| 17 | NPCs usando a cidade, testemunha, stealth, polícia | 8 | C7–C10 | ~11 | 16 |
| 18 | Cozy (curta) | 4 | C11 | ~5 | cozy |
| 19 | Economia | 6 | C12 | ~7 | 17 |
| 20 | Transporte e carros | 8 | 2 | ~10 | 18 |
| 21 | `[HACKING]` Hacking completo (Opus 4.8) | o Opus 4.8 fixa | — | ~8–10 | 19 |
| 22 | Vida do personagem | 8 | 2 | ~10 | 22 |
| 23 | Refinamento e variedade | 8 | 2 | ~10 | 20 |
| 24 | Som | 5 | 1 | ~6 | 21 |

**Total até a 1.0: ~85 sessões.** No ritmo de ~8 sessões por semana, ~11 semanas. A 21 pode correr em paralelo, em sessões do Opus 4.8, quando o limite semanal deixar.

**Por que esta ordem:** a 16 (pessoas) vem antes da 17 porque quase tudo da 17 depende do corpo (a cabeça que vira na linha de visão, as 11 atividades animadas, a roupa como descrição, o disfarce em camadas, os traços combináveis). Fazer a 17 com o boneco atual e refazer depois seria o erro dos interiores. Os interiores fecham antes porque a 17 precisa dos postos dentro das casas e das lojas, das portas e dos interruptores.

---

## Etapa 13: Interiores, o fechamento (7 subetapas)
> Fecha o rework pelo manual (`docs/plano-interiores.md`) com o que a 17 precisa, e congela. O resto do rework (tipos que faltam, faixas `*` dos lotes fundos, escritórios e torres) vai para a 23.
- **13.18 O retorno do playtest de 2026-10-08:** a escada em U (vão no topo, o piso de cima invisível pelo poço), o travamento perto da escada, o apartamento sem porta e a porta principal na cozinha (e uma regra nova no validador para isso), o recuo dos móveis e da escada da parede. (`plano-interiores.md` passo 9)
- **13.19 Portas e saída (passo 8):** a porta dos moradores achável, a verga, portas e entradas mais largas (~0,9 m), o vidro da porta, o EXIT vermelho só no caminho comum até a rua.
- → **C1**
- **13.20 Mobiliar pela biblioteca, com postos (passo 3):** as arrumações do manual nos cômodos, pela renda e pelo morador (`homeUnit` nasce aqui), e **cada móvel com o posto dele** (onde o NPC fica, para onde olha), que é a base da casa da 17.
- **13.21 Um gerador só: as lojas na gramática das plantas** (regra "um sistema só"): `sim/layouts.ts` entra em `sim/floorplans.ts`; os postos de balconista e de cliente no mesmo formato.
- → **C2**
- **13.22 Interruptores e luz por cômodo (passo 5, R10):** um por cômodo, sala vazia e loja fechada apagadas; é a regra de luz do stealth.
- **13.23 O telhado (passo 4d)** e a última escada chegando nele.
- → **C3**
- **13.24 Escadas de incêndio coerentes com as plantas** (nota 12): as janelas e os patamares batendo com os cômodos; é o caminho alternativo do stealth e da fuga.
- → **teste do usuário da 13**

## Etapa 15: fechada
Os restos foram distribuídos: o boot do celular em pixels, o Jackdaw 100% pelo mouse e o Maps escuro → C4; a moldura nova do manual do Ferret, favoritos/abas/links roxos e as notas de versão → C5; as fotos das notícias apontadas → C6; o brilho do aço e o cristal do relógio → C9; postar na rede social e o eclipse no Streetwire → 18; os adesivos do notebook (15.20c) → 22; a tomada, o infravermelho, o brilho no mundo e o som abafado do Jackdaw, e o CCTV gravado no título → 23; o e-mail e o app cifrado do contratante, `tests/apt.ts` → 21. A pasta de música no navegador sai (o alvo é o Electron).

## Etapa 16: Pessoas, o manual e o rework (6 subetapas)
> Um rework só, planejado para tudo o que as etapas 17, 20 e 22 vão pedir do corpo. Junta 13.8, 13.11 e 13.14.
- **16.1 Arrumar o shader** (antes da demo no plano antigo; sobe para cá): separar `gpu/shader.ts` por assunto, caber em 8 storage buffers, e cortar a compilação de 2–4 min (as funções grandes copiadas em cada chamada). O rework das pessoas mexe muito no shader; cada recarga mais rápida paga o resto do projeto. Logo depois, **o documento da engine** (pedido de 2026-10-08) sai daqui, com o shader já arrumado: o raio por célula, a luz, os interiores, os cubinhos, a camada HD e por que os bugs típicos acontecem.
- **16.2 O manual de pessoas** (`docs/identidade/pessoas-manual.html`): o corpo e as proporções variáveis (altos, baixos, braços), o esqueleto e as poses, os traços combináveis (cabelo, cor forte, óculos, chapéu, barba com a boca à mostra, tatuagem, cicatriz: a maioria com um, poucos com dois), a roupa em camadas 3D (cubos e esferas), como a roupa vira descrição em palavras, o disfarce (colete e capacete), o corpo sentado no carro e o taxista (20), o jogador e o espelho (22). Regras testáveis, como R1–R9.
- → **C4**
- **16.3 O corpo novo:** o modelo, as proporções pela semente, o LOD de longe, a cabeça que vira de forma visível (a linha de visão da 17).
- **16.4 Traços e roupa em camadas,** e a descrição em palavras (`pedLook`, `mcSkin`).
- → **C5**
- **16.5 Poses e animação base:** andar, virar suave, sentar, deitar, o celular na mão (a pose irreal da 13.14a), as mãos ocupadas; o desvio entre pedestres na faixa.
- **16.6 O corpo do jogador** no mesmo modelo (visto ao olhar para baixo e no espelho, aparência pela semente) e os balconistas dentro das lojas, nos postos da 13.21.
- → **C6** → **teste do usuário da 16**

## Etapa 17: NPCs usando a cidade e reagindo ao jogador (8 subetapas)
> O antigo 16 inteiro (`plano-antigo.md`, entrevista em `docs/visao.md`). **Cuidado:** o calor e a polícia moram em `src/sim/heat.ts`, que é `[HACKING]`: a 17.7 e a 17.8 combinam a parte do mundo (Opus 5.5) com o agente `hacking` para o que toca o calor.
- **17.1 Pesquisa e pedestres sem trilhos:** como outros jogos fazem (GDC/postmortems: Hitman, Assassin's Creed, Shadows of Doubt, RDR2), depois o destino próprio, a área caminhável com custos e o desvio local.
- **17.2 Pessoas dentro dos prédios:** trabalhar e comprar nos postos das lojas; o elevador com NPCs (o jogador com prioridade).
- → **C7**
- **17.3 A casa em postos e as 11 atividades** (ver TV, cozinhar, comer, lavar louça, computador, telefone, ler, dormir, banho, janela, fumar), a interrupção por barulho e luz e a volta ao posto.
- **17.4 Reações:** a eventos (olhar a batida, fotografar, postar; correr no apagão) e ao jogador (correr, esbarrar, encarar, entrar onde não pode, mexer num poste); quem está perto ouve (sussurrar, o barulho do lugar).
- → **C8**
- **17.5 A escada da testemunha** (notar → ligar, ouvida → denunciar) e as saídas (sair da vista, conversar, pagar).
- **17.6 Stealth B e apartamentos alheios:** luz, barulho e linha de visão previsíveis, "Who's there?", acender a luz; as luzes do próprio jogador o entregam.
- → **C9**
- **17.7 A polícia:** procura pela descrição, vai ao último lugar visto, abordagem com conversa; o calor sentido no bairro (viaturas, notícias, SMS do mentor).
- **17.8 Prisão e disfarce:** a planta da delegacia (do manual), noite + fiança + confisco + ficha (a cópia da ocorrência na mochila); o colete e o capacete da GridLink numa loja; as caixas da GridLink nos postes (o manual dela aplicado no mundo).
- → **C10** → **teste do usuário da 17**

## Etapa 18: Cozy (4 subetapas, curta)
- **18.1 Sentar e olhar** (bancos, mesas, balcão do diner), a chuva sob a marquise, ouvir conversas.
- **18.2 O rádio da cidade** no Tunes, com o DJ lendo os eventos reais e as vozes estilo Animal Crossing.
- → **C11**
- **18.3 "The usual?"** com memória de verdade, depois de várias idas.
- **18.4 Fotos e postar no Streetwire** (a rede social da 1.0: comentar e postar), e os cidadãos comentando o eclipse.

## Etapa 19: Economia (6 subetapas)
> O antigo 17 (`plano-antigo.md`, `visao.md` "A economia"). O hackear do banco é da 21.
- **19.1 A cadeia curta:** fornecedor → loja → cliente, estoque, o caminhão que repõe.
- **19.2 Preços pela falta, visíveis:** a prateleira meio vazia com a etiqueta riscada, o balconista que explica, a notícia.
- **19.3 Salários e o dinheiro dos NPCs;** os bancos com os dias da semana.
- → **C12**
- **19.4 O custo de vida do jogador:** a diária do motel, a comida, o crédito do celular; apertado no começo.
- **19.5 A bolsa** (app e site), seguindo as empresas.
- **19.6 Medir:** um teste em `tests/` que simula a semana do jogador (~5–7 dias até o apartamento, o hacking ~5x a TI).

## Etapa 20: Transporte e carros (8 subetapas)
> O antigo 18. Começa com 2–3 referências escolhidas pelo usuário.
- **20.1 Pesquisa da IA de trânsito** (GTA IV/V, Cities: Skylines) e **o manual do carro** (por fora, por dentro, o painel e o banco).
- **20.2 Os carros refeitos em cubinhos,** ocos por dentro, faróis variados, os dois cones, as luzes do táxi no chão.
- **20.3 A direção:** a correção suave depois da curva, a freada progressiva, as batidas menos frequentes, o carro batido que some; dar ré e contornar.
- **20.4 Os carros dos cidadãos:** todo carro com dono e destino, a placa, o estacionamento.
- **20.5 O táxi** por dentro: pedir, o banco de trás, o taxímetro, a conversa, pular pagando.
- **20.6 O metrô elevado,** uma linha de 6–8 estações.
- **20.7 Dirigir.**
- **20.8 Reavaliar o ritmo do tempo** com o usuário (o registro de playtest mede).
- Blocos: os bugs que aparecerem nas 20.x.

## Etapa 21: `[HACKING]` Hacking completo
> O antigo 19, a Trilha de hacking (`docs/roteiro.md`). Fixar as subetapas numa sessão do Opus 4.8 ou com o agente `hacking`, seguindo as mesmas regras (5–8, blocos). Recebe: o e-mail e o app cifrado do contratante (Reynard), `tests/apt.ts`, os trabalhos no registro de playtest (13.10p), o semáforo que reverte e a pressão da polícia no trabalho 2, o Ferret com o lado escondido, a primeira hora (o dono do cybercafé, o mentor, o fixer).

## Etapa 22: Vida do personagem (8 subetapas)
- **22.1 O caderno.**
- **22.2 Dormir no motel e esperar acelerando a simulação** (medir antes no Node).
- **22.3 Necessidades:** sede leve, sono, frio e molhado leves; o app de fitness.
- **22.4 Roupas** (casaco e cabeça) **e o editor no espelho do motel.**
- **22.5 O apartamento:** aluguel semanal, base segura, mobiliado; os adesivos do notebook (15.20c) com ele numa mesa.
- **22.6 A mochila com o formato real** (Cairn) e o mapa de papel com marcas.
- **22.7 Contatos e fofoca:** virar e perder um contato, a mentira pelos fatos, a fofoca pelas relações.
- **22.8 Investigações geradas** (o começo guiado, o gerador que confere o caminho).

## Etapa 23: Refinamento e variedade (8 subetapas)
- **23.1 Manual de fachadas e de landmarks.**
- **23.2 Fachadas:** a loja virada para a rua com a blade no beco (13.16), o letreiro só do lado certo, as lâmpadas redondas, a fachada que muda ao chegar perto, as placas cinza soltas.
- **23.3 Materiais PBR** (uma tabela só: textura, passo, molhado).
- **23.4 A praia e o mar** (13.15), o calçadão e o píer; o Sarcófago desligado por chave.
- **23.5 Clima, 2ª passada:** chuva volumétrica, relâmpagos, a roupa molhada e as poças; a lua e as estrelas (os mares, os god rays, o rastro).
- **23.6 Letreiros, neon e outdoors** com notícias, a surge apagando aparelhos, o neon de dia.
- **23.7 Sinalização e orientação:** o totem YOU ARE HERE, os símbolos 15×15, o diretório e o zoom de ler placas (13.17), a lista telefônica; os terrenos vazios virando feiras, mercados e quadras (nota 10).
- **23.8 Os tipos de prédio que faltam** (hotel, banco, galpão, estacionamento, oficina, escritórios e torres, as faixas `*`) e o distrito de entretenimento.

## Etapa 24: Som (5 subetapas)
- **24.1 A batida** por análise por síntese. **24.2 Os passos** por material. **24.3 A chuva e o trânsito.** **24.4 Reverb por lugar e mixagem.** **24.5 O murmúrio das falas** pela semente e a interferência GSM no notebook.

## Depois da 1.0
Cinema, shopping e o resto do catálogo de lojas, a diagonal, o helicóptero, a represa e o porto, o notebook montado, mobiliar livremente, o mural (só se os casos ficarem longos), o stealth estilo SoD completo.

---

## Os blocos de correção (o backlog, já atribuído)
> ~5 itens cada. Detalhe de cada item em `docs/listas-fixas.md`, `docs/retoques-14-15.md` ou "Bugs conhecidos" do CLAUDE.md. Os que forem feitos saem de lá. Os blocos podem ir ao agente `bugfix` quando forem só correções localizadas.

- **C1 (o que quebra):** confirmar o softlock do motel; `aimedGood` congelando o jogo; CONTINUE sem save; a dica da zona de fogo no título; `tests/makers.ts` falhando.
- **C2 (interiores):** colunas coladas na parede; móveis vazando o relevo (`POS 806.4,905.9`); a chuva nas paredes internas e a chuva decidindo o "dentro" pelo raio (13.10b); as portas de rua que não abrem sozinhas; os postes do andaime e do ponto que não são sólidos.
- **C3 (diálogo):** a memória de follow-up ("who won?"); ESC fechando a conversa antes do menu; recapturar o mouse ao despausar; tirar "unrecognized" e centralizar o quadrante do tom (com cor); letras maiores na fala e nas legendas.
- **C4 (celular):** atender e rejeitar pelo mouse; o nome por cima do número no discador; o misclick; o plano de dados gasto no Wi-Fi; o T9 sem "motel"; o Jackdaw 100% pelo mouse; o boot do celular em pixels; o Maps escuro e buscar esquinas.
- **C5 (web e notebook):** a senha curta no webmail; o domínio de e-mail longo; o link "find" do portal; a barra de status do notebook com o navegador; favoritos, abas e links roxos no Ferret; a moldura nova no manual do Ferret; as notas de versão.
- **C6 (simulação e notícias):** limite de manchetes por assunto (e a do apagão depois da luz voltar); posts repetidos no Streetwire; fotos das notícias apontadas; o som do apagão só no quarteirão; a travada à meia-noite.
- **C7 (luz 1):** a tela do celular clara demais; o bloom do relógio; o blackout claro demais; postes acesos no blackout; a lâmpada das marquises verdes.
- **C8 (placas):** a letra vira ASCII só com uma linha de pontos visível (nota 11, vale para semáforos de pedestre e letreiros); as placas retrorrefletivas (e o fundo pintado do glifo); a placa dentro do braço do semáforo; o OPEN/CLOSED longe da porta; a placa de rua de longe e o "7".
- **C9 (relógio e camadas):** os dígitos em sete segmentos na HD; as barras de fome, cansaço e batimento; a luz acendendo com o alarme; o relógio e as legendas atrás do notebook; o brilho do aço e o cristal.
- **C10 (o resto):** o menu com o CCTV de fundo; o botão "voltar" do mouse no Electron; o custo da ligação no orelhão; os agradecimentos pelo sobrenome; os itens do notebook em `draw.ts` (olhar para baixo, teclas através da tampa, luzes maiores).
- **C11, C12 e os blocos das etapas 19–24:** os bugs novos daquelas etapas. Ficam fora do backlog: os retoques de luz grandes (nuvens, cones, sombras, saturação da noite) → 23; o semáforo que reverte → 21.

## O ritmo medido
| Etapa | Estimado | Real | Nota |
|---|---|---|---|
| 13 | ~9 | | |
