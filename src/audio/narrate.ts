// What the driver hears: story lines in character voices, plus short spoken summaries of everything
// needed to play (choices with odds, results, combat rounds, loot, path choices). English or French.
import type { CombatEvent, FloatText, Line, Run, Stat } from '../engine/types';
import type { Segment } from './voice';
import { loadSettings } from '../engine/save';
import { derive } from '../engine/character';
import { checkOdds } from '../engine/checks';
import { STATUSES, CURSES } from '../engine/data/statuses';
import { REGIONS } from '../engine/data/enemies';
import { story } from '../engine/story';
import { score } from '../engine/run';
import { CONSUMABLES } from '../engine/data/items';

type L = 'en' | 'fr';
const lang = (): L => loadSettings().narrationLang;

const NUM = {
  en: ['One', 'Two', 'Three', 'Four', 'Five'],
  fr: ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq'],
};
const STAT: Record<L, Record<Stat, string>> = {
  en: { might: 'Might', agility: 'Agility', mind: 'Mind', spirit: 'Spirit' },
  fr: { might: 'Puissance', agility: 'Agilité', mind: 'Intellect', spirit: 'Esprit' },
};
const TIER: Record<L, Record<string, string>> = {
  en: { great: 'Great success!', success: 'Success.', partial: 'Partial success.', failure: 'Failure.', bad: 'Bad failure.' },
  fr: { great: 'Grande réussite !', success: 'Réussite.', partial: 'Réussite partielle.', failure: 'Échec.', bad: 'Échec grave.' },
};
const NODE: Record<L, Record<string, string>> = {
  en: { fight: 'a fight', elite: 'an elite fight', event: 'an event', rest: 'a rest', shop: 'a merchant', treasure: 'a treasure', boss: 'the act boss' },
  fr: { fight: 'un combat', elite: 'un combat d’élite', event: 'un événement', rest: 'un repos', shop: 'un marchand', treasure: 'un trésor', boss: 'le boss de l’acte' },
};

const T = {
  en: {
    whatDo: 'What do you do?',
    check: (stat: string) => `${stat} check`,
    noRoll: 'no roll',
    pct: (n: number) => `${n} percent`,
    orElse: 'Or something else.',
    vs: (t: number, dc: number) => `${t} against ${dc}.`,
    round: (n: number) => `Round ${n}.`,
    hp: (name: string, hp: number, max: number) => `${name}, ${hp} of ${max}.`,
    fallen: (name: string) => `${name} is down.`,
    intent: (e: string, move: string, target?: string) => (target ? `${e} will ${move} on ${target}.` : `${e} will ${move}.`),
    frozen: (e: string) => `${e} is frozen.`,
    enemyHp: (e: string, hp: number, max: number, st: string) => `${e}, ${hp} of ${max}${st ? `, ${st}` : ''}.`,
    meter: (n: number) => `Team meter ${n} percent.`,
    yourMove: 'Your move.',
    takes: (t: string, n: number) => `${t} takes ${n}.`,
    crit: 'Critical!',
    heals: (t: string, n: number) => `${t} heals ${n}.`,
    dodges: (t: string) => `${t} dodges.`,
    statusTick: 'Status effects.',
    victory: 'Victory.',
    found: (items: string) => `Found: ${items}.`,
    gold: (n: number) => `${n} gold.`,
    xp: (n: number) => `${n} experience each.`,
    level: (n: string, l: number) => `${n} reaches level ${l}.`,
    pickTalent: 'Choose a talent on screen.',
    stop: 'Step complete. Good place to stop.',
    choose: 'Choose your path.',
    boss: (lt: string) => `The road ends at ${lt}'s lair. Ready when you are.`,
    shop: 'A merchant. Browse the wares on screen.',
    rest: 'A safe place. Rest to heal, or use the forge.',
    fallenRevive: (n: string) => `${n} has fallen. Choose how to bring them back.`,
    wipe: 'The party has fallen. You wake at the start of the act, cursed.',
    cursed: (n: string, c: string) => `${n}: ${c}.`,
    end: (s: number) => `Victory! Final score ${s}.`,
    newChoice: (l: string) => `New choice: ${l}.`,
  },
  fr: {
    whatDo: 'Que faites-vous ?',
    check: (stat: string) => `test d’${stat}`,
    noRoll: 'sans jet',
    pct: (n: number) => `${n} pour cent`,
    orElse: 'Ou autre chose.',
    vs: (t: number, dc: number) => `${t} contre ${dc}.`,
    round: (n: number) => `Tour ${n}.`,
    hp: (name: string, hp: number, max: number) => `${name}, ${hp} sur ${max}.`,
    fallen: (name: string) => `${name} est à terre.`,
    intent: (e: string, move: string, target?: string) => (target ? `${e} prépare ${move} contre ${target}.` : `${e} prépare ${move}.`),
    frozen: (e: string) => `${e} est gelé.`,
    enemyHp: (e: string, hp: number, max: number, st: string) => `${e}, ${hp} sur ${max}${st ? `, ${st}` : ''}.`,
    meter: (n: number) => `Jauge d’équipe à ${n} pour cent.`,
    yourMove: 'À vous.',
    takes: (t: string, n: number) => `${t} subit ${n}.`,
    crit: 'Coup critique !',
    heals: (t: string, n: number) => `${t} récupère ${n}.`,
    dodges: (t: string) => `${t} esquive.`,
    statusTick: 'Effets de statut.',
    victory: 'Victoire.',
    found: (items: string) => `Butin : ${items}.`,
    gold: (n: number) => `${n} pièces d’or.`,
    xp: (n: number) => `${n} points d’expérience chacun.`,
    level: (n: string, l: number) => `${n} atteint le niveau ${l}.`,
    pickTalent: 'Choisissez un talent à l’écran.',
    stop: 'Étape terminée. Bon moment pour faire une pause.',
    choose: 'Choisissez votre chemin.',
    boss: (lt: string) => `La route mène au repaire de ${lt}. Prêts quand vous l’êtes.`,
    shop: 'Un marchand. Consultez ses articles à l’écran.',
    rest: 'Un endroit sûr. Reposez-vous pour guérir, ou utilisez la forge.',
    fallenRevive: (n: string) => `${n} est tombé. Choisissez comment le ramener.`,
    wipe: 'Le groupe est tombé. Vous vous réveillez au début de l’acte, maudits.',
    cursed: (n: string, c: string) => `${n} : ${c}.`,
    end: (s: number) => `Victoire ! Score final : ${s}.`,
    newChoice: (l: string) => `Nouveau choix : ${l}.`,
  },
};

const t = () => T[lang()];
const sys = (text: string): Segment => ({ text, role: 'system' });
const nar = (text: string): Segment => ({ text, role: 'narrator' });

// ---------- Story lines ----------

function roleFor(run: Run, speaker: string): Segment['role'] {
  const b = story(run).bible;
  const s = speaker.toLowerCase();
  if (b) {
    const villainish = [b.villain.name, ...b.lieutenants.map((l) => l.name)].map((n) => n.toLowerCase());
    if (villainish.some((n) => n && (s.includes(n) || n.includes(s)))) return 'villain';
  }
  return 'npc';
}

export function linesSegments(run: Run, lines: Line[] | undefined, fallback: string): Segment[] {
  if (!lines?.length) return fallback ? [nar(fallback)] : [];
  return lines.map((l) => (l.speaker ? { text: l.text, role: roleFor(run, l.speaker), name: l.speaker } : nar(l.text)));
}

export function sceneSegments(run: Run): Segment[] {
  const sc = run.scene;
  if (!sc) return [];
  return [nar(sc.title + '.'), ...linesSegments(run, sc.lines, sc.text)];
}

// ---------- Events ----------

export function choicesSegments(run: Run): Segment[] {
  const ev = run.event;
  if (!ev) return [];
  const L = t();
  const parts: string[] = [L.whatDo];
  ev.options.forEach((o, i) => {
    let s = `${NUM[lang()][i] ?? i + 1}: ${o.label}`;
    if (o.stat === 'none') s += `, ${L.noRoll}.`;
    else {
      const odds = run.heroes.filter((h) => !h.dead).map((h) => `${h.name} ${L.pct(Math.round(checkOdds(run, h, o.stat as Stat, o.dc).success * 100))}`);
      s += `, ${L.check(STAT[lang()][o.stat as Stat])}: ${odds.join(', ')}.`;
    }
    parts.push(s);
  });
  if (run.narrate) parts.push(L.orElse);
  return parts.map(sys);
}

export function eventIntroSegments(run: Run): Segment[] {
  const ev = run.event;
  if (!ev) return [];
  return [nar(ev.title + '.'), ...linesSegments(run, ev.lines, ev.text), ...choicesSegments(run)];
}

export function eventRollSegments(run: Run): Segment[] {
  const r = run.event?.result;
  if (!r || r.noRoll) return [];
  return [sys(`${t().vs(r.total, r.dc)} ${TIER[lang()][r.tier]}`)];
}

export function eventOutcomeSegments(run: Run): Segment[] {
  const ev = run.event;
  if (!ev?.outcomeText) return [];
  // The exact coded result after the narration, minus the parts the driver already heard.
  const facts = (ev.outcomeFacts ?? '').replace(/^.*?chose: "[^"]*"\.\s*/, '').replace(/^No roll needed\.\s*/, '').replace(/^(Great success|Success|Partial success|Failure|Bad failure)\.\s*/, '');
  if (ev.outcomeNarrated) return [...linesSegments(run, ev.outcomeLines, ev.outcomeText), ...(facts ? [sys(facts)] : [])];
  return [nar(ev.outcomeText)];
}

export function newChoiceSegment(label: string): Segment[] {
  return [sys(t().newChoice(label))];
}

// ---------- Combat ----------

function nameOf(run: Run, id: string): string {
  return run.heroes.find((h) => h.id === id)?.name ?? run.combat?.enemies.find((e) => e.uid === id)?.name ?? '';
}

/** One action during playback: who did what, and what happened to each target. */
export function combatEventSegments(run: Run, ev: CombatEvent, floats: FloatText[]): Segment[] {
  const L = t();
  const mine = floats.filter((f) => f.ev === ev.seq);
  const byTarget = new Map<string, FloatText[]>();
  for (const f of mine) byTarget.set(f.targetId, [...(byTarget.get(f.targetId) ?? []), f]);
  const parts: string[] = [];
  parts.push(ev.actor ? `${nameOf(run, ev.actor)}: ${ev.label}.` : L.statusTick);
  for (const [id, fs] of byTarget) {
    const name = nameOf(run, id);
    const dmg = fs.filter((f) => f.kind === 'dmg' || f.kind === 'crit').reduce((s, f) => s + (f.amount ?? 0), 0);
    const heal = fs.filter((f) => f.kind === 'heal').reduce((s, f) => s + (f.amount ?? 0), 0);
    if (fs.some((f) => f.kind === 'crit')) parts.push(L.crit);
    if (dmg) parts.push(L.takes(name, dmg));
    if (heal >= 3 || (heal && loadSettings().verbosity === 'detailed')) parts.push(L.heals(name, heal));
    if (!dmg && !heal && fs.some((f) => f.kind === 'miss' && /dodge|miss/i.test(f.text))) parts.push(L.dodges(name));
  }
  if (!ev.actor && parts.length === 1) return [];
  return [sys(parts.join(' '))];
}

/** Start of the heroes' turn: HP, enemy intentions (and more in detailed mode). */
export function roundSegments(run: Run): Segment[] {
  const c = run.combat;
  if (!c) return [];
  const L = t();
  const detailed = loadSettings().verbosity === 'detailed';
  const parts: string[] = [L.round(c.round)];
  for (const h of run.heroes) parts.push(h.dead ? L.fallen(h.name) : L.hp(h.name, h.hp, derive(h).maxHp));
  for (const e of c.enemies.filter((x) => !x.dead)) {
    if (detailed) parts.push(L.enemyHp(e.name, e.hp, e.maxHp, e.statuses.map((s) => STATUSES[s.id].name).join(', ')));
    if (e.statuses.some((s) => s.id === 'frozen')) parts.push(L.frozen(e.name));
    else if (e.intent) {
      const tg = e.intent.target === 'all' ? (lang() === 'fr' ? 'tout le monde' : 'everyone') : e.intent.target === 'self' ? undefined : nameOf(run, e.intent.target);
      const label = e.intent.label.replace(' (all)', '').replace(' + ', lang() === 'fr' ? ' avec ' : ' with ');
      parts.push(L.intent(e.name, label, tg));
    }
  }
  if (detailed) parts.push(L.meter(c.teamMeter));
  parts.push(L.yourMove);
  return [sys(parts.join(' '))];
}

// ---------- Other screens ----------

export function lootSegments(run: Run, outro?: string): Segment[] {
  const L = t();
  const out: Segment[] = [];
  if (run.pendingOutro) out.push(sys(L.victory));
  if (outro) out.push(nar(outro));
  const items = run.pendingLoot.map((i) => i.name);
  const cons = run.pendingConsumables.map((c) => CONSUMABLES[c.id].name);
  if (items.length || cons.length) out.push(sys(L.found([...items, ...cons].join(', '))));
  if (run.pendingGold) out.push(sys(L.gold(run.pendingGold)));
  if (run.pendingXp) out.push(sys(L.xp(run.pendingXp)));
  return out;
}

export function levelSegments(run: Run): Segment[] {
  const L = t();
  const ups = run.heroes.filter((h) => h.pendingLevelUps > 0 || h.statPoints > 0);
  if (!ups.length) return [];
  return [sys(`${ups.map((h) => L.level(h.name, h.level)).join(' ')} ${L.pickTalent}`)];
}

export function hubSegments(run: Run, stopping: boolean): Segment[] {
  const L = t();
  const out: Segment[] = [];
  if (stopping) out.push(sys(L.stop));
  if (run.choices.length === 1 && run.choices[0].type === 'boss') {
    const lt = story(run).bible?.lieutenants.find((l) => l.act === run.act)?.name ?? REGIONS[run.regions[run.act - 1]].boss.name;
    out.push(sys(L.boss(lt)));
    return out;
  }
  const opts = run.choices.map((n, i) => `${NUM[lang()][i]}: ${NODE[lang()][n.type]}.`);
  out.push(sys(`${L.choose} ${opts.join(' ')}`));
  return out;
}

export const shopSegments = (): Segment[] => [sys(t().shop)];
export const restSegments = (): Segment[] => [sys(t().rest)];

export function reviveSegments(run: Run): Segment[] {
  const f = run.heroes.find((h) => h.dead);
  return f ? [sys(t().fallenRevive(f.name))] : [];
}

export function wipeSegments(run: Run): Segment[] {
  const L = t();
  return [sys(L.wipe), ...run.heroes.filter((h) => h.curses.length).map((h) => sys(L.cursed(h.name, h.curses.map((c) => CURSES[c].name).join(', '))))];
}

export function endSegments(run: Run): Segment[] {
  return [sys(t().end(score(run)))];
}
