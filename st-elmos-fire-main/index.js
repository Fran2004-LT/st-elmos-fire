// index.js — St. Elmo's Fire v7.0
// Bundle system, Canvas cards, Profile system
// CSPRNG: crypto.randomInt() | Storage: SQLite

import {
  Client, GatewayIntentBits, EmbedBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} from 'discord.js';
import { randomInt } from 'crypto';
import Database from 'better-sqlite3';
import 'dotenv/config';
import { createCanvas, registerFont } from 'canvas';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ══════════════════════════════════════════════
//  FONT
// ══════════════════════════════════════════════
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(__dirname, 'assets', 'fonts', 'NotoSans-Regular.ttf');
if (existsSync(FONT_PATH)) {
  registerFont(FONT_PATH, { family: 'NotoSans' });
  console.log('Font loaded: NotoSans');
} else {
  console.log('Font not found, using fallback');
}
// ลอง load NotoSansThai ด้วย
const FONT_PATH_THAI = join(__dirname, 'assets', 'fonts', 'NotoSansThai-Regular.ttf');
if (existsSync(FONT_PATH_THAI)) {
  registerFont(FONT_PATH_THAI, { family: 'NotoSansThai' });
  console.log('Font loaded: NotoSansThai');
}
// Register NotoColorEmoji สำหรับ emoji
const EMOJI_FONT_PATHS = [
  '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
  '/usr/share/fonts/noto/NotoColorEmoji.ttf',
  '/usr/share/fonts/truetype/NotoColorEmoji.ttf',
];
let emojiLoaded = false;
for (const ep of EMOJI_FONT_PATHS) {
  if (existsSync(ep)) {
    try { registerFont(ep, { family: 'NotoColorEmoji' }); emojiLoaded = true; console.log('Font loaded: NotoColorEmoji'); break; } catch(e) {}
  }
}
const BASE_FONT = existsSync(FONT_PATH_THAI) ? 'NotoSansThai' : (existsSync(FONT_PATH) ? 'NotoSans' : 'sans-serif');
const CANVAS_FONT = BASE_FONT;

// ══════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════
const PREFIX        = '!r';
const TAX           = 0.03;
const WIN_CAP       = 30000;
const POOL_CAP      = 30000;
const JACKPOT_MULT  = 10;
const POOL_CONTRIB  = 0.05;
const STARTING_GOLD = 1500;
const EXCHANGE_RATE = 3;
const STAFF_ROLE    = 'Staff';
const OWNER_ID      = process.env.OWNER_ID || '';
const BOTNAME       = "St. Elmo's Fire";
const BUNDLE_PRICE  = 2500; // RC
const MIN_BET       = 100;  // ขั้นต่ำทุกเกมพนัน

const DAILY_REWARDS = [
  { type: 'gold', amount: 200 },
  { type: 'gold', amount: 400 },
  { type: 'gold', amount: 600 },
  { type: 'gold', amount: 800 },
  { type: 'gold', amount: 1000 },
  { type: 'rc',   amount: 50 },
  { type: 'item',  item: 'reroll', amount: 1 },
];
const DAILY_LABELS = ['🪙 200 Gold','🪙 400 Gold','🪙 600 Gold','🪙 800 Gold','🪙 1,000 Gold','🌈 50 RC','🎲 Re-roll x1'];

// ══════════════════════════════════════════════
//  BUNDLE DATA
// ══════════════════════════════════════════════

// Special bundles (แจก — ไม่ขาย)
const SPECIAL_BUNDLES = {
  make_a_debut: {
    name: 'Make a Debut',
    type: 'special',
    emblemColor: '#F9A8C9',  // ชมพูอ่อน
    bgType: 'debut',         // white + horseshoe pattern
    isSpecial: true,
  },
  beyond_the_dream: {
    name: 'Beyond the Dream',
    type: 'special',
    emblemColor: '#C9A8E8',  // ม่วงอ่อน
    bgType: 'beyond',        // dark + star particles
    isSpecial: true,
  },
  the_road_to_glory: {
    name: 'The Road to Glory',
    type: 'special',
    emblemColor: '#D4AF37',  // ทอง
    bgType: 'glory',         // dark gold + G1 watermark + diagonal lines
    isSpecial: true,
    g1: true,
  },
};

// Gallop collection (ขาย — 2,500 RC)
const GALLOP_BUNDLES = {
  he_who_commands: {
    name: 'He Who Commands the Era',
    collection: 'gallop',
    emblemColor: '#FFD700',
    bgType: 'gallop_deep',   // dark + diamond pattern เหลือง+น้ำเงิน
    colors: ['#FFD700', '#1a3ab8', '#111111'],
    horse: 'Deep Impact',
  },
  coronation_of_emperor: {
    name: 'Coronation of Emperor',
    collection: 'gallop',
    emblemColor: '#1a6e2e',
    bgType: 'gallop_rudolf', // dark green + ornate
    colors: ['#1a6e2e', '#ffffff', '#cc2222'],
    horse: 'Symboli Rudolf',
  },
  the_all_rounder: {
    name: 'The All Rounder',
    collection: 'gallop',
    emblemColor: '#FF8C69',
    bgType: 'gallop_agnes',  // dark + tri-color blocks
    colors: ['#FFD700', '#56CCF2', '#EB5757'],
    horse: 'Agnes Digital',
  },
  la_noblesse: {
    name: 'La Noblesse',
    collection: 'gallop',
    emblemColor: '#20B2AA',
    bgType: 'gallop_mejiro', // ivory + vine pattern
    colors: ['#1a6e2e', '#ffffff', '#5c3317'],
    horse: 'Mejiro Ramon',
  },
  the_rising_son: {
    name: 'The Rising Son',
    collection: 'gallop',
    emblemColor: '#EB5757',
    bgType: 'gallop_dura',   // dark + cross motif แดง
    colors: ['#FFD700', '#EB5757', '#111111'],
    horse: 'Duramente',
  },
  the_mighty_one: {
    name: 'The Mighty One',
    collection: 'gallop',
    emblemColor: '#56CCF2',
    bgType: 'gallop_almond', // dark sky blue + dot pattern
    colors: ['#56CCF2', '#EB5757', '#C8A951'],
    horse: 'Almond Eye',
  },
};

const ALL_BUNDLES = { ...SPECIAL_BUNDLES, ...GALLOP_BUNDLES };

function getBundle(key) {
  return ALL_BUNDLES[key] || null;
}

// ══════════════════════════════════════════════
//  DATABASE
// ══════════════════════════════════════════════
const db = new Database(process.env.DB_PATH || 'elmos.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    user_id         TEXT PRIMARY KEY,
    gold            INTEGER DEFAULT ${STARTING_GOLD},
    rc              INTEGER DEFAULT 0,
    win_today       INTEGER DEFAULT 0,
    last_win_reset  TEXT DEFAULT '',
    streak          INTEGER DEFAULT 0,
    last_daily      TEXT DEFAULT '',
    inv_reroll      INTEGER DEFAULT 0,
  race_reroll     INTEGER DEFAULT 1,
  race_safe       INTEGER DEFAULT 0,
  race_reroll_max INTEGER DEFAULT 1,
    equipped_bundle TEXT DEFAULT 'default'
  );

  CREATE TABLE IF NOT EXISTS owned_bundles (
    user_id   TEXT,
    bundle_id TEXT,
    PRIMARY KEY (user_id, bundle_id)
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id       TEXT PRIMARY KEY,
    char_name     TEXT DEFAULT '',
    team_name     TEXT DEFAULT '',
    trainer_name  TEXT DEFAULT '',
    showcase_1_race TEXT DEFAULT '',
    showcase_1_rank TEXT DEFAULT '',
    showcase_1_grade TEXT DEFAULT '',
    showcase_1_year TEXT DEFAULT '',
    showcase_2_race TEXT DEFAULT '',
    showcase_2_rank TEXT DEFAULT '',
    showcase_2_grade TEXT DEFAULT '',
    showcase_2_year TEXT DEFAULT '',
    showcase_3_race TEXT DEFAULT '',
    showcase_3_rank TEXT DEFAULT '',
    showcase_3_grade TEXT DEFAULT '',
    showcase_3_year TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS jackpot (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    pool  INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO jackpot (id, pool) VALUES (1, 0);
`);

// Migration จาก v5 → v6
const migrations = [
  // เพิ่ม equipped_bundle ถ้ายังไม่มี
  "ALTER TABLE players ADD COLUMN equipped_bundle TEXT DEFAULT 'default'",
  "ALTER TABLE players ADD COLUMN race_reroll INTEGER DEFAULT 1",
  "ALTER TABLE players ADD COLUMN race_safe INTEGER DEFAULT 0",
  "ALTER TABLE players ADD COLUMN race_reroll_max INTEGER DEFAULT 1",
  // ลบ column เก่าทำไม่ได้ใน SQLite แต่จะ ignore ใน code
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column exists already */ }
}

function getDayKey() {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (ict.getUTCHours() < 4) ict.setUTCDate(ict.getUTCDate() - 1);
  return ict.toISOString().slice(0, 10);
}

function getPlayer(userId) {
  let p = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  if (!p) {
    // ใส่ make_a_debut ให้ผู้เล่นใหม่ทันที
    db.prepare('INSERT INTO players (user_id, equipped_bundle) VALUES (?, ?)').run(userId, 'make_a_debut');
    db.prepare('INSERT OR IGNORE INTO owned_bundles (user_id, bundle_id) VALUES (?, ?)').run(userId, 'make_a_debut');
    p = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  }
  const today = getDayKey();
  if (p.last_win_reset !== today) {
    db.prepare('UPDATE players SET win_today = 0, last_win_reset = ? WHERE user_id = ?').run(today, userId);
    p.win_today = 0;
  }
  return p;
}

function updatePlayer(userId, fields) {
  const keys = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE players SET ${keys} WHERE user_id = ?`).run(...Object.values(fields), userId);
}

function getPool() { return db.prepare('SELECT pool FROM jackpot WHERE id = 1').get().pool; }
function setPool(val) { db.prepare('UPDATE jackpot SET pool = ? WHERE id = 1').run(Math.min(Math.max(0, val), POOL_CAP)); }

function getOwnedBundles(userId) {
  return db.prepare('SELECT bundle_id FROM owned_bundles WHERE user_id = ?').all(userId).map(r => r.bundle_id);
}

function addBundle(userId, bundleId) {
  db.prepare('INSERT OR IGNORE INTO owned_bundles (user_id, bundle_id) VALUES (?, ?)').run(userId, bundleId);
}

function getProfile(userId) {
  let p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!p) {
    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
    p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  }
  return p;
}

// ══════════════════════════════════════════════
//  CSPRNG
// ══════════════════════════════════════════════
function rand(min, max) { return randomInt(min, max + 1); }
function randF() { return randomInt(0, 1000000) / 1000000; }

// ══════════════════════════════════════════════
//  ECONOMY
// ══════════════════════════════════════════════
function applyLoss(userId, amount) {
  const p = getPlayer(userId);
  if (p.gold < amount) return { ok: false, reason: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})` };
  updatePlayer(userId, { gold: p.gold - amount });
  return { ok: true, gold: p.gold - amount };
}

function applyWin(userId, betAmount, payoutMult) {
  const p = getPlayer(userId);
  const profit = Math.floor(betAmount * (payoutMult - 1) * (1 - TAX));
  if (p.win_today >= WIN_CAP) {
    updatePlayer(userId, { gold: p.gold + betAmount });
    return { ok: false, reason: `ถึง Win Cap แล้วครับ คืนเงิน ${betAmount.toLocaleString()} Gold`, gold: p.gold + betAmount };
  }
  const capProfit = Math.min(profit, WIN_CAP - p.win_today);
  const finalGain = betAmount + capProfit;
  updatePlayer(userId, { gold: p.gold + finalGain, win_today: p.win_today + capProfit });
  return { ok: true, profit: capProfit, gold: p.gold + finalGain };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE) || member.permissions.has(PermissionFlagsBits.Administrator);
}

// ══════════════════════════════════════════════
//  CANVAS HELPERS
// ══════════════════════════════════════════════
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// วาด background ตาม bgType
function drawBackground(ctx, W, H, bgType, emblemColor) {
  const { r, g, b } = hexToRgb(emblemColor);

  if (bgType === 'debut') {
    // Soft warm grey — ลดความสว่าง อ่านง่ายขึ้น
    ctx.fillStyle = '#2A2830';
    ctx.fillRect(0, 0, W, H);
    // soft pink glow
    const g1 = ctx.createRadialGradient(W*0.15, H*0.4, 0, W*0.15, H*0.4, W*0.6);
    g1.addColorStop(0, 'rgba(249,168,201,0.12)');
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    // soft green glow
    const g2 = ctx.createRadialGradient(W*0.85, H*0.6, 0, W*0.85, H*0.6, W*0.5);
    g2.addColorStop(0, 'rgba(109,213,160,0.08)');
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

  } else if (bgType === 'beyond') {
    // Dark purple
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0D0B16');
    bg.addColorStop(0.5, '#1a1228');
    bg.addColorStop(1, '#0D0B16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow1 = ctx.createRadialGradient(W*0.2, H*0.5, 0, W*0.2, H*0.5, W*0.5);
    glow1.addColorStop(0, 'rgba(155,111,212,0.1)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

  } else if (bgType === 'glory') {
    // Dark gold
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0F0E00');
    bg.addColorStop(0.5, '#1a1800');
    bg.addColorStop(1, '#0A0900');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // diagonal lines
    ctx.strokeStyle = 'rgba(212,175,55,0.025)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
      ctx.stroke();
    }
    const glow1 = ctx.createRadialGradient(W*0.15, H*0.3, 0, W*0.15, H*0.3, W*0.5);
    glow1.addColorStop(0, 'rgba(212,175,55,0.1)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);
    // GI watermark — outline สีทอง (แทน fill จางๆ)
    ctx.save();
    ctx.font = `bold ${H * 0.55}px ${CANVAS_FONT}`;
    ctx.textAlign = 'center';
    // stroke outline ทอง
    ctx.strokeStyle = 'rgba(212,175,55,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeText('GI', W * 0.75, H * 0.72);
    // fill จางมากๆ
    ctx.fillStyle = 'rgba(212,175,55,0.04)';
    ctx.fillText('GI', W * 0.75, H * 0.72);
    ctx.restore();

  } else if (bgType === 'gallop_deep') {
    // Dark + diamond pattern เหลือง+น้ำเงิน
    ctx.fillStyle = '#0A0A14';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,215,0,0.03)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - H, H); ctx.stroke();
    }
    const glow1 = ctx.createRadialGradient(0, H*0.5, 0, 0, H*0.5, W*0.5);
    glow1.addColorStop(0, 'rgba(26,58,184,0.12)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

  } else if (bgType === 'gallop_rudolf') {
    // Dark forest green
    ctx.fillStyle = '#081408';
    ctx.fillRect(0, 0, W, H);
    const glow1 = ctx.createRadialGradient(W*0.2, H*0.3, 0, W*0.2, H*0.3, W*0.5);
    glow1.addColorStop(0, 'rgba(26,110,46,0.12)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

  } else if (bgType === 'gallop_agnes') {
    // Dark + tri-color
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, W, H);
    const glow1 = ctx.createRadialGradient(0, H*0.5, 0, 0, H*0.5, W*0.4);
    glow1.addColorStop(0, 'rgba(255,215,0,0.07)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

  } else if (bgType === 'gallop_mejiro') {
    // Mejiro Ramon: dark base + teal/cyan accent + gold
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0A0E12');
    bg.addColorStop(0.5, '#0D1318');
    bg.addColorStop(1, '#080C0F');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // teal glow top-left
    const gl1 = ctx.createRadialGradient(W*0.1, H*0.2, 0, W*0.1, H*0.2, W*0.5);
    gl1.addColorStop(0, 'rgba(32,178,170,0.12)');
    gl1.addColorStop(1, 'transparent');
    ctx.fillStyle = gl1;
    ctx.fillRect(0, 0, W, H);
    // gold subtle glow right
    const gl2 = ctx.createRadialGradient(W*0.9, H*0.8, 0, W*0.9, H*0.8, W*0.4);
    gl2.addColorStop(0, 'rgba(212,175,55,0.07)');
    gl2.addColorStop(1, 'transparent');
    ctx.fillStyle = gl2;
    ctx.fillRect(0, 0, W, H);
    // subtle diagonal lines
    ctx.strokeStyle = 'rgba(32,178,170,0.03)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }

  } else if (bgType === 'gallop_dura') {
    // Dark + X motif
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);
    const glow1 = ctx.createRadialGradient(W*0.5, H*0.3, 0, W*0.5, H*0.3, W*0.5);
    glow1.addColorStop(0, 'rgba(235,87,87,0.08)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

  } else if (bgType === 'gallop_almond') {
    // Dark sky blue + dot pattern
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#06101A');
    bg.addColorStop(1, '#040C14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // dots
    for (let x = 14; x < W; x += 28) {
      for (let y = 14; y < H; y += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(86,204,242,0.06)';
        ctx.fill();
      }
    }
    const glow1 = ctx.createRadialGradient(W*0.2, H*0.3, 0, W*0.2, H*0.3, W*0.5);
    glow1.addColorStop(0, 'rgba(86,204,242,0.08)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

  } else {
    // Default — dark gray
    ctx.fillStyle = '#1a1a1f';
    ctx.fillRect(0, 0, W, H);
  }
}

// ══════════════════════════════════════════════
//  ROLL CARD GENERATOR
// ══════════════════════════════════════════════
async function generateRollCard(username, expr, grand, breakdown, bundleKey) {
  const W = 572, H = 148;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bundle = getBundle(bundleKey);
  const bgType = bundle ? bundle.bgType : 'default';
  const emblemColor = bundle ? bundle.emblemColor : '#444444';
  const bundleName = bundle ? bundle.name : 'Default';
  const isLight = false; // debut และ mejiro เปลี่ยนเป็น dark แล้ว

  // Background
  drawBackground(ctx, W, H, bgType, emblemColor);

  // Border
  drawRoundRect(ctx, 0.5, 0.5, W-1, H-1, 10);
  const ec = hexToRgb(emblemColor);
  ctx.strokeStyle = `rgba(${ec.r},${ec.g},${ec.b},0.3)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top strip
  const strip = ctx.createLinearGradient(0, 0, W, 0);
  strip.addColorStop(0, emblemColor);
  strip.addColorStop(0.5, '#ffffff');
  strip.addColorStop(1, emblemColor);
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, W, 3);

  // Emblem bar ซ้าย
  if (bgType === 'gallop_mejiro') {
    // La Noblesse: teal emblem bar บน dark background
    ctx.fillStyle = '#20B2AA';
    ctx.fillRect(0, 0, 5, H);
  } else {
    ctx.fillStyle = emblemColor;
    ctx.fillRect(0, 0, 5, H);
  }
  // glow on emblem bar
  const barGlow = ctx.createLinearGradient(0, 0, 12, 0);
  barGlow.addColorStop(0, `rgba(${ec.r},${ec.g},${ec.b},0.2)`);
  barGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = barGlow;
  ctx.fillRect(5, 0, 10, H);

  const textColor = isLight ? '#1a1a1a' : '#ffffff';
  const dimColor = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';
  const dimColor2 = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';

  // Avatar circle
  ctx.fillStyle = emblemColor;
  ctx.beginPath();
  ctx.arc(28, 36, 18, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold 15px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(username.charAt(0).toUpperCase(), 28, 41);
  ctx.textAlign = 'left';

  // Username — บนซ้าย
  ctx.fillStyle = textColor;
  ctx.font = `bold 14px ${CANVAS_FONT}`;
  const maxNameW = W * 0.32;
  let displayName = username;
  while (ctx.measureText(displayName).width > maxNameW && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== username) displayName += '..';
  ctx.fillText(displayName, 54, 28);

  // Bundle name
  ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.7)`;
  ctx.font = `10px ${CANVAS_FONT}`;
  ctx.fillText(bundleName, 54, 44);

  // Expression ใต้ชื่อ
  ctx.fillStyle = dimColor;
  ctx.font = `bold 10px ${CANVAS_FONT}`;
  ctx.fillText(expr, 54, 62);

  // Breakdown ใต้ expr — truncate ถ้ายาว
  ctx.fillStyle = dimColor2;
  ctx.font = `10px ${CANVAS_FONT}`;
  const maxBW = W * 0.52;
  const bLines = [];
  let curLine = '';
  for (const part of breakdown.split(' | ')) {
    const test = curLine ? curLine + '  ' + part : part;
    if (ctx.measureText(test).width > maxBW && curLine) {
      bLines.push(curLine); curLine = part;
    } else { curLine = test; }
  }
  if (curLine) bLines.push(curLine);
  bLines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 54, 80 + i * 18));

  // Divider แนวตั้ง
  ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.25)`;
  ctx.fillRect(W * 0.62, 12, 1, H - 24);

  // Grand total — ขวา vertically centered
  ctx.textAlign = 'right';
  ctx.font = `bold 64px ${CANVAS_FONT}`;
  const totalGrad = ctx.createLinearGradient(0, H*0.1, 0, H*0.9);
  if (bgType === 'gallop_deep') {
    totalGrad.addColorStop(0, '#FFD700');
    totalGrad.addColorStop(1, '#1a3ab8');
  } else if (bgType === 'glory') {
    totalGrad.addColorStop(0, '#FFD700');
    totalGrad.addColorStop(1, '#D4AF37');
  } else {
    totalGrad.addColorStop(0, emblemColor);
    totalGrad.addColorStop(1, '#aaaaaa');
  }
  ctx.fillStyle = totalGrad;
  ctx.fillText(`${grand}`, W - 12, H * 0.72);

  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

// ══════════════════════════════════════════════
//  INVENTORY CARD GENERATOR
// ══════════════════════════════════════════════
async function generateInventoryCard(player, username, page = 1) {
  const W = 560;
  const bundleKey = player.equipped_bundle || 'default';
  const bundle = getBundle(bundleKey);
  const bgType = bundle ? bundle.bgType : 'default';
  const emblemColor = bundle ? bundle.emblemColor : '#444444';
  const bundleName = bundle ? bundle.name : 'Default';
  const isLight = false; // debut และ mejiro เปลี่ยนเป็น dark แล้ว
  const isSpecial = bundle ? bundle.isSpecial : false;
  const H = page === 1 ? (isSpecial ? 420 : 395) : 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const ec = hexToRgb(emblemColor);

  // Background
  drawBackground(ctx, W, H, bgType, emblemColor);

  // Border
  drawRoundRect(ctx, 0.5, 0.5, W-1, H-1, 12);
  ctx.strokeStyle = `rgba(${ec.r},${ec.g},${ec.b},0.3)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top strip
  const strip = ctx.createLinearGradient(0, 0, W, 0);
  strip.addColorStop(0, emblemColor);
  strip.addColorStop(0.5, isLight ? '#aaaaaa' : '#ffffff');
  strip.addColorStop(1, emblemColor);
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, W, 3);

  const textColor = isLight ? '#1a1a1a' : '#f0f0f0';
  const dimColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const dimColor2 = isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)';
  const boxBg = isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.04)';
  const boxBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';

  if (page === 1) {
    // ── HEADER ──
    // Avatar
    ctx.fillStyle = emblemColor;
    const avatarX = 28, avatarY = 28;
    drawRoundRect(ctx, avatarX, avatarY, 40, 40, 8);
    ctx.fill();
    ctx.fillStyle = isLight ? '#1a1200' : '#ffffff';
    ctx.font = `bold 18px ${CANVAS_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(username.charAt(0).toUpperCase(), avatarX + 20, avatarY + 28);
    ctx.textAlign = 'left';

    // Username + badge
    ctx.fillStyle = textColor;
    ctx.font = `bold 15px ${CANVAS_FONT}`;
    ctx.fillText(username, 78, 43);

    // Bundle badge
    const bx = 78, by = 52;
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.12)`;
    drawRoundRect(ctx, bx, by, 180, 16, 8);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ec.r},${ec.g},${ec.b},0.25)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    const badgeTextColor = bgType === 'gallop_mejiro' ? '#20B2AA' : `rgba(${ec.r},${ec.g},${ec.b},0.8)`;
    ctx.fillStyle = badgeTextColor;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText(`✦ ${bundleName}`, bx + 8, by + 11);

    // Streak top right
    const streakColor = bgType === 'gallop_mejiro' ? '#20B2AA' : `rgba(${ec.r},${ec.g},${ec.b},0.9)`;
    ctx.fillStyle = streakColor;
    ctx.font = `bold 13px ${CANVAS_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`STREAK · ${player.streak}`, W - 20, 43);
    ctx.textAlign = 'left';

    // Divider
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.25)`;
    ctx.fillRect(20, 78, W - 40, 1);

    // ── CURRENCY BOXES ──
    const boxY = 90, boxH = 52;
    const goldW = (W - 52) / 2;

    // Gold box
    ctx.fillStyle = isLight ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)';
    drawRoundRect(ctx, 20, boxY, goldW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `22px ${CANVAS_FONT}`;
    ctx.fillText('🪙', 30, boxY + 34);
    ctx.font = `bold 20px ${CANVAS_FONT}`;
    ctx.fillStyle = isLight ? '#B8860B' : '#E8CC80';
    ctx.fillText(player.gold.toLocaleString(), 58, boxY + 30);
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillStyle = dimColor2;
    ctx.fillText('GOLD', 58, boxY + 44);

    // RC box
    const rcX = 20 + goldW + 12;
    ctx.fillStyle = isLight ? 'rgba(100,160,220,0.06)' : 'rgba(100,160,220,0.05)';
    drawRoundRect(ctx, rcX, boxY, goldW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(100,160,220,0.2)' : 'rgba(100,160,220,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `22px ${CANVAS_FONT}`;
    ctx.fillText('🌈', rcX + 10, boxY + 34);
    ctx.font = `bold 20px ${CANVAS_FONT}`;
    ctx.fillStyle = isLight ? '#3A8EC8' : '#90C8FF';
    ctx.fillText(player.rc.toLocaleString(), rcX + 38, boxY + 30);
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillStyle = dimColor2;
    ctx.fillText('RAINBOW COIN', rcX + 38, boxY + 44);

    // ── WIN TODAY BAR ──
    const winY = 152;
    ctx.fillStyle = boxBg;
    drawRoundRect(ctx, 20, winY, W - 40, 34, 8);
    ctx.fill();
    ctx.strokeStyle = boxBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = dimColor2;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText('WIN TODAY', 30, winY + 13);
    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.7)`;
    ctx.fillText(`${player.win_today.toLocaleString()} / ${WIN_CAP.toLocaleString()}`, W - 30, winY + 13);
    ctx.textAlign = 'left';

    const barW = W - 56;
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
    drawRoundRect(ctx, 28, winY + 20, barW, 5, 2);
    ctx.fill();
    const fillW = Math.min(barW, (player.win_today / WIN_CAP) * barW);
    if (fillW > 0) {
      const barGrad = ctx.createLinearGradient(28, 0, 28 + fillW, 0);
      barGrad.addColorStop(0, emblemColor);
      barGrad.addColorStop(1, isLight ? '#888' : '#cccccc');
      ctx.fillStyle = barGrad;
      drawRoundRect(ctx, 28, winY + 20, fillW, 5, 2);
      ctx.fill();
    }

    // ── ECONOMY ITEMS (3 กล่อง) ──
    const itemY = 196;
    const itemW = (W - 52) / 3;
    const ownedBundleCount = db.prepare('SELECT COUNT(*) as cnt FROM owned_bundles WHERE user_id = ?').get(player.user_id)?.cnt || 0;
    const ecoItems = [
      { val: `${player.inv_reroll || 0}`, label: 'RE-ROLL' },
      { val: `${ownedBundleCount}`,        label: 'BUNDLES' },
      { val: `${player.streak}/7`,         label: 'STREAK'  },
    ];
    ecoItems.forEach((item, i) => {
      const ix = 20 + i * (itemW + 6);
      ctx.fillStyle = boxBg;
      drawRoundRect(ctx, ix, itemY, itemW, 46, 8);
      ctx.fill();
      ctx.strokeStyle = boxBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `bold 16px ${CANVAS_FONT}`;
      ctx.fillStyle = textColor;
      ctx.fillText(item.val, ix + 12, itemY + 28);
      ctx.font = `8px ${CANVAS_FONT}`;
      ctx.fillStyle = dimColor2;
      ctx.fillText(item.label, ix + 12, itemY + 40);
    });

    // ── RACE DIVIDER ──
    const raceDivY = itemY + 56;
    ctx.fillStyle = `rgba(239,68,68,0.15)`;
    ctx.fillRect(20, raceDivY, W - 40, 1);
    ctx.font = `8px ${CANVAS_FONT}`;
    ctx.fillStyle = 'rgba(239,68,68,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('RACE', W / 2, raceDivY - 4);
    ctx.textAlign = 'left';

    // ── RACE ITEMS (2 กล่อง) ──
    const raceItemY = raceDivY + 10;
    const raceItemW = (W - 52) / 2;
    const raceItems = [
      { val: `${player.race_reroll ?? 1}`, label: 'RACE REROLL', fillColor: 'rgba(239,68,68,0.08)', strokeColor: 'rgba(239,68,68,0.2)', valColor: '#F87171' },
      { val: `${player.race_safe ?? 0}`,   label: 'RACE SAFE',   fillColor: 'rgba(59,130,246,0.08)', strokeColor: 'rgba(59,130,246,0.2)', valColor: '#60A5FA' },
    ];
    raceItems.forEach((item, i) => {
      const ix = 20 + i * (raceItemW + 12);
      ctx.fillStyle = item.fillColor;
      drawRoundRect(ctx, ix, raceItemY, raceItemW, 46, 8);
      ctx.fill();
      ctx.strokeStyle = item.strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `bold 16px ${CANVAS_FONT}`;
      ctx.fillStyle = item.valColor;
      ctx.fillText(item.val, ix + 12, raceItemY + 28);
      ctx.font = `8px ${CANVAS_FONT}`;
      ctx.fillStyle = dimColor2;
      ctx.fillText(item.label, ix + 12, raceItemY + 40);
    });

    // ── STREAK BOX (special bundles only) ──
    if (isSpecial) {
      const sY = 252;
      ctx.fillStyle = boxBg;
      drawRoundRect(ctx, 20, sY, W - 40, 46, 8);
      ctx.fill();
      ctx.strokeStyle = boxBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = dimColor2;
      ctx.font = `9px ${CANVAS_FONT}`;
      ctx.fillText('DAILY STREAK', 30, sY + 14);
      ctx.font = `bold 20px ${CANVAS_FONT}`;
      ctx.fillStyle = isLight ? '#3BAF7A' : '#E8CC80';
      ctx.fillText(`DAY ${player.streak}`, 30, sY + 36);

      // dots
      const dotStartX = W - 20 - 7 * 26;
      for (let i = 0; i < 7; i++) {
        const dx = dotStartX + i * 26;
        const dy = sY + 23;
        const done = i < player.streak;
        const today = i === player.streak - 1;

        ctx.beginPath();
        ctx.arc(dx, dy, 10, 0, Math.PI*2);
        if (today) {
          ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.25)`;
        } else if (done) {
          ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.12)`;
        } else {
          ctx.fillStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
        }
        ctx.fill();
        ctx.strokeStyle = today ? emblemColor : (done ? `rgba(${ec.r},${ec.g},${ec.b},0.4)` : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'));
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `8px ${CANVAS_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = done ? emblemColor : dimColor2;
        ctx.fillText(today ? '★' : (done ? '✓' : `${i+1}`), dx, dy + 4);
        ctx.textAlign = 'left';
      }
    }

    // ── FOOTER ──
    const footerY = isSpecial ? 363 : 307;
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.12)`;
    ctx.fillRect(20, footerY, W - 40, 1);

    // Tab buttons
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.1)`;
    drawRoundRect(ctx, 20, footerY + 8, 72, 20, 4);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ec.r},${ec.g},${ec.b},0.4)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = emblemColor;
    ctx.font = `bold 9px ${CANVAS_FONT}`;
    ctx.fillText('Economy', 30, footerY + 22);

    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    drawRoundRect(ctx, 98, footerY + 8, 60, 20, 4);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = dimColor;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText('Profile', 108, footerY + 22);

    // Brand
    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.2)`;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText("St. Elmo's Fire", W - 20, footerY + 22);
    ctx.textAlign = 'left';

  } else {
    // ── PAGE 2: PROFILE ──
    const profile = getProfile(player.user_id);

    // Header
    ctx.fillStyle = textColor;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.5)`;
    ctx.fillText('GALLOP COLLECTION', 20, 26);

    const charName = profile.char_name || '—';
    ctx.fillStyle = textColor;
    ctx.font = `bold 22px ${CANVAS_FONT}`;
    ctx.fillText(charName, 20, 54);

    const teamStr = profile.team_name
      ? `${profile.team_name}${profile.trainer_name ? ' — ' + profile.trainer_name : ''}`
      : 'ยังไม่ได้ตั้งค่า';
    ctx.fillStyle = dimColor2;
    ctx.font = `11px ${CANVAS_FONT}`;
    ctx.fillText(teamStr, 20, 72);

    ctx.textAlign = 'right';
    ctx.fillStyle = dimColor2;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText('Profile', W - 20, 30);
    ctx.textAlign = 'left';

    // Divider
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.2)`;
    ctx.fillRect(20, 84, W - 40, 1);

    // Showcase title
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.45)`;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText('🏆  RACE SHOWCASE', 20, 100);

    // Podium
    const showcases = [
      { race: profile.showcase_1_race, rank: profile.showcase_1_rank, grade: profile.showcase_1_grade, year: profile.showcase_1_year },
      { race: profile.showcase_2_race, rank: profile.showcase_2_rank, grade: profile.showcase_2_grade, year: profile.showcase_2_year },
      { race: profile.showcase_3_race, rank: profile.showcase_3_rank, grade: profile.showcase_3_grade, year: profile.showcase_3_year },
    ];

    const rankColors = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' };
    const getRankColor = (rank) => {
      if (!rank) return dimColor2;
      if (rank.includes('1')) return rankColors.gold;
      if (rank.includes('2')) return rankColors.silver;
      return rankColors.bronze;
    };

    // Podium heights: 2nd | 1st | 3rd
    const podOrder = [1, 0, 2]; // showcase index: 2nd, 1st, 3rd
    const podHeights = [80, 110, 65];
    const podW = (W - 52) / 3;
    const podBaseY = 230;

    podOrder.forEach((si, pi) => {
      const s = showcases[si];
      const ph = podHeights[pi];
      const px = 20 + pi * (podW + 6);
      const py = podBaseY - ph;

      const rColor = getRankColor(s.rank);
      const rRgb = hexToRgb(rColor === dimColor2 ? '#888888' : rColor);

      ctx.fillStyle = `rgba(${rRgb.r},${rRgb.g},${rRgb.b},0.05)`;
      drawRoundRect(ctx, px, py, podW, ph, 6);
      ctx.fill();
      ctx.strokeStyle = `rgba(${rRgb.r},${rRgb.g},${rRgb.b},0.2)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (s.race) {
        // Rank number big
        ctx.fillStyle = rColor;
        ctx.font = `bold 22px ${CANVAS_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(s.rank || '—', px + podW/2, py + 28);

        ctx.fillStyle = textColor;
        ctx.font = `bold 9px ${CANVAS_FONT}`;
        // word wrap race name
        const words = s.race.split(' ');
        let line = '', lineY = py + 46;
        for (const w of words) {
          const test = line + w + ' ';
          if (ctx.measureText(test).width > podW - 10 && line) {
            ctx.fillText(line.trim(), px + podW/2, lineY);
            line = w + ' '; lineY += 13;
          } else { line = test; }
        }
        ctx.fillText(line.trim(), px + podW/2, lineY);

        ctx.fillStyle = dimColor2;
        ctx.font = `8px ${CANVAS_FONT}`;
        ctx.fillText(`${s.grade} · ${s.year}`, px + podW/2, py + ph - 8);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = dimColor2;
        ctx.font = `9px ${CANVAS_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('ยังไม่มี', px + podW/2, py + ph/2 + 4);
        ctx.textAlign = 'left';
      }
    });

    // Podium base line
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.2)`;
    ctx.fillRect(20, podBaseY, W - 40, 2);

    // Footer tabs
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    drawRoundRect(ctx, 20, podBaseY + 8, 72, 20, 4);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = dimColor;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText('Economy', 30, podBaseY + 22);

    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.1)`;
    drawRoundRect(ctx, 98, podBaseY + 8, 60, 20, 4);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ec.r},${ec.g},${ec.b},0.4)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = emblemColor;
    ctx.font = `bold 9px ${CANVAS_FONT}`;
    ctx.fillText('Profile', 108, podBaseY + 22);

    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.2)`;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText("St. Elmo's Fire", W - 20, podBaseY + 22);
    ctx.textAlign = 'left';
  }

  return canvas.toBuffer('image/png');
}

// ══════════════════════════════════════════════
//  DICE PARSER (จากเดิม — ไม่เปลี่ยน logic)
// ══════════════════════════════════════════════
function parseRoll(str) {
  str = str.trim().toLowerCase();
  let rollName = '';
  const trailMatch = str.match(/^([d0-9khl+\-*/().\s]+?)\s{1,}([a-zA-Z\u0E00-\u0E7F][^\d].*)$/);
  if (trailMatch) { str = trailMatch[1].trim(); rollName = trailMatch[2].trim(); }

  const ADV_RE = /^(adv(?:antage)?|dis(?:advantage)?)\s+(.+)$/i;
  const advMatch = str.match(ADV_RE);
  let mode = null;
  if (advMatch) {
    mode = advMatch[1].toLowerCase().startsWith('adv') ? 'adv' : 'dis';
    str = advMatch[2];
  }

  const tokenRe = /(\d*d\d+(?:kh\d+|kl\d+)?|\d+|[+\-])/gi;
  const tokens = [];
  let lastIdx = 0;
  let m;
  while ((m = tokenRe.exec(str)) !== null) {
    if (m.index > lastIdx) return { err: `Unknown token near "${str.slice(lastIdx, m.index)}"` };
    tokens.push({ raw: m[0], type: /d/.test(m[0]) ? 'dice' : (m[0] === '+' || m[0] === '-') ? 'op' : 'num' });
    if (tokens[tokens.length-1].type === 'dice') {
      const diceRe = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/i;
      const dm = m[0].match(diceRe);
      if (!dm) return { err: `Bad dice: ${m[0]}` };
      tokens[tokens.length-1].num   = parseInt(dm[1] || '1');
      tokens[tokens.length-1].sides = parseInt(dm[2]);
      tokens[tokens.length-1].keep  = dm[3] ? { type: dm[3].toLowerCase(), n: parseInt(dm[4]) } : null;
      if (tokens[tokens.length-1].num > 100) return { err: 'สูงสุด 100 ลูกครับ' };
      if (tokens[tokens.length-1].sides > 10000) return { err: 'สูงสุด d10000 ครับ' };
    } else if (tokens[tokens.length-1].type === 'num') {
      tokens[tokens.length-1].value = parseInt(m[0]);
    } else {
      tokens[tokens.length-1].value = m[0] === '+' ? 1 : -1;
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < str.length) return { err: `Unknown token near "${str.slice(lastIdx)}"` };
  if (!tokens.length) return { err: 'ไม่พบ expression ครับ' };
  return { tokens, mode, rollName };
}

function rollDice(num, sides) {
  const results = [];
  for (let i = 0; i < num; i++) results.push(rand(1, sides));
  return results;
}

function buildDiceText(parsed, tokens) {
  const { mode } = parsed;
  const lines = [];
  let grand = 0;
  let sign = 1;

  for (const t of tokens) {
    if (t.type === 'op') { sign = t.value; continue; }
    if (t.type === 'num') { grand += sign * t.value; lines.push({ type:'num', text: `${sign > 0 ? '+' : '-'}${t.value}` }); sign = 1; continue; }
    if (t.type === 'dice') {
      let rolls = rollDice(t.num, t.sides);
      let kept = [...rolls];
      if (mode === 'adv')  { const r2 = rollDice(t.num, t.sides); const best = Math.max(...rolls, ...r2); kept = [best]; rolls = [...rolls, ...r2]; }
      if (mode === 'dis')  { const r2 = rollDice(t.num, t.sides); const worst = Math.min(...rolls, ...r2); kept = [worst]; rolls = [...rolls, ...r2]; }
      if (t.keep) {
        const sorted = [...rolls].sort((a,b) => b-a);
        kept = t.keep.type === 'kh' ? sorted.slice(0, t.keep.n) : sorted.slice(sorted.length - t.keep.n);
      }
      const dropped = rolls.filter(r => {
        const idx = kept.indexOf(r);
        if (idx !== -1) { kept.splice(idx, 1); return false; }
        return true;
      });
      // rebuild kept
      kept = t.keep ? (t.keep.type === 'kh' ? [...rolls].sort((a,b) => b-a).slice(0, t.keep.n) : [...rolls].sort((a,b) => b-a).slice(rolls.length - t.keep.n)) : rolls;
      if (mode === 'adv') kept = [Math.max(...rolls)];
      if (mode === 'dis') kept = [Math.min(...rolls)];
      const droppedSet = [];
      const keptCopy = [...kept];
      for (const r of rolls) {
        const ki = keptCopy.indexOf(r);
        if (ki !== -1) { keptCopy.splice(ki, 1); }
        else droppedSet.push(r);
      }
      const sum = kept.reduce((a,b) => a+b, 0);
      grand += sign * sum;
      lines.push({ type:'dice', rolls, kept, dropped: droppedSet, expr: `${t.num}d${t.sides}${t.keep ? t.keep.type+t.keep.n : ''}`, sum: sign * sum, sign });
      sign = 1;
    }
  }
  return { lines, grand };
}

async function buildRollEmbed(parsed, tokens, username, userId) {
  const { lines, grand } = buildDiceText(parsed, tokens);
  const p = getPlayer(userId);
  const bundleKey = p.equipped_bundle || 'default';
  const expr = parsed.rollName || tokens.map(t => t.type === 'dice' ? `${t.num}d${t.sides}${t.keep ? t.keep.type+t.keep.n : ''}` : (t.type === 'op' ? (t.value > 0 ? '+' : '-') : t.value)).join('');
  // สร้าง breakdown text สำหรับ canvas (plain text)
  const breakdown = lines.map(l => {
    if (l.type === 'num') return l.text;
    const parts = l.rolls.map(r => {
      const isDropped = l.dropped.includes(r);
      return isDropped ? `(${r})` : `${r}`;
    });
    return parts.join(' ');
  }).join(' | ');

  try {
    const buffer = await generateRollCard(username, expr, grand, breakdown, bundleKey);
    const attachment = { attachment: buffer, name: 'roll.png' };
    const bundle = getBundle(bundleKey);
    const color = bundle ? parseInt(bundle.emblemColor.slice(1), 16) : 0x444444;
    const embed = new EmbedBuilder().setColor(color).setImage('attachment://roll.png');
    return { embeds: [embed], files: [attachment] };
  } catch (e) {
    console.error('Canvas error:', e.message);
    const textLines = [];
    if (parsed.mode === 'adv') textLines.push('`ADVANTAGE`');
    if (parsed.mode === 'dis') textLines.push('`DISADVANTAGE`');
    textLines.push(...lines.map(l => l.type === 'num' ? l.text : `[${l.rolls.map(r => l.dropped.includes(r) ? `~~${r}~~` : r).join(', ')}] = ${l.sum}`));
    textLines.push(`\n@${username}\u2003**${grand}**`);
    const embed = new EmbedBuilder().setColor(0x444444).setDescription(textLines.join('\n'));
    return { embeds: [embed] };
  }
}

// ══════════════════════════════════════════════
//  SLOTS
// ══════════════════════════════════════════════
const SLOT_SYMS = ['cherry','lemon','orange','star','diamond','seven'];
const SLOT_EMOJI = { cherry:'🍒', lemon:'🍋', orange:'🍊', star:'⭐', diamond:'💎', seven:'7' };
const SLOT_MULT  = { cherry:3, lemon:3, orange:3, star:5, diamond:10, seven:50 };
const SLOT_W     = [30, 25, 20, 15, 7, 3];

function spinSlot() {
  const r = rand(1, 100); let c = 0;
  for (let i = 0; i < SLOT_SYMS.length; i++) { c += SLOT_W[i]; if (r <= c) return SLOT_SYMS[i]; }
  return SLOT_SYMS[0];
}

// ══════════════════════════════════════════════
//  BLACKJACK
// ══════════════════════════════════════════════
const bjGames = new Map();
const BJ_SUITS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function makeDeck() {
  const d = [];
  for (const s of ['S','H','D','C']) for (const r of BJ_SUITS) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = rand(0, i); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function cardVal(c) { if (['J','Q','K'].includes(c.r)) return 10; if (c.r === 'A') return 11; return parseInt(c.r); }
function handVal(h) { let v = h.reduce((a, c) => a + cardVal(c), 0), ac = h.filter(c => c.r === 'A').length; while (v > 21 && ac > 0) { v -= 10; ac--; } return v; }
function cardStr(c) { return `${c.r}${{ S:'♠', H:'♥', D:'♦', C:'♣' }[c.s]}`; }

setInterval(() => {
  const now = Date.now();
  for (const [userId, game] of bjGames.entries()) {
    if (now - game.startTime > 5 * 60 * 1000) {
      bjGames.delete(userId);
      const p = getPlayer(userId);
      updatePlayer(userId, { gold: p.gold + game.amount });
    }
  }
}, 60 * 1000);

// ══════════════════════════════════════════════
//  ROULETTE
// ══════════════════════════════════════════════
const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function roulColor(n) { if (n === 0) return 'green'; return RED_NUMS.includes(n) ? 'red' : 'black'; }
function roulWin(bet, n) {
  if (bet === 'red')   return roulColor(n) === 'red';
  if (bet === 'black') return roulColor(n) === 'black';
  if (bet === 'odd')   return n !== 0 && n % 2 === 1;
  if (bet === 'even')  return n !== 0 && n % 2 === 0;
  if (bet === '1-18')  return n >= 1 && n <= 18;
  if (bet === '19-36') return n >= 19 && n <= 36;
  if (!isNaN(parseInt(bet))) return parseInt(bet) === n;
  return false;
}
function roulPay(bet) { return ['red','black','odd','even','1-18','19-36'].includes(bet) ? 2 : 35; }

// ══════════════════════════════════════════════
//  SLASH COMMANDS
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  RACE SYSTEM v7.0
// ══════════════════════════════════════════════

const TRAIN_CHANNEL_ID = '1498223895227138158';
const RACE_CHANNEL_IDS = {
  tokyo:    '1462831563690737919',
  nakayama: '1462831646523916380',
  kyoto:    '1462831714782150677',
  hanshin:  '1462834889509310552',
  chukyo:   '1462834989002526730',
};

const TRACKS = {
  nakayama: { name: 'Nakayama Racecourse', hasHill: true, hillPhases: [3, 4], hillPenalty: { front: 40, end: 30, pace: 20, late: 20 } },
  tokyo:    { name: 'Tokyo Racecourse',    hasHill: false },
  kyoto:    { name: 'Kyoto Racecourse',    hasHill: false },
  hanshin:  { name: 'Hanshin Racecourse',  hasHill: false },
  chukyo:   { name: 'Chukyo Racecourse',   hasHill: false },
};

const DISTANCE_CONFIG = {
  sprint:      { label: 'Sprint (8 turns)',      turnsPerPhase: [2, 2, 2, 2] },
  mile_medium: { label: 'Mile/Medium (12 turns)', turnsPerPhase: [3, 3, 3, 3] },
  long:        { label: 'Long (14 turns)',        turnsPerPhase: [3, 4, 3, 4] },
};

const RACE_GRADES = {
  debut: { label: 'Make Debut', safes: 3 },
  g3:    { label: 'G3',         safes: 2 },
  g2:    { label: 'G2',         safes: 1 },
  g1:    { label: 'G1',         safes: 0 },
};

function getAllOutInjury(count) {
  if (count <= 3) return 'เหยียบก้อนกรวด เจ็บนิดหน่อย';
  if (count <= 5) return 'ข้อเท้าแพลง';
  if (count <= 6) return 'บาดเจ็บเล็กน้อย';
  if (count <= 8) return 'อาจต้องพักและเข้าพบแพทย์';
  return 'เสี่ยงบาดเจ็บหนัก!';
}

const raceDb = new Database(':memory:');
raceDb.exec(`
  CREATE TABLE IF NOT EXISTS race_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    track TEXT DEFAULT '', distance TEXT DEFAULT '', grade TEXT DEFAULT '',
    current_phase INTEGER DEFAULT 1, current_turn INTEGER DEFAULT 1, active INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS race_players (
    user_id TEXT PRIMARY KEY, username TEXT DEFAULT '', run_style TEXT DEFAULT '',
    score INTEGER DEFAULT 0, race_safes INTEGER DEFAULT 0, one_use_safes INTEGER DEFAULT 0,
    reroll_count INTEGER DEFAULT 0, all_out_count INTEGER DEFAULT 0, hill_debuff INTEGER DEFAULT 0,
    last_roll TEXT DEFAULT '', zone_active INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO race_session (id, active) VALUES (1, 0);
`);

function getRaceSession() { return raceDb.prepare('SELECT * FROM race_session WHERE id = 1').get(); }
function getRacePlayer(userId) { return raceDb.prepare('SELECT * FROM race_players WHERE user_id = ?').get(userId); }
function getAllRacePlayers() { return raceDb.prepare('SELECT * FROM race_players ORDER BY score DESC').all(); }
function updateRacePlayer(userId, data) {
  const keys = Object.keys(data).map(k => `${k} = ?`).join(', ');
  raceDb.prepare(`UPDATE race_players SET ${keys} WHERE user_id = ?`).run(...Object.values(data), userId);
}
function updateRaceSession(data) {
  const keys = Object.keys(data).map(k => `${k} = ?`).join(', ');
  raceDb.prepare(`UPDATE race_session SET ${keys} WHERE id = 1`).run(...Object.values(data));
}
function clearRaceSession() {
  raceDb.exec(`DELETE FROM race_players; UPDATE race_session SET active=0, current_phase=1, current_turn=1, track='', distance='', grade='';`);
}

function rollDiceNotation(notation) {
  const m = notation.toLowerCase().match(/^(\d+)d(\d+)(?:(kh|kl)(\d+))?$/);
  if (!m) return null;
  const [, n, sides, mode, keep] = m;
  const num = parseInt(n), s = parseInt(sides), k = keep ? parseInt(keep) : num;
  const rolls = Array.from({ length: num }, () => Math.floor(Math.random() * s) + 1);
  let chosen, rest;
  if (mode === 'kh') { const sorted = [...rolls].sort((a,b) => b-a); chosen = sorted.slice(0,k); rest = sorted.slice(k); }
  else if (mode === 'kl') { const sorted = [...rolls].sort((a,b) => a-b); chosen = sorted.slice(0,k); rest = sorted.slice(k); }
  else { chosen = rolls; rest = []; }
  const total = chosen.reduce((a,b) => a+b, 0);
  const display = rest.length ? `${total} [${rest.join(', ')}]` : `${total}`;
  return { total, chosen, rest, display, notation };
}

function canUseSafe(rollResult) {
  const units = rollResult.total % 10;
  return units >= 1 && units <= 9 && rollResult.rest.length === 0;
}

function getDiceNotation(style, phase, grade) {
  const upper = { front: ['d30','3d30','4d30','2d30'], pace: ['d30','2d30','2d30','2d30'], late: ['d30','2d30','3d30','2d30'], end: ['d30','2d30','6d30','d30'] };
  const lower = { front: ['2d30','4d30','3d30','d30'], pace: ['3d30kh1','6d30kh2','6d30kh2','6d30kh3'], late: ['2d30kh1','4d30kh2','9d30kh3','3d30'], end: ['d30','d30','5d30','d30'] };
  return (grade === 'g1' ? lower : upper)[style]?.[phase - 1] || 'd30';
}

const raceCommands = [
  new SlashCommandBuilder().setName('race').setDescription('[Staff] จัดการระบบการแข่ง')
    .addSubcommand(s => s.setName('start').setDescription('[Staff] เปิด session')
      .addStringOption(o => o.setName('track').setDescription('สนาม').setRequired(true).addChoices({name:'Nakayama',value:'nakayama'},{name:'Tokyo',value:'tokyo'},{name:'Kyoto',value:'kyoto'},{name:'Hanshin',value:'hanshin'},{name:'Chukyo',value:'chukyo'}))
      .addStringOption(o => o.setName('distance').setDescription('ระยะทาง').setRequired(true).addChoices({name:'Sprint (8T)',value:'sprint'},{name:'Mile/Medium (12T)',value:'mile_medium'},{name:'Long (14T)',value:'long'}))
      .addStringOption(o => o.setName('grade').setDescription('ระดับ').setRequired(true).addChoices({name:'Make Debut',value:'debut'},{name:'G3',value:'g3'},{name:'G2',value:'g2'},{name:'G1',value:'g1'})))
    .addSubcommand(s => s.setName('register').setDescription('ลงทะเบียนสายวิ่ง')
      .addStringOption(o => o.setName('style').setDescription('สาย').setRequired(true).addChoices({name:'Front',value:'front'},{name:'Pace',value:'pace'},{name:'Late',value:'late'},{name:'End',value:'end'})))
    .addSubcommand(s => s.setName('roll').setDescription('[Staff] ทอยให้ผู้เล่น').addUserOption(o => o.setName('player').setDescription('ผู้เล่น').setRequired(true)))
    .addSubcommand(s => s.setName('safe').setDescription('ใช้ Safe'))
    .addSubcommand(s => s.setName('reroll').setDescription('ใช้ Reroll').addStringOption(o => o.setName('type').setDescription('ประเภท').setRequired(true).addChoices({name:'Reroll ติดตัว',value:'personal'},{name:'Reroll กิจกรรม',value:'activity'},{name:'Reroll เทรนเนอร์',value:'trainer'})))
    .addSubcommand(s => s.setName('debuffskill').setDescription('ใช้ Debuff Skill').addUserOption(o => o.setName('target').setDescription('เป้าหมาย').setRequired(true)))
    .addSubcommand(s => s.setName('slowdown').setDescription('ลดความเร็ว'))
    .addSubcommand(s => s.setName('allout').setDescription('All out — หัก 10 แต้มทบ'))
    .addSubcommand(s => s.setName('zone').setDescription('เปิดโซน (G1 เท่านั้น)').addStringOption(o => o.setName('color').setDescription('ทองหรือขาว').setRequired(true).addChoices({name:'ทอง',value:'gold'},{name:'ขาว',value:'white'})))
    .addSubcommand(s => s.setName('endturn').setDescription('[Staff] จบเทิร์น'))
    .addSubcommand(s => s.setName('endphase').setDescription('[Staff] จบเฟส'))
    .addSubcommand(s => s.setName('end').setDescription('[Staff] จบการแข่ง')),

  new SlashCommandBuilder().setName('train').setDescription('ระบบฝึกซ้อม')
    .addSubcommand(s => s.setName('submit').setDescription('ส่งบทฝึก')
      .addUserOption(o => o.setName('trainer').setDescription('เทรนเนอร์').setRequired(true))
      .addStringOption(o => o.setName('horses').setDescription('mention สาวม้า (@ม้าA @ม้าB)').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('ประเภท').setRequired(true).addChoices({name:'Reroll (คุยสนทนา)',value:'chat'},{name:'Reroll (ฝึกคู่/กลุ่ม)',value:'group'},{name:'Safe (ฝึกคนเดียว)',value:'solo'},{name:'Zone (ฝึกโซน)',value:'zone'},{name:'ล้างเนินมรณะ',value:'hill'}))
      .addChannelOption(o => o.setName('location').setDescription('channel ที่ฝึก').setRequired(true)))
    .addSubcommand(s => s.setName('approve').setDescription('[Staff] อนุมัติบทฝึก')
      .addUserOption(o => o.setName('horse').setDescription('สาวม้า').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('ประเภท').setRequired(true).addChoices({name:'คุยสนทนา',value:'chat'},{name:'ฝึกคู่/กลุ่ม',value:'group'},{name:'ฝึกคนเดียว',value:'solo'},{name:'ล้างเนินมรณะ',value:'hill'}))
      .addUserOption(o => o.setName('trainer').setDescription('เทรนเนอร์').setRequired(false))),
];

async function handleRace(interaction) {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const isStaffMember = interaction.member?.roles?.cache?.some(r => r.name === STAFF_ROLE);
  const session = getRaceSession();

  if (sub === 'start') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    if (session.active) return interaction.reply({ content: 'มี session อยู่แล้วครับ ใช้ /race end ก่อน', flags: 64 });
    const track = interaction.options.getString('track');
    const distance = interaction.options.getString('distance');
    const grade = interaction.options.getString('grade');
    updateRaceSession({ active: 1, track, distance, grade, current_phase: 1, current_turn: 1 });
    const t = TRACKS[track], d = DISTANCE_CONFIG[distance], g = RACE_GRADES[grade];
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xD4AF37).setTitle('🏇 เปิด Session การแข่งแล้ว!')
      .addFields(
        { name: '🏟️ สนาม', value: t.name, inline: true },
        { name: '📏 ระยะ', value: d.label, inline: true },
        { name: '🏆 ระดับ', value: g.label, inline: true },
        { name: '📊 โครงสร้าง', value: d.turnsPerPhase.map((n,i) => `เฟส ${i+1}: ${n} เทิร์น`).join('\n') },
        { name: '🛡️ Race Safe', value: `${g.safes} อัน/คน`, inline: true },
        { name: '⛰️ เนินมรณะ', value: t.hasHill ? '✅ มี' : '❌ ไม่มี', inline: true },
      ).setFooter({ text: 'ผู้เล่นใช้ /race register เพื่อลงทะเบียน' })] });
  }

  if (sub === 'register') {
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    const style = interaction.options.getString('style');
    const g = RACE_GRADES[session.grade];
    const existing = getRacePlayer(userId);
    if (existing) { updateRacePlayer(userId, { run_style: style }); }
    else { raceDb.prepare('INSERT INTO race_players (user_id, username, run_style, race_safes) VALUES (?,?,?,?)').run(userId, interaction.user.username, style, g.safes); }
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ **${interaction.user.username}** ลงทะเบียนสาย **${style.toUpperCase()}** แล้วครับ`)], flags: 64 });
  }

  if (sub === 'roll') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    const target = interaction.options.getUser('player');
    const player = getRacePlayer(target.id);
    if (!player) return interaction.reply({ content: 'ผู้เล่นยังไม่ได้ลงทะเบียนครับ', flags: 64 });
    const notation = getDiceNotation(player.run_style, session.current_phase, session.grade);
    const result = rollDiceNotation(notation);
    const track = TRACKS[session.track];
    let hillMsg = '';
    if (track?.hasHill && track.hillPhases.includes(session.current_phase) && !player.hill_debuff) {
      const penalty = track.hillPenalty[player.run_style] || 0;
      updateRacePlayer(target.id, { hill_debuff: 1, score: player.score - penalty });
      hillMsg = `\n⛰️ **เนินมรณะ** หัก -${penalty} แต้ม`;
    }
    updateRacePlayer(target.id, { last_roll: JSON.stringify(result) });
    const canSafe = canUseSafe(result);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xD4AF37)
      .setTitle(`🎲 ${target.username} — เฟส ${session.current_phase} เทิร์น ${session.current_turn}`)
      .addFields(
        { name: '🎯 Dice', value: `\`${notation}\``, inline: true },
        { name: '📊 ผล', value: `**${result.display}**${hillMsg}`, inline: true },
        { name: '🏃 สาย', value: player.run_style.toUpperCase(), inline: true },
        { name: '🛡️ Safe', value: canSafe ? `ใช้ได้ | Race: ${player.race_safes} | One-use: ${player.one_use_safes}` : 'ใช้ไม่ได้ (KH/KL หรือหลักหน่วย 0)', inline: false },
      )] });
  }

  if (sub === 'safe') {
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    const player = getRacePlayer(userId);
    if (!player) return interaction.reply({ content: 'ยังไม่ได้ลงทะเบียนครับ', flags: 64 });
    const lastRoll = player.last_roll ? JSON.parse(player.last_roll) : null;
    if (!lastRoll) return interaction.reply({ content: 'ยังไม่มีผลทอยครับ', flags: 64 });
    if (!canUseSafe(lastRoll)) return interaction.reply({ content: '❌ ใช้ Safe ไม่ได้ — หลักหน่วยอยู่ในวงเล็บ (KH/KL) หรือเป็น 0', flags: 64 });
    if (player.one_use_safes < 1 && player.race_safes < 1) return interaction.reply({ content: '❌ ไม่มี Safe เหลือครับ', flags: 64 });
    if (player.one_use_safes > 0) { updateRacePlayer(userId, { one_use_safes: player.one_use_safes - 1 }); }
    else { updateRacePlayer(userId, { race_safes: player.race_safes - 1 }); }
    const notation = getDiceNotation(player.run_style, session.current_phase, session.grade);
    const newResult = rollDiceNotation(notation);
    updateRacePlayer(userId, { last_roll: JSON.stringify(newResult) });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(`🛡️ ${interaction.user.username} ใช้ Safe!`)
      .addFields({ name: '📊 ผลเดิม', value: `~~${lastRoll.display}~~`, inline: true }, { name: '📊 ผลใหม่', value: `**${newResult.display}**`, inline: true })] });
  }

  if (sub === 'allout') {
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    const player = getRacePlayer(userId);
    if (!player) return interaction.reply({ content: 'ยังไม่ได้ลงทะเบียนครับ', flags: 64 });
    const count = player.all_out_count + 1;
    const penalty = count * 10;
    const notation = getDiceNotation(player.run_style, session.current_phase, session.grade);
    const newResult = rollDiceNotation(notation);
    updateRacePlayer(userId, { all_out_count: count, score: player.score - penalty, last_roll: JSON.stringify(newResult) });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xEB5757).setTitle(`💥 ${interaction.user.username} — All Out! (ครั้งที่ ${count})`)
      .addFields({ name: '📊 ผลใหม่', value: `**${newResult.display}**`, inline: true }, { name: '💔 หักแต้ม', value: `-${penalty} แต้ม`, inline: true }, { name: '🤕 อาการ', value: getAllOutInjury(count) })] });
  }

  if (sub === 'debuffskill') {
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    const player = getRacePlayer(userId);
    if (!player) return interaction.reply({ content: 'ยังไม่ได้ลงทะเบียนครับ', flags: 64 });
    const mp = getPlayer(userId);
    if (!mp || (mp.race_reroll ?? 1) < 1) return interaction.reply({ content: '❌ ไม่มี Reroll ติดตัวครับ', flags: 64 });
    const target = interaction.options.getUser('target');
    const tp = getRacePlayer(target.id);
    if (!tp) return interaction.reply({ content: 'ผู้เล่นคนนี้ไม่ได้ลงทะเบียนครับ', flags: 64 });
    updatePlayer(userId, { race_reroll: (mp.race_reroll ?? 1) - 1 });
    const notation = getDiceNotation(tp.run_style, session.current_phase, session.grade);
    const newResult = rollDiceNotation(notation);
    const old = tp.last_roll ? JSON.parse(tp.last_roll) : null;
    updateRacePlayer(target.id, { last_roll: JSON.stringify(newResult) });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xEB5757).setTitle('⚡ Debuff Skill!')
      .setDescription(`**${interaction.user.username}** ใช้ Debuff Skill กับ **${target.username}**!`)
      .addFields({ name: '📊 ผลเดิม', value: old ? `~~${old.display}~~` : '—', inline: true }, { name: '📊 ผลใหม่', value: `**${newResult.display}**`, inline: true })] });
  }

  if (sub === 'zone') {
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    if (session.grade !== 'g1') return interaction.reply({ content: '❌ Zone ใช้ได้เฉพาะ G1 ครับ', flags: 64 });
    const player = getRacePlayer(userId);
    if (!player) return interaction.reply({ content: 'ยังไม่ได้ลงทะเบียนครับ', flags: 64 });
    const color = interaction.options.getString('color');
    updateRacePlayer(userId, { zone_active: 1 });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(color === 'gold' ? 0xD4AF37 : 0xffffff)
      .setTitle(`✨ ${interaction.user.username} เปิดโซน!`)
      .setDescription(`เลือกทอย **${color === 'gold' ? 'ทอง 🟡' : 'ขาว ⚪'}** — สามารถเลือกผลลัพธ์ไหนก็ได้ครับ`)] });
  }

  if (sub === 'endturn') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    updateRaceSession({ current_turn: session.current_turn + 1 });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xD4AF37).setDescription(`✅ จบเทิร์น ${session.current_turn} → เทิร์น **${session.current_turn + 1}**`)] });
  }

  if (sub === 'endphase') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    let bonusMsg = '';
    if (session.current_phase === 1) {
      const players = getAllRacePlayers();
      if (players.length > 0) {
        const last = players[players.length - 1];
        updateRacePlayer(last.user_id, { score: last.score + 5 });
        bonusMsg = `\n⭐ **${last.username}** ได้รับ +5 แต้ม`;
      }
    }
    updateRaceSession({ current_phase: session.current_phase + 1, current_turn: 1 });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xD4AF37).setTitle(`✅ จบเฟส ${session.current_phase}`).setDescription(`เริ่มเฟส **${session.current_phase + 1}**${bonusMsg}`)] });
  }

  if (sub === 'end') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    if (!session.active) return interaction.reply({ content: 'ยังไม่มี session ครับ', flags: 64 });
    const players = getAllRacePlayers();
    const board = players.map((p,i) => `${i+1}. **${p.username}** (${p.run_style.toUpperCase()}) — ${p.score} แต้ม`).join('\n');
    for (const rp of players) {
      const mp = getPlayer(rp.user_id);
      if (mp) updatePlayer(rp.user_id, { race_reroll: mp.race_reroll_max ?? 1 });
    }
    clearRaceSession();
    try {
      const raceChId = RACE_CHANNEL_IDS[session.track] || RACE_CHANNEL_IDS.nakayama;
      const ch = await interaction.client.channels.fetch(raceChId);
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(0xD4AF37).setTitle('🏁 จบการแข่ง!').setDescription(board || 'ไม่มีผู้เล่น')] });
    } catch(e) {}
    return interaction.reply({ content: '✅ จบการแข่งและล้าง session แล้วครับ', flags: 64 });
  }
}

async function handleTrain(interaction) {
  const sub = interaction.options.getSubcommand();
  const isStaffMember = interaction.member?.roles?.cache?.some(r => r.name === STAFF_ROLE);

  if (sub === 'submit') {
    const trainer  = interaction.options.getUser('trainer');
    const horses   = interaction.options.getString('horses');
    const type     = interaction.options.getString('type');
    const location = interaction.options.getChannel('location');
    const typeLabel = { chat:'คุยสนทนา', group:'ฝึกคู่/กลุ่ม', solo:'ฝึกคนเดียว', zone:'ฝึกโซน', hill:'ล้างเนินมรณะ' }[type];
    try {
      const ch = await interaction.client.channels.fetch(TRAIN_CHANNEL_ID);
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(0xF9A8C9).setTitle('📋 บทฝึกใหม่รอพิจารณา')
        .addFields(
          { name: '👤 เทรนเนอร์', value: `<@${trainer.id}>`, inline: true },
          { name: '🏇 สาวม้า', value: horses, inline: true },
          { name: '📝 ประเภท', value: typeLabel, inline: true },
          { name: '📍 สถานที่', value: `<#${location.id}>`, inline: true },
        ).setFooter({ text: `ส่งโดย ${interaction.user.username}` })] });
    } catch(e) {}
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('✅ ส่งบทฝึกให้ Staff แล้วครับ รอการอนุมัติ')], flags: 64 });
  }

  if (sub === 'approve') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    const horse   = interaction.options.getUser('horse');
    const type    = interaction.options.getString('type');
    const trainer = interaction.options.getUser('trainer');
    const hp = getPlayer(horse.id);
    const tp = trainer ? getPlayer(trainer.id) : null;
    let horseReward = '', trainerReward = '';
    if (type === 'chat') {
      updatePlayer(horse.id, { inv_reroll: (hp.inv_reroll||0) + 1 }); horseReward = '+1 Reroll กิจกรรม';
      if (tp) { updatePlayer(trainer.id, { inv_reroll: (tp.inv_reroll||0) + 1 }); trainerReward = '+1 Reroll เทรนเนอร์'; }
    } else if (type === 'group') {
      updatePlayer(horse.id, { inv_reroll: (hp.inv_reroll||0) + 2 }); horseReward = '+2 Reroll กิจกรรม';
      if (tp) { updatePlayer(trainer.id, { inv_reroll: (tp.inv_reroll||0) + 2 }); trainerReward = '+2 Reroll เทรนเนอร์'; }
    } else if (type === 'solo') {
      updatePlayer(horse.id, { race_safe: (hp.race_safe||0) + 1 }); horseReward = '+1 One-use Safe';
    } else if (type === 'hill') {
      const rp = getRacePlayer(horse.id);
      if (rp) updateRacePlayer(horse.id, { hill_debuff: 0 });
      horseReward = '✅ ล้าง Hill Debuff';
    }
    const fields = [{ name: '🏇 สาวม้า', value: `<@${horse.id}>`, inline: true }, { name: '🎁 รางวัล', value: horseReward, inline: true }];
    if (trainer && trainerReward) fields.push({ name: '👤 เทรนเนอร์', value: `<@${trainer.id}>`, inline: true }, { name: '🎁 รางวัล', value: trainerReward, inline: true });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('✅ อนุมัติบทฝึกแล้ว!').addFields(...fields)] });
  }
}

async function handleMain(interaction) {
  const group = interaction.options.getSubcommandGroup();
  const sub   = interaction.options.getSubcommand();
  const isStaffMember = interaction.member?.roles?.cache?.some(r => r.name === STAFF_ROLE);
  if (group === 'reroll' && sub === 'gift') {
    if (!isStaffMember) return interaction.reply({ content: 'เฉพาะ Staff ครับ', flags: 64 });
    const target = interaction.options.getUser('player');
    const p = getPlayer(target.id);
    const newMax = (p.race_reroll_max ?? 1) + 1;
    updatePlayer(target.id, { race_reroll_max: newMax, race_reroll: (p.race_reroll ?? 1) + 1 });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xD4AF37).setTitle('🎁 แจก Reroll ติดตัวสำเร็จ!')
      .addFields({ name: '👤 ผู้เล่น', value: `<@${target.id}>`, inline: true }, { name: '🔄 จำนวนใหม่', value: `${newMax} อัน`, inline: true })] });
  }
}


const commands = [
  new SlashCommandBuilder().setName('roll').setDescription('ทอยลูกเต๋า')
    .addStringOption(o => o.setName('expression').setDescription('เช่น 4d30kh3').setRequired(false)),

  new SlashCommandBuilder().setName('daily').setDescription('รับรางวัลประจำวัน (รีเซ็ตตี 4)'),

  new SlashCommandBuilder().setName('inventory').setDescription('ดูกระเป๋า'),

  new SlashCommandBuilder().setName('convert').setDescription('แลก Gold เป็น RC (3:1)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(3)),

  new SlashCommandBuilder().setName('use').setDescription('ใช้ Re-roll')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(false).setMinValue(1).setMaxValue(10)),

  new SlashCommandBuilder().setName('equip').setDescription('ใส่ bundle'),

  new SlashCommandBuilder().setName('transfer').setDescription('โอน Gold ให้สมาชิก')
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('coinflip').setDescription('ทอยเหรียญ (42% ชนะ 2x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('choice').setDescription('หัว/ก้อย').setRequired(true)
      .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),

  new SlashCommandBuilder().setName('slots').setDescription('สล็อต (18% ชนะ + Progressive Jackpot)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('blackjack').setDescription('แบล็คแจ็ค (dealer hits to 18)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('roulette').setDescription('รูเล็ต (2x-36x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('bet').setDescription('red/black/odd/even/1-18/19-36/0-36').setRequired(true)),

  new SlashCommandBuilder().setName('help').setDescription('ดูคำสั่งทั้งหมด'),

  new SlashCommandBuilder().setName('shop').setDescription('ดูและซื้อ bundle'),

  new SlashCommandBuilder().setName('profile')
    .setDescription('จัดการ profile')
    .addSubcommand(s => s.setName('set').setDescription('ตั้งค่า profile')
      .addStringOption(o => o.setName('name').setDescription('ชื่อตัวละคร').setRequired(false))
      .addStringOption(o => o.setName('team').setDescription('ชื่อทีม').setRequired(false))
      .addStringOption(o => o.setName('trainer').setDescription('ชื่อเทรนเนอร์').setRequired(false))),

  // Staff
  new SlashCommandBuilder().setName('give').setDescription('[Staff] แจกเงิน')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addMentionableOption(o => o.setName('targets').setDescription('@user หรือ @role').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('gift').setDescription('[Staff] แจก bundle หรือ item')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addMentionableOption(o => o.setName('targets').setDescription('@user หรือ @role').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ของที่จะแจก').setRequired(true)
      .addChoices(
        { name: 'Re-roll', value: 'reroll' },
        { name: 'Race Reroll', value: 'race_reroll' },
        { name: 'Race Safe', value: 'race_safe' },
        { name: 'Make a Debut', value: 'make_a_debut' },
        { name: 'Beyond the Dream', value: 'beyond_the_dream' },
        { name: 'The Road to Glory', value: 'the_road_to_glory' },
        { name: 'He Who Commands the Era', value: 'he_who_commands' },
        { name: 'Coronation of Emperor', value: 'coronation_of_emperor' },
        { name: 'The All Rounder', value: 'the_all_rounder' },
        { name: 'La Noblesse', value: 'la_noblesse' },
        { name: 'The Rising Son', value: 'the_rising_son' },
        { name: 'The Mighty One', value: 'the_mighty_one' },
      ))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(false).setMinValue(1).setMaxValue(99)),

  new SlashCommandBuilder().setName('take').setDescription('[Staff] ลบเงิน')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('revoke').setDescription('[Staff] ลบ item')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('reroll').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('inspect').setDescription('[Staff] ดู inventory สมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true)),

  new SlashCommandBuilder().setName('showcase').setDescription('[Staff] ตั้ง race showcase')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addIntegerOption(o => o.setName('slot').setDescription('ช่อง 1-3').setRequired(true).setMinValue(1).setMaxValue(3))
    .addStringOption(o => o.setName('race').setDescription('ชื่อการแข่ง (ใส่ clear เพื่อลบ)').setRequired(true))
    .addStringOption(o => o.setName('rank').setDescription('อันดับ เช่น 1st').setRequired(false))
    .addStringOption(o => o.setName('grade').setDescription('เกรด เช่น G1').setRequired(false))
    .addStringOption(o => o.setName('year').setDescription('ปี เช่น 2026').setRequired(false)),

  ...raceCommands,
  new SlashCommandBuilder()
    .setName('main')
    .setDescription('[Staff] จัดการ reroll ติดตัว')
    .addSubcommandGroup(group => group
      .setName('reroll')
      .setDescription('จัดการ reroll ติดตัว')
      .addSubcommand(sub => sub
        .setName('gift')
        .setDescription('[Staff] บวก +1 reroll ติดตัวให้ผู้เล่น')
        .addUserOption(o => o.setName('player').setDescription('ผู้เล่น').setRequired(true)))),
].map(c => c.toJSON());

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('Slash commands registered');
}

// ══════════════════════════════════════════════
//  BOT
// ══════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});
// ตรวจสอบว่าเปิด Message Content Intent ใน Discord Developer Portal แล้ว

client.once('clientReady', async () => {
  console.log(`${BOTNAME} v7.0 online: ${client.user.tag}`);
  await deployCommands();
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.content.toLowerCase().startsWith(PREFIX)) return;
  const raw = msg.content.slice(PREFIX.length).trim() || '1d20';
  const parsed = parseRoll(raw);
  if (parsed.err) return msg.reply(`Error: ${parsed.err}`);
  const username = msg.member?.displayName || msg.author.username;
  try {
    const result = await buildRollEmbed(parsed, parsed.tokens, username, msg.author.id);
    await msg.reply(result);
  } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) await handleSlash(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelect(interaction);
  } catch (e) {
    console.error(e);
    const rep = { content: 'Error: กรุณาลองใหม่ครับ', flags: 64 };
    if (interaction.replied || interaction.deferred) await interaction.followUp(rep);
    else await interaction.reply(rep);
  }
});

// ══════════════════════════════════════════════
//  COMMAND HANDLERS
// ══════════════════════════════════════════════
async function handleSlash(interaction) {
  const cmd = interaction.commandName;
  if (cmd === 'race') return handleRace(interaction);
  if (cmd === 'train') return handleTrain(interaction);
  if (cmd === 'main') return handleMain(interaction);
  const userId = interaction.user.id;
  const username = interaction.member?.displayName || interaction.user.username;

  function getBundleColor() {
    const p = getPlayer(userId);
    const bundle = getBundle(p.equipped_bundle);
    return bundle ? parseInt(bundle.emblemColor.slice(1), 16) : 0x444444;
  }

  // /roll
  if (cmd === 'roll') {
    const raw = interaction.options.getString('expression') || '1d20';
    const parsed = parseRoll(raw);
    if (parsed.err) return interaction.reply({ content: `Error: ${parsed.err}`, flags: 64 });
    const rollResult = await buildRollEmbed(parsed, parsed.tokens, username, userId);
    return interaction.reply(rollResult);
  }

  // /daily
  if (cmd === 'daily') {
    const p = getPlayer(userId);
    const today = getDayKey();
    if (p.last_daily === today) return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle('Daily').setDescription('รับแล้ววันนี้ครับ มาใหม่ตี 4!')], flags: 64 });
    const yest = new Date(Date.now() + 7*60*60*1000);
    yest.setUTCDate(yest.getUTCDate() - 1);
    if (yest.getUTCHours() < 4) yest.setUTCDate(yest.getUTCDate() - 1);
    const yestKey = yest.toISOString().slice(0, 10);
    const streak = p.last_daily === yestKey ? (p.streak % 7) + 1 : 1;
    const reward = DAILY_REWARDS[streak - 1];
    const updates = { streak, last_daily: today };
    if (reward.type === 'gold') updates.gold = p.gold + reward.amount;
    if (reward.type === 'rc')   updates.rc   = p.rc   + reward.amount;
    if (reward.type === 'item')  updates.inv_reroll = (p.inv_reroll || 0) + 1;
    updatePlayer(userId, updates);
    const trackSegs = Array.from({length:7}, (_,i) => {
      if (i < streak - 1) return '`✓`';
      if (i === streak - 1) return '**`★`**';
      return '`·`';
    }).join(' ');
    const nextInfo = streak < 7 ? `พรุ่งนี้: **${DAILY_LABELS[streak]}**` : '**ครบ 7 วัน! Streak รีเซ็ต** 🎉';
    const freshDaily = getPlayer(userId);
    const balanceStr = reward.type === 'rc'
      ? `RC: **${freshDaily.rc.toLocaleString()}**`
      : reward.type === 'item'
      ? `Re-roll: **x${freshDaily.inv_reroll || 0}**`
      : `Gold: **${freshDaily.gold.toLocaleString()}**`;
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x56CCF2)
        .setTitle('🏇 Daily Login')
        .addFields(
          { name: `STREAK ${streak} / 7`, value: trackSegs, inline: false },
          { name: '🎁 รางวัลวันนี้', value: `**${DAILY_LABELS[streak-1]}**`, inline: true },
          { name: '💰 ยอดคงเหลือ', value: balanceStr, inline: true },
          { name: '⏭ ถัดไป', value: nextInfo, inline: false },
        )]
    });
  }

  // /inventory
  if (cmd === 'inventory') {
    await interaction.deferReply();
    const p = getPlayer(userId);
    const buffer = await generateInventoryCard(p, username, 1);
    const attachment = { attachment: buffer, name: 'inventory.png' };
    const embed = new EmbedBuilder().setColor(getBundleColor()).setImage('attachment://inventory.png');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`inv_p1_${userId}`).setLabel('📊 Economy').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`inv_p2_${userId}`).setLabel('👤 Profile').setStyle(ButtonStyle.Secondary),
    );
    return interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
  }

  // /convert
  if (cmd === 'convert') {
    const amount = interaction.options.getInteger('amount');
    const p = getPlayer(userId);
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, flags: 64 });
    if (amount % EXCHANGE_RATE !== 0) return interaction.reply({ content: `ต้องแลกเป็นทวีคูณของ ${EXCHANGE_RATE} ครับ`, flags: 64 });
    const rc = amount / EXCHANGE_RATE;
    updatePlayer(userId, { gold: p.gold - amount, rc: p.rc + rc });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle('แลกเงิน')
        .setDescription(`แลก **${amount.toLocaleString()} Gold** → **${rc.toLocaleString()} RC** แล้วครับ\nRC ทั้งหมด: **${(p.rc + rc).toLocaleString()}**`)]
    });
  }

  // /use
  if (cmd === 'use') {
    const amount = interaction.options.getInteger('amount') || 1;
    const p = getPlayer(userId);
    if ((p.inv_reroll || 0) < amount) return interaction.reply({ content: `Re-roll ไม่พอครับ (มี ${p.inv_reroll || 0})`, flags: 64 });
    updatePlayer(userId, { inv_reroll: p.inv_reroll - amount });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle('ใช้ Re-roll')
        .setDescription(`ใช้ Re-roll x${amount} แล้วครับ\nเหลือ: **x${p.inv_reroll - amount}**`)]
    });
  }

  // /equip — Select Menu
  if (cmd === 'equip') {
    const p = getPlayer(userId);
    const owned = getOwnedBundles(userId);
    if (owned.length === 0) return interaction.reply({ content: 'ยังไม่มี bundle ครับ', flags: 64 });
    const options = owned.map(id => {
      const b = getBundle(id);
      if (!b) return null;
      const isEquipped = p.equipped_bundle === id;
      return new StringSelectMenuOptionBuilder()
        .setLabel(b.name + (isEquipped ? ' ✦' : ''))
        .setDescription(isEquipped ? 'กำลังใส่อยู่' : (b.isSpecial ? 'Special Bundle' : `Gallop Collection · ${b.horse || ''}`))
        .setValue(id);
    }).filter(Boolean);
    const select = new StringSelectMenuBuilder()
      .setCustomId(`equip_select_${userId}`)
      .setPlaceholder('เลือก bundle ที่ต้องการใส่...')
      .addOptions(options);
    const row = new ActionRowBuilder().addComponents(select);
    const currentBundle = getBundle(p.equipped_bundle);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle('✦ เปลี่ยน Bundle')
        .addFields(
          { name: 'Bundle ปัจจุบัน', value: currentBundle ? `**${currentBundle.name}**` : 'Default', inline: false },
          { name: 'Bundle ในคลัง', value: `${owned.length} ชิ้น`, inline: false },
        )
        .setFooter({ text: 'เลือกจาก dropdown ด้านล่าง' })],
      components: [row]
    });
  }

  // /transfer
  if (cmd === 'transfer') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (target.id === userId) return interaction.reply({ content: 'โอนให้ตัวเองไม่ได้ครับ', flags: 64 });
    const p = getPlayer(userId);
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, flags: 64 });
    updatePlayer(userId, { gold: p.gold - amount });
    const tp = getPlayer(target.id);
    updatePlayer(target.id, { gold: tp.gold + amount });
    const freshP = getPlayer(userId);
    const senderAvatar = interaction.user.displayAvatarURL({ size: 64 });
    const receiverAvatar = target.displayAvatarURL({ size: 64 });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57f287)
        .setTitle('💸 Transfer Complete')
        .setThumbnail(receiverAvatar)
        .addFields(
          { name: '📤 ผู้โอน', value: `<@${userId}>`, inline: true },
          { name: '📥 ผู้รับ', value: `<@${target.id}>`, inline: true },
          { name: '​', value: '​', inline: true },
          { name: '💰 จำนวน', value: `**${amount.toLocaleString()} Gold** 🪙`, inline: true },
          { name: '🏦 คงเหลือ', value: `**${freshP.gold.toLocaleString()} Gold**`, inline: true },
        )
        .setAuthor({ name: username, iconURL: senderAvatar })
        .setFooter({ text: '✓ COMPLETED' })]
    });
  }

  // /coinflip
  if (cmd === 'coinflip') {
    const amount = interaction.options.getInteger('amount');
    const choice = interaction.options.getString('choice');
    const p = getPlayer(userId);
    if (amount < MIN_BET) return interaction.reply({ content: `เดิมพันขั้นต่ำ ${MIN_BET.toLocaleString()} Gold ครับ`, flags: 64 });
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, flags: 64 });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, flags: 64 });
    const result = randF() < 0.42 ? choice : (choice === 'heads' ? 'tails' : 'heads');
    const win = result === choice;
    const choiceEmoji = choice === 'heads' ? '☀️ HEADS' : '🌙 TAILS';
    const resultEmoji = result === 'heads' ? '☀️ HEADS' : '🌙 TAILS';
    if (win) {
      const w = applyWin(userId, amount, 2);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287)
          .setTitle('🪙 Coinflip — ชนะ!')
          .addFields(
            { name: 'คุณเลือก', value: choiceEmoji, inline: true },
            { name: 'ผลออก', value: `**${resultEmoji}**`, inline: true },
            { name: '​', value: '​', inline: true },
            { name: '💰 ได้รับ', value: `+${w.profit.toLocaleString()} Gold`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${w.gold.toLocaleString()} Gold**`, inline: true },
          )]
      });
    }
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245)
        .setTitle('🪙 Coinflip — แพ้')
        .addFields(
          { name: 'คุณเลือก', value: choiceEmoji, inline: true },
          { name: 'ผลออก', value: `**${resultEmoji}**`, inline: true },
          { name: '​', value: '​', inline: true },
          { name: '💸 เสีย', value: `-${amount.toLocaleString()} Gold`, inline: true },
          { name: '🏦 ยอดรวม', value: `**${loss.gold.toLocaleString()} Gold**`, inline: true },
        )]
      });
  }

  // /slots
  if (cmd === 'slots') {
    const amount = interaction.options.getInteger('amount');
    const p = getPlayer(userId);
    if (amount < MIN_BET) return interaction.reply({ content: `เดิมพันขั้นต่ำ ${MIN_BET.toLocaleString()} Gold ครับ`, flags: 64 });
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, flags: 64 });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, flags: 64 });

    const win = randF() < 0.18;
    const reels = win ? [spinSlot(), null, null] : [spinSlot(), spinSlot(), spinSlot()];
    if (win) {
      reels[1] = reels[0]; reels[2] = reels[0];
    } else {
      reels[1] = spinSlot(); reels[2] = spinSlot();
      // ป้องกัน 3 ตัวเหมือนกันตอนแพ้
      while (reels[0] === reels[1] && reels[1] === reels[2]) reels[2] = spinSlot();
    }
    const reelStr = reels.map(r => SLOT_EMOJI[r]).join(' ');

    if (win && reels[0] === 'seven') {
      // Jackpot
      const pool = getPool();
      const jackpot = pool * JACKPOT_MULT;
      const taxed = Math.floor(jackpot * (1 - TAX));
      const fresh = getPlayer(userId);
      updatePlayer(userId, { gold: fresh.gold + taxed });
      setPool(0);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🎰 7 7 7 — JACKPOT!!!')
          .addFields(
            { name: '🎰 Reels', value: `${reelStr}`, inline: false },
            { name: '🏆 Jackpot Pool', value: `${pool.toLocaleString()} × ${JACKPOT_MULT}`, inline: true },
            { name: '💰 ได้รับ', value: `+${taxed.toLocaleString()} Gold`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${(fresh.gold + taxed).toLocaleString()} Gold**`, inline: false },
          )]
      });
    }
    if (win) {
      const mult = SLOT_MULT[reels[0]];
      const w = applyWin(userId, amount, mult);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎰 Slots — ชนะ!')
          .addFields(
            { name: '🎰 Reels', value: `${reelStr}`, inline: false },
            { name: '✨ Multiplier', value: `**${mult}x**`, inline: true },
            { name: '💰 ได้รับ', value: `+${w.profit.toLocaleString()} Gold`, inline: true },
            { name: '🎯 Jackpot Pool', value: `${getPool().toLocaleString()} 🪙`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${w.gold.toLocaleString()} Gold**`, inline: false },
          )]
      });
    }
    // แพ้ — เพิ่ม pool
    const contrib = Math.floor(amount * POOL_CONTRIB);
    setPool(getPool() + contrib);
    const freshP = getPlayer(userId);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🎰 Slots — แพ้')
        .addFields(
          { name: '🎰 Reels', value: `${reelStr}`, inline: false },
          { name: '💸 เสีย', value: `-${amount.toLocaleString()} Gold`, inline: true },
          { name: '🎯 Jackpot Pool', value: `${getPool().toLocaleString()} 🪙`, inline: true },
          { name: '🏦 ยอดรวม', value: `**${freshP.gold.toLocaleString()} Gold**`, inline: false },
        )]
    });
  }

  // /blackjack
  if (cmd === 'blackjack') {
    const amount = interaction.options.getInteger('amount');
    const p = getPlayer(userId);
    if (amount < MIN_BET) return interaction.reply({ content: `เดิมพันขั้นต่ำ ${MIN_BET.toLocaleString()} Gold ครับ`, flags: 64 });
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, flags: 64 });
    if (bjGames.has(userId)) return interaction.reply({ content: 'มีเกมค้างอยู่ครับ', flags: 64 });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, flags: 64 });
    const deck = makeDeck();
    const player_hand = [deck.pop(), deck.pop()];
    const dealer_hand = [deck.pop(), deck.pop()];
    bjGames.set(userId, { deck, player: player_hand, dealer: dealer_hand, amount, startTime: Date.now() });
    const pv = handVal(player_hand);
    if (pv === 21) {
      bjGames.delete(userId);
      const w = applyWin(userId, amount, 2.5);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🃏 BLACKJACK! 21! 🎉')
          .addFields(
            { name: 'ไพ่คุณ', value: player_hand.map(c => cardStr(c)).join(' '), inline: false },
            { name: '💰 ได้รับ', value: `+${w.profit.toLocaleString()} Gold (2.5x!)`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${w.gold.toLocaleString()} Gold**`, inline: true },
          )]
      });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_dbl_${userId}`).setLabel('Double Hit 2x').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack')
        .addFields(
          { name: 'Dealer', value: `${cardStr(dealer_hand[0])} ??`, inline: true },
          { name: `คุณ (${pv})`, value: player_hand.map(c => cardStr(c)).join(' '), inline: true },
        )
        .setFooter({ text: 'Double Hit = จั่ว 2 ใบ Stand อัตโนมัติ · ชนะได้ 2x' })],
      components: [row]
    });
  }

  // /roulette
  if (cmd === 'roulette') {
    const amount = interaction.options.getInteger('amount');
    const bet = interaction.options.getString('bet').toLowerCase();
    const p = getPlayer(userId);
    if (amount < MIN_BET) return interaction.reply({ content: `เดิมพันขั้นต่ำ ${MIN_BET.toLocaleString()} Gold ครับ`, flags: 64 });
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, flags: 64 });
    const validBets = ['red','black','odd','even','1-18','19-36',...Array.from({length:37},(_,i)=>String(i))];
    if (!validBets.includes(bet)) return interaction.reply({ content: 'เดิมพันไม่ถูกต้องครับ', flags: 64 });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, flags: 64 });
    const n = rand(0, 36);
    const color = roulColor(n);
    const emoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
    const win = roulWin(bet, n);
    const pay = roulPay(bet);
    if (win) {
      const w = applyWin(userId, amount, pay);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎡 Roulette — ชนะ!')
          .addFields(
            { name: 'ลูกหยุดที่', value: `${emoji} **${n}**`, inline: true },
            { name: 'เดิมพัน', value: `**${bet}** (x${pay})`, inline: true },
            { name: '​', value: '​', inline: true },
            { name: '💰 ได้รับ', value: `+${w.profit.toLocaleString()} Gold`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${w.gold.toLocaleString()} Gold**`, inline: true },
          )]
      });
    }
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🎡 Roulette — แพ้')
        .addFields(
          { name: 'ลูกหยุดที่', value: `${emoji} **${n}**`, inline: true },
          { name: 'เดิมพัน', value: `**${bet}**`, inline: true },
          { name: '​', value: '​', inline: true },
          { name: '💸 เสีย', value: `-${amount.toLocaleString()} Gold`, inline: true },
          { name: '🏦 ยอดรวม', value: `**${loss.gold.toLocaleString()} Gold**`, inline: true },
        )]
    });
  }

  // /help
  if (cmd === 'help') {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle("St. Elmo's Fire v7.0 — Help")
        .addFields(
          { name: '🎲 ลูกเต๋า', value: '`!r 2d30` — ทอยด่วน\n`/roll expression` — ทอยผ่าน slash command\nรองรับ `kh` `kl` `advantage` `disadvantage`', inline: false },
          { name: '💰 เศรษฐกิจ', value: '`/daily` — รับรางวัลประจำวัน (รีเซ็ตตี 4)\n`/inventory` — ดูกระเป๋าสตางค์และไอเทม\n`/convert amount` — แลก 3 Gold = 1 RC\n`/use` — ใช้ Re-roll\n`/transfer @user amount` — โอน Gold ให้สมาชิก', inline: false },
          { name: '✦ Bundle', value: '`/shop` — ดู Gallop Collection และซื้อ bundle (2,500 RC)\n`/equip` — เลือกใส่ bundle จาก dropdown', inline: false },
          { name: '🎰 การพนัน', value: '`/coinflip amount` — ทอยเหรียญ หัว/ก้อย (42% ชนะ 2x)\n`/slots amount` — สล็อต (18% ชนะ + Progressive Jackpot)\n`/blackjack amount` — แบล็คแจ็ค dealer hits to 18\n`/roulette amount bet` — รูเล็ต (2x–36x)', inline: false },
          { name: '👤 Profile', value: '`/profile set` — ตั้งชื่อตัวละคร ทีม และเทรนเนอร์', inline: false },
          { name: '⚙️ Staff', value: '`/give` `/take` — แจก/ลบเงิน\n`/gift` — แจก bundle หรือ Re-roll (รับ @user หรือ @role)\n`/revoke` — ลบ item\n`/inspect @user` — ดู inventory สมาชิก\n`/showcase @user` — ตั้ง Race Showcase', inline: false },
        )]
    });
  }

  // /shop
  if (cmd === 'shop') {
    const p = getPlayer(userId);
    const owned = getOwnedBundles(userId);

    const gallopEntries = Object.entries(GALLOP_BUNDLES);
    const options = gallopEntries.map(([id, b]) => {
      const isOwned = owned.includes(id);
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${b.name}${isOwned ? ' ✅' : ''}`)
        .setDescription(`${b.horse} · ${isOwned ? 'มีแล้ว' : `${BUNDLE_PRICE.toLocaleString()} RC`}`)
        .setValue(id);
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId(`shop_buy_${userId}`)
      .setPlaceholder('เลือก bundle ที่ต้องการซื้อ...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    const desc = gallopEntries.map(([id, b]) => {
      const isOwned = owned.includes(id);
      return `${isOwned ? '✅' : '🔒'} **${b.name}** — ${isOwned ? 'มีแล้ว' : `${BUNDLE_PRICE.toLocaleString()} RC`}\n↳ *${b.horse}*`;
    }).join('\n\n');

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor())
        .setTitle('🐴 Gallop Collection')
        .setDescription(`RC ของคุณ: **${p.rc.toLocaleString()} RC**\n\n${desc}`)
        .setFooter({ text: 'เลือกจาก dropdown ด้านล่างเพื่อซื้อ' })],
      components: [row]
    });
  }

  // /profile set
  if (cmd === 'profile') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const name    = interaction.options.getString('name');
      const team    = interaction.options.getString('team');
      const trainer = interaction.options.getString('trainer');
      if (!name && !team && !trainer) return interaction.reply({ content: 'กรุณาใส่อย่างน้อย 1 อย่างครับ', flags: 64 });
      const updates = {};
      if (name)    updates.char_name    = name;
      if (team)    updates.team_name    = team;
      if (trainer) updates.trainer_name = trainer;
      // ensure profile row exists
      getProfile(userId);
      const keys = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE profiles SET ${keys} WHERE user_id = ?`).run(...Object.values(updates), userId);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle('✦ Profile Updated')
          .setDescription(`อัพเดท profile แล้วครับ!\n${name ? `ชื่อตัวละคร: **${name}**\n` : ''}${team ? `ทีม: **${team}**\n` : ''}${trainer ? `เทรนเนอร์: **${trainer}**` : ''}`)]
      });
    }
  }

  // Staff: /give
  if (cmd === 'give') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', flags: 64 });
    await interaction.deferReply();
    const target = interaction.options.getMentionable('targets');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const guild = interaction.guild;
    await guild.members.fetch();

    const targetIds = new Set();
    if (target.members) {
      target.members.forEach(m => targetIds.add(m.id));
    } else if (target.id) {
      targetIds.add(target.id);
    }

    if (targetIds.size === 0) return interaction.editReply({ content: 'ไม่พบ user หรือ role ที่ระบุครับ' });

    let successCount = 0;
    for (const tid of targetIds) {
      try {
        const tp = getPlayer(tid);
        updatePlayer(tid, { [currency]: (tp[currency] || 0) + amount });
        successCount++;
      } catch (e) { console.error('Give error for ' + tid + ':', e); }
    }

    const currencyLabel = currency === 'gold' ? 'Gold 🪙' : 'RC 🌈';
    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('[Staff] Give')
        .setDescription(`แจก **${amount.toLocaleString()} ${currencyLabel}** ให้ ${successCount} คน เรียบร้อยแล้วครับ`)]
    });
  }

  // Staff: /gift (รับ user หรือ role)
  if (cmd === 'gift') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', flags: 64 });
    await interaction.deferReply();
    const target = interaction.options.getMentionable('targets');
    const item = interaction.options.getString('item');
    const guild = interaction.guild;
    await guild.members.fetch();

    const targetIds = new Set();
    if (target.members) {
      // เป็น Role
      target.members.forEach(m => targetIds.add(m.id));
    } else if (target.id) {
      // เป็น User
      targetIds.add(target.id);
    }

    if (targetIds.size === 0) return interaction.editReply({ content: 'ไม่พบ user หรือ role ที่ระบุครับ' });

    let successCount = 0;
    for (const tid of targetIds) {
      try {
        const tp = getPlayer(tid);
        const giftAmount = interaction.options.getInteger('amount') || 1;
        if (item === 'reroll') {
          updatePlayer(tid, { inv_reroll: (tp.inv_reroll || 0) + giftAmount });
        } else if (item === 'race_reroll') {
          updatePlayer(tid, { race_reroll: (tp.race_reroll ?? 1) + giftAmount });
        } else if (item === 'race_safe') {
          updatePlayer(tid, { race_safe: (tp.race_safe ?? 0) + giftAmount });
        } else if (ALL_BUNDLES[item]) {
          addBundle(tid, item);
        }
        successCount++;
      } catch (e) { console.error(`Gift error for ${tid}:`, e); }
    }

    const bundle = ALL_BUNDLES[item];
    const giftAmt = interaction.options.getInteger('amount') || 1;
    const itemLabel = { reroll: `Re-roll x${giftAmt}`, race_reroll: `Race Reroll x${giftAmt}`, race_safe: `Race Safe x${giftAmt}` }[item] || (bundle ? bundle.name : item);
    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('[Staff] Gift')
        .setDescription(`แจก **${itemLabel}** ให้ ${successCount} คน เรียบร้อยแล้วครับ`)]
    });
  }

  // Staff: /take
  if (cmd === 'take') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', flags: 64 });
    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    const newVal = Math.max(0, tp[currency] - amount);
    updatePlayer(target.id, { [currency]: newVal });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('[Staff] Take')
        .setDescription(`ลบ **${amount.toLocaleString()} ${currency === 'gold' ? 'Gold' : 'RC'}** จาก <@${target.id}> แล้วครับ`)]
    });
  }

  // Staff: /revoke
  if (cmd === 'revoke') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', flags: 64 });
    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (item === 'reroll') {
      updatePlayer(target.id, { inv_reroll: Math.max(0, (tp.inv_reroll || 0) - amount) });
    }
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('[Staff] Revoke')
        .setDescription(`ลบ **${item} x${amount}** จาก <@${target.id}> แล้วครับ`)]
    });
  }

  // Staff: /inspect
  if (cmd === 'inspect') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', flags: 64 });
    await interaction.deferReply({ flags: 64 });
    const target = interaction.options.getUser('user');
    const tp = getPlayer(target.id);
    const owned = getOwnedBundles(target.id);
    const profile = getProfile(target.id);
    const bar = Array.from({length:7}, (_,i) => i < tp.streak ? '⭐' : '☆').join(' ');
    const bundleList = owned.map(id => ALL_BUNDLES[id]?.name || id).join(', ') || 'ไม่มี';

    const buffer = await generateInventoryCard(tp, target.username, 1);
    const attachment = { attachment: buffer, name: 'inspect.png' };
    const embed = new EmbedBuilder().setColor(0xffa500)
      .setTitle(`[Staff] Inspect — ${target.username}`)
      .addFields(
        { name: 'ยอดเงิน', value: `Gold: **${tp.gold.toLocaleString()}**\nRC: **${tp.rc.toLocaleString()}**\nชนะวันนี้: ${tp.win_today.toLocaleString()}/${WIN_CAP.toLocaleString()}`, inline: true },
        { name: 'Items', value: `Re-roll: x${tp.inv_reroll || 0}`, inline: true },
        { name: 'Daily Streak', value: `${bar}\n${tp.streak}/7`, inline: true },
        { name: 'Bundle ปัจจุบัน', value: ALL_BUNDLES[tp.equipped_bundle]?.name || 'Default', inline: true },
        { name: 'Bundles ทั้งหมด', value: bundleList, inline: false },
        { name: 'Profile', value: `ชื่อ: ${profile.char_name || '—'}\nทีม: ${profile.team_name || '—'}\nเทรนเนอร์: ${profile.trainer_name || '—'}`, inline: false },
      )
      .setImage('attachment://inspect.png');
    return interaction.editReply({ embeds: [embed], files: [attachment] });
  }

  // Staff: /showcase
  if (cmd === 'showcase') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', flags: 64 });
    const target = interaction.options.getUser('user');
    const slot = interaction.options.getInteger('slot');
    const race  = interaction.options.getString('race');
    const rank  = interaction.options.getString('rank');
    const grade = interaction.options.getString('grade');
    const year  = interaction.options.getString('year');
    getProfile(target.id);
    const prefix = `showcase_${slot}`;
    if (race.toLowerCase() === 'clear') {
      db.prepare(`UPDATE profiles SET ${prefix}_race='', ${prefix}_rank='', ${prefix}_grade='', ${prefix}_year='' WHERE user_id=?`).run(target.id);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('[Staff] Showcase Cleared')
          .setDescription(`ลบ showcase ช่อง ${slot} ของ <@${target.id}> แล้วครับ`)]
      });
    }
    const rankVal  = rank  || '';
    const gradeVal = grade || '';
    const yearVal  = year  || '';
    db.prepare(`UPDATE profiles SET ${prefix}_race=?, ${prefix}_rank=?, ${prefix}_grade=?, ${prefix}_year=? WHERE user_id=?`)
      .run(race, rankVal, gradeVal, yearVal, target.id);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('[Staff] Showcase Updated')
        .setDescription(`อัพเดท showcase ช่อง ${slot} ของ <@${target.id}> แล้วครับ\n**${race}** — ${rankVal} (${gradeVal} · ${yearVal})`)]
    });
  }
}

// ══════════════════════════════════════════════
//  SELECT MENU HANDLER (Shop)
// ══════════════════════════════════════════════
async function handleSelect(interaction) {
  const id = interaction.customId;
  const userId = interaction.user.id;

  // Equip select
  if (id.startsWith('equip_select_')) {
    if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่ของคุณครับ', flags: 64 });
    const bundleId = interaction.values[0];
    const bundle = getBundle(bundleId);
    if (!bundle) return interaction.reply({ content: 'ไม่พบ bundle ครับ', flags: 64 });
    const owned = getOwnedBundles(userId);
    if (!owned.includes(bundleId)) return interaction.reply({ content: 'ยังไม่มี bundle นี้ครับ', flags: 64 });
    updatePlayer(userId, { equipped_bundle: bundleId });
    const color = parseInt(bundle.emblemColor.replace('#',''), 16);
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(color).setTitle('✦ Equip Bundle')
        .setDescription(`ใส่ **${bundle.name}** แล้วครับ!`)],
      components: []
    });
  }

  if (id.startsWith('shop_buy_')) {
    if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่ shop ของคุณครับ', flags: 64 });
    const bundleId = interaction.values[0];
    const bundle = GALLOP_BUNDLES[bundleId];
    if (!bundle) return interaction.reply({ content: 'ไม่พบ bundle ครับ', flags: 64 });

    const owned = getOwnedBundles(userId);
    if (owned.includes(bundleId)) return interaction.reply({ content: `มี **${bundle.name}** อยู่แล้วครับ`, flags: 64 });

    const p = getPlayer(userId);
    if (p.rc < BUNDLE_PRICE) return interaction.reply({
      content: `RC ไม่พอครับ (มี ${p.rc.toLocaleString()} / ต้องการ ${BUNDLE_PRICE.toLocaleString()})`, flags: 64 });

    // Confirm button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_confirm_${userId}_${bundleId}`).setLabel('✅ ยืนยันซื้อ').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`shop_cancel_${userId}`).setLabel('❌ ยกเลิก').setStyle(ButtonStyle.Danger),
    );

    const ec = hexToRgb(bundle.emblemColor);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(parseInt(bundle.emblemColor.slice(1), 16))
        .setTitle(`ยืนยันการซื้อ`)
        .setDescription(`กำลังจะซื้อ **${bundle.name}**\nม้า: *${bundle.horse}*\n\nราคา: **${BUNDLE_PRICE.toLocaleString()} RC**\nRC ที่มี: **${p.rc.toLocaleString()} RC**\nRC หลังซื้อ: **${(p.rc - BUNDLE_PRICE).toLocaleString()} RC**`)],
      components: [row], flags: 64 });
  }
}

// ══════════════════════════════════════════════
//  BUTTON HANDLER
// ══════════════════════════════════════════════
async function handleButton(interaction) {
  const id = interaction.customId;
  const userId = interaction.user.id;

  // Inventory page toggle
  if (id.startsWith('inv_p1_') || id.startsWith('inv_p2_')) {
    const targetUser = id.split('_')[2];
    if (targetUser !== userId) return interaction.reply({ content: 'นี่ไม่ใช่ inventory ของคุณครับ', flags: 64 });
    const page = id.startsWith('inv_p1_') ? 1 : 2;
    await interaction.deferUpdate();
    const p = getPlayer(userId);
    const buffer = await generateInventoryCard(p, interaction.member?.displayName || interaction.user.username, page);
    const attachment = { attachment: buffer, name: 'inventory.png' };
    const bundle = getBundle(p.equipped_bundle);
    const color = bundle ? parseInt(bundle.emblemColor.slice(1), 16) : 0x444444;
    const embed = new EmbedBuilder().setColor(color).setImage('attachment://inventory.png');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`inv_p1_${userId}`).setLabel('📊 Economy').setStyle(page === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`inv_p2_${userId}`).setLabel('👤 Profile').setStyle(page === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );
    return interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
  }

  // Shop confirm
  if (id.startsWith('shop_confirm_')) {
    const parts = id.split('_');
    const targetUser = parts[2];
    const bundleId = parts.slice(3).join('_');
    if (targetUser !== userId) return interaction.reply({ content: 'นี่ไม่ใช่ shop ของคุณครับ', flags: 64 });

    const bundle = GALLOP_BUNDLES[bundleId];
    if (!bundle) return interaction.reply({ content: 'ไม่พบ bundle ครับ', flags: 64 });

    const p = getPlayer(userId);
    const owned = getOwnedBundles(userId);
    if (owned.includes(bundleId)) return interaction.update({ content: `มี **${bundle.name}** อยู่แล้วครับ`, components: [], embeds: [] });
    if (p.rc < BUNDLE_PRICE) return interaction.update({ content: `RC ไม่พอแล้วครับ`, components: [], embeds: [] });

    updatePlayer(userId, { rc: p.rc - BUNDLE_PRICE });
    addBundle(userId, bundleId);

    return interaction.update({
      embeds: [new EmbedBuilder().setColor(parseInt(bundle.emblemColor.slice(1), 16))
        .setTitle('✦ ซื้อ Bundle สำเร็จ!')
        .setDescription(`ได้รับ **${bundle.name}** แล้วครับ!\n-${BUNDLE_PRICE.toLocaleString()} RC\nRC เหลือ: **${(p.rc - BUNDLE_PRICE).toLocaleString()}**\n\nใช้ \`/equip\` เพื่อใส่ bundle ได้เลยครับ`)],
      components: []
    });
  }

  // Shop cancel
  if (id.startsWith('shop_cancel_')) {
    return interaction.update({ content: 'ยกเลิกแล้วครับ', components: [], embeds: [] });
  }

  // Blackjack
  if (!id.startsWith('bj_')) return;
  if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่เกมของคุณครับ', flags: 64 });
  const game = bjGames.get(userId);
  if (!game) return interaction.reply({ content: 'หมดเวลาแล้วครับ', flags: 64 });

  if (id.startsWith('bj_hit_')) {
    game.player.push(game.deck.pop());
    const pv = handVal(game.player);
    if (pv > 21) {
      bjGames.delete(userId);
      const fresh = getPlayer(userId);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🃏 Blackjack — แพ้ (Bust)')
          .addFields(
            { name: `คุณ (${pv})`, value: game.player.map(c => cardStr(c)).join(' '), inline: false },
            { name: '💸 เสีย', value: `-${game.amount.toLocaleString()} Gold`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${fresh.gold.toLocaleString()} Gold**`, inline: true },
          )],
        components: []
      });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_dbl_${userId}`).setLabel('Double Hit 2x').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack')
        .addFields(
          { name: 'Dealer', value: `${cardStr(game.dealer[0])} ??`, inline: true },
          { name: `คุณ (${pv})`, value: game.player.map(c => cardStr(c)).join(' '), inline: true },
        )
        .setFooter({ text: 'Double Hit = จั่ว 2 ใบ Stand อัตโนมัติ · ชนะได้ 2x' })],
      components: [row]
    });
  }

  if (id.startsWith('bj_dbl_')) {
    // Double Hit — จั่ว 2 ใบ stand อัตโนมัติ ชนะได้ 2x
    game.player.push(game.deck.pop());
    game.player.push(game.deck.pop());
    bjGames.delete(userId);
    const pv = handVal(game.player);
    if (pv > 21) {
      const fresh = getPlayer(userId);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🃏 Blackjack — แพ้ (Bust)')
          .addFields(
            { name: `คุณ (${pv})`, value: game.player.map(c => cardStr(c)).join(' '), inline: false },
            { name: '💸 เสีย', value: `-${game.amount.toLocaleString()} Gold`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${fresh.gold.toLocaleString()} Gold**`, inline: true },
          )],
        components: []
      });
    }
    while (handVal(game.dealer) < 18) game.dealer.push(game.deck.pop());
    const dv = handVal(game.dealer);
    const dStr = game.dealer.map(c => cardStr(c)).join(' ');
    const pStr = game.player.map(c => cardStr(c)).join(' ');
    if (dv > 21 || pv > dv) {
      const w = applyWin(userId, game.amount, 4); // 2x payout = 4x mult
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🃏 Blackjack — Double Hit ชนะ! 🎉')
          .addFields(
            { name: `Dealer (${dv})`, value: dStr, inline: true },
            { name: `คุณ (${pv})`, value: pStr, inline: true },
            { name: '💰 ได้รับ', value: `+${w.profit.toLocaleString()} Gold (2x!)`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${w.gold.toLocaleString()} Gold**`, inline: true },
          )],
        components: []
      });
    }
    if (pv === dv) {
      const p2 = getPlayer(userId);
      updatePlayer(userId, { gold: p2.gold + game.amount });
      const fresh2 = getPlayer(userId);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack — เสมอ')
          .addFields(
            { name: `Dealer (${dv})`, value: dStr, inline: true },
            { name: `คุณ (${pv})`, value: pStr, inline: true },
            { name: '🏦 คืนเงิน', value: `**${fresh2.gold.toLocaleString()} Gold**`, inline: false },
          )],
        components: []
      });
    }
    const freshL = getPlayer(userId);
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🃏 Blackjack — แพ้')
        .addFields(
          { name: `Dealer (${dv})`, value: dStr, inline: true },
          { name: `คุณ (${pv})`, value: pStr, inline: true },
          { name: '💸 เสีย', value: `-${game.amount.toLocaleString()} Gold`, inline: true },
          { name: '🏦 ยอดรวม', value: `**${freshL.gold.toLocaleString()} Gold**`, inline: true },
        )],
      components: []
    });
  }

  if (id.startsWith('bj_stand_')) {
    bjGames.delete(userId);
    while (handVal(game.dealer) < 18) game.dealer.push(game.deck.pop());
    const pv = handVal(game.player), dv = handVal(game.dealer);
    const dStr = `Dealer (${dv}): ${game.dealer.map(c => cardStr(c)).join(' ')}`;
    const pStr = `คุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`;
    if (dv > 21 || pv > dv) {
      const w = applyWin(userId, game.amount, 2);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🃏 Blackjack — ชนะ!')
          .addFields(
            { name: `Dealer (${dv})`, value: dStr, inline: true },
            { name: `คุณ (${pv})`, value: pStr, inline: true },
            { name: '💰 ได้รับ', value: `+${w.profit.toLocaleString()} Gold`, inline: true },
            { name: '🏦 ยอดรวม', value: `**${w.gold.toLocaleString()} Gold**`, inline: true },
          )],
        components: []
      });
    }
    if (pv === dv) {
      const p = getPlayer(userId);
      updatePlayer(userId, { gold: p.gold + game.amount });
      const fresh = getPlayer(userId);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack — เสมอ')
          .addFields(
            { name: `Dealer (${dv})`, value: dStr, inline: true },
            { name: `คุณ (${pv})`, value: pStr, inline: true },
            { name: '🏦 คืนเงิน', value: `**${fresh.gold.toLocaleString()} Gold**`, inline: false },
          )],
        components: []
      });
    }
    const fresh = getPlayer(userId);
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🃏 Blackjack — แพ้')
        .addFields(
          { name: `Dealer (${dv})`, value: dStr, inline: true },
          { name: `คุณ (${pv})`, value: pStr, inline: true },
          { name: '💸 เสีย', value: `-${game.amount.toLocaleString()} Gold`, inline: true },
          { name: '🏦 ยอดรวม', value: `**${fresh.gold.toLocaleString()} Gold**`, inline: true },
        )],
      components: []
    });
  }
}

client.login(process.env.DISCORD_TOKEN);
