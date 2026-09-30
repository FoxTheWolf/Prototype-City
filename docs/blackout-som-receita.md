# Receita do som do blackout (referência para a etapa 5b)

Análise do áudio do vídeo `E:\Downloads\Watch Dogs Cool Blackout - Valya Vinogradova (1080p, h264).mp4`, feita por outra IA a pedido do usuário em 2026-09-30 e colada aqui **na íntegra**. É só referência: o som do Watch Dogs não entra no jogo, e os sons daqui são sintetizados (veja "Design: rede elétrica e blackout" no `CLAUDE.md`). Na etapa 5b, fazer duas versões: uma fiel a esta receita e outra com interpretação própria.

Observação de leitura: nos tempos da tabela, "5:15" quer dizer 5,15 s (o vídeo tem 17,3 s), e não minutos.

---

O vídeo tem cerca de 17,3 s, e o áudio é estéreo a 44,1 kHz. O ponto importante é que o “Blackout” em si não é um único som simples: acusticamente ele é uma combinação de uma camada tonal grave contínua + ruído elétrico/digital + vários transientes curtos que entram e desaparecem ao longo do efeito.

Uma ressalva importante: olhando para o áudio já renderizado, eu consigo determinar com bastante precisão frequência, envelope, distribuição espectral, transientes e comportamento estéreo, mas não consigo provar qual foi o arquivo-fonte ou quantos canais existiam no projeto original da Ubisoft. Então, quando digo “synth” ou “ruído elétrico”, isso é uma interpretação de sound design baseada no comportamento acústico, não acesso aos stems originais.

## O que acontece no tempo

| Tempo        | O que está acontecendo                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–5:15    | Há apenas o áudio de fundo/pré-roll, relativamente baixo e difuso.                                                                                                                                     |
| ~5:15–5:45   | Começa a entrada do blackout. O nível sobe rapidamente e aparece uma massa grave, com bastante energia abaixo de 150 Hz.                                                                               |
| ~5:45–6:30   | Vem o ataque mais pesado. Há um componente grave muito forte junto com uma textura ruidosa de baixa/média frequência.                                                                                  |
| 6:30–11:00   | Surge o “corpo” principal: um componente tonal grave sustentado que vai descendo progressivamente. É aqui que está boa parte da identidade do som.                                                     |
| ~11:00–16:50 | O grave continua descendo, mas começam a aparecer muito mais eventos curtos em ~700 Hz–1,5 kHz e alguns componentes acima de 2 kHz. Isso cria a sensação de eletrônica, arco elétrico e falha digital. |
| ~12:00–17:00 | Há vários pequenos “bursts”/transientes, alguns muito concentrados perto de 1,2–1,5 kHz. Eles não formam um ritmo musical regular; parecem eventos de descarga/glitch.                                 |
| ~16:40–17:20 | O grave sofre uma última rearticulação muito forte na região de ~55–80 Hz, aparecem transientes agudos, e tudo corta rapidamente.                                                                      |

## 1. A camada mais importante: o grave

Esta é a parte que eu acho que você provavelmente está gostando no efeito.

Existe uma componente tonal muito evidente na região grave. Em determinados pontos do efeito ela está aproximadamente em:

**~121 Hz → ~112 Hz → ~102 Hz → ~94 Hz → ~86 Hz → ~82 Hz**

Ou seja, há uma descida contínua de aproximadamente **B2 até E2**, embora eu não trataria isso como uma linha musical propriamente dita.

E o mais interessante é que isso não se comporta como uma senoide limpa.

Ela tem bastante conteúdo adicional em torno dela, produzindo algo mais parecido com:

> **sine/triangle grave + harmônicos + saturação/distorção + filtro**

O resultado acústico é uma espécie de **hum de transformador / motor elétrico gigante / power-down eletrônico**, só que extremamente estilizado.

Também existe bastante energia abaixo dos ~100 Hz, então não é simplesmente “um tom de 100 Hz”. Tem uma camada de subgrave acompanhando o movimento.

### Para recriar essa parte

Eu começaria com:

**Oscilador 1:** sine ou triangle
**Oscilador 2:** outra onda grave, bem mais fraca, uma oitava abaixo ou próxima disso
**Pitch:** glide descendente de aproximadamente 7 semitons
**Saturação:** moderada
**Filtro:** low-pass relativamente fechado
**Envelope:** ataque curto, sustain longo, decay progressivo

O ponto essencial é **não deixar o oscilador limpo**. O som precisa ter harmônicos e uma textura meio “industrial”.

---

## 2. O grave não fica simplesmente descendo: ele tem uma ressonância áspera

Na análise espectral aparecem componentes fortes aproximadamente em:

**150–250 Hz**,
**300–500 Hz**,
e ocasionalmente mais acima.

Isso é o que impede o grave de parecer um simples “bass drop”.

É muito provável que exista alguma combinação de:

* harmônicos do próprio grave;
* saturação;
* filtro ressonante;
* alguma camada adicional de ruído/ambiente.

Por isso a sensação é mais de:

**“uma infraestrutura elétrica enorme desligando”**

do que de um synth musical convencional.

---

## 3. A camada de ruído elétrico/digital

Depois que o grave já está estabelecido, aparece uma camada completamente diferente.

Ela não possui a estrutura harmônica limpa da camada grave.

É uma textura mais próxima de:

**noise + glitches + descargas elétricas**

A maior concentração aparece na região de aproximadamente **700 Hz–1,5 kHz**, com vários eventos perto de **1,2 kHz**.

Isso é muito importante para a identidade do efeito.

Esses sons parecem ser pequenos bursts extremamente curtos, com ataque rápido e cauda relativamente curta.

Eu descreveria a textura como uma mistura de:

> **electrical arc + digital interference + radio/static burst**

Não parece um simples white noise contínuo. São **eventos separados sobre uma cama grave**.

---

## 4. Existe bastante conteúdo agudo, mas ele não é contínuo

Isso também é interessante.

Acima de ~2 kHz existem vários componentes, mas eles aparecem principalmente durante esses pequenos eventos.

Há pouco conteúdo sustentado realmente forte em 5–10 kHz.

Isso significa que o som não está tentando ser “brilhante”.

Ele é fundamentalmente:

**grave + low-mid + médios agressivos**

e os agudos entram apenas como **detalhe/transiente**.

Isso ajuda muito a explicar por que o Blackout soa pesado em vez de parecer um simples efeito sci-fi.

---

## 5. Os “glitches” são provavelmente camadas independentes

No final aparecem diversos eventos localizados no espectro, especialmente entre aproximadamente:

**800–1.800 Hz**

com alguns componentes chegando a:

**2–5 kHz**

Eles têm aparência de pequenas explosões espectrais no espectrograma, em vez de uma linha contínua.

Eu reproduziria isso usando algo como:

**noise burst → band-pass → pitch/filter modulation → distortion → short reverb**

e faria vários deles com envelopes diferentes.

Por exemplo:

```text
     /\ 
____/  \____
```

um burst curtíssimo, em vez de:

```text
____________
```

que seria um ruído contínuo.

---

## 6. A sensação de “eletricidade” provavelmente vem da combinação, não de um único som

Esse é um detalhe que acho especialmente importante.

O áudio não parece ser:

> “um synth grave + um barulho de faísca”

de maneira isolada.

O efeito funciona porque as camadas estão ocupando regiões diferentes:

```text
20–80 Hz       SUB / impacto / vibração
80–150 Hz      TOM GRAVE PRINCIPAL
150–500 Hz     HARMÔNICOS / CORPO / DISTORÇÃO
700–1500 Hz    GLITCH / ARC / INTERFERÊNCIA
1500–5000 Hz   TRANSIENTES / DETALHES ELÉTRICOS
>5 kHz         pouco conteúdo sustentado
```

Essa distribuição é uma das características mais fortes dele.

---

# E existe uma característica particularmente interessante

O efeito é **majoritariamente centrado**, mas não completamente mono.

A camada grave está muito centralizada, enquanto os componentes secundários têm uma abertura estéreo pequena/moderada.

Isso faz sentido para sound design:

**grave = centro**
**glitches/ruídos = um pouco de largura**

Assim o cérebro percebe o grave como uma coisa física enorme, enquanto os pequenos sons parecem acontecer “ao redor” dele.

---

# Então, em termos de sound design, eu descreveria o Blackout assim:

> **Um power-down industrial/electrical híbrido, construído sobre um drone grave descendente e saturado, acompanhado por uma camada de subgrave e harmônicos ressonantes, sobre o qual são sobrepostos bursts de ruído filtrado, interferência digital e pequenos arcos elétricos de curta duração. O grave permanece relativamente central e contínuo, enquanto as camadas médias/agudas aparecem como eventos descontínuos e ligeiramente mais espaciais. O efeito termina com uma última rearticulação grave e transientes elétricos antes de um corte rápido.**

E, sinceramente, acho que essa descrição chega bastante perto da “receita” acústica dele.

### Se a ideia é recriá-lo em uma DAW

A estrutura que eu usaria seria:

```text
BLACKOUT

[1] SUB
    Sine
    ~55–120 Hz
    pitch descending
    saturation

[2] MAIN POWER DRONE
    Triangle/Saw bem filtrada
    ~80–120 Hz
    glide descendente
    low-pass + resonance
    distortion

[3] ELECTRICAL BODY
    Band-pass noise
    ~150–500 Hz
    envelope relativamente longo

[4] DIGITAL/ARC LAYER
    Noise bursts
    ~700–1800 Hz
    pitch/filter modulation
    distortion

[5] HIGH TRANSIENTS
    pequenos clicks/crackles
    ~1–5 kHz
    envelopes extremamente curtos

[6] SPACE
    short dark reverb
    pouca ambiência no sub
    mais largura nos elementos médios/agudos
```

A parte que mais define o som, para mim, é **o grave descendente + a textura elétrica descontínua por cima dele**. Sem esses dois elementos juntos, você consegue um “sound effect de eletricidade”, mas não aquele *Blackout* específico.

Também dá para ir um nível além e transformar essa análise em um **patch praticamente receita de Serum/Vital/FMod/Wwise**, com frequências, envelopes, filtros, distorção, LFO e automações aproximadas para tentar reconstruir o efeito.
