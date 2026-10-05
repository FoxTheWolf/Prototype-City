# `[HACKING]` Design: pacotes de rede simulados

> **[HACKING]: ler só numa sessão da Trilha de hacking.** Movido do CLAUDE.md em 2026-10-04.

## `[HACKING]` Design: pacotes de rede simulados (pedido do usuário, 2026-10-01)
*(seção de hacking — pular fora de uma sessão de hacking; fazer na trilha de hacking, com o Opus 4.8)*

O usuário quer que toda rede do jogo (Wi-Fi, EDGE, 3G e qualquer serviço) funcione **por pacotes de verdade**, para que um capturador de pacotes no estilo do Wireshark (com outro nome, mas o mesmo programa na prática) mostre tudo de forma realista e funcional: handshakes, conexões TCP, perda de pacotes e retransmissão.
- **Quando:** no começo de uma etapa de rede, antes do hacking (14), como fundação dela. Na etapa de bugfix só o Wi-Fi inicial, com o modelo de "fluxo" (KB por segundo).
- **Arquitetura proposta, para manter o desempenho:** a simulação continua com fluxos (sessões: quem fala com quem, quantos bytes, quando). Os pacotes são **materializados de forma determinística a partir das sessões só quando algo está capturando** (o capturador, um log, um IDS de alguma empresa). Sem captura, nada é gerado. Com captura, os pacotes daquela rede aparecem com tudo coerente:
  - 802.11: beacons, probe, autenticação, associação, o handshake de 4 vias do WPA (EAPOL), dados cifrados (WEP/WPA) e em claro nas redes abertas;
  - IP: DHCP, ARP, DNS, TCP (SYN, SYN-ACK, ACK, seq/ack, janela, FIN), HTTP da época;
  - perdas pelo sinal (o mesmo dBm do rádio), com retransmissões e tempos que batem com a vazão do fluxo.
- **O passo da simulação** (granularidade dos pacotes, quantos se guardam) é ajustável, para equilibrar fidelidade e desempenho.
- Nomes de programas fictícios e parecidos (veja "Conteúdo seguro").
