// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): o contratante que encomenda um apagao aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { type World } from '../sim/world';
import { businessName, districtName } from './names';
import { districtAt } from '../sim/city';
import { type Job } from '../sim/jobs';

/**
 * The fixer's texts, written from a job's facts (the sim holds the job, locale writes the words).
 * The words are the only channel-specific part; the same facts feed e-mail (stage 12) and a call
 * with dialogue (stage 13c) later. Terse and neutral: the noir is in the situation, not the words.
 */
export type JobSms = 'offer' | 'confirm' | 'declined' | 'paid' | 'failed';

const money = (c: number) => '$' + Math.round(c / 100);
const clock = (t: number) => { const h = Math.floor(t / 3600) % 24, ap = h < 12 ? 'am' : 'pm'; return `${((h + 11) % 12) + 1}${ap}`; };

export function jobSms(world: World, j: Job, kind: JobSms): string {
  const B = world.city.businesses[j.biz], bld = world.city.buildings[B.building];
  const name = businessName(world.city, j.biz);
  const where = districtName(world.city, districtAt(world.city, (bld.x0 + bld.x1) / 2, (bld.y0 + bld.y1) / 2));
  switch (kind) {
    case 'offer': return `Work, if you want it. I need ${name} in ${where} to lose power tonight, before ${clock(j.due)}. ${money(j.pay)} when it's done. Reply YES to take it, NO to pass.`;
    case 'confirm': return `Good. Cut the power to ${name} before ${clock(j.due)}. You'll know when it works. Don't linger.`;
    case 'declined': return `Suit yourself.`;
    case 'paid': return `${name} went dark. ${money(j.pay)} is in your account now. We'll be in touch.`;
    case 'failed': return `${name} still had its lights at ${clock(j.due)}. No pay. Don't waste my time again.`;
  }
}
