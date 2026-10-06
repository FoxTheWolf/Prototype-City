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

## `src/laptop/shell.ts` — faixas (conferidas em 2026-10-06, ~1489 linhas; +QoL Bloco 1/2/3-readline e +tdump vigília)

> Números pós-readline (Bloco 3): `sniffStep` ~359, `finishSniff` ~375, `tdumpMon` ~384, `remote` ~849 (`cellLog` ~898); switch: `job` ~1070, `mmap` ~1225, `bruter` ~1243, `wcrack` ~1261, `tdump` ~1281, `tnet` ~1312, `mbus` ~1326. (A lista detalhada abaixo é da f3; ancore pelos nomes.)

**SENSÍVEIS (`[HACKING]`, não abrir numa sessão normal):**
- **linha ~16** — `import ... from '../sim/network'` (`lanHosts`, `modbusRegs`, `setBreaker`, `setSignals`, `cellLog`, `WORDS`).
- **~59–68** — `HACK_TOOLS` (bruter, wcrack) e `WEP_IVS`; a instalação no `/bin` do jogador fica em ~182.
- **~62–85** (helpers do WEP) — `wepIvRate`, `parseCapture` (puros, exportados; é o que os testes importam).
- **~241, ~243, ~246** — os campos `private conn` (console remoto), `private cap` (captura de IVs) e `private sniff` (vigília de pacotes do tdump sem -c). (O campo público `menu`, logo antes, é da QoL e é NEUTRO.)
- **~323 (dentro de `interrupt`)** — as linhas que, no Ctrl+C, chamam `finishCapture()` / `finishSniff()`.
- **~336–381** — `capStep` / `finishCapture` / `sniffStep` (~359) / `finishSniff` (~375) (os passos do modo monitor do WEP e da vigília de pacotes).
- **~384** — `private tdumpMon` (o modo monitor do WEP).
- **~834, ~883** — o método `private remote(...)` (o console remoto; inclui o host `omc` da operadora e o `log <número>` que lê `cellLog` em ~883).
- **no `exec()` switch, os `case`:** `job` (~1055), `mmap` (~1210), `bruter` (~1228), `wcrack` (~1246), `tdump` (~1266, inclui o ramo `mon` → `tdumpMon` e a vigília contínua sem -c → `sniffStep`), `tnet` (~1297), `mbus` (~1311).

> **NEUTRO (QoL Bloco 2):** o campo `menu` (~210), `pickMenu()` (logo após `complete()`) e os blocos do drop-up no `termKey` e no `complete()` são render/parse comuns (sem rede/hosts); seguros numa sessão normal.

> **NEUTRO acrescentado em 2026-10-06 (QoL Bloco 1):** `cmdNames`, `isNet`, `hiTokens`, `ghost` ficam logo **depois** de `complete()` e **antes** do `[HACKING] argTemplate` (~620 agora). São render/parse comuns (não abrem rede nem hosts); seguros numa sessão normal. O aceite do ghost com →/End está em `termKey` (`ArrowRight`/`End`), também neutro.

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
