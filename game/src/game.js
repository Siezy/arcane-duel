// game.js — the Arcane Duel rules engine. Pure state and rules, no DOM:
// the UI in ui.js renders this state and calls these functions, and the AI
// in ai.js plays through the same legal moves a human gets.
//
// Rules in one breath: both duelists start at 20 life. On your turn your
// mana refills and grows by one (cap 10) and you draw a card. Creatures wait
// a turn before attacking (summoning sickness). A creature may attack an
// enemy creature, or the enemy duelist — but only while no Guard creature
// stands in the way, and a duelist can only be attacked directly while the
// enemy field holds no Guard. Combat is mutual: both creatures deal their
// attack to each other. First duelist to 0 life loses.

import { buildDeck, cardById } from './cards.js';

export const START_LIFE = 20;
export const MAX_FIELD = 5;
export const MAX_MANA = 10;

let nextUid = 1;

export function newDuelist(name, isPlayer, rng) {
  return {
    name,
    isPlayer,
    life: START_LIFE,
    maxMana: 0,
    mana: 0,
    deck: buildDeck(rng),
    hand: [], // card instance ids (uids into state.cards)
    field: [], // uids of creatures in play
    fatigue: 0,
  };
}

export function createGame(rng) {
  const state = {
    rng,
    cards: new Map(), // uid -> live card instance
    player: newDuelist('You', true, rng),
    enemy: newDuelist('Malachar, the Void Sage', false, rng),
    turn: 0,
    active: 'player', // whose turn it is
    phase: 'title', // title | play | won | lost
    log: [],
    winner: null,
  };
  drawCards(state, state.player, 3);
  drawCards(state, state.enemy, 3);
  return state;
}

function instantiate(state, cardId) {
  const def = cardById(cardId);
  const uid = nextUid++;
  const inst = {
    uid,
    defId: cardId,
    kind: def.kind,
    name: def.name,
    cost: def.cost,
    rarity: def.rarity,
    glyph: def.glyph,
    school: def.school,
    text: def.text,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    guard: !!def.guard,
    battlecry: def.battlecry ?? null,
    spell: def.spell ?? null,
    sick: true, // summoning sickness until the owner's next turn starts
    attacked: false,
  };
  state.cards.set(uid, inst);
  return inst;
}

// Setup helpers: place a named card straight into a hand or onto a field.
// Used by the screenshot setups in ui.js to stage exact table states.
export function setupGiveCard(state, duelist, cardId) {
  const inst = instantiate(state, cardId);
  duelist.hand.push(inst.uid);
  return inst;
}

export function setupSummon(state, duelist, cardId, ready = true) {
  const inst = instantiate(state, cardId);
  inst.sick = !ready;
  duelist.field.push(inst.uid);
  return inst;
}

export function drawCards(state, duelist, n) {
  for (let i = 0; i < n; i++) {
    if (duelist.deck.length === 0) {
      // Empty deck: fatigue bites harder each time.
      duelist.fatigue += 1;
      damageDuelist(state, duelist, duelist.fatigue, 'fatigue');
      continue;
    }
    const inst = instantiate(state, duelist.deck.pop());
    duelist.hand.push(inst.uid);
  }
}

export function logLine(state, text) {
  state.log.push(text);
  if (state.log.length > 7) state.log.shift();
}

export function startTurn(state, who) {
  const d = state[who];
  state.active = who;
  if (who === 'player') state.turn += 1;
  d.maxMana = Math.min(MAX_MANA, d.maxMana + 1);
  d.mana = d.maxMana;
  for (const uid of d.field) {
    const c = state.cards.get(uid);
    c.sick = false;
    c.attacked = false;
  }
  drawCards(state, d, 1);
  checkEnd(state);
}

export function canPlay(state, duelist, inst) {
  if (state.active !== (duelist.isPlayer ? 'player' : 'enemy')) return false;
  if (duelist.mana < inst.cost) return false;
  if (inst.kind === 'creature' && duelist.field.length >= MAX_FIELD) return false;
  return true;
}

// Play a card from hand. target is {type:'duelist'|'creature', side, uid?}
// for spells that need one; ignored otherwise. Returns true if it resolved.
export function playCard(state, duelist, uid, target) {
  const inst = state.cards.get(uid);
  if (!inst || !duelist.hand.includes(uid) || !canPlay(state, duelist, inst)) return false;
  duelist.mana -= inst.cost;
  duelist.hand = duelist.hand.filter((h) => h !== uid);
  logLine(state, `${duelist.isPlayer ? 'You play' : 'Malachar plays'} ${inst.name}.`);

  if (inst.kind === 'creature') {
    duelist.field.push(uid);
    if (inst.battlecry?.type === 'heal-self') {
      healDuelist(state, duelist, inst.battlecry.amount);
    }
  } else {
    resolveSpell(state, duelist, inst, target);
    state.cards.delete(uid);
  }
  sweepDead(state);
  checkEnd(state);
  return true;
}

function resolveSpell(state, duelist, inst, target) {
  const foe = duelist.isPlayer ? state.enemy : state.player;
  const s = inst.spell;
  if (!s) return;
  if (s.type === 'damage-any') {
    if (target?.type === 'creature') damageCreature(state, state.cards.get(target.uid), s.amount);
    else damageDuelist(state, foe, s.amount, inst.name);
  } else if (s.type === 'damage-creature') {
    if (target?.type === 'creature') damageCreature(state, state.cards.get(target.uid), s.amount);
  } else if (s.type === 'heal-self') {
    healDuelist(state, duelist, s.amount);
  } else if (s.type === 'draw') {
    drawCards(state, duelist, s.amount);
  } else if (s.type === 'damage-all-creatures') {
    for (const uid of [...state.player.field, ...state.enemy.field]) {
      damageCreature(state, state.cards.get(uid), s.amount);
    }
  }
}

// Which targets may `inst` (a spell) legally hit right now?
export function spellNeedsTarget(inst) {
  return inst.kind === 'spell' && (inst.spell?.type === 'damage-any' || inst.spell?.type === 'damage-creature');
}

export function guardUp(state, duelist) {
  return duelist.field.some((uid) => state.cards.get(uid).guard);
}

// Legal attack targets for a creature of `duelist`: enemy creatures always;
// the enemy duelist only when no Guard stands anywhere on the enemy field.
export function legalAttackTargets(state, duelist) {
  const foe = duelist.isPlayer ? state.enemy : state.player;
  const targets = foe.field.map((uid) => ({ type: 'creature', uid }));
  if (!guardUp(state, foe)) targets.push({ type: 'duelist' });
  return targets;
}

export function canAttack(state, duelist, inst) {
  return (
    state.active === (duelist.isPlayer ? 'player' : 'enemy') &&
    duelist.field.includes(inst.uid) &&
    !inst.sick &&
    !inst.attacked &&
    inst.attack > 0
  );
}

export function attack(state, duelist, attackerUid, target) {
  const attacker = state.cards.get(attackerUid);
  if (!attacker || !canAttack(state, duelist, attacker)) return false;
  const foe = duelist.isPlayer ? state.enemy : state.player;
  const legal = legalAttackTargets(state, duelist);
  const ok = legal.some((t) => t.type === target.type && t.uid === target.uid);
  if (!ok) return false;
  attacker.attacked = true;
  if (target.type === 'duelist') {
    logLine(state, `${attacker.name} hits ${foe.isPlayer ? 'you' : 'Malachar'} for ${attacker.attack}.`);
    damageDuelist(state, foe, attacker.attack, attacker.name);
  } else {
    const defender = state.cards.get(target.uid);
    logLine(state, `${attacker.name} clashes with ${defender.name}.`);
    const atkDmg = attacker.attack;
    const defDmg = defender.attack;
    damageCreature(state, defender, atkDmg);
    damageCreature(state, attacker, defDmg);
  }
  sweepDead(state);
  checkEnd(state);
  return true;
}

export function damageCreature(state, inst, amount) {
  if (!inst || amount <= 0) return;
  inst.health -= amount;
}

export function damageDuelist(state, duelist, amount, source) {
  if (amount <= 0) return;
  duelist.life -= amount;
  if (source) logLine(state, `${source} deals ${amount} to ${duelist.isPlayer ? 'you' : 'Malachar'}.`);
}

export function healDuelist(state, duelist, amount) {
  duelist.life = Math.min(START_LIFE, duelist.life + amount);
}

export function sweepDead(state) {
  for (const key of ['player', 'enemy']) {
    const d = state[key];
    d.field = d.field.filter((uid) => {
      const c = state.cards.get(uid);
      if (c.health <= 0) {
        logLine(state, `${c.name} is destroyed.`);
        state.cards.delete(uid);
        return false;
      }
      return true;
    });
  }
}

export function checkEnd(state) {
  if (state.phase === 'won' || state.phase === 'lost') return;
  if (state.enemy.life <= 0) {
    state.phase = 'won';
    state.winner = 'player';
  } else if (state.player.life <= 0) {
    state.phase = 'lost';
    state.winner = 'enemy';
  }
}
