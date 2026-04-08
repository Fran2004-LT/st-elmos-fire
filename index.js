// index.js — St. Elmo's Fire v3.1
// Commands: !r, /roll, /daily, /inventory, /coinflip, /slots, /blackjack, /roulette
//           /convert, /use, /transfer, /help
//           /give, /gift, /take, /revoke, /inspect (Staff)
// Storage: SQLite (better-sqlite3)
// CSPRNG: crypto.randomInt()

import {
  Client, GatewayIntentBits, EmbedBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { randomInt } from 'crypto';
import Database from 'better-sqlite3';
import 'dotenv/config';

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
//  DATABASE
// ══════════════════════════════════════════════
const db = new Database('elmos.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    user_id         TEXT PRIMARY KEY,
    gold            INTEGER DEFAULT ${STARTING_GOLD},
    rc              INTEGER DEFAULT 0,
    win_today       INTEGER DEFAULT 0,
    last_win_reset  TEXT DEFAULT '',
    streak          INTEGER DEFAULT 0,
    last_daily      TEXT DEFAULT '',
    banner          TEXT DEFAULT 'default',
    inv_reroll      INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS jackpot (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    pool  INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO jackpot (id, pool) VALUES (1, 0);
`);

// Reset วันใหม่ที่ตี 4 ไทย (ICT = UTC+7)
function getDayKey() {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (ict.getUTCHours() < 4) ict.setUTCDate(ict.getUTCDate() - 1);
  return ict.toISOString().slice(0, 10); // "2026-04-08"
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
    p.last_win_reset = today;
  }
  return p;
}

function updatePlayer(userId, fields) {
  const keys = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE players SET ${keys} WHERE user_id = ?`).run(...Object.values(fields), userId);
}

function getPool() { return db.prepare('SELECT pool FROM jackpot WHERE id = 1').get().pool; }
function setPool(val) { db.prepare('UPDATE jackpot SET pool = ? WHERE id = 1').run(Math.min(Math.max(0, val), POOL_CAP)); }

// ══════════════════════════════════════════════
//  CSPRNG
// ══════════════════════════════════════════════
function rand(min, max) { return randomInt(min, max + 1); }
function randF() { return randomInt(0, 1000000) / 1000000; }

// ══════════════════════════════════════════════
//  ECONOMY
//  applyLoss: หักเงินก่อนเล่น
//  applyWin:  คืนเงินเดิมพัน + กำไร (หัก tax)
// ══════════════════════════════════════════════
function applyLoss(userId, amount) {
  const p = getPlayer(userId);
  if (p.gold < amount) return { ok: false, reason: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})` };
  updatePlayer(userId, { gold: p.gold - amount });
  return { ok: true, gold: p.gold - amount };
}

function applyWin(userId, betAmount, payoutMult) {
  // betAmount = เงินที่หักออกไปแล้ว, payoutMult = อัตราจ่าย (2 = 2x)
  // กำไรสุทธิ = betAmount * payoutMult - betAmount = betAmount * (payoutMult - 1)
  // หัก tax จากกำไร แล้วบวกคืนเงินเดิมพัน
  const p = getPlayer(userId);
  const profit = Math.floor(betAmount * (payoutMult - 1) * (1 - TAX));
  const netGain = betAmount + profit; // คืนเงินเดิมพัน + กำไรสุทธิ

  if (p.win_today >= WIN_CAP) {
    // ถึง cap — คืนเงินเดิมพันอย่างเดียว ไม่ได้กำไร
    updatePlayer(userId, { gold: p.gold + betAmount });
    return { ok: false, reason: `ถึง Daily Win Cap แล้วครับ คืนเงินเดิมพัน ${betAmount.toLocaleString()} Gold`, gold: p.gold + betAmount };
  }

  const capProfit = Math.min(profit, WIN_CAP - p.win_today);
  const finalGain = betAmount + capProfit;
  updatePlayer(userId, { gold: p.gold + finalGain, win_today: p.win_today + capProfit });
  const fresh = getPlayer(userId);
  return { ok: true, profit: capProfit, gold: fresh.gold };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE) || member.permissions.has(PermissionFlagsBits.Administrator);
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

function buildRollEmbed(parsed, tokens, username) {
  const results = tokens.map(t => rollSegment(t));
  const grand = results.reduce((a, r) => a + r.total, 0);
  const isMulti = results.length > 1;
  const lines = [];
  if (parsed.mode === 'adv') lines.push('`ADVANTAGE`');
  if (parsed.mode === 'dis') lines.push('`DISADVANTAGE`');
  for (const r of results) {
    if (r.type === 'flat') { lines.push(`${r.sign < 0 ? '-' : '+'} **${r.value}** (modifier)`); continue; }
    if (r.type === 'multiply') {
      for (const sr of r.subResults) {
        if (sr.type === 'dice') {
          let ex = `${sr.num}d${sr.sides}`;
          if (sr.mode === 'kh') ex += ` kh${sr.keep}`;
          if (sr.mode === 'kl') ex += ` kl${sr.keep}`;
          lines.push(`\`${ex}\` -> ${formatDice(sr)}`);
        }
      }
      lines.push(`x ${r.mult} = **${r.sign < 0 ? '-' : ''}${Math.abs(r.total)}**`); continue;
    }
    let ex = `${r.num}d${r.sides}`;
    if (r.mode === 'kh') ex += ` kh${r.keep}`;
    if (r.mode === 'kl') ex += ` kl${r.keep}`;
    const tags = parsed.tags.length ? ` [${parsed.tags.join(', ')}]` : '';
    const sub = isMulti ? ` = **${r.sign < 0 ? '-' : ''}${Math.abs(r.sub)}**` : '';
    lines.push(`\`${ex}${tags}\` -> ${formatDice(r)}${sub}`);
  }
  lines.push(`\n@${username}\u2003**${grand}**`);
  return new EmbedBuilder().setColor(0xbb88ff).setDescription(lines.join('\n'));
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
//  BLACKJACK STATE
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
function cardStr(c) { const suit = { S:'♠', H:'♥', D:'♦', C:'♣' }[c.s]; return `${c.r}${suit}`; }

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
const commands = [
  new SlashCommandBuilder().setName('roll').setDescription('ทอยลูกเต๋า')
    .addStringOption(o => o.setName('expression').setDescription('เช่น 4d30kh3').setRequired(false)),

  new SlashCommandBuilder().setName('daily').setDescription('รับรางวัล login ประจำวัน (รีเซ็ตตี 4)'),

  new SlashCommandBuilder().setName('inventory').setDescription('ดูกระเป๋าเงิน ไอเทม daily streak'),

  new SlashCommandBuilder().setName('convert').setDescription('แลก Gold เป็น Rainbow Carrot (3:1)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(3)),

  new SlashCommandBuilder().setName('use').setDescription('ใช้ไอเทม')
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true)
      .addChoices({ name: 'Re-roll', value: 'reroll' })),

  new SlashCommandBuilder().setName('transfer').setDescription('โอน Gold ให้สมาชิก')
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('coinflip').setDescription('ทอยเหรียญ (45% ชนะ 2x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('choice').setDescription('หัว/ก้อย').setRequired(true)
      .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),

  new SlashCommandBuilder().setName('slots').setDescription('สล็อต (35% ชนะ + Progressive Jackpot)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('blackjack').setDescription('แบล็คแจ็ค (45% ชนะ 2x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('roulette').setDescription('รูเล็ต (2x-36x)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('bet').setDescription('red/black/odd/even/1-18/19-36/ตัวเลข 0-36').setRequired(true)),

  new SlashCommandBuilder().setName('help').setDescription('ดูคำสั่งทั้งหมด'),

  // Staff commands
  new SlashCommandBuilder().setName('give').setDescription('[Staff] แจกเงินให้สมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('gift').setDescription('[Staff] แจกไอเทมให้สมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('ผู้รับ').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true)
      .addChoices({ name: 'Re-roll', value: 'reroll' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('take').setDescription('[Staff] ลบเงินออกจากสมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: 'Gold', value: 'gold' }, { name: 'Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('revoke').setDescription('[Staff] ลบไอเทมออกจากสมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true)
      .addChoices({ name: 'Re-roll', value: 'reroll' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('inspect').setDescription('[Staff] ดู inventory ของสมาชิก')
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
  console.log(`St. Elmo's Fire v3.1 online: ${client.user.tag}`);
  await deployCommands();
});

// ── !r prefix ─────────────────────────────────
client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.content.toLowerCase().startsWith(PREFIX)) return;
  const raw = msg.content.slice(PREFIX.length).trim() || '1d20';
  const parsed = parseRoll(raw);
  if (parsed.err) return msg.reply(`Error: ${parsed.err}`);
  const username = msg.member?.displayName || msg.author.username;
  try { await msg.reply({ embeds: [buildRollEmbed(parsed, parsed.tokens, username)] }); }
  catch (e) { console.error(e); await msg.reply('Error: กรุณาลองใหม่'); }
});

// ── Interactions ───────────────────────────────
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
//  SLASH COMMAND HANDLERS
// ══════════════════════════════════════════════
async function handleSlash(interaction) {
  const cmd = interaction.commandName;
  const userId = interaction.user.id;
  const username = interaction.member?.displayName || interaction.user.username;

  // /roll
  if (cmd === 'roll') {
    const raw = interaction.options.getString('expression') || '1d20';
    const parsed = parseRoll(raw);
    if (parsed.err) return interaction.reply({ content: `Error: ${parsed.err}`, ephemeral: true });
    return interaction.reply({ embeds: [buildRollEmbed(parsed, parsed.tokens, username)] });
  }

  // /daily
  if (cmd === 'daily') {
    const p = getPlayer(userId);
    const today = getDayKey();
    if (p.last_daily === today) {
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865f2).setTitle('Daily')
          .setDescription('รับแล้ววันนี้ครับ มาใหม่ตี 4!')
      ], ephemeral: true });
    }
    // Check streak
    const yestDate = new Date(Date.now() + 7 * 60 * 60 * 1000);
    if (yestDate.getUTCHours() < 4) yestDate.setUTCDate(yestDate.getUTCDate() - 1);
    yestDate.setUTCDate(yestDate.getUTCDate() - 1);
    const yestKey = yestDate.toISOString().slice(0, 10);
    const streak = p.last_daily === yestKey ? (p.streak % 7) + 1 : 1;
    const reward = DAILY_REWARDS[streak - 1];
    const updates = { streak, last_daily: today };
    if (reward.type === 'gold')  updates.gold       = p.gold + reward.amount;
    if (reward.type === 'rc')    updates.rc          = p.rc + reward.amount;
    if (reward.type === 'item')  updates.inv_reroll  = p.inv_reroll + 1;
    updatePlayer(userId, updates);
    const bar = Array.from({ length: 7 }, (_, i) => i < streak ? 'star' : 'empty').map(x => x === 'star' ? '⭐' : '☆').join(' ');
    const nextInfo = streak < 7 ? `\nพรุ่งนี้: **${DAILY_LABELS[streak]}**` : '\nครบ 7 วัน! Streak รีเซ็ต';
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0x57f287).setTitle('Daily Login')
        .setDescription(`วันที่ ${streak}/7\n${bar}\n\nรางวัล: **${DAILY_LABELS[streak - 1]}**${nextInfo}`)
    ] });
  }

  // /inventory
  if (cmd === 'inventory') {
    const p = getPlayer(userId);
    const pool = getPool();
    const isOwner = userId === OWNER_ID;
    const color = isOwner ? 0x9B59B6 : 0x111111;
    const bar = Array.from({ length: 7 }, (_, i) => i < p.streak ? '⭐' : '☆').join(' ');
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(color).setTitle(`Inventory — ${username}`)
        .addFields(
          { name: 'ยอดเงิน', value: `Gold: **${p.gold.toLocaleString()}**\nRC: **${p.rc.toLocaleString()}**\nชนะวันนี้: ${p.win_today.toLocaleString()}/${WIN_CAP.toLocaleString()}`, inline: true },
          { name: 'Items', value: `Re-roll: **x${p.inv_reroll}**`, inline: true },
          { name: 'Daily Streak', value: `${bar}\n${p.streak}/7 วัน`, inline: false },
          { name: 'Jackpot Pool', value: `สะสม: **${pool.toLocaleString()}** Gold\nถ้าตีได้: **${(pool * JACKPOT_MULT).toLocaleString()}** Gold`, inline: false },
        )
    ] });
  }

  // /convert
  if (cmd === 'convert') {
    const p = getPlayer(userId);
    const amount = interaction.options.getInteger('amount');
    if (amount % EXCHANGE_RATE !== 0) return interaction.reply({ content: `ต้องแลกเป็นทวีคูณของ ${EXCHANGE_RATE} ครับ (3 Gold = 1 RC)`, ephemeral: true });
    if (p.gold < amount) return interaction.reply({ content: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, ephemeral: true });
    const rc = amount / EXCHANGE_RATE;
    updatePlayer(userId, { gold: p.gold - amount, rc: p.rc + rc });
    const fresh = getPlayer(userId);
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xbb88ff).setTitle('แลกเงิน')
        .setDescription(`-${amount.toLocaleString()} Gold -> +${rc.toLocaleString()} RC\n\nGold เหลือ: **${fresh.gold.toLocaleString()}**\nRC ทั้งหมด: **${fresh.rc.toLocaleString()}**`)
    ] });
  }

  // /use
  if (cmd === 'use') {
    const p = getPlayer(userId);
    const item = interaction.options.getString('item');
    if (item === 'reroll') {
      if (p.inv_reroll < 1) return interaction.reply({ content: 'ไม่มี Re-roll ครับ', ephemeral: true });
      updatePlayer(userId, { inv_reroll: p.inv_reroll - 1 });
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0xbb88ff).setTitle('ใช้ Re-roll')
          .setDescription(`ใช้ Re-roll แล้วครับ!\nเหลือ: **x${p.inv_reroll - 1}**`)
      ] });
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
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0x57f287).setTitle('โอน Gold')
        .setDescription(`โอน **${amount.toLocaleString()} Gold** ให้ <@${target.id}> แล้วครับ\nGold เหลือ: **${fresh.gold.toLocaleString()}**`)
    ] });
  }

  // /coinflip
  if (cmd === 'coinflip') {
    const p = getPlayer(userId);
    const amount = interaction.options.getInteger('amount');
    const choice = interaction.options.getString('choice');
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const win = randF() < 0.45;
    const result = win ? choice : (choice === 'heads' ? 'tails' : 'heads');
    const emoji = result === 'heads' ? 'Heads' : 'Tails';
    if (win) {
      const w = applyWin(userId, amount, 2);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x57f287).setTitle(`Coinflip — ชนะ!`)
          .setDescription(`ผล: **${emoji}**\n\n+${w.profit.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)
      ] });
    }
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xed4245).setTitle(`Coinflip — แพ้`)
        .setDescription(`ผล: **${emoji}**\n\n-${amount.toLocaleString()} Gold\nยอดรวม: **${loss.gold.toLocaleString()} Gold**`)
    ] });
  }

  // /slots
  if (cmd === 'slots') {
    const amount = interaction.options.getInteger('amount');
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const contrib = Math.floor(amount * POOL_CONTRIB);
    setPool(getPool() + contrib);
    const forceWin = randF() < 0.35;
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
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0xffd700).setTitle('JACKPOT!!!')
          .setDescription(`${reelStr}\n\n7 7 7 — JACKPOT!\nPool: ${pool.toLocaleString()} x ${JACKPOT_MULT}\nหัก Tax -> +${taxed.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)
      ] });
    }
    if (forceWin) {
      const mult = SLOT_MULT[reels[0]];
      const w = applyWin(userId, amount, mult);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x57f287).setTitle('Slots — ชนะ!')
          .setDescription(`${reelStr}\n\n${reels.map(r => SLOT_EMOJI[r]).join('')} — ${mult}x!\n+${w.profit.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)
      ] });
    }
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xed4245).setTitle('Slots')
        .setDescription(`${reelStr}\n\nไม่ match — -${amount.toLocaleString()} Gold\n(${contrib} เข้า Jackpot Pool)\nPool: ${getPool().toLocaleString()}\nยอดรวม: **${loss.gold.toLocaleString()} Gold**`)
    ] });
  }

  // /blackjack
  if (cmd === 'blackjack') {
    if (bjGames.has(userId)) return interaction.reply({ content: 'มีเกม Blackjack ค้างอยู่ครับ', ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const deck = makeDeck();
    const game = { amount, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], userId };
    const pv = handVal(game.player);
    if (pv === 21) {
      const w = applyWin(userId, amount, 2.5);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x57f287).setTitle('BLACKJACK! 21!')
          .setDescription(`ไพ่คุณ: ${game.player.map(c => cardStr(c)).join(' ')}\n\nBLACKJACK! ชนะ 2.5x!\n+${w.profit.toLocaleString()} Gold\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)
      ] });
    }
    bjGames.set(userId, game);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0x5865f2).setTitle('Blackjack')
        .setDescription(`Dealer: ${cardStr(game.dealer[0])} ??\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`)
    ], components: [row] });
  }

  // /roulette
  if (cmd === 'roulette') {
    const amount = interaction.options.getInteger('amount');
    const bet = interaction.options.getString('bet').toLowerCase();
    const validBets = ['red','black','odd','even','1-18','19-36'];
    const isNumBet = !isNaN(parseInt(bet)) && parseInt(bet) >= 0 && parseInt(bet) <= 36;
    if (!validBets.includes(bet) && !isNumBet) return interaction.reply({ content: 'bet ไม่ถูกต้องครับ\nตัวเลือก: red black odd even 1-18 19-36 หรือ 0-36', ephemeral: true });
    const loss = applyLoss(userId, amount);
    if (!loss.ok) return interaction.reply({ content: loss.reason, ephemeral: true });
    const n = rand(0, 36);
    const color = roulColor(n);
    const emoji = color === 'red' ? 'Red' : color === 'black' ? 'Black' : 'Green';
    const win = roulWin(bet, n);
    const pay = roulPay(bet);
    if (win) {
      const w = applyWin(userId, amount, pay);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x57f287).setTitle('Roulette — ชนะ!')
          .setDescription(`ลูกหยุดที่: **${n}** (${emoji})\nเดิมพัน: **${bet}** (${pay}x)\n\n+${w.profit.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)
      ] });
    }
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xed4245).setTitle('Roulette — แพ้')
        .setDescription(`ลูกหยุดที่: **${n}** (${emoji})\nเดิมพัน: **${bet}**\n\n-${amount.toLocaleString()} Gold\nยอดรวม: **${loss.gold.toLocaleString()} Gold**`)
    ] });
  }

  // /help
  if (cmd === 'help') {
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xbb88ff).setTitle(`${BOTNAME} — คำสั่งทั้งหมด`)
        .addFields(
          { name: 'Roll', value: '/roll [expression] — ทอยลูกเต๋า\n!r [expression] — prefix command', inline: false },
          { name: 'เงิน & ไอเทม', value: '/daily — รับรางวัลประจำวัน (รีเซ็ตตี 4)\n/inventory — ดูกระเป๋า\n/convert amount — แลก 3 Gold = 1 RC\n/use item:reroll — ใช้ Re-roll\n/transfer @user amount — โอน Gold', inline: false },
          { name: 'เกมพนัน', value: '/coinflip amount choice — ทอยเหรียญ 45% ชนะ 2x\n/slots amount — สล็อต 35% ชนะ + Jackpot\n/blackjack amount — แบล็คแจ็ค 45% ชนะ 2x\n/roulette amount bet — รูเล็ต 2x-36x', inline: false },
          { name: 'กฎพนัน', value: 'Tax 3% จากกำไรที่ได้\nWin Cap 10,000 Gold ต่อวัน\nSlots Pool สะสม 5% จากทุกการแพ้', inline: false },
          { name: 'Staff เท่านั้น', value: '/give @user currency amount — แจกเงิน\n/gift @user item amount — แจกไอเทม\n/take @user currency amount — ลบเงิน\n/revoke @user item amount — ลบไอเทม\n/inspect @user — ดู inventory สมาชิก', inline: false },
        )
    ] });
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
    const label = currency === 'gold' ? `${amount.toLocaleString()} Gold` : `${amount.toLocaleString()} RC`;
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xffd700).setTitle('Staff — แจกเงิน')
        .setDescription(`แจก **${label}** ให้ <@${target.id}> แล้วครับ`)
    ] });
  }

  // /gift
  if (cmd === 'gift') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (item === 'reroll') updatePlayer(target.id, { inv_reroll: tp.inv_reroll + amount });
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xbb88ff).setTitle('Staff — แจกไอเทม')
        .setDescription(`แจก **Re-roll x${amount}** ให้ <@${target.id}> แล้วครับ`)
    ] });
  }

  // /take
  if (cmd === 'take') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (currency === 'gold') {
      const deduct = Math.min(amount, tp.gold);
      updatePlayer(target.id, { gold: tp.gold - deduct });
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบเงิน')
          .setDescription(`ลบ **${deduct.toLocaleString()} Gold** จาก <@${target.id}>\nเหลือ: **${(tp.gold - deduct).toLocaleString()}**`)
      ] });
    } else {
      const deduct = Math.min(amount, tp.rc);
      updatePlayer(target.id, { rc: tp.rc - deduct });
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบเงิน')
          .setDescription(`ลบ **${deduct.toLocaleString()} RC** จาก <@${target.id}>\nเหลือ: **${(tp.rc - deduct).toLocaleString()}**`)
      ] });
    }
  }

  // /revoke
  if (cmd === 'revoke') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (item === 'reroll') {
      const deduct = Math.min(amount, tp.inv_reroll);
      updatePlayer(target.id, { inv_reroll: tp.inv_reroll - deduct });
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0xed4245).setTitle('Staff — ลบไอเทม')
          .setDescription(`ลบ **Re-roll x${deduct}** จาก <@${target.id}>\nเหลือ: **x${tp.inv_reroll - deduct}**`)
      ] });
    }
  }

  // /inspect
  if (cmd === 'inspect') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const tp = getPlayer(target.id);
    const bar = Array.from({ length: 7 }, (_, i) => i < tp.streak ? '⭐' : '☆').join(' ');
    return interaction.reply({ embeds: [
      new EmbedBuilder().setColor(0xffa500).setTitle(`Staff — Inventory ของ ${target.username}`)
        .addFields(
          { name: 'ยอดเงิน', value: `Gold: **${tp.gold.toLocaleString()}**\nRC: **${tp.rc.toLocaleString()}**\nชนะวันนี้: ${tp.win_today.toLocaleString()}/${WIN_CAP.toLocaleString()}`, inline: true },
          { name: 'Items', value: `Re-roll: **x${tp.inv_reroll}**`, inline: true },
          { name: 'Daily Streak', value: `${bar}\n${tp.streak}/7 วัน\nรับล่าสุด: ${tp.last_daily || 'ยังไม่เคย'}`, inline: false },
        )
    ], ephemeral: true });
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
  if (!game) return interaction.reply({ content: 'ไม่พบเกม Blackjack ครับ', ephemeral: true });

  if (id.startsWith('bj_hit_')) {
    game.player.push(game.deck.pop());
    const pv = handVal(game.player);
    if (pv > 21) {
      bjGames.delete(userId);
      const fresh = getPlayer(userId);
      return interaction.update({ embeds: [
        new EmbedBuilder().setColor(0xed4245).setTitle('Blackjack — แพ้ (Bust)')
          .setDescription(`ไพ่คุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}\n\nเกิน 21! -${game.amount.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)
      ], components: [] });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [
      new EmbedBuilder().setColor(0x5865f2).setTitle('Blackjack')
        .setDescription(`Dealer: ${cardStr(game.dealer[0])} ??\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`)
    ], components: [row] });
  }

  if (id.startsWith('bj_stand_')) {
    bjGames.delete(userId);
    while (handVal(game.dealer) < 17) game.dealer.push(game.deck.pop());
    const pv = handVal(game.player), dv = handVal(game.dealer);
    const dealerStr = `Dealer (${dv}): ${game.dealer.map(c => cardStr(c)).join(' ')}`;
    const playerStr = `คุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}`;
    if (dv > 21 || pv > dv) {
      const w = applyWin(userId, game.amount, 2);
      return interaction.update({ embeds: [
        new EmbedBuilder().setColor(0x57f287).setTitle('Blackjack — ชนะ!')
          .setDescription(`${dealerStr}\n${playerStr}\n\n+${w.profit.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${w.gold.toLocaleString()} Gold**`)
      ], components: [] });
    }
    if (pv === dv) {
      const p = getPlayer(userId);
      updatePlayer(userId, { gold: p.gold + game.amount });
      const fresh = getPlayer(userId);
      return interaction.update({ embeds: [
        new EmbedBuilder().setColor(0x5865f2).setTitle('Blackjack — เสมอ')
          .setDescription(`${dealerStr}\n${playerStr}\n\nคืนเงิน ${game.amount.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)
      ], components: [] });
    }
    const fresh = getPlayer(userId);
    return interaction.update({ embeds: [
      new EmbedBuilder().setColor(0xed4245).setTitle('Blackjack — แพ้')
        .setDescription(`${dealerStr}\n${playerStr}\n\n-${game.amount.toLocaleString()} Gold\nยอดรวม: **${fresh.gold.toLocaleString()} Gold**`)
    ], components: [] });
  }
}

client.login(process.env.DISCORD_TOKEN);
