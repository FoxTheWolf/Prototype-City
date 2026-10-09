# Contas e limites — para revezar e desenvolver todo dia

> Pedido do usuário em 2026-10-08. Três contas Pro, com renovação semanal em dias/horas diferentes. **A meta** (CLAUDE.md, "Aconselhar pelo limite semanal"): desenvolver **todo dia, ou quase**, revezando as contas para **nunca ficar 1–2 dias parado** por ter gastado o semanal de uma só.
>
> **Como sei em qual conta estou:** o `get_usage` **não nomeia a conta** — mostra só o limite e a **hora de renovação do semanal** da conta atual. Eu identifico a conta batendo essa hora com a tabela abaixo. **A cada sessão:** rodar `get_usage`, achar a conta, **atualizar o snapshot dela aqui**, e aconselhar por conta (quanto dá hoje sem comprometer os próximos dias; quando cada uma volta).
>
> **Limitação honesta:** só vejo ao vivo a conta **atual**; das outras duas, só sei o último snapshot (datado abaixo). Para espaçar, o que conta mesmo é a **hora de renovação** (fixa) de cada uma.

## As contas (nomes e renovação ditos pelo usuário em 2026-10-08)

| Conta | Renova (semanal, Brasília) | Observação |
|---|---|---|
| **C** | **terça, ~13h** | — |
| **F** | **terça, ~23h** (o usuário disse "11"; o `get_usage` desta sessão mostra terça à noite) | é a conta desta sessão (2026-10-08) |
| **V** | **sábado** | o usuário vai passar para ela na próxima sessão (tem folga até sábado) |

> C e F renovam as duas na **terça**, diferenciadas pela hora (C ~13h, F ~23h). V é a do **sábado**.
> (Nomes escolhidos pelo usuário por motivos pessoais; antes eram A/B/C — A→C, B→F, C→V.)

## Último snapshot observado (atualizar a cada sessão)

- **F** — 2026-10-08 (esta sessão): semanal **~56%**, janela de 5 h **~34%**. Renova terça.
- **C** — (sem observação ainda)
- **V** — (sem observação ainda)
