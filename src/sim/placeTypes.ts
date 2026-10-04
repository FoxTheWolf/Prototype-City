import type { BusinessKind } from './city';

/**
 * What each kind of business is, in one table (Sessão E): opening hours, staff, the signs and gear it
 * tends to have, why citizens go there, and what it sells at what price (2008 dollars, in cents).
 * The Maps, the letreiros, the routines and (E.2+) the interiors and the till all read from here.
 * Based on the place catalog in docs/tarefas/retorno/01-tipos-de-lugar.json (`catalog` is its id).
 * The goods' names live in the locale (en.json "goods").
 */
export interface PlaceType {
  catalog: string;
  /** Opening hours (from, to; to past 24 for after midnight; 0-24 always open). */
  hours: [number, number];
  /** Staff it needs, all shifts together. */
  staff: number;
  /** Chance it hangs a blade sign next to its shop sign. */
  blade?: number;
  /** Chance it has a Wi-Fi router, and the share of those left open. */
  wifi?: [number, number];
  /** Chance of a security camera over its door. */
  cctv?: number;
  /** Why citizens come in: a night out, an errand, a stroll. */
  visit?: ('out' | 'errand' | 'stroll')[];
  /** Ordered at the counter (food, services) instead of taken from the shelves. */
  order?: boolean;
  /** Chance a shop front that draws this kind keeps it (few cybercafés, few motels); 1 if left out. */
  rare?: number;
  /** What it sells: [good, price in cents]. */
  sells: [string, number][];
}

export const PLACES: Record<BusinessKind, PlaceType> = {
  diner: { catalog: 'classic_diner', hours: [6, 23], staff: 7, blade: 0.4, wifi: [0.3, 0.6], visit: ['out', 'errand'], order: true,
    sells: [['coffee', 125], ['eggs_toast', 399], ['burger', 650], ['fries', 250], ['milkshake', 375], ['pie', 325], ['meatloaf', 895]] },
  cafe: { catalog: 'indie_coffee_shop', hours: [6, 20], staff: 4, blade: 0.4, wifi: [0.9, 0.85], visit: ['out', 'errand', 'stroll'], order: true,
    sells: [['drip_coffee', 150], ['espresso', 175], ['latte', 325], ['muffin', 225], ['bagel', 195]] },
  pizza: { catalog: 'slice_pizzeria', hours: [11, 26], staff: 4, blade: 0.5, wifi: [0.15, 0.5], visit: ['out'], order: true,
    sells: [['slice', 225], ['pepperoni_slice', 275], ['garlic_knots', 300], ['fountain_soda', 150], ['whole_pie', 1400]] },
  deli: { catalog: 'corner_deli', hours: [5, 18], staff: 3, wifi: [0.1, 0.5], visit: ['errand'], order: true,
    sells: [['pastrami', 795], ['bagel_cc', 250], ['coffee', 100], ['chips', 100], ['soda_can', 100]] },
  fastfood: { catalog: 'fast_food_burger', hours: [6, 24], staff: 8, blade: 0.3, wifi: [0.4, 0.9], visit: ['out', 'errand'], order: true,
    sells: [['combo', 549], ['cheeseburger', 99], ['nuggets', 349], ['fries', 179], ['large_soda', 159]] },
  bar: { catalog: 'dive_bar', hours: [16, 26], staff: 5, blade: 0.6, wifi: [0.4, 0.5], visit: ['out'], order: true,
    sells: [['draft_beer', 400], ['bottled_beer', 450], ['whiskey', 600], ['peanuts', 200], ['fountain_soda', 200]] },
  grocery: { catalog: 'bodega_corner_store', hours: [7, 23], staff: 8, cctv: 0.15, visit: ['errand', 'stroll'],
    sells: [['bread', 299], ['milk', 389], ['eggs', 249], ['canned_soup', 159], ['noodles', 49], ['candy', 89], ['chips', 129], ['soda_can', 100], ['cigarettes', 595], ['batteries', 499], ['umbrella', 899]] },
  pharmacy: { catalog: 'chain_pharmacy', hours: [8, 22], staff: 6, blade: 0.3, cctv: 0.3, visit: ['errand'],
    sells: [['cough_syrup', 699], ['painkillers', 599], ['bandages', 399], ['shampoo', 449], ['toothpaste', 299], ['memory_card', 2999], ['batteries', 599], ['umbrella', 999], ['candy', 99]] },
  laundry: { catalog: 'coin_laundromat', hours: [7, 21], staff: 3, visit: ['errand'], order: true,
    sells: [['wash_load', 175], ['dry_load', 150], ['detergent', 125], ['soda_can', 100]] },
  pawn: { catalog: 'local_pawn_shop', hours: [10, 19], staff: 2, blade: 0.6, cctv: 0.5, visit: ['errand', 'stroll'],
    sells: [['used_watch', 4500], ['dvd_player', 3500], ['power_drill', 4000], ['guitar', 12000], ['gold_chain', 15000]] },
  electronics: { catalog: 'consumer_electronics_store', hours: [10, 20], staff: 5, wifi: [0.6, 0.2], cctv: 0.35, visit: ['errand', 'stroll'],
    sells: [['headphones', 1999], ['usb_stick', 2499], ['charger', 1999], ['batteries', 599], ['blank_cds', 899], ['ethernet_cable', 1299], ['mp3_player', 7999]] },
  phones: { catalog: 'mobile_phone_shop', hours: [10, 20], staff: 3, blade: 0.3, wifi: [0.3, 0.2], cctv: 0.3, visit: ['errand', 'stroll'],
    sells: [['prepaid_card', 2000], ['charger', 1999], ['hands_free', 2999], ['phone_case', 1499]] },
  cyber: { catalog: 'cybercafe', hours: [8, 26], staff: 2, rare: 0.1, blade: 0.6, wifi: [1, 0.15], visit: ['out', 'errand'], order: true,
    sells: [['internet_hour', 300], ['print_page', 15], ['soda_can', 125], ['chips', 125]] },
  motel: { catalog: 'budget_motel', hours: [0, 24], staff: 4, rare: 0.4, blade: 1, wifi: [0.3, 0.6], cctv: 0.3, order: true,
    sells: [['room_night', 4900], ['vending_snack', 125]] },
  bank: { catalog: 'bank_branch', hours: [9, 17], staff: 12, cctv: 0.9, visit: ['errand'], sells: [] },
  // Not in the first pass of interiors (Sessão E): only what they already had.
  liquor: { catalog: '', hours: [10, 23], staff: 3, blade: 0.4, cctv: 0.4, visit: ['errand'], sells: [] },
  hotel: { catalog: '', hours: [0, 24], staff: 20, blade: 1, wifi: [0.8, 0.1], cctv: 0.3, sells: [] },
  cinema: { catalog: 'indie_cinema', hours: [12, 24], staff: 9, blade: 1, cctv: 0.15, visit: ['out', 'stroll'], sells: [] },
  books: { catalog: 'used_bookstore', hours: [10, 21], staff: 3, wifi: [0.5, 0.7], visit: ['errand', 'stroll'], sells: [] },
  tailor: { catalog: '', hours: [9, 18], staff: 2, visit: ['errand', 'stroll'], sells: [] },
  autoparts: { catalog: 'auto_mechanic_garage', hours: [8, 19], staff: 5, sells: [] },
  parking: { catalog: '', hours: [0, 24], staff: 4, blade: 1, cctv: 0.3, sells: [] },
};

/** Kinds whose people come in for a reason (`visit`). */
export const visitKinds = (why: 'out' | 'errand' | 'stroll') =>
  new Set((Object.keys(PLACES) as BusinessKind[]).filter((k) => PLACES[k].visit?.includes(why)));
