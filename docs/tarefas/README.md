# Tarefas para delegar a outras IAs

Briefings curtos e autocontidos, um por tarefa, para o usuário colar no **Gemini** (pago) ou no **ChatGPT** (grátis). Nenhum depende de ler o código. O resultado volta para o Claude conferir (de preferência por script) antes de entrar no jogo.

**Como usar:** abra o arquivo, copie **tudo a partir da linha `--- COLE DAQUI ---`** para a outra IA, e salve a resposta em `docs/tarefas/retorno/<nome-do-briefing>.md` (ou `.json`, quando pedido). Na próxima sessão, diga ao Claude que o retorno está lá.

| Arquivo | Para | O que é | Usado em |
|---|---|---|---|
| `01-tipos-de-lugar.md` | Gemini | Catálogo de tipos de lugar de uma cidade americana de 2008 (o que vende, cômodos, móveis, horários, quem trabalha) | Fundação "tipos de lugar", Maps com categorias, economia |
| `02-receitas-de-som.md` | Gemini | Receitas de síntese (Web Audio, sem arquivos) para batida de carro, sirenes, portas, passos etc. | Sons (15b e correções) |
| `03-posts-streetwire.md` | ChatGPT | Mais peças da gramática dos posts, em JSON, nos assuntos que estão repetindo | Rede social |
| `04-nuvens-e-raios.md` | Gemini | Segunda opinião técnica: nuvens volumétricas e raios de luz num compute shader WebGPU com um raio por célula | Iluminação (sessão B) |
| `05-distrito-entretenimento.md` | Gemini ou ChatGPT | Lista de objetos e letreiros de um distrito estilo Kamurocho/Times Square, com medidas e luz | Distrito de entretenimento |
| `06-hoje-em-2008.md` | Gemini (pesquisa na web) | "Today in 2008" para as 366 datas e 150 fatos de 2008, em JSON (fatos **reais**: a exceção à regra abaixo) | Tela de carregamento |
| `09-plantas-de-lojas.md` | ChatGPT ou Gemini | Plantas em texto dos tipos de loja sem modelo (banco, hotel, motel, farmácia, livraria…) e uma variação a mais dos que já têm | Interiores (13.10c) |
| `10-nome-e-identidade.md` | Gemini (pesquisa) | Checagem do nome GRID DOWN/GridLink, marcas de concessionárias por volta de 2008, pichação sobre logos, cinco direções de logo | Identidade visual |
| `11-falas-primeira-noite.md` | ChatGPT ou Gemini | Falas da primeira noite (motel, cybercafé) e dos sinais das duas camadas (memória, fofoca, recusa, quem ouve, polícia), em JSON | Primeira hora, diálogo (14) |
| `12-precos-de-2008.md` | Gemini (pesquisa) | Preços reais de 2008 (moradia, comida, celular, notebook e peças, roupas, transporte, salários, fiança), em JSON | Economia (17), balanço |

**Regras para todas:** nada de marcas, nomes ou lugares reais (tudo inventado); textos limpos (sem palavrão, insulto, conteúdo sexual ou violência explícita); época por volta de 2008.
