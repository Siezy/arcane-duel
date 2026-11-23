// cards.js — the Arcane Duel card pool and deck building.
// Every card is original to this game. A creature has cost / attack / health;
// a spell has an effect kind resolved by the engine in game.js.
// Rarity drives the card frame colour: common, rare, epic.
// The glyph is a single symbol drawn large on the card face, so a card's
// family reads by shape and colour at a glance, never by text alone.

export const RARITY_ORDER = { common: 0, rare: 1, epic: 2 };

export const CARD_POOL = [
  // Creatures — the Ember Court (aggressive reds)
  { id: 'ember-imp', kind: 'creature', name: 'Ember Imp', cost: 1, attack: 2, health: 1, rarity: 'common', glyph: '✦', school: 'ember', text: 'Small spark, big temper.' },
  { id: 'spark-fox', kind: 'creature', name: 'Spark Fox', cost: 1, attack: 1, health: 2, rarity: 'common', glyph: '◆', school: 'ember', text: 'It chases its own lightning tail.' },
  { id: 'rune-knight', kind: 'creature', name: 'Rune Knight', cost: 2, attack: 3, health: 2, rarity: 'common', glyph: '♞', school: 'rune', text: 'His blade remembers every duel.' },
  { id: 'flame-phoenix', kind: 'creature', name: 'Flame Phoenix', cost: 7, attack: 6, health: 6, rarity: 'epic', glyph: '★', school: 'ember', text: 'It has burned down nine lives already.' },
  { id: 'storm-drake', kind: 'creature', name: 'Storm Drake', cost: 5, attack: 5, health: 4, rarity: 'rare', glyph: '↯', school: 'storm', text: 'Thunder is just its wings clapping.' },

  // Creatures — the Verdant & Stone orders (defensive greens and greys)
  { id: 'moon-archer', kind: 'creature', name: 'Moon Archer', cost: 2, attack: 2, health: 3, rarity: 'common', glyph: '☾', school: 'moon', text: 'She aims by starlight alone.' },
  { id: 'verdant-dryad', kind: 'creature', name: 'Verdant Dryad', cost: 3, attack: 2, health: 4, rarity: 'rare', glyph: '♣', school: 'verdant', text: 'Arrival: restore 3 life to your duelist.', battlecry: { type: 'heal-self', amount: 3 } },
  { id: 'iron-sentinel', kind: 'creature', name: 'Iron Sentinel', cost: 3, attack: 1, health: 5, rarity: 'common', glyph: '♜', school: 'stone', text: 'Guard: enemies must attack this first.', guard: true },
  { id: 'stone-golem', kind: 'creature', name: 'Stone Golem', cost: 4, attack: 3, health: 6, rarity: 'rare', glyph: '▲', school: 'stone', text: 'Guard: enemies must attack this first.', guard: true },
  { id: 'tide-serpent', kind: 'creature', name: 'Tide Serpent', cost: 4, attack: 4, health: 4, rarity: 'common', glyph: '♒', school: 'tide', text: 'The river fights back.' },

  // Creatures — the Void (heavy purple finishers)
  { id: 'shadow-assassin', kind: 'creature', name: 'Shadow Assassin', cost: 3, attack: 4, health: 2, rarity: 'rare', glyph: '†', school: 'void', text: 'You will not see the second strike.' },
  { id: 'void-reaper', kind: 'creature', name: 'Void Reaper', cost: 6, attack: 6, health: 5, rarity: 'epic', glyph: '☠', school: 'void', text: 'Every duel ends the same way.' },

  // Spells
  { id: 'frost-shard', kind: 'spell', name: 'Frost Shard', cost: 1, rarity: 'common', glyph: '❄', school: 'moon', text: 'Deal 2 damage to a creature.', spell: { type: 'damage-creature', amount: 2 } },
  { id: 'firebolt', kind: 'spell', name: 'Firebolt', cost: 2, rarity: 'common', glyph: '☄', school: 'ember', text: 'Deal 3 damage to any target.', spell: { type: 'damage-any', amount: 3 } },
  { id: 'healing-light', kind: 'spell', name: 'Healing Light', cost: 2, rarity: 'common', glyph: '✚', school: 'verdant', text: 'Restore 5 life to your duelist.', spell: { type: 'heal-self', amount: 5 } },
  { id: 'arcane-surge', kind: 'spell', name: 'Arcane Surge', cost: 3, rarity: 'rare', glyph: '✶', school: 'rune', text: 'Draw 2 cards.', spell: { type: 'draw', amount: 2 } },
  { id: 'meteor', kind: 'spell', name: 'Meteor', cost: 6, rarity: 'epic', glyph: '☄', school: 'storm', text: 'Deal 3 damage to ALL creatures.', spell: { type: 'damage-all-creatures', amount: 3 } },
];

export function cardById(id) {
  return CARD_POOL.find((c) => c.id === id);
}

// A duel deck: two copies of most cards, one of each epic — 24 cards.
export function buildDeck(rng) {
  const ids = [];
  for (const card of CARD_POOL) {
    const copies = card.rarity === 'epic' ? 1 : 2;
    for (let i = 0; i < copies; i++) ids.push(card.id);
  }
  return shuffle(ids, rng);
}

export function shuffle(ids, rng) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic RNG (mulberry32) so screenshot setups are reproducible.
export function seededRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
