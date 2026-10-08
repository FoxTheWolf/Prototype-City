# `[HACKING]` Design: a rede física de computadores e modems

> **`[HACKING]` — ler só numa sessão com o Opus 4.8 ou o agente `hacking`** (ver CLAUDE.md, "Arquivos de hacking"). Escrito na reunião de 2026-10-08 a pedido do usuário (fazer o doc de design **antes** de implementar, como o navegador e o celular, e seguir quase à risca). É a **base comum da TI legítima e do hacking** (a subetapa 18.2). Tudo 100% fictício e contido no jogo; nomes de equipamento e programa são fictícios parecidos (regra "Conteúdo seguro").
>
> **O que já existe (não reinventar):** `src/sim/network.ts` tem `Host {ip,name,kind,ports,user,pass,mac}`, `Port {n,service,banner}`, `lanHosts(w,ap)` (gera as máquinas atrás de cada AP pela semente), `WORDS` (senhas fracas), `setBreaker`/`setSignals`/`modbusRegs`/`cellLog`. `src/sim/wifi.ts` tem os APs (`AccessPoint` com `key` WEP, `Sec`, `util`/`omc`). O shell (`src/laptop/shell.ts`) tem `mmap` (scan), `bruter`, `tnet`/`conn`/`remote` (sessão), `tdump`, `mbus`. **Este doc estende esse modelo**; o que ele acrescenta está marcado "NOVO".

## 1. O problema que o doc resolve

Hoje a rede é **só sem fio e abstrata**: as máquinas existem "atrás de um AP", geradas sob demanda por `lanHosts`, sem presença física no mundo e sem o conceito de **modem/equipamento que você vê, no qual você mexe, e que pode estar com defeito**. A TI legítima (consertar modem, resolver conexão, montar a rede de um prédio) **não tem em que se apoiar**. E o hacking profundo precisa de uma topologia real: máquinas que só se alcançam **de dentro** de uma rede, um caminho a descobrir, logs que ficam.

A tese da 1.0 (usuário, 2026-10-08, estilo Uplink): **a dificuldade é achar o caminho no sistema**, não fugir. Então a rede tem que ser um **labirinto honesto e determinístico**: a mesma semente dá sempre a mesma topologia, o jogador raciocina e acha a entrada, e o teste garante que sempre há um caminho.

## 2. A referência real de 2008, destilada (o que importa para o jogo)

- **Modem × roteador × gateway.** Em 2008, numa casa/loja: um **modem** (DSL/cabo) que fala com a operadora, e um **roteador** Wi-Fi (às vezes o mesmo aparelho "modem-roteador"). O roteador tem uma **página de administração web** (`192.168.0.1`/`192.168.1.1`), com login (muitos no padrão de fábrica `admin/admin`), e às vezes **telnet** (23) nos modelos antigos. Config: SSID, canal, segurança (WEP/WPA), port forwarding, DHCP, firmware.
- **Rede residencial/comercial pequena.** Atrás do roteador: 0–3 PCs (Windows XP, compartilhamento SMB nas portas 135/139/445), talvez uma impressora de rede, um NAS. É o que `lanHosts` já faz. **Falta:** a impressora/NAS, e a ideia de que um PC pode ter **um segundo adaptador** ligado a outra rede (o pivô).
- **Rede de empresa.** Um **gateway/firewall** na borda; atrás dele uma **rede interna** com servidores (arquivos, e-mail, banco de dados, controlador de domínio) que **não se alcançam de fora** — só de dentro, a partir de uma máquina comprometida. É o coração do "achar o caminho": entrar pela borda fraca (um PC, o Wi-Fi, um modem mal configurado) e **pivotar** para dentro.
- **Sistemas industriais/municipais (SCADA).** Subestações e semáforos: um **RTU** (porta 502 Modbus) e um **cabinet** de semáforo, atrás de um **rádio-bridge** de manutenção. Já existe (`util` em wifi.ts). São sistemas que **respondem sem estar na internet** — a ponte para o Jackdaw (dispositivos físicos).
- **Como se acessa de verdade.** (a) **web admin** (porta 80, formulário de login, páginas de config); (b) **telnet/console** (porta 23, prompt de login/senha, comandos); (c) **SMB/arquivos** (135/139/445); (d) **Modbus** (502, registros). Autenticação: senha fraca da lista, padrão de fábrica, ou **sem senha** (mal configurado). **O WEP** quebra por IVs (já feito, `wcrack`); **WPA** é inquebrável sem a chave de outra fonte.
- **O que quebra de verdade (defeitos de TI).** Modem sem sinal (linha/DSL caída), canal Wi-Fi congestionado, segurança no padrão inseguro, DHCP esgotado/desligado (sem IP), cabo/porta errada, firmware travado (precisa reiniciar), DNS errado, port-forward faltando, rede dividida em duas que deviam se ver. **Todos determinísticos** e **consertáveis por um procedimento** — nunca sorteio.

## 3. Os elementos no jogo (o modelo de dados)

Estende `network.ts`. Mantém `Host`/`Port` e acrescenta:

- **`Device` (NOVO) — o equipamento físico no mundo.** Um objeto da simulação (como um poste) com posição, tipo (`modem`, `router`, `switch`, `pc`, `printer`, `nas`, `rtu`, `signal`, `bridge`, `gateway`), o `Host` que ele serve, e um **estado de defeito** (`fault?: FaultKind`). O jogador o vê (uma caixa/CPE na parede, um rack numa salinha técnica), e para a TI **vai até ele** e mexe (reinicia, troca cabo, abre a web admin). Fica no mundo via os interiores (13) e os postes/caixas (17.5). Reaproveita o padrão de objeto dos interiores; não inventar um sistema de objeto novo (regra "um sistema só").
- **`Link` (NOVO) — a ligação entre máquinas.** `{from: ip, to: ip, kind: 'lan'|'uplink'|'trunk'|'serial'}`. Hoje a topologia é implícita (tudo na mesma LAN do AP). O `Link` torna explícita a **rede interna atrás de um gateway**: um `pc` comum tem um `Link` `lan` para o `router`; o `router` tem um `uplink` para o `gateway` da empresa; o `gateway` tem `trunk` para os servidores internos. **A regra:** um host só aparece no scan (`mmap`) de quem **tem um Link até ele**. De fora, você só vê a borda; de dentro de um host comprometido, você vê os vizinhos dele. É o pivô.
- **`Network` (NOVO, leve) — o agrupamento.** `{id, owner (business/home/util/telco), edge: ip (o gateway/router), internal: ip[] (só de dentro)}`. Gerado da empresa (`city.businesses`) ou da casa. A maioria das casas/lojas é uma `Network` rasa (só a LAN, sem `internal`); bancos, operadora, prédios de escritório e o provedor têm `internal`.
- **`FaultKind` (NOVO) — os defeitos de TI.** Enum determinístico por `Device` e por trabalho: `no_signal`, `bad_channel`, `weak_sec`, `no_dhcp`, `wrong_cable`, `frozen_fw`, `bad_dns`, `missing_forward`, `split_net`. Cada um tem (a) um **sintoma** que o cliente descreve em linguagem comum ("a internet cai à noite"), (b) um **diagnóstico** (o que o jogador observa na web admin/no terminal), (c) um **conserto** (o procedimento). Tabela no locale (`[HACKING]`).
- **Serviços e portas:** reusar `Port`. Acrescentar `smtp`/`pop3` (e-mail interno), `mysql`/`mssql` (banco de dados), `ipp`/`jetdirect` (impressora), `ftp`, `ssh` (raro em 2008, equipamento caro). Os banners são fictícios.
- **Senhas:** reusar `WORDS`. Acrescentar a noção de **credencial achada** (num arquivo de um PC, num post-it fotografado, num e-mail): uma senha forte que **não está na lista** e só se consegue por OSINT/engenharia social — a ponte com a web (15) e o diálogo (14).

## 4. Geração e ordenação (da semente, determinística)

Segue a ordem da geração da cidade (malha → prédios → empresas → cidadãos). A rede nasce **depois das empresas**, antes do primeiro segundo de jogo (como a web): a cidade existe sem o jogador.

1. **Por empresa/casa:** sorteia a `Network`. **Profundidade MÉDIA (decidido pelo usuário, 2026-10-08):** casa/loja pequena = LAN rasa (router + 0–3 PCs, como hoje); empresa média = borda (router) + gateway + **1–3 servidores internos** (um pivô); banco/operadora/provedor = gateway + rede interna de **~2 saltos**. O pivô existe e é legível, sem virar labirinto. (As opções rasa/profunda/variável-por-alvo foram descartadas; se quisermos uma curva de dificuldade, ela vem do nível no fórum escolhendo alvos mais fundos, não de mudar a regra.)
2. **IPs:** mantém `192.168.<ch>.x` nas LANs; a rede interna usa `10.x.x.x` (privado, dá o clima de "lá dentro").
3. **Senhas e segurança:** da semente, pela `WORDS`; a borda é a mais fraca (padrão de fábrica em ~1/3), os servidores internos exigem credencial achada ou pivô (nunca brutáveis sozinhos).
4. **Os Links:** cada host ganha os Links que o conectam (lan/uplink/trunk). **O teste de alcançabilidade (NOVO, em `tests/`, espelha o teste das plantas):** para todo alvo de trabalho, existe **pelo menos um caminho** de uma **entrada acessível ao jogador** (um Wi-Fi ao alcance, um Device físico, um host com borda fraca) até ele, com as ferramentas que o jogador tem naquele ponto. Sem caminho = a geração recusa aquele alvo (como a planta recusa um cômodo inalcançável).
5. **Defeitos:** só os `Device` de um **trabalho de TI ativo** têm `fault`; o resto está saudável (não poluir a cidade com defeitos). O trabalho escolhe o `Device`, o `FaultKind` e confere que o conserto é possível com o que o jogador tem.

## 5. As telas (onde a rede encontra a interface)

- **Web admin do equipamento (NOVO):** uma página no navegador do notebook (`src/web/`), no estilo dos sites de 2008 que já existem (`web/page.ts`/`bizPage`), mas é a **config de um roteador/modem/gateway**: abas (Status, Wireless, Security, DHCP, Firmware), campos editáveis, um botão "Apply/Reboot". **Reusar o motor de páginas** (`HdOp`, `web/ops.ts`), não fazer outro. É aqui que a TI conserta (trocar o canal, ligar o DHCP) e o hacker mexe (abrir a porta, ler a senha salva).
- **Console telnet (existe):** o `tnet`/`conn`/`remote` do shell já dá o prompt de login e os comandos. Acrescentar os comandos dos novos tipos (listar arquivos no PC, ler o banco, a fila da impressora) — **tocar só o necessário de `shell.ts`** (`docs/mapa-shell.md`), ou pelo agente `hacking`.
- **O scan (`mmap`, existe):** passa a mostrar **só o que tem Link até o ponto de vista** (de fora = a borda; de um host comprometido = a rede interna). É o retorno orgânico de "entrei mais fundo".
- **Device no mundo:** ao chegar perto de um `Device` com `F`, um painelzinho diegético (reiniciar, ver status, abrir a config) — como os interruptores/painéis do mundo. O Jackdaw pluga nele quando é offline (semáforo/subestação).

## 6. Os dois caminhos até o alvo (decisão da entrevista de 2026-10-04)

Todo alvo se alcança de **duas** formas, e o teste de alcançabilidade garante pelo menos uma:
- **Perto (físico/antena):** ir até o Wi-Fi/Device e entrar dali. Rápido, expõe o corpo (na 1.0 isso é neutro — calor é pós-1.0 —, mas o sysadmin ainda vê o MAC nos logs). A **antena direcional** é o alcance (hackear do outro lado da rua), **não** subterfúgio.
- **Pela rede (pivô):** de um host já comprometido, seguir os Links para dentro. Mais lento, mais logs (cada salto deixa rastro no host por onde passou), mas sem expor o corpo. É o coração do estilo Uplink.

## 7. A TI legítima sobre isso (a subetapa 18.3, o lado limpo)

Um trabalho de TI = um `Device` com um `FaultKind`, um cliente que descreve o sintoma (SMS, canal legítimo), e um pagamento pequeno. O jogador: vai até o equipamento (ou entra pela rede do cliente, que lhe deu a senha), **diagnostica** (a web admin/o console mostram o defeito), **conserta** (o procedimento), e o cliente confirma (a conexão voltou — retorno orgânico: o modem pisca verde, o SMS de agradecimento). **O sucesso confere só o que o jogador fez** (o canal certo, o DHCP ligado), nunca a simulação. Ensina as ferramentas que o hacking usa (scan, web admin, console, senhas) sem risco. A ponte: um cliente satisfeito vira o primeiro contato do outro lado (o mentor, 18.4/25).

## 8. Plano de implementação (a ordem de fazer)

1. **`Device`, `Link`, `Network`, `FaultKind`** em `network.ts` (ou um `netgen.ts` novo `[HACKING]` se `network.ts` ficar grande). O gerador por empresa/casa, determinístico, cacheado por mundo (como `lanHosts`), na lista do `popCache` (acrescentar o arquivo à chave).
2. **O teste de alcançabilidade** em `tests/net-reach.ts` (uma semente por execução), rodando no Node: para cada alvo de trabalho, achar um caminho de uma entrada. Falha = a geração recusa o alvo.
3. **O `mmap` passa a respeitar os Links** (ponto de vista). Tocar só o necessário do shell.
4. **A web admin do equipamento** sobre o motor de páginas (`web/ops.ts`), reusando o layout de 2008.
5. **Os `Device` no mundo** pelo sistema de objeto dos interiores (pedir ao Opus 5.5 o visual das caixas/racks; a lógica é minha).
6. **Os defeitos de TI** (tabela no locale) e os trabalhos de TI em `sim/jobs.ts` (já é agnóstico de canal).
7. **A credencial achada** (OSINT) ligando à web/ao diálogo — fase 2, quando o diálogo e a web estiverem maduros (como o sniff da P13).

## 9. O que NÃO entra agora (profundidade onde se percebe)

- A simulação completa de pacotes do `design-hacking.md` — a 10.11 já materializa o bastante; só expandir se um hack precisar.
- Internet pública navegável como rede hackeável — a web (15) é para **ler** (OSINT); mexer é pelos acessos físicos e pelo pivô, não "hackear a internet".
- SSH/criptografia forte em quantidade — raro em 2008; manter o WEP/telnet/senhas fracas como o normal da época.
