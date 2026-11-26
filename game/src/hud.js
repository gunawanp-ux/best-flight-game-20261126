// Awan Courier — hud.js. All instruments and screens are drawn on a 2D
// overlay canvas: compass, speed + altitude tapes, attitude indicator,
// throttle and hull bars, score, timer, ring counter, messages, and the
// title / pause / level-complete / game-over / mission-complete screens.
import { GAME_NAME, GAME_SUBTITLE, GAME_TAGLINE } from './config.js';

function fmt(n, pad = 0) {
  return String(Math.max(0, Math.round(n))).padStart(pad, '0');
}

function headingLabel(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export class HUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.messages = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  }

  pushMessage(text, color = '#ffffff') {
    this.messages.push({ text, color, t: 0 });
    if (this.messages.length > 4) this.messages.shift();
  }

  clearMessages() {
    this.messages = [];
  }

  draw(state, dt) {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < 3.2);
    if (state.screen === 'title') return this.drawTitle(state);
    if (state.screen === 'paused') {
      this.drawFlight(state);
      return this.drawPaused();
    }
    if (state.screen === 'levelComplete') return this.drawLevelComplete(state);
    if (state.screen === 'gameOver') return this.drawGameOver(state);
    if (state.screen === 'missionComplete') return this.drawMissionComplete(state);
    this.drawFlight(state);
  }

  // ---- shared bits ----
  panel(ctx, x, y, pw, ph, alpha = 0.62) {
    ctx.save();
    ctx.fillStyle = `rgba(8, 22, 34, ${alpha})`;
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(90, 200, 255, 0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  text(ctx, str, x, y, size, color, align = 'left', weight = 700, font = 'system-ui, sans-serif') {
    ctx.save();
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 4;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // ---- flight instruments ----
  drawFlight(s) {
    const ctx = this.ctx;
    const { w, h } = this;
    const kmh = Math.round(s.speed * 3.6);
    const headingDeg = ((s.heading * 180) / Math.PI % 360 + 360) % 360;

    // Top-left: level, score, rings, combo.
    this.panel(ctx, 14, 14, 250, 96);
    this.text(ctx, `${s.levelName} — Level ${s.levelIndex + 1}`, 28, 30, 14, '#9fc6dd');
    this.text(ctx, `SCORE  ${fmt(s.score, 5)}`, 28, 58, 21, '#ffffff');
    this.text(ctx, `RINGS  ${s.ringsGot}/${s.ringsTotal}`, 28, 84, 16, '#ffd34d');
    if (s.combo > 1) this.text(ctx, `COMBO ×${s.combo}`, 178, 84, 16, '#ff9a3d');

    // Top-right: timer + hull.
    this.panel(ctx, w - 214, 14, 200, 96);
    const timeColor = s.timeLeft < 30 ? '#ff5a4d' : '#ffffff';
    this.text(ctx, `TIME  ${fmt(s.timeLeft / 60)}:${fmt(s.timeLeft % 60, 2)}`, w - 28, 34, 22, timeColor, 'right');
    this.text(ctx, 'HULL', w - 198, 62, 13, '#9fc6dd');
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(w - 198, 74, 168, 10);
    ctx.fillStyle = s.hull > 50 ? '#37d67a' : s.hull > 25 ? '#ffb02e' : '#ff5a4d';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(w - 198, 74, 168 * (s.hull / 100), 10);
    ctx.restore();

    // Compass strip, top centre.
    const cx = w / 2;
    this.panel(ctx, cx - 190, 14, 380, 64);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 190, 14, 380, 64);
    ctx.clip();
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(headingDeg + d);
      const x = cx + d * 3;
      const major = ((deg % 45) + 45) % 45 === 0;
      ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 36);
      ctx.lineTo(x, major ? 48 : 43);
      ctx.stroke();
      if (major) this.text(ctx, headingLabel(deg), x, 58, 12, '#cfe8f5', 'center');
    }
    ctx.restore();
    this.text(ctx, `${fmt(headingDeg, 3)}°`, cx, 27, 13, '#ffd34d', 'center');
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(cx - 6, 70);
    ctx.lineTo(cx + 6, 70);
    ctx.lineTo(cx, 76);
    ctx.closePath();
    ctx.fill();

    // Speed tape (left) and altitude tape (right).
    this.tape(ctx, 30, h / 2 - 110, 92, 220, kmh, 10, 'km/h', 260, 20);
    this.tape(ctx, w - 122, h / 2 - 110, 92, 220, Math.round(s.altitude), 25, 'm', 900, 50);

    // Attitude indicator, bottom-left.
    this.attitude(ctx, 108, h - 108, 82, s.pitch, s.roll);

    // Throttle bar, bottom-right.
    this.panel(ctx, w - 214, h - 64, 200, 50);
    this.text(ctx, 'THROTTLE', w - 198, h - 46, 12, '#9fc6dd');
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(w - 198, h - 34, 168, 9);
    ctx.fillStyle = s.boost ? '#ff9a3d' : '#37c8e8';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(w - 198, h - 34, 168 * s.throttle, 9);
    ctx.restore();
    this.text(ctx, s.boost ? 'BOOST' : `${Math.round(s.throttle * 100)}%`, w - 28, h - 46, 12, '#ffffff', 'right');

    // Next-target pointer: distance + a steering arrow.
    if (s.target) {
      const label = s.target.kind === 'runway' ? 'RUNWAY' : `RING ${s.target.index + 1}`;
      this.text(ctx, `${label}  ${fmt(s.target.dist)} m`, cx, 100, 20, '#ffd34d', 'center');
      const ax = cx;
      const ay = 134;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(s.target.angle);
      ctx.fillStyle = '#ffd34d';
      ctx.shadowColor = '#ffd34d';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(11, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (s.landingHint) {
      this.text(ctx, s.landingHint, cx, h - 200, 22, '#7dff9e', 'center');
    }

    // Centred messages.
    let my = h * 0.3;
    for (const m of this.messages) {
      const a = Math.max(0, 1 - Math.max(0, m.t - 2.2));
      ctx.save();
      ctx.globalAlpha = a;
      this.text(ctx, m.text, cx, my, 30, m.color, 'center');
      ctx.restore();
      my += 42;
    }

    // Low-altitude / stall warnings.
    if (s.altitude < 12 && s.screen === 'playing') {
      this.text(ctx, '⚠ PULL UP — TERRAIN', cx, h - 240, 24, '#ff5a4d', 'center');
    }
    // Controls reminder, small, bottom centre.
    this.text(ctx, '← → bank   ↑ ↓ pitch   SHIFT throttle   P pause   R restart', cx, h - 18, 13, 'rgba(255,255,255,0.75)', 'center');
  }

  tape(ctx, x, y, tw, th, value, step, unit, max, tickStep) {
    this.panel(ctx, x, y, tw, th);
    const cy = y + th / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, tw, th);
    ctx.clip();
    const span = (th / 2 / 34) * step;
    for (let v = Math.floor((value - span) / tickStep) * tickStep; v <= value + span; v += tickStep) {
      const dy = cy - ((v - value) / step) * 34;
      if (dy < y + 6 || dy > y + th - 6) continue;
      const major = v % (tickStep * 5) === 0;
      ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x + tw - 18, dy);
      ctx.lineTo(x + tw - 6, dy);
      ctx.stroke();
      if (major) this.text(ctx, String(v), x + tw - 24, dy, 12, '#cfe8f5', 'right');
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(20, 60, 90, 0.95)';
    ctx.strokeStyle = '#8cdcff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#5ac8ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(x + 4, cy - 17, tw - 8, 34, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    this.text(ctx, String(Math.round(value)), x + tw / 2, cy, 19, '#ffffff', 'center');
    this.text(ctx, unit, x + tw / 2, y + th - 12, 11, '#9fc6dd', 'center');
  }

  attitude(ctx, cx, cy, r, pitch, roll) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const horizonY = pitch * r * 1.6;
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r + horizonY, r * 2, r - horizonY + r);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-r, horizonY, r * 2, r * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, horizonY);
    ctx.lineTo(r, horizonY);
    ctx.stroke();
    for (const dp of [-0.3, -0.15, 0.15, 0.3]) {
      const ly = horizonY - dp * r * 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, ly);
      ctx.lineTo(r * 0.35, ly);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#5ac8ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed aircraft symbol.
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.lineTo(cx, cy - 6);
    ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.lineTo(cx + 10, cy + 5);
    ctx.lineTo(cx - 10, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.text(ctx, 'ATTITUDE', cx, cy + r + 16, 11, '#9fc6dd', 'center');
  }

  wrapText(ctx, str, x, y, maxWidth, size, color, lineHeight = 22) {
    ctx.save();
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.forEach((ln, i) => this.text(ctx, ln, x, y + i * lineHeight, size, color, 'center'));
    ctx.restore();
    return lines.length;
  }

  // ---- screens ----
  screenShell(state, title, accent) {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.fillStyle = 'rgba(6, 18, 30, 0.45)';
    ctx.fillRect(0, 0, w, h);
    this.panel(ctx, w / 2 - 330, h / 2 - 190, 660, 380, 0.82);
    ctx.save();
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.fillRect(w / 2 - 330, h / 2 - 190, 660, 5);
    ctx.restore();
    this.text(ctx, title, w / 2, h / 2 - 140, 44, '#ffffff', 'center');
  }

  drawTitle(s) {
    const ctx = this.ctx;
    const { w, h } = this;
    this.screenShell(s, GAME_NAME, '#37c8e8');
    this.text(ctx, GAME_SUBTITLE, w / 2, h / 2 - 100, 24, '#ffd34d', 'center');
    this.text(ctx, GAME_TAGLINE, w / 2, h / 2 - 62, 17, '#cfe8f5', 'center');
    this.text(ctx, `Level ${s.levelIndex + 1} of 3 — ${s.levelName}`, w / 2, h / 2 - 26, 18, '#ffffff', 'center');
    this.wrapText(ctx, s.briefing, w / 2, h / 2 + 4, 600, 15, '#9fc6dd');
    const lines = [
      '← →  or  A / D — bank and turn',
      '↑ ↓  or  W / S — climb and dive   •   mouse steers too',
      'SHIFT — throttle up   •   hold CLICK — boost',
      'Fly through every golden ring, then land on the runway.',
      'Storm clouds hurt. Mountains hurt more. Mind the clock.',
    ];
    lines.forEach((line, i) => this.text(ctx, line, w / 2, h / 2 + 46 + i * 24, 15, '#eaf6ff', 'center'));
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.save();
    ctx.globalAlpha = pulse;
    this.text(ctx, '▶  CLICK or press ENTER to fly', w / 2, h / 2 + 168, 20, '#ffd34d', 'center');
    ctx.restore();
  }

  drawPaused() {
    const ctx = this.ctx;
    const { w, h } = this;
    this.text(ctx, 'PAUSED', w / 2, h / 2 - 20, 44, '#ffffff', 'center');
    this.text(ctx, 'Press P or ENTER to keep flying  •  R to restart', w / 2, h / 2 + 30, 17, '#cfe8f5', 'center');
  }

  drawLevelComplete(s) {
    const ctx = this.ctx;
    const { w, h } = this;
    this.screenShell(s, 'LANDED — LEVEL CLEAR', '#37d67a');
    this.text(ctx, `${s.levelName} complete`, w / 2, h / 2 - 100, 22, '#7dff9e', 'center');
    this.text(ctx, `Rings ${s.ringsGot}/${s.ringsTotal}   •   Time bonus +${s.levelBonus}`, w / 2, h / 2 - 58, 18, '#ffffff', 'center');
    this.text(ctx, `Score  ${fmt(s.score, 5)}`, w / 2, h / 2 - 18, 26, '#ffd34d', 'center');
    this.text(ctx, s.levelIndex + 1 < 3 ? 'Next island: ' + s.nextLevelName : 'That was the last island!', w / 2, h / 2 + 26, 17, '#cfe8f5', 'center');
    this.text(ctx, 'Press ENTER to continue', w / 2, h / 2 + 76, 18, '#ffd34d', 'center');
  }

  drawGameOver(s) {
    const ctx = this.ctx;
    const { w, h } = this;
    this.screenShell(s, s.gameOverTitle, '#ff5a4d');
    this.text(ctx, s.gameOverLine, w / 2, h / 2 - 100, 20, '#ffb3ad', 'center');
    this.text(ctx, `Rings ${s.ringsGot}/${s.ringsTotal}   •   Score ${fmt(s.score, 5)}`, w / 2, h / 2 - 58, 18, '#ffffff', 'center');
    this.text(ctx, `Best score ${fmt(s.bestScore, 5)}`, w / 2, h / 2 - 18, 17, '#cfe8f5', 'center');
    this.text(ctx, 'Press R or ENTER to fly again', w / 2, h / 2 + 66, 18, '#ffd34d', 'center');
  }

  drawMissionComplete(s) {
    const ctx = this.ctx;
    const { w, h } = this;
    this.screenShell(s, 'MISSION COMPLETE', '#ffd34d');
    this.text(ctx, 'All three islands flown. The mail got through!', w / 2, h / 2 - 100, 20, '#7dff9e', 'center');
    this.text(ctx, `Final score  ${fmt(s.score, 5)}`, w / 2, h / 2 - 52, 30, '#ffd34d', 'center');
    this.text(ctx, `Rings ${s.ringsGot}/${s.ringsTotal}   •   Hull ${Math.round(s.hull)}% left`, w / 2, h / 2 - 8, 18, '#ffffff', 'center');
    this.text(ctx, 'Press R or ENTER to fly the run again', w / 2, h / 2 + 66, 18, '#ffd34d', 'center');
  }
}
