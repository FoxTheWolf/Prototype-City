# Jackdaw — cenas da gralha por app (para o Opus 5.5 desenhar)

> **Arquivo NORMAL (sem hacking), para qualquer sessão.** São descrições **só visuais** de cenas do mascote (a gralha) do Jackdaw Mini, uma por app. O Opus 4.8 as escreveu sem dizer para que serve cada app — cada cena é identificada **só por um número**. Pedido em `docs/feedback-opus48.md`.
>
> **Onde entram:** no manual `docs/identidade/jackdaw-manual.html`, na seção "Cenas dos apps", no mesmo traço das cenas que já existem (`src/jackdaw/screen.ts`, o objeto `SC`). **Formato:** a gralha a **1,22×** na metade esquerda da tela de **128×64**, a fala/texto curto à **direita** (fonte 3×5, **até ~10 letras por linha**). Reaproveitar a função `gralha(g, {...})` — ela já aceita um objeto na pata/asa pelo `hold`. As cenas de "deu certo" e "não deu" **reaproveitam** as que já existem (`happy` com a bugiginga, `sulky`), não precisa desenhar de novo.

## As cenas

**CENA 1 — "escutando".** A gralha empinada, cabeça inclinada de lado, uma asa em concha perto do tufo da orelha, como quem presta atenção num som distante. Olhos arregalados, curiosos. Em volta da cabeça, **arquinhos curvos** (ondas) que pulsam para fora. Anima: os arquinhos rippleando e a cabeça pendendo de um lado para o outro. Texto: `I HEAR` / `SOMETHING`.

**CENA 2 — "clique".** A gralha segura na pata um **controlinho retangular com um botão**; aperta o botão com a ponta da asa. Um **arquinho** salta do controle. Expressão satisfeita, meio metida (o `mood: 'smug'` serve). Anima: o botão afunda, o arquinho salta, o bico se abre um tiquinho. Texto: `CLICK!`.

**CENA 3 — "plugar".** A gralha segura no bico (ou na pata) um **pluguezinho na ponta de um cabo curto** e o leva na direção de uma **tomadinha**. Muito concentrada (a pontinha da língua de fora). Anima: o plugue balança rumo à tomada e, ao encaixar, uma **faísca/pisca** pequena. Texto: `PLUG` / `IT IN`.

**CENA 4 — "encostar o cartão".** A gralha segura na pata um **cartãozinho retangular** e o encosta numa **plaquinha chata**. Da plaquinha pulsa um **anel** (onda). Começa curiosa, termina feliz, com um aceno de cabeça. Anima: o cartão desce, o anel pulsa. Texto: `TAP` / `TAP`.

**CENA 5 — "um toque".** A gralha segura uma **continha redonda num chaveirinho** e a encosta num **pontinho redondo** de um painel. Expressão curiosa. Anima: a continha toca o ponto e dá um **pisca** pequeno. Texto: `JUST A` / `TOUCH`.

**CENA 6 — "zap".** A gralha aponta um **controlinho** para uma **TV pequenininha** do outro lado da tela e a "zapeia". Sorriso travesso. A TV **pisca** (um chuvisco). Anima: a pontinha do controle pisca e a telinha da TV apaga/acende. Texto: `ZAP!`.

## Um troféu novo para a coleção da gralha

Além das cenas, **um `TRINKET` novo** (bugiginga de 7×7, como as de `TRINKETS` em `screen.ts`): uma **jóia/gema lapidada brilhante** (um losango facetado com um brilhinho). É mais um troféu que a gralha acumula na tela inicial. Desenhar no mesmo estilo dos cinco troféus que já existem.
