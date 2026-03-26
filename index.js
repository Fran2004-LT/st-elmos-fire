// index.js — UmaRoll Bot (deploy-ready)
// Command: !r [expression]
// True Random: Node.js crypto (CSPRNG)

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { randomInt } from 'crypto';
import 'dotenv/config';

const PREFIX = process.env.BOT_PREFIX?.trim() || '!r';
const MAX_INPUT_LENGTH = Number(process.env.MAX_INPUT_LENGTH || 180);
const MAX_DICE = Number(process.env.MAX_DICE || 100);
const MAX_SIDES = Number(process.env.MAX_SIDES || 10000);
const MAX_MULTIPLIER = Number(process.env.MAX_MULTIPLIER || 100);
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS || 1200);
const EMBED_COLOR = Number(process.env.EMBED_COLOR || 0xbb88ff);

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in environment');
  process.exit(1);
}

const cooldowns = new Map();

function rand(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`Invalid rand() range: ${min}..${max}`);
  }
  // crypto.randomInt(min, max) → [min, max) แบบ CSPRNG ไม่มี pattern ไม่มี rejection loop
  return randomInt(min, max + 1);
}

function parseRoll(raw) {
  let str = String(raw ?? '').trim();

  if (str.length > MAX_INPUT_LENGTH) {
    return { err: `คำสั่งยาวเกินไป (สูงสุด ${MAX_INPUT_LENGTH} ตัวอักษร)` };
  }

  let mode = 'normal';
  if (/\badv\b/i.test(str)) {
    mode = 'adv';
    str = str.replace(/\badv\b/i, '').trim();
  } else if (/\bdis\b/i.test(str)) {
    mode = 'dis';
    str = str.replace(/\bdis\b/i, '').trim();
  }

  const tags = [];
  str = str.replace(/\[([^\]]*)\]/g, (_, t) => {
    const tag = t.trim();
    if (tag) tags.push(tag);
    return '';
  }).trim();

  let rollName = '';
  const trailMatch = str.match(/^([d0-9khl+\-*/().\s]+?)\s{1,}([^\s].*)$/u);
  if (trailMatch) {
    rollName = trailMatch[2].trim();
    str = trailMatch[1].trim();
  }

  str = str.toLowerCase().replace(/\s+/g, '');
  if (!str) str = '1d20';

  if (/[^0-9dklh+\-*/().]/.test(str)) {
    return { err: 'Expression มีอักขระที่ไม่รองรับ' };
  }

  const result = parseExpr(str, mode);
  if (result.err) return result;
  return { ...result, tags, rollName, mode, raw: String(raw ?? '') };
}

function parseExpr(str, mode) {
  if (mode !== 'normal') {
    const dm = str.match(/^(\d*)d(\d+)(?:((?:kh|kl)\d+))?([+\-]\d+)?$/);
    if (!dm) {
      return { err: 'adv/dis ใช้ได้กับ single dice expression แบบง่าย เช่น 1d20 adv หรือ 1d20+5 dis' };
    }
    const sides = parseInt(dm[2], 10);
    const op = mode === 'adv' ? 'kh1' : 'kl1';
    const modifier = dm[4] || '';
    return parseExpr(`2d${sides}${op}${modifier}`, 'normal');
  }

  const tokens = [];
  let i = 0, sign = 1, depth = 0, cur = '';

  while (i <= str.length) {
    const ch = str[i];

    if (i === str.length || ((ch === '+' || ch === '-') && depth === 0 && i > 0)) {
      if (cur) {
        const seg = parseSegment(cur, sign);
        if (seg.err) return seg;
        tokens.push(seg);
        cur = '';
      }
      if (i < str.length) sign = ch === '+' ? 1 : -1;
      i++;
      continue;
    }

    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth < 0) return { err: 'วงเล็บปิดเกินมา' };
    }

    cur += ch;
    i++;
  }

  if (depth !== 0) return { err: 'วงเล็บไม่สมดุล' };
  if (!tokens.length) return { err: 'Expression ว่างเปล่า' };

  return { tokens };
}

function parseSegment(raw, sign) {
  const parenMul = raw.match(/^\((.+)\)\*(\d+)$/);
  if (parenMul) {
    const mult = parseInt(parenMul[2], 10);
    if (mult < 1 || mult > MAX_MULTIPLIER) {
      return { err: `ตัวคูณต้อง 1–${MAX_MULTIPLIER} (${raw})` };
    }
    const sub = parseExpr(parenMul[1], 'normal');
    if (sub.err) return sub;
    return { type: 'multiply', sign, tokens: sub.tokens, mult };
  }

  const simpleMul = raw.match(/^(.+)\*(\d+)$/) || raw.match(/^(\d+)\*(.+)$/);
  if (simpleMul) {
    const isRightNum = /^\d+$/.test(simpleMul[2]);
    const expr = isRightNum ? simpleMul[1] : simpleMul[2];
    const mult = parseInt(isRightNum ? simpleMul[2] : simpleMul[1], 10);

    if (mult < 1 || mult > MAX_MULTIPLIER) {
      return { err: `ตัวคูณต้อง 1–${MAX_MULTIPLIER} (${raw})` };
    }

    const sub = parseSegment(expr, 1);
    if (sub.err) return sub;
    return { type: 'multiply', sign, tokens: [sub], mult };
  }

  const dm = raw.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/);
  if (dm) {
    const num = parseInt(dm[1] || '1', 10);
    const sides = parseInt(dm[2], 10);
    const mode = dm[3] || 'normal';
    const keep = dm[4] ? parseInt(dm[4], 10) : num;

    if (num < 1 || num > MAX_DICE) return { err: `จำนวนลูกเต๋าต้อง 1–${MAX_DICE} (${raw})` };
    if (sides < 2 || sides > MAX_SIDES) return { err: `จำนวนหน้าต้อง 2–${MAX_SIDES} (${raw})` };
    if (keep < 1 || keep > num) return { err: `keep ต้อง 1–${num} (${raw})` };

    return { type: 'dice', sign, num, sides, mode, keep };
  }

  if (/^\d+$/.test(raw)) return { type: 'flat', sign, value: parseInt(raw, 10) };

  return { err: `ไม่รู้จัก: \`${raw}\`` };
}

function rollSegment(seg) {
  if (seg.type === 'flat') {
    return { type: 'flat', sign: seg.sign, value: seg.value, total: seg.value * seg.sign };
  }

  if (seg.type === 'multiply') {
    const subResults = seg.tokens.map(t => rollSegment(t));
    const subTotal = subResults.reduce((a, r) => a + r.total, 0);
    return {
      type: 'multiply',
      sign: seg.sign,
      mult: seg.mult,
      subResults,
      subTotal,
      total: subTotal * seg.mult * seg.sign,
    };
  }

  const { num, sides, mode, keep } = seg;
  const rolls = Array.from({ length: num }, () => rand(1, sides));
  const indexed = rolls.map((value, index) => ({ value, index }));

  let selected;
  if (mode === 'normal') {
    selected = indexed;
  } else if (mode === 'kh') {
    selected = [...indexed]
      .sort((a, b) => b.value - a.value || a.index - b.index)
      .slice(0, keep);
  } else {
    selected = [...indexed]
      .sort((a, b) => a.value - b.value || a.index - b.index)
      .slice(0, keep);
  }

  const kept = new Set(selected.map(x => x.index));
  const sub = selected.reduce((sum, x) => sum + x.value, 0);

  return { type: 'dice', sign: seg.sign, rolls, kept, sub, total: sub * seg.sign, sides, mode, keep, num };
}

function formatDice(r) {
  return r.rolls.map((v, i) => {
    const isKept = r.kept.has(i);
    if (!isKept) return `~~${v}~~`;
    if (v === r.sides) return `__**${v}**__`;
    if (v === 1) return `**${v}**`;
    return `**${v}**`;
  }).join(' ');
}

function buildResponse(parsed, tokens, requestedBy) {
  const results = tokens.map(t => rollSegment(t));
  const grand = results.reduce((a, r) => a + r.total, 0);
  const isMulti = results.length > 1;

  const lines = [];
  if (parsed.mode === 'adv') lines.push('`ADVANTAGE`');
  if (parsed.mode === 'dis') lines.push('`DISADVANTAGE`');

  for (const r of results) {
    if (r.type === 'flat') {
      lines.push(`${r.sign < 0 ? '−' : '+'} **${r.value}** (modifier)`);
      continue;
    }

    if (r.type === 'multiply') {
      for (const sr of r.subResults) {
        if (sr.type === 'dice') {
          let ex = `${sr.num}d${sr.sides}`;
          if (sr.mode === 'kh') ex += ` kh${sr.keep}`;
          if (sr.mode === 'kl') ex += ` kl${sr.keep}`;
          lines.push(`\`${ex}\` → ${formatDice(sr)}`);
        }
      }
      lines.push(`× ${r.mult} = **${r.sign < 0 ? '−' : ''}${Math.abs(r.total)}**`);
      continue;
    }

    let ex = `${r.num}d${r.sides}`;
    if (r.mode === 'kh') ex += ` kh${r.keep}`;
    if (r.mode === 'kl') ex += ` kl${r.keep}`;

    const tags = parsed.tags.length ? ` [${parsed.tags.join(', ')}]` : '';
    const sub = isMulti ? ` = **${r.sign < 0 ? '−' : ''}${Math.abs(r.sub)}**` : '';
    lines.push(`\`${ex}${tags}\` → ${formatDice(r)}${sub}`);
  }

  lines.push(`\n${requestedBy || 'Total'} ${grand}`);

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(parsed.rollName ? `🎲 ${parsed.rollName}` : '🎲 Roll')
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date());
}

function cleanupCooldowns() {
  const now = Date.now();
  for (const [userId, until] of cooldowns.entries()) {
    if (until <= now) cooldowns.delete(userId);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', () => {
  console.log(`✅ UmaRoll online: ${client.user.tag}`);
  console.log(`ℹ️ Prefix: ${PREFIX}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

  cleanupCooldowns();

  const now = Date.now();
  const cooldownUntil = cooldowns.get(message.author.id) || 0;
  if (now < cooldownUntil) {
    const wait = ((cooldownUntil - now) / 1000).toFixed(1);
    await message.reply(`⏳ รอสักครู่ก่อน (${wait}s)`);
    return;
  }
  cooldowns.set(message.author.id, now + COOLDOWN_MS);

  const args = message.content.slice(PREFIX.length).trim();
  const raw = args || '1d20';
  const parsed = parseRoll(raw);

  if (parsed.err) {
    await message.reply(`❌ ${parsed.err}`);
    return;
  }

  try {
    const username = message.member?.displayName || message.author.username;
    const embed = buildResponse(parsed, parsed.tokens, `@${username}`);
    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Roll error:', error);
    await message.reply('❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
});

client.login(process.env.DISCORD_TOKEN);
