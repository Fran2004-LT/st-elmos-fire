# 🎲 UmaRoll Bot

Discord dice roller — True Random (CSPRNG)

## Setup

```bash
npm install
cp .env.example .env   # ใส่ bot token
node index.js
```

## Bot Permissions ที่ต้องการ
- Read Messages / View Channels
- Send Messages
- Read Message History
- **Message Content Intent** (เปิดใน Discord Developer Portal → Bot → Privileged Gateway Intents)

## การใช้งาน

```
!r              → ทอย 1d20
!r 1d20
!r 1d20+4
!r 4d30kh3
!r 6d30kh3
!r 2d20kh1+5
!r 1d20 adv     → Advantage
!r 1d20-3 dis   → Disadvantage
!r (1d8+4)*2    → คูณ
!r 1d8+1d6+3    → หลาย dice
!r 1d10[piercing]+2d6[cold] Ice Knife   → tag + ชื่อ
```

## Deploy
- **Railway / Render / Fly.io** — push repo + ตั้ง DISCORD_TOKEN env
- **VPS** — `node index.js` หรือใช้ `pm2 start index.js`
- Node.js 18+ required
