// ui.js — rendering and mouse play for Arcane Duel. Draws the engine state
// from game.js as DOM cards on a felt table: enemy portrait and hand of card
// backs up top, both fields in the middle, your hand fanned along the
// bottom, life / mana / turn always visible. Click a hand card to play it,
// click one of your ready creatures then an enemy target to attack.

import {
  attack as engineAttack,
  canAttack,
  canPlay,
  createGame,
  legalAttackTargets,
  logLine,
  playCard,
  setupGiveCard,
  setupSummon,
  spellNeedsTarget,
  startTurn,
} from './game.js';
import { aiStep } from './ai.js';
import { seededRng } from './cards.js';
import { sfxHit, sfxLose, sfxPlay, sfxWin } from './sound.js';

const $ = (id) => document.getElementById(id);

let state = null;
let selectedHandUid = null; // hand card chosen, waiting for a target
let selectedAttackerUid = null; // field creature chosen, waiting for a target
let busy = false; // AI is moving

export function boot() {
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen');
  const seed = Number(params.get('seed') || 7);
  state = createGame(seededRng(seed));
  wireButtons();
  if (screen === 'table' || screen === 'win' || screen === 'loss') {
    stageTable(state);
    if (screen === 'win') stageEnd(state, true);
    if (screen === 'loss') stageEnd(state, false);
    document.body.classList.add('no-anim');
  }
  render();
}

function wireButtons() {
  $('start-btn').addEventListener('click', () => {
    state.phase = 'play';
    startTurn(state, 'player');
    logLine(state, 'The duel begins. Your move.');
    sfxPlay();
    render();
  });
  $('again-btn').addEventListener('click', () => location.reload());
  $('again-btn-2').addEventListener('click', () => location.reload());
  $('end-turn-btn').addEventListener('click', onEndTurn);
  $('enemy-portrait').addEventListener('click', onEnemyPortraitClick);
}

// --- Staged states for screenshots ---------------------------------------

function stageTable(s) {
  s.phase = 'play';
  s.turn = 7;
  s.active = 'player';
  s.player.maxMana = 7;
  s.player.mana = 6;
  s.enemy.maxMana = 7;
  s.enemy.mana = 0;
  s.player.life = 9;
  s.enemy.life = 7;
  s.player.hand = [];
  s.enemy.hand = [];
  setupGiveCard(s, s.player, 'meteor');
  setupGiveCard(s, s.player, 'storm-drake');
  setupGiveCard(s, s.player, 'firebolt');
  setupGiveCard(s, s.player, 'tide-serpent');
  setupGiveCard(s, s.player, 'healing-light');
  setupGiveCard(s, s.enemy, 'ember-imp');
  setupGiveCard(s, s.enemy, 'rune-knight');
  setupGiveCard(s, s.enemy, 'frost-shard');
  setupSummon(s, s.player, 'flame-phoenix');
  const golem = setupSummon(s, s.player, 'stone-golem');
  golem.health = 4;
  setupSummon(s, s.player, 'moon-archer');
  setupSummon(s, s.enemy, 'void-reaper');
  const sentinel = setupSummon(s, s.enemy, 'iron-sentinel');
  sentinel.health = 3;
  setupSummon(s, s.enemy, 'shadow-assassin', false);
  logLine(s, 'Malachar summons the Void Reaper.');
  logLine(s, 'Your Flame Phoenix scorches his Iron Sentinel.');
  logLine(s, 'Your Stone Golem holds the line, battered but standing.');
  logLine(s, 'Turn 7 — your move.');
}

function stageEnd(s, won) {
  if (won) {
    s.enemy.life = 0;
    s.phase = 'won';
  } else {
    s.player.life = 0;
    s.phase = 'lost';
  }
}

// --- Turn flow -------------------------------------------------------------

function onEndTurn() {
  if (busy || state.phase !== 'play' || state.active !== 'player') return;
  selectedHandUid = null;
  selectedAttackerUid = null;
  busy = true;
  startTurn(state, 'enemy');
  logLine(state, 'Malachar ponders…');
  render();
  const step = () => {
    if (state.phase !== 'play') return finishAiTurn();
    const did = aiStep(state);
    if (did) {
      sfxHit();
      render();
      if (state.phase !== 'play') return finishAiTurn();
      setTimeout(step, 650);
    } else {
      finishAiTurn();
    }
  };
  setTimeout(step, 650);
}

function finishAiTurn() {
  busy = false;
  if (state.phase === 'play') {
    startTurn(state, 'player');
    logLine(state, `Turn ${state.turn} — your move.`);
  }
  render();
  announceEnd();
}

function announceEnd() {
  if (state.phase === 'won') sfxWin();
  if (state.phase === 'lost') sfxLose();
}

// --- Player actions ----------------------------------------------------------

function onHandCardClick(uid) {
  if (busy || state.phase !== 'play' || state.active !== 'player') return;
  const inst = state.cards.get(uid);
  if (!inst || !canPlay(state, state.player, inst)) {
    shake(uid);
    return;
  }
  selectedAttackerUid = null;
  if (spellNeedsTarget(inst)) {
    selectedHandUid = selectedHandUid === uid ? null : uid;
    render();
    return;
  }
  if (playCard(state, state.player, uid, null)) sfxPlay();
  selectedHandUid = null;
  render();
  announceEnd();
}

function onOwnCreatureClick(uid) {
  if (busy || state.phase !== 'play' || state.active !== 'player') return;
  const inst = state.cards.get(uid);
  if (selectedHandUid) {
    // A targeted spell may hit your own creature (Frost Shard can).
    castSelectedSpell({ type: 'creature', uid });
    return;
  }
  if (inst && canAttack(state, state.player, inst)) {
    selectedAttackerUid = selectedAttackerUid === uid ? null : uid;
    render();
  }
}

function onEnemyCreatureClick(uid) {
  if (busy || state.phase !== 'play' || state.active !== 'player') return;
  if (selectedHandUid) return castSelectedSpell({ type: 'creature', uid });
  if (selectedAttackerUid) {
    if (engineAttack(state, state.player, selectedAttackerUid, { type: 'creature', uid })) sfxHit();
    selectedAttackerUid = null;
    render();
    announceEnd();
  }
}

function onEnemyPortraitClick() {
  if (busy || state.phase !== 'play' || state.active !== 'player') return;
  if (selectedHandUid) {
    const inst = state.cards.get(selectedHandUid);
    if (inst.spell?.type === 'damage-any') return castSelectedSpell({ type: 'duelist' });
    return;
  }
  if (selectedAttackerUid) {
    const legal = legalAttackTargets(state, state.player);
    if (legal.some((t) => t.type === 'duelist')) {
      if (engineAttack(state, state.player, selectedAttackerUid, { type: 'duelist' })) sfxHit();
      selectedAttackerUid = null;
      render();
      announceEnd();
    } else {
      shake(selectedAttackerUid);
    }
  }
}

function castSelectedSpell(target) {
  const uid = selectedHandUid;
  if (playCard(state, state.player, uid, target)) sfxPlay();
  selectedHandUid = null;
  render();
  announceEnd();
}

function shake(uid) {
  const el = document.querySelector(`[data-uid="${uid}"]`);
  if (el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
}

// --- Rendering ---------------------------------------------------------------

function render() {
  renderPortraits();
  renderHand($('enemy-hand'), state.enemy, true);
  renderField($('enemy-field'), state.enemy);
  renderField($('player-field'), state.player);
  renderHand($('player-hand'), state.player, false);
  $('log').innerHTML = state.log.map((l) => `<div>${l}</div>`).join('');
  $('turn-label').textContent =
    state.phase === 'play' ? `Turn ${Math.max(1, state.turn)} · ${state.active === 'player' ? 'Your move' : 'Malachar is moving…'}` : '';
  $('end-turn-btn').disabled = busy || state.phase !== 'play' || state.active !== 'player';
  $('title-screen').classList.toggle('hidden', state.phase !== 'title');
  $('win-screen').classList.toggle('hidden', state.phase !== 'won');
  $('loss-screen').classList.toggle('hidden', state.phase !== 'lost');
  $('hint').textContent = hintText();
}

function hintText() {
  if (state.phase !== 'play' || state.active !== 'player') return '';
  if (selectedHandUid) return 'Choose a target for your spell — click a creature or the enemy portrait.';
  if (selectedAttackerUid) return 'Choose a target to attack — an enemy creature, or Malachar if no Guard blocks you.';
  return 'Click a card to play it. Click a ready creature, then a target, to attack.';
}

function renderPortraits() {
  $('enemy-life').textContent = Math.max(0, state.enemy.life);
  $('player-life').textContent = Math.max(0, state.player.life);
  $('player-mana').textContent = `${state.player.mana}/${state.player.maxMana}`;
  $('enemy-mana').textContent = `${state.enemy.mana}/${state.enemy.maxMana}`;
  $('player-deck').textContent = state.player.deck.length;
  $('enemy-deck').textContent = state.enemy.deck.length;
  $('enemy-portrait').classList.toggle('targetable', !!selectedHandUid || !!selectedAttackerUid);
}

function cardEl(inst, owner) {
  const el = document.createElement('div');
  el.className = `card rarity-${inst.rarity} school-${inst.school}`;
  el.dataset.uid = inst.uid;
  el.innerHTML = `
    <div class="card-cost">${inst.cost}</div>
    <div class="card-glyph">${inst.glyph}</div>
    <div class="card-name">${inst.name}</div>
    <div class="card-text">${inst.text}</div>
    ${inst.kind === 'creature' ? `<div class="card-stats"><span class="atk">${inst.attack} ATK</span>${inst.guard ? '<span class="guard-badge">GUARD</span>' : ''}<span class="hp">${inst.health} HP</span></div>` : '<div class="card-stats"><span class="spell-badge">SPELL</span></div>'}`;
  if (owner === 'hand') {
    if (canPlay(state, state.player, inst) && state.active === 'player' && state.phase === 'play') el.classList.add('playable');
    if (inst.uid === selectedHandUid) el.classList.add('selected');
    el.addEventListener('click', () => onHandCardClick(inst.uid));
  } else if (owner === 'player-field') {
    if (inst.sick) el.classList.add('sick');
    if (canAttack(state, state.player, inst) && state.active === 'player') el.classList.add('ready');
    if (inst.uid === selectedAttackerUid) el.classList.add('selected');
    el.addEventListener('click', () => onOwnCreatureClick(inst.uid));
  } else if (owner === 'enemy-field') {
    if (inst.sick) el.classList.add('sick');
    if (selectedHandUid || selectedAttackerUid) el.classList.add('targetable');
    el.addEventListener('click', () => onEnemyCreatureClick(inst.uid));
  }
  return el;
}

function renderField(container, duelist) {
  container.innerHTML = '';
  for (const uid of duelist.field) {
    container.appendChild(cardEl(state.cards.get(uid), duelist.isPlayer ? 'player-field' : 'enemy-field'));
  }
  if (duelist.field.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'field-empty';
    empty.textContent = 'No creatures';
    container.appendChild(empty);
  }
}

function renderHand(container, duelist, isEnemy) {
  container.innerHTML = '';
  if (isEnemy) {
    for (let i = 0; i < duelist.hand.length; i++) {
      const back = document.createElement('div');
      back.className = 'card card-back';
      back.innerHTML = '<div class="card-glyph">✶</div><div class="card-name">Arcane Duel</div>';
      container.appendChild(back);
    }
    return;
  }
  for (const uid of duelist.hand) container.appendChild(cardEl(state.cards.get(uid), 'hand'));
}
