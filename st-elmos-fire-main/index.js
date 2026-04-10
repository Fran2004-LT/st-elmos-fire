// index.js — St. Elmo's Fire v4.0
// Full system: Roll, Economy, Gambling, Emblem, Banner, Gacha
// CSPRNG: crypto.randomInt() | Storage: SQLite

import {
  Client, GatewayIntentBits, EmbedBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { randomInt } from 'crypto';
import Database from 'better-sqlite3';
import 'dotenv/config';
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';

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
//  COLLECTION DATA
// ══════════════════════════════════════════════
const EMBLEMS = {
  // Common
  mars_ruber:           { name: 'Mars Ruber',           color: 0x8B2500, rarity: 'C', collection: 'divinitas' },
  neptunus_caeruleus:   { name: 'Neptunus Caeruleus',   color: 0x0F52BA, rarity: 'C', collection: 'divinitas' },
  silvanus_viridis:     { name: 'Silvanus Viridis',     color: 0x046307, rarity: 'C', collection: 'divinitas' },
  bacchus_purpura:      { name: 'Bacchus Purpura',      color: 0x6A0DAD, rarity: 'C', collection: 'divinitas' },
  // Rare
  apollo_aureus:        { name: 'Apollo Aureus',        color: 0xFFC857, rarity: 'R', collection: 'divinitas' },
  venus_cyanis:         { name: 'Venus Cyanis',         color: 0x4EE3C1, rarity: 'R', collection: 'divinitas' },
  pluto_nox:            { name: 'Pluto Nox',            color: 0x3D1A4F, rarity: 'R', collection: 'divinitas' },
  ceres_flavus:         { name: 'Ceres Flavus',         color: 0x8DB600, rarity: 'R', collection: 'divinitas' },
  // Super Rare
  juno_regalis:         { name: 'Juno Regalis',         color: 0x4B0082, rarity: 'SR', collection: 'divinitas' },
  jupiter_rex:          { name: 'Jupiter Rex',          color: 0x002366, rarity: 'SR', collection: 'divinitas' },
  mercurius_noctis:     { name: 'Mercurius Noctis',     color: 0x014D4E, rarity: 'SR', collection: 'divinitas' },
  // Ultra Rare
  horus_nebula_rubra:   { name: 'Horus Nebula Rubra',  color: 0x9B0F3A, rarity: 'UR', collection: 'divinitas' },
  // Eclipse
  aurum_imperialis:     { name: 'Aurum Imperialis',    color: 0xD4AF37, rarity: 'Eclipse', collection: 'divinitas' },
};

const BANNER_BASE = 'https://raw.githubusercontent.com/Fran2004-LT/st-elmos-fire/main/assets/banners';

const BANNERS = {
  // Common
  turing_calm:     { name: 'Turing Calm',    img: `${BANNER_BASE}/Turing_Calm.png`,     gradient: ['#E8B4B8','#CDB4DB'],                     rarity: 'C',       collection: 'lofy' },
  euler_light:     { name: 'Euler Light',    img: `${BANNER_BASE}/Euler_Light.png`,     gradient: ['#BDE0FE','#A7C7E7'],                     rarity: 'C',       collection: 'lofy' },
  bernoulli_flow:  { name: 'Bernoulli Flow', img: `${BANNER_BASE}/Bernoulli_Flow.png`,  gradient: ['#D8F3DC','#BDE0FE'],                     rarity: 'C',       collection: 'lofy' },
  gauss_base:      { name: 'Gauss Base',     img: `${BANNER_BASE}/Gauss_Base.png`,      gradient: ['#F5E6CC','#EDE0D4'],                     rarity: 'C',       collection: 'lofy' },
  // Rare
  noether_balance: { name: 'Noether Balance',img: `${BANNER_BASE}/Noether_Balance.png`, gradient: ['#DEC4E8','#C4E8DC'],                     rarity: 'R',       collection: 'lofy' },
  pascal_rise:     { name: 'Pascal Rise',    img: `${BANNER_BASE}/Pascal_Rise.png`,     gradient: ['#FFB4A2','#FFD6A5'],                     rarity: 'R',       collection: 'lofy' },
  hilbert_space:   { name: 'Hilbert Space',  img: `${BANNER_BASE}/Hilbert_Space.png`,   gradient: ['#D6CADD','#CDB4DB'],                     rarity: 'R',       collection: 'lofy' },
  fourier_wave:    { name: 'Fourier Wave',   img: `${BANNER_BASE}/Fourier_Wave.png`,    gradient: ['#CFE8F9','#D8F3DC'],                     rarity: 'R',       collection: 'lofy' },
  // Super Rare
  tesla_pulse:     { name: 'Tesla Pulse',    img: `${BANNER_BASE}/Tesla_Pulse.png`,     gradient: ['#E8B4B8','#BDE0FE','#CDB4DB'],           rarity: 'SR',      collection: 'lofy' },
  curie_glow:      { name: 'Curie Glow',     img: `${BANNER_BASE}/Curie_Glow.png`,     gradient: ['#D8F3DC','#F5E6CC','#FFB4A2'],           rarity: 'SR',      collection: 'lofy' },
  feynman_drift:   { name: 'Feynman Drift',  img: `${BANNER_BASE}/Feynman_Drift.png`,  gradient: ['#CFE8F9','#E8B4B8'],                     rarity: 'SR',      collection: 'lofy' },
  // Ultra Rare
  einstein_horizon:{ name: 'Einstein Horizon',img: `${BANNER_BASE}/Einstein_Horizon.png`,gradient:['#F2F0FF','#E8F0FF','#FDECEF'],          rarity: 'UR',      collection: 'lofy' },
  // Eclipse
  newton_prime:    { name: 'Newton Prime',   img: `${BANNER_BASE}/Newton_Prime.png`,   gradient: ['#FFB4A2','#BDE0FE','#CDB4DB','#D8F3DC'], rarity: 'Eclipse', collection: 'lofy' },
};

// All emblem keys by rarity for gacha
const EMBLEM_POOL = {
  C:  ['mars_ruber','neptunus_caeruleus','silvanus_viridis','bacchus_purpura'],
  R:  ['apollo_aureus','venus_cyanis','pluto_nox','ceres_flavus'],
  SR: ['juno_regalis','jupiter_rex','mercurius_noctis'],
  UR: ['horus_nebula_rubra'],
};
const BANNER_POOL = {
  C:  ['turing_calm','euler_light','bernoulli_flow','gauss_base'],
  R:  ['noether_balance','pascal_rise','hilbert_space','fourier_wave'],
  SR: ['tesla_pulse','curie_glow','feynman_drift'],
  UR: ['einstein_horizon'],
};

const RARITY_LABEL = { C: '⬜ Common', R: '💙 Rare', SR: '💜 Super Rare', UR: '✨ Ultra Rare', Eclipse: '🌑 Eclipse' };

// Box rates [C, R, SR, UR, Salt] in %
const BOX_RATES = {
  divinitas_normal:  { cost: 150,  rates: [45, 25, 10,  2, 18], jackpot: 1/300000, multi_guarantee: 'R'  },
  divinitas_mid:     { cost: 300,  rates: [25, 30, 22,  8, 15], jackpot: 1/150000, multi_guarantee: 'SR' },
  divinitas_umazing: { cost: 1500, rates: [ 0, 20, 55, 25,  0], jackpot: 1/30000,  multi_guarantee: 'UR' },
  lofy_normal:       { cost: 150,  rates: [45, 25, 10,  2, 18], jackpot: 1/300000, multi_guarantee: 'R'  },
  lofy_mid:          { cost: 300,  rates: [25, 30, 22,  8, 15], jackpot: 1/150000, multi_guarantee: 'SR' },
  lofy_umazing:      { cost: 1500, rates: [ 0, 20, 55, 25,  0], jackpot: 1/30000,  multi_guarantee: 'UR' },
};

const BOX_NAMES = {
  divinitas_normal:  'Divinitas Gemma Normal',
  divinitas_mid:     'Divinitas Gemma Mid',
  divinitas_umazing: 'Divinitas Gemma UMAZING',
  lofy_normal:       'Lofy Harmonic Normal',
  lofy_mid:          'Lofy Harmonic Mid',
  lofy_umazing:      'Lofy Harmonic UMAZING',
};

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
    inv_emblem_shard INTEGER DEFAULT 0,
    inv_banner_shard INTEGER DEFAULT 0,
    box_divinitas_normal  INTEGER DEFAULT 0,
    box_divinitas_mid     INTEGER DEFAULT 0,
    box_divinitas_umazing INTEGER DEFAULT 0,
    box_lofy_normal       INTEGER DEFAULT 0,
    box_lofy_mid          INTEGER DEFAULT 0,
    box_lofy_umazing      INTEGER DEFAULT 0,
    equipped_emblem TEXT DEFAULT 'default',
    equipped_banner TEXT DEFAULT 'default',
    pity_divinitas  INTEGER DEFAULT 0,
    pity_lofy       INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS owned_emblems (
    user_id   TEXT,
    emblem_id TEXT,
    PRIMARY KEY (user_id, emblem_id)
  );

  CREATE TABLE IF NOT EXISTS owned_banners (
    user_id   TEXT,
    banner_id TEXT,
    PRIMARY KEY (user_id, banner_id)
  );

  CREATE TABLE IF NOT EXISTS jackpot (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    pool  INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO jackpot (id, pool) VALUES (1, 0);
`);

function getDayKey() {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (ict.getUTCHours() < 4) ict.setUTCDate(ict.getUTCDate() - 1);
  return ict.toISOString().slice(0, 10);
}

function getPlayer(userId) {
  let p = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  if (!p) {
    db.prepare('INSERT INTO players (user_id) VALUES (?)').run(userId);
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

function getOwnedEmblems(userId) {
  return db.prepare('SELECT emblem_id FROM owned_emblems WHERE user_id = ?').all(userId).map(r => r.emblem_id);
}
function getOwnedBanners(userId) {
  return db.prepare('SELECT banner_id FROM owned_banners WHERE user_id = ?').all(userId).map(r => r.banner_id);
}
function addEmblem(userId, emblemId) {
  db.prepare('INSERT OR IGNORE INTO owned_emblems (user_id, emblem_id) VALUES (?, ?)').run(userId, emblemId);
}
function addBanner(userId, bannerId) {
  db.prepare('INSERT OR IGNORE INTO owned_banners (user_id, banner_id) VALUES (?, ?)').run(userId, bannerId);
}

function checkCollectionComplete(userId, type) {
  if (type === 'divinitas') {
    const owned = getOwnedEmblems(userId);
    const all = [...Object.keys(EMBLEM_POOL.C), ...Object.keys(EMBLEM_POOL.R), ...Object.keys(EMBLEM_POOL.SR), ...Object.keys(EMBLEM_POOL.UR)];
    return all.every(e => owned.includes(e));
  } else {
    const owned = getOwnedBanners(userId);
    const all = [...Object.keys(BANNER_POOL.C), ...Object.keys(BANNER_POOL.R), ...Object.keys(BANNER_POOL.SR), ...Object.keys(BANNER_POOL.UR)];
    return all.every(b => owned.includes(b));
  }
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
//  GACHA ENGINE
// ══════════════════════════════════════════════
function rollGacha(boxId, userId, isMulti = false, multiIndex = 0, totalMulti = 1, guaranteeRarity = null) {
  const box = BOX_RATES[boxId];
  const isEmblem = boxId.startsWith('divinitas');
  const pool = isEmblem ? EMBLEM_POOL : BANNER_POOL;
  const pityKey = isEmblem ? 'pity_divinitas' : 'pity_lofy';
  const p = getPlayer(userId);

  // Check Complete Set Jackpot
  if (randF() < box.jackpot) {
    return { type: 'complete_set', isEmblem };
  }

  // Pity check (soft 80, hard 100)
  let forceUR = false;
  if (p[pityKey] >= 99) forceUR = true;
  else if (p[pityKey] >= 79 && randF() < 0.5) forceUR = true;

  // Multi-pull guarantee on last pull
  const isLastPull = isMulti && multiIndex === totalMulti - 1;

  // Rate up for multi
  const rateBonus = isMulti ? 2 : 0;
  let [rC, rR, rSR, rUR, rSalt] = box.rates.map((r, i) => i < 4 ? r + rateBonus : r - rateBonus * 4);
  rSalt = Math.max(0, rSalt);

  // Gold/Shard reward
  const bonusGold = rand(50, 500);
  const bonusShard = rand(1, 5);

  let rarity;
  if (forceUR) {
    rarity = 'UR';
  } else if (isLastPull && guaranteeRarity) {
    rarity = guaranteeRarity;
  } else {
    const roll = randF() * 100;
    if (roll < rUR) rarity = 'UR';
    else if (roll < rUR + rSR) rarity = 'SR';
    else if (roll < rUR + rSR + rR) rarity = 'R';
    else if (roll < rUR + rSR + rR + rC) rarity = 'C';
    else rarity = 'Salt';
  }

  // Update pity
  if (rarity === 'UR') updatePlayer(userId, { [pityKey]: 0 });
  else updatePlayer(userId, { [pityKey]: p[pityKey] + 1 });

  if (rarity === 'Salt') {
    // Salt = shard or gold
    const saltType = randF() < 0.5 ? 'shard' : 'gold';
    return { type: 'salt', saltType, bonusGold, bonusShard, isEmblem };
  }

  // Pick item from pool
  const poolItems = pool[rarity];
  const picked = poolItems[rand(0, poolItems.length - 1)];

  // Check duplicate
  const owned = isEmblem ? getOwnedEmblems(userId) : getOwnedBanners(userId);
  const isDupe = owned.includes(picked);

  if (!isDupe) {
    if (isEmblem) addEmblem(userId, picked);
    else addBanner(userId, picked);
  }

  return { type: 'item', rarity, picked, isDupe, bonusGold, isEmblem };
}

function formatGachaResult(result, isEmblem) {
  const data = isEmblem ? EMBLEMS[result.picked] : BANNERS[result.picked];
  if (result.type === 'salt') {
    if (result.saltType === 'shard') return `🧂 ${isEmblem ? 'Emblem' : 'Banner'} Shard x${result.bonusShard}`;
    return `🧂 Gold +${result.bonusGold}`;
  }
  if (result.type === 'complete_set') return `🌟 **COMPLETE SET JACKPOT!!!**`;
  const label = RARITY_LABEL[result.rarity];
  const dupe = result.isDupe ? ' *(ซ้ำ → +1 Shard)*' : '';
  return `${label} **${data.name}**${dupe}`;
}

// ══════════════════════════════════════════════
//  DICE PARSER
// ══════════════════════════════════════════════
function parseRoll(raw) {
  let str = raw.trim();
  let mode = 'normal';
  if (/\badv\b/i.test(str)) { mode = 'adv'; str = str.replace(/\badv\b/i, '').trim(); }
  else if (/\bdis\b/i.test(str)) { mode = 'dis'; str = str.replace(/\bdis\b/i, '').trim(); }
  const tags = [];
  str = str.replace(/\[([^\]]*)\]/g, (_, t) => { tags.push(t.trim()); return ''; }).trim();
  let rollName = '';
  const trailMatch = str.match(/^([d0-9khl+\-*/().\s]+?)\s{1,}([a-zA-Z\u0E00-\u0E7F][^\d].*)$/);
  if (trailMatch) { rollName = trailMatch[2].trim(); str = trailMatch[1].trim(); }
  str = str.toLowerCase().replace(/\s+/g, '');
  if (!str) str = '1d20';
  const result = parseExpr(str, mode);
  if (result.err) return result;
  return { ...result, tags, rollName, mode };
}

function parseExpr(str, mode) {
  if (mode !== 'normal') {
    const dm = str.match(/^(\d*)d(\d+)((?:kh|kl)\d+)?([+\-].*)?$/);
    if (dm) return parseExpr(`2d${parseInt(dm[2])}${mode === 'adv' ? 'kh1' : 'kl1'}${dm[4] || ''}`, 'normal');
  }
  const tokens = [];
  let i = 0, sign = 1, depth = 0, cur = '';
  while (i <= str.length) {
    const ch = str[i];
    if (i === str.length || ((ch === '+' || ch === '-') && depth === 0 && i > 0)) {
      if (cur) { const seg = parseSegment(cur, sign); if (seg.err) return seg; tokens.push(seg); cur = ''; }
      if (i < str.length) sign = ch === '+' ? 1 : -1;
      i++; continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth < 0) return { err: 'วงเล็บปิดเกินมา' }; }
    cur += ch; i++;
  }
  if (depth !== 0) return { err: 'วงเล็บไม่สมดุล' };
  if (!tokens.length) return { err: 'Expression ว่างเปล่า' };
  return { tokens };
}

function parseSegment(raw, sign) {
  const pm = raw.match(/^\((.+)\)\*(\d+)$/);
  if (pm) { const sub = parseExpr(pm[1], 'normal'); if (sub.err) return sub; return { type: 'multiply', sign, tokens: sub.tokens, mult: parseInt(pm[2]) }; }
  const sm = raw.match(/^(.+)\*(\d+)$/) || raw.match(/^(\d+)\*(.+)$/);
  if (sm) { const iR = /^\d+$/.test(sm[2]); const sub = parseSegment(iR ? sm[1] : sm[2], 1); if (sub.err) return sub; return { type: 'multiply', sign, tokens: [sub], mult: parseInt(iR ? sm[2] : sm[1]) }; }
  const dm = raw.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/);
  if (dm) {
    const num = parseInt(dm[1] || '1'), sides = parseInt(dm[2]);
    const mode = dm[3] || 'normal', keep = dm[4] ? parseInt(dm[4]) : num;
    if (num < 1 || num > 100)       return { err: `จำนวนลูกเต๋าต้อง 1-100 (${raw})` };
    if (sides < 2 || sides > 10000) return { err: `จำนวนหน้าต้อง 2-10000 (${raw})` };
    if (keep < 1 || keep > num)     return { err: `keep ต้อง 1-${num} (${raw})` };
    return { type: 'dice', sign, num, sides, mode, keep };
  }
  if (/^\d+$/.test(raw)) return { type: 'flat', sign, value: parseInt(raw) };
  return { err: `ไม่รู้จัก: ${raw}` };
}

function rollSegment(seg) {
  if (seg.type === 'flat') return { type: 'flat', sign: seg.sign, value: seg.value, total: seg.value * seg.sign };
  if (seg.type === 'multiply') {
    const sr = seg.tokens.map(t => rollSegment(t));
    const st = sr.reduce((a, r) => a + r.total, 0);
    return { type: 'multiply', sign: seg.sign, mult: seg.mult, subResults: sr, subTotal: st, total: st * seg.mult * seg.sign };
  }
  const { num, sides, mode, keep } = seg;
  const rolls = Array.from({ length: num }, () => rand(1, sides));
  const indexed = rolls.map((v, i) => ({ v, i }));
  let sel;
  if (mode === 'normal') sel = indexed;
  else if (mode === 'kh') sel = [...indexed].sort((a, b) => b.v - a.v || a.i - b.i).slice(0, keep);
  else sel = [...indexed].sort((a, b) => a.v - b.v || a.i - b.i).slice(0, keep);
  const kept = new Set(sel.map(x => x.i));
  const sub = sel.reduce((a, x) => a + x.v, 0);
  return { type: 'dice', sign: seg.sign, rolls, kept, sub, total: sub * seg.sign, sides, mode, keep, num };
}

function formatDice(r) {
  return r.rolls.map((v, i) => {
    if (!r.kept.has(i)) return `~~${v}~~`;
    if (v === r.sides)  return `__**${v}**__`;
    return `**${v}**`;
  }).join('\u2003');
}

function getEmblemColor(userId) {
  const p = getPlayer(userId);
  const emblem = p.equipped_emblem;
  if (emblem === 'default') return userId === OWNER_ID ? 0x9B59B6 : 0x111111;
  return EMBLEMS[emblem]?.color || 0x111111;
}

function buildDiceText(parsed, tokens) {
  const results = tokens.map(t => rollSegment(t));
  const grand = results.reduce((a, r) => a + r.total, 0);
  const isMulti = results.length > 1;
  const lines = [];
  if (parsed.mode === 'adv') lines.push('ADVANTAGE');
  if (parsed.mode === 'dis') lines.push('DISADVANTAGE');
  for (const r of results) {
    if (r.type === 'flat') { lines.push(`${r.sign < 0 ? '-' : '+'} ${r.value} (modifier)`); continue; }
    if (r.type === 'multiply') {
      for (const sr of r.subResults) {
        if (sr.type === 'dice') {
          let ex = `${sr.num}d${sr.sides}`;
          if (sr.mode === 'kh') ex += ` kh${sr.keep}`;
          if (sr.mode === 'kl') ex += ` kl${sr.keep}`;
          const rolled = sr.rolls.map((v,i) => sr.kept.has(i) ? v : `[${v}]`).join(' ');
          lines.push(`${ex}: ${rolled}`);
        }
      }
      lines.push(`x${r.mult} = ${r.sign < 0 ? '-' : ''}${Math.abs(r.total)}`); continue;
    }
    let ex = `${r.num}d${r.sides}`;
    if (r.mode === 'kh') ex += ` kh${r.keep}`;
    if (r.mode === 'kl') ex += ` kl${r.keep}`;
    const tags = parsed.tags.length ? ` [${parsed.tags.join(', ')}]` : '';
    const sub = isMulti ? ` = ${r.sign < 0 ? '-' : ''}${Math.abs(r.sub)}` : '';
    const rolled = r.rolls.map((v,i) => r.kept.has(i) ? (v === r.sides ? `*${v}*` : `${v}`) : `[${v}]`).join(' ');
    lines.push(`${ex}${tags}: ${rolled}${sub}`);
  }
  return { lines, grand };
}

async function generateBannerCard(bannerImg, username, expr, grand, breakdown, emblemColor) {
  const W = 520, H = 160;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Draw banner background
  try {
    const img = await loadImage(bannerImg);
    ctx.drawImage(img, 0, 0, W, H);
  } catch (e) {
    // fallback gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#2d2d44');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Dark overlay left side for readability
  const overlay = ctx.createLinearGradient(0, 0, W * 0.75, 0);
  overlay.addColorStop(0, 'rgba(8,6,18,0.88)');
  overlay.addColorStop(0.5, 'rgba(8,6,18,0.55)');
  overlay.addColorStop(1, 'rgba(8,6,18,0)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // Emblem color bar left
  const hexColor = '#' + emblemColor.toString(16).padStart(6, '0');
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 4, H);

  // Username
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText(`@${username}`, 18, 26);

  // Expression
  ctx.fillStyle = 'rgba(187,136,255,0.55)';
  ctx.font = '10px monospace';
  ctx.fillText(expr, 18, 44);

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(18, 52, 48, 1);

  // Grand total
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(`${grand}`, 18, 108);

  // Breakdown
  ctx.fillStyle = 'rgba(187,136,255,0.6)';
  ctx.font = '11px monospace';
  const breakStr = breakdown.slice(0, 45);
  ctx.fillText(breakStr, 18, 130);

  return canvas.toBuffer('image/png');
}

async function buildRollEmbed(parsed, tokens, username, userId) {
  const { lines, grand } = buildDiceText(parsed, tokens);
  const p = getPlayer(userId);
  const emblemColor = getEmblemColor(userId);
  const hasBanner = p.equipped_banner !== 'default' && BANNERS[p.equipped_banner]?.img;

  if (hasBanner) {
    try {
      const bannerData = BANNERS[p.equipped_banner];
      const expr = parsed.rollName || `${tokens.map(t => t.type === 'dice' ? `${t.num}d${t.sides}` : t.value).join('+')}`;
      const breakdown = lines.join(' · ');
      const buffer = await generateBannerCard(bannerData.img, username, expr, grand, breakdown, emblemColor);
      const attachment = { attachment: buffer, name: 'roll.png' };
      const embed = new EmbedBuilder().setColor(emblemColor).setImage('attachment://roll.png');
      return { embeds: [embed], files: [attachment] };
    } catch (e) {
      console.error('Canvas error:', e);
    }
  }

  // Fallback: text embed
  const textLines = [];
  if (parsed.mode === 'adv') textLines.push('`ADVANTAGE`');
  if (parsed.mode === 'dis') textLines.push('`DISADVANTAGE`');
  textLines.push(...lines);
  textLines.push(`\n@${username}\u2003**${grand}**`);
  const embed = new EmbedBuilder().setColor(emblemColor).setDescription(textLines.join('\n'));
  return { embeds: [embed] };
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

// BJ timeout — ยกเลิกเกมที่ค้างนานเกิน 5 นาที
setInterval(() => {
  const now = Date.now();
  for (const [userId, game] of bjGames.entries()) {
    if (now - game.startTime > 5 * 60 * 1000) {
      bjGames.delete(userId);
      // คืนเงินเดิมพัน
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
function roulPay(bet) { return ['red','black','odd','even','1-18','19-36'].includes(bet) ? 2 : 36; }

// ══════════════════════════════════════════════
//  SLASH COMMANDS
// ══════════════════════════════════════════════
const BOX_CHOICES = [
  { name: 'Divinitas Normal (150 RC)',    value: 'divinitas_normal'  },
  { name: 'Divinitas Mid (300 RC)',       value: 'divinitas_mid'     },
  { name: 'Divinitas UMAZING (1500 RC)', value: 'divinitas_umazing' },
  { name: 'Lofy Normal (150 RC)',         value: 'lofy_normal'       },
  { name: 'Lofy Mid (300 RC)',            value: 'lofy_mid'          },
  { name: 'Lofy UMAZING (1500 RC)',      value: 'lofy_umazing'      },
];

const USE_CHOICES = [
  { name: 'Re-roll',                      value: 'reroll'            },
  { name: 'Divinitas Normal Box',         value: 'divinitas_normal'  },
  { name: 'Divinitas Mid Box',            value: 'divinitas_mid'     },
  { name: 'Divinitas UMAZING Box',        value: 'divinitas_umazing' },
  { name: 'Lofy Normal Box',             value: 'lofy_normal'       },
  { name: 'Lofy Mid Box',               value: 'lofy_mid'          },
  { name: 'Lofy UMAZING Box',           value: 'lofy_umazing'      },
];

const commands = [
  new SlashCommandBuilder().setName('roll').setDescription('ทอยลูกเต๋า')
    .addStringOption(o => o.setName('expression').setDescription('เช่น 4d30kh3').setRequired(false)),

  new SlashCommandBuilder().setName('daily').setDescription('รับรางวัลประจำวัน (รีเซ็ตตี 4)'),

  new SlashCommandBuilder().setName('inventory').setDescription('ดูกระเป๋า เงิน ไอเทม emblem banner'),

  new SlashCommandBuilder().setName('convert').setDescription('แลก Gold เป็น RC (3:1)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(3)),

  new SlashCommandBuilder().setName('use').setDescription('ใช้ไอเทมหรือเปิดกล่อง')
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true).addChoices(...USE_CHOICES))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน (สูงสุด 10 กล่อง)').setRequired(false).setMinValue(1).setMaxValue(10)),

  new SlashCommandBuilder().setName('equip').setDescription('เปลี่ยน emblem หรือ banner')
    .addStringOption(o => o.setName('type').setDescription('emblem หรือ banner').setRequired(true)
      .addChoices({ name: 'Emblem', value: 'emblem' }, { name: 'Banner', value: 'banner' }))
    .addStringOption(o => o.setName('name').setDescription('ชื่อ emblem/banner').setRequired(true)),

  new SlashCommandBuilder().setName('transfer').setDescription('โอน Gold ให้สมาชิก')
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('coinflip').setDescription('ทอยเหรียญ (45% ชนะ 2x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('choice').setDescription('หัว/ก้อย').setRequired(true)
      .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),

  new SlashCommandBuilder().setName('slots').setDescription('สล็อต (20% ชนะ + Progressive Jackpot)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('blackjack').setDescription('แบล็คแจ็ค (45% ชนะ 2x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('roulette').setDescription('รูเล็ต (2x-36x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('bet').setDescription('red/black/odd/even/1-18/19-36/0-36').setRequired(true)),

  new SlashCommandBuilder().setName('help').setDescription('ดูคำสั่งทั้งหมด'),

  // Staff
  new SlashCommandBuilder().setName('give').setDescription('[Staff] แจกเงิน')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('gift').setDescription('[Staff] แจกไอเทมหรือกล่อง')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true).addChoices(
      { name: 'Re-roll',              value: 'reroll'            },
      { name: 'Emblem Shard',         value: 'emblem_shard'      },
      { name: 'Banner Shard',         value: 'banner_shard'      },
      ...BOX_CHOICES
    ))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('take').setDescription('[Staff] ลบเงิน')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('revoke').setDescription('[Staff] ลบไอเทม')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true)
      .addChoices({ name: 'Re-roll', value: 'reroll' }, { name: 'Emblem Shard', value: 'emblem_shard' }, { name: 'Banner Shard', value: 'banner_shard' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('inspect').setDescription('[Staff] ดู inventory สมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true)),

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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('clientReady', async () => {
  console.log(`${BOTNAME} v4.0 online: ${client.user.tag}`);
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
  const color = getEmblemColor(userId);

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
    if (p.last_daily === today) return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Daily').setDescription('รับแล้ววันนี้ครับ มาใหม่ตี 4!')], ephemeral: true });
    const yest = new Date(Date.now() + 7*60*60*1000);
    if (yest.getUTCHours() < 4) yest.setUTCDate(yest.getUTCDate() - 1);
    yest.setUTCDate(yest.getUTCDate() - 1);
    const yestKey = yest.toISOString().slice(0, 10);
    const streak = p.last_daily === yestKey ? (p.streak % 7) + 1 : 1;
    const reward = DAILY_REWARDS[streak - 1];
    const updates = { streak, last_daily: today };
    if (reward.type === 'gold')  updates.gold      = p.gold + reward.amount;
    if (reward.type === 'rc')    updates.rc         = p.rc + reward.amount;
    if (reward.type === 'item')  updates.inv_reroll = p.inv_reroll + 1;
    updatePlayer(userId, updates);
    const bar = Array.from({length:7}, (_,i) => i < streak ? '⭐' : '☆').join(' ');
    const nextInfo = streak < 7 ? `\nพรุ่งนี้: **${DAILY_LABELS[streak]}**` : '\nครบ 7 วัน! Streak รีเซ็ต';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Daily Login').setDescription(`วันที่ ${streak}/7\n${bar}\n\nรางวัล: **${DAILY_LABELS[streak-1]}**${nextInfo}`)] });
  }

  // /inventory
  if (cmd === 'inventory') {
    await interaction.deferReply();
    const p = getPlayer(userId);
    const ownedE = getOwnedEmblems(userId);
    const ownedB = getOwnedBanners(userId);
    const bar = Array.from({length:7}, (_,i) => i < p.streak ? '⭐' : '☆').join(' ');
    const emblemName = p.equipped_emblem === 'default' ? 'Default' : EMBLEMS[p.equipped_emblem]?.name || 'Default';
    const bannerName = p.equipped_banner === 'default' ? 'Default' : BANNERS[p.equipped_banner]?.name || 'Default';
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setTitle(`Inventory — ${username}`)
      .addFields(
        { name: 'ยอดเงิน', value: `Gold: **${p.gold.toLocaleString()}**\nRC: **${p.rc.toLocaleString()}**\nชนะวันนี้: ${p.win_today.toLocaleString()}/${WIN_CAP.toLocaleString()}`, inline: true },
        { name: 'Items', value: `Re-roll: **x${p.inv_reroll}**\nEmblem Shard: **x${p.inv_emblem_shard}**\nBanner Shard: **x${p.inv_banner_shard}**`, inline: true },
        { name: 'Equipped', value: `Emblem: **${emblemName}**\nBanner: **${bannerName}**`, inline: true },
        { name: 'Collection', value: `Divinitas: ${ownedE.length}/12\nLofy: ${ownedB.length}/12`, inline: true },
        { name: 'Boxes', value: `Div Normal: x${p.box_divinitas_normal}\nDiv Mid: x${p.box_divinitas_mid}\nDiv UMAZING: x${p.box_divinitas_umazing}\nLofy Normal: x${p.box_lofy_normal}\nLofy Mid: x${p.box_lofy_mid}\nLofy UMAZING: x${p.box_lofy_umazing}`, inline: true },
        { name: 'Daily Streak', value: `${bar}\n${p.streak}/7 วัน`, inline: true },
      )] });
  }

  // /convert
  if (cmd === 'convert') {
    const p = getPlayer(userId);
    const amount = interaction.options.getInteger('amount');
    if (amount % EXCHANGE_RATE !== 0) return interaction.reply({ content: `ต้องแลกเป็นทวีคูณของ ${EXCHANGE_RATE} ครับ`, ephemeral: true });
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, ephemeral: true });
    const rc = amount / EXCHANGE_RATE;
    updatePlayer(userId, { gold: p.gold - amount, rc: p.rc + rc });
    const fresh = getPlayer(userId);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('แลกเงิน').setDescription(`-${amount.toLocaleString()} Gold -> +${rc.toLocaleString()} RC\n\nGold เหลือ: **${fresh.gold.toLocaleString()}**\nRC ทั้งหมด: **${fresh.rc.toLocaleString()}**`)] });
  }

  // /use
  if (cmd === 'use') {
    await interaction.deferReply();
    const p = getPlayer(userId);
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount') || 1;

    if (item === 'reroll') {
      if (p.inv_reroll < 1) return interaction.editReply({ content: 'ไม่มี Re-roll ครับ' });
      updatePlayer(userId, { inv_reroll: p.inv_reroll - 1 });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setTitle('ใช้ Re-roll').setDescription(`ใช้ Re-roll แล้วครับ!\nเหลือ: **x${p.inv_reroll - 1}**`)] });
    }

    // Box opening
    if (BOX_RATES[item]) {
      const boxKey = `box_${item}`;
      if (p[boxKey] < amount) return interaction.editReply({ content: `กล่องไม่พอครับ (มี ${p[boxKey]} ใบ)` });

      const isMulti = amount === 10;
      const isEmblem = item.startsWith('divinitas');
      const box = BOX_RATES[item];
      const results = [];
      let totalGold = 0, totalShard = 0, gotCompleteSet = false;
      let hasGuarantee = false;

      for (let i = 0; i < amount; i++) {
        const result = rollGacha(item, userId, isMulti, i, amount, isMulti && i === amount - 1 ? box.multi_guarantee : null);
        results.push(result);

        if (result.type === 'complete_set') {
          gotCompleteSet = true;
          // Give all items in collection
          if (isEmblem) {
            [...Object.keys(EMBLEM_POOL.C), ...Object.keys(EMBLEM_POOL.R), ...Object.keys(EMBLEM_POOL.SR), ...Object.keys(EMBLEM_POOL.UR)].forEach(e => addEmblem(userId, e));
            addEmblem(userId, 'aurum_imperialis');
          } else {
            [...Object.keys(BANNER_POOL.C), ...Object.keys(BANNER_POOL.R), ...Object.keys(BANNER_POOL.SR), ...Object.keys(BANNER_POOL.UR)].forEach(b => addBanner(userId, b));
            addBanner(userId, 'newton_prime');
          }
          break;
        }

        if (result.type === 'salt') {
          if (result.saltType === 'gold') totalGold += result.bonusGold;
          else totalShard += result.bonusShard;
        } else if (result.isDupe) {
          totalShard += 1;
        }
      }

      // Apply gold and shard rewards
      const freshP = getPlayer(userId);
      const shardKey = isEmblem ? 'inv_emblem_shard' : 'inv_banner_shard';
      const updates = { [boxKey]: freshP[boxKey] - amount };
      if (totalGold > 0) updates.gold = freshP.gold + totalGold;
      if (totalShard > 0) updates[shardKey] = freshP[shardKey] + totalShard;
      updatePlayer(userId, updates);

      // Check eclipse unlock
      const collectionType = isEmblem ? 'divinitas' : 'lofy';
      const eclipseUnlocked = checkCollectionComplete(userId, collectionType);
      if (eclipseUnlocked) {
        if (isEmblem) addEmblem(userId, 'aurum_imperialis');
        else addBanner(userId, 'newton_prime');
      }

      // Build result embed
      let desc = '';
      if (gotCompleteSet) {
        desc = `🌟 **DIVINE CONVERGENCE — COMPLETE SET JACKPOT!!!**\n\nได้ทุก ${isEmblem ? 'Emblem' : 'Banner'} ใน collection ครบ + Eclipse ปลดล็อคแล้วครับ!`;
        // Announce in channel
        await interaction.channel?.send(`🌟 **@${username}** เพิ่งได้ **COMPLETE SET JACKPOT** จาก ${BOX_NAMES[item]}!!!`);
      } else {
        const lines = results.map((r, i) => `${i+1}. ${formatGachaResult(r, isEmblem)}`);
        desc = `**เปิด ${BOX_NAMES[item]} x${amount}**\n\n${lines.join('\n')}`;
        if (totalGold > 0) desc += `\n\n+${totalGold} Gold`;
        if (totalShard > 0) desc += `\n+${totalShard} ${isEmblem ? 'Emblem' : 'Banner'} Shard`;
        if (eclipseUnlocked) desc += `\n\n🌑 **Eclipse ปลดล็อคแล้ว!** Collection ครบ!`;
      }

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setTitle(`🎁 ${BOX_NAMES[item]}`).setDescription(desc)] });
    }
  }

  // /equip
  if (cmd === 'equip') {
    await interaction.deferReply();
    const type = interaction.options.getString('type');
    const name = interaction.options.getString('name').toLowerCase().replace(/ /g, '_');

    if (type === 'emblem') {
      const owned = getOwnedEmblems(userId);
      if (!EMBLEMS[name]) return interaction.editReply({ content: 'ไม่พบ emblem นี้ครับ' });
      if (!owned.includes(name)) return interaction.editReply({ content: 'คุณยังไม่มี emblem นี้ครับ' });
      updatePlayer(userId, { equipped_emblem: name });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBLEMS[name].color).setTitle('Equip Emblem').setDescription(`เปลี่ยนเป็น **${EMBLEMS[name].name}** แล้วครับ!`)] });
    } else {
      const owned = getOwnedBanners(userId);
      if (!BANNERS[name]) return interaction.editReply({ content: 'ไม่พบ banner นี้ครับ' });
      if (!owned.includes(name)) return interaction.editReply({ content: 'คุณยังไม่มี banner นี้ครับ' });
      updatePlayer(userId, { equipped_banner: name });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Equip Banner').setDescription(`เปลี่ยนเป็น **${BANNERS[name].name}** แล้วครับ!`)] });
    }
  }

  // /transfer
  if (cmd === 'transfer') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (target.id === userId) return interaction.reply({ content: 'โอนให้ตัวเองไม่ได้ครับ', ephemeral: true });
    if (target.bot) return interaction.reply({ content: 'โอนให้บอทไม่ได้ครับ', ephemeral: true });
    const p = getPlayer(userId);
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, ephemeral: true });
    const tp = getPlayer(target.id);
    updatePlayer(userId, { gold: p.gold - amount });
    updatePlayer(target.id, { gold: tp.gold + amount });
    const fresh = getPlayer(userId);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('โอน Gold').setDescription(`โอน **${amount.toLocaleString()} Gold** ให้ <@${target.id}> แล้วครับ\nGold เหลือ: **${fresh.gold.toLocaleString()}**`)] });
  }

  // /coinflip
  if (cmd === 'coinflip') {
    const amount = interaction.options.getInteger('amount');
    const choice = interaction.options.getString('choice');
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const win = randF() < 0.45;
    const result = win ? choice : (choice === 'heads' ? 'tails' : 'heads');
    if (win) {
      const w = applyWin(userId, amount, 2);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(`Coinflip — ชนะ!`).setDescription(`ผล: **${result.toUpperCase()}**\n\n+${w.profit.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)] });
    }
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle(`Coinflip — แพ้`).setDescription(`ผล: **${result.toUpperCase()}**\n\n-${amount.toLocaleString()} Gold\nยอดรวม: **${loss.gold.toLocaleString()} Gold**`)] });
  }

  // /slots
  if (cmd === 'slots') {
    const amount = interaction.options.getInteger('amount');
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const contrib = Math.floor(amount * POOL_CONTRIB);
    setPool(getPool() + contrib);
    const forceWin = randF() < 0.20;
    let reels = [spinSlot(), spinSlot(), spinSlot()];
    if (forceWin) { const s = spinSlot(); reels = [s, s, s]; }
    else { while (reels[0] === reels[1] && reels[1] === reels[2]) reels[2] = spinSlot(); }
    const pool = getPool();
    const isJP = forceWin && reels[0] === 'seven' && pool > 0;
    const reelStr = reels.map(r => SLOT_EMOJI[r]).join('  ');
    if (isJP) {
      const jpAmt = pool * JACKPOT_MULT;
      const taxed = Math.floor(jpAmt * (1 - TAX));
      setPool(0);
      const p2 = getPlayer(userId);
      updatePlayer(userId, { gold: p2.gold + taxed, win_today: Math.min(p2.win_today + jpAmt, WIN_CAP) });
      const fresh = getPlayer(userId);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('JACKPOT!!!').setDescription(`${reelStr}\n\n7 7 7 — JACKPOT!\nPool: ${pool.toLocaleString()} x ${JACKPOT_MULT}\nหัก Tax -> +${taxed.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)] });
    }
    if (forceWin) {
      const mult = SLOT_MULT[reels[0]];
      const w = applyWin(userId, amount, mult);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Slots — ชนะ!').setDescription(`${reelStr}\n\n${reels.map(r => SLOT_EMOJI[r]).join('')} — ${mult}x!\n+${w.profit.toLocaleString()} Gold\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)] });
    }
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Slots').setDescription(`${reelStr}\n\nไม่ match — -${amount.toLocaleString()} Gold\n(${contrib} เข้า Pool)\nPool: ${getPool().toLocaleString()}\nยอดรวม: **${loss.gold.toLocaleString()} Gold**`)] });
  }

  // /blackjack
  if (cmd === 'blackjack') {
    if (bjGames.has(userId)) return interaction.reply({ content: 'มีเกม Blackjack ค้างอยู่ครับ รอ 5 นาทีแล้วจะยกเลิกอัตโนมัติ', ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const deck = makeDeck();
    const game = { amount, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], userId, startTime: Date.now() };
    const pv = handVal(game.player);
    if (pv === 21) {
      const w = applyWin(userId, amount, 2.5);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('BLACKJACK! 21!').setDescription(`ไพ่คุณ: ${game.player.map(c => cardStr(c)).join(' ')}\n\nBLACKJACK! ชนะ 2.5x!\n+${w.profit.toLocaleString()} Gold\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)] });
    }
    bjGames.set(userId, game);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Blackjack').setDescription(`Dealer: ${cardStr(game.dealer[0])} ??\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`)], components: [row] });
  }

  // /roulette
  if (cmd === 'roulette') {
    const amount = interaction.options.getInteger('amount');
    const bet = interaction.options.getString('bet').toLowerCase();
    const validBets = ['red','black','odd','even','1-18','19-36'];
    const isNumBet = !isNaN(parseInt(bet)) && parseInt(bet) >= 0 && parseInt(bet) <= 36;
    if (!validBets.includes(bet) && !isNumBet) return interaction.reply({ content: 'bet ไม่ถูกต้องครับ', ephemeral: true });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const n = rand(0, 36);
    const col = roulColor(n);
    const emoji = col === 'red' ? 'Red' : col === 'black' ? 'Black' : 'Green';
    const win = roulWin(bet, n);
    const pay = roulPay(bet);
    if (win) {
      const w = applyWin(userId, amount, pay);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Roulette — ชนะ!').setDescription(`ลูกหยุดที่: **${n}** (${emoji})\nเดิมพัน: **${bet}** (${pay}x)\n\n+${w.profit.toLocaleString()} Gold\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)] });
    }
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Roulette — แพ้').setDescription(`ลูกหยุดที่: **${n}** (${emoji})\nเดิมพัน: **${bet}**\n\n-${amount.toLocaleString()} Gold\nยอดรวม: **${loss.gold.toLocaleString()} Gold**`)] });
  }

  // /help
  if (cmd === 'help') {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle(`${BOTNAME} — คำสั่งทั้งหมด`)
      .addFields(
        { name: 'Roll', value: '/roll [expression] — ทอยลูกเต๋า\n!r [expression] — prefix', inline: false },
        { name: 'เงิน & ไอเทม', value: '/daily — รับรางวัลประจำวัน\n/inventory — ดูกระเป๋า\n/convert amount — แลก 3 Gold = 1 RC\n/use item amount — ใช้ไอเทมหรือเปิดกล่อง (max 10)\n/equip type name — เปลี่ยน emblem/banner\n/transfer @user amount — โอน Gold', inline: false },
        { name: 'เกมพนัน', value: '/coinflip amount choice\n/slots amount\n/blackjack amount\n/roulette amount bet', inline: false },
        { name: 'Gacha', value: 'เปิดกล่องด้วย /use item:box_name\nซื้อกล่องด้วย RC ผ่าน /use\nสะสม Shard แลกกล่องได้', inline: false },
        { name: 'Staff', value: '/give /gift /take /revoke /inspect', inline: false },
      )] });
  }

  // /give
  if (cmd === 'give') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (currency === 'gold') updatePlayer(target.id, { gold: tp.gold + amount });
    else updatePlayer(target.id, { rc: tp.rc + amount });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('Staff — แจกเงิน').setDescription(`แจก **${amount.toLocaleString()} ${currency === 'gold' ? 'Gold' : 'RC'}** ให้ <@${target.id}>`)] });
  }

  // /gift
  if (cmd === 'gift') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    const updates = {};
    if (item === 'reroll')        updates.inv_reroll       = tp.inv_reroll + amount;
    if (item === 'emblem_shard')  updates.inv_emblem_shard = tp.inv_emblem_shard + amount;
    if (item === 'banner_shard')  updates.inv_banner_shard = tp.inv_banner_shard + amount;
    if (item.startsWith('box_') || BOX_RATES[item]) {
      const boxKey = `box_${item}`;
      updates[boxKey] = (tp[boxKey] || 0) + amount;
    }
    if (Object.keys(updates).length) updatePlayer(target.id, updates);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xbb88ff).setTitle('Staff — แจกไอเทม').setDescription(`แจก **${item} x${amount}** ให้ <@${target.id}>`)] });
  }

  // /take
  if (cmd === 'take') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (currency === 'gold') { const d = Math.min(amount, tp.gold); updatePlayer(target.id, { gold: tp.gold - d }); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบเงิน').setDescription(`ลบ **${d.toLocaleString()} Gold** จาก <@${target.id}>\nเหลือ: **${(tp.gold-d).toLocaleString()}**`)] }); }
    else { const d = Math.min(amount, tp.rc); updatePlayer(target.id, { rc: tp.rc - d }); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบเงิน').setDescription(`ลบ **${d.toLocaleString()} RC** จาก <@${target.id}>\nเหลือ: **${(tp.rc-d).toLocaleString()}**`)] }); }
  }

  // /revoke
  if (cmd === 'revoke') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (item === 'reroll') { const d = Math.min(amount, tp.inv_reroll); updatePlayer(target.id, { inv_reroll: tp.inv_reroll - d }); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบไอเทม').setDescription(`ลบ **Re-roll x${d}** จาก <@${target.id}>\nเหลือ: **x${tp.inv_reroll-d}**`)] }); }
    if (item === 'emblem_shard') { const d = Math.min(amount, tp.inv_emblem_shard); updatePlayer(target.id, { inv_emblem_shard: tp.inv_emblem_shard - d }); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบไอเทม').setDescription(`ลบ **Emblem Shard x${d}** จาก <@${target.id}>`)] }); }
    if (item === 'banner_shard') { const d = Math.min(amount, tp.inv_banner_shard); updatePlayer(target.id, { inv_banner_shard: tp.inv_banner_shard - d }); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบไอเทม').setDescription(`ลบ **Banner Shard x${d}** จาก <@${target.id}>`)] }); }
  }

  // /inspect
  if (cmd === 'inspect') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const tp = getPlayer(target.id);
    const ownedE = getOwnedEmblems(target.id);
    const ownedB = getOwnedBanners(target.id);
    const bar = Array.from({length:7}, (_,i) => i < tp.streak ? '⭐' : '☆').join(' ');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffa500).setTitle(`Staff — ${target.username}`)
      .addFields(
        { name: 'ยอดเงิน', value: `Gold: **${tp.gold.toLocaleString()}**\nRC: **${tp.rc.toLocaleString()}**\nชนะวันนี้: ${tp.win_today.toLocaleString()}/${WIN_CAP.toLocaleString()}`, inline: true },
        { name: 'Items', value: `Re-roll: x${tp.inv_reroll}\nEmblem Shard: x${tp.inv_emblem_shard}\nBanner Shard: x${tp.inv_banner_shard}`, inline: true },
        { name: 'Collection', value: `Divinitas: ${ownedE.length}/12\nLofy: ${ownedB.length}/12`, inline: true },
        { name: 'Daily Streak', value: `${bar}\n${tp.streak}/7\nรับล่าสุด: ${tp.last_daily || 'ยังไม่เคย'}`, inline: false },
      )], ephemeral: true });
  }
}

// ══════════════════════════════════════════════
//  BLACKJACK BUTTONS
// ══════════════════════════════════════════════
async function handleButton(interaction) {
  const id = interaction.customId;
  const userId = interaction.user.id;
  if (!id.startsWith('bj_')) return;
  if (!id.endsWith(userId)) return interaction.reply({ content: 'นี่ไม่ใช่เกมของคุณครับ', ephemeral: true });
  const game = bjGames.get(userId);
  if (!game) return interaction.reply({ content: 'หมดเวลาแล้วครับ เงินเดิมพันคืนให้แล้ว', ephemeral: true });
  const color = getEmblemColor(userId);

  if (id.startsWith('bj_hit_')) {
    game.player.push(game.deck.pop());
    const pv = handVal(game.player);
    if (pv > 21) {
      bjGames.delete(userId);
      const fresh = getPlayer(userId);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Blackjack — แพ้ (Bust)').setDescription(`ไพ่คุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}\n\nเกิน 21! -${game.amount.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)], components: [] });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Blackjack').setDescription(`Dealer: ${cardStr(game.dealer[0])} ??\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`)], components: [row] });
  }

  if (id.startsWith('bj_stand_')) {
    bjGames.delete(userId);
    while (handVal(game.dealer) < 17) game.dealer.push(game.deck.pop());
    const pv = handVal(game.player), dv = handVal(game.dealer);
    const dStr = `Dealer (${dv}): ${game.dealer.map(c => cardStr(c)).join(' ')}`;
    const pStr = `คุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`;
    if (dv > 21 || pv > dv) {
      const w = applyWin(userId, game.amount, 2);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Blackjack — ชนะ!').setDescription(`${dStr}\n${pStr}\n\n+${w.profit.toLocaleString()} Gold\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)], components: [] });
    }
    if (pv === dv) {
      const p = getPlayer(userId);
      updatePlayer(userId, { gold: p.gold + game.amount });
      const fresh = getPlayer(userId);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Blackjack — เสมอ').setDescription(`${dStr}\n${pStr}\n\nคืนเงิน ${game.amount.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)], components: [] });
    }
    const fresh = getPlayer(userId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Blackjack — แพ้').setDescription(`${dStr}\n${pStr}\n\n-${game.amount.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)], components: [] });
  }
}

client.login(process.env.DISCORD_TOKEN);
