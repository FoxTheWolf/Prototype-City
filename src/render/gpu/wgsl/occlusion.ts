export const occlusionWGSL = (): string => /* wgsl */ `// ---- (16.1c: the sky's occlusion by horizons, L.4/L.8, went for the rays of gi.ts) what light() reads of the cell
/** (16.1c) How far from the viewer the indirect light's rays are sent (m); past it, the open sky's light. */
const SKY_FAR = 700.0;
/** How far from the viewer the street objects' shadows are traced (m). */
const OBJ_SHADOW_FAR = 120.0;
/** This cell's sunlight after the shadows (sunLit), for finish. */
var<private> gSun: f32 = 1.0;
/** Whether the moon reaches this cell past the buildings (1) or not (0), for finish. */
var<private> gMoon: f32 = 1.0;
// what of the cell's color is light it gives off (a lit window, a sign, a lamp) and light it gets from the
// lamps (street lamps, floodlights, headlights), for the cell at depth gTag; set where the cell is made
var<private> gEm: vec3f = vec3f(0.0);
var<private> gIl: vec3f = vec3f(0.0);
var<private> gTag: f32 = -1.0;
// (16.1b) where in the world the cell at gTag is (for the one light function, light())
var<private> gPos: vec3f = vec3f(0.0);
// (16.1b, debug) what light() measured of the view's cell, shown by the probe view (DEBUG.lightProbe)
var<private> gDbg: vec3f = vec3f(0.0);
// (16.1b) the deferred light in the rooms: roomLit only notes what it was asked (the storey, the room, the point and how
// far along the ray inside), roomCell takes the note for the cell it makes (gRUse), and light() lights it once (roomE)
var<private> gRV: RView; var<private> gRO: u32 = 0u; var<private> gRR: i32 = 0; var<private> gRX: vec3f = vec3f(0.0);
var<private> gRPend: bool = false; var<private> gRUse: bool = false;
// (16.1b) the room surface's normal, set by what met it before roomLit takes the note (gRNs), kept in the note (gRN);
// zero: unknown (roomE guesses it from the plan)
var<private> gRNs: vec3f = vec3f(0.0); var<private> gRN: vec3f = vec3f(0.0);
// (whether the room surface is a piece of furniture, with its own normal in gNrm; else roomE takes it from the plan)
var<private> gRObj: bool = false;
// how strongly the finished cell glows onto its neighbors (0..1), written with it (the background's alpha)
var<private> gGlow: f32 = 0.0;
// how much of a cell's light blooms (a lit doorway or a floodlight's lamp less than a sign)
var<private> gGlowK: f32 = 1.0;
// how much brighter than drawn a cell's own light looks (the signs: lit to the eye, apart from the light they cast)
var<private> gEmK: f32 = 1.0;
// the material, the surface's normal (toward the viewer) and how wet it is, of the cell at gTag (R.23)
var<private> gMat: u32 = 0u;
var<private> gNrm: vec3f = vec3f(0.0, 0.0, 1.0);
var<private> gWet: f32 = 0.0;
// the hue of this cell's surface (its palette color, saturated, max channel 1), for the light and the paint's reflection
var<private> gTint: vec3f = vec3f(1.0);
// this cell's ray (unit, the way it travels)
var<private> gRay: vec3f = vec3f(1.0, 0.0, 0.0);
// where the rays through the city start (the eye; a mirror's spot for a reflection), and whether it is one
var<private> gOX: f32 = 0.0;
var<private> gOY: f32 = 0.0;
var<private> gOZ: f32 = 0.0;
var<private> gRefl: bool = false;
// (13.10b2) a room seen from the street through to a window on its far side: where the walk met that glass (gBack,
// roomWalk), and for the cell wallCell made, how far off the far glass is (gBackT, 0 none), where the near window is,
// and how much of the cell is the room (peekK); main sends a second ray on through it to the street behind
var<private> gBack: f32 = 0.0;
var<private> gBackT: f32 = 0.0;
var<private> gBackW: f32 = 0.0;
var<private> gBackK: f32 = 0.0;
// a lit piece of furniture (a screen, a lamp) met by peekRoom: its glow, so it blooms seen from the street as from inside
var<private> gPeekEm: vec3f = vec3f(0.0);
// (13.10d2) how far off what peekRoom met really is: the cell keeps the facade's depth, but the light in the hand
// falls on the room behind the glass or the doorway, as it does seen from inside
var<private> gPeekT: f32 = 0.0;
/** The viewer's stairwell (roomWalk): the walk left the storey through it (1 up, -1 down, 0 not), where, and the plan it went into. */
var<private> gWell: i32 = 0;
/** The viewer's stairwell (x0, y0, x1, y1; empty when none), the same on every storey; and whether the walk is a storey seen through it. */
var<private> gWR: vec4f = vec4f(0.0);
var<private> gThru: bool = false;
fn inWellRect(x: f32, y: f32) -> bool { return x > gWR.x && x < gWR.z && y > gWR.y && y < gWR.w; }
var<private> gWellT: f32 = 0.0;
var<private> gWellO: u32 = 0u;

`;
