// ai.js — Malachar's brain: simple, readable heuristics the player can
// learn and counter. He plays his most expensive affordable card first,
// aims burn at the biggest threat (or at your face when it brings lethal
// closer), heals when hurt, and trades creatures only when the trade is
// favourable — otherwise he goes for your life total.

import { attack, canAttack, canPlay, legalAttackTargets, playCard, spellNeedsTarget } from './game.js';

// One AI step: plays a single card or makes a single attack, so the UI can
// animate each move. Returns a short description, or null when done.
export function aiStep(state) {
  const me = state.enemy;
  const foe = state.player;
  if (state.phase !== 'play' || state.active !== 'enemy') return null;

  const played = aiPlayOneCard(state, me, foe);
  if (played) return played;

  const attacked = aiMakeOneAttack(state, me, foe);
  if (attacked) return attacked;

  return null;
}

function aiPlayOneCard(state, me, foe) {
  // Affordable cards, most expensive first — greed is readable.
  const playable = me.hand
    .map((uid) => state.cards.get(uid))
    .filter((inst) => canPlay(state, me, inst))
    .sort((a, b) => b.cost - a.cost);
  if (playable.length === 0) return null;

  for (const inst of playable) {
    if (inst.kind === 'creature') {
      playCard(state, me, inst.uid, null);
      return `Malachar summons ${inst.name}.`;
    }
    const target = aiSpellTarget(state, me, foe, inst);
    if (target === 'skip') continue; // hold this spell for a better moment
    playCard(state, me, inst.uid, target);
    return `Malachar casts ${inst.name}.`;
  }
  return null;
}

function aiSpellTarget(state, me, foe, inst) {
  const s = inst.spell;
  if (!s) return null;
  if (s.type === 'heal-self') {
    // Heal only when it matters.
    return me.life <= 12 ? null : 'skip';
  }
  if (s.type === 'draw') {
    return me.hand.length <= 4 ? null : 'skip';
  }
  if (s.type === 'damage-all-creatures') {
    // Meteor only when it kills more of yours than his.
    const mineDie = me.field.filter((u) => state.cards.get(u).health <= s.amount).length;
    const yoursDie = foe.field.filter((u) => state.cards.get(u).health <= s.amount).length;
    return yoursDie > mineDie ? null : 'skip';
  }
  if (spellNeedsTarget(inst)) {
    // Burn the biggest creature it can kill; otherwise chip the duelist.
    const killable = foe.field
      .map((uid) => state.cards.get(uid))
      .filter((c) => c.health <= s.amount)
      .sort((a, b) => b.attack - a.attack);
    if (killable.length > 0) return { type: 'creature', uid: killable[0].uid };
    if (s.type === 'damage-any') return { type: 'duelist' };
    return 'skip';
  }
  return null;
}

function aiMakeOneAttack(state, me, foe) {
  const legal = legalAttackTargets(state, me);
  const canHitFace = legal.some((t) => t.type === 'duelist');
  for (const uid of me.field) {
    const c = state.cards.get(uid);
    if (!canAttack(state, me, c)) continue;
    // Favourable trade: kill a creature and live, or trade up in attack.
    const trade = foe.field
      .map((u) => state.cards.get(u))
      .filter((t) => c.attack >= t.health && (c.health > t.attack || t.attack >= c.attack))
      .sort((a, b) => b.attack - a.attack)[0];
    if (trade) {
      attack(state, me, uid, { type: 'creature', uid: trade.uid });
      return `${c.name} trades into ${trade.name}.`;
    }
    if (canHitFace) {
      attack(state, me, uid, { type: 'duelist' });
      return `${c.name} strikes you directly.`;
    }
    // Blocked by Guard or a full field: smash the toughest target available.
    const any = foe.field.map((u) => state.cards.get(u)).sort((a, b) => b.health - a.health)[0];
    if (any) {
      attack(state, me, uid, { type: 'creature', uid: any.uid });
      return `${c.name} crashes into ${any.name}.`;
    }
  }
  return null;
}
