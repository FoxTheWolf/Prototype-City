# Designs (agradecimentos, rede social, celular)

> Movido do CLAUDE.md em 2026-10-04 (enxugamento).

## Agradecimentos (easter eggs)

Pedido do usuário em 2026-10-01: amigos dele que aparecem no jogo como agradecimento. **Cada nome aparece exatamente uma vez em toda cidade gerada, num lugar diferente conforme a semente:** numa semente é o nome de uma empresa, em outra um cidadão, uma rua, um marco, uma manchete, um contato no celular etc. A escolha do lugar sai da semente (determinística). Os nomes são escritos exatamente como abaixo, sem tradução.
Os nomes estão como Nome Sobrenome; **onde só o sobrenome soar mais natural (o nome de uma empresa, por exemplo), pode usar só o sobrenome** (dito pelo usuário em 2026-10-03; ajuste na Sessão C).

- Léo Fennix
- Masotan Braun

**Implementado na 9.2:** a lista fica em `src/locale/thanks.json` e o sorteio em `thanks()` (`names.ts`). Hoje os lugares são loja, avenida ou rua larga, marco com nome e distrito. **Cada lugar novo das etapas seguintes (cidadão, contato, post, manchete) deve entrar no sorteio de `thanks()`.** Nunca dois nomes no mesmo lugar, e cada nome uma vez só.

## Design: rede social da cidade (proposta, 2026-09-30)

Ideia do usuário: uma rede social interna em que os cidadãos da simulação publicam sobre o dia a dia, inclusive coisas banais, e sobre o que acontece na cidade (uma batida, um apagão), às vezes com foto. É um jeito de **ver as consequências** do que o jogador faz, mesmo longe do lugar. A análise abaixo mostra que é viável e combina com a arquitetura.

**Como funciona**
- **Fila de eventos da simulação.** A simulação publica fatos estruturados: `{tipo, lugar, hora, gravidade, envolvidos}`. Exemplos: batida, engarrafamento, apagão, preço que subiu, chuva forte, semáforo quebrado. Os posts **nunca são inventados à parte**: cada um aponta para um evento real ou para um estado real da rotina de alguém. É a mesma regra de "os dados da simulação são a matéria do hacking".
- **Quem publica.** Depois de um evento, os cidadãos que o testemunharam (estavam perto, acordados, com celular) ou que foram afetados (ficaram presos no trânsito, perderam a luz, pagaram mais caro) *podem* publicar. A chance e o atraso dependem da personalidade de cada um: uns falam muito, outros nada, alguns só reclamam. Também há posts de rotina ("indo pro trabalho", "almoço", "que chuva"), para a rede não existir só por causa do jogador.
- **Fotos.** O render é uma função pura: `renderWorld(grid, world, view)`. Então a foto é um render pequeno (~48×20 células), feito da posição e da direção do cidadão **no momento do evento**, e congelado como dados de glifos (alguns KB). O custo é de um render minúsculo por foto. Em 2008, a baixa resolução passa por câmera de celular da época. Só tira foto quem estava lá e tinha um celular com câmera.
- **Texto.** Modelos com lacunas e uma gramática gerativa (no estilo Tracery), com a "voz" de cada pessoa: gírias, maiúsculas, erros de digitação, emojis da época. Tudo com semente: mesma semente e mesmas ações geram o mesmo feed. Nada de LLM, para funcionar offline e manter o determinismo.
- **Reações.** Respostas, compartilhamentos e assuntos em alta. Um evento grande vira uma onda de posts, que funciona como um "medidor de consequência" diegético.
- **Nível de detalhe.** Cidadãos longe do jogador não andam de verdade. As testemunhas saem da posição dada pela rotina ("às 14h está no trabalho, a 2 quarteirões"). Texto e foto são gerados no momento do evento, mas limitados por hora, para não pesar.

**Onde se acessa:**
- No celular, como app, pelos dados móveis (3G/EDGE lento, que depende do sinal das antenas) ou por Wi-Fi.
- No notebook, pelo site, que precisa de internet (num cybercafé, por exemplo).

É diegético, como todo o resto.

**Por que é bom para o hacking**
- **OSINT:** posts revelam rotinas, check-ins, nomes de bichos e datas, que são pistas de senha, e mostram quem mora onde.
- **A rede é um sistema da cidade:** tem servidor, contas, senhas, mensagens privadas e logs de acesso. O jogador pode invadir, ler mensagens diretas e apagar provas.
- **Notícia falsa com efeito sistêmico:** um post plantado ("o banco X vai quebrar") que os cidadãos leem e ao qual reagem, com saques, pânico e preços mudando. É o impacto no estilo Else Heart.Break() passando pela população.

**Riscos:**
- **Repetição de texto:** exige muitas variações de modelo e personalidades bem distintas.
- **Volume:** precisa de um limite de posts por hora e de uma priorização por relevância.
- **Coerência:** uma testemunha só fala do que podia ver.

**O que preparar antes:** a fila de eventos pode nascer já na etapa 7 (trânsito), com as batidas e os engarrafamentos, mesmo sem ninguém lendo. Assim a rede social, as notícias e os logs de câmera consomem a mesma fonte depois.


## Design: celular e apps (proposta, 2026-09-30)

Ideia do usuário: o celular do jogador tem vários apps com funções reais e uma loja de apps. A época de 2008 (primeiro iPhone e primeira loja de apps) resolve o dilema "a loja não existia nos anos 2000" e deixa a rede social funcionar no celular.

**O aparelho**
- **É um computador virtual como os outros:** CPU, memória, armazenamento, rádio (EDGE/3G, Wi-Fi, Bluetooth), câmera de poucos megapixels e bateria. Esses limites são reais: um app que não cabe na memória não roda, e o armazenamento enche.
- **É um objeto físico:** o jogador tira o celular do bolso, e ele aparece na mão, ocupando parte da tela. A tela é uma região da própria grade de caracteres (`Lcd` em `src/phone/lcd.ts`), desenhada depois do mundo. Os botões fazem som, e o texto é composto aos poucos, como nos terminais. *(Feito na etapa 8.)*

**Conectividade (é daqui que vem a jogabilidade)**
- **Dados móveis:** vêm das antenas da cidade, que existem na simulação. O sinal depende da distância e dos prédios no caminho. São lentos e custam dinheiro do jogo: há um plano de dados com franquia em MB, e quando acaba é preciso comprar outro pacote (veja "Pedidos atendidos" em `docs/historico.md`).
- **Wi-Fi:** em cybercafés e outros lugares com senha, com alcance físico.
- **Downloads grandes só por Wi-Fi.** Em 2008, a loja real limitava os downloads por rede celular a ~10 MB. Assim, os apps pequenos baixam na rua, e os grandes exigem ir a um cybercafé. A rede social funciona no celular pelos dados móveis, e ir ao cybercafé continua tendo motivo.

**A loja de apps**
- É uma empresa da cidade, com servidores reais na simulação, e portanto pode ser hackeada.
- Há apps pagos com dinheiro do jogo.

**Apps com função real,** cada um ligado a um sistema da simulação. Cada um nasce na etapa do sistema a que pertence:
- **Etapa 9:** discador, SMS e câmera. A foto é um render pequeno e pode ser postada.
- **Etapa 5:** clima, que lê o estado real do clima.
- **Etapa 8:** mapa e GPS, com a posição dada pelas antenas ou pelo GPS.
- **Etapa 21 (transporte; numeração de 2026-10-08):** táxi, que liga para a central, e horários do metrô, com os horários reais dos trens.
- **Nome do jogo:** o usuário quer um termo técnico direto, que se entenda sem pensar (como Uplink e Defcon). BACKDOOR não (conotação); WIRETAP mais ou menos; **GRID DOWN é o favorito**, mas fica em aberto (falta a análise legal e a identidade do logo).
- **Feitos:** rede social (Streetwire), banco, notícias.
- **Etapa 15 ✅:** tocador de música (o Tunes, de fábrica no celular).

**Apps de hacker não estão na loja.** São instalados por fora, pelo cabo do notebook (um "desbloqueio", como o jailbreak da época). Exemplos: scanner de Wi-Fi, farejador de Bluetooth e captura de pacotes, todos limitados pelo hardware fraco do celular. O notebook continua sendo a ferramenta principal.

**Os celulares dos cidadãos também existem:** modelo, apps instalados, contatos e mensagens são dados hackeáveis. Um app falso publicado na loja pode se espalhar pelos celulares da população, o que é um impacto sistêmico.
