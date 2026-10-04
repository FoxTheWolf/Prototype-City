# Feedback do Claude

> O feedback do Claude sobre o jogo: técnico, de jogabilidade, criativo e temático. Datado, o mais novo em cima. Nada aqui está decidido: quando o usuário decidir algo, vai para o CLAUDE.md (Decisões ou Plano) e fica marcado aqui. Tudo o que entra aqui também é mandado no chat. O feedback antigo (até 2026-10-04) está na seção "Opiniões e sugestões do Claude" do CLAUDE.md.

---

## 2026-10-04: depois da etapa 13 (lojas, mochila, fome, placas, gente, pedir direção)

### A tooltip do texto livre

Ótima ideia, e eu concordo sem ressalva. É exatamente o que torna o texto livre jogável: o maior defeito do Façade era o jogador não saber o que o jogo tinha entendido. Mostrar a leitura **antes** de enviar transforma o parser num instrumento que o jogador aprende a tocar. Duas sugestões em cima dela:

- **Mostrar também as palavras que pesaram**, sublinhadas ou coloridas na própria caixa (ex.: *where* e *know* acesas). Ensina o léxico sem tutorial.
- **Mostrar o alvo reconhecido**: "Question about a place's location: **Kessler Deli**". Se o nome não bateu, aparece "place: ?" e o jogador corrige a grafia.
- **O tom como um medidor pequeno**, e não só como palavra, porque o tom é contínuo (grosseiro ↔ respeitoso), e um "please" a mais move a agulha na hora: é tátil, combina com o gosto por interfaces físicas.

### Nome do jogo

"Terminal City" funciona, mas é genérico (existem outras coisas com esse nome) e fala só do terminal, não da cidade em chamas nem do noir. Sugestões, em ordem de preferência:

1. **LINE NOISE**: o ruído na linha telefônica de 2008, o chiado do modem, e "ruído" é o que a cidade inteira é em ASCII. Também diz "hacking" sem dizer.
2. **THE SEAM**: a camada de carvão em chamas sob a cidade. O jogo já gera o nome da camada ("{r} Seam"). Curto, misterioso, e vira o título da história (o que está por baixo).
3. **DEAD AIR**: rádio e telefone em silêncio, a cidade sufocada pela fumaça. Noir.
4. **BACKHAUL**: o termo técnico das ligações entre as antenas e a central. Para quem conhece, é perfeito; para quem não conhece, soa bem.
5. **BROWNOUT**: o apagão parcial; liga com a rede elétrica, que é o primeiro grande sistema hackeável.

Eu ficaria com **LINE NOISE** ou **THE SEAM**. "Terminal City" pode continuar como o nome da cidade no slogan ("Line Noise: a night in Terminal City"), se você gostar dele.

### O nome do jogador

Minha sugestão mais forte: **o protagonista não tem nome dito; a cidade o chama pelo número da linha.** O contratante escreve "0179" (os últimos quatro dígitos do celular). Quando você troca de chip, você vira outra pessoa para o contratante e para a polícia. A identidade do jogador é o número que ele carrega, e trocá-la é uma jogada. É diegético, é 2008 e liga com o sistema de calor que já existe.

Depois disso, o **apelido** que a cidade dá quando você ganha fama (a "lenda urbana" das minhas sugestões de 2026-10-02): o Streetwire e as manchetes inventam um nome ("the Brownout Man", "Static"), e ele muda conforme o que você faz. O jogador nunca escolhe o próprio nome de herói; a cidade escolhe.

Se quiser um nome de verdade para o personagem (para o editor de personagem), deixe o jogador digitar, com a semente sugerindo um nome comum da cidade.

### A história (um fio autoral discreto)

As histórias emergentes continuam sendo o centro. Mas um mistério de fundo dá direção a quem quiser segui-lo. Minha proposta, usando o que já existe:

- **O fogo da camada não apaga porque alguém não quer.** Décadas atrás uma mina pegou fogo. A cidade evacuou a borda, o governo cercou a zona, e o terreno ficou sem valor.
- **O Sarcófago**, a cúpula inacabada com a torre de tiragem, foi vendido como a solução: conter o fogo e gerar energia com o calor. A empresa que o construía faliu no meio da obra.
- **A virada:** a telemetria do Sarcófago ainda transmite, e os sensores mostram que **os poços de ventilação foram reabertos depois da falência**. Alguém está **alimentando** o fogo. Quem lucra? Quem comprou barato os terrenos evacuados da borda, esperando o dia em que o fogo "apagar sozinho" e a área valer de novo. Ou quem vende energia do calor por fora, para a GRIDLINK.
- **Como o jogador descobre:** pelos próprios sistemas. Uma manchete antiga num site de notícias, um e-mail no servidor da empresa falida, o log da RTU de uma subestação que recebe energia de um lugar que não devia existir, a estação de números no rádio de ondas curtas lendo coordenadas dos poços. Nada é obrigatório.
- **Os finais possíveis** (pelos sistemas, não por cutscene): vazar tudo para o jornalista (manchetes, o Streetwire explode, a polícia muda de alvo); sabotar a ventilação (o fogo diminui, a zona encolhe, mas quem lucrava vai atrás de você); ou vender o que sabe ao próprio dono do esquema (dinheiro e calor zerado, e a cidade continua sufocando). É o noir: nenhuma saída limpa.

Isso dá sentido ao Sarcófago, à zona de fogo, ao cordão e à agência que monitora o gás, sem inventar sistemas novos.

### A megaestrutura

- **Que ela se faça ouvir antes de ser vista.** O vento passando pela treliça, um uivo grave e longo nas noites de vento, audível nos bairros da borda. É o tipo de som de que você gosta, e anuncia a escala.
- **Uma luz vermelha de aviação piscando no topo do guindaste mais alto**, visível de qualquer lugar da cidade como um ponto vermelho no horizonte, sem mostrar a estrutura. Do centro, você não vê o Sarcófago; vê uma luz piscando onde não há prédio nenhum. Dá curiosidade sem mexer na skyline.
- **O laranja por baixo das nuvens** na direção da borda, à noite, como a cidade iluminada de baixo. Já existe o fogo no horizonte; nuvens baixas tingidas de laranja daquele lado seriam a assinatura da cidade.
- **Fim de jogo: subir nela.** Uma noite de missão na treliça, com o vento, os guindastes parados e a cidade inteira lá embaixo em ASCII. Pela câmera 3D, seria a imagem do jogo.

### Coisas que eu mudaria ou reforçaria

- **Dar destino ao dinheiro e à fama**, de novo: o laço dos trabalhos existe, as lojas agora existem, e a mochila também. O próximo passo de maior valor é o que eu sugeri na fatia vertical: o SMS de balanço depois de cada trabalho (o que a cidade sabe de você) e trabalhos que se renovam com alvos novos e pagamento pela reputação. Com a etapa 13, o dinheiro já tem onde ir.
- **A bateria do celular criou a primeira escolha de verdade** com o Maps: usar o mapa gasta, pedir direção é de graça e às vezes erra. Isso é exatamente o "atrito que vira decisão". Vale levar a mesma ideia ao notebook (já tem bateria) e ao frio (etapa 22).
- **Pedir direção pode virar a porta da engenharia social.** As mesmas pessoas que respondem "two blocks north" podem, com o tom certo, dizer quem trabalha na loja, a que horas o técnico passa, se viram alguém de casaco perto da subestação. O texto livre com a tooltip é o caminho natural.
- **O mapa de papel e o guia da cidade** podem ter erros e desatualizações de propósito (uma loja que fechou, uma rua renomeada). É um charme de 2008 e faz o jogador confiar na rua.

### Técnico

- **O CLAUDE.md pesa ~55 mil tokens em toda mensagem** (ele é lido inteiro como memória). É a maior parte do custo fixo de cada conversa e acelera o fim do limite. Sugiro uma limpeza:
  - levar as "Lições da etapa N" para `docs/licoes.md`, lido só quando se trabalha naquele sistema;
  - levar as "Opiniões" antigas para este arquivo;
  - levar o mapa de módulos para `docs/mapa.md`.

  O CLAUDE.md ficaria com as regras, as decisões e o plano, talvez com um terço do tamanho. Isso sozinho deve render bem mais trabalho por limite. Posso fazer isso numa sessão curta, se você aprovar.
- **Testes sem o navegador.** Metade do custo das minhas sessões é dirigir o painel do navegador (capturas, esperar o carregamento, o laço parando). Uma pasta `tests/` com scripts que rodam a simulação no Node (comprar, pagar, furtar, a fome, a bateria, pedir direção, os trabalhos) deixaria a maior parte das verificações rápida e barata. O navegador ficaria só para o que é visual.
- **O shader dos objetos está crescendo** (placas, letreiros, rodas, telas, agora a skin). A lição desta etapa (um vetor indexado custou 5 ms) mostra que ele está perto do limite de registradores. Antes de muitos materiais novos, vale separar os materiais raros num segundo passe, ou ao menos medir a cada material.
- **O marco da demo**: os 8 storage buffers continuam sendo o maior risco de tela preta no PC de um amigo.

### Pequenas coisas que notei nesta etapa

- As placas pintadas ficam escuras de dia quando estão viradas contra o sol; é física, mas o olho espera ler a placa. Um "retrorrefletivo" leve (as placas de rua de verdade brilham um pouco) resolveria.
- O primeiro item da lista de cada prateleira aparece pouco no desenho.
- Os balconistas ainda não aparecem atrás do caixa; a loja "atende" sem ninguém visível. É a etapa 16, mas é o que mais quebra a ilusão hoje nas lojas.
