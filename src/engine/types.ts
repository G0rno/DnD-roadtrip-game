// Core game types. Everything here is plain JSON so a run can be saved and restored as-is.

export type Stat = 'might' | 'agility' | 'mind' | 'spirit';
export type Stats = Record<Stat, number>;
export const STATS: Stat[] = ['might', 'agility', 'mind', 'spirit'];

export type ClassId = 'fighter' | 'rogue' | 'mage' | 'cleric';
export type RaceId = 'human' | 'dwarf' | 'elf' | 'gnome';
export type BackgroundId = 'soldier' | 'scholar' | 'criminal' | 'merchant' | 'acolyte' | 'outlander';
export type HeroId = 'p1' | 'p2';
export type Row = 'front' | 'back';

export type StatusId =
  | 'staggered'
  | 'exposed'
  | 'frozen'
  | 'blessed'
  | 'poison'
  | 'burn'
  | 'bleed'
  | 'weak'
  | 'shield'
  | 'regen';

export interface StatusInstance {
  id: StatusId;
  turns: number;
  /** DoT/regen per tick, or shield amount. */
  value: number;
  /** Hero id that applied it (combo tracking). */
  source?: HeroId | 'enemy';
}

export type CurseId =
  | 'frail'
  | 'sluggish'
  | 'clumsy'
  | 'jinxed'
  | 'marked'
  | 'weary'
  | 'shaken'
  | 'bleedingHeart'
  | 'butterfingers'
  | 'tithe';

// ---------- Items ----------

export type SlotKind = 'weapon' | 'head' | 'chest' | 'legs' | 'feet' | 'trinket';
export type EquipSlot = 'weapon' | 'head' | 'chest' | 'legs' | 'feet' | 'trinket1' | 'trinket2';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'head', 'chest', 'legs', 'feet', 'trinket1', 'trinket2'];
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export type Weight = 'light' | 'medium' | 'heavy';

export type AffixId =
  | 'damagePct'
  | 'critChance'
  | 'critDamage'
  | 'damageVsStatus'
  | 'damageVsFront'
  | 'damageVsBack'
  | 'lifesteal'
  | 'onHitStatus'
  | 'maxHp'
  | 'armor'
  | 'dodge'
  | 'statusRes'
  | 'thorns'
  | 'healingReceived'
  | 'stat'
  | 'abilityCooldown'
  | 'meterGain'
  | 'statusDuration'
  | 'goldFind'
  | 'startShield';

export interface Affix {
  id: AffixId;
  value: number;
  /** Stat name, status id or ability id, depending on the affix. */
  param?: string;
}

/** Base numbers on an item before affixes. */
export interface ItemBase {
  damage?: [number, number];
  armor?: number;
  dodge?: number;
  maxHp?: number;
  statusRes?: number;
  critChance?: number;
}

export interface Item {
  uid: string;
  baseId: string;
  slot: SlotKind;
  name: string;
  rarity: Rarity;
  /** Item level; scales with distance. */
  power: number;
  weight?: Weight;
  base: ItemBase;
  affixes: Affix[];
  /** Signature legendary id, if any. */
  legendary?: string;
  bestFor: ClassId[];
}

export type ConsumableId =
  | 'potion'
  | 'greaterPotion'
  | 'antidote'
  | 'bomb'
  | 'smokeBomb'
  | 'elixir'
  | 'whetstone'
  | 'wardScroll'
  | 'focusTonic'
  | 'meterDraught';

export interface ConsumableStack {
  id: ConsumableId;
  qty: number;
}

export type BagEntry = { type: 'item'; item: Item } | { type: 'consumable'; stack: ConsumableStack };

// ---------- Heroes ----------

export interface Hero {
  id: HeroId;
  name: string;
  race: RaceId;
  cls: ClassId;
  background: BackgroundId;
  /** Sprite name for the hero's look (cosmetic). */
  look?: string;
  level: number;
  xp: number;
  /** Allocated stats (class base + race + level-up points). Gear and buffs are added in derived stats. */
  stats: Stats;
  hp: number;
  dead: boolean;
  abilities: string[];
  talents: string[];
  equipment: Partial<Record<EquipSlot, Item>>;
  belt: (ConsumableStack | null)[];
  curses: CurseId[];
  pendingLevelUps: number;
  statPoints: number;
  /** Talent choices on offer for the current level-up. */
  talentOffer?: string[];
  humanRerollUsed?: boolean;
}

// ---------- Combat ----------

export type EnemyRole = 'brute' | 'archer' | 'caster' | 'support' | 'boss';

export interface Intent {
  moveId: string;
  /** Target hero, or 'all' / 'self' / an enemy uid for support moves. */
  target: HeroId | 'all' | 'self' | string;
  /** Predicted damage per target (before armor), or heal/shield amount. */
  amount: number;
  label: string;
  icon: string;
}

export interface Enemy {
  uid: string;
  defId: string;
  name: string;
  role: EnemyRole;
  row: Row;
  hp: number;
  maxHp: number;
  damage: number;
  armor: number;
  dodge: number;
  statuses: StatusInstance[];
  intent?: Intent;
  elite?: string;
  boss?: boolean;
  phase?: number;
  dead?: boolean;
  /** Generic counters for enemy mechanics. */
  flags?: Record<string, number>;
}

export interface HeroCombat {
  row: Row;
  statuses: StatusInstance[];
  cooldowns: Record<string, number>;
  mainUsed: number;
  mainAllowed: number;
  minorUsed: boolean;
  guarding: boolean;
  vanished: boolean;
  firstAbilityUsed: boolean;
  whetstone: number;
  elixir: number;
  abilitiesUsed: number;
  /** Set for the turn right after Vanish ends (for Whisper of the Veil). */
  fromVanish: boolean;
  /** Temporary dodge bonus until the hero's next turn. */
  dodgeBuff: number;
  swappedThisTurn: boolean;
}

export type CombatKind = 'normal' | 'elite' | 'boss';

export interface LogEntry {
  text: string;
  kind?: 'hero' | 'enemy' | 'combo' | 'info' | 'crit' | 'loot' | 'bad';
}

export interface FloatText {
  targetId: string;
  text: string;
  kind: 'dmg' | 'heal' | 'crit' | 'miss' | 'status';
  seq: number;
  /** Event this float belongs to (for step-by-step playback). */
  ev?: number;
  /** HP change shown by this float (damage or heal), for animated HP bars. */
  amount?: number;
}

/** One action in combat (a hero action, an enemy move, or status ticks), for playback. */
export interface CombatEvent {
  seq: number;
  actor: string | null;
  label: string;
}

export interface CombatState {
  kind: CombatKind;
  round: number;
  phase: 'players' | 'enemies' | 'won' | 'lost' | 'fled';
  enemies: Enemy[];
  heroes: Record<HeroId, HeroCombat>;
  teamMeter: number;
  fleeAllowed: boolean;
  regionId: string;
  xpReward: number;
  goldReward: number;
  floats: FloatText[];
  floatSeq: number;
  events?: CombatEvent[];
  evSeq?: number;
  curEv?: number;
  enemiesFirst: boolean;
}

// ---------- Checks ----------

export interface CheckOption {
  /** 'none' = no roll needed (e.g. a moral choice). */
  stat: Stat | 'none';
  label: string;
  dc: number;
  difficulty?: Difficulty;
  freeText?: boolean;
}

/** Outcome tiers by margin (GM note): great +5 or double 10, success 0..+4, partial -1..-3, failure -4..-7, bad -8 or less. */
export type CheckTier = 'great' | 'success' | 'partial' | 'failure' | 'bad';

export interface CheckResult {
  heroId: HeroId;
  stat: Stat;
  dice: [number, number];
  bonus: number;
  total: number;
  dc: number;
  tier: CheckTier;
  rerolled: boolean;
  /** A choice that needed no roll (e.g. a moral choice). */
  noRoll?: boolean;
}

export interface EventState {
  templateId: string;
  title: string;
  text: string;
  options: CheckOption[];
  result?: CheckResult;
  outcomeText?: string;
  chosen?: number;
  /** AI events: 'pending' while the GM writes the scene. */
  status?: 'pending' | 'ready';
  type?: string;
  reward?: string;
  penalty?: string;
  summary?: string;
  npc?: { name: string; role: string; description: string };
  /** Plain facts of what the code decided, for the GM to narrate. */
  outcomeFacts?: string;
  outcomeNarrated?: boolean;
}

// ---------- Run ----------

export type NodeType = 'fight' | 'elite' | 'event' | 'rest' | 'shop' | 'treasure' | 'boss';

export interface PathNode {
  type: NodeType;
}

export type Screen =
  | 'create'
  | 'hub'
  | 'combat'
  | 'loot'
  | 'revive'
  | 'levelup'
  | 'event'
  | 'shop'
  | 'rest'
  | 'wipe'
  | 'victory'
  | 'gameover'
  | 'scene';

export interface ShopState {
  stock: (Item | ConsumableStack | null)[];
  rerolled: boolean;
  halfPriceUsed?: boolean;
}

export interface RunStats {
  fights: number;
  kills: number;
  bossesKilled: number;
  wipes: number;
  revives: number;
  startedAt: number;
}

export interface Run {
  version: number;
  slot: number;
  rngState: number;
  seed: number;
  createdAt: number;
  updatedAt: number;
  screen: Screen;
  heroes: Hero[];
  gold: number;
  essence: number;
  bag: (BagEntry | null)[];
  /** Distance travelled, in nodes. Drives enemy, item and check scaling. */
  distance: number;
  act: number;
  /** Nodes cleared in the current act (boss after NODES_PER_ACT). */
  actNode: number;
  regions: string[];
  isNight: boolean;
  rerollTokens: number;
  reviveCount: number;
  wipesThisAct: number;
  /** Path choices offered at the hub. */
  choices: PathNode[];
  currentNode?: PathNode;
  combat?: CombatState;
  event?: EventState;
  shop?: ShopState;
  pendingLoot: Item[];
  pendingConsumables: ConsumableStack[];
  pendingGold: number;
  pendingXp: number;
  /** Message shown on the wipe / transition screen. */
  notice?: string;
  log: LogEntry[];
  stats: RunStats;
  snapshots: { actStart?: string; nodeStart?: string };
  creationStep?: number;
  uidCounter: number;
  restMode?: 'rest' | 'forge' | 'forged';
  skipRevive?: boolean;
  bossBeaten?: boolean;
  recorded?: boolean;
  /** Narrated runs show AI or template scenes between nodes (off for headless bot runs). */
  narrate?: boolean;
  story?: StoryState;
  scene?: SceneState;
  /** A short fight outro still to be written (shown on the loot screen). */
  pendingOutro?: { kind: CombatKind; enemies: string[]; text?: string };
}

// ---------- Story (AI Game Master) ----------

export interface StoryBible {
  title: string;
  setting: string;
  tone: string;
  world: string;
  villain: { name: string; title: string; motive: string; description: string };
  /** One per act; the act bosses. */
  lieutenants: { act: number; name: string; title: string; description: string }[];
  acts: { act: number; title: string; hook: string; beats: string[] }[];
  npcs: { name: string; role: string; description: string }[];
  source: 'ai' | 'offline';
}

export type JournalKind = 'intro' | 'act' | 'scene' | 'event' | 'fight' | 'boss' | 'ending';

export interface JournalEntry {
  act: number;
  distance: number;
  kind: JournalKind;
  title: string;
  text: string;
  /** One-line summary sent back to the AI as memory. */
  summary: string;
}

export interface StoryFlag {
  act: number;
  text: string;
}

export interface StoryState {
  bible?: StoryBible;
  journal: JournalEntry[];
  flags: StoryFlag[];
  npcsMet: { name: string; role: string; note: string }[];
  /** Villain encounters per act (index = act). */
  villainBeats: number[];
  /** Pre-written node scenes keyed by node signature. */
  buffer: Record<string, { title: string; text: string; summary: string }>;
  /** Pre-written events for the current region. */
  eventBuffer: AiEventDraft[];
  cost: CostTotals;
}

export interface CostTotals {
  usd: number;
  calls: number;
  haikuUsd: number;
  sonnetUsd: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'veryhard';

export interface AiEventDraft {
  type: string;
  region: string;
  title: string;
  text: string;
  summary: string;
  npc?: { name: string; role: string; description: string };
  choices: { label: string; stat: Stat | 'none'; difficulty: Difficulty }[];
}

export type SceneKind = 'runStart' | 'actIntro' | 'node' | 'bossIntro' | 'ending';

export interface SceneState {
  kind: SceneKind;
  status: 'pending' | 'ready';
  title: string;
  text: string;
  next: 'enterNode' | 'hub' | 'victory';
  /** Buffer key for node scenes. */
  key?: string;
  summary?: string;
}
