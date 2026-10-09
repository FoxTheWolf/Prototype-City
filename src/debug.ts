/**
 * Debug conveniences for this development stage, grouped in one place so they are easy to find and to
 * strip before a release. Each flag is a TEST shortcut, not game behaviour — turning them all off is
 * the shipping state. (The user's rule, 2026-10-06: keep debug aids visible and removable, not scattered.)
 * This module imports nothing (plain constants), so sim/ may import it without breaking the layering.
 */
export const DEBUG = {
  /** An open Wi-Fi network right at the player's spawn, so going online can be tested without first
   *  cracking a network. [HACKING]-adjacent (eases testing the net), but harmless on its own. */
  spawnOpenAp: true,
  /** List the clandestine tools (bruter, the WEP cracker) in apt too, so they can be fetched for
   *  testing before the forum delivers them (15.8c). The real source will be the forum. [HACKING] */
  aptClandestine: true,
  /** Show a locked network's key on the phone's Wi-Fi screen (the old crutch). OFF: a WEP key now
   *  comes from cracking it on the notebook; WPA from the world; open nets need none. [HACKING] */
  showWifiKey: false,
  /** (15.9e) Reynard, the encrypted messenger, installed and registered with a test chat. The real way in
   *  is the jailbreak at the end of the mentor's tutorial (stage 19). */
  reynard: true,
  /** (2026-10-06) Headphones in the bag on a new game, to test the music without buying them. */
  earphones: true,
  /** (2026-10-06) Turning the view with the keyboard (Q/E, the arrows): taken off for players, the keys are
   *  worth more for other things; true brings it back for tests without a mouse. */
  keyTurn: false,
  /** (15.16) A test pattern on the notebook screen's pixel layer: its edge, a grid, the diagonals, a circle
   *  and color bars, to judge the screen faced, from aside and up close. */
  screenTest: false,
  /** (15.17h) The canonical sites in the Ferret's bookmarks (Streetwire, GridLink, the Switchboard), marked '(dbg)',
   *  so they are a click away while testing; the real game comes with only Lookwise, the mail and the portal. */
  webMarks: true,
  /** (15.22) The Jackdaw Mini in the pocket (G takes it out), to test it before stage 19 gives it in the game. */
  jackdaw: true,
  /** (2026-10-08) Every door opens (homes, offices, shops after hours), to visit all kinds of rooms in a test.
   *  Turned on by `unlock` on a test launcher (teste-*.bat), never by default. */
  unlockDoors: false,
  /** (16.1b) The deferred light: one light function for every surface (the lamps' light out of the cells' colors, the albedo
   *  without the faked face shading, the haze in the sky's own color). F7 flips it in the game, to compare with the old. */
  deferredLight: false,
  /** (16.1b) With it, the surfaces' kinds in flat colors (Shift+F7), to tell what a cell is. */
  lightKinds: false,
  /** (16.1b) The light function's factors of each cell as a color (the sky by the face, the sky seen, the sun), set from the console. */
  lightProbe: false,
};
