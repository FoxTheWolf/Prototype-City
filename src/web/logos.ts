import { dark, lite, Paint, type C3 } from '../render/paint2d';

/**
 * A site's banner picture in pixels (the user's rule, 2026-10-07: no ASCII pictures on a 2008 web page;
 * the sites then had a GIF there): a glossy badge in the banner's colors with a pictogram of what the
 * place is (a cup, a slice, a bank's columns...), or the portal's globe, Streetwire's bubble, the
 * Switchboard's jacks. `s`: the badge's side in pixels, its top-left at (x, y).
 */
export function paintLogo(P: Paint, kind: string, x: number, y: number, s: number, fg: C3, bg: C3) {
  const cx = x + s / 2, cy = y + s / 2, u = s / 16, ink = dark(bg, 0.25);
  // the badge: a rounded square a little lighter than the banner, with the shine on its top half
  P.rrect(x, y, s, s, s * 0.2, dark(bg, 0.35));
  P.grad(x + 1, y + 1, s - 2, s - 2, [[0, lite(bg, 0.35)], [1, lite(bg, 0.08)]], true, s * 0.2 - 1);
  P.rrect(x + 2, y + 2, s - 4, s * 0.42, s * 0.16, [255, 255, 255], 0.18);
  const R = (a: number, b: number, w: number, h: number, c = fg) => P.rect(x + a * u, y + b * u, w * u, h * u, c);
  const D = (a: number, b: number, r: number, c = fg) => P.disc(x + a * u, y + b * u, r * u, c);
  const L = (a: number, b: number, c2: number, d: number, w: number, c = fg) => P.line(x + a * u, y + b * u, x + c2 * u, y + d * u, w * u, c);
  const G = (pts: number[], c = fg) => P.poly(pts.map((v, i) => (i % 2 ? y : x) + v * u), c);
  switch (kind) {
    case 'portal': // a globe: the ring, the meridian, the parallels
      D(8, 8, 5.5); D(8, 8, 4.4, bg); P.disc(cx, cy, 2 * u, fg, 1, 4.4 * u); P.disc(cx, cy, 1.1 * u, bg, 1, 4.4 * u); R(3, 7.5, 10, 1); R(4, 5, 8, 0.8); R(4, 10.2, 8, 0.8); break;
    case 'wire': // a speech bubble with the signal's waves
      P.rrect(x + 2.5 * u, y + 4 * u, 9 * u, 6.5 * u, 2 * u, fg); G([5, 10, 4.5, 13, 8, 10]); P.ring(x + 11.5 * u, y + 4 * u, 2 * u, 0.9 * u, fg); P.ring(x + 11.5 * u, y + 4 * u, 3.6 * u, 0.9 * u, fg); D(7, 7.2, 0.9, bg); D(5, 7.2, 0.9, bg); D(9, 7.2, 0.9, bg); break;
    case 'board': // a switchboard's jacks, a cord plugged in
      for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { D(4.5 + i * 3.5, 5 + j * 4, 1.3); D(4.5 + i * 3.5, 5 + j * 4, 0.6, ink); }
      L(8, 9, 8, 13.5, 1.1); L(8, 13.5, 13, 12, 1.1); break;
    case 'cafe': case 'diner': // a cup with its steam
      P.rrect(x + 3.5 * u, y + 7 * u, 7 * u, 6 * u, 1.5 * u, fg); P.ring(x + 11 * u, y + 9.5 * u, 1.8 * u, 0.9 * u, fg); R(3, 13.5, 9, 0.8);
      L(5.5, 6, 6.5, 3.5, 0.8); L(8.5, 6, 9.5, 3.5, 0.8); break;
    case 'pizza': // a slice: the crust, the cheese, the pepperoni
      G([3, 4, 13, 4, 8, 14]); R(3, 3, 10, 1.6, dark(fg, 0.15)); D(6.5, 6.5, 1, ink); D(9.5, 7, 1, ink); D(8, 10, 0.9, ink); break;
    case 'fastfood': case 'deli': // a burger
      P.rrect(x + 3 * u, y + 4 * u, 10 * u, 3.5 * u, 1.7 * u, fg); R(3, 8.2, 10, 1.4); R(2.5, 10, 11, 1.2); P.rrect(x + 3 * u, y + 11.5 * u, 10 * u, 2 * u, 0.8 * u, fg); break;
    case 'bar': case 'liquor': // a cocktail glass
      G([3, 4, 13, 4, 8, 9.5]); R(7.4, 9, 1.2, 4); R(5, 13, 6, 1); D(11, 4, 1.4, dark(fg, 0.2)); break;
    case 'bank': // a pediment over columns
      G([2.5, 6, 8, 2.5, 13.5, 6]); for (let i = 0; i < 4; i++) R(3.5 + i * 2.6, 7, 1.4, 5); R(2.5, 12.5, 11, 1.5); break;
    case 'phones': // a mobile with its screen and keys
      P.rrect(x + 5 * u, y + 2.5 * u, 6 * u, 11 * u, 1.2 * u, fg); R(6, 4, 4, 3.5, ink); for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) R(6 + i * 1.5, 9 + j * 1.6, 0.9, 0.9, ink); break;
    case 'electronics': // a television on its feet
      P.rrect(x + 2.5 * u, y + 3.5 * u, 11 * u, 8 * u, 1.2 * u, fg); R(3.8, 4.8, 8.4, 5.4, ink); L(5, 13.5, 6.5, 11.5, 0.9); L(11, 13.5, 9.5, 11.5, 0.9); break;
    case 'cyber': // a monitor, the prompt's cursor
      P.rrect(x + 2.5 * u, y + 3 * u, 11 * u, 7.5 * u, 1 * u, fg); R(3.6, 4.1, 8.8, 5.3, ink); R(4.6, 7.4, 2.2, 0.9, fg); R(7, 11, 2, 1.5); R(4.5, 12.5, 7, 1); break;
    case 'hotel': case 'motel': // a bed
      R(2.5, 8.5, 11, 2.5); R(2.5, 5, 1.4, 8); R(12.1, 7.5, 1.4, 5.5); P.rrect(x + 4.2 * u, y + 6.5 * u, 3 * u, 2 * u, 0.8 * u, fg); break;
    case 'books': // an open book
      G([2.5, 5, 7.6, 6, 7.6, 13, 2.5, 12]); G([13.5, 5, 8.4, 6, 8.4, 13, 13.5, 12]); break;
    case 'pharmacy': // the cross
      R(6.3, 3, 3.4, 10); R(3, 6.3, 10, 3.4); break;
    case 'cinema': // a film reel
      D(8, 8, 5.5); for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5 - Math.PI / 2; D(8 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, 1.2, bg); } D(8, 8, 0.8, bg); break;
    case 'autoparts': case 'parking': // a wheel
      D(8, 8, 5.5); D(8, 8, 3, bg); D(8, 8, 1.6); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; L(8, 8, 8 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, 0.7); } break;
    case 'laundry': // a washing machine
      P.rrect(x + 3.5 * u, y + 2.5 * u, 9 * u, 11 * u, 1 * u, fg); D(8, 9, 3, ink); D(8, 9, 2.2, lite(bg, 0.3)); R(4.5, 3.5, 2, 1, ink); break;
    default: // a shop front: the striped awning, the window, the door
      for (let i = 0; i < 5; i++) R(2.5 + i * 2.2, 3.5, 2.2, 3, i % 2 ? lite(fg, 0.0) : dark(fg, 0.3));
      R(3, 6.5, 10, 7); R(4, 8, 4.5, 3.5, ink); R(9.5, 8, 2.5, 5.5, ink);
  }
}
