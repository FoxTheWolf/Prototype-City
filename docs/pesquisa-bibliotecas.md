# Bibliotecas prontas que podem acelerar o jogo (pesquisa de 2026-10-09)

> Pergunta do usuário: além da física, o que existe pronto que vale usar, e o que os jogos de referência usam. Hoje o jogo não tem nenhuma biblioteca em tempo de execução (só a fonte IBM Plex), e isso é parte do charme; cada uma entra só se poupar um sistema inteiro.

## O que os jogos de referência fazem
O padrão é o mesmo em quase todos: **o núcleo da simulação é escrito em casa; física, navegação e animação vêm de fora.**
- **GTA IV (RAGE):** física pelo **Bullet** (código aberto) e animação física pelo **Euphoria** (NaturalMotion, comercial).
- **Shadows of Doubt:** Unity; os caminhos dos cidadãos são calculados na hora, com atualização mais rápida só perto do jogador (o devblog não diz qual biblioteca).
- **My Summer Car:** Unity, a física PhysX do motor, PlayMaker para a lógica. **BeamNG:** física soft-body própria. **Noita:** motor próprio de pixels + **Box2D** para os corpos rígidos. **Teardown:** motor de voxels próprio.
- **Dwarf Fortress, CDDA, Qud, Zomboid, Uplink, Hacknet, Cities: Skylines:** simulação própria; motor genérico ou nenhum.
- A navegação da Unity e da Unreal é o **Recast/Detour** por baixo: é o padrão da indústria.

## Recomendadas
| Área | Biblioteca | Onde entra | Por quê |
|---|---|---|---|
| Navegação e multidão | **`recast-navigation`** (Recast/Detour em WASM; web e Node) | **17.1** pedestres sem trilhos | Navmesh, caminho com custo por área (calçada barata, rua cara), multidão com desvio local e obstáculos temporários (a batida, o carro parado): é exatamente o que a 17.1 descreve. Só perto do jogador; longe continua a rotina. No Vite, tirar do pre-bundling (`optimizeDeps.exclude`). |
| Física | **Jolt** (`jolt-physics`, WASM) ou **Rapier** (Rust/WASM) | **21.2** | Jolt: veículo com motor/câmbio e ragdoll com motores (o "Euphoria" nosso por cima). Rapier: tem um modo de determinismo entre plataformas, o que casa com a semente. Testar os dois no Node (determinismo, custo com centenas de carros) e escolher. |

## Para avaliar quando chegar a hora
| Área | Biblioteca | Onde | Nota |
|---|---|---|---|
| Simulação num Worker | **Comlink** (minúscula) | 16.1, se a simulação for para um Web Worker | Esconde as mensagens entre a thread e o Worker atrás de chamadas normais. |
| Entender a frase do jogador | **compromise** (NLP leve em JS) | C3b / diálogo | Separa verbos, nomes, perguntas; pode reduzir o "unrecognized" do texto livre. Testar contra as frases do registro de playtest antes. |
| Ferramentas de desenvolvimento | **Tweakpane** ou **lil-gui** (só no modo debug, nunca no jogo) | qualquer etapa visual | O equivalente web do Dear ImGui: um painel para mexer nas constantes ao vivo (a adaptação do olho, o bloom, a chuva) sem recompilar. Ideia tirada do Car Park Capital (abaixo). |
| Salvar compacto | **fflate** | quando o save crescer | Compressão rápida para "semente + mudanças". |

## Não recomendadas (e por quê)
- **three.js / Babylon:** o render é nosso (o raio por célula em WebGPU); seria trocar o jogo.
- **bitECS e outros ECS:** pediria reescrever a simulação inteira.
- **Yuka (IA de jogo):** a casa em postos e a rotina são simples e já são nossas; a parte difícil (o caminho e o desvio) é do Recast.
- **Tracery / Ink / Yarn:** a gramática de `locale/text/` já faz isso, com a `Sel` de quem fala.
- **Tone.js, FMOD, Wwise:** o som é sintetizado por nós (Web Audio); FMOD e Wwise não são para a web. Para a análise por síntese, as ferramentas ficam fora do jogo (Python: numpy/scipy).
- **xterm.js:** o terminal é diegético e nosso.

Fontes: [recast-navigation (npm)](https://npmjs.com/package/recast-navigation), [JoltPhysics.js (README)](https://unpkg.com/jolt-physics@1.1.0/README.md), [comparação de físicas para a web](https://app.cinevva.com/tutorials/game-physics-libraries), [RAGE (Wikipedia)](https://en.wikipedia.org/wiki/Rockstar_Advanced_Game_Engine), [Shadows of Doubt devblog 15](https://colepowered.itch.io/shadows/devlog/78044/shadows-of-doubt-devblog-15-moving-in-the-citizens).

## O Car Park Capital (o usuário mostrou a pasta de licenças, 2026-10-09)
Um jogo em C++ com motor próprio. O que ele usa: **GLFW** (janela e entrada), **GLM** (matemática de vetores e matrizes), **nlohmann_json**, **csv-parser**, **stb_image** e **tiny_gltf** (ler dados, imagens e modelos), **EnTT** (ECS), **Lua + sol2** (scripts), **FMOD** (som) e a família **Dear ImGui** (**ImPlot** para gráficos, **Im3d** para desenhar linhas no mundo, **ImGuiColorTextEdit** para editar código dentro do jogo).
- **A lição:** não há física nem navegação de fora; as bibliotecas são encanamento (que o navegador já nos dá: janela, entrada, JSON) e **ferramentas de desenvolvimento**. O investimento deles em ferramentas internas (painéis, gráficos de desempenho, desenho de depuração no mundo) é o que vale copiar.
- **Para nós:** o encanamento já vem do navegador; carregar imagens e modelos fere "tudo é código"; Lua não precisa (o Vite já recarrega o TypeScript na hora); FMOD não serve à web. O que vale é o painel de constantes (Tweakpane) e, na 17, desenhar a navmesh e os caminhos no mundo (o nosso F3).

## O que os motores modernos têm, do nosso jeito (ideias do Claude, 2026-10-09 à noite)
> Pedido do usuário: "parecer Unity/Unreal, feito do nosso jeito" (a estrela-guia em `docs/visao.md`). São **recursos** (o que o motor faz), não só bibliotecas; quase todos se escrevem em código no nosso render, sem mídia. **Não verificados na web ainda**: conferir cada um quando a etapa chegar. A ordem é a minha prioridade (o que mais dá o "feeling" pelo custo).

| # | Recurso (como chamam lá) | Do nosso jeito | Onde |
|---|---|---|---|
| 1 | **Tonemapping + color grading** (ACES/AgX + LUT; o "look de filme" do Unreal é muito isto) | a curva e uma LUT 3D **gerada por código** por hora e clima (a noite chuvosa azul-sódio, o fim de tarde quente), no fim da função de luz única | 16.1b |
| 2 | **Muitas luzes por região** (clustered/tiled shading) | lista de luzes por quarteirão/célula da tela: cada janela acesa, poste, neon e farol como luz de verdade, sem custar todas para todos | 16.1c (a luz dos cômodos) |
| 3 | **Atmosfera física** (Sky Atmosphere, Hillaire 2020) | o céu e a névoa saem da mesma conta: o horizonte e a névoa ficam da cor do céu sozinhos (resolve o bug (d) da 16.1b de raiz) | 16.1b |
| 4 | **Um sistema de partículas na GPU** (Niagara / VFX Graph) | a chuva da 20.1 nasce como sistema geral: vapor dos bueiros, fumaça das chaminés, respingo, folhas, faíscas do transformador no apagão | 20.1 |
| 5 | **Som espacial com oclusão e reverberação por lugar** (MetaSounds/Steam Audio) | Web Audio: `PannerNode` HRTF + `ConvolverNode` com a resposta da sala **sintetizada** (rua, cômodo, escada, túnel); o som atrás da parede abafado pelo mesmo raio do render | 20 (cozy) ou 24 |
| 6 | **Luz de rebote** (light probes / DDGI) | uma grade grossa de sondas por rua e por cômodo atualizada aos poucos: a janela acesa derrama luz quente na calçada, o lado de baixo da escada deixa de ser preto | 23.3 (ou 16.1c se sair barato) |
| 7 | **Decals e umidade** (decals + material "wet") | poças, manchas, cartazes, pichações e o "molhado" como um parâmetro da tabela única de materiais: a porta molhada da nota 5 sai disso | 20.1 / 23.3 |
| 8 | **IK de pés e mãos** (Control Rig / Animation Rigging) | dois ossos resolvidos em código: o pé no degrau, a mão na maçaneta e no celular; o corpo parece pisar o mundo | 16.5 |
| 9 | **Máquina de estados de animação com mistura** (Animator / AnimBP) | transições suaves andar→parar→sentar em vez de troca seca | 16.5 |
| 10 | **IA por utilidade/objetivos** (Behavior Trees, Shadows of Doubt) | o NPC escolhe o que fazer pelo que precisa (fome, chuva, frio) além da rotina: a "vida" da 17 | 17 |
| 11 | **Profundidade de campo da mão** (DoF) | com o celular na mão, a rua perde detalhe (menos pontos por letra), o foco na tela; cinematográfico e barato | 20.2 (o olhar) |
| 12 | **Console de comandos** (o `~` do Unreal, cvars) | os atalhos de `debug.ts` viram comandos digitados (`time 23:00`, `weather rain`, `tp 849 786`): testar fica muito mais rápido para nós dois | qualquer bloco de correção |

**Bibliotecas que entram por isso:** só as já listadas (recast, Jolt/Rapier, Tweakpane). O resto são técnicas: em WGSL e TypeScript nosso, porque o render é o raio por célula.
