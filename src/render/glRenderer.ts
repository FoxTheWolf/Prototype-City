import { ATLAS_COLS, buildAtlas } from './atlas';
import { type CharGrid } from './grid';
import { HD, type HdLayer } from './hd';

const VS = `#version 300 es
void main() {
  // one triangle covering the whole screen
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Every pixel finds its cell in two grids: the world's (its rows set by the resolution) and the
// interface's over it (always the same size: the phone, the notebook, the status lines). Each reads
// glyph + colors from its grid textures and copies the matching texel of its own atlas. Where the
// interface drew nothing, the world shows; where it drew a glyph only, the glyph lies over the world.
// Between them lies the HD layer (hd.ts): plain pixels, HD per cell of the interface each way, some
// under the interface (seen where it drew nothing), some over it (a photo on the phone's screen).
// The whole screen is one draw call.
const FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uCells, uBg, uAtlas, uUiCells, uUiBg, uUiAtlas, uHd;
uniform ivec2 uCell, uOrigin, uGrid, uUiCell, uUiOrigin, uUiGrid;
uniform float uHeight;
out vec4 outColor;
vec3 layer(sampler2D cells, sampler2D atlas, ivec2 p, ivec2 c, ivec2 size, vec3 bg) {
  vec4 cell = texelFetch(cells, c, 0);
  int glyph = int(cell.r * 255.0 + 0.5);
  ivec2 a = ivec2(glyph % ${ATLAS_COLS}, glyph / ${ATLAS_COLS}) * size + (p - c * size);
  return mix(bg, cell.gba, texelFetch(atlas, a, 0).r);
}
void main() {
  ivec2 s = ivec2(int(gl_FragCoord.x), int(uHeight - gl_FragCoord.y));
  vec3 col = vec3(0.0);
  ivec2 p = s - uOrigin, c = p / uCell;
  if (p.x >= 0 && p.y >= 0 && c.x < uGrid.x && c.y < uGrid.y) col = layer(uCells, uAtlas, p, c, uCell, texelFetch(uBg, c, 0).rgb);
  ivec2 q = s - uUiOrigin, u = q / uUiCell;
  if (q.x >= 0 && q.y >= 0 && u.x < uUiGrid.x && u.y < uUiGrid.y) {
    vec4 hp = texelFetch(uHd, (q * ${HD}) / uUiCell, 0);
    if (hp.a > 0.25 && hp.a < 0.75) col = hp.rgb;
    vec4 ub = texelFetch(uUiBg, u, 0);
    if (ub.a > 0.25) col = layer(uUiCells, uUiAtlas, q, u, uUiCell, ub.a > 0.75 ? ub.rgb : col);
    if (hp.a > 0.75) col = hp.rgb;
  }
  outColor = vec4(col, 1.0);
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

const UNIFORMS = ['uCells', 'uBg', 'uAtlas', 'uUiCells', 'uUiBg', 'uUiAtlas', 'uHd', 'uCell', 'uOrigin', 'uGrid', 'uUiCell', 'uUiOrigin', 'uUiGrid', 'uHeight'];

export class GlyphRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  /** The world's cells, background and atlas, then the interface's. */
  private tex: WebGLTexture[];
  private u: Record<string, WebGLUniformLocation | null> = {};
  private layout: Layout | null = null;
  private ui: Layout | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    this.prog = link(gl, VS, FS);
    gl.useProgram(this.prog);
    for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(this.prog, n);
    ['uCells', 'uBg', 'uAtlas', 'uUiCells', 'uUiBg', 'uUiAtlas', 'uHd'].forEach((n, k) => gl.uniform1i(this.u[n], k));
    this.tex = [0, 1, 2, 3, 4, 5, 6].map(() => texture(gl));
    gl.bindVertexArray(gl.createVertexArray());
  }

  /** Recreate the atlases and grid textures for new layouts: the world's and the interface's. */
  setLayout(l: Layout, ui: Layout) {
    const gl = this.gl;
    this.layout = l; this.ui = ui;
    gl.useProgram(this.prog);
    gl.uniform1f(this.u.uHeight, this.canvas.height);
    ([[l, 0, ''], [ui, 3, 'Ui']] as const).forEach(([L, t, n]) => {
      gl.uniform2i(this.u[`u${n}Cell`], L.cellW, L.cellH);
      gl.uniform2i(this.u[`u${n}Origin`], L.originX, L.originY);
      gl.uniform2i(this.u[`u${n}Grid`], L.cols, L.rows);
      for (const k of [t, t + 1]) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex[k]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, L.cols, L.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.tex[t + 2]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas(L.cellW, L.cellH));
    });
    gl.bindTexture(gl.TEXTURE_2D, this.tex[6]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ui.cols * HD, ui.rows * HD, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(grid: CharGrid, ui: CharGrid, hd: HdLayer) {
    const gl = this.gl;
    ([[grid, this.layout!, 0], [ui, this.ui!, 3]] as const).forEach(([G, L, t]) => {
      gl.activeTexture(gl.TEXTURE0 + t);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[t]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, L.cols, L.rows, gl.RGBA, gl.UNSIGNED_BYTE, G.cells);
      gl.activeTexture(gl.TEXTURE0 + t + 1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[t + 1]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, L.cols, L.rows, gl.RGBA, gl.UNSIGNED_BYTE, G.bg);
      gl.activeTexture(gl.TEXTURE0 + t + 2);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[t + 2]);
    });
    // the HD layer: only the rows drawn or cleared since the last upload
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[6]);
    hd.mark();
    if (hd.hi >= hd.lo) {
      const y0 = Math.max(0, hd.lo), y1 = Math.min(hd.h - 1, hd.hi);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, hd.w, y1 - y0 + 1, gl.RGBA, gl.UNSIGNED_BYTE, hd.px.subarray(y0 * hd.w * 4, (y1 + 1) * hd.w * 4));
      hd.lo = Infinity; hd.hi = -1;
    }
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
