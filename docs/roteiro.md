# Roteiro, Trilha de hacking, perguntas e ideias

> Movido do CLAUDE.md em 2026-10-04 (enxugamento). **A subseção "Trilha de hacking" é [HACKING]:** fora de uma sessão da trilha, não ler.

## Roteiro

A ordem segue a evolução do ASCII City até o Update 4, porque cada etapa depende da anterior. Depois vêm as camadas próprias deste jogo.

1. ✅ **Motor:** Git, Vite + TypeScript, grade de ~180×80 caracteres, raycaster com perspectiva correta, câmera suave (o mouse move um alvo que a câmera segue), sem tremor, desenho final via WebGL com atlas de glifos. Simulação separada da renderização desde o início.
2. ✅ **Cidade grande:** mundo enorme com uma janela deslizante em volta do jogador, prédios com identidade fixa pela posição, horizonte distante barato, prédios altos visíveis atrás de outros.
3. ✅ **Estrutura e variedade da cidade:**
   - setores, distritos e quarteirões com nomes;
   - tipos de distrito que mudam a geração (centro financeiro, comercial, residencial, histórico, industrial com pátios ferroviários; sem porto, porque não há água);
   - **estilos de fachada** por tipo de distrito: torre de vidro, prédio histórico ornamentado, tijolo, residencial, galpão (referências 18, 19 e 22);
   - variedade de forma: topos de torre, pontas, cúpulas;
   - parques variados e marcos da cidade (referências 17, 20, 21 e 26);
   - a borda: zona de fogo subterrâneo com o cordão (veja as decisões). Nesta etapa, a geometria e o visual do horizonte; o medidor de CO e as patrulhas vêm depois;
   - nomes em inglês já lidos de um arquivo de locale.
4. ✅ **Visual sólido:** fundo colorido atrás dos glifos (alternável) e paleta final. Objetos pseudo-volumétricos montados com várias faces (carros, árvores, bancos, postes, cabines) no lugar dos billboards atuais. Entulho e mobiliário urbano espalhados. Letreiros nas fachadas com luzes que piscam e fazem efeitos. Base da iluminação dinâmica (postes que iluminam o que passa perto).
5. ✅ **Clima e céu** (o grupo 5.1–5.3 trouxe antes a avenida diagonal, as placas perpendiculares e os holofotes de fachada): chuva (fraca e forte), neve e outros efeitos atmosféricos, com partículas que caem e **batem no chão** (respingos na chuva, marcas ou acúmulo na neve). Lua com **fases** visíveis no céu. O horizonte atual agradou ao usuário e deve ser mantido. Curvatura leve do horizonte e a megaestrutura da zona de fogo, visível só perto da borda (veja as inspirações).
5b. ✅ **Rede elétrica e blackout** (veja "Design: rede elétrica e blackout" em `docs/historico.md`): subestações na simulação, prédios, postes e letreiros ligados a elas, apagão e volta progressivos com som, luar iluminando a cidade apagada. Acionado por uma tecla de debug até o hacking existir.
6. ✅ **Interiores** *(feita em 2026-09-30 e 2026-10-01, grupos A–F; testada pelo usuário, que tem opiniões para a etapa 20; os bugs estão em "Bugs conhecidos")* (trocada com o trânsito a pedido do usuário em 2026-09-30: dá exploração e gameplay já, e permite medir cedo o custo de ter interiores na cidade inteira). Todos os prédios devem ter interior, inclusive os cortados pela diagonal.
   - **Decidir no início:** interiores no mesmo espaço físico da cidade (o pedido original: atravessar a porta, sem carregamento nem teleporte) ou com carregamento, conforme o desempenho medido; e se a câmera 3D de verdade entra agora.
   - Cômodos coloridos vistos de fora pelas janelas (referência 16), janelas que mostram a cidade real, andares altos com vista de cima, vitrines com o interior das lojas.
   - Elevadores que sobem de verdade, alguns com vidro. Escadas de incêndio em que se sobe.
   - As janelas iluminando a fachada (como os letreiros), a chuva abafada do lado de dentro e a luz interna ligada à rede elétrica.
   - Veja "Preparação da etapa 6" no Estado atual.
7. ✅ **Trânsito** *(feita em 2026-10-01, grupos A, B e C; veja o Histórico)*: avenidas, coletoras e calçadões; semáforos; filas; tipos de veículo; ciclistas; pedestres. Sem carros voadores, porque não combinam com 2008. Criar aqui a fila de eventos da simulação (batidas, engarrafamentos, e também os apagões da rede elétrica). Carros na avenida diagonal, semáforos ligados à rede elétrica, e o conserto das calçadas da diagonal (veja "Bugs conhecidos").
8. ✅ **Navegação** *(feita em 2026-10-01, grupos A, B e C; veja "Etapa 8" no Histórico)*: o celular como painel diegético com terminal progressivo, mapas em 4 níveis e de interior, marcos, os limites do GPS de 2008, e a grade de apps com os que não dependem da rede funcionando. (O passeio automático e o modo cidade vazia do ASCII City saíram: o usuário não quer no nosso jogo, decidido em 2026-10-01.)
9. ✅ **Rede de telefones e celular** *(feita em 2026-10-01; veja 9.1–9.11 no Histórico)*: orelhões; antenas e sinal (a barra "Yx" do celular passa a mostrar o sinal de verdade); loja de apps; discador, SMS e câmera funcionando (as telas já existem desde a 8.7); os limites do hardware valendo; a abertura do jogo. O celular como objeto na mão já existe (etapa 8). Veja "Design: celular e apps". Também os pedidos do começo da etapa: o celular subindo para digitar, o botão do meio do mouse, as teclas clicáveis, o plano de dados com franquia e vários modelos de aparelho (veja "Pedidos atendidos" em `docs/historico.md`).
9b. ✅ **Luz do sol** *(2026-10-01; aprovada pelo usuário)*: faces ao sol e na sombra, chão, telhados, objetos e Sarcófago de dia; superfícies grandes e distantes em blocos; opção de resolução.
10. ✅ **Notebook e primeiro hacking** *(grupos A, B e C feitos em 2026-10-01/02; depois, na mesma etapa, BIOS, bateria e editor, os workers do render, a interface em camada própria e a direção sem trilhos: veja 10.1–10.10 no Histórico. O que sobrou é da Trilha de hacking.)*: o notebook como objeto, o computador virtual, a rede do notebook, e os primeiros alvos (subestação e semáforos, por `tnet`). **Trilha de hacking, feito em 2026-10-02 (10.11), fechando a etapa 10:** os pacotes materializados (`sim/packets.ts`, o `tdump` lê deles), o 502/modbus com função (`mbus`) e a senha da BIOS. O modelo completo de pacotes de "Design: pacotes de rede simulados" (captura em qualquer rede/serviço, passo ajustável) fica para a etapa 14.
11. ✅ **Cidadãos e rotinas** *(feita em 2026-10-02, grupos A, B e C; o C espera o teste do usuário; veja 11.1–11.4 no Histórico)*: casa, trabalho, relações e horários, com nível de detalhe da simulação; os pedestres são os cidadãos; ligações e SMS por engano; a primeira rede social (Streetwire).
12. **Web dinâmica** (a próxima etapa; reorganizado pelo usuário em 2026-10-02: a web é quase uma etapa por si só e aproveita a base que já existe, cidadãos, empresas, eventos e o gerador de textos). Grupos sugeridos, a confirmar no começo:
   - ✅ **Grupo A, o celular redesenhado** (12.1): tela inicial, menu, discador, mensagens e mapa; modelos visuais e capinhas; apps de fábrica e a pasta; câmera em blocos; 60 mil pessoas.
   - ✅ **Antes do grupo B: 12.4–12.6** (celular, notebook, camada HD, sistema de arquivos do celular).
   - ✅ **Grupo B (12.7–12.13, aprovado em 2026-10-03):** câmeras de segurança e o modo CCTV, pedestres usando o celular, sons de ambiente (carros e sirenes distantes, o celular de quem passa), manchetes clicáveis com texto e foto, e o bug dos pedestres na diagonal (veja "Plano das próximas sessões").
   - **O que falta da web foi para a etapa 15** (renumerada em 2026-10-04).
13–22. **O que falta, renumerado em 2026-10-04:** veja "Plano: etapas 13 a 22" (13 Lugares e lojas, 14 Diálogo, 15 Web e celular, 16 NPCs usando a cidade, 17 Economia, 18 Transporte e carros, 19 Hacking completo, 20 Refinamento e variedade, 21 Sound design, 22 Vida do personagem). Os números antigos (12b, 12c, 13, 13b, 13c, 14, 15, 15b, 16) aparecem no histórico e em comentários do código com o sentido antigo.

### Trilha de hacking (criada em 2026-10-02)

Tudo que **se parece com cibersegurança** fica aqui, em sessões próprias, por causa do classificador de segurança (veja a regra no topo de "Estado atual"). **Regras da trilha:**
- No começo de uma sessão desta trilha, **avisar o usuário para trocar para o Opus 4.8** (menos safeguards) antes de prosseguir.
- **Fora da trilha, não abrir** os arquivos de hacking (`src/sim/network.ts`, os comandos `mmap`/`bruter`/`tdump`/`tnet` e `conn`/`remote` de `src/laptop/shell.ts`, o `util` de `src/sim/wifi.ts`) **nem ler** as entradas `[HACKING]` deste documento.
- **O que já foi feito na trilha:** a etapa 10 grupo C (10.6) e os pacotes/modbus/senha de BIOS (10.11); no celular, os códigos secretos (9.4) e o Wi-Fi do aparelho (9.3/bugfix) — já no disco, não remexer sem necessidade. **Com a 10.11, a etapa 10 está fechada por inteiro.** **F.1 (2026-10-03):** o contratante por SMS, o estado do trabalho conferido pela rede elétrica, o pagamento no banco (`sim/jobs.ts`, `locale/jobs.ts`). **F.2 (2026-10-03):** o calor por rastros, a polícia em escada e a prisão sem game over (`sim/heat.ts`), com as notícias e o Streetwire reagindo (eventos `manhunt`/`bust`).
- **F.3 (2026-10-03):** o tutorial dentro do notebook (`src/locale/laptop.en.json` → `home["start-here.txt"]`) e o comando `job` (builtin em `src/laptop/shell.ts`, lê `world.jobs`), que mostra o contrato em que o jogador está.
- **F.4b (2026-10-03):** o trabalho 2, travar um cruzamento de semáforos dentro de uma janela de 1–2 h (`sim/jobs.ts` virou dois tipos pela mesma estrutura; `setSignals` em `sim/network.ts` passou a deixar rastro como `setBreaker`; textos em `locale/jobs.ts`; o `job` do shell descreve os dois tipos). Ver historico.md.
- **F.5 (2026-10-03):** o trabalho 3, seguir uma linha (autocontido, só antena). `JobKind` ganhou `'trace'` (`sim/jobs.ts`), o alvo é resolvido na oferta (`resolveTrace`, hora recente), `answerTrace` confere a resposta por SMS; o OMC da operadora é o alvo (`HostKind 'omc'`, host `omc-r`, `cellLog` em `sim/network.ts`; o AP `omc` em `wifi.ts`, SSID `<Operadora>-OMC`); `mastNear` passou a ser exportado de `telco.ts` e é compartilhado. O comando `log <número>` do console remoto e o gancho de resposta no celular (`parseDistrict` em `phone.ts`). Ver historico.md. **Decisão aberta:** puxar o log não gera calor por ora (leitura passiva) — dá para ligar depois.
- **A próxima sessão da trilha (entrevista de 2026-10-04): a rede de computadores física**: máquinas e modems que existem no mundo, ligados entre si, com telas de login e configuração e defeitos. É a base comum dos trabalhos de TI (o lado legítimo, que paga pouco) e do hacking. Junto, a qualidade de vida do terminal (clicar num IP o cola na linha de comando). Veja `docs/visao.md`.
- **Dois caminhos até o alvo (entrevista de 2026-10-04, `docs/visao.md`):** perto (físico/antena direcional) ou pela rede de dentro, mais lento e com mais logs; um teste em `tests/` garante que todo alvo é alcançável a partir de uma entrada, como as plantas.
- **WEP cracking mais cedo (entrevista de 2026-10-04):** tirar a dependência da tecla de debug do laço da fatia vertical (quebra a imersão).
- **F.10 (proposta):** o SMS de balanço depois do serviço (o que a cidade sabe: "a câmera da 5th com a 12th te pegou"); conferir se os trabalhos se renovam depois do terceiro (se não, repetir os três tipos com alvos novos e pagamento subindo com a reputação).
- **Batidas → calor (decidido pelo usuário em 2026-10-03: NÃO ligar por hora; revisitar):** só somaria calor por batida que o jogador claramente causou, nunca pelas batidas de fundo (`traffic.ts` + `heat.ts`).
- **O que falta na trilha:** a intrusão da rede social (etapa 15); o banco e os sistemas das empresas (17); a etapa 19 inteira (que amplia os pacotes do `tdump` para o modelo completo de "Design: pacotes de rede simulados" — hoje a 10.11 já materializa os pacotes, mas de forma mais enxuta —, instala as ferramentas por cabo e traz o Wi-Fi dos cybercafés); e as câmeras invadidas do "Modo CCTV" (Ideias futuras), se virarem jogabilidade.
- **Missões com prazo longo (pedido do usuário em 2026-10-04):** as missões, sobretudo as primeiras, dão de 18 h a 1 dia de jogo, para o jogador cuidar de outras coisas, apreciar a cidade ou aprender a hackear (prazos e janelas em `sim/jobs.ts`).
- **A reputação presa ao número (decidido em 2026-10-04; veja "O jogador é o número dele"):** trocar o chip zera não só o calor mas também a reputação com o contratante (trabalhos melhores, pagamento maior); o fórum de trabalhos, se vier, entra pelo número com SMS de confirmação.
- **Bugs/pedidos `[HACKING]` do retorno de 2026-10-03 (para a sessão de correções da trilha, Opus 4.8):**
  - **No `tnet`, preso no prompt de login:** quem não sabe o login não consegue sair — Ctrl+C e `exit`/`quit` não funcionam no estágio login/senha de `conn` (`remote()` em `shell.ts`). Deixar Ctrl+C e `exit` fecharem a conexão também antes do shell.
  - **O notebook não desconecta da subestação pela distância:** ao se afastar da antena de manutenção, a placa (`Shell.net`) devia cair pelo sinal; o usuário viu que não cai sozinha. Conferir o reateamento por posição real (lição da 10.x diz que deveria cair).
  - **(etapa 19) Flag de nomes reais:** uma flag que troca os nomes fictícios dos comandos/programas pelos reais, com uma versão fictícia para ligar/desligar conforme o contexto.
  - **(etapa 19) `tdump` contínuo:** capturar pacotes continuamente até o usuário segurar Ctrl+C, em vez de uma janela fixa.

- **`apt` para instalar os programas (pedido do usuário em 2026-10-06):** nem todo programa vem no notebook de primeira; um gerenciador tipo `apt`/`apt-get` realista (ao menos visual: `apt-get update`, `apt install <nome>`), que **precisa de internet** para baixar. Alvo imediato: os `HACK_TOOLS` de `src/laptop/shell.ts` (`mmap`/`bruter`/`tdump`/`tnet`/`mbus`), hoje pré-instalados em `~/bin`, passam a ser adquiridos. Casa com o aparelho (apps/firmware vindos do fórum) e com a progressão (ganhar capacidades). Decidir: de onde vêm os pacotes (um repositório fictício na web da cidade? o fórum Switchboard?), o que vem pré-instalado, e se lodestar/ferramentas de TI legítimas entram no mesmo sistema.
- **O aparelho de bolso estilo Flipper (o "Jackdaw"):** a parte de hacking está planejada em `docs/dispositivo-hacking.md` (`[HACKING]`): sub-GHz (portões/chaveiros), RFID/NFC (crachás), IR, iButton, GPIO/plugar (a porta física), o radar de Wi-Fi, e o recurso de assinatura — os **nove GridLinks** (backdoors por subestação, apagões sincronizados, coletar todos = apagão geral), tudo amarrado ao fórum e ao mentor. A fundação não-hacking (objeto 3D, tela, menu, mascote, som, registro de apps) é do Opus 5.5 (`docs/dispositivo.md`). Grande sistema da etapa 19; a fundação pode começar em paralelo.

R. ✅ **Render na GPU (WebGPU)** *(R.1–R.28, 2026-10-02/03; detalhes em `docs/historico.md`)*: o mundo inteiro desenhado num compute shader, um raio 3D por célula (a câmera 3D de verdade), sem o render da CPU (apagado na R.17); depois a luz nova (sol e sombras, emissão e bloom, materiais, reflexos). **O que sobra está na "Lista fixa: retoques de luz"** do Plano.

**Correção de bugs e otimização:** feita em 2026-10-01 (duas partes) e na etapa R (a queda de FPS era o render da CPU); os bugs abertos estão nas listas fixas do Plano e em "Bugs conhecidos".

**O sistema de notícias com telões** entra na etapa 15 (portal de notícias).

**Transversal, em todas as etapas: som.** O retorno sonoro é prioridade do usuário e não pode ficar para o fim. Cada etapa traz os sons do que cria:
- chuva, trovão e blackout na etapa 5 (feitos; falta o vento);
- portas, passos e ambiente interno na 6;
- motores e buzinas na 7;
- teclas do celular, boot, tons DTMF e chamada falhando na 8 (feitos);
- toques de chamada, tons de ligação, voz sem palavras, SMS, moedas e orelhões, obturador e a abertura na 9 (feitos).

O módulo de áudio já existe (`src/audio/`, Web Audio, tudo sintetizado, sem arquivos).

## Perguntas em aberto

Consolidadas aqui para não se perderem. Pergunte ao usuário quando a etapa correspondente chegar.
- **Etapa 5 (respondido em 2026-09-30, implementado na 5.5):** um dia do jogo dura **48 minutos reais**, como no GTA IV, mas numa variável fácil de mudar. O jogador **pode dormir e pular o tempo**.
- **Etapa 6 (respondido em 2026-09-30):** interiores no espaço físico; câmera 3D depois; começar por residencial e escritório.
- **Etapa 8 (respondido em 2026-10-01):** o painel é o celular, não pausa, GPS exato primeiro e os limites de 2008 no grupo 8C.
- **Etapa 18 (respondido em 2026-10-05):** transporte aéreo só depois da 1.0 (um helicóptero de passeio, não táxi aéreo).

## Ideias futuras (não decididas)

- **Modo CCTV (pedido do usuário em 2026-10-01; o ASCII City tem algo parecido, e a regra de originalidade vale: a técnica sim, o visual e os nomes não):** uma opção na tela de título ao lado de "ENTER THE CITY": a vista de uma câmera de vigilância presa num poste, girando devagar de um lado para o outro, com efeito de tela de CCTV (linhas de varredura, ruído, data e hora e o nome da câmera no canto, talvez em preto e branco ou monocromático), trocando de câmera de tempos em tempos. Combina com o hacking: as câmeras podem ser objetos da simulação, e o mesmo efeito serve depois para o jogador ver câmeras invadidas no notebook. O modo CCTV da tela de título em si (sem invasão) é visual e pode ser feito em sessão normal; as **câmeras invadidas** são `[HACKING]` (Trilha de hacking).
- Rede da cidade como dado do jogo: nós (telefones, câmeras, semáforos, prédios) com endereços e níveis de acesso.
- Notebook do hacker como objeto físico no jogo, com teclado, tela de terminal e sons.
- Transmissão ao vivo determinística (como o "ASCII City Live"): a mesma semente e a mesma hora mostram a mesma cena.

## Refinamento: anotações (para a etapa 20)

Ajustes que o usuário pediu para deixar para a etapa de refinamento e variedade (não são bugs):
- **Opiniões sobre a etapa 6:** o usuário testou e tem opiniões; perguntar no começo da etapa 20.
- **Carros ocos por dentro:** a carroceria é um bloco sólido; pelo vidro se veem o motorista e os passageiros, mas cortados pela caixa do corpo (só o que fica acima de 0,95 m aparece). Fazer o interior oco (laterais, piso, painel) para ver as pessoas inteiras.
- **Dois cones de farol:** hoje cada carro tem um só cone de luz. Devem ser dois, um por farol, com o da direita mais longo (o facho assimétrico de verdade).
- **A praça do X do theater district** e o X em geral: mais decoração (veja a 7.5 e a 7.6).
