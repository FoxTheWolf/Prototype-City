# 09: Plantas de lojas em texto

**Para:** ChatGPT (grátis) ou Gemini. **Volta em:** `docs/tarefas/retorno/09-plantas.json`.
**Usado em:** 13.10c (plantas por modelo, `src/sim/layouts.ts`). O Claude confere cada planta pelo teste `tests/plans.ts` (caixa alcançável da porta, nada sobre parede).

**Só tipos de um salão** (uma sala só, sem paredes internas). Cinema e estacionamento ficam com o Claude, porque precisam de salas separadas e peças novas.

--- COLE DAQUI ---

You are designing floor plans for small shops in a video game set in an American city around 2008. Each plan is drawn as text. Return **only JSON**, no commentary.

## The format

- One character = **half a metre**. The **first row is the back wall**, the **last row is the shop front** with the street door. The **last row must be all `.`** (kept clear for the door).
- Every row starts with `|` (fixed) or `*` (this row repeats to make a deeper shop; it may also be dropped in a small shop).
- The **first row is a header**: spaces, with `*` under the columns that repeat to make a wider shop. It starts with `|`.
- All rows of one plan have the **same length**. Plans are **10 to 16 characters wide** and **8 to 16 rows deep** (counting the header).
- `.` is empty floor. People must be able to walk from the front row to the front side of the till `T` (no blocking it in).
- Leave at least one `.` between furniture and the front row, and a walkway at least 2 characters wide.

## The pieces (use only these letters)

| Letter | Piece | Notes |
|---|---|---|
| `T` | till / cash register on a counter | **exactly one 2×2 block per plan** (`TT` over `TT`) |
| `C` | glass display case | rectangles, up to 4 long |
| `B` | bar counter | rectangles |
| `O` | oven / kitchen equipment | |
| `K` | fridge (cold drinks) | 2×2 blocks |
| `S` | shelf | rectangles, 1 wide, up to 10 long |
| `X` | whatever the shop displays (cases or shelves) | rectangles, up to 8 long |
| `L` | bottle shelf behind a bar | |
| `D` | desk | up to 3 long |
| `F` | sofa | |
| `P` | plant | single character |
| `t` | table | 2×2 or 2×1 |
| `h` | chair | single, next to a table or desk |
| `s` | stool | single, in front of a bar |
| `W` / `Y` | washer / dryer | 2×2 blocks |

## Example (a café)

```
|  *****    
|KK.........
|KK.........
|...........
|..CCCCCCTT.
|..CCCCCCTT.
|...........
*..htth.....
*...tt......
*...........
|...........
```

## What to make

Two or three plans for each of these kinds (a big one and a shallow/narrow one):

- `bank`: a bank branch hall: a long teller counter across the room (`B`, the till `T` at one end), a waiting area with a sofa `F` and plants `P`, one or two desks `D` with chairs `h` for the officers.
- `hotel`: the lobby: reception counter (`B` + `T`), sofas `F`, low tables `t`, plants `P`.
- `motel`: a small office: a short counter with the till, a chair, a cooler `K` (vending), a plant.
- `pharmacy`: shelves `S` in aisles, the till near the front, a case `C` at the back counter.
- `books`: shelves `S` along the walls and in rows, a table `t` with chairs, the till.
- `tailor`: a counter with the till, a desk `D` (sewing table), shelves `S` with cloth, a chair.
- `autoparts`: long shelves `S` in aisles, a counter `B` with the till.
- `pawn`, `electronics`, `phones`: cases `C` / displays `X` and the till.

Also **one extra variation** for each of: `diner`, `cafe`, `pizza`, `bar`, `grocery`, `laundry`, `cyber` (for `cyber`, use `D` for computer desks with a chair `h` each).

## Output

```json
[
  { "for": ["bank"], "rows": ["|  ****    ", "|...", "..."] },
  ...
]
```

Check each plan before answering: same length on every row, exactly one `TT/TT`, last row all `.`, only the letters above.
