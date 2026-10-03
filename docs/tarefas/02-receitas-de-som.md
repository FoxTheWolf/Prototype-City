# 02: Receitas de síntese de som (Gemini)

Retorno esperado: Markdown, salvo em `docs/tarefas/retorno/02-receitas-de-som.md`. O Claude traduz cada receita para o código (`src/audio/sound.ts`) e o usuário testa de ouvido.

--- COLE DAQUI ---

Faço um jogo de navegador em que **todo som é sintetizado na hora com a Web Audio API**, sem nenhum arquivo de áudio. As únicas peças disponíveis são:
- `OscillatorNode` (sine, square, sawtooth, triangle), com frequência automatizável;
- um buffer de **ruído branco** tocado por `AudioBufferSourceNode`;
- `BiquadFilterNode` (lowpass, highpass, bandpass, notch, peaking), com frequência e Q automatizáveis;
- `GainNode` com envelopes (`setValueAtTime`, `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, `setTargetAtTime`);
- `WaveShaperNode` (distorção), `DelayNode`, `StereoPannerNode`, `ConvolverNode` com uma resposta de impulso **gerada** (ruído com decaimento).

Para cada som abaixo, quero uma **receita em camadas** que eu possa programar diretamente. Formato para cada som:

```
### Nome do som
Sensação: (uma frase: o que o ouvido deve perceber)
| Camada | Fonte | Frequência (início → fim, tempo) | Filtro (tipo, freq, Q) | Envelope (ataque, pico, decaimento, duração) | Volume relativo | Observação |
Variação: (o que sortear a cada vez para não repetir: faixa de cada parâmetro)
Distância: (como mudar o som quando vem de 50 m, 200 m e 600 m: filtros, volume, atraso)
Erros comuns: (o que faz soar falso; por exemplo, osciladores agudos com decaimento longo soam como sino)
```

Sons (em ordem de prioridade):
1. **Batida de carro** em velocidade urbana (30–50 km/h): uma **pancada seca e pesada**, o amassar da lataria e um pouco de vidro. Hoje o meu soa como um **sininho**, porque o vidro é feito de osciladores senoidais agudos (3–7 kHz) com decaimento: explique como fazer o vidro sem soar tonal.
2. **Sirene de polícia americana de 2008** (wail e yelp) e **sirene de ambulância**, com o efeito Doppler de um veículo passando a 60 km/h.
3. **Buzina de carro** (comum e de caminhão/ônibus).
4. **Freio a ar de ônibus** (o "psssh") e o motor diesel em marcha lenta.
5. **Porta de carro batendo** e **porta de prédio** (vidro com mola, metálica de saída de emergência).
6. **Passos**: sapato em concreto seco, em concreto molhado (com poça), em piso de madeira interno, em escada metálica de incêndio.
7. **Elevador**: o "ding" de chegada, as portas abrindo, o motor zumbindo entre andares.
8. **Orelhão**: moeda caindo no cofre e o tom de discagem americano (350+440 Hz) — confirme as frequências reais dos tons de linha, ocupado e chamando nos EUA.
9. **Trovão** próximo e distante (estalo + rolamento grave).
10. **Ar-condicionado de janela** e **transformador zumbindo** (ambiente urbano à noite).

Seja concreto nos números (Hz, segundos, Q). Nada de "use um sample".
