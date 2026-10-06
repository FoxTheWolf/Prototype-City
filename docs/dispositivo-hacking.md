# O dispositivo de bolso — plano de hacking `[HACKING]`

> **`[HACKING]` — NÃO abrir fora de uma sessão com o Opus 4.8 ou o agente `hacking`** (ver CLAUDE.md, "Arquivos de hacking"). É o plano da parte de hacking do aparelho estilo Flipper (o "Jackdaw" proposto). O objeto, a tela, o menu, o mascote e os sons são do Opus 5.5 (`docs/dispositivo.md`, sem hacking); **este doc é só a jogabilidade de hacking e a ligação com a simulação.** Tudo 100% fictício e contido no jogo.

## A referência real (como o Flipper Zero funciona), mapeada para a cidade

Cada capacidade do Flipper vira uma ferramenta ("app") do aparelho, ligada a um sistema que **já existe ou está planejado** na simulação. A regra de ouro do projeto vale aqui: **o sucesso depende só do que o jogador controla** (ler o sinal certo, plugar na porta certa), nunca do sorteio da simulação; e todo efeito implícito precisa de um retorno orgânico.

| Função do Flipper real | O que faz | No nosso mundo (sistema da sim) |
|---|---|---|
| **Sub-GHz (rádio 300–928 MHz)** | lê/salva/repete controles de portão e chaveiros | **Portões e portas de enrolar** (`sim/doors.ts`, `shutterAt`; o controlador de horário já era alvo aceito): ler o controle de um portão de estacionamento/garagem e **repetir** para abrir. **Chaveiros de carro** (etapa 18, carros com dono/porta): capturar e repetir (código rolante → só uma janela de brute, nunca garantido — o que respeita a regra). **Rádio da polícia** (calor, `heat.ts`): escutar o tráfego ("procurando na 5th com a 12th"). |
| **RFID 125 kHz / NFC** | lê/clona/emula crachás de aproximação | **Crachás de acesso** a prédios (apartamentos, escritórios, salas técnicas — pessoas dentro dos prédios, etapa 16): ler o crachá de um funcionário (quando os NPCs os tiverem), **clonar** e **emular** para entrar fora de hora. O **cartão do cybercafé** e o do **metrô** (etapa 18). |
| **Infravermelho** | controle universal de TV/ar | **Telões e TVs** do mundo (já dão tela azul na surge): desligar/trocar. Mais pegadinha que hacking; a versão de brinquedo pode ficar com o Opus 5.5. |
| **iButton / 1-Wire** | chavinhas de interfone | **Interfones** dos prédios residenciais (plausível em 2008): ler a chavinha e abrir a porta da rua. |
| **GPIO / plugar / "BadUSB"** | pinos para placas, finge ser teclado | **A porta de acesso física** dos sistemas fora da rede (semáforo, subestação — já no design). O aparelho vira a ferramenta de campo que você **pluga na porta** em vez de carregar o notebook. É aqui que mora o **GridLink** (abaixo). |
| **Wi-Fi (placa add-on)** | varre redes | **Radar orgânico** (feedback 2026-10-05): a varredura de Wi-Fi mostra as redes do lugar, inclusive **as redes das câmeras IP** — o que alerta para segurança ali. Em 2008 a maioria das câmeras é coaxial, então o radar é **incompleto de propósito** (só as IP aparecem). Pode espelhar a lista de Wi-Fi do celular. |
| **Firmware / apps (FAP) / o pet que evolui** | destrava funções, sobe de nível | **Funções novas por firmware e apps achados/recebidos como recompensa** (feedback 2026-10-05): o aparelho nasce capado; apps vêm do **fórum Switchboard** (15.8, acabei de criar) e do **mentor**. O "pet" é o retorno orgânico da sua reputação/perícia (regra das duas camadas: o implícito aparece sem barra). |

## O recurso de assinatura: os GridLinks (o "coletar as jóias do infinito")

Do feedback do usuário (2026-10-05, `docs/feedback-opus48.md`), decidido:
- **Nove GridLinks numa grade 3×3**, um por setor, cada um a subestação do setor (conciliar com `sim/power.ts`: conferir quantas subestações gera e como entram os nove setores — ver o Recado do CLAUDE.md). Mesmo modelo de caixa; **a segurança cresce perto do centro** e com a fiscalização.
- Em cada GridLink você **instala uma backdoor** (plugando na porta física com o aparelho). Depois, de um aparelho dedicado (este), você **ativa** apagões e disrupções **sincronizados**, à distância, sem precisar re-hackear cada um na hora da fuga (que é trabalhoso e te expõe).
- **Metajogo de coleção:** ir coletando os GridLinks, criando as backdoors, sincronizando, até ter **todos os nove** e poder causar um **apagão geral na cidade** ou fazer os hacks valerem para a cidade inteira. Objetivo **opcional** que a cidade nota (auditorias, caixas trocadas), início/fim de uma **sidequest separada da história principal**.
- **Achados sem o Maps nem o Wi-Fi:** por um **mapa anotado do fórum** (impresso) ou um texto de um hacker com pontos de referência. (Liga no fórum que acabei de fazer e no mapa de papel da 13.9.)
- **Duas formas de entrar na subestação** (feedback, duração do apagão): sem autenticação → apagão **mais curto**; com autenticação → problemas que exigem a **equipe da GridLink de caminhão** (muitas horas). As torres de celular duram ~2 h na bateria; hoje o apagão acaba antes de as torres caírem — **calibrar** para que o apagão autenticado dure o bastante para derrubar torres. O disjuntor de poste volta em 1–2 h.
- **O mascote como medidor da coleção:** a gralha guardando uma bugiganga por GridLink coletado (retorno orgânico, sem HUD).

## Brainstorm de possibilidades (além do que o usuário já disse)

Ideias para pesar depois; nem todas entram:
- **Captura e repetição de portão** como a entrada mais barata e satisfatória (abrir uma garagem repetindo o controle de alguém que passou) — bom tutorial do sub-GHz.
- **Clonar o crachá de um NPC** ao passar perto (leitura por proximidade), depois emular na porta — stealth social, liga no diálogo e na memória dos NPCs.
- **O radar de Wi-Fi como "sentido"**: entrar num lugar e sentir que tem câmera IP ali (a lista acusa) — guia o jogador sem HUD, orgânico.
- **Escutar a polícia** no sub-GHz como parte do sistema de calor (ouvir "procurando na 5th") — o mentor e o rádio contam a mesma coisa por canais diferentes (duas camadas).
- **BadUSB num terminal de loja/caixa** (plugar e digitar um payload) como alternativa de campo ao notebook — conveniência vs. exposição.
- **Jammer de curto alcance** (plausível?) para derrubar uma câmera IP ou um sinal por instantes — avaliar se cabe em 2008 e se não vira sorteio.
- **O aparelho como modem do notebook** (tethering, já citado na etapa 19) e talvez um cartão SD compartilhado entre os dois.
- **Detector de sinais** (uma função do aparelho que o usuário citou): varrer o ambiente e revelar que tipos de sinal há ali (um portão, um crachá, uma câmera).
- **Firmware "destravado"** achado no fórum que abre frequências/funções antes bloqueadas — recompensa de progressão, ecoa o custom firmware real.
- **Alerta tipo "Amber Alert" no apagão geral (feedback 2026-10-06):** quando o jogador causa o apagão da **cidade toda** (coletar/ativar os 9 GridLinks), o celular recebe um alerta de emergência de alcance amplo (estilo Amber/EAS de 2008) — um retorno orgânico, à altura do evento, de que a cidade inteira notou. Liga ao push do celular (etapa 15) e às torres que sobrevivem (geradores) servirem de vetor do alerta. Ideia do usuário, "jogando por aí".

## Ligação com o que já existe (para não reinventar)

- **Notebook x aparelho:** o notebook (`src/laptop/shell.ts`) continua sendo a bancada (scan, brute, captura, sessão remota). O aparelho é a **ferramenta de campo**: mais rápido de sacar, para repetir um controle, ler um crachá, plantar a backdoor de um GridLink **sem** montar o notebook na rua. Alvos pesados ainda pedem o notebook. Decidir com o usuário o quanto o aparelho **substitui** vs. **complementa** o notebook no campo.
- **A porta física** dos sistemas offline já é parte do design (plugar para hackear semáforo/subestação). O aparelho é o conector; o GridLink é o caso especial dessa porta com o sistema de backdoor por cima.
- **O fórum Switchboard (15.8):** é de onde vêm os apps/firmware e o mapa anotado dos GridLinks; o quadro Contracts já tem gigs de "olhar um cabinet"/"apagar um quarteirão" que casam com o aparelho.
- **`sim/power.ts`:** conferir subestações vs. os nove setores 3×3 **antes** de modelar o GridLink (Recado do CLAUDE.md).
- **`heat.ts`:** plantar backdoor e ativar apagão sincronizado alimenta o calor; a entrada autenticada vs. não como já desenhado.

## Faseamento proposto (a decidir com o usuário)

1. **Fundação (não-hacking, Opus 5.5):** o objeto 3D, a tela, o shell (boot, menu, mascote, arquivos, ajustes), os sons, o registro de apps (`DeviceApp`), e 1–2 apps de brinquedo (IR, pet). Nada meu ainda.
2. **Primeiro app de hacking meu:** o **sub-GHz de portão** (ler + repetir) — autocontido, satisfatório, bom tutorial; alvo já existe (`doors.ts`).
3. **Radar de Wi-Fi** (orgânico, espelha o celular) e o **detector de sinais**.
4. **Crachás** (RFID/NFC) quando os NPCs estiverem nos prédios (etapa 16).
5. **GridLinks:** a backdoor por GridLink, a ativação sincronizada, a coleção dos nove, a sidequest. É o grande sistema; depende de 1–4 e da calibragem de `power.ts`/`heat.ts`.
6. **Firmware/apps como recompensa** amarrando tudo ao fórum e ao mentor.

## Decisões da entrevista — rodada 1 (2026-10-06, Opus 4.8)

Primeira rodada feita (limite de uso curto; dá para continuar quando renovar). Decidido com o usuário:

1. **Aparelho complementa o notebook, não substitui.** Notebook = bancada (scan pesado, brute, sessão remota). Jackdaw = ferramenta de campo (sacar rápido, repetir controle, ler crachá, plantar backdoor de GridLink sem montar o notebook exposto na rua). A tensão é **conveniência vs. exposição**; alvos pesados ainda pedem o notebook.
2. **Nove GridLinks fixos (não derivar de `subs.length`).** Ligado a uma decisão maior da mesma conversa: **o tamanho da cidade passa a ser FIXO** (~2×2 km / 4 km², ~100 mil hab.), sem menu de redimensionar — ver a decisão "Tamanho da cidade" no CLAUDE.md. Com a cidade travada, `power.ts` já gera a grade 3×3 = 9 subestações (`nx=round(w/650)=3`, idem `ny`), então **1 GridLink por subestação, 9 no total**. Coletar/backdoor nos 9 = poder do apagão geral. O número é uma meta humana (9), de propósito não escala com a área.
3. **Primeiro app: sub-GHz de portão** (ler + repetir; alvo já existe em `doors.ts`/`shutterAt`) como tutorial de campo. **Já na primeira leva, junto:** backdoor no GridLink → acesso ao **Modbus** dele → um **modo do Jackdaw que ativa os GridLinks à distância** (apagão remoto, sem re-hackear na hora da fuga). O usuário quis esse gancho cedo, para o aparelho ter propósito desde o início.
4. **Detecção de câmeras = um modo scanner único, com filtro por tipo de dispositivo.** Por padrão (sem upgrade) o Jackdaw só enxerga por **Wi-Fi** (câmeras **IP**). O **leitor de lentes óptico** é um **upgrade** (reflexo retro-refletivo da lente — plausível em 2008) que, **em conjunto** com o Wi-Fi, passa a revelar também as **CCTV analógicas/coaxiais**. Não são dois modos separados: é o mesmo radar de "dispositivos", o jogador escolhe o tipo em que focar, e o upgrade amplia a cobertura. (As duas gerações de câmera de 2008 ficam cobertas; sem o upgrade, a analógica é risco invisível.)
5. **Identidade visual forte do Jackdaw (reforço do usuário):** como o Flipper Zero — tudo bonitinho, animações caprichadas, o mascote gralha vivo. Isso é execução do doc não-hacking `docs/dispositivo.md` (Opus 5.5); deixar o recado destacado lá.

## Decisões da entrevista — rodada 2 (2026-10-06, Opus 4.8)

6. **Mentor — fila de avisos por evento relevante + cooldown.** O mentor **junta** tudo que aconteceu desde a última vez ("deixou o rosto em 2 câmeras e correu na frente de uma viatura") e manda **um report só** quando cruza um limiar de relevância, respeitando um tempo mínimo entre mensagens. Nada de falar fator por fator. (Resolve o pedido do usuário no item longo do mentor em `feedback-opus48.md`.)
7. **Mentor — canal: SMS → empurra o app cifrado.** O funcionário do cybercafé (o rival derrubado na 1ª noite) passa o contato de um amigo que "entende tanto de tecnologia quanto você"; esse amigo é o **mentor**, separado dos fixers (sua reputação com o mentor também pode ser afetada — ele se afasta se o jogador falhar demais). O **1º contato do mentor é um SMS comum** só dizendo "não falo por aqui, instala isto" → **gancho diegético para instalar o app de mensagens cifradas** (etapa 15.9); daí em diante é tudo no app. O mentor dá os trabalhos do tutorial e depois dirige o jogador ao **fórum Switchboard**, onde ele passa a pegar trabalhos e conhecer fixers.
8. **Favor da 1ª noite (confirmado, amarrado ao mentor):** cliente urgente no cybercafé, prazo às 18h; derrubar o cybercafé **rival** com o mesmo sistema que usou para consertar (o inverso do que acabou de fazer); fome resolvida com **crédito na máquina de vendas** do café. Se perder o prazo, outro cliente de TI no dia seguinte.
9. **Jammer: sim, mas só como upgrade raro (fim de jogo).** Existe e é plausível em 2008, mas é um **firmware/app difícil de achar no fórum**, para não banalizar. Quando o jogador o tem: cega câmeras IP / sinais sem fio **enquanto ligado** (determinístico, sem sorteio), porém é **detectável** (gera ruído → sobe o calor), alcance curto, gasta bateria. "Silêncio vs. pressa", mas reservado para quem progrediu.
10. **Apagão autenticado derruba as torres de celular do setor — e isso afeta o jogador.** O apagão **autenticado** (o que exige a equipe de caminhão, muitas horas) dura o bastante para **cortar a rede móvel do setor**, inclusive o **próprio celular/Maps do jogador** ali. As torres com **gerador** ficam de pé, viram **ilhas de sinal** para onde correr. O modo **sem auth** (apagão curto) nunca chega a derrubar as torres — é o apagão tático rápido. Você sente o peso do blecaute que causou (sandbox de consequências, duas camadas). **Calibrar** a duração autenticada para > ~2 h de jogo (a autonomia das torres).

**Ainda em aberto para a rodada 3** (próxima sessão só Opus 4.8): **cookies/sessões do navegador como superfície de RAT** (roubo de sessão = entrar na conta do alvo sem senha; adiado explicitamente — é sistema grande, melhor junto da web madura); **redes sociais / expor haters / doxxing** (toca os registros dos cidadãos — Opus 4.8; manter as falas limpas pela regra de conteúdo); **recovery/root no celular** para instalar apps de hacking (achar o equivalente plausível de 2008); **nome do SO do notebook** vindo de uma empresa de software da cidade (hoje "Osprey/UX" fixo — avaliar se não atrapalha comandos/banners). **Dependem da etapa 16** (NPCs conectados dentro dos prédios): crachás RFID/NFC; `tdump` pegando pacotes materializados de NPCs em volta + filtro por tipo + chance de credencial.
