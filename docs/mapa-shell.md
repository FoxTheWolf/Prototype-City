# [HACKING] Mapa das linhas sensíveis do shell do notebook

> **Para que serve.** O classificador de segurança pode cortar uma sessão normal (fora do Opus 4.8)
> ao ler `src/laptop/shell.ts` inteiro, porque o arquivo mistura a interface do terminal (normal)
> com os comandos de hacking. Este mapa diz **quais faixas evitar** e **quais são seguras de editar**,
> para uma sessão normal mexer nas emendas da interface (como o gerenciador de janelas da 15.7) sem
> abrir as regiões de hacking. Quem mantém este mapa é o **Opus 4.8** (ou o agente `hacking`).
>
> **Regra:** os números de linha andam a cada edição do `shell.ts`. Recalcular este mapa (um
> `grep -nE` como o de baixo) **toda vez** que o `shell.ts` for editado. Preferir ancorar pelos
> **nomes** (os `case '<cmd>'`, o método `remote`), não pelos números.
>
> Comando para reconferir as faixas:
> `grep -nE "HACK_TOOLS|WEP_IVS|private conn|private cap|private remote|private capStep|private tdumpMon|case 'job'|case 'mmap'|case 'bruter'|case 'wcrack'|case 'tdump'|case 'tnet'|case 'mbus'|cellLog" src/laptop/shell.ts`

## `src/laptop/shell.ts` — faixas (conferidas em 2026-10-06, ~1140 linhas; WEP crack acrescentado)

**SENSÍVEIS (`[HACKING]`, não abrir numa sessão normal):**
- **linha ~15** — `import ... from '../sim/network'` (`lanHosts`, `modbusRegs`, `setBreaker`, `setSignals`, `cellLog`, `WORDS`).
- **~58–60** — `HACK_TOOLS` (bruter, wcrack); a instalação no `/bin` do jogador fica em ~150.
- **~62–85** — `WEP_IVS`, `wepIvRate`, `parseCapture` (os helpers puros do crack de WEP, exportados; é o que os testes importam).
- **~202, ~204** — os campos `private conn` (console remoto) e `private cap` (captura de IVs em andamento).
- **~280 (dentro de `interrupt`)** — a linha que, no Ctrl+C, chama `finishCapture()` se há captura.
- **~293–345** — `private capStep` / `private finishCapture` / `private tdumpMon` (o modo monitor do WEP).
- **~630, ~656** — o desvio para `remote()` no `run()` e o método `private remote(...)` inteiro (o console remoto; inclui o host `omc` da operadora e o comando `log <número>` que lê `cellLog`).
- **no `exec()` switch, os `case`:** `job` (~877), `mmap` (~1032), `bruter` (~1050), `wcrack` (~1068), `tdump` (~1088, inclui o ramo `mon` que chama `tdumpMon`), `tnet` (~1109), `mbus` (~1123).

**NEUTRAS (seguras numa sessão normal):** todo o resto do arquivo — o boot/BIOS, o editor, o sistema de
arquivos, o prompt e a edição de linha (`termKey`), o `paste`, o `screen()`/`key()`, o gerenciador de
janelas (`wm`), e os comandos comuns (`ls`, `cat`, `cd`, `acpi`, `lodestar`…). Os comandos de Wi-Fi
`iwconfig`/`iwlist`/`dhclient`/`ping` (~771–838) são rede comum (juntar-se a um ponto): leves, mas
evitar abri-los junto de uma das faixas sensíveis acima, por garantia.

## Outros arquivos inteiramente `[HACKING]` (ver a lista no CLAUDE.md, "Estado atual")

`src/sim/network.ts`, `src/sim/packets.ts`, `src/sim/jobs.ts`, `src/locale/jobs.ts`, `src/sim/heat.ts`,
os campos `util`/`omc` de `src/sim/wifi.ts` (e `cellLog`/`mastNear` em `network.ts`/`telco.ts`), o
tutorial `home["start-here.txt"]` de `src/locale/laptop.en.json`, e o manual `docs/manual-hacking.*`.
Esses são abertos só numa sessão da Trilha de hacking (Opus 4.8 ou agente `hacking`).
