// index.js — St. Elmo's Fire v3.0
// Commands: !r, /roll, /daily, /inventory, /coinflip, /slots, /blackjack, /roulette
//           /convert, /use, /give (staff), /gift (staff)
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

const DAILY_REWARDS = [
  { type: 'gold', amount: 200 },
  { type: 'gold', amount: 400 },
  { type: 'gold', amount: 600 },
  { type: 'gold', amount: 800 },
  { type: 'gold', amount: 1000 },
  { type: 'rc',   amount: 50 },
  { type: 'item',  item: 'reroll', amount: 1 },
];

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

function getPlayer(userId) {
  let p = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  if (!p) {
    db.prepare('INSERT INTO players (user_id) VALUES (?)').run(userId);
    p = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  }
  const today = new Date().toDateString();
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
    const num = parseInt(dm[1] || '1'), sides = parseInt(dm[2]), mode = dm[3] || 'normal', keep = dm[4] ? parseInt(dm[4]) : num;
    if (num < 1 || num > 100)       return { err: `จำนวนลูกเต๋าต้อง 1–100 (${raw})` };
    if (sides < 2 || sides > 10000) return { err: `จำนวนหน้าต้อง 2–10000 (${raw})` };
    if (keep < 1 || keep > num)     return { err: `keep ต้อง 1–${num} (${raw})` };
    return { type: 'dice', sign, num, sides, mode, keep };
  }
  if (/^\d+$/.test(raw)) return { type: 'flat', sign, value: parseInt(raw) };
  return { err: `ไม่รู้จัก: \`${raw}\`` };
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
    if (r.type === 'flat') { lines.push(`${r.sign < 0 ? '−' : '+'} **${r.value}** (modifier)`); continue; }
    if (r.type === 'multiply') {
      for (const sr of r.subResults) {
        if (sr.type === 'dice') {
          let ex = `${sr.num}d${sr.sides}`;
          if (sr.mode === 'kh') ex += ` kh${sr.keep}`;
          if (sr.mode === 'kl') ex += ` kl${sr.keep}`;
          lines.push(`\`${ex}\` → ${formatDice(sr)}`);
        }
      }
      lines.push(`× ${r.mult} = **${r.sign < 0 ? '−' : ''}${Math.abs(r.total)}**`); continue;
    }
    let ex = `${r.num}d${r.sides}`;
    if (r.mode === 'kh') ex += ` kh${r.keep}`;
    if (r.mode === 'kl') ex += ` kl${r.keep}`;
    const tags = parsed.tags.length ? ` [${parsed.tags.join(', ')}]` : '';
    const sub = isMulti ? ` = **${r.sign < 0 ? '−' : ''}${Math.abs(r.sub)}**` : '';
    lines.push(`\`${ex}${tags}\` → ${formatDice(r)}${sub}`);
  }
  lines.push(`\n@${username}\u2003**${grand}**`);
  return new EmbedBuilder().setColor(0xbb88ff).setDescription(lines.join('\n'));
}

// ══════════════════════════════════════════════
//  ECONOMY HELPERS
// ══════════════════════════════════════════════
function applyWin(p, amount) {
  if (p.win_today >= WIN_CAP) return { ok: false, reason: `ถึง Daily Win Cap แล้วครับ (${WIN_CAP.toLocaleString()}/วัน)` };
  const actual = Math.min(amount, WIN_CAP - p.win_today);
  const taxed = Math.floor(actual * (1 - TAX));
  updatePlayer(p.user_id, { gold: p.gold + taxed, win_today: p.win_today + actual });
  p.gold += taxed; p.win_today += actual;
  return { ok: true, taxed, actual };
}

function applyLoss(p, amount) {
  if (p.gold < amount) return { ok: false, reason: `Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})` };
  updatePlayer(p.user_id, { gold: p.gold - amount });
  p.gold -= amount;
  return { ok: true };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE) || member.permissions.has(PermissionFlagsBits.Administrator);
}

// ══════════════════════════════════════════════
//  SLOTS
// ══════════════════════════════════════════════
const SLOT_SYMS = ['🍒','🍋','🍊','⭐','💎','7️⃣'];
const SLOT_W    = [30, 25, 20, 15, 7, 3];

function spinSlot() {
  const r = rand(1, 100); let c = 0;
  for (let i = 0; i < SLOT_SYMS.length; i++) { c += SLOT_W[i]; if (r <= c) return SLOT_SYMS[i]; }
  return SLOT_SYMS[0];
}

// ══════════════════════════════════════════════
//  BLACKJACK STATE
// ══════════════════════════════════════════════
const bjGames = new Map();

const BJ_SUITS = ['♠','♥','♦','♣'], BJ_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function makeDeck() {
  const d = [];
  for (const s of BJ_SUITS) for (const r of BJ_RANKS) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = rand(0, i); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function cardVal(c) { if (['J','Q','K'].includes(c.r)) return 10; if (c.r === 'A') return 11; return parseInt(c.r); }
function handVal(h) { let v = h.reduce((a, c) => a + cardVal(c), 0), ac = h.filter(c => c.r === 'A').length; while (v > 21 && ac > 0) { v -= 10; ac--; } return v; }
function cardStr(c) { return `${c.r}${c.s}`; }

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
//  SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════
const commands = [
  new SlashCommandBuilder().setName('roll').setDescription('ทอยลูกเต๋า')
    .addStringOption(o => o.setName('expression').setDescription('เช่น 4d30kh3, 2d20 adv').setRequired(false)),

  new SlashCommandBuilder().setName('daily').setDescription('รับรางวัล login ประจำวัน'),

  new SlashCommandBuilder().setName('inventory').setDescription('ดูกระเป๋า เงิน ไอเทม'),

  new SlashCommandBuilder().setName('convert').setDescription('แลก Gold → Rainbow Carrot (3:1)')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(3)),

  new SlashCommandBuilder().setName('use').setDescription('ใช้ไอเทม')
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true)
      .addChoices({ name: '🎲 Re-roll', value: 'reroll' })),

  new SlashCommandBuilder().setName('coinflip').setDescription('ทอยเหรียญ')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('choice').setDescription('หัว/ก้อย').setRequired(true)
      .addChoices({ name: 'Heads 🟡', value: 'heads' }, { name: 'Tails ⚫', value: 'tails' })),

  new SlashCommandBuilder().setName('slots').setDescription('สล็อต — Progressive Jackpot')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('blackjack').setDescription('แบล็คแจ็ค')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('roulette').setDescription('รูเล็ต')
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน Gold').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('bet').setDescription('red/black/odd/even/1-18/19-36/0-36').setRequired(true)),

  new SlashCommandBuilder().setName('give').setDescription('[Staff] แจกเงิน')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('ผู้เล่น').setRequired(true))
    .addStringOption(o => o.setName('currency').setDescription('สกุลเงิน').setRequired(true)
      .addChoices({ name: '🪙 Gold', value: 'gold' }, { name: '🌈 Rainbow Carrot', value: 'rc' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('gift').setDescription('[Staff] แจกไอเทม')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('ผู้เล่น').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ไอเทม').setRequired(true)
      .addChoices({ name: '🎲 Re-roll', value: 'reroll' }))
    .addIntegerOption(o => o.setName('amount').setDescription('จำนวน').setRequired(true).setMinValue(1)),
].map(c => c.toJSON());

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ Slash commands registered');
}

// ══════════════════════════════════════════════
//  BOT CLIENT
// ══════════════════════════════════════════════
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('clientReady', async () => {
  console.log(`✅ St. Elmo's Fire v3.0 online: ${client.user.tag}`);
  await deployCommands();
});

// ── !r prefix ─────────────────────────────────
client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.content.toLowerCase().startsWith(PREFIX)) return;
  const raw = msg.content.slice(PREFIX.length).trim() || '1d20';
  const parsed = parseRoll(raw);
  if (parsed.err) return msg.reply(`❌ ${parsed.err}`);
  const username = msg.member?.displayName || msg.author.username;
  try { await msg.reply({ embeds: [buildRollEmbed(parsed, parsed.tokens, username)] }); }
  catch (e) { console.error(e); await msg.reply('❌ เกิดข้อผิดพลาด'); }
});

// ── Interactions ───────────────────────────────
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) await handleSlash(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
  } catch (e) {
    console.error(e);
    const reply = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่ครับ', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
});

async function handleSlash(interaction) {
  const cmd = interaction.commandName;
  const userId = interaction.user.id;
  const username = interaction.member?.displayName || interaction.user.username;

  // /roll
  if (cmd === 'roll') {
    const raw = interaction.options.getString('expression') || '1d20';
    const parsed = parseRoll(raw);
    if (parsed.err) return interaction.reply({ content: `❌ ${parsed.err}`, ephemeral: true });
    return interaction.reply({ embeds: [buildRollEmbed(parsed, parsed.tokens, username)] });
  }

  // /daily
  if (cmd === 'daily') {
    const p = getPlayer(userId);
    const today = new Date().toDateString();
    if (p.last_daily === today) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📅 Daily').setDescription('รับแล้ววันนี้ครับ มาใหม่พรุ่งนี้! 🌙')], ephemeral: true });
    }
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const streak = p.last_daily === yest.toDateString() ? (p.streak % 7) + 1 : 1;
    const reward = DAILY_REWARDS[streak - 1];
    const updates = { streak, last_daily: today };
    if (reward.type === 'gold') { updates.gold = p.gold + reward.amount; }
    if (reward.type === 'rc')   { updates.rc   = p.rc   + reward.amount; }
    if (reward.type === 'item' && reward.item === 'reroll') { updates.inv_reroll = p.inv_reroll + 1; }
    updatePlayer(userId, updates);
    const labels = ['🪙 200 Gold','🪙 400 Gold','🪙 600 Gold','🪙 800 Gold','🪙 1,000 Gold','🌈 50 RC','🎲 Re-roll x1'];
    const bar = Array.from({length:7}, (_,i) => i < streak ? '⭐' : '☆').join(' ');
    const nextInfo = streak < 7 ? `\n\nพรุ่งนี้: ${labels[streak]}` : '\n\n🎉 ครบ 7 วัน! Streak รีเซ็ต';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('📅 Daily Login — รับแล้ว!')
      .setDescription(`วันที่ ${streak}/7\n${bar}\n\nรางวัล: **${labels[streak-1]}**${nextInfo}`)] });
  }

  // /inventory
  if (cmd === 'inventory') {
    const p = getPlayer(userId);
    const pool = getPool();
    const isOwner = userId === OWNER_ID;
    const color = isOwner ? 0x6a1aff : 0x111111;
    const bar = Array.from({length:7}, (_,i) => i < p.streak ? '⭐' : '☆').join(' ');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle(`📦 ${username}`)
      .addFields(
        { name: '💰 ยอดเงิน', value: `🪙 Gold: **${p.gold.toLocaleString()}**\n🌈 RC: **${p.rc.toLocaleString()}**\n📊 ชนะวันนี้: ${p.win_today.toLocaleString()}/${WIN_CAP.toLocaleString()}`, inline: true },
        { name: '🎒 Items', value: `🎲 Re-roll: **x${p.inv_reroll}**`, inline: true },
        { name: '📅 Daily Streak', value: `${bar}\n${p.streak}/7 วัน`, inline: false },
        { name: '🎰 Jackpot Pool', value: `สะสม: **${pool.toLocaleString()}** Gold\nถ้าตีได้: **${(pool * JACKPOT_MULT).toLocaleString()}** Gold`, inline: false },
      )] });
  }

  // /convert
  if (cmd === 'convert') {
    const p = getPlayer(userId);
    const amount = interaction.options.getInteger('amount');
    if (amount % EXCHANGE_RATE !== 0) return interaction.reply({ content: `❌ ต้องแลกเป็นทวีคูณของ ${EXCHANGE_RATE} ครับ (3 Gold = 1 RC)`, ephemeral: true });
    if (p.gold < amount) return interaction.reply({ content: `❌ Gold ไม่พอครับ (มี ${p.gold.toLocaleString()})`, ephemeral: true });
    const rc = amount / EXCHANGE_RATE;
    updatePlayer(userId, { gold: p.gold - amount, rc: p.rc + rc });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xbb88ff).setTitle('🔄 แลกเงิน')
      .setDescription(`🪙 -${amount.toLocaleString()} Gold → 🌈 +${rc.toLocaleString()} RC\n\nGold เหลือ: **${(p.gold - amount).toLocaleString()}**\nRC ทั้งหมด: **${(p.rc + rc).toLocaleString()}**`)] });
  }

  // /use
  if (cmd === 'use') {
    const p = getPlayer(userId);
    const item = interaction.options.getString('item');
    if (item === 'reroll') {
      if (p.inv_reroll < 1) return interaction.reply({ content: '❌ ไม่มี Re-roll ครับ', ephemeral: true });
      updatePlayer(userId, { inv_reroll: p.inv_reroll - 1 });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xbb88ff).setTitle('🎲 ใช้ Re-roll')
        .setDescription(`ใช้ Re-roll แล้วครับ!\nเหลือ: **x${p.inv_reroll - 1}**\n\nทอยใหม่ได้เลยครับ 🎲`)] });
    }
  }

  // /coinflip
  if (cmd === 'coinflip') {
    const p = getPlayer(userId);
    if (p.win_today >= WIN_CAP) return interaction.reply({ content: `❌ ถึง Daily Win Cap แล้วครับ (${WIN_CAP.toLocaleString()}/วัน)`, ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const choice = interaction.options.getString('choice');
    const loss = applyLoss(p, amount);
    if (!loss.ok) return interaction.reply({ content: `❌ ${loss.reason}`, ephemeral: true });
    const win = randF() < 0.45;
    const result = win ? choice : (choice === 'heads' ? 'tails' : 'heads');
    const emoji = result === 'heads' ? '🟡' : '⚫';
    if (win) {
      const w = applyWin(p, amount);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(`${emoji} Coinflip — ชนะ!`)
        .setDescription(`ผล: **${result.toUpperCase()}** ✅\n\n+${w.taxed.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
    } else {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle(`${emoji} Coinflip — แพ้`)
        .setDescription(`ผล: **${result.toUpperCase()}** ❌\n\n-${amount.toLocaleString()} Gold\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
    }
  }

  // /slots
  if (cmd === 'slots') {
    const p = getPlayer(userId);
    if (p.win_today >= WIN_CAP) return interaction.reply({ content: `❌ ถึง Daily Win Cap แล้วครับ`, ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const loss = applyLoss(p, amount);
    if (!loss.ok) return interaction.reply({ content: `❌ ${loss.reason}`, ephemeral: true });

    const contrib = Math.floor(amount * POOL_CONTRIB);
    setPool(getPool() + contrib);

    const forceWin = randF() < 0.35;
    let reels = [spinSlot(), spinSlot(), spinSlot()];
    if (forceWin) { const s = spinSlot(); reels = [s, s, s]; }
    else { while (reels[0] === reels[1] && reels[1] === reels[2]) reels[2] = spinSlot(); }

    const pool = getPool();
    const isJP = forceWin && reels[0] === '7️⃣' && pool > 0;
    const reelStr = reels.join('  ');

    if (isJP) {
      const jpAmt = pool * JACKPOT_MULT;
      const taxed = Math.floor(jpAmt * (1 - TAX));
      setPool(0);
      updatePlayer(userId, { gold: p.gold + taxed, win_today: Math.min(p.win_today + jpAmt, WIN_CAP) });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🎰 JACKPOT!!!')
        .setDescription(`${reelStr}\n\n🎊 **7️⃣ 7️⃣ 7️⃣ — JACKPOT!**\nPool: ${pool.toLocaleString()} × ${JACKPOT_MULT}\nหัก Tax 3% → **+${taxed.toLocaleString()} Gold**\nยอดรวม: **${(p.gold + taxed).toLocaleString()} 🪙**`)] });
    }

    if (forceWin) {
      const mult = reels[0] === '💎' ? 10 : reels[0] === '⭐' ? 5 : 3;
      const w = applyWin(p, amount * mult);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎰 Slots — ชนะ!')
        .setDescription(`${reelStr}\n\n**${reels[0]}${reels[0]}${reels[0]} — ${mult}x!**\n+${w.taxed.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
    }

    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🎰 Slots')
      .setDescription(`${reelStr}\n\nไม่ match — -${amount.toLocaleString()} Gold\n(${contrib} เข้า Jackpot Pool)\nPool ปัจจุบัน: ${getPool().toLocaleString()}\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
  }

  // /blackjack
  if (cmd === 'blackjack') {
    const p = getPlayer(userId);
    if (p.win_today >= WIN_CAP) return interaction.reply({ content: `❌ ถึง Daily Win Cap แล้วครับ`, ephemeral: true });
    if (bjGames.has(userId)) return interaction.reply({ content: '❌ มีเกม Blackjack ค้างอยู่ครับ', ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const loss = applyLoss(p, amount);
    if (!loss.ok) return interaction.reply({ content: `❌ ${loss.reason}`, ephemeral: true });

    const deck = makeDeck();
    const game = { amount, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], userId };
    const pv = handVal(game.player);

    if (pv === 21) {
      const w = applyWin(p, Math.floor(amount * 2.5));
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🃏 BLACKJACK! 21!')
        .setDescription(`ไพ่คุณ: ${game.player.map(c => cardStr(c)).join(' ')}\n\n**BLACKJACK! ชนะ 2.5x!**\n+${w.taxed.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
    }

    bjGames.set(userId, game);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('🃏 Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('✋ Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack')
      .setDescription(`**Dealer:** ${cardStr(game.dealer[0])} ??\n**คุณ (${pv}):** ${game.player.map(c => cardStr(c)).join(' ')}`)], components: [row] });
  }

  // /roulette
  if (cmd === 'roulette') {
    const p = getPlayer(userId);
    if (p.win_today >= WIN_CAP) return interaction.reply({ content: `❌ ถึง Daily Win Cap แล้วครับ`, ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const bet = interaction.options.getString('bet').toLowerCase();
    const validBets = ['red','black','odd','even','1-18','19-36'];
    const isNumBet = !isNaN(parseInt(bet)) && parseInt(bet) >= 0 && parseInt(bet) <= 36;
    if (!validBets.includes(bet) && !isNumBet) return interaction.reply({ content: '❌ bet ไม่ถูกต้องครับ\nตัวเลือก: red, black, odd, even, 1-18, 19-36 หรือตัวเลข 0-36', ephemeral: true });
    const loss = applyLoss(p, amount);
    if (!loss.ok) return interaction.reply({ content: `❌ ${loss.reason}`, ephemeral: true });
    const n = rand(0, 36);
    const color = roulColor(n);
    const colorEmoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
    const win = roulWin(bet, n);
    const pay = roulPay(bet);
    if (win) {
      const w = applyWin(p, amount * pay);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎡 Roulette — ชนะ!')
        .setDescription(`ลูกหยุดที่: **${n}** ${colorEmoji}\nเดิมพัน: **${bet}** (${pay}x)\n\n+${w.taxed.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
    }
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🎡 Roulette — แพ้')
      .setDescription(`ลูกหยุดที่: **${n}** ${colorEmoji}\nเดิมพัน: **${bet}**\n\n-${amount.toLocaleString()} Gold\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)] });
  }

  // /give (Staff)
  if (cmd === 'give') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (currency === 'gold') updatePlayer(target.id, { gold: tp.gold + amount });
    else updatePlayer(target.id, { rc: tp.rc + amount });
    const symbol = currency === 'gold' ? '🪙 Gold' : '🌈 RC';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('💰 แจกเงิน')
      .setDescription(`แจก **${amount.toLocaleString()} ${symbol}** ให้ <@${target.id}> แล้วครับ`)] });
  }

  // /gift (Staff)
  if (cmd === 'gift') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff เท่านั้นครับ', ephemeral: true });
    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const tp = getPlayer(target.id);
    if (item === 'reroll') updatePlayer(target.id, { inv_reroll: tp.inv_reroll + amount });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xbb88ff).setTitle('🎁 แจกไอเทม')
      .setDescription(`แจก **🎲 Re-roll x${amount}** ให้ <@${target.id}> แล้วครับ`)] });
  }
}

// ── Blackjack buttons ──────────────────────────
async function handleButton(interaction) {
  const id = interaction.customId;
  const userId = interaction.user.id;

  if (!id.startsWith('bj_')) return;
  if (!id.endsWith(userId)) return interaction.reply({ content: '❌ นี่ไม่ใช่เกมของคุณครับ', ephemeral: true });

  const game = bjGames.get(userId);
  if (!game) return interaction.reply({ content: '❌ ไม่พบเกม Blackjack ครับ', ephemeral: true });
  const p = getPlayer(userId);

  if (id.startsWith('bj_hit_')) {
    game.player.push(game.deck.pop());
    const pv = handVal(game.player);
    if (pv > 21) {
      bjGames.delete(userId);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🃏 Blackjack — แพ้ (Bust)')
        .setDescription(`ไพ่คุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}\n\n**เกิน 21!** -${game.amount.toLocaleString()} Gold\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)], components: [] });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('🃏 Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('✋ Stand').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack')
      .setDescription(`**Dealer:** ${cardStr(game.dealer[0])} ??\n**คุณ (${pv}):** ${game.player.map(c => cardStr(c)).join(' ')}`)], components: [row] });
  }

  if (id.startsWith('bj_stand_')) {
    bjGames.delete(userId);
    while (handVal(game.dealer) < 17) game.dealer.push(game.deck.pop());
    const pv = handVal(game.player), dv = handVal(game.dealer);
    if (dv > 21 || pv > dv) {
      const w = applyWin(p, game.amount * 2);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🃏 Blackjack — ชนะ!')
        .setDescription(`Dealer (${dv}): ${game.dealer.map(c => cardStr(c)).join(' ')}\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}\n\n+${w.taxed.toLocaleString()} Gold (หัก Tax 3%)\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)], components: [] });
    }
    if (pv === dv) {
      updatePlayer(userId, { gold: p.gold + game.amount });
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🃏 Blackjack — เสมอ')
        .setDescription(`Dealer (${dv}): ${game.dealer.map(c => cardStr(c)).join(' ')}\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}\n\nคืนเงิน ${game.amount.toLocaleString()} Gold`)], components: [] });
    }
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🃏 Blackjack — แพ้')
      .setDescription(`Dealer (${dv}): ${game.dealer.map(c => cardStr(c)).join(' ')}\nคุณ (${pv}): ${game.player.map(c => cardStr(c)).join(' ')}\n\n-${game.amount.toLocaleString()} Gold\nยอดรวม: **${p.gold.toLocaleString()} 🪙**`)], components: [] });
  }
}

client.login(process.env.DISCORD_TOKEN);
