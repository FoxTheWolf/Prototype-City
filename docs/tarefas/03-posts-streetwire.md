# 03: Peças da gramática dos posts do Streetwire (ChatGPT)

Retorno esperado: **um bloco JSON válido**, salvo em `docs/tarefas/retorno/03-posts-streetwire.json`. O Claude confere por script (chaves, slots, condições, pontuação) e junta aos arquivos de `src/locale/text/posts/`.

--- COLE DAQUI ---

Faço um jogo com uma rede social fictícia (o "Streetwire", uma mistura de Twitter e Facebook de **2008**) em que milhares de cidadãos simulados postam sobre o dia. Os posts são montados por uma **gramática gerativa** (estilo Tracery). Preciso de **mais peças** para os posts não repetirem. O jogador viu, por exemplo, vários posts seguidos de gente dizendo que precisa acordar às seis.

**Formato de uma peça** (uma string):
- texto simples em inglês, curto (2 a 12 palavras), **sem ponto final** (a pontuação é posta pelo jogo);
- pode ter **peso** no começo: `"3|texto"` (mais comum) — sem peso vale 1;
- pode ter **condições** entre colchetes no começo: `"[old evening]texto"` (todas precisam valer), `"[teen/young]texto"` (qualquer uma das alternativas), `"[!kids]texto"` (negação). Peso e condição juntos: `"2|[dog]texto"`;
- pode usar **slots** do contexto entre chaves: `{partner}` (nome do cônjuge), `{kid}` (nome do filho), `{petname}` (nome do bicho), `{job}` (nome do lugar onde trabalha), `{colleague}`, `{friend}`, `{district}` (bairro), `{biz}` (uma loja), `{weekday}`. Use um slot **só com a condição que garante que ele existe**: `{partner}` com `[partner]`, `{kid}` com `[kids]`, `{petname}` com `[pet]` ou `[dog]`/`[cat]`, `{job}`/`{colleague}` com `[job]`.

**Condições disponíveis:** idade `kid teen young adult old senior`; gênero `m f`; vida `partner alone kids child roomies pet dog cat job student retired jobless school`; momento `morning noon afternoon evening night weekend wet snowy`.

**Exemplos que já existem** (não repita):
```
"Walking through {district}", "Every light was red", "[dog] {petname} wants to sniff every tree",
"[kids] Walking {kid} home from school", "[teen] skateboarding down the avenue", "[old/senior] My daily constitutional"
```

**O que quero:** um JSON com estas chaves, cada uma com **40 peças novas e variadas** (misture peças sem condição e com condição; pelo menos 1/3 com condições de idade ou de vida, para cada pessoa soar diferente):

```json
{
  "fact.sleep": [ ... ],      // dormir, acordar, insônia, cochilo (VARIE: não só "acordar às seis")
  "fact.food": [ ... ],       // comer em casa, cozinhar, pedir comida, lanche
  "fact.tv": [ ... ],         // TV, DVD, videogame, rádio, internet discada/banda larga de 2008
  "fact.weather": [ ... ],    // calor, frio, vento, céu (as de chuva usam [wet], as de neve [snowy])
  "fact.commute": [ ... ],    // ônibus, trem, táxi, trânsito, atraso
  "fact.shopping": [ ... ],   // compras, preços, liquidação, fila
  "fact.neighbors": [ ... ],  // vizinhos, prédio, barulho, síndico, elevador quebrado
  "fact.night": [ ... ]       // coisas da madrugada na cidade: sirenes, luzes, silêncio, quem está acordado
}
```

**Regras de conteúdo (obrigatórias):** sem palavrão, insulto, conteúdo sexual, drogas, violência explícita ou política; nada de marcas, celebridades, cidades ou lugares reais; tecnologia de 2008 (MP3 player, flip phone, SMS, DVD, MySpace-like, sem apps modernos, sem "streaming", sem "selfie"); tom de pessoa comum, às vezes engraçado, às vezes cansado. Responda **só** com o JSON (sem os comentários `//`).
