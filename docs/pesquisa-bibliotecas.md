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
| Salvar compacto | **fflate** | quando o save crescer | Compressão rápida para "semente + mudanças". |

## Não recomendadas (e por quê)
- **three.js / Babylon:** o render é nosso (o raio por célula em WebGPU); seria trocar o jogo.
- **bitECS e outros ECS:** pediria reescrever a simulação inteira.
- **Yuka (IA de jogo):** a casa em postos e a rotina são simples e já são nossas; a parte difícil (o caminho e o desvio) é do Recast.
- **Tracery / Ink / Yarn:** a gramática de `locale/text/` já faz isso, com a `Sel` de quem fala.
- **Tone.js, FMOD, Wwise:** o som é sintetizado por nós (Web Audio); FMOD e Wwise não são para a web. Para a análise por síntese, as ferramentas ficam fora do jogo (Python: numpy/scipy).
- **xterm.js:** o terminal é diegético e nosso.

Fontes: [recast-navigation (npm)](https://npmjs.com/package/recast-navigation), [JoltPhysics.js (README)](https://unpkg.com/jolt-physics@1.1.0/README.md), [comparação de físicas para a web](https://app.cinevva.com/tutorials/game-physics-libraries), [RAGE (Wikipedia)](https://en.wikipedia.org/wiki/Rockstar_Advanced_Game_Engine), [Shadows of Doubt devblog 15](https://colepowered.itch.io/shadows/devlog/78044/shadows-of-doubt-devblog-15-moving-in-the-citizens).
