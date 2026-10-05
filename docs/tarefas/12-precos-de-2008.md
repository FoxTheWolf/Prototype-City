# 12: Tabela de preços de 2008 para a economia do jogador

**Para:** Gemini (pesquisa na web). **Volta em:** `docs/tarefas/retorno/12-precos.json`.
**Usado em:** a economia do jogador (etapa 17) e o balanço (apartamento em ~5–7 dias de jogo, hacking ~5x a TI; `docs/visao.md`). O Claude simula a semana do jogador por script com esses números. Exceção às regras gerais: aqui os preços são **reais** de 2008.

--- COLE DAQUI ---

I'm balancing the economy of a video game set in a mid-size American city in **2008**. Please research typical **2008 US prices** (USD, a mid-size city, not New York) and return **only JSON**: an array of objects `{ "item": "...", "low": n, "typical": n, "high": n, "unit": "...", "note": "..." }`.

Cover these items:
- Cheap motel night; weekly rate at a cheap motel; monthly rent of a small studio and of a one-bedroom apartment; security deposit.
- Fast-food meal; diner meal; sandwich; coffee; vending-machine snack and soda; a week of cheap groceries for one.
- Prepaid phone: basic handset, SIM card, airtime top-up, price per SMS, price per minute; smartphone handset (unlocked, like the first iPhone or a BlackBerry) and a monthly data plan.
- Laptop: budget, mid-range, high-end; a RAM upgrade (1–2 GB); an external hard drive; a USB flash drive (1–4 GB); a Wi-Fi USB adapter; a directional Wi-Fi antenna; a police radio scanner; a cheap digital camera.
- Clothes: hoodie, rain jacket, leather jacket, overcoat, baseball cap, beanie.
- Bus fare; subway fare; taxi flag drop and price per mile.
- Freelance IT work: hourly rate for a small-business IT technician; typical price of fixing a small office network or a café's router.
- Hourly wage of a cashier, a café worker, a motel night clerk.
- Bail for a minor offence; a small fine (e.g. trespassing).

Keep notes short; say where a value is a rough estimate.
