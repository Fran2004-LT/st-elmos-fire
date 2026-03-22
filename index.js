// index.js — St. Elmo's Fire Bot
// Command: !r [expression]
// True Random: Node.js crypto (CSPRNG)

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { randomBytes } from 'crypto';
import 'dotenv/config';

const PREFIX = '!r';

// ══════════════════════════════════════════════
//  CSPRNG — Node.js crypto (same as Python secrets)
// ══════════════════════════════════════════════
function rand(min, max) {
  const range = max - min + 1;
  const n = Math.ceil(Math.log2(range) / 8) + 1;
  const mv = Math.floor(Math.pow(256, n) / range) * range;
  while (true) {
    const buf = randomBytes(n);
    let v = 0;
    for (const b of buf) v = v * 256 + b;
    if (v < mv) return min + (v % range);
  }
}

// ══════════════════════════════════════════════
//  PARSER
//  รองรับ: NdS, kh, kl, +, -, *, (), adv, dis, [tag], ชื่อ roll
// ══════════════════════════════════════════════
function parseRoll(raw) {
  let str = raw.trim();

  // extract adv / dis
  let mode = 'normal';
  if (/\badv\b/i.test(str)) { mode = 'adv'; str = str.replace(/\badv\b/i, '').trim(); }
  else if (/\bdis\b/i.test(str)) { mode = 'dis'; str = str.replace(/\bdis\b/i, '').trim(); }

  // extract [tags]
  const tags = [];
  str = str.replace(/\[([^\]]*)\]/g, (_, t) => { tags.push(t); return ''; }).trim();

  // extract trailing name (text after expression)
  let rollName = '';
  const trailMatch = str.match(/^([d0-9khl+\-*/().\s]+?)\s{1,}([a-zA-Z\u0E00-\u0E7F][^\d].*)$/);
  if (trailMatch) {
    rollName = trailMatch[2].trim();
    str = trailMatch[1].trim();
  }

  str = str.toLowerCase().replace(/\s+/g, '');
  if (!str) {
    // bare !r with no args → roll 1d20
    str = '1d20';
  }

  const result = parseExpr(str, mode);
  if (result.err) return result;
  return { ...result, tags, rollName, mode };
}

function parseExpr(str, mode) {
  // adv/dis shorthand: wrap simple dice as 2dSkh1 / 2dSkl1
  if (mode !== 'normal') {
    const dm = str.match(/^(\d*)d(\d+)((?:kh|kl)\d+)?([+\-].*)?$/);
    if (dm) {
      const sides = parseInt(dm[2]);
      const op = mode === 'adv' ? 'kh1' : 'kl1';
      const modifier = dm[4] || '';
      return parseExpr(`2d${sides}${op}${modifier}`, 'normal');
    }
  }

  // split on top-level + -
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
      i++; continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    cur += ch;
    i++;
  }

  if (!tokens.length) return { err: 'Expression ว่างเปล่า' };
  return { tokens };
}

function parseSegment(raw, sign) {
  // (expr)*N
  const parenMul = raw.match(/^\((.+)\)\*(\d+)$/);
  if (parenMul) {
    const sub = parseExpr(parenMul[1], 'normal');
    if (sub.err) return sub;
    return { type: 'multiply', sign, tokens: sub.tokens, mult: parseInt(parenMul[2]) };
  }

  // expr*N or N*expr
  const simpleMul = raw.match(/^(.+)\*(\d+)$/) || raw.match(/^(\d+)\*(.+)$/);
  if (simpleMul) {
    const isRightNum = /^\d+$/.test(simpleMul[2]);
    const expr = isRightNum ? simpleMul[1] : simpleMul[2];
    const mult = parseInt(isRightNum ? simpleMul[2] : simpleMul[1]);
    const sub = parseSegment(expr, 1);
    if (sub.err) return sub;
    return { type: 'multiply', sign, tokens: [sub], mult };
  }

  // dice: (N)dS(kh|kl)(K)
  const dm = raw.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/);
  if (dm) {
    const num = parseInt(dm[1] || '1'), sides = parseInt(dm[2]);
    const mode = dm[3] || 'normal', keep = dm[4] ? parseInt(dm[4]) : num;
    if (num < 1 || num > 100) return { err: `จำนวนลูกเต๋าต้อง 1–100 (${raw})` };
    if (sides < 2 || sides > 10000) return { err: `จำนวนหน้าต้อง 2–10000 (${raw})` };
    if (keep < 1 || keep > num) return { err: `keep ต้อง 1–${num} (${raw})` };
    return { type: 'dice', sign, num, sides, mode, keep };
  }

  // flat number
  if (/^\d+$/.test(raw)) return { type: 'flat', sign, value: parseInt(raw) };

  return { err: `ไม่รู้จัก: \`${raw}\`` };
}

// ══════════════════════════════════════════════
//  ROLL
// ══════════════════════════════════════════════
function rollSegment(seg) {
  if (seg.type === 'flat') {
    return { type: 'flat', sign: seg.sign, value: seg.value, total: seg.value * seg.sign };
  }

  if (seg.type === 'multiply') {
    const subResults = seg.tokens.map(t => rollSegment(t));
    const subTotal = subResults.reduce((a, r) => a + r.total, 0);
    return { type: 'multiply', sign: seg.sign, mult: seg.mult, subResults, subTotal, total: subTotal * seg.mult * seg.sign };
  }

  // dice
  const { num, sides, mode, keep } = seg;
  const rolls = Array.from({ length: num }, () => rand(1, sides));
  let kept = new Set(), sub = 0;

  if (mode === 'normal') {
    rolls.forEach((_, i) => kept.add(i));
    sub = rolls.reduce((a, b) => a + b, 0);
  } else if (mode === 'kh') {
    const thr = [...rolls].sort((a, b) => b - a)[keep - 1]; let k = 0;
    rolls.forEach((v, i) => { if (k < keep && v >= thr) { kept.add(i); k++; sub += v; } });
  } else {
    const thr = [...rolls].sort((a, b) => a - b)[keep - 1]; let k = 0;
    rolls.forEach((v, i) => { if (k < keep && v <= thr) { kept.add(i); k++; sub += v; } });
  }

  return { type: 'dice', sign: seg.sign, rolls, kept, sub, total: sub * seg.sign, sides, mode, keep, num };
}

// ══════════════════════════════════════════════
//  FORMAT → Discord text
// ══════════════════════════════════════════════
function formatDice(r) {
  return r.rolls.map((v, i) => {
    const isKept = r.kept.has(i);
    if (!isKept) return `~~${v}~~`;
    if (v === r.sides) return `__**${v}**__`; // max
    if (v === 1)       return `**${v}**`;      // min
    return `**${v}**`;
  }).join(' ');
}

function buildResponse(parsed, tokens) {
  const results = tokens.map(t => rollSegment(t));
  const grand = results.reduce((a, r) => a + r.total, 0);
  const isMulti = results.length > 1;

  const lines = [];

  // mode badge
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

  // total
  lines.push(`\n**Total: ${grand}**`);

  // build embed
  const title = parsed.rollName
    ? `🎲 ${parsed.rollName}`
    : `🎲 Roll`;

  const embed = new EmbedBuilder()
    .setColor(0xbb88ff)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'True Random · CSPRNG · No Mersenne Twister' });

  return embed;
}

// ══════════════════════════════════════════════
//  BOT
// ══════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ St. Elmo's Fire online: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.toLowerCase().startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim();

  // !r with no args → roll 1d20
  const raw = args || '1d20';

  const parsed = parseRoll(raw);

  if (parsed.err) {
    return message.reply(`❌ ${parsed.err}`);
  }

  try {
    const embed = buildResponse(parsed, parsed.tokens);
    await message.reply({ embeds: [embed] });
  } catch (e) {
    console.error(e);
    await message.reply('❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
});

client.login(process.env.DISCORD_TOKEN);
