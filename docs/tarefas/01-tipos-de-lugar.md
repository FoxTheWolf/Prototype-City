# 01: Catálogo de tipos de lugar (Gemini)

Retorno esperado: **um único bloco JSON válido**, salvo em `docs/tarefas/retorno/01-tipos-de-lugar.json`.

--- COLE DAQUI ---

Estou fazendo um jogo de simulação de cidade (estilo Shadows of Doubt / Cataclysm DDA), ambientado numa cidade americana fictícia de ~2×2 km, em grade (como Manhattan/Liberty City do GTA IV), por volta do ano **2008**. Todo prédio tem interior. Preciso de um **catálogo de tipos de lugar** (lojas, serviços, escritórios, residências) para gerar interiores coerentes: o que o letreiro diz tem de ser o que o interior é, e o que se vende lá.

Quero de **45 a 60 tipos**, cobrindo: comida e bebida (café, diner, bar, pizzaria, food court, delicatessen, padaria…), varejo (farmácia, mercadinho/bodega, loja de eletrônicos, loja de celulares, banca de jornal, lavanderia, loja de penhores, loja de discos/DVD, livraria, ferragens…), serviços (banco/agência, **cybercafé/lan house**, copiadora, barbearia, academia, consultório, hotel barato, delegacia, correio, estacionamento…), escritórios (advocacia, contabilidade, seguradora, call center, agência de publicidade, empresa de software pequena, sede corporativa…), entretenimento noturno (boate, karaokê, fliperama, cinema pequeno, sala de sinuca), indústria leve (oficina mecânica, gráfica, depósito) e residências (apartamento de 1 quarto, de 2 quartos, estúdio, cortiço/SRO, cobertura).

Para cada tipo, um objeto com **exatamente** estes campos (em inglês, porque o jogo é em inglês):

```json
{
  "id": "cybercafe",                       // snake_case, único
  "name": "Cybercafe",                     // nome genérico do tipo
  "category": "services",                  // food | retail | services | office | nightlife | industry | home
  "district_fit": ["commercial", "theater"], // onde aparece: financial | commercial | residential | historic | industrial | theater
  "floor": "ground",                       // ground | upper | any
  "area_m2": [60, 140],                    // faixa típica da área útil
  "rooms": [                               // cômodos, com fração da área e móveis
    { "name": "main hall", "share": 0.75, "furniture": ["pc desk x12", "chair x12", "counter", "printer", "vending machine"] },
    { "name": "restroom", "share": 0.05, "furniture": ["toilet", "sink"] },
    { "name": "back office", "share": 0.2, "furniture": ["desk", "safe", "router rack", "shelf"] }
  ],
  "sells": ["internet time (per hour)", "printing", "soda", "snacks"], // produtos ou serviços, 3 a 10
  "price_range_usd_2008": [1, 6],          // faixa de preço típica de um item, em dólar de 2008
  "hours": "08-02",                        // horário típico, "HH-HH" (24h; "00-24" para 24 horas)
  "staff": ["manager", "attendant x2"],    // papéis de quem trabalha lá
  "has_wifi": true,                        // se em 2008 é comum ter Wi-Fi para clientes
  "sign_words": ["NET", "CAFE", "ONLINE", "INTERNET", "WEB"], // palavras para gerar nomes fictícios no letreiro
  "night_life": 0.6,                       // 0 = vazio à noite, 1 = mais cheio à noite
  "notes": "One or two sentences of what makes it feel real in 2008 (e.g. coin-op timers, CRT monitors, LAN games at night)."
}
```

Regras:
- **Nada de marcas reais** (nem Starbucks, nem McDonald's, nem Apple): só tipos genéricos.
- Móveis com nomes simples de objetos físicos (o jogo desenha cada um como um modelo 3D simples); use `xN` para quantidade.
- Tecnologia plausível para 2008 (monitores CRT e LCD, telefones fixos, máquinas de cartão, sem smartphones por toda parte).
- Responda **só** com o JSON: `{ "places": [ ... ] }`, sem comentários dentro do JSON (os `//` acima são só explicação).
