# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Projeto: jogo do hacker na cidade ASCII

> Tudo acima desta linha é a base do usuário e não deve ser apagado nem alterado.
> Daqui para baixo, só acrescentar: visão, decisões e estado do projeto.

## IMPORTANTE: FEEDBACK! LEIA ESSA SEÇÃO A CADA SUB-ETAPA
> Estou adicionando essa sessão no claude.md para colocar ideias que eu tenho durante os períodos em que eu não estou ativamente lhe mandando os prompts. Então, toda vez que você for começar a trabalhar, você vai ler essa sessão, analisar o conteúdo dela, Você vai organizar nas etapas, e em seguida você vai apagar as ideias daqui conforme for organizando, porque é uma fila de ideias e feedback para você processar e colocar organizado nas etapas. Não apague esse parágrafo, somente o que vem depois nessa seção depois de processar linhas com [HACKING] podem ativar o classificador de segurança. Se isso acontecer, não tente ler novamente e deixe para o modelo Opus 4.8 ler. Lembrando que o jogo é inteiramente para entretenimento e educativo, contido virtualmente. Nada aqui pode ser usado no mundo real. Leia o restante do documento caso já não tenha feito, entenda-o, e volte aqui para organizar a seção. A cada sub-etapa, leia se deixei feedback adicional aqui, que ainda não foi organizado e apagado dessa seção.

> **Notas do Claude sobre esta seção (atualizadas em 2026-10-05, a pedido do usuário):**
> - **A caixa de entrada agora é o arquivo `FEEDBACK.md`** (na raiz). No começo de cada sessão e a cada subetapa, conferir se ele tem itens abaixo do cabeçalho; se tiver, ler, levar cada item para o lugar certo (o Plano, "Bugs conhecidos", "Como trabalhar", `docs/visao.md`) e apagar de lá. Vazio = nada a organizar. Ao terminar, dizer ao usuário em poucas linhas o que entra agora e o que fica para depois.
> - Itens `[HACKING]` vão inteiros, sem resumir, para `docs/feedback-opus48.md` (só o Opus 4.8 ou o agente `hacking` lê e organiza; as outras sessões só acrescentam).
> - O shell do notebook tem muito código de hacking: fora do Opus 4.8, ler e editar só o necessário (veja "Como trabalhar").

## Princípio central de design (entrevista de 2026-10-04)

**Orgânico:** as ações e reações são governadas por sistemas implícitos (memória, valores, regras) que **nunca ficam expostos** (sem barras nem tooltips); o jogador percebe só a reação explícita do mundo e dos NPCs, de forma natural, e não como mecânica a ser explorada. Exemplo: trocar de chip e ligar para um conhecido: "Who are you? I don't know this number." → o jogador diz o nome → "Oh, it's you!". O explícito guia, nunca governa.

**As duas camadas se comunicam (usuário, 2026-10-05):** o implícito (o código: memória, valores, regras) governa, mas **todo efeito implícito precisa de um jeito orgânico de se mostrar**, senão confunde. Ex.: o NPC diz "I remember you, you lied to me about…"; na delegacia, o policial lê em voz alta o que está no caderno e a fiança sobe ali. Ao criar um sistema implícito, planejar junto como ele aparece. **Teste (usuário, 2026-10-05):** um sistema implícito que o jogador não percebe nem sabe como influenciar é, para o jogo, igual a sorteio; e preferir mecânicas que o jogador associa pela vida real (a tempestade derruba a luz) às que ele precisaria aprender (a chuva cega a câmera). Quando o sistema é complexo (o calor), um **mentor** (o fixer) explica por SMS: "I hear they're investigating you; you left your face on the cameras".

**Ordem dos princípios (usuário, 2026-10-05):** a **caixa de areia** vem primeiro: experimentar sem medo (salvar a qualquer hora, recarga livre) pesa mais que a permanência das consequências; a consequência real é perder o progresso ao voltar.

## Como o usuário gosta de trabalhar (o mais produtivo do projeto, dito por ele em 2026-10-04)

- **Perguntar:** qualquer dúvida vira pergunta ao usuário, em vez de supor.
- **Contestar:** quando algo não valer, discordar direto e explicar por quê, em vez de só executar. As melhores decisões vieram de um contestar o outro (a fatia vertical; TI depende da rede física; o gancho da história é a primeira quest).
- **Entrevistar:** ao planejar uma etapa nova, ou quando houver decisões acumuladas, propor uma conversa: uma pergunta por vez, com a opinião e a recomendação do Claude, gravando as respostas em `docs/visao.md` a cada 3–4 perguntas.

## Opiniões e sugestões do Claude

Ficam em `docs/feedback-claude.md`. Ler só quando for planejar.

## Visão do jogo

- **A visão detalhada, da entrevista de 2026-10-04, está em `docs/visao.md`** (a 1.0, a sandbox de consequências, a história no estilo Noita, TI x hacking, o começo no motel, violência, a web, esperar, dirigir). Ler ao planejar uma etapa.
- Projeto pessoal do usuário, feito só para uso próprio. É um jogo que o usuário sempre quis fazer.
- Uma **cidade muito bem simulada**, desenhada inteiramente com caracteres ASCII, em primeira pessoa.
- O protagonista é um **hacker**. Ele tem um notebook (ou outra interface) com que acessa **a rede da cidade de forma realista** e **influencia a simulação** por meio do hacking.
- A simulação vem primeiro: o hacking só é interessante se a cidade tiver sistemas reais para manipular (trânsito, semáforos, câmeras, transporte, telefones, prédios, pessoas).

## Referências

- **ASCII City (Grow Now! Games):** só referência visual e de clima desde a entrevista de 2026-10-04 (já superada); a base de cidade e transporte é a Liberty City do GTA IV. **Regra de originalidade:** copiar técnica e gênero é permitido; nomes, história, marcos e identidade visual específica não (vale para todas as inspirações).
- **A lista das imagens de `referencias/`** (abrir só as relevantes à etapa: cada imagem custa caro), o mapa do vídeo, como extrair quadros e **as inspirações** (Dwarf Fortress, Qud, CDDA, Zomboid, Hacknet, Uplink, Cyberpunk, Matrix, Shadows of Doubt, GTA IV, megaestruturas) estão em `docs/referencias.md`.

## Decisões tomadas

- **Estética:** noite com a luz amarela de postes de sódio e HUD âmbar/ciano, para se distinguir do verde do ASCII City. A paleta final é a de sódio (decidida na etapa 4).
- **Idioma:** o usuário escreve em português, então as respostas são em português.
- **Stack (decidido em 2026-09-30):** Vite + TypeScript, rodando no navegador. O servidor de desenvolvimento é necessário porque Workers e módulos não funcionam em arquivos abertos com duplo clique. Git para versionar. O `terminal-city.html` fica como referência do protótipo 1.
- **Simulação separada da renderização:** os módulos da cidade e da simulação não conhecem a tela; recebem o tempo e atualizam dados. Assim o núcleo pode ir para um Web Worker, ou para Rust/WASM ou um servidor, se um dia pesar.
- **Aleatória, mas com semente:** cada jogo novo sorteia uma semente, e a cidade, as pessoas e as rotinas saem dela. Com a mesma semente e as mesmas ações do jogador, o resultado é o mesmo. Isso **não** limita a variedade (Shadows of Doubt também usa sementes de cidade). Serve para reproduzir bugs, para salvar só "semente + mudanças" e para o hacking ser previsível e manipulável.
- **Modelo de NPCs no estilo Shadows of Doubt / RDR2:** cada cidadão tem casa, trabalho, relações (cônjuge, colegas de apartamento, colegas de trabalho) e uma rotina com horários. A geração segue esta ordem: malha da cidade → prédios → apartamentos e locais de trabalho → cidadãos → relações → rotinas.
- **Nível de detalhe da simulação:** perto do jogador, os cidadãos andam de verdade. Longe, a posição é calculada pela rotina ("às 14h a pessoa X está no trabalho"), sem simular o caminho. Todos têm identidade persistente; os detalhes podem ser gerados sob demanda a partir da semente.
- **Estilo de hacking:** realista como Hacknet e Grey Hack (terminal, comandos, redes, portas, senhas, logs), mas impactante e divertido como Uplink.
- **Interfaces físicas e diegéticas (esqueuomorfismo), no estilo HighFleet:** tudo o que o jogador usa existe no mundo do jogo e é operado "com as mãos". Botões, interruptores, alavancas, teclados e mostradores, cada um com uma função clara e **com som** ao ser acionado. O usuário gosta muito de coisas que se apertam e fazem barulho, então o retorno tátil e sonoro é prioridade, não enfeite.
- **O acesso depende do lugar físico (estilo GTA IV):**
  - Para usar a internet, é preciso ir a um lugar com rede (um cybercafé, por exemplo), digitar a senha dele, e o sinal do Wi-Fi depende da distância física até o ponto.
  - Um sistema fora da rede (um semáforo, por exemplo) só se hackeia indo até ele, achando a porta de acesso física e conectando o notebook nela.
  - O celular é um objeto: você o tira do bolso e disca números. Também há orelhões. Veja "Design: celular e apps" em `docs/design.md`.
  - O táxi se pede ligando para a central ou fazendo sinal na rua. Dentro dele, o destino é escolhido falando com o motorista ou no painel do táxi, e não num menu abstrato.
- **Terminais progressivos e verbosos:** o usuário adora terminais em que o texto vai sendo composto aos poucos (como uma saída de boot ou de comando), em vez de aparecer de uma vez. Termos técnicos e verbosidade são bem-vindos, **desde que correspondam a algo real no jogo**.
- **Máquinas virtuais com hardware real:** cada computador do jogo tem especificações próprias (CPU, memória, disco, placa de rede, sistema operacional) que o terminal mostra e que **limitam de verdade** o que roda nele (programas que não cabem na memória, processamento lento numa CPU fraca etc.). O limite é do computador virtual, não do PC de quem joga.
- **Impacto sistêmico, no estilo Else Heart.Break():** as ações de hacking mexem com a simulação a ponto de poder causar consequências enormes, até apocalípticas, se o jogador quiser ou não tomar cuidado: quebrar a economia, alterar preços de mercadorias, bagunçar o trânsito, causar acidentes, afetar a vida das pessoas. Mais profundo que Watch Dogs, que é mais roteirizado. Devem existir muitos lugares e sistemas hackeáveis.
- **Época: por volta de 2008 (decidido em 2026-09-30),** no estilo GTA IV. É a época dos primeiros smartphones e da primeira loja de apps, do boom das redes sociais, dos celulares com câmera de baixa resolução, do 3G/EDGE lento, do Wi-Fi com senha, dos cybercafés e dos orelhões ainda em uso. Smartphones convivem com celulares comuns: cada cidadão tem um aparelho diferente. Tudo o que for tecnologia no jogo deve ser plausível para essa época.
- **Época e tom: retrofuturismo noir (ajustado em 2026-09-30).** 2008 é a base das **capacidades** tecnológicas (velocidade de rede, câmeras de baixa resolução, celulares, poder dos computadores), mas o mundo **não precisa se limitar ao que existia de fato em 2008**. A leitura é a de um 2008 imaginado por alguém dos anos 80 e 90, como o Cyberpunk de mesa: mais sombrio, mais noir, com ecos de ficção científica daquela época **na estética** (terminais verdes, neon, corporações, cidade vertical). O tom é **dark noir**, no estilo Shadows of Doubt. A tecnologia não passa muito de 2008: continua proibido o que quebra as capacidades (carros voadores, IA conversacional, realidade aumentada, implantes, netrunning, ciberespaço navegável).
- **Borda da cidade (decidido em 2026-10-05, troca a zona de fogo de 2026-09-30):** **por ora, mar num lado só**; a zona de fogo, o cordão e o Sarcófago saem. Ideias para depois: cada lado com uma barreira diferente unida a uma megaestrutura plausível em 2008 (uma represa com comportas hackeáveis, um pátio ferroviário e porto; `docs/visao.md`).
- **Idioma dos textos do jogo (decidido em 2026-09-30):** inglês por padrão, inclusive os nomes gerados (distritos, ruas, marcos, lojas). Os textos ficam em arquivos de locale, para dar para trocar o idioma depois. As respostas ao usuário continuam em português.
- **Tamanho da cidade: FIXO em ~2×2 km / 4 km² (revisto em 2026-10-06; antes era "parâmetro da geração", 2026-09-30):** o usuário decidiu **não** deixar o tamanho modificável — por desempenho, por bugs e por escalabilidade (a área cresce ~quadrático), e porque travar o tamanho **libera projetar coisas que só funcionam nesse tamanho** (ex.: os 9 setores da grade 3×3, um GridLink por subestação). A cidade de ~2×2 km com ~100 mil habitantes já é tida como ótima. Continua valendo que a geração seja escrita de forma limpa (o tamanho é uma constante, não espalhado por números mágicos), mas **não** haverá menu de tamanho. O desempenho é calibrado para esse tamanho (nível de detalhe e janela carregada em volta do jogador).
- **Estilo urbano: americano, em grade (decidido em 2026-09-30),** como a Liberty City do GTA IV: grade regular, avenidas largas, arranha-céus no centro e bairros mais baixos em volta.
- **Unidades: 1 unidade = 1 metro (decidido em 2026-09-30).** A conversão da escala atual (andar de 0,55 e olho a 0,48, cerca de 1 unidade para 3,5 m) é feita na etapa 2. Valores de referência: olho a ~1,7 m, andar de ~3,5 m, faixa de rua de ~3,5 m.
- **Projetar pensando nas próximas etapas (pedido do usuário em 2026-09-30):** toda decisão de projeto deve considerar as etapas que vêm depois. O que é feito agora como visual deve nascer ligado a dados da simulação, de forma modular, para ser ampliado depois sem reescrever. Exemplo: os letreiros da etapa 4 mostram o nome de uma empresa que existe na simulação (`city.businesses`). Os interiores (etapa 6) e a economia (etapa 13) usam e ampliam esse mesmo registro, em vez de inventar nomes à parte.
- **Texto no mundo: pontos de perto, ASCII de longe (princípio do usuário, 2026-10-01; aplicar sempre):** todo texto que existe no mundo (letreiros, placas, outdoors, telões, placas EXIT, sinais, botoeiras) é desenhado em dois níveis. **De perto**, cada letra é formada por vários pontos (as lâmpadas da fonte 5×7, `bulbOn`/`fontRows` em `signs.ts`, com `o`/`@` pela densidade). **De longe**, cada letra vira um único caractere ASCII, na célula que contém o centro dela (ou a mesma letra repetida numa coluna, quando é estreita e alta). Mais longe ainda, uma faixa acesa. Nunca esticar uma letra ASCII por várias células. **Ajuste (playtest de 2026-10-08):** a letra só vira ASCII quando só uma linha de pontos dela fica visível (placas, semáforos de pedestre, letreiros).
- **Conteúdo seguro (regra do usuário, 2026-10-01):**
  - **Hacking com princípios reais e nomes fictícios (esclarecido pelo usuário):** os princípios seguem os reais, como no Hacknet e no Grey Hack (portas, varreduras, serviços, senhas, logs, redes). **A única coisa que muda são os nomes dos programas**, que viram versões parecidas mas fictícias (por exemplo, "Nmap" vira "Mmap"). Não mudar nada além disso por enquanto. Tudo roda só dentro da simulação do jogo.
  - **Sem violência explícita (regra global, entrevista de 2026-10-04):** nunca mencionar feridos ou mortos; sem atropelamento; batidas sem vítimas; dilemas pesados resolvidos pelo mundo (o hospital, se existir, tem gerador fora da rede). O jogador é livre dentro disso, sem sermão.
  - **As falas dos NPCs** (ligações, SMS, posts, manchetes) ficam limpas: sem palavrão, insulto, conteúdo sexual, violência explícita, nem nada que possa ser sinalizado. O tom noir vem do clima e da situação, não do vocabulário.
- **Render do mundo na GPU com WebGPU (feito na etapa R):** só Chromium/Electron; ficam na CPU a simulação e as camadas de interface (celular, notebook, painéis).
- **Delegar a outras IAs (2026-10-02; reforçado na entrevista de 2026-10-04: delegar mais):** o usuário tem o Gemini (pago) e o ChatGPT (grátis, sem assinatura). Delegar o que é trabalhoso e não depende do código: textos da gramática, pesquisa (referências de 2008, receitas de som), segundas opiniões de arquitetura. Briefings curtos em `docs/tarefas/`, um por tarefa (nunca o CLAUDE.md inteiro); o resultado volta para o Claude conferir, de preferência por script.
- **Toda frase do jogo pela gramática (pedido do usuário na 11.5):** com pesos de idade, gênero e contexto, para cada pessoa soar única. Vale para tudo o que vier (taxistas, posts, sites, notícias): **todo texto novo entra como peças em `locale/text/` e passa por `expand` com a `Sel` de quem fala.**
- **O resultado de um trabalho depende só do que o jogador controla (decidido pelo usuário em 2026-10-03):** nada de sorteio da simulação no sucesso ou no pagamento (quantos carros havia na hora, se houve batida), senão vira um jogo de sorte e frustra. O sucesso confere o que o jogador fez (o disjuntor aberto, o semáforo alterado na janela). Condições que dependem da simulação podem voltar quando o jogador tiver ferramentas para influenciá-las.
- **Objetos de cubinhos (regra de design do usuário em 2026-10-04):** os objetos (carros, mobília, postes, marcos) passam a ser **muitos cubos pequenos** que formam a silhueta e os detalhes ("voxel" na fala do usuário = isto, não grade). O modelo atual de poucas caixas vira **LOD de longe**. Cuidados: custo por célula e por cubo → só de perto (LOD por distância); cubos < ~10 cm não aparecem a 20 m; a GPU precisa de uma grade de ocupação por modelo quando passar de dezenas de cubos. 1º alvo: **o celular (15.19, mudado em 2026-10-07)**, depois notebook, Jackdaw, carros (18) e mobília.
- **O que se segura vira para o centro da tela (regra do usuário em 2026-10-08):** por padrão, cada objeto na mão gira para o meio da vista conforme onde está (o celular à direita gira para a esquerda, o relógio à esquerda para a direita, o do meio de frente); vale para os próximos.
- **Um material e uma luz para tudo o que se segura (regra do usuário em 2026-10-08; aplicar sempre):** o que se fizer no celular (sombreamento, glare das luzes reais, adaptação do olho, materiais) vale igual para o relógio, o Jackdaw, o notebook e o que vier; nada de um aparelho com o sistema novo e outro com o antigo. Ao melhorar um, levar aos outros na mesma subetapa (`bshade` em `gpu/voxBody.ts` é a referência; `voxPassWgsl` e `voxLap` seguem; o glare é `glareOn` em `raycaster.ts`).
- **Efeitos de interface por cima (regra do usuário em 2026-10-04):** bloom, halo, reflexo e brilho de tela são desenhados **depois** do desenho da interface, nunca embaixo (já foi problema no celular, no notebook e no relógio). Atenção ao caso que engana: somar luz sobre uma superfície já clara (o aço do relógio) estoura no branco e o efeito some, parecendo estar atrás; por isso o halo **tinge** o que está embaixo antes de somar (`HALO_TINT` em `gpu/compositor.ts`).
- **MANUAL = LEI (regra do usuário em 2026-10-07, suavizada em 2026-10-08; aplicar sempre):** se existe um manual para uma coisa (`docs/identidade/*-manual.html`: celular, notebook, Ferret, Jackdaw, fabricantes, GridLink, interiores), **ler o manual inteiro antes de mexer nela** (o texto e o `<script>`, que tem as medidas e o comportamento) e segui-lo: forma, medidas, cores, estágios, teclas, sons. **Exceção:** quando o Claude vir algo no manual que não está bom, propõe a mudança e **confirma com o usuário antes** de mudar (nunca em silêncio). (O corpo do celular da 15.19b saiu diferente do manual por não tê-lo lido.)
- **Um sistema só para a mesma coisa (regra do usuário em 2026-10-08; aplicar sempre):** o que é o mesmo tipo de coisa usa **um** sistema, nunca dois paralelos (a luz de dia e a de noite separadas deram muito bug). Ex.: **um gerador de interiores** para o prédio inteiro — a loja do térreo e os andares de cima saem do mesmo formato e do mesmo leitor (`sim/layouts.ts` entra na gramática de `sim/floorplans.ts`). Antes de criar um gerador, procurar o que já faz o mesmo e estendê-lo.
- **Visuais planejados em manuais HTML (regra do usuário em 2026-10-06):** antes de fazer o visual de uma coisa no jogo, desenhá-la num manual de identidade em `docs/identidade/` (livre em HTML/SVG), e o jogo se baseia nele. Modelo: `manual.html` da GridLink.
- **Teclado não gira a câmera (2026-10-06):** Q/E e ←/→ ficam livres para outras funções; só o mouse vira a vista (`DEBUG.keyTurn` traz de volta para teste).
- **Detalhe fino na camada HD (regra do usuário em 2026-10-06; aplicar sempre):** a grade de 80 linhas da interface é para o grosso e simples (texto, caixas, layout). **Ícones, enfeites, gráficos, barras, cabos, brilhos e todo detalhe fino vão na camada HD** (`render/hd.ts`, `HD` pixels por célula; no celular `Lcd.pixel`/`Lcd.hd`, com o desenho em caracteres só como plano B). Ao desenhar algo de interface, perguntar primeiro: "isso fica mais bonito em pixels?". Exemplos já feitos: ícones dos apps (`hdicons.ts`), fotos, visualizador e barra de progresso (`drawSpectrum`/`progress`), o fio do fone.
- **Tudo é código (regra do usuário em 2026-10-04):** o jogo não tem arquivos de mídia: nenhum MP3/WAV, FBX ou PNG. Os sons são sintetizados, os modelos são primitivas, as texturas saem do shader; dados em texto (JSON da gramática, tabelas) são o normal. Transcrever um som gravado amostra por amostra para o código **não** conta como síntese (é um arquivo de áudio disfarçado): para acertar sons, o caminho é a análise por síntese da etapa 21. (Os sons do usuário em `easter eggs/` ficam só no desenvolvimento.)
- **O jogador é o número dele:** na rua é conhecido só pelos últimos quatro dígitos da linha ("0179"); o nome é só de banco/documentos e **nunca** entra na reputação. A reputação (calor, fama, contatos) fica presa ao número: **jogar fora o chip recomeça do zero** (toque de roguelike: some a investigação e o nome que você fez). Os hackers usam um **app de mensagens cifradas** ligado ao número (estilo Signal, nome fictício), não e-mail; o fórum de trabalhos também entra pelo número com SMS. O apelido da cidade **nunca** é "Brownout".
- **História de fundo (adiada pelo usuário em 2026-10-05):** a do fogo caiu junto da zona; a história fica de lado até uma etapa própria, bem mais para a frente.
- **Pessoas no estilo bloco (decidido com o usuário em 2026-10-04, depois de uma pesquisa dele sobre direitos):** o modelo e a aparência são nossos, gerados no código (`pedLook`/`mcSkin`); **nunca** incluir arquivo, textura, modelo, som ou skin da Mojang, nem usar "Minecraft" no nome ou na divulgação. Não há importação de skins (entrevista de 2026-10-04). Se o jogo for vendido, consultar um advogado de propriedade intelectual antes.
- **Escopo da 1.0 e nada de suporte a coisas quebradas (princípio do usuário em 2026-10-04):** as etapas 13 a 22 são o necessário para uma 1.0 completa e jogável; primeiro o jogo inteiro, depois a expansão. O que exige *workarounds* em vez de desenvolvimento (como a avenida diagonal; o motivo dos reworks de luz e interiores) fica para depois da 1.0 (ex.: cinema); ao planejar, preferir a solução que reduz casos quebrados. **O laço mínimo da 1.0:** receber trabalho → ir ao lugar → hackear → a cidade reage → calor → dinheiro → comprar equipamento → trabalho maior. Toda subetapa nova: "alimenta esse laço?"; se não, fica para depois da 1.0.
- **O risco de hackear na 1.0 (2026-10-08):** a reputação no fórum (avaliações, nível; o jogador é anônimo e os trabalhos vêm só do fórum, menos na primeira hora) e a rede que reage (o administrador cidadão que lê os logs, a cidade que aprende); detalhe em `docs/visao.md` e `docs/feedback-opus48.md`.
- **A 1.0 é simulação e hacking, não fuga (usuário, 2026-10-08):** a dificuldade vem da profundidade do hacking (achar o caminho, os exploits, tudo simulado), não de fugir e se esconder da polícia ("isto não é GTA"). **Polícia, calor, testemunha, stealth, prisão e disfarce ficam para depois da 1.0**; o calor de hoje fica congelado.
- **Um sistema de física e um de roupa (usuário, 2026-10-08):** jogar o celular é como jogar uma bola de basquete ou uma bola de sinuca (a mesma física sobre os cubinhos, que depois conversa com os veículos; etapa 20.1); vestir, trocar de roupa, disfarce e customização são um sistema só de roupa (16.4). O Tunes continua de fábrica; o celular barato e o BlackBerry ficam para depois da 1.0.
- **Um sistema de veículo para todos (usuário, 2026-10-08):** NPCs, táxi e jogador usam o mesmo controle de veículo (motor, tração, rodas); o táxi é um NPC dirigindo. Pesquisa e manual antes de implementar.
- **Os dados da simulação são a matéria do hacking:** registros de moradores e funcionários, logs de telefone, câmeras, controle de portas e semáforos vêm da simulação e não são inventados à parte.
- **Quando o hacking cresce (visão do usuário em 2026-10-04):** o hacking depende dos sistemas da cidade, e os principais ainda faltam (a **web**; as pessoas dentro dos prédios). Por isso deve brilhar **a partir das etapas 15 e 16**; antes, uma sessão da trilha só se houver bom alvo com o que já existe.
- **Canais do contratante (2026-10-03):** `sim/jobs.ts` é agnóstico de canal; cada canal é um adaptador. SMS feito (F.1); e-mail na etapa 15; a ligação do contratante com o diálogo (etapa 14), nunca antes (seria um menu "aperte 1").
- **Clima e céu (2026-09-30, feito):** o estado do clima, a data e a hora ficam na simulação, com semente (afetam pessoas e trânsito); as partículas são só render.
- **Dia e noite com calendário (2026-09-30):** o dia tão bonito quanto a noite (o Claude sugere melhorias); o dia e a noite mudam o jogo (de dia mais gente, testemunhas e trânsito; de noite menos vigilância e plantões curtos); hora, dia, estação e ano na simulação, a lua no ciclo de ~29,5 dias, chuva e neve pela estação; um dia = **2 h reais** (`DAY_REAL_MIN` em `sim/clock.ts`, 12x; eram 48 min), com dormir/pular o tempo (5.5).
- **O ano no jogo (decidido em 2026-10-05):** um **2008 alternativo**; o tempo corre e o calendário vira para 2009. Época e lugar são referência, não regra (`docs/visao.md`). **A 1.0 é completa em profundidade, não em largura**: o laço inteiro e polido, sistemas sem provisório, largura contida; depois, atualizações (como o X4).
- **Paleta:** sódio âmbar nos postes, cada fonte com a sua cor (temperatura real, 2026-10-03); fundo dos glifos em 0,24 de noite, **de dia seguindo a luz do sol** (a fadiga visual, 2026-10-08; C7); só ASCII; som sintetizado (Web Audio) desde a etapa 4.

## Plano: o cronograma mestre (2026-10-08)

> **A fonte é `docs/cronograma.md`**: as regras (plano fixo de 5–8 subetapas, triagem em três caixas, um bloco de correção a cada 2 subetapas), as etapas com as subetapas fixas, os blocos C1–C12 com o backlog já atribuído e a estimativa (~85 sessões até a 1.0). O detalhe de cada pedido antigo está em `docs/plano-antigo.md`. Ao fechar uma subetapa: o que ela atendeu vai para `docs/historico.md`, e o cronograma marca ✅. A versão no `CHANGELOG.md` segue o número.

- **Ordem:** 13 interiores, o fechamento (13.18–13.24) → 16 pessoas (16.1 arrumar o shader + o documento da engine) → 17 NPCs vivendo a cidade → 18 `[HACKING]` hacking completo + TI (Opus 4.8) → 19 economia → 20 cozy → 21 transporte (um sistema de veículo para todos) → 22 vida do personagem → 23 refinamento → 24 som → 25 a primeira hora e o laço. A 14 e a 15 estão fechadas. **Polícia e calor completos ficam para depois da 1.0.**
- **Agora:** 13.18 (o retorno do playtest de 2026-10-08: a escada em U, apartamento sem porta, recuo dos móveis; detalhe no passo 9 de `docs/plano-interiores.md`).
- **Numeração nova (2026-10-08):** veja o cabeçalho de `docs/plano-antigo.md`; `docs/visao.md` e outros docs usam a numeração velha.

## Agradecimentos e designs

- **Agradecimentos (easter eggs):** nomes de amigos do usuário em `src/locale/thanks.json`, sorteados por `thanks()` (`names.ts`): cada nome aparece **exatamente uma vez** por cidade, num lugar diferente pela semente. **Cada lugar novo (cidadão, contato, post, manchete) deve entrar no sorteio.** Detalhes em `docs/design.md`.
- **Designs já propostos/implementados:** rede social da cidade e celular e apps em `docs/design.md`; `[HACKING]` pacotes de rede simulados em `docs/design-hacking.md` (só na Trilha de hacking).

## Recado para o próximo Claude

> Regra do usuário (2026-10-05): **sempre que recomendar um chat novo**, reescrever esta seção com o rumo que o próximo Claude deve tomar: a tarefa, o que pedir ao usuário, o que evitar, as suspeitas abertas. Substitui o "peça ao próximo Claude que…" no chat. Curta: só o recado, sem histórico.

- **Sessões na nuvem (2026-10-06):** o usuário usa créditos de nuvem até o limite local voltar; **não adaptar o projeto à nuvem**. Autorizado: a cada subetapa, commit e push na branch da sessão **e na `main`** (`git push origin HEAD:main`); ele recebe com `atualizar.bat`. Na nuvem **não há WebGPU** (o jogo usa 16 storage buffers; SwiftShader aceita 10): o visual só no PC dele. Playtests e retornos das outras IAs chegam como anexos → guardar em `playtest/` ou `docs/tarefas/retorno/` e rodar `tests/playtest-report.ts` (ler o `_report.md`, nunca o JSONL).
- **A SEGUIR (2026-10-08, depois do cronograma mestre):** começar dizendo ao usuário o que o `docs/cronograma.md` prevê para a sessão. A próxima é a **13.18** (passo 9 de `docs/plano-interiores.md`): o vão no topo da escada em U e o piso de cima invisível pelo poço (prédio 4085 da semente 1393987109, `POS 869.7,1146.2`), o travamento ali perto, o apartamento sem porta e a porta na cozinha (e uma regra nova no validador), o recuo dos móveis e da escada. Depois a 13.19, e o **C1** (o que quebra). **Não abrir subetapas fora do cronograma**; retorno novo passa pela triagem. **Pedir ao usuário:** confirmar o softlock do motel (0.13.10o: olhar a porta perto do balcão e apertar F). **Cuidado:** o shader leva minutos para compilar no painel (a 16.1 resolve); toda captura, olhar como jogador.
- **Entrevista do aparelho (GridLink/Jackdaw):** R1–R3 feitas, decisões em `docs/dispositivo-hacking.md` (`[HACKING]`; 9 GridLinks fixos = as 9 subestações; SO do notebook = Osprey, fixo). Rodada 4 futura. Não abrir o agente `hacking` sem perguntar.
- **Falta ver no PC:** 14.4–14.9 (balões, etiqueta, ligação, nomes, pular/agachar; ler `docs/amostra-falas.md`); 15.1–15.8 (os dois painéis, Ctrl+↑, fórum, `apt`, tela inclinada, seleção/colar, se o `lodestar` voltou); o fluxo WEP (`tdump mon` → `wcrack`, agora com `tdump` pré-instalado); QoL do terminal Blocos 1–3; a nota F8 de luz no blackout (`listas-fixas`). **Portas (1ª sessão no PC):** 13.10d2 (folhas entre salas com dobradiça no meio da parede fina), os bugs "Porta e elevador"/"Interiores", 13.10d — trabalho de shader, só com WebGPU; depois 13.10g/h, 13.14.
- **Modo debug (`src/debug.ts`):** `spawnOpenAp`, `aptClandestine` (bruter/wcrack no apt, interino), `showWifiKey` (OFF), `reynard` (o app cifrado instalado e registrado, com a conversa de teste). `webMarks` (os sites canônicos nos favoritos, "(dbg)"). Novos atalhos de debug entram aqui.
- **Retornos guardados ainda não usados:** 10 (GRID DOWN + logos GridLink → identidade visual), 11 (falas da 1ª noite/duas camadas → diálogo), 12 (preços 2008 → economia). 07/08/09 já incorporados (diálogo, plantas).
- **Decisões e princípios:** as novas estão no fim de `docs/visao.md` (datadas 2026-10-05). Princípios no topo do CLAUDE.md: **duas camadas** ("implícito sem retorno = sorteio") e **caixa de areia primeiro**. Crítica do Claude e respostas: `docs/feedback-claude.md` e `docs/visao.md`.
- **Não falar da demo para amigos** como meta (irrelevante por enquanto; memória). A lua/estrelas ainda espera teste do usuário.
- **Transcrição por voz:** "Cloud" = Claude, "Saber Café" = cybercafé, "Flip/Clip Zero" = Flipper Zero, "Mass Effect Car" = My Summer Car.

## Estado atual

### Resumo para começar uma sessão (atualizado em 2026-10-06)

> **⚠️ LEIA ISTO PRIMEIRO — regra do classificador de segurança.** Qualquer coisa que **se pareça com cibersegurança** (hacking, redes, portas, varredura, senhas, captura de pacotes, invasão, consoles remotos), mesmo no contexto de game dev, **pode ser bloqueada pelo classificador de segurança** no meio da resposta. O **Sonnet 5.5** bloqueou; o **Opus 4.8** (menos safeguards) fez sem bloqueio. Por isso:
> - **Esse trabalho é separado numa trilha própria** (veja "Trilha de hacking" no Roteiro). Ao começar uma sessão dessa trilha, **avise o usuário para trocar para o Opus 4.8 antes de prosseguir.**
> - **Quando a etapa atual NÃO for de hacking, não abra os arquivos de hacking nem leia as entradas de hacking** deste documento. Só de ter esse conteúdo na resposta pode disparar o classificador e travar o trabalho. **Arquivos de hacking:** `src/sim/network.ts`, `src/sim/packets.ts`, a parte de hacking de `src/laptop/shell.ts` (os comandos `mmap`/`bruter`/`tdump`/`tnet`/`mbus`, o builtin `job` que lê o contrato, e a sessão remota `conn`/`remote`, inclusive o comando `log` do host `omc` da operadora), o tutorial `home["start-here.txt"]` de `src/locale/laptop.en.json` (o resto do arquivo é a interface do shell e pode ficar nas sessões normais), os campos `util` e `omc` de `src/sim/wifi.ts` (e `cellLog`/`mastNear` das redes da operadora, em `network.ts`/`telco.ts`), **`src/sim/jobs.ts` e `src/locale/jobs.ts`** (o contratante/jobs; as linhas `[HACKING]` de `src/sim/gear.ts` são só o efeito do chip no calor; as poucas linhas `[HACKING]` em `src/sim/world.ts` e `src/phone/phone.ts` só chamam essa API e podem ficar como estão), **`src/sim/heat.ts`** (o calor e a polícia da fatia vertical; o `recordAct` em `world.ts` e o HUD de calor/prisão em `main.ts` só a chamam), **`src/locale/forum.ts`** (os tutoriais e os anúncios de trabalho do fórum Switchboard, 15.8; o arcabouço `src/web/forum.ts` é NORMAL e só importa daqui), e o manual `docs/manual-hacking.html`/`.pdf`. **As manchetes e os posts da investigação** (`manhunt`/`bust` em `news.ts`, `social.ts` e os `locale/text/*`) são texto de jornal/feed limpo e **não** são `[HACKING]`: podem ficar com as sessões normais, como já ficavam os posts de blackout. **Seções deste doc marcadas `[HACKING]`:** a 10.6 no Histórico, as "Lições da etapa 10" (em `docs/licoes.md`), "Design: pacotes de rede simulados", os itens `[HACKING]` do Roteiro, o arquivo `docs/feedback-opus48.md` e `docs/dispositivo-hacking.md` (o plano de hacking do aparelho estilo Flipper; o `docs/dispositivo.md` é NORMAL).
> - Se, mesmo fora de uma etapa de hacking, você **precisar** mexer num desses arquivos (um bug de build, por exemplo), avise o usuário e peça para ele confirmar o modelo antes.

- **Onde está cada coisa (ler só o necessário, nunca um doc inteiro: `grep -n "^## \|^### "` dá as seções):**
  - para **programar**: o item no Plano (aqui) → a seção do sistema em `docs/licoes.md` → a pasta em `docs/mapa.md` → só então o código;
  - para **testar no navegador**: "Como testar no navegador do app" em `docs/tecnico.md` (portas, `?seed=42&mute`, `window.world`, `gridText`); as teclas também estão lá;
  - para **planejar** uma etapa nova: `docs/visao.md` (a visão e as decisões da entrevista) e `docs/feedback-claude.md`;
  - **só quando a tarefa pedir:** `docs/historico.md` (o que já foi feito, por etapa), `docs/referencias.md` (imagens e inspirações), `docs/design.md` (rede social, celular, agradecimentos), `docs/roteiro.md` (etapas antigas, ideias futuras e a Trilha de hacking `[HACKING]`), `docs/design-hacking.md` (`[HACKING]`).
- **Onde estamos (2026-10-06):** etapas 1–11, R (GPU), 12 (celular), luz (A/B/L) e a fatia vertical (F.1–F.9) feitas; várias esperam teste no PC. A 13 fechou o que dá na nuvem (portas/plantas esperam o PC), a 14 (diálogo) fechou, a 15 (web) quase: **15.1–15.8 feitas (inclui 15.8c), falta a 15.9**; 15.7e QoL quase toda (ver `docs/terminal-qol.md`). **Comece pelo "Recado para o próximo Claude".** Plano completo em "Plano: etapas 13 a 22".
- **Na Trilha de hacking** a etapa 10 está fechada (10.6 e 10.11, Opus 4.8); o que falta dela está no Roteiro. O retorno do usuário sobre a 9 B/C, a 10 (grupo C, 10.7–10.11) e o manual de hacking (`docs/manual-hacking.pdf`) pode chegar a qualquer momento.
- **Antes de começar qualquer etapa, leia a seção "Lições da etapa N" do sistema em `docs/licoes.md`** (índice nas notas técnicas): são o conhecimento acumulado das sessões anteriores (a 7 tem como testar a simulação sem o jogador; a 8, como testar o celular).
- **Caches (A.3):** o Electron serve sempre na porta 47180 (a mesma origem, então o Chromium guarda os shaders compilados e o `localStorage`; o shader só recompila quando o texto muda, sem flag). A população de cada semente fica em IndexedDB (`src/popCache.ts`), com a chave pelo hash do código que a gera (`?raw` de `city`, `citizens`, `telco`, `power`, `interior`, `device`, `rng`, `world`); `?fresh` força gerar de novo. Se a população passar a depender de outro arquivo, acrescentá-lo à lista.
- **Rodar:** `atualizar.bat` traz a `main` do GitHub (`git pull origin main`, e `npm install` se o lock mudou); `iniciar.bat` ou `npm run dev` (porta 5173, a do usuário); **`jogar-electron.bat`** (ou `npm run electron`) faz o build e abre em tela cheia no Electron, que é como o usuário testa ao dar retorno (R.37). O Claude usa a configuração `claude-dev` (5180) ou `vite-auto`. `?seed=42` fixa a cidade; `?mute` começa sem som. **Precisa de WebGPU** (Chromium/Electron): o mundo inteiro é desenhado na GPU desde a R.17.
- **Teclas:** a lista completa (jogo, celular, visual, interiores, debug) está em `docs/tecnico.md`. Debug mais usado: **F3** linhas de debug, **F4** paletas lado a lado, **T**/Shift+T hora ±1 h, **Y** clima, **F6** subestação mais próxima, **C** câmera de segurança, **PageUp/PageDown** andar.
- **Desempenho:** no PC do usuário (monitor de 180 Hz; ele nota quedas). Desde a R.17 o mundo é desenhado só na GPU (compute shader, um raio 3D por célula); o `DRAW` da linha de status é o tempo da fila da GPU (`onSubmittedWorkDone`, ~3 ms aqui, contando a espera). O thread principal ainda prepara as listas do quadro (luzes, objetos: ~1 ms). Toda novidade deve ser medida antes e depois.
- **Ordem do quadro:** `main` em `gpu/shader.ts`, por célula: o andar em volta (`roomWalk` com `inView`), a cidade (`cityCell`: céu, Sarcófago, chão, paredes, telhados, cerca), fumaça, objetos, o vidro visto de dentro, `finish`, e por fim chuva e neve (`fallOver`).
- **Bugs registrados para depois:** veja "Bugs conhecidos".

### Histórico

O registro detalhado de tudo o que foi feito, etapa por etapa (com nomes de funções, medições e o retorno do usuário), fica em **`docs/historico.md`** (movido em 2026-10-02 para o CLAUDE.md pesar menos em cada mensagem). Ler só a parte da etapa em que se está trabalhando. Lá também estão o plano da etapa 10, a preparação da etapa 6 e os designs já implementados (rede elétrica e blackout, física dos carros). **Ao fechar uma subetapa, a entrada nova do Histórico vai para lá** (no topo), e aqui só o Resumo é atualizado. As entradas `[HACKING]` de lá seguem a mesma regra: não ler fora da Trilha de hacking.

## Bugs conhecidos (para uma etapa de correção mais adiante)

Pedido do usuário em 2026-09-30: registrar os bugs sem perder tempo com eles agora; haverá uma etapa de correção de bugs mais para frente.

- Os bugs abertos agora estão no **Plano** (nas etapas e nas listas fixas, `docs/listas-fixas.md`). Bugs novos entram aqui até a próxima organização.
- **`aimedGood` quebra o laço (visto em 2026-10-08):** ao pôr o jogador por script dentro de uma loja (`POS 852,948`, semente 42), `shop.ts` `aimedGood` lê `.biz` de `undefined` a cada quadro e o jogo congela. Proteger o caso sem loja/sem prateleira.
- **Dica do título desatualizada (visto em 2026-10-08):** "Stay away from the fire zone beyond the fence…" em `src/locale/tips.json`, mas a zona de fogo saiu (borda = mar). Tirar ou trocar as dicas da zona de fogo.
- **`tests/makers.ts` falha (visto em 2026-10-07, já antes da 15.20b):** "the player starts on the giant" (3 vezes); olhar o que mudou no fabricante do celular inicial.
- **CONTINUE escondido clicável sem save (visto em 2026-10-07):** no título, sem save, existe um botão CONTINUE invisível; clicado (por script), `saved` é `undefined` e o `main.ts` quebra em `saved.seed`. Para o jogador não acontece (não dá para clicar no invisível), mas o `titleChoice` devia ignorar CONTINUE sem save.
- **Posts repetidos no Streetwire (visto na 15.17g, semente 42):** a mesma pessoa posta quase a mesma frase duas vezes em poucos minutos ("tried to fix the sink…" às 3 e às 4 min; o Eric Shi duas vezes aos 3 min). Olhar a geração em `sim/social.ts` (um intervalo mínimo por autor, ou não repetir o `pick`).
- **Relógio e legendas atrás do notebook ao mover a câmera (feedback 2026-10-06):** com o notebook levantado, o relógio de pulso e as legendas (barks/legendas de pedestres) são desenhados **atrás** da tela do notebook quando a câmera se move. Fere o princípio "efeitos/UI por cima": a ordem de composição do relógio e das legendas deve vir **depois** do notebook. Visual, conferir no PC (GPU/compositor).
- **Interiores (capturas de 2026-10-05):** coluna escura no meio de alguns vãos; folhas parecendo um módulo à frente; uma porta esconde as de trás (`peekRoom` não segue?); vão preto entre salas; a lavagem dos holofotes (`floodH` no `wallCell`) ainda pinta faces encostadas no vizinho.
- **Porta e elevador (`referencias/52–60`):** ao cruzar a porta, **um quadro mostra a fachada de fora** no lugar do interior (52), e depois **o vidro da vitrine some** (53); a rua vista de dentro parece água (55, 59); o resto em `docs/feedback-claude.md` (olhar cego); elevador dentro de um cômodo, **oco**, de frente para a janela de um apartamento, e uma cunha preta na borda do corredor (56–57).
- **A silhueta das janelas da fachada aparece através de NPCs e objetos** (`referencias/74`, `75`; de novo em 2026-10-08 num poste e na placa de rua): **corrigido em 0.13.10l, falta o usuário ver no PC** (a vista através da janela, 13.10b2, era misturada no fim do `main` do shader mesmo com um objeto na frente; agora só onde a célula ainda mostra o cômodo).
- **Placa de rua ainda pouco legível de longe (usuário, 2026-10-08):** melhorou, mas não basta; retocar na 13.7 (o nível de longe das letras). **Notas F8 de 2026-10-08** (`playtest/2026-10-08_12-31-47_seed459610738_note1-2.png`): o "7" quase ilegível; nas placas de sinalização usar o **fundo do glifo pintado** (como nos letreiros), não só o glifo, e onde o letreiro seria emissivo a placa é **retrorrefletiva**.
- **Placas cinza soltas no ar** no alto à esquerda (semente 711445483, `POS 771.2,971.9`, 21:08, comparação de 2026-10-05): parecem pedaços de fachada ou sacada sem prédio embaixo.
- **Luzes do táxi no chão (2026-10-05):** a luz do teto estoura num retângulo amarelo e as duas lanternas traseiras se somam no asfalto até ficar esbranquiçado; a traseira lilás pelo farol de trás.
- **Travada à meia-noite (retorno do usuário em 2026-10-04):** a simulação recalcula muita coisa na virada do dia e o jogo trava um instante. Espalhar esse trabalho por vários quadros (como o carregamento do começo), em vez de um fade com barra (que atrapalharia numa perseguição). Achar o que roda na virada (provavelmente as rotinas do dia em `sim/citizens.ts`/`world.ts`).
- **`isOpen` não sabe o dia da semana (2026-10-04, visto na 13.3):** os bancos aparecem abertos no fim de semana sem ninguém no caixa (`sim/telco.ts`); dar os dias à tabela de `placeTypes.ts`.
- **Fachada que muda bruscamente ao se aproximar:** a faixa de transição foi alongada na R.34 (esperando o teste do usuário). Se ainda aparecer, comparar as cores do visual de longe (`cF` em `wallCell`) com a média do detalhado: o de longe parece mais claro (parede marrom) que o de perto (vidros escuros).
- **Semáforo reverte / "pouco tempo antes de ser pego" (retorno do usuário em 2026-10-03):** no trabalho 2 o usuário sentiu que "não consegui deixar o semáforo por tempo suficiente" e anotou "o semáforo volta ao normal". Investigar (a) se algo zera `S.sig` sozinho (o trabalho fecha no instante em que fica fora do normal, então reverter não falha o trabalho, mas confunde); (b) se a pressão da polícia (F.2, `heat.ts`) chega rápido demais no trabalho 2 — talvez a janela/escala precise de folga. Diagnóstico de batidas nas "Lições da 10.10".

## Notas técnicas

O resto das notas técnicas (projeção, unidades, atlas, onde mexer na variedade, defeitos visuais conhecidos) e **como testar no navegador do app** estão em `docs/tecnico.md`.

### Lições aprendidas: índice (o texto está em `docs/licoes.md`)

Antes de mexer num sistema, ler só a seção dele em `docs/licoes.md` (`grep -n "^### " docs/licoes.md` dá as linhas). A seção `[HACKING]` só na Trilha de hacking.
- Lições da escada em U (o prédio sumindo com a cabeça no poço, escada que não empilha, R11, testes que empacotam o JSON), para não repetir
- Lições do rework dos interiores (corte americano, ambiente aberto, janelas fantasmas, Shape.Vox, física da escada), para não repetir
- Lições do manual de interiores (toda célula alcançável, porta contra parede, contornos por script, texto barato gerado pelo Claude), para não repetir
- Lições das placas de rua (0.13.7: Board é de outdoor, `plate`, direita = -y, poste perto parece o mesmo), para não repetir
- Lições do moiré e do fantasma (0.15.58: média na pegada do pixel, amostras tremidas, centro de botão redondo), para não repetir
- Lições do vidro unificado (0.15.56: manchas, select int no WGSL, efeito só nas células, canto atrás do olho), para não repetir
- Lições da 15.20a (barra do Osprey, áreas, várias artes numa chave), para não repetir
- Lições da 15.21 (relógio: textura no lugar da HD, um passe por aparelho, underGlass), para não repetir
- Lições da 15.20b (notebook em cubinhos: câmera linear no pixel, tampa como outra câmera, clique pelo raio), para não repetir
- Lições do desempenho do celular (DRAW, pintor 2D, PNG idênticos), para não repetir
- Lições do fim da 3b (mapa em cache por grade, camadas da web, testes por `last`), para não repetir
- Lições da 3b do celular (apps em pixels), para não repetir
- Lições da 15.19b v2 (corpo na GPU, tela de toque), para não repetir
- Lições da 15.19b (trilho, sombra, capinhas, telas em pixels), para não repetir
- Lições da 15.17j (selos, Burrow Labs, grade do celular), para não repetir
- Lições da 15.17h (rastreador, linhas da moldura nos testes, crases no Bash, sem ASCII na web), para não repetir
- Lições da 15.17g (páginas canônicas: ordem dos ops de fundo, tags em alta), para não repetir

- Lições da 15.16–15.17f (tela como textura, pintor 2D, Ferret, PNG de teste), para não repetir
- Lições da 0.15.13–14 e da identidade visual (teclas de mídia, seek, hitbox, logos SVG), para não repetir
- Lições da 0.15.10–12 (título, celular, música, camada HD), para não repetir
- Lições da 15.9 (música, fone, Reynard), para não repetir
- Lições da 15.7e-f4 (Bloco 3 readline; clique só no wm), para não repetir
- Lições da 15.7e-f3 (Bloco 2: drop-up de completar), para não repetir
- Lições da 15.7e-f2 (tdump contínuo, iwconfig, teclas no playtest), para não repetir
- Lições da 15.7e Bloco 1 (realce + ghost no terminal), para não repetir
- Lições da 15.7e c/d (campos do terminal: `fieldAt`, `argTemplate`), para não repetir
- Lições da 15.8c / debug (fórum por número, formulários, `src/debug.ts`), para não repetir
- `[HACKING]` Lições do WEP crack (0.19.2), para não repetir
- Lições da 15.8 / 19.1 (fórum, apt, saves do notebook), para não repetir
- Lições da etapa 13 (portas, interiores e céu), para não repetir
- Lições do processo (documentação e conversas), para não repetir
- `[HACKING]` Lições da etapa 10 (notebook e hacking), para não repetir
- Lições da F.6 (salvamento e menu), para não repetir
- Lições da reescrita da luz (L), para não repetir
- Lições da etapa R (render na GPU), para não repetir
- Lições da 11.5 (gerador de textos e apps), para não repetir
- Lições da etapa 11 (cidadãos, rotinas e rede social), para não repetir
- Lições da 10.10 (direção sem trilhos), para não repetir
- Lições da segunda parte do bugfix, para não repetir
- Lições da primeira parte do bugfix, para não repetir
- Lições da etapa 9 (rede de telefones e celular), para não repetir
- Lições da etapa 8 (navegação e celular), para não repetir
- Lições da etapa 7 (trânsito), para não repetir

- **Regras da arquitetura:**
  - `src/sim/` nunca importa nada de `src/render/` nem do DOM. O render só lê o estado da simulação.
  - **Uma fonte só para cada geometria (2026-10-04):** a simulação calcula (portas, folhas, móveis, paredes) e a GPU só lê. Nunca recalcular no shader o que a CPU já calcula: os dois divergem (foi o bug das portas da 13.10d).
  - Toda aleatoriedade da simulação vem de `world.rng`, nunca de `Math.random`, para manter o determinismo.
  - Detalhes só visuais (textura do chão, janelas acesas) saem de `hash3` da posição. São fixos e não piscam.
  - A geração da cidade é a exceção a `world.rng`: a grade usa `mulberry32(seed)` e cada quarteirão usa `mulberry32(hash3(seed, i, j))`. Continua determinística, e cada prédio tem identidade pela posição.
- **Interpolação:** tudo o que se move na simulação guarda a posição do tick anterior (`px`, `py`), e o render interpola com `alpha`. Qualquer entidade nova que se mova deve seguir esse padrão, senão treme.

## Como trabalhar neste projeto

- **Cronograma e triagem (regra do usuário em 2026-10-08; a mais importante desta seção):** seguir `docs/cronograma.md`. Cada etapa tem 5–8 subetapas fixas e não cresce; todo retorno do usuário é triado em **quebra** (na hora), **ajuste** (próximo bloco de correção) e **depois** (uma etapa com número); a cada 2 subetapas, um bloco de correção de ~5 itens. O usuário é perfeccionista e não sabe gerenciar o tempo, e pediu ao Claude que gerencie por ele: contestar retoques que não alimentam o laço, dizer no começo da sessão o que está previsto, cortar quando estourar, e anotar o ritmo real no fim de cada etapa.

- **Ler só os arquivos e as imagens de referência da etapa atual.** Continuar no mesmo chat enquanto valer em contexto e limite; o Claude avisa quando não valer (sem regra fixa por etapa; entrevista de 2026-10-04).
- **Três contas, limites separados (usuário, 2026-10-08):** o usuário usa três contas com renovações semanais diferentes. O horário da próxima sessão e o conselho de limite saem **só do `get_usage` da conta atual**, dito no chat; **nunca gravar horários de renovação ou de sessão nos arquivos** (as outras contas leem os mesmos arquivos). O cronograma conta em sessões, não em datas.
- **Aconselhar pelo limite semanal (regra do usuário em 2026-10-08):** além do de 5 h, ler o limite semanal no `get_usage` e dizer ao usuário até onde vale ir agora e quando seria bom a próxima sessão, pelo tempo que falta para renovar (horário de Brasília). No começo da sessão, perto do fim de uma janela de 5 h e ao sugerir um chat novo.
- **Bugs simples pelo agente `bugfix` (regra do usuário em 2026-10-04; substitui as sessões com o Sonnet):** as correções da "Lista fixa: correções pequenas" (`docs/listas-fixas.md`) vão para o agente `bugfix` (Sonnet 5.5, esforço médio), chamado de dentro da sessão, em lote. O agente `hacking` roda no Opus 4.8 com esforço médio (`effort` no cabeçalho de `.claude/agents/*.md`). O que é de projeto (render, simulação, sistemas novos) fica com o Opus.
- **Olhar o limite de 5 h (regra do usuário em 2026-10-04):** no começo e de tempos em tempos, ler o uso (`get_usage`) e planejar a sessão pelo que sobra. Um agente custa pelo menos ~5% do limite por uso (ele relê o contexto): só chamar quando valer.
- **Testar sem o navegador sempre que der (pedido do usuário em 2026-10-04):** uma pasta `tests/` com scripts que rodam a simulação no Node (empacotados com `npx rolldown`, como nas "Lições da 11.5"): comprar, pagar, furtar, fome, bateria, pedir direção, trabalhos, save. O navegador fica para o que é visual. **Quando for preciso medir desempenho, avisar o usuário antes para ele abrir o painel**, em vez de perder tempo com o laço parado. A pasta existe desde a 13.10a (como rodar em `docs/mapa.md`; uma semente por execução).
- **Relatório depois de cada playtest (13.10p):** quando o usuário testar com `jogar-playtest.bat`, rodar `tests/playtest-report.ts` (ler o relatório, nunca o JSONL cru) e responder com as notas e o que fazer delas, as frases não entendidas, onde travou, o mapa do percurso e a análise do Claude (o estranho e as alterações sugeridas pelo jeito de jogar).
- **Posições de ouro (aceito em 2026-10-04):** uma lista fixa de vistas (semente 42, POS, hora, direção) que o Claude fotografa e compara a cada grupo, antes de pedir o teste do usuário. Escolhidas (2026-10-05): rua de noite, dentro de uma loja, do alto de um prédio, dia com chuva; a lista nasce na próxima sessão de código.
- **Opinar sempre (pedido do usuário em 2026-10-03; regra atualizada em 2026-10-04):** dar sugestões técnicas e criativas ao longo do trabalho, **a cada etapa**. O feedback vai para **`docs/feedback-claude.md`** (datado, o mais novo em cima), e **todo feedback escrito lá também é mandado no chat**, para o usuário não precisar procurar. A seção "Opiniões e sugestões do Claude" do CLAUDE.md fica como histórico; o novo vai para o arquivo.
- **Reunião no fim do limite (regra do usuário em 2026-10-04):** os últimos ~10% de cada janela de 5 h ficam para uma conversa sobre o estado do jogo (de preferência num chat novo, que gasta pouco): o que foi feito, o que vem, o que mudar. O Claude olha o `get_usage` e, perto de 90%, para o trabalho e propõe a reunião.
- **Ouvir o agente `hacking` sobre ideias (pedido do usuário em 2026-10-04):** de vez em quando, perguntar a ele que missões e sistemas de hacking fariam sentido com o que já existe (ele conhece o que o Claude não lê), ou propor ao usuário uma sessão com ele. Pesar o custo (~5% por chamada).
- **O agente `bugfix` só com a lista cheia (pedido do usuário em 2026-10-04):** esperar acumular muitas correções e mandar todas de uma vez; cada chamada custa ~5% do limite.
- **Separar o hacking (classificador de segurança):** veja a regra no topo de "Estado atual". Trabalho de cibersegurança vai para a "Trilha de hacking" do Roteiro, com o Opus 4.8 e aviso ao usuário no começo. **Fora de uma sessão dessa trilha, não abra os arquivos de hacking nem leia as entradas `[HACKING]`**, para não travar a resposta no classificador.
- **Delegar a Trilha de hacking ao agente `hacking` no mesmo chat (regra do usuário; teste passou em 2026-10-03):** o agente `.claude/agents/` roda no Opus 4.8 e escreveu conteúdo de hacking (as dicas da tela de carregamento em `src/locale/tips.json`) sem bloqueio. Fica a critério do Opus 5.5 o que delegar e quando, pesando se vale gastar os tokens do agente (ele começa sem contexto) em vez de abrir um chat novo com o Opus 4.8: tarefas pequenas e bem cercadas vão para o agente; sessões grandes da trilha continuam num chat próprio. O Opus 5.5 não lê o que o agente escreveu de hacking além do relatório dele.
- **Registrar o hacking a CADA subetapa (regra do usuário em 2026-10-03):** sempre que uma subetapa criar ou tocar conteúdo que **se pareça** com cibersegurança (um arquivo, uma função, uma seção), marcar **no código** (comentário `[HACKING]` no topo do arquivo e nas linhas) **e no documento** (a lista "Arquivos de hacking" e, se for o caso, uma entrada `[HACKING]`), para as sessões normais (Opus 5.5) não abrirem e travarem no classificador. **O próprio contratante/jobs aciona o classificador** (contratar um apagão lê como ataque real), por isso ele é Trilha de hacking mesmo sendo "sessão normal" no plano.
- **Agrupar subetapas:** o Claude junta várias subetapas num grupo e faz tudo de uma vez, sem perguntar no meio; cada subetapa tem o próprio commit. A leitura da caixa de feedback e a limpeza do documento acontecem no começo e no fim do grupo.
- **Grupos são relatórios de estado, não portões (entrevista de 2026-10-04; substitui os testes agrupados):** cada subetapa tem o próprio commit; ao fim de um grupo, dar o estado ao usuário e **seguir sem esperar aprovação**. Ele testa quando quiser, com mais coisa de uma vez, e deixa o retorno na caixa de feedback.
- **TODA captura de tela dentro do jogo: depois de olhar o que se está testando, mais 5 segundos olhando a imagem INTEIRA como um jogador que não conhece o código (regra do usuário em 2026-10-04, reforçada com puxão de orelha em 2026-10-07):** procurar qualquer coisa estranha fora da tarefa (bordas, texto esticado, peças faltando, fontes diferentes, perspectiva distorcida, cores erradas); só depois seguir. Dizer o que achou numa linha e consertar se for da tarefa, ou anotar em "Bugs conhecidos". (Em 2026-10-07 o notebook passou com texto da tela esticado nas bordas, teclas sem legenda, F10 numa fonte diferente do F9 e perspectiva cisalhada, tudo visível nas capturas e não visto.) Testes fora do jogo (PNGs de teste) não precisam.
- **Crítica estética do próprio trabalho (pedido do usuário em 2026-10-05):** junto dos 5 segundos, julgar se o que foi feito está bonito ou básico demais; se estiver fraco, refinar ou ao menos dizer ao usuário e perguntar se vale outra passada. Pesa mais em coisa nova (o caderno, os carros).
- **O CLAUDE.md tem teto (regra do usuário em 2026-10-04; revista em 2026-10-06):** **gatilho em 100 mil caracteres; quando passar, enxugar até ~90 mil** (`wc -c CLAUDE.md`). A faixa 90–100 mil é folga de trabalho: **não** enxugar a cada acréscimo (gastava mais contexto limpando do que economizava), só quando cruzar os 100 mil. **Medir e enxugar apenas no fim de uma etapa ou no fim do limite de 5 h** — não no meio de uma subetapa. Nas sessões de entrevista pode passar; perto do limite de uso, pedir para deixar o enxugamento para a sessão seguinte. Aqui fica só o que é lido em toda sessão: a base do usuário, a caixa de feedback, os princípios, as decisões em uma linha, o Plano do que **falta** (um item curto por pedido), o Resumo, os bugs abertos e estas regras. **Todo acréscimo longo vai direto para `docs/`**, nunca para cá: visão e conversas com o usuário → `docs/visao.md`; o que foi feito e o texto de subetapas fechadas → `docs/historico.md`; lições → `docs/licoes.md`; designs → `docs/design.md`; teclas, notas técnicas e como testar → `docs/tecnico.md`; roteiro antigo e Trilha de hacking → `docs/roteiro.md`; módulos → `docs/mapa.md`. Aqui entra só uma linha com o ponteiro. **Ao enxugar:** subetapas ✅ viram uma linha, regras substituídas vão para o histórico, decisões implementadas encolhem.
- **Teste do Claude novo, antes de sugerir um chat novo (regra do usuário em 2026-10-04):** imaginar que se é um Claude que nunca viu o projeto e vai fazer a próxima tarefa só com o CLAUDE.md. Conferir: o Resumo aponta a tarefa certa? O item no Plano diz o que fazer, onde mexer e como conferir? O que foi combinado na conversa (planos, decisões, suspeitas) está no item, e não só no chat ou num doc que ele não abriria? Corrigir o que faltar e **reescrever a seção "Recado para o próximo Claude"** com o rumo antes do commit. É barato agora e economiza muitos tokens de busca na sessão seguinte.
- **Lições a cada sessão (regra do usuário em 2026-10-04; vinham sendo esquecidas):** no fim de **toda** sessão, e **sempre antes de sugerir um chat novo**, escrever em `docs/licoes.md` o que a sessão ensinou (bugs e a causa, o que travou, como foi testado, armadilhas do código e da máquina, o que mediu caro), na seção da etapa, mesmo que sejam duas linhas, e uma linha no índice das notas técnicas se a seção for nova. Se não houve lição, dizer isso ao usuário.
- **Ao terminar uma etapa (regra obrigatória, pedida pelo usuário em 2026-10-01; não esperar que ele peça):**
  1. **Anotar as lições aprendidas** numa seção "Lições da etapa N" em `docs/licoes.md` (e uma linha no índice das notas técnicas): os bugs que apareceram e a causa, o que travou, como testar aquele sistema, armadilhas do código e da máquina, o que mediu caro. É a base para as próximas sessões resolverem problemas mais rápido.
  2. **Reler o documento inteiro** e corrigir o que ficou desatualizado pelas decisões da sessão atual ou de sessões anteriores (resumo, estado de testes, roteiro, perguntas em aberto, bugs já corrigidos, nomes de funções que mudaram). Refinar o texto onde estiver confuso.
  3. Atualizar "Estado atual" e o "Roteiro", e fazer um commit no Git.
- **Testar de verdade:** abrir o jogo no navegador do app com `preview_start` (configuração `claude-dev`, porta 5180, em `.claude/launch.json`) para ver funcionando, em vez de só checar a sintaxe. Rodar `npm run build`, que também checa os tipos. Medir com `bench` antes e depois de mudanças no render. Veja "Como testar no navegador do app" em `docs/tecnico.md`.
- **Som:** o Claude não ouve o áudio. Ao criar ou mudar sons, dizer ao usuário que o teste de ouvido é dele, e descrever o que esperar.
- **Explicar ao usuário como rodar:** o comando do servidor de desenvolvimento, e de preferência um atalho `.bat` para iniciar com duplo clique.
- **Arquivos internos do notebook (aviso do usuário, 2026-10-02):** o shell do notebook (`src/laptop/shell.ts`) tem muito código de hacking. Fora do Opus 4.8, ler e editar só os trechos necessários, com cuidado, guiando-se por **`docs/mapa-shell.md`** (as faixas sensíveis do `shell.ts` e as emendas seguras; o Opus 4.8 recalcula as linhas a cada edição do shell). Se um arquivo de hacking novo passar a travar, pedir ao Opus 4.8 para acrescentá-lo a esse mapa.
- **Electron (desde a R.37):** o Claude continua testando no Vite (`claude-dev`, recarga na hora); o usuário testa os retornos pelo `jogar-electron.bat` (tela cheia, resolução fixa, build em segundos). Para conferir o Electron sem abrir janela: `TC_CHECK=1 npx electron electron/main.cjs` (depois de `npm run build`) imprime se o isolamento e o WebGPU funcionam. O `.exe` só é gerado para mandar a amigos, ao fechar uma etapa.
- **Limpar o documento ao fim de cada subetapa (pedido do usuário em 2026-10-02):** junto com o Histórico, tirar do CLAUDE.md o que a subetapa atendeu ou tornou irrelevante (pedidos feitos, filas já organizadas, "esperando teste" já aprovado, planos já cumpridos) e levar o texto para `docs/historico.md` ("Pedidos atendidos", no topo). Aqui fica só o que ainda está aberto, em "Plano: etapas 13 a 22". O que está no Git e no Histórico não precisa estar aqui.
- **O Claude abre o navegador sozinho (regra do usuário em 2026-10-03; substitui o aviso de 2026-10-02):** o laço do jogo só roda com o painel do navegador do app visível. Antes de medir ou testar, o Claude abre o painel ele mesmo (`preview_start` com `claude-dev`) e confere com `tabs_context` se está visível. Só pede ajuda ao usuário se o painel continuar oculto (o `world.tick` não sobe), em vez de lembrá-lo sempre.
- **Log de atualizações (pedido em 2026-10-02):** fica em `CHANGELOG.md` (fora daqui para não pesar no contexto de toda sessão). Cada subetapa com commit ganha uma linha de patch notes na versão da etapa (versão `0.ETAPA.SUB`, por exemplo `0.12.4`), escrita para quem joga. Entradas da Trilha de hacking são escritas por uma sessão com o Opus 4.8; fora dela, só "(entrada da Trilha de hacking)".

## Roteiro e Trilha de hacking

O roteiro das etapas já feitas (1–12, R), as **perguntas em aberto**, as **ideias futuras**, as anotações de refinamento e a **Trilha de hacking** (só ler numa sessão da trilha, com o Opus 4.8 ou o agente `hacking`) estão em `docs/roteiro.md`. O que falta está no Plano acima.