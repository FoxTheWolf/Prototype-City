Aqui estão as receitas detalhadas para a sua engine de áudio.

O segredo para a síntese procedural realista (especialmente para não soar como um jogo de Atari) está no **uso abusivo de envelopes curtos no GainNode** e na **modulação do filtro**.

Para o seu problema com o vidro: osciladores senoidais soam como sinos porque têm fase perfeita e sustentação pura. O vidro estilhaçando é uma resposta de frequência caótica. A solução é passar **Ruído Branco** por filtros `bandpass` com o `Q` alto (10-20), gerando "frequências fantasmas" que soam metálicas/vítreas sem gerar uma nota musical, e disparar o ganho em múltiplas rajadas de milissegundos.

Aqui estão as 10 receitas no formato solicitado:

---

### 1. Batida de carro (Velocidade Urbana)

Sensação: Uma pancada grave e surda no peito, seguida do rasgar metálico e uma chuva caótica de vidro estilhaçando.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Impacto | Sine | 100 Hz → 30 Hz (0.15s) | Lowpass, 120 Hz, Q: 1 | Atq: 0.01s, Pico: 1.0, Dec: exp para 0.01 (0.2s) | 1.0 | A "massa" do carro batendo. |
| Lataria | Ruído | Fixo | Lowpass, 1500 Hz → 400 Hz (0.3s) + WaveShaper (distorção leve) | Atq: 0.02s, Pico: 0.8, Dec: linear (0.4s) | 0.8 | O rasgar do metal. |
| Vidro 1 | Ruído | Fixo | Bandpass, 5500 Hz, Q: 15 | Atq: 0.005s, Pico: 0.6, Dec: exp (0.04s). *Repetir 5x em 0.3s* | 0.5 | Pedaços grandes quebrando. Rajadas rápidas. |
| Vidro 2 | Ruído | Fixo | Bandpass, 8200 Hz, Q: 20 | Atq: 0.005s, Pico: 0.5, Dec: exp (0.02s). *Repetir 8x em 0.4s* | 0.4 | Estilhaços finos batendo no chão. |

Variação: Altere a frequência final do impacto (20–40 Hz). Sorteie os tempos de disparo dos envelopes de vidro (entre 0.0 e 0.4s) para nunca soar como um padrão rítmico.
Distância:

* 50 m: Lowpass geral em 3000 Hz, Atraso de 0.15s. Volume 50%.
* 200 m: Lowpass em 800 Hz, Atraso de 0.6s. Vidro imperceptível, apenas a pancada surda.
* 600 m: Lowpass em 200 Hz, Atraso de 1.7s. Volume 10%.
Erros comuns: Usar ruído sem filtro para o impacto (soa como explosão de TV) ou fazer o decaimento da lataria longo demais (soa como vento).

---

### 2. Sirene de polícia (2008) e Ambulância c/ Doppler

Sensação: Um som estridente, cíclico e perfurante que distorce, sobe de tom quando se aproxima e cai abruptamente quando passa.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Wail (Polícia) | Square | 600 Hz → 1500 Hz (1.8s) → 600 Hz (1.8s) | Bandpass, 1000 Hz, Q: 1 | Atq: 0.1s, Pico: 1.0, Sustenta contínuo | 1.0 | Ciclo longo de cruzeiro. |
| Yelp (Polícia) | Square | 600 Hz → 1500 Hz (0.15s) → 600 Hz (0.15s) | Bandpass, 1000 Hz, Q: 1 | Contínuo. | 1.0 | Para cruzamentos (mais urgente). |
| Hi-Lo (Ambul.) | Square | 700 Hz (0.5s) → 1000 Hz (0.5s) | Lowpass, 2500 Hz, Q: 2 | Contínuo, salto abrupto (`setValueAtTime`) | 1.0 | Sirene clássica de resgate europeia/médica. |

Variação: Leve dessintonia (LFO imperceptível) ou adicionar um WaveShaper sutil para saturar o som, imitando o alto-falante barato da viatura.
Distância (Doppler a 60 km/h - 16.6 m/s):

* Frequência Base: Multiplique o `value` da frequência por `1.05` quando estiver se aproximando e mude abruptamente para `0.95` assim que passar (fórmula do Doppler: velocidade do som / (velocidade do som ± velocidade da fonte)).
* Panner: Mova de -1.0 para 1.0 rapidamente no cruzamento.
* Volume: Curva exponencial reversa na chegada, exponencial normal na saída.
Erros comuns: Fazer transições lineares no Hi-Lo (o salto deve ser instantâneo) ou esquecer a queda de afinação (Doppler), o que faz o carro parecer estar parado buzinando na orelha do jogador.

---

### 3. Buzina de carro e caminhão

Sensação: Um acorde estridente, dissonante e agressivo que corta o trânsito.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Carro 1 | Sawtooth | 330 Hz (Fixo) | Peaking, 2000 Hz, Q: 3, Ganho: 5dB | Atq: 0.05s, Pico: 1.0, Sustenta | 0.8 | Base da buzina comum. |
| Carro 2 | Sawtooth | 415 Hz (Fixo) | Lowpass, 4000 Hz, Q: 1 | Atq: 0.05s, Pico: 1.0, Sustenta | 0.8 | Dissonância (terça maior/menor). |
| Caminhão 1 | Square | 130 Hz (Fixo) | WaveShaper (Distorção 3x) | Atq: 0.1s, Pico: 1.0, Sustenta | 1.0 | Tom grave de corneta a ar. |
| Caminhão 2 | Square | 175 Hz (Fixo) | Lowpass, 1500 Hz, Q: 2 | Atq: 0.1s, Pico: 1.0, Sustenta | 1.0 | Harmônico dissonante do caminhão. |

Variação: Altere levemente as frequências (±5 Hz) para simular modelos de carros diferentes. Buzinas de carros mais velhos têm ataque mais lento (0.1s).
Distância: Em 200m, aplique um Notch filter em 2000 Hz (o ar absorve frequências médias-altas de forma desigual).
Erros comuns: Usar Sine waves (fica parecendo um órgão de igreja). Buzinas precisam das bordas rasgadas das ondas Sawtooth/Square.

---

### 4. Freio a ar e Motor Diesel (Marcha lenta)

Sensação: Um chiado agudo e violento de ar comprimido vazando, sob um "chug-chug-chug" rítmico, grave e mecânico.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Freio (Ar) | Ruído | Fixo | Highpass, 3000 Hz, Q: 1 | Atq: 0.02s, Pico: 1.0, Dec: exp (0.4s) | 1.0 | Válvula de alívio. |
| Freio (Tubo) | Ruído | Fixo | Bandpass, 1200 Hz, Q: 5 | Atq: 0.02s, Pico: 0.6, Dec: linear (0.3s) | 0.4 | O som oco do cano onde o ar passa. |
| Motor (Cilindro) | Sawtooth | **12 Hz** (Fixo) | Lowpass, 200 Hz, Q: 4 | Atq: 0.5s (fade in contínuo) | 0.8 | Truque: 12Hz não soa como nota, soa como cliques de um motor. |
| Motor (Vibração) | Ruído | Fixo | Lowpass, 150 Hz, Q: 1 | Modulado pelo envelope: sobe/desce a 12Hz | 0.5 | A lata do ônibus tremendo. |

Variação: No motor, flutue a frequência de 11 Hz a 13 Hz lentamente para simular marcha lenta irregular.
Distância: O freio a ar viaja longe (perceptível a 200m com bandpass em 2kHz), mas o motor diesel perde clareza a 50m, virando apenas um grave genérico (lowpass 80 Hz).
Erros comuns: Usar frequências altas no motor (soa como um barco ou zangão). O segredo do diesel é a frequência sub-áudio (LFO) criando ritmos no filtro.

---

### 5. Portas (Carro e Prédio)

Sensação: Um clique mecânico duplo envolvido pelo peso do ar sendo espremido e a estrutura vibrando.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Carro (Massa) | Sine | 80 Hz → 40 Hz (0.05s) | Nenhum | Atq: 0.01s, Pico: 1.0, Dec: linear (0.1s) | 1.0 | O ar dentro do carro sendo socado. |
| Carro (Trinco) | Ruído | Fixo | Highpass, 3000 Hz, Q: 1 | Dois picos (0.0s e 0.04s), duração 0.01s cada | 0.4 | O engate do metal duplo. |
| Vidro/Mola | Triangle | 600 Hz → 550 Hz (0.2s) | Bandpass, 600 Hz, Q: 8 | Atq: 0.05s, Pico: 0.3, Dec: exp (0.3s) | 0.5 | O chiado/vibração do vidro e mola (porta de loja). |
| Saída Emerg. | Ruído | Fixo | Bandpass, 800 Hz, Q: 15 | Atq: 0.01s, Pico: 1.0, Dec: exp (0.6s) | 1.0 | Reverb natural de metal (use convolver se possível). |

Variação: Para carros velhos, prolongue o decaimento do trinco em 0.02s (peças soltas).
Distância: 50m: lowpass 1000 Hz. O trinco (frequências altas) some, sobra apenas a pancada da massa.
Erros comuns: Fazer um baque único. Portas reais sempre têm no mínimo dois micro-impactos (a chapa batendo + o trinco travando).

---

### 6. Passos (Concreto, Molhado, Madeira, Metal)

Sensação: Contato texturizado com o chão que revela imediatamente o material e o peso do personagem.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Sola (Comum) | Ruído | Fixo | Bandpass, 600 Hz, Q: 2 | Atq: 0.02s, Pico: 0.8, Dec: exp (0.05s) | 0.7 | Base para concreto. |
| Molhado (Poça) | Ruído | Fixo | Highpass, 4500 Hz, Q: 1 | Atq: 0.01s, Pico: 1.0, Dec: exp (0.08s) | 0.9 | O "slap" da água. |
| Madeira | Sine | 120 Hz → 60 Hz (0.08s) | Lowpass, 200 Hz, Q: 1 | Atq: 0.01s, Pico: 0.8, Dec: exp (0.15s) | 0.8 | A ressonância do piso oco. |
| Metal (Escada) | Ruído | Fixo | Bandpass, 1200 Hz, Q: 12 | Atq: 0.01s, Pico: 1.0, Dec: exp (0.25s) | 0.8 | O sino metálico fosco da grade. |

Variação: Sorteie o filtro Bandpass da sola base (entre 500 e 800 Hz) a cada passo para não soar metralhadora. O decaimento varia levemente (0.04s a 0.06s).
Distância: Passos somem rápido. A 50m, reduza volume para 10% e corte tudo acima de 1000 Hz.
Erros comuns: Passos perfeitamente rítmicos. O tempo entre o calcanhar e a ponta do pé varia; na síntese, isso é um ataque de 0.02s em vez de 0.00s.

---

### 7. Elevador (Chegada, Portas, Motor)

Sensação: Um aviso simpático seguido do ruído áspero de polias de metal friccionando sob um zumbido constante.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Ding | Sine | 880 Hz (A5) fixo | Nenhum | Atq: 0.01s, Pico: 1.0, Dec: exp longo (2.0s) | 0.8 | Sino de anúncio. |
| Portas (Atrito) | Ruído | Fixo | Bandpass, 400Hz → 800Hz (1.5s) | Atq: 0.2s, Pico: 0.6, Dec: linear (1.5s) | 0.5 | A porta correndo no trilho. |
| Portas (Fim) | Ruído | Fixo | Lowpass, 300 Hz, Q: 3 | Disparo no fim das portas (0.05s) | 0.6 | O baque da porta abrindo/fechando toda. |
| Motor | Sawtooth | 120 Hz (Fixo) | Lowpass, 250 Hz, Q: 1 | Fade in 0.5s, contínuo | 0.3 | O guincho elétrico entre os andares. |

Variação: O "Ding" pode ser duplo para descer (880 Hz seguido de 740 Hz meio segundo depois).
Distância: A 50m pelo corredor, o Convolver (Reverb) aumenta e o "Ding" domina. O motor vira apenas um lowpass grave em 100 Hz.
Erros comuns: Fazer a porta abrir com decaimento exponencial. O som de deslizar precisa de um envelope em "ponte" (sustentação plana por 1.5s e queda rápida), senão soa como vento.

---

### 8. Orelhão (Ficha caindo, Tons de Linha EUA)

Sensação: Telefonia analógica pura, frequências exatas misturadas e o tilintar de uma moeda na caixa metálica.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Tom de Linha | Sine | 350 Hz + 440 Hz (2 Oscs) | Nenhum | Contínuo. | 0.7 | Dial Tone Americano exato. |
| Ocupado (Busy) | Sine | 480 Hz + 620 Hz (2 Oscs) | Nenhum | 0.5s ON, 0.5s OFF. | 0.7 | Padrão norte-americano. |
| Chamando | Sine | 440 Hz + 480 Hz (2 Oscs) | Nenhum | 2.0s ON, 4.0s OFF. | 0.7 | Ringback tone. |
| Moeda (Queda) | Sine | 2000Hz (curto) + 3500Hz | Highpass, 1000 Hz, Q: 5 | 3 picos irregulares (0.01s cada) em 0.2s | 0.5 | O metal da moeda. |
| Moeda (Cofre) | Ruído | Fixo | Bandpass, 800 Hz, Q: 10 | Pico de 0.05s no final da queda | 0.6 | A caixa de segurança acústica. |

Variação: Sorteie a cadência da moeda quicando na rampa interna do telefone (intervalos de 40ms, 70ms, 30ms).
Distância: Como vem do fone, o volume é íntimo. A 2 metros não se ouve o tom, apenas a moeda (com volume muito baixo).
Erros comuns: Usar ondas quadradas ou dente de serra para tons telefônicos. Eles foram desenhados na vida real usando senoides puras somadas matematicamente para evitar acionamento acidental dos relés.

---

### 9. Trovão (Próximo e Distante)

Sensação: Um rasgo no ar seguido de um ribombar denso, caótico e grave que treme as janelas.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Estalo (Raio) | Ruído | Fixo | Lowpass, 4000 Hz → 500 Hz (0.5s) | Atq: 0.0s, Pico: 1.0, Dec: exp (0.5s) | 1.0 | Somente trovão próximo. |
| Corpo Grave | Ruído | Fixo | Lowpass, 150 Hz, Q: 2 | Atq: 0.0s, Pico: 0.9, Dec: linear (3.0s) | 1.0 | A explosão sônica de base. |
| Rolamento | Ruído | Fixo | Bandpass, 80 Hz, Q: 1 | Ondulante: module o `value` do Gain 3x em 4s | 0.8 | Os ecos batendo nas nuvens/montanhas. |
| Reverb | Convolver | IR de ruído longo | Lowpass 300 Hz | Acompanha os 4 segundos de rolamento | 0.5 | Essencial para a escala de tamanho. |

Variação: Para distâncias longas (trovão distante), remova o "Estalo" completamente. Troque o ataque de 0.0s do "Corpo Grave" por um ataque lento de 1.5s (as altas frequências e o ataque rápido são absorvidos pela atmosfera).
Distância: Trovão atrasa brutalmente (3 segundos de atraso para cada 1 km visual).
Erros comuns: Trovão perfeitamente suave. O rolamento precisa de ondulações no volume (Gain subindo para 0.8, descendo para 0.3, subindo para 0.6...) para simular ecos múltiplos da paisagem.

---

### 10. Ar-condicionado e Transformador

Sensação: Uma presença estática, pesada e elétrica que só é notada de verdade quando desliga.

| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| AC (Vento) | Ruído | Fixo | Lowpass, 400 Hz, Q: 1 | Fade in longo (2s), contínuo | 0.5 | Ar saindo do compressor. |
| AC (Chiado) | Ruído | Fixo | Highpass, 4000 Hz, Q: 1 | Fade in longo (2s), contínuo | 0.1 | Hiss mecânico da grade. |
| Transf. (EUA) | Sine | **60 Hz** (Fixo) | Nenhum | Contínuo. | 0.7 | Ciclo da rede elétrica americana. |
| Transf. (Harm) | Sine | **120 Hz** e **240 Hz** | Nenhum | Contínuo. | 0.4 e 0.2 | Harmônicos que dão o zumbido "irritante". |

Variação: Se a fiação ou o AC for velho, adicione um OscillatorNode Triangle em 30 Hz (sub-grave pulsante) com volume muito baixo (0.1) simulando a vibração solta na parede.
Distância: A 50m, o AC vira puro vento grave (Lowpass 200 Hz). O Transformador de poste projeta os 120Hz muito mais longe que os 60Hz.
Erros comuns: Usar apenas a senóide de 60Hz para o transformador. Sem os harmônicos pares (120/240Hz), ele soa como um teste de sub-woofer genérico e não como eletromagnetismo saturando um núcleo de ferro.