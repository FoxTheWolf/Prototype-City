import { ATLAS_COLS, buildAtlas } from './atlas';
import { type CharGrid } from './grid';

const VS = `#version 300 es
void main() {
  // one triangle covering the whole screen
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Every pixel finds its cell, reads glyph + colors from the grid textures and copies
// the matching atlas texel. The whole screen is one draw call.
const FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uCells;
uniform sampler2D uBg;
uniform sampler2D uAtlas;
uniform ivec2 uCell;
uniform ivec2 uOrigin;
uniform ivec2 uGrid;
uniform float uHeight;
uniform int uGrade;
out vec4 outColor;
// Color grading for the palettes (see palette.ts): 0 leaves colors as drawn.
vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  if (uGrade == 1) {
    // neon noir: grey-blue streets; saturated lights survive, warm hues turned toward magenta
    float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    vec3 cold = l * vec3(0.72, 0.88, 1.3);
    vec3 neon = c.r > c.b ? c.rbg * 1.15 : c * vec3(0.8, 1.1, 1.2);
    return mix(cold, neon, smoothstep(0.12, 0.45, s));
  }
  if (uGrade == 2) {
    // green phosphor: brightness only, lifted a little so dim glyphs still read
    float k = pow(l, 0.8);
    return vec3(0.3, 1.1, 0.45) * k;
  }
  return c;
}
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), int(uHeight - gl_FragCoord.y)) - uOrigin;
  ivec2 c = p / uCell;
  if (p.x < 0 || p.y < 0 || c.x >= uGrid.x || c.y >= uGrid.y) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec4 cell = texelFetch(uCells, c, 0);
  vec3 bg = texelFetch(uBg, c, 0).rgb;
  int glyph = int(cell.r * 255.0 + 0.5);
  ivec2 a = ivec2(glyph % ${ATLAS_COLS}, glyph / ${ATLAS_COLS}) * uCell + (p - c * uCell);
  float cov = texelFetch(uAtlas, a, 0).r;
  outColor = vec4(grade(mix(bg, cell.gba, cov)), 1.0);
}`;

export interface Layout {
  cols: number;
  rows: number;
  /** Cell size in device pixels (integers, so glyphs map 1:1). */
  cellW: number;
  cellH: number;
  originX: number;
  originY: number;
}

export class GlyphRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private cellsTex: WebGLTexture;
  private bgTex: WebGLTexture;
  private atlasTex: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private layout: Layout | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    this.prog = link(gl, VS, FS);
    gl.useProgram(this.prog);
    for (const n of ['uCells', 'uBg', 'uAtlas', 'uCell', 'uOrigin', 'uGrid', 'uHeight', 'uGrade']) this.u[n] = gl.getUniformLocation(this.prog, n);
    gl.uniform1i(this.u.uCells, 0);
    gl.uniform1i(this.u.uBg, 1);
    gl.uniform1i(this.u.uAtlas, 2);
    this.cellsTex = texture(gl);
    this.bgTex = texture(gl);
    this.atlasTex = texture(gl);
    gl.bindVertexArray(gl.createVertexArray());
  }

  /** Recreate the atlas and grid textures for a new layout. */
  setLayout(l: Layout) {
    const gl = this.gl;
    this.layout = l;
    gl.useProgram(this.prog);
    gl.uniform2i(this.u.uCell, l.cellW, l.cellH);
    gl.uniform2i(this.u.uOrigin, l.originX, l.originY);
    gl.uniform2i(this.u.uGrid, l.cols, l.rows);
    gl.uniform1f(this.u.uHeight, this.canvas.height);
    for (const t of [this.cellsTex, this.bgTex]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, l.cols, l.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas(l.cellW, l.cellH));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(grid: CharGrid, grade: number) {
    const gl = this.gl, l = this.layout!;
    gl.uniform1i(this.u.uGrade, grade);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cellsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, l.cols, l.rows, gl.RGBA, gl.UNSIGNED_BYTE, grid.cells);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, l.cols, l.rows, gl.RGBA, gl.UNSIGNED_BYTE, grid.bg);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function texture(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}
