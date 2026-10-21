// Offline story material: used when there is no API key, no signal and no pre-written buffer.

export const TONES = [
  { setting: 'A grim, rain-soaked dark fantasy kingdom', tone: 'Grim and tense, with gallows humor' },
  { setting: 'A fading high-fantasy realm whose old magic is dying', tone: 'Melancholic and epic' },
  { setting: 'A frontier of feuding baronies and wild magic', tone: 'Swashbuckling and irreverent' },
  { setting: 'A land haunted by a centuries-old plague of undeath', tone: 'Gothic horror' },
];

export const VILLAINS = [
  { name: 'Morvane', title: 'the Ashen Regent', motive: 'to burn the old kingdom down and rule what grows from the cinders' },
  { name: 'Sycorath', title: 'the Pale Archivist', motive: 'to erase every memory of the gods and rewrite history in her own name' },
  { name: 'Kael Varrow', title: 'the Hollow Crown', motive: 'to reclaim a throne he lost three hundred years ago, whatever it costs the living' },
  { name: 'Ysolde Grimm', title: 'the Thornmother', motive: 'to drown the cities in forest and return the land to the old wild' },
  { name: 'Orrin Blackwake', title: 'the Tide-Eater', motive: 'to open the Deep Gate and let something ancient through' },
];

export const LT_TITLES = ['the Bloodied Hand', 'the Whisper', 'the Iron Vow', 'the Last Herald', 'the Gravewarden', 'the Smiling Knife', 'the Ember Saint', 'the Frost-Tongue'];
export const LT_NAMES = ['Varek', 'Isra', 'Morgath', 'Selene Dask', 'Brother Hollis', 'Thane Ulrik', 'Nyssa', 'Corvo'];

export const NPCS = [
  { name: 'Old Tamsin', role: 'wandering peddler', description: 'A hunched trader who seems to know more than she sells.' },
  { name: 'Brother Aldous', role: 'disgraced priest', description: 'Drinks too much, prays too little, but still knows the old rites.' },
  { name: 'Wren', role: 'runaway scout', description: 'A sharp-eyed youth who saw the villain\'s soldiers burn her village.' },
  { name: 'Captain Hollis Reed', role: 'deserter', description: 'Left the villain\'s army in disgust and wants to make amends.' },
];

export const SCENES: Record<string, string[]> = {
  fight: [
    'The road narrows. Shapes move between the {terrain}. {enemies} step out, weapons ready. There is no going around them.',
    'A crude barricade blocks the way, and the ones who built it are still here: {enemies}. They look hungry.',
    'You hear them before you see them. {enemies}, sent by {villain}\'s agents or just bad luck, close in.',
  ],
  elite: [
    'Bones litter the ground around a hulking figure. Even the other {enemies} keep their distance from it. This one is dangerous.',
    'A champion of {villain} waits on the road, flanked by {enemies}. It has been expecting you.',
  ],
  rest: [
    'A sheltered hollow, a ring of old stones, and dry wood. For a while, the {region} feels almost safe.',
    'An abandoned waystation still has a roof and a cold forge. You could rest here, or put the forge to work.',
  ],
  shop: [
    'A cart painted in faded colors sits by the road. Its owner waves you over with a grin that has seen better teeth.',
    'Lanterns swing over a merchant\'s stall at the crossroads. Everything has a price, and some things have a story.',
  ],
  treasure: [
    'Half buried under {terrain}, an old chest. Someone hid it well, and never came back.',
    'Among the remains of a fallen adventurer, something still glints.',
  ],
  boss: [
    'The road ends at the lair of {lieutenant}, {ltitle}, sworn to {villain}. There is no turning back now.',
  ],
};

export const TERRAIN: Record<string, string> = {
  forest: 'whispering trees',
  marsh: 'reeds and black water',
  goblin: 'scrubby hills',
  ashen: 'ash drifts and cooling lava',
  north: 'snowdrifts',
  desert: 'sand and broken columns',
  underdark: 'dripping stone',
  cursed: 'fog and grave markers',
};

export const OUTROS = [
  'The last of them falls. You catch your breath and check your wounds.',
  'Silence returns to the {region}. You search the bodies and move on.',
  'It is over, for now. Somewhere, {villain} will hear of this.',
];
