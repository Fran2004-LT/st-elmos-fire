// index.js — St. Elmo's Fire v6.0
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
const CANVAS_FONT = existsSync(FONT_PATH) ? 'NotoSans' : 'sans-serif';

// ══════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════
const PREFIX        = '!r';
const TAX           = 0.03;
const WIN_CAP       = 10000;
const POOL_CAP      = 30000;
const JACKPOT_MULT  = 10;
const POOL_CONTRIB  = 0.05;
const STARTING_GOLD = 1500;
const EXCHANGE_RATE = 3;
const STAFF_ROLE    = 'Staff';
const OWNER_ID      = process.env.OWNER_ID || '';
const BOTNAME       = "St. Elmo's Fire";
const BUNDLE_PRICE  = 2500; // RC

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
    emblemColor: '#F5F0E8',
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
    // White ivory
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, W, H);
    // subtle glow
    const g1 = ctx.createRadialGradient(W*0.15, H*0.4, 0, W*0.15, H*0.4, W*0.5);
    g1.addColorStop(0, 'rgba(109,213,160,0.06)');
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W*0.85, H*0.7, 0, W*0.85, H*0.7, W*0.5);
    g2.addColorStop(0, 'rgba(249,168,201,0.06)');
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
    // G1 watermark
    ctx.save();
    ctx.font = `bold ${H * 0.55}px ${CANVAS_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(212,175,55,0.07)';
    ctx.fillText('G1', W * 0.75, H * 0.72);
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
    // Ivory
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, W, H);
    // vine pattern
    ctx.strokeStyle = 'rgba(26,110,46,0.04)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 18) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(92,51,23,0.03)';
    for (let i = -H; i < W + H; i += 18) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - H, H); ctx.stroke();
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
  const W = 460, H = 110;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bundle = getBundle(bundleKey);
  const bgType = bundle ? bundle.bgType : 'default';
  const emblemColor = bundle ? bundle.emblemColor : '#444444';
  const bundleName = bundle ? bundle.name : 'Default';
  const isLight = bgType === 'debut' || bgType === 'gallop_mejiro';

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
  ctx.fillStyle = emblemColor;
  ctx.fillRect(0, 0, 5, H);
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
  ctx.arc(30, H/2, 16, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = isLight ? '#1a1200' : '#fff';
  ctx.font = `bold 13px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(username.charAt(0).toUpperCase(), 30, H/2 + 5);
  ctx.textAlign = 'left';

  // Username
  ctx.fillStyle = textColor;
  ctx.font = `bold 13px ${CANVAS_FONT}`;
  ctx.fillText(username, 54, H/2 - 14);

  // Bundle name
  ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.7)`;
  ctx.font = `10px ${CANVAS_FONT}`;
  ctx.fillText(bundleName, 54, H/2 + 2);

  // Divider
  ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.25)`;
  ctx.fillRect(W*0.38, H*0.2, 1, H*0.6);

  // Expression + breakdown
  ctx.fillStyle = dimColor;
  ctx.font = `bold 10px ${CANVAS_FONT}`;
  ctx.fillText(expr, W*0.41, H/2 - 10);
  ctx.fillStyle = dimColor2;
  ctx.font = `10px ${CANVAS_FONT}`;
  ctx.fillText(breakdown.slice(0, 30), W*0.41, H/2 + 6);

  // Grand total
  ctx.textAlign = 'right';
  ctx.font = `bold 52px ${CANVAS_FONT}`;
  // gradient text for total
  const totalGrad = ctx.createLinearGradient(W-10, 0, W-10, H);
  totalGrad.addColorStop(0, emblemColor);
  totalGrad.addColorStop(1, isLight ? '#888' : '#aaaaaa');
  ctx.fillStyle = totalGrad;
  ctx.fillText(`${grand}`, W - 16, H - 16);

  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

// ══════════════════════════════════════════════
//  INVENTORY CARD GENERATOR
// ══════════════════════════════════════════════
async function generateInventoryCard(player, username, page = 1) {
  const W = 520;
  const bundleKey = player.equipped_bundle || 'default';
  const bundle = getBundle(bundleKey);
  const bgType = bundle ? bundle.bgType : 'default';
  const emblemColor = bundle ? bundle.emblemColor : '#444444';
  const bundleName = bundle ? bundle.name : 'Default';
  const isLight = bgType === 'debut' || bgType === 'gallop_mejiro';
  const isSpecial = bundle ? bundle.isSpecial : false;
  const H = page === 1 ? (isSpecial ? 365 : 340) : 280;
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
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.8)`;
    ctx.font = `9px ${CANVAS_FONT}`;
    ctx.fillText(`✦ ${bundleName}`, bx + 8, by + 11);

    // Streak top right
    ctx.fillStyle = `rgba(${ec.r},${ec.g},${ec.b},0.8)`;
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

    // ── ITEMS ──
    const itemY = 196;
    const itemW = (W - 52) / 3;

    const ownedBundleCount = db.prepare('SELECT COUNT(*) as cnt FROM owned_bundles WHERE user_id = ?').get(player.user_id)?.cnt || 0;
    const items = [
      { icon: '🎲', val: `×${player.inv_reroll || 0}`, label: 'RE-ROLL' },
      { icon: '✦', val: `${ownedBundleCount}`, label: 'BUNDLES' },
      { icon: '🏇', val: `${player.streak}/7`, label: 'STREAK' },
    ];

    items.forEach((item, i) => {
      const ix = 20 + i * (itemW + 6);
      ctx.fillStyle = boxBg;
      drawRoundRect(ctx, ix, itemY, itemW, 46, 8);
      ctx.fill();
      ctx.strokeStyle = boxBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `18px ${CANVAS_FONT}`;
      ctx.fillText(item.icon, ix + 10, itemY + 30);
      ctx.font = `bold 16px ${CANVAS_FONT}`;
      ctx.fillStyle = textColor;
      ctx.fillText(item.val, ix + 34, itemY + 26);
      ctx.font = `8px ${CANVAS_FONT}`;
      ctx.fillStyle = dimColor2;
      ctx.fillText(item.label, ix + 34, itemY + 38);
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
    const footerY = isSpecial ? 308 : 252;
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
  let allResults = [];

  for (const t of tokens) {
    if (t.type === 'op') { sign = t.value; continue; }
    if (t.type === 'num') { grand += sign * t.value; lines.push(`${sign > 0 ? '+' : '-'}${t.value}`); sign = 1; continue; }
    if (t.type === 'dice') {
      let rolls = rollDice(t.num, t.sides);
      let kept = rolls;
      if (mode === 'adv')  { rolls = rollDice(t.num, t.sides); kept = [Math.max(...rolls, ...kept)]; }
      if (mode === 'dis')  { rolls = rollDice(t.num, t.sides); kept = [Math.min(...rolls, ...kept)]; }
      if (t.keep) {
        const sorted = [...rolls].sort((a,b) => b-a);
        kept = t.keep.type === 'kh' ? sorted.slice(0, t.keep.n) : sorted.slice(sorted.length - t.keep.n);
      }
      const sum = kept.reduce((a,b) => a+b, 0);
      grand += sign * sum;
      allResults.push(...kept);
      lines.push(`${sign < 0 ? '-' : ''}[${rolls.join(', ')}${t.keep ? ` → keep ${t.keep.type.toUpperCase()}${t.keep.n}: ${kept.join(', ')}` : ''}] = ${sign * sum}`);
      sign = 1;
    }
  }
  return { lines, grand };
}

async function buildRollEmbed(parsed, tokens, username, userId) {
  const { lines, grand } = buildDiceText(parsed, tokens);
  const p = getPlayer(userId);
  const bundleKey = p.equipped_bundle || 'default';
  const expr = parsed.rollName || tokens.map(t => t.type === 'dice' ? `${t.num}d${t.sides}` : (t.type === 'op' ? (t.value > 0 ? '+' : '-') : t.value)).join('');
  const breakdown = lines.join(' · ');

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
    textLines.push(...lines);
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
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('gift').setDescription('[Staff] แจก bundle หรือ item')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(o => o.setName('targets').setDescription('@user หรือ @role (หลายคนได้)').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('bundle_id หรือ reroll').setRequired(true)),

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
    .addStringOption(o => o.setName('race').setDescription('ชื่อการแข่ง').setRequired(true))
    .addStringOption(o => o.setName('rank').setDescription('อันดับ เช่น 1st').setRequired(true))
    .addStringOption(o => o.setName('grade').setDescription('เกรด เช่น G1').setRequired(true))
    .addStringOption(o => o.setName('year').setDescription('ปี เช่น 2026').setRequired(true)),

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
  ],
});

client.once('clientReady', async () => {
  console.log(`${BOTNAME} v6.0 online: ${client.user.tag}`);
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
    const rep = { content: 'Error: กรุณาลองใหม่ครับ', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(rep);
    else await interaction.reply(rep);
  }
});

// ══════════════════════════════════════════════
//  COMMAND HANDLERS
// ══════════════════════════════════════════════
async function handleSlash(interaction) {
  const cmd = interaction.commandName;
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
    if (parsed.err) return interaction.reply({ content: `Error: ${parsed.err}`, ephemeral: true });
    const rollResult = await buildRollEmbed(parsed, parsed.tokens, username, userId);
    return interaction.reply(rollResult);
  }

  // /daily
  if (cmd === 'daily') {
    const p = getPlayer(userId);
    const today = getDayKey();
    if (p.last_daily === today) return interaction.reply({
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle('Daily').setDescription('รับแล้ววันนี้ครับ มาใหม่ตี 4!')],
      ephemeral: true
    });
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
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, ephemeral: true });
    if (amount % EXCHANGE_RATE !== 0) return interaction.reply({ content: `ต้องแลกเป็นทวีคูณของ ${EXCHANGE_RATE} ครับ`, ephemeral: true });
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
    if ((p.inv_reroll || 0) < amount) return interaction.reply({ content: `Re-roll ไม่พอครับ (มี ${p.inv_reroll || 0})`, ephemeral: true });
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
    if (owned.length === 0) return interaction.reply({ content: 'ยังไม่มี bundle ครับ', ephemeral: true });
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
    if (target.id === userId) return interaction.reply({ content: 'โอนให้ตัวเองไม่ได้ครับ', ephemeral: true });
    const p = getPlayer(userId);
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, ephemeral: true });
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
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, ephemeral: true });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
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
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, ephemeral: true });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });

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
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, ephemeral: true });
    if (bjGames.has(userId)) return interaction.reply({ content: 'มีเกมค้างอยู่ครับ', ephemeral: true });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
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
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ`, ephemeral: true });
    const validBets = ['red','black','odd','even','1-18','19-36',...Array.from({length:37},(_,i)=>String(i))];
    if (!validBets.includes(bet)) return interaction.reply({ content: 'เดิมพันไม่ถูกต้องครับ', ephemeral: true });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
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
      embeds: [new EmbedBuilder().setColor(getBundleColor()).setTitle("St. Elmo's Fire v6.0 — Help")
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
      if (!name && !team && !trainer) return interaction.reply({ content: 'กรุณาใส่อย่างน้อย 1 อย่างครับ', ephemeral: true });
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
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    updatePlayer(target.id, { [currency]: tp[currency] + amount });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('[Staff] Give')
        .setDescription(`แจก **${amount.toLocaleString()} ${currency === 'gold' ? 'Gold 🪙' : 'RC 🌈'}** ให้ <@${target.id}> แล้วครับ`)]
    });
  }

  // Staff: /gift (รับ user หรือ role)
  if (cmd === 'gift') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    await interaction.deferReply();
    const targetsStr = interaction.options.getString('targets');
    const item = interaction.options.getString('item');
    const guild = interaction.guild;
    await guild.members.fetch();

    // Parse mentions — user หรือ role
    const userMentions = [...targetsStr.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
    const roleMentions = [...targetsStr.matchAll(/<@&(\d+)>/g)].map(m => m[1]);

    const targetIds = new Set(userMentions);
    for (const roleId of roleMentions) {
      const role = guild.roles.cache.get(roleId);
      if (role) role.members.forEach(m => targetIds.add(m.id));
    }

    if (targetIds.size === 0) return interaction.editReply({ content: 'ไม่พบ user หรือ role ที่ระบุครับ' });

    let successCount = 0;
    for (const tid of targetIds) {
      try {
        const tp = getPlayer(tid);
        if (item === 'reroll') {
          updatePlayer(tid, { inv_reroll: (tp.inv_reroll || 0) + 1 });
        } else if (ALL_BUNDLES[item]) {
          addBundle(tid, item);
        }
        successCount++;
      } catch (e) { console.error(`Gift error for ${tid}:`, e); }
    }

    const bundle = ALL_BUNDLES[item];
    const itemName = bundle ? bundle.name : item;
    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('[Staff] Gift')
        .setDescription(`แจก **${itemName}** ให้ ${successCount} คน เรียบร้อยแล้วครับ`)]
    });
  }

  // Staff: /take
  if (cmd === 'take') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
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
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
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
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
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
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const slot = interaction.options.getInteger('slot');
    const race  = interaction.options.getString('race');
    const rank  = interaction.options.getString('rank');
    const grade = interaction.options.getString('grade');
    const year  = interaction.options.getString('year');
    getProfile(target.id);
    const prefix = `showcase_${slot}`;
    db.prepare(`UPDATE profiles SET ${prefix}_race=?, ${prefix}_rank=?, ${prefix}_grade=?, ${prefix}_year=? WHERE user_id=?`)
      .run(race, rank, grade, year, target.id);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('[Staff] Showcase Updated')
        .setDescription(`อัพเดท showcase ช่อง ${slot} ของ <@${target.id}> แล้วครับ\n**${race}** — ${rank} (${grade} · ${year})`)]
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
    if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่ของคุณครับ', ephemeral: true });
    const bundleId = interaction.values[0];
    const bundle = getBundle(bundleId);
    if (!bundle) return interaction.reply({ content: 'ไม่พบ bundle ครับ', ephemeral: true });
    const owned = getOwnedBundles(userId);
    if (!owned.includes(bundleId)) return interaction.reply({ content: 'ยังไม่มี bundle นี้ครับ', ephemeral: true });
    updatePlayer(userId, { equipped_bundle: bundleId });
    const color = parseInt(bundle.emblemColor.replace('#',''), 16);
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(color).setTitle('✦ Equip Bundle')
        .setDescription(`ใส่ **${bundle.name}** แล้วครับ!`)],
      components: []
    });
  }

  if (id.startsWith('shop_buy_')) {
    if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่ shop ของคุณครับ', ephemeral: true });
    const bundleId = interaction.values[0];
    const bundle = GALLOP_BUNDLES[bundleId];
    if (!bundle) return interaction.reply({ content: 'ไม่พบ bundle ครับ', ephemeral: true });

    const owned = getOwnedBundles(userId);
    if (owned.includes(bundleId)) return interaction.reply({ content: `มี **${bundle.name}** อยู่แล้วครับ`, ephemeral: true });

    const p = getPlayer(userId);
    if (p.rc < BUNDLE_PRICE) return interaction.reply({
      content: `RC ไม่พอครับ (มี ${p.rc.toLocaleString()} / ต้องการ ${BUNDLE_PRICE.toLocaleString()})`,
      ephemeral: true
    });

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
      components: [row],
      ephemeral: true
    });
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
    if (targetUser !== userId) return interaction.reply({ content: 'นี่ไม่ใช่ inventory ของคุณครับ', ephemeral: true });
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
    if (targetUser !== userId) return interaction.reply({ content: 'นี่ไม่ใช่ shop ของคุณครับ', ephemeral: true });

    const bundle = GALLOP_BUNDLES[bundleId];
    if (!bundle) return interaction.reply({ content: 'ไม่พบ bundle ครับ', ephemeral: true });

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
  if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่เกมของคุณครับ', ephemeral: true });
  const game = bjGames.get(userId);
  if (!game) return interaction.reply({ content: 'หมดเวลาแล้วครับ', ephemeral: true });

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
