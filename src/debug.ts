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
};
