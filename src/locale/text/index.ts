import { type Grammar } from '../gen';
import WORDS from './words.en.json';
import WORDS2 from './words-more.en.json';
import MEMES from './memes.en.json';
import SMS from './sms.en.json';
import NEWS from './news.en.json';
import NEWS8 from './news2008.en.json';
import CAL from './calendar.en.json';
import COMMENTS from './comments.en.json';
import PROFILES from './profiles.en.json';
import SHAPES from './posts/shapes.en.json';
import HAPPY from './posts/mood-happy.en.json';
import CALM from './posts/mood-calm.en.json';
import LOW from './posts/mood-low.en.json';
import PLAYFUL from './posts/mood-playful.en.json';
import HOME from './posts/topic-home.en.json';
import WORK from './posts/topic-work.en.json';
import STREET from './posts/topic-street.en.json';
import SKY from './posts/topic-sky.en.json';
import EVENTS from './posts/topic-events.en.json';
import PROMO from './promo.en.json';
import ARTICLES from './articles.en.json';
import DIRECTIONS from './directions.en.json';
import REPLIES from './replies.en.json';
import BARKS from './barks.en.json';
import WEB from './web.en.json';
import MAIL from './mail.en.json';

/**
 * Every grammar file of the city's texts, in one: lists of the same name in several files are put
 * together, so more pieces for a list can go in a file of their own.
 */
export function merge(...files: Grammar[]): Grammar {
  const G: Grammar = {};
  for (const f of files) for (const [k, v] of Object.entries(f)) G[k] = G[k] ? [...G[k], ...v] : [...v];
  return G;
}

export const TEXT: Grammar = merge(
  WORDS as Grammar, WORDS2 as Grammar, MEMES as Grammar, SMS as Grammar, NEWS as Grammar, NEWS8 as Grammar, CAL as Grammar, COMMENTS as Grammar, PROFILES as Grammar, SHAPES as Grammar,
  HAPPY as Grammar, CALM as Grammar, LOW as Grammar, PLAYFUL as Grammar,
  HOME as Grammar, WORK as Grammar, STREET as Grammar, SKY as Grammar, EVENTS as Grammar, PROMO as Grammar, ARTICLES as Grammar, DIRECTIONS as Grammar, REPLIES as Grammar, BARKS as Grammar, WEB as Grammar, MAIL as Grammar,
);
