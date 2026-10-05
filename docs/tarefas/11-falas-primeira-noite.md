# 11: Falas da primeira noite e dos sinais do mundo

**Para:** ChatGPT (grátis) ou Gemini. **Volta em:** `docs/tarefas/retorno/11-falas.json`.
**Usado em:** a primeira hora (motel e cybercafé), o diálogo (etapa 14) e o teste das duas camadas (`docs/visao.md`). O Claude converte para as peças da gramática (`locale/text/`) e confere por script.

--- COLE DAQUI ---

Write short lines of dialogue for NPCs in a video game set in a fictional American city around 2008 (noir mood, but **clean language**: no swearing, insults, sexual content or violence; nobody is ever hurt). The player character is never named or gendered: NPCs refer to them as "you", or describe them by their clothes ("the one in the grey jacket") or by their phone number's last four digits (use the placeholder `{num}`). Other placeholders you may use: `{place}`, `{street}`, `{name}` (an NPC's first name), `{price}`, `{time}`.

Return **only JSON**: an object whose keys are the situation ids below, each an array of **8 different lines** (vary age, mood and wording; under 20 words each; American English of 2008).

- `motel.rent_due`: SMS from the motel manager: tonight's room is paid but tomorrow's is due.
- `motel.manager_greet`: the motel manager at the front desk, tired, night shift.
- `cafe.urgent_sms`: SMS from a cybercafé owner whose network went down at 6pm, desperate, asking the player (a freelance IT person he hired) to come right now; mentions `{place}` on `{street}`.
- `cafe.call_again`: the same owner phoning again because the player is late ("where are you?").
- `cafe.thanks_credit`: the owner thanking the player and giving them credit for the vending machine.
- `cafe.friend_intro`: the owner, in a low voice, saying he has a friend "who knows computers like you" with another job, and will pass on the player's number (he does not say what the job is).
- `phone_shop.new_sim`: a phone-shop clerk selling a new SIM card and remarking that the player will have to tell their friends the new number.
- `npc.unknown_number`: someone answering a call from a number they don't know.
- `npc.recognised_after_name`: the same person after the player says who they are ("Oh, it's you!").
- `npc.remembers_small`: an NPC remembering a small past chat with the player (`{time}` ago, about `{place}`).
- `npc.remembers_lie`: an NPC who found out the player lied to them, now cold.
- `npc.heard_gossip`: an NPC who never met the player but heard from `{name}` that the player lied.
- `npc.refuse_busy`: someone on the street declining to talk because they are in a hurry, saying why.
- `npc.refuse_wary_night`: someone declining to talk at night because they are wary.
- `npc.overheard`: a bystander reacting to overhearing something suspicious the player said ("did they just say...?").
- `npc.whisper_odd`: someone reacting to the player whispering to them.
- `clerk.shortage`: a shop clerk explaining a price went up because a delivery didn't come after a blackout on `{street}`.
- `police.again`: a police officer recognising someone with a prior record ("You again?").
- `police.reads_report`: an officer at the station handing back belongings and a copy of the incident report.
