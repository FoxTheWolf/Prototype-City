# Feedback para o Opus 4.8 `[HACKING]`


> Itens que só uma sessão com o Opus 4.8 deve ler e organizar (os `[HACKING]`). As outras sessões **não leem esta subseção** e só acrescentam aqui, sem apagar. O Opus 4.8 organiza na Trilha de hacking e apaga daqui o que organizou.

- [HACKING] **O nome do sistema do notebook vem das empresas da cidade (pedido em 2026-10-02):** hoje "Osprey/UX" está fixo (aparece no boot: `Loading Osprey/UX 4.2 2.6.24-19`, `builder@osprey`). Deve sair de uma empresa de software que existe na simulação, como a marca do celular. O usuário pediu ao Opus 4.8 porque o nome mora no shell (`src/laptop/shell.ts`); avaliar antes se isso atrapalha o hacking (comandos, caminhos, banners que outros hosts mostram), e só fazer se não atrapalhar.
- [HACKING] Adicionar modo recovery para fazer root no celular. (Isso era uma coisa em 2008? Senão, usar uma alternativa. Eu imagino o celular como um hibrido de iphone com blackberry, mas com form factor de celular comum. Inclusive, mais pra frente, uma versão com form factor e teclado de blackberry pro celular seria prudente, e quem sabe uma versão flip igual o notebook). Seria necessário para instalar aplicações de hacking. *(A parte dos formatos BlackBerry e flip já foi para a etapa 15.)*
- [HACKING] **A porta de enrolar como alvo (sugestão do Claude aceita em 2026-10-04):** as portas de enrolar das lojas já seguem o horário (`shutterAt` em `src/sim/doors.ts`); um controlador de horário hackeável numa rua comercial (todas sobem às 3 da manhã) seria uma consequência visível e barata.
