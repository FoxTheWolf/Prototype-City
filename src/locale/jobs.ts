// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): o contratante que encomenda um apagao aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { type World } from '../sim/world';
import { businessName, districtName } from './names';
import { districtAt } from '../sim/city';
import { formatNumber } from '../sim/telco';
import { type Job } from '../sim/jobs';

/**
 * The fixer's texts, written from a job's facts (the sim holds the job, locale writes the words).
 * The words are the only channel-specific part; the same facts feed e-mail (stage 12) and a call
 * with dialogue (stage 13c) later. Terse and neutral: the noir is in the situation, not the words.
 */
export type JobSms = 'offer' | 'confirm' | 'declined' | 'paid' | 'failed' | 'wrong';

const money = (c: number) => '$' + Math.round(c / 100);
const clock = (t: number) => { const h = Math.floor(t / 3600) % 24, ap = h < 12 ? 'am' : 'pm'; return `${((h + 11) % 12) + 1}${ap}`; };

export function jobSms(world: World, j: Job, kind: JobSms): string {
  if (j.kind === 'trace') {
    // the subject is named only by their line; the player reaches the operator's log and reports the
    // district it puts the line in at the hour asked (no business, so none of the biz lookups below)
    const num = formatNumber(world.telco, j.num ?? '');
    switch (kind) {
      case 'offer': return `One more, and it pays well. I need to know where a certain line was earlier today. The number is ${num}. Pull the operator's location log and tell me which district it was in around ${clock(j.at ?? 0)}. ${money(j.pay)}. Reply YES or NO.`;
      case 'confirm': return `Good. The line is ${num}. Get onto the operator's records, read its cell log for around ${clock(j.at ?? 0)}, and text me back the district name. Before ${clock(j.due)}.`;
      case 'declined': return `Suit yourself.`;
      case 'wrong': return `That's not what the log shows. Pull it again and read the hour I asked for -- around ${clock(j.at ?? 0)}.`;
      case 'paid': return `That checks out. ${money(j.pay)} is in your account now. We'll talk.`;
      case 'failed': return `Never got a straight answer on that line by ${clock(j.due)}. No pay. Don't waste my time again.`;
    }
  }
  const B = world.city.businesses[j.biz], bld = world.city.buildings[B.building];
  const name = businessName(world.city, j.biz);
  const where = districtName(world.city, districtAt(world.city, (bld.x0 + bld.x1) / 2, (bld.y0 + bld.y1) / 2));
  if (j.kind === 'signals') {
    // the crossing is named by the business it sits by: the player finds that on the map and goes there
    switch (kind) {
      case 'offer': return `Another one, if you're up for it. The crossing by ${name} in ${where} -- I want it snarled before ${clock(j.due)}. Kill the lights or set them flashing, your call. ${money(j.pay)}. Reply YES or NO.`;
      case 'confirm': return `Good. Get to the crossing by ${name} and jam the signals before ${clock(j.due)}. Flashing or dark, either works. Don't hang around after.`;
      case 'declined': return `Suit yourself.`;
      case 'paid': return `Word is that crossing is a mess. ${money(j.pay)} is in your account now. We'll talk.`;
      case 'failed': return `The lights by ${name} were still running at ${clock(j.due)}. No pay. Don't waste my time again.`;
    }
  }
  switch (kind) {
    case 'offer': return `Work, if you want it. I need ${name} in ${where} to lose power tonight, before ${clock(j.due)}. ${money(j.pay)} when it's done. Reply YES to take it, NO to pass.`;
    case 'confirm': return `Good. Cut the power to ${name} before ${clock(j.due)}. You'll know when it works. Don't linger.`;
    case 'declined': return `Suit yourself.`;
    case 'paid': return `${name} went dark. ${money(j.pay)} is in your account now. We'll be in touch.`;
    case 'failed': return `${name} still had its lights at ${clock(j.due)}. No pay. Don't waste my time again.`;
    default: return `Suit yourself.`; // 'wrong' never reaches here (trace handled above); keeps the return total
  }
}
