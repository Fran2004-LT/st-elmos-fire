<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>St. Elmo's Fire v6.0 — Demo</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Noto+Sans+Thai:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#111; font-family:'Rajdhani','Noto Sans Thai',sans-serif; color:#fff; padding:32px; }
  h1 { text-align:center; font-size:22px; color:#aaa; margin-bottom:8px; letter-spacing:3px; }
  h2 { font-size:13px; color:#555; text-align:center; margin-bottom:40px; letter-spacing:2px; }
  .section { margin-bottom:48px; }
  .section-title { font-size:11px; color:#444; letter-spacing:4px; text-transform:uppercase; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid #222; }
  .cards { display:flex; flex-wrap:wrap; gap:16px; }

  /* ─── INVENTORY CARD ─── */
  .inv-card {
    width:560px; border-radius:12px; overflow:hidden; position:relative;
    border:1px solid rgba(255,255,255,0.08); font-family:'Rajdhani','Noto Sans Thai',sans-serif;
  }
  .inv-card .top-strip { height:3px; }
  .inv-card .left-bar { position:absolute; left:0; top:0; width:5px; height:100%; }
  .inv-card .inner { padding:18px 20px 18px 24px; }
  .inv-card .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .inv-card .avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; flex-shrink:0; }
  .inv-card .name-box { margin-left:10px; }
  .inv-card .username { font-weight:700; font-size:15px; }
  .inv-card .badge { font-size:10px; opacity:0.7; display:flex; align-items:center; gap:4px; margin-top:2px; }
  .inv-card .streak-txt { font-size:12px; font-weight:700; opacity:0.8; }
  .inv-card .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
  .inv-card .stat-box { padding:10px 14px; border-radius:8px; }
  .inv-card .stat-val { font-size:22px; font-weight:700; }
  .inv-card .stat-label { font-size:9px; opacity:0.5; letter-spacing:1px; margin-top:2px; }
  .inv-card .win-bar-wrap { margin-bottom:12px; }
  .inv-card .win-bar-label { font-size:9px; opacity:0.4; letter-spacing:1px; margin-bottom:4px; display:flex; justify-content:space-between; }
  .inv-card .win-bar { height:3px; border-radius:2px; background:rgba(255,255,255,0.08); }
  .inv-card .win-bar-fill { height:100%; border-radius:2px; }
  .inv-card .items { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px; }
  .inv-card .item-box { padding:8px 10px; border-radius:7px; }
  .inv-card .item-val { font-size:18px; font-weight:700; }
  .inv-card .item-label { font-size:8px; opacity:0.45; letter-spacing:1px; }
  .inv-card .footer { display:flex; justify-content:space-between; align-items:center; }
  .inv-card .btn { font-size:10px; padding:5px 12px; border-radius:5px; border:1px solid rgba(255,255,255,0.12); cursor:pointer; font-family:inherit; }
  .inv-card .brand { font-size:9px; opacity:0.25; letter-spacing:2px; }

  /* DEBUT — dark warm grey */
  .debut { background:#2A2830; }
  .debut .top-strip { background:linear-gradient(90deg,#F9A8C9,#fff,#F9A8C9); }
  .debut .left-bar { background:#F9A8C9; }
  .debut .avatar { background:#F9A8C9; color:#2A2830; }
  .debut .username { color:#F5F0E8; }
  .debut .badge { color:#F9A8C9; }
  .debut .streak-txt { color:rgba(249,168,201,0.8); }
  .debut .stat-box { background:rgba(249,168,201,0.08); border:1px solid rgba(249,168,201,0.1); }
  .debut .stat-val { color:#F9A8C9; }
  .debut .stat-label { color:#F5F0E8; }
  .debut .win-bar-fill { background:#F9A8C9; }
  .debut .item-box { background:rgba(249,168,201,0.06); border:1px solid rgba(249,168,201,0.08); }
  .debut .item-val { color:#F9A8C9; }
  .debut .item-label { color:#F5F0E8; }
  .debut .btn { background:rgba(249,168,201,0.1); color:#F9A8C9; }
  .debut .brand { color:#F5F0E8; }

  /* LA NOBLESSE — dark teal */
  .noblesse { background:linear-gradient(135deg,#0A0E12,#0D1318,#080C0F); }
  .noblesse .top-strip { background:linear-gradient(90deg,#20B2AA,#fff,#20B2AA); }
  .noblesse .left-bar { background:#20B2AA; }
  .noblesse .avatar { background:#20B2AA; color:#0A0E12; }
  .noblesse .username { color:#fff; }
  .noblesse .badge { color:#20B2AA; }
  .noblesse .streak-txt { color:rgba(32,178,170,0.85); }
  .noblesse .stat-box { background:rgba(32,178,170,0.08); border:1px solid rgba(32,178,170,0.15); }
  .noblesse .stat-val { color:#20B2AA; }
  .noblesse .stat-label { color:rgba(255,255,255,0.5); }
  .noblesse .win-bar-fill { background:linear-gradient(90deg,#20B2AA,#4de0d8); }
  .noblesse .item-box { background:rgba(32,178,170,0.07); border:1px solid rgba(32,178,170,0.12); }
  .noblesse .item-val { color:#20B2AA; }
  .noblesse .item-label { color:rgba(255,255,255,0.45); }
  .noblesse .btn { background:rgba(32,178,170,0.12); color:#20B2AA; }
  .noblesse .brand { color:rgba(255,255,255,0.25); }

  /* ─── ROLL CARD ─── */
  .roll-card {
    width:572px; height:148px; border-radius:10px; overflow:hidden; position:relative;
    border:1px solid rgba(255,255,255,0.08); display:flex; align-items:stretch;
  }
  .roll-card .left-bar-r { width:5px; flex-shrink:0; }
  .roll-card .top-strip-r { position:absolute; top:0; left:0; right:0; height:3px; }
  .roll-card .rc-content { padding:14px 12px 14px 16px; flex:1; display:flex; flex-direction:column; justify-content:flex-start; }
  .roll-card .rc-header { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
  .roll-card .rc-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; flex-shrink:0; }
  .roll-card .rc-name { font-weight:700; font-size:14px; }
  .roll-card .rc-bundle { font-size:10px; opacity:0.6; }
  .roll-card .rc-expr { font-size:10px; font-weight:700; opacity:0.5; margin-bottom:4px; letter-spacing:1px; }
  .roll-card .rc-breakdown { font-size:10px; opacity:0.35; line-height:1.6; }
  .roll-card .rc-divider { width:1px; background:rgba(255,255,255,0.1); margin:12px 0; }
  .roll-card .rc-total-wrap { width:160px; flex-shrink:0; display:flex; align-items:center; justify-content:flex-end; padding-right:14px; }
  .roll-card .rc-total { font-size:64px; font-weight:700; line-height:1; }

  /* DEBUT roll */
  .roll-debut { background:#2A2830; }
  .roll-debut .left-bar-r { background:#F9A8C9; }
  .roll-debut .top-strip-r { background:linear-gradient(90deg,#F9A8C9,transparent); }
  .roll-debut .rc-avatar { background:#F9A8C9; color:#2A2830; }
  .roll-debut .rc-name { color:#F5F0E8; }
  .roll-debut .rc-total { color:#F9A8C9; }

  /* NOBLESSE roll */
  .roll-noblesse { background:linear-gradient(135deg,#0A0E12,#0D1318); }
  .roll-noblesse .left-bar-r { background:#20B2AA; }
  .roll-noblesse .top-strip-r { background:linear-gradient(90deg,#20B2AA,transparent); }
  .roll-noblesse .rc-avatar { background:#20B2AA; color:#0A0E12; }
  .roll-noblesse .rc-name { color:#fff; }
  .roll-noblesse .rc-bundle { color:#20B2AA; }
  .roll-noblesse .rc-divider { background:rgba(32,178,170,0.2); }
  .roll-noblesse .rc-total { background:linear-gradient(180deg,#20B2AA,#4de0d8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }

  /* DEEP IMPACT roll */
  .roll-deep { background:#0A0A14; }
  .roll-deep .left-bar-r { background:#FFD700; }
  .roll-deep .top-strip-r { background:linear-gradient(90deg,#FFD700,transparent); }
  .roll-deep .rc-avatar { background:#FFD700; color:#0A0A14; }
  .roll-deep .rc-name { color:#fff; }
  .roll-deep .rc-bundle { color:#FFD700; }
  .roll-deep .rc-divider { background:rgba(255,215,0,0.15); }
  .roll-deep .rc-total { background:linear-gradient(180deg,#FFD700,#1a3ab8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }

  /* GLORY roll */
  .roll-glory { background:linear-gradient(135deg,#0F0E00,#1a1800); }
  .roll-glory .left-bar-r { background:#D4AF37; }
  .roll-glory .top-strip-r { background:linear-gradient(90deg,#D4AF37,transparent); }
  .roll-glory .rc-avatar { background:#D4AF37; color:#0F0E00; }
  .roll-glory .rc-name { color:#fff; }
  .roll-glory .rc-bundle { color:#D4AF37; }
  .roll-glory .rc-divider { background:rgba(212,175,55,0.15); }
  .roll-glory .rc-total { color:#D4AF37; }
  /* GI watermark */
  .roll-glory .gi-mark {
    position:absolute; right:20px; top:50%; transform:translateY(-50%);
    font-size:80px; font-weight:900; color:transparent;
    -webkit-text-stroke:1px rgba(212,175,55,0.18);
    pointer-events:none; line-height:1;
  }

  /* Long name demo */
  .roll-long { background:#0A0A14; }
  .roll-long .left-bar-r { background:#EB5757; }
  .roll-long .top-strip-r { background:linear-gradient(90deg,#EB5757,transparent); }
  .roll-long .rc-avatar { background:#EB5757; color:#fff; }
  .roll-long .rc-name { color:#fff; }
  .roll-long .rc-bundle { color:#EB5757; }
  .roll-long .rc-divider { background:rgba(235,87,87,0.15); }
  .roll-long .rc-total { color:#EB5757; }

  .label { font-size:11px; color:#555; margin-bottom:8px; letter-spacing:1px; }
</style>
</head>
<body>

<h1>✦ ST. ELMO'S FIRE v6.0</h1>
<h2>DEMO — UPDATED UI</h2>

<!-- INVENTORY CARDS -->
<div class="section">
  <div class="section-title">Inventory Card — ที่แก้ใหม่</div>
  <div class="cards">

    <!-- MAKE A DEBUT — Dark -->
    <div>
      <div class="label">Make a Debut — Dark Theme ใหม่</div>
      <div class="inv-card debut">
        <div class="top-strip"></div>
        <div class="left-bar"></div>
        <div class="inner">
          <div class="header">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar">B</div>
              <div class="name-box">
                <div class="username">Beni d'arc</div>
                <div class="badge">✦ Make a Debut</div>
              </div>
            </div>
            <div class="streak-txt">STREAK · 2</div>
          </div>
          <div class="stats">
            <div class="stat-box"><div class="stat-val">20,000</div><div class="stat-label">GOLD</div></div>
            <div class="stat-box"><div class="stat-val">1,700</div><div class="stat-label">RAINBOW COIN</div></div>
          </div>
          <div class="win-bar-wrap">
            <div class="win-bar-label"><span>WIN TODAY</span><span>0 / 30,000</span></div>
            <div class="win-bar"><div class="win-bar-fill" style="width:0%"></div></div>
          </div>
          <div class="items">
            <div class="item-box"><div class="item-val">1</div><div class="item-label">RE-ROLL</div></div>
            <div class="item-box"><div class="item-val">2</div><div class="item-label">BUNDLES</div></div>
            <div class="item-box"><div class="item-val">2/7</div><div class="item-label">STREAK</div></div>
          </div>
          <div class="footer">
            <div style="display:flex;gap:6px">
              <div class="btn">Economy</div>
              <div class="btn">Profile</div>
            </div>
            <div class="brand">ST. ELMO'S FIRE</div>
          </div>
        </div>
      </div>
    </div>

    <!-- LA NOBLESSE — Dark Teal -->
    <div>
      <div class="label">La Noblesse — Dark Teal Theme ใหม่ (Mejiro Ramon)</div>
      <div class="inv-card noblesse">
        <div class="top-strip"></div>
        <div class="left-bar"></div>
        <div class="inner">
          <div class="header">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar">M</div>
              <div class="name-box">
                <div class="username">Mr. C.B.</div>
                <div class="badge">✦ La Noblesse</div>
              </div>
            </div>
            <div class="streak-txt">STREAK · 5</div>
          </div>
          <div class="stats">
            <div class="stat-box"><div class="stat-val">97,041,373</div><div class="stat-label">GOLD</div></div>
            <div class="stat-box"><div class="stat-val">92,500</div><div class="stat-label">RAINBOW COIN</div></div>
          </div>
          <div class="win-bar-wrap">
            <div class="win-bar-label"><span>WIN TODAY</span><span>0 / 30,000</span></div>
            <div class="win-bar"><div class="win-bar-fill" style="width:0%"></div></div>
          </div>
          <div class="items">
            <div class="item-box"><div class="item-val">1</div><div class="item-label">RE-ROLL</div></div>
            <div class="item-box"><div class="item-val">7</div><div class="item-label">BUNDLES</div></div>
            <div class="item-box"><div class="item-val">5/7</div><div class="item-label">STREAK</div></div>
          </div>
          <div class="footer">
            <div style="display:flex;gap:6px">
              <div class="btn">Economy</div>
              <div class="btn">Profile</div>
            </div>
            <div class="brand">ST. ELMO'S FIRE</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- ROLL CARDS -->
<div class="section">
  <div class="section-title">Roll Card — Layout ใหม่ ขนาดใหญ่ขึ้น ชื่อยาวไม่ทับผล</div>
  <div class="cards" style="flex-direction:column">

    <!-- DEBUT -->
    <div>
      <div class="label">Make a Debut — Dark</div>
      <div class="roll-card roll-debut">
        <div class="top-strip-r"></div>
        <div class="left-bar-r"></div>
        <div class="rc-content" style="padding-left:16px">
          <div class="rc-header">
            <div class="rc-avatar">B</div>
            <div>
              <div class="rc-name">Beni d'arc</div>
              <div class="rc-bundle" style="color:#F9A8C9">Make a Debut</div>
            </div>
          </div>
          <div class="rc-expr" style="color:rgba(249,168,201,0.6)">6d30</div>
          <div class="rc-breakdown" style="color:rgba(245,240,232,0.4)">20  30  15  8  27  11</div>
        </div>
        <div class="rc-divider" style="background:rgba(249,168,201,0.15)"></div>
        <div class="rc-total-wrap">
          <div class="rc-total" style="color:#F9A8C9">111</div>
        </div>
      </div>
    </div>

    <!-- LA NOBLESSE -->
    <div>
      <div class="label">La Noblesse — Dark Teal</div>
      <div class="roll-card roll-noblesse">
        <div class="top-strip-r"></div>
        <div class="left-bar-r"></div>
        <div class="rc-content" style="padding-left:16px">
          <div class="rc-header">
            <div class="rc-avatar">M</div>
            <div>
              <div class="rc-name">Mr. C.B.</div>
              <div class="rc-bundle">La Noblesse</div>
            </div>
          </div>
          <div class="rc-expr" style="color:rgba(32,178,170,0.6)">9d30kh3</div>
          <div class="rc-breakdown">28  25  (12)  (8)  30  (5)  22  (3)  (15)</div>
        </div>
        <div class="rc-divider"></div>
        <div class="rc-total-wrap">
          <div class="rc-total">105</div>
        </div>
      </div>
    </div>

    <!-- DEEP IMPACT — เหลือง→ฟ้า -->
    <div>
      <div class="label">He Who Commands the Era (Deep Impact) — ตัวเลขไล่เฉด เหลือง→ฟ้า</div>
      <div class="roll-card roll-deep">
        <div class="top-strip-r"></div>
        <div class="left-bar-r"></div>
        <div class="rc-content" style="padding-left:16px">
          <div class="rc-header">
            <div class="rc-avatar">F</div>
            <div>
              <div class="rc-name">Fran</div>
              <div class="rc-bundle">He Who Commands the Era</div>
            </div>
          </div>
          <div class="rc-expr" style="color:rgba(255,215,0,0.6)">6d30</div>
          <div class="rc-breakdown" style="color:rgba(255,255,255,0.3)">19  15  26  20  25  4</div>
        </div>
        <div class="rc-divider"></div>
        <div class="rc-total-wrap">
          <div class="rc-total">129</div>
        </div>
      </div>
    </div>

    <!-- ROAD TO GLORY — GI watermark -->
    <div>
      <div class="label">The Road to Glory — GI Watermark (outline ทอง) ใหม่</div>
      <div class="roll-card roll-glory" style="position:relative;overflow:hidden">
        <div class="top-strip-r"></div>
        <div class="left-bar-r"></div>
        <div class="gi-mark">GI</div>
        <div class="rc-content" style="padding-left:16px">
          <div class="rc-header">
            <div class="rc-avatar">S</div>
            <div>
              <div class="rc-name">Syliph</div>
              <div class="rc-bundle" style="color:#D4AF37">The Road to Glory</div>
            </div>
          </div>
          <div class="rc-expr" style="color:rgba(212,175,55,0.6)">9d30kh3</div>
          <div class="rc-breakdown" style="color:rgba(255,255,255,0.3)">30  28  (12)  (8)  25  (5)  (14)  (3)  27</div>
        </div>
        <div class="rc-divider"></div>
        <div class="rc-total-wrap">
          <div class="rc-total" style="color:#D4AF37">85</div>
        </div>
      </div>
    </div>

    <!-- LONG NAME — ชื่อยาวไม่ทับผล -->
    <div>
      <div class="label">ชื่อยาวมาก — ตัดด้วย .. ผลสุ่มอยู่ใต้ชื่อไม่ทับกัน</div>
      <div class="roll-card roll-long">
        <div class="top-strip-r"></div>
        <div class="left-bar-r"></div>
        <div class="rc-content" style="padding-left:16px">
          <div class="rc-header">
            <div class="rc-avatar">S</div>
            <div>
              <div class="rc-name">Special week [スペシャルウィ..</div>
              <div class="rc-bundle" style="color:#EB5757">The Rising Son</div>
            </div>
          </div>
          <div class="rc-expr" style="color:rgba(235,87,87,0.6)">9d30kh3</div>
          <div class="rc-breakdown" style="color:rgba(255,255,255,0.3)">2  (20)  (1)  (7)  22  25  (14)  (9)  30</div>
        </div>
        <div class="rc-divider" style="background:rgba(235,87,87,0.15)"></div>
        <div class="rc-total-wrap">
          <div class="rc-total" style="color:#EB5757">71</div>
        </div>
      </div>
    </div>

  </div>
</div>

</body>
</html>
