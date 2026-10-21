import type { Stat } from '../types';

// Template events: the offline fallback the AI Game Master will replace with improvised scenes (Phase 4).

export type Reward = 'gold' | 'item' | 'xp' | 'consumable' | 'reroll' | 'heal';
export type Penalty = 'damage' | 'gold' | 'none';

export interface EventTemplate {
  id: string;
  title: string;
  text: string;
  options: { stat: Stat; label: string; diff: number }[];
  reward: Reward;
  penalty: Penalty;
  success: string;
  partial: string;
  failure: string;
}

export const EVENTS: EventTemplate[] = [
  {
    id: 'bridge',
    title: 'The Broken Bridge',
    text: 'A rope bridge hangs in tatters over a gorge. Something glints in a pack left on the far side.',
    options: [
      { stat: 'might', label: 'Haul a fallen log across', diff: 1 },
      { stat: 'agility', label: 'Leap the gap', diff: 0 },
      { stat: 'mind', label: 'Rig the ropes into a pulley', diff: 1 },
    ],
    reward: 'item',
    penalty: 'damage',
    success: 'You cross cleanly and claim the pack.',
    partial: 'You make it across, bruised, and grab the pack.',
    failure: 'The ropes give way. You crash into the rocks below and climb back up empty-handed.',
  },
  {
    id: 'shrine',
    title: 'A Forgotten Shrine',
    text: 'Moss covers a small shrine. A faint warmth still lingers on the altar stone.',
    options: [
      { stat: 'spirit', label: 'Pray', diff: 0 },
      { stat: 'mind', label: 'Decipher the runes', diff: 1 },
    ],
    reward: 'heal',
    penalty: 'none',
    success: 'Warm light washes over the party. Wounds close.',
    partial: 'A flicker of warmth. Some wounds close.',
    failure: 'The shrine stays cold and silent.',
  },
  {
    id: 'chest',
    title: 'A Locked Chest',
    text: 'Half buried in the road: an iron-banded chest with a rusty lock.',
    options: [
      { stat: 'agility', label: 'Pick the lock', diff: 0 },
      { stat: 'might', label: 'Smash it open', diff: 1 },
    ],
    reward: 'gold',
    penalty: 'damage',
    success: 'The lid swings open on a pile of coins.',
    partial: 'A needle trap pricks your hand, but the coins are yours.',
    failure: 'A poisoned needle bites deep and the lock jams for good.',
  },
  {
    id: 'riddle',
    title: 'The Riddling Stone',
    text: 'A carved face in a boulder opens its eyes and offers a riddle, and a prize.',
    options: [
      { stat: 'mind', label: 'Answer the riddle', diff: 0 },
      { stat: 'spirit', label: 'Charm the stone', diff: 2 },
    ],
    reward: 'xp',
    penalty: 'none',
    success: 'The stone laughs and shares an old secret. You feel wiser.',
    partial: 'Close enough, says the stone, and shares half a secret.',
    failure: 'The stone closes its eyes and ignores you.',
  },
  {
    id: 'peddler',
    title: 'The Wandering Peddler',
    text: 'A peddler with a creaking cart offers a "special price" to travelers who can prove their worth.',
    options: [
      { stat: 'spirit', label: 'Haggle', diff: 0 },
      { stat: 'mind', label: 'Spot the fake goods', diff: 1 },
    ],
    reward: 'consumable',
    penalty: 'gold',
    success: 'The peddler grins and hands over a free bottle.',
    partial: 'A fair trade: one small bottle for your trouble.',
    failure: 'You walk away lighter in the purse and none the richer.',
  },
  {
    id: 'ambushTrail',
    title: 'Tracks in the Mud',
    text: 'Fresh tracks lead off the road toward a hidden camp. It might be empty. It might not.',
    options: [
      { stat: 'agility', label: 'Sneak in', diff: 1 },
      { stat: 'might', label: 'Charge in loudly', diff: 2 },
      { stat: 'mind', label: 'Read the tracks first', diff: 0 },
    ],
    reward: 'gold',
    penalty: 'damage',
    success: 'The camp is empty and its stash is yours.',
    partial: 'A guard dog bites before you scare it off. You grab what you can.',
    failure: 'The camp was trapped. You limp back to the road.',
  },
  {
    id: 'fortune',
    title: 'The Fortune Teller',
    text: 'An old woman with clouded eyes offers to read the dice of fate.',
    options: [
      { stat: 'spirit', label: 'Let her read you', diff: 1 },
      { stat: 'mind', label: 'Match her wits', diff: 2 },
    ],
    reward: 'reroll',
    penalty: 'none',
    success: 'She presses a lucky token into your hand. (+1 reroll token)',
    partial: 'She shrugs: fate is unclear. Still, you feel a little lucky.',
    failure: 'She frowns and refuses to say more.',
  },
  {
    id: 'river',
    title: 'The Swollen River',
    text: 'The ford is flooded. On the other side, a drowned merchant cart lies on its side.',
    options: [
      { stat: 'might', label: 'Wade across', diff: 1 },
      { stat: 'agility', label: 'Hop the stones', diff: 1 },
      { stat: 'mind', label: 'Find a safer crossing', diff: 0 },
    ],
    reward: 'item',
    penalty: 'damage',
    success: 'You reach the cart and salvage something useful.',
    partial: 'The current batters you, but you salvage something.',
    failure: 'The river sweeps you downstream. You crawl out, soaked and hurt.',
  },
];
