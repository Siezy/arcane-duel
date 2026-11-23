// sound.js — tiny WebAudio bleeps generated in code. No audio files, no
// network: three little oscillator blips for play, hit and victory.

let ctx = null;

function tone(freq, dur, type = 'sine', gain = 0.05, when = 0) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    // Audio is decoration; a silent game is still a game.
  }
}

export function sfxPlay() {
  tone(520, 0.09, 'triangle');
  tone(780, 0.1, 'triangle', 0.04, 0.05);
}

export function sfxHit() {
  tone(140, 0.14, 'sawtooth', 0.06);
  tone(90, 0.16, 'square', 0.04, 0.03);
}

export function sfxWin() {
  tone(523, 0.14, 'triangle');
  tone(659, 0.14, 'triangle', 0.05, 0.12);
  tone(784, 0.22, 'triangle', 0.05, 0.24);
}

export function sfxLose() {
  tone(392, 0.18, 'triangle');
  tone(330, 0.18, 'triangle', 0.05, 0.15);
  tone(262, 0.3, 'triangle', 0.05, 0.3);
}
