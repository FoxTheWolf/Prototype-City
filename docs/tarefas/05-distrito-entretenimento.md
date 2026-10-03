# 05: Objetos e letreiros de um distrito de entretenimento (Gemini ou ChatGPT)

Retorno esperado: **um bloco JSON válido**, salvo em `docs/tarefas/retorno/05-distrito-entretenimento.json`.

--- COLE DAQUI ---

Faço um jogo de cidade noturna desenhada em caracteres ASCII, em primeira pessoa, por volta de **2008**, com clima noir. Quero um **distrito de entretenimento** denso, inspirado na sensação de Kabukicho (Tóquio), Times Square e Koreatown: ruas estreitas de pedestres, letreiros verticais empilhados, caixas acesas nas paredes, cavaletes acesos na calçada, máquinas de venda, fios cruzando a rua, lixo empilhado, ar-condicionado nas paredes. **Tudo fictício** (nenhuma marca, nome ou lugar real).

Cada objeto do jogo é montado com **caixas e cilindros simples** (peças), com cor e, se acender, cor da luz. Preciso de uma lista de **25 a 35 objetos e tipos de letreiro**, cada um assim:

```json
{
  "id": "standing_sign",
  "name": "Lit sidewalk A-frame sign",
  "where": "sidewalk",                  // sidewalk | wall | above_street | rooftop | alley | entrance
  "size_m": [0.6, 0.4, 1.1],            // largura, profundidade, altura
  "mount_height_m": 0,                  // altura do chão onde fica (0 no chão; 3.5 = segundo andar)
  "parts": [                            // como montar com caixas/cilindros, do chão para cima
    { "shape": "box", "size_m": [0.6, 0.05, 1.0], "at_m": [0, 0, 0.05], "color": "#202020", "glow": null },
    { "shape": "box", "size_m": [0.55, 0.06, 0.6], "at_m": [0, 0, 0.4], "color": "#ffe0a0", "glow": "#ffcc66" }
  ],
  "light": { "color": "#ffcc66", "radius_m": 3, "flicker": "none" }, // ou null; flicker: none | buzz | chase | blink
  "text": "short generic words it could show, e.g. KARAOKE, BAR, OPEN, 24H",
  "density_per_100m_street": 6,         // quantos por 100 m de rua nesse distrito
  "notes": "one sentence of how it reads at night"
}
```

Inclua também, à parte, **um portal de entrada** sobre a rua (arco com letreiro aceso) e **5 paletas de neon** (cada uma com 3 a 5 cores em hex) que combinem com noite chuvosa. Responda só com `{ "objects": [...], "gate": {...}, "palettes": [...] }` (sem os comentários `//`).
