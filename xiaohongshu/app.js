(function () {
  'use strict';

  /* Chrome 61 的 flex 不支持 gap：测一下，不支持就给 html 加 no-flex-gap */
  (function detectFlexGap() {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:-9999px;top:0;display:flex;gap:10px;';
      d.innerHTML = '<i style="width:10px;height:10px"></i><i style="width:10px;height:10px"></i>';
      document.body.appendChild(d);
      var ok = d.scrollWidth >= 30;
      document.body.removeChild(d);
      if (!ok) document.documentElement.className += ' no-flex-gap';
    } catch (e) { /* ignore */ }
  })();


  /* ==================== 基础 ==================== */
  // 设计坐标系（会随屏幕方向重排）：横屏 960×600，竖屏 720×自适应高度
  let W = 960, H = 600;
  const TAU = Math.PI * 2;
  let SURFACE = 372;              // 水线
  let BODY_Y = 272;               // 鹭身中心
  let BASE_HY = 170;              // 头待机高度
  let STRIKE_DEPTH = 202;         // 下探深度（头正好碰到水面）
  const BEAK_LEN = 60;
  const CATCH_W = 46;             // 捕食判定半宽
  const COOLDOWN = 0.46;
  let AIM_MIN = 176, AIM_MAX = 784;
  let PORTRAIT = false;
  let SPD_K = 1;                  // 鱼速随世界宽度缩放，保证竖屏手感一致
  const params = new URLSearchParams(location.search);
  const SEC_OVERRIDE = (function () {
    const s = parseFloat(params.get('sec'));
    return (s > 0 && s < 600) ? s : 0;
  })();
  let GAME_TIME = 60;
  const DEMO = params.has('demo');
  const WARP = Math.max(0, Math.min(120, parseFloat(params.get('warp')) || 0));



  /* ==================== 关卡表 ==================== */
  // time 秒 / target 目标分 / pool 鱼种权重 / speed 鱼速 / spawn 出鱼间隔倍率
  // density 同屏鱼数 / spook 受惊敏感度 / pufferMax 同屏河豚上限 / music 调式
  const CH = {
    Dm: [0, 3, 7], Bb: [-4, 0, 3], F: [3, 7, 10], Am: [7, 10, 14], C: [-2, 2, 5], G: [5, 9, 12],
    D: [0, 4, 7], A: [7, 11, 14], Bm: [9, 12, 16]
  };
  const prog = (a, b, c, d) => [a, a, b, b, c, c, d, d];
  const MINOR_PENTA = [0, 3, 5, 7, 10, 12];      // D 小调五声
  const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12];     // D 多利亚
  const MAJOR_PENTA = [0, 2, 4, 7, 9, 12];       // D 大调五声（破晓）

  const VERSION = 'v4.5';

  /* ==================== 皮肤（只换颜色，不动造型） ==================== */
  const SKINS = [
    {
      id: 'night', name: '夜鹭', desc: '月下的老手，一身夜色', unlock: { type: 'free' },
      c: {
        light: '#33475e', mid: '#22323f', dark: '#0d1620',
        headLight: '#3b5169', headMid: '#22323f', headDark: '#0d1620',
        wing1: '#3a5069', wing2: '#16222f', tail: '#101a24', crown: '#060b12',
        cheek: 'rgba(233,243,255,0.93)',
        bill1: '#54708a', bill2: '#1e2b3a', bill3: '#080d14', billRim: 'rgba(185,216,248,0.52)',
        eyeRing: '#efe7cf', iris: '#ff4a3d',
        leg: '#b79c66', legDark: '#1b2430', legFaint: 'rgba(183,156,102,0.5)',
        plumeRgb: '230,241,255', lores: 'rgba(186,199,118,0.5)',
        rim: ['rgba(210,234,255,0.72)', 'rgba(170,210,250,0.26)', 'rgba(150,195,242,0.05)', 'rgba(150,195,242,0)']
      }
    },
    {
      id: 'egret', name: '白鹭', desc: '一身素白，黄喙黑腿', unlock: { type: 'stars', n: 3 },
      c: {
        light: '#eef4fa', mid: '#d3e0ec', dark: '#a6bacd',
        headLight: '#ffffff', headMid: '#e6eef6', headDark: '#c3d3e0',
        wing1: '#e8f0f7', wing2: '#b9cad9', tail: '#c9d8e4', crown: '#151d27',
        cheek: 'rgba(255,255,255,0.95)',
        bill1: '#f6c85f', bill2: '#d9a12e', bill3: '#a87a17', billRim: 'rgba(255,235,180,0.55)',
        eyeRing: '#fff6dc', iris: '#ff6a3d',
        leg: '#1a222b', legDark: '#0d1218', legFaint: 'rgba(30,40,50,0.45)',
        plumeRgb: '255,255,255', lores: 'rgba(210,220,140,0.5)',
        rim: ['rgba(255,255,255,0.9)', 'rgba(220,240,255,0.35)', 'rgba(200,225,250,0.08)', 'rgba(200,225,250,0)']
      }
    },
    {
      id: 'grey', name: '苍鹭', desc: '灰袍白头，冷眼看水', unlock: { type: 'stars', n: 8 },
      c: {
        light: '#7c8fa2', mid: '#5b6d7f', dark: '#3a4855',
        headLight: '#dbe5ee', headMid: '#c2cfda', headDark: '#a3b2c0',
        wing1: '#6e8195', wing2: '#3f4e5c', tail: '#4a5866', crown: '#1a232c',
        cheek: 'rgba(240,246,252,0.9)',
        bill1: '#e8c05a', bill2: '#c79b32', bill3: '#8f6c18', billRim: 'rgba(255,240,190,0.5)',
        eyeRing: '#fff3d8', iris: '#ffb03a',
        leg: '#c9a96a', legDark: '#3a3327', legFaint: 'rgba(200,170,105,0.5)',
        plumeRgb: '240,246,252', lores: 'rgba(200,210,130,0.45)',
        rim: ['rgba(235,245,255,0.72)', 'rgba(200,225,250,0.28)', 'rgba(180,210,245,0.06)', 'rgba(180,210,245,0)']
      }
    },
    {
      id: 'ibis', name: '朱鹮', desc: '粉羽红面，只在很晚的时候出没', unlock: { type: 'stars', n: 12 },
      c: {
        light: '#f3d9d2', mid: '#e5b7ac', dark: '#c08c81',
        headLight: '#fbeee9', headMid: '#f0d6cd', headDark: '#d9b3aa',
        wing1: '#eccabf', wing2: '#c99a8d', tail: '#d8a99c', crown: '#c9573f',
        cheek: 'rgba(255,248,244,0.95)',
        bill1: '#4a3733', bill2: '#2c201d', bill3: '#160f0e', billRim: 'rgba(255,220,200,0.4)',
        eyeRing: '#fff0e6', iris: '#ff7a4a',
        leg: '#c9705c', legDark: '#43201a', legFaint: 'rgba(201,112,92,0.5)',
        plumeRgb: '255,240,235', lores: 'rgba(230,150,120,0.5)',
        rim: ['rgba(255,240,230,0.85)', 'rgba(255,210,190,0.3)', 'rgba(255,200,180,0.06)', 'rgba(255,200,180,0)']
      }
    },
    {
      id: 'ghost', name: '月影鹭', desc: '像月光凝成的影子', unlock: { type: 'streak', n: 3 },
      c: {
        light: '#a8d3f7', mid: '#5f9bd0', dark: '#2a5480',
        headLight: '#d8efff', headMid: '#9ccdf5', headDark: '#4f86b8',
        wing1: '#8fc0e8', wing2: '#3f6f9c', tail: '#4a7aa6', crown: '#0e2a45',
        cheek: 'rgba(230,248,255,0.92)',
        bill1: '#9fd8ff', bill2: '#5b9cc4', bill3: '#2a5a7a', billRim: 'rgba(220,245,255,0.7)',
        eyeRing: '#e8faff', iris: '#66e0ff',
        leg: '#8fd0ea', legDark: '#2a5570', legFaint: 'rgba(143,208,234,0.5)',
        plumeRgb: '220,245,255', lores: 'rgba(160,220,240,0.5)',
        rim: ['rgba(220,245,255,0.9)', 'rgba(160,220,255,0.4)', 'rgba(120,200,255,0.1)', 'rgba(120,200,255,0)']
      }
    },
    {
      id: 'gold', name: '金鹭', desc: '把浅滩图鉴集齐才见得到', unlock: { type: 'dex', n: 8 },
      c: {
        light: '#f7e3a1', mid: '#dcbb63', dark: '#a8812f',
        headLight: '#fff6d2', headMid: '#f2d98a', headDark: '#c9a24e',
        wing1: '#edcd83', wing2: '#a8812f', tail: '#c9a24e', crown: '#3a2a10',
        cheek: 'rgba(255,250,225,0.95)',
        bill1: '#ffe08a', bill2: '#dcb049', bill3: '#8f6c18', billRim: 'rgba(255,240,190,0.7)',
        eyeRing: '#fff8e0', iris: '#ff9a2e',
        leg: '#e2c069', legDark: '#4a3818', legFaint: 'rgba(226,192,105,0.5)',
        plumeRgb: '255,245,215', lores: 'rgba(230,200,120,0.5)',
        rim: ['rgba(255,240,200,0.95)', 'rgba(255,215,140,0.4)', 'rgba(255,200,110,0.1)', 'rgba(255,200,110,0)']
      }
    }
  ];
  function skinById(id) { return SKINS.filter(function (s) { return s.id === id; })[0] || SKINS[0]; }
  let SK = SKINS[0].c;

  /* 皮肤解锁判定 */
  function skinUnlocked(s) {
    const u = s.unlock || { type: 'free' };
    if (u.type === 'free') return true;
    if (u.type === 'stars') return totalStars() >= (u.n || 0);
    if (u.type === 'streak') return (progress.daily.streak | 0) >= (u.n || 0);
    if (u.type === 'dex') {
      return Object.keys(FISH).filter(function (k) {
        return (progress.dex[k] | 0) > 0 || (progress.dexSeen[k] | 0) > 0;
      }).length >= (u.n || 0);
    }
    return false;
  }
  function skinUnlockText(s) {
    const u = s.unlock || { type: 'free' };
    if (u.type === 'free') return '默认';
    if (u.type === 'stars') return '累计 ★ ' + u.n;
    if (u.type === 'streak') return '每日连续 ' + u.n + ' 天';
    if (u.type === 'dex') return '图鉴集齐 ' + u.n + ' 种';
    return '解锁';
  }
  /* 图鉴已收录多少种（遇见或捕获都算） */
  function dexCollected() {
    return Object.keys(FISH).filter(function (k) {
      return (progress.dex[k] | 0) > 0 || (progress.dexSeen[k] | 0) > 0;
    }).length;
  }
  function dexTotal() { return Object.keys(FISH).length; }
  /* ==================== 场景配色 ==================== */
  const PAL_NIGHT = {
    sky: ['#040912', '#0a1729', '#15304b', '#254a6b', '#2f6080'],
    water: ['#4a8cad', '#2d6a8b', '#184763', '#0d2a3f', '#061726']
  };
  const PAL_RAIN = {
    sky: ['#05080d', '#0b121a', '#141d28', '#1d2a36', '#26343f'],
    water: ['#3a5a6b', '#274553', '#16303d', '#0c2230', '#061620']
  };
  const PAL_DAWN = {
    sky: ['#0b1024', '#1b2140', '#3a3c5e', '#6b5570', '#a8766a'],
    water: ['#5a7a92', '#3f6178', '#2b4a5e', '#1c3547', '#0f2433']
  };
  const PAL_FOG = {
    sky: ['#0a1119', '#141f2b', '#1e2c3a', '#2a3b4a', '#3a4d5c'],
    water: ['#62859a', '#466b80', '#2f5266', '#1d394a', '#102433']
  };

  /* 每日挑战：按日期抽一种「玩法组合」 */
  const DAILY_COMBOS = [
    { name: '雨 + 雾', rain: true, fog: true, pal: PAL_FOG },
    { name: '荷叶 + 雨', pads: true, rain: true, pal: PAL_RAIN },
    { name: '雾 + 月食', fog: true, eclipse: true, pal: PAL_FOG },
    { name: '雨 + 月食', rain: true, eclipse: true, pal: PAL_RAIN },
    { name: '荷叶 + 雾', pads: true, fog: true, pal: PAL_FOG }
  ];
  function dailyCombo() {
    return DAILY_COMBOS[(hashStr(dateKey()) >>> 3) % DAILY_COMBOS.length];
  }

  const LEVELS = [
    { name: '月出', sub: '浅滩 · 风平', time: 30, target: 160, pal: PAL_NIGHT,
      pool: { minnow: 50, carp: 30, crucian: 20 }, speed: 0.92, spawn: 1.15, density: 4, spook: 0.9, pufferMax: 0,
      music: { bpm: 62, bright: 2000, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.Bb, CH.F, CH.Am) } },
    { name: '夜深', sub: '河豚出没', time: 40, target: 430, pal: PAL_NIGHT,
      pool: { minnow: 34, carp: 24, crucian: 18, loach: 8, puffer: 16 }, speed: 1.0, spawn: 1.0, density: 5, spook: 1.0, pufferMax: 2,
      music: { bpm: 66, bright: 2250, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.Bb, CH.Dm, CH.Am) } },
    { name: '子夜', sub: '锦鲤游过', time: 45, target: 900, pal: PAL_NIGHT,
      pool: { minnow: 24, carp: 22, crucian: 16, loach: 12, koi: 10, puffer: 16 }, speed: 1.08, spawn: 0.9, density: 6, spook: 1.15, pufferMax: 2,
      music: { bpm: 64, bright: 2600, scale: DORIAN, chords: prog(CH.Dm, CH.G, CH.Bb, CH.Am) } },
    { name: '潮来', sub: '鱼群如涌', time: 50, target: 1200, pal: PAL_NIGHT,
      pool: { minnow: 18, carp: 20, crucian: 16, loach: 16, koi: 12, snakehead: 8, puffer: 10 }, speed: 1.18, spawn: 0.78, density: 7, spook: 1.3, pufferMax: 3,
      music: { bpm: 78, bright: 2750, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.C, CH.Bb, CH.Am) } },
    { name: '破晓', sub: '最后一网', time: 60, target: 1800, pal: PAL_DAWN,
      pool: { minnow: 14, carp: 18, crucian: 14, loach: 16, koi: 16, snakehead: 10, moonfish: 4, puffer: 8 }, speed: 1.3, spawn: 0.66, density: 8, spook: 1.45, pufferMax: 3,
      music: { bpm: 70, bright: 3400, scale: MAJOR_PENTA, chords: prog(CH.D, CH.A, CH.Bm, CH.G) } },
    { name: '雨夜', sub: '斜雨 · 手要稳', time: 45, target: 950, pal: PAL_RAIN, rain: true, hidden: true,
      pool: { minnow: 20, carp: 22, crucian: 16, loach: 14, koi: 10, puffer: 18 }, speed: 1.22, spawn: 0.85, density: 6, spook: 1.35, pufferMax: 3,
      music: { bpm: 74, bright: 2100, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.Bb, CH.G, CH.Am) } },
    { name: '荷塘', sub: '荷叶挡喙', time: 50, target: 1250, pal: PAL_NIGHT, pads: true, hidden: true,
      pool: { minnow: 18, carp: 20, crucian: 16, loach: 16, koi: 12, snakehead: 8, puffer: 10 }, speed: 1.12, spawn: 0.8, density: 6, spook: 1.2, pufferMax: 2,
      music: { bpm: 66, bright: 2400, scale: DORIAN, chords: prog(CH.Dm, CH.F, CH.Bb, CH.G) } },
    { name: '雾夜', sub: '雾里看鱼', time: 50, target: 1050, pal: PAL_FOG, fog: true, hidden: true,
      pool: { minnow: 20, carp: 22, crucian: 16, loach: 14, koi: 12, snakehead: 6, moonfish: 3, puffer: 7 }, speed: 0.98, spawn: 0.85, density: 7, spook: 1.15, pufferMax: 2,
      music: { bpm: 60, bright: 1900, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.Bb, CH.F, CH.Am) } },
    { name: '月食', sub: '天狗吃月亮', time: 50, target: 1350, pal: PAL_NIGHT, eclipse: true, hidden: true,
      pool: { minnow: 18, carp: 20, crucian: 16, loach: 16, koi: 14, snakehead: 8, moonfish: 5, puffer: 8 }, speed: 1.12, spawn: 0.8, density: 7, spook: 1.2, pufferMax: 3,
      music: { bpm: 63, bright: 2200, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.G, CH.Bb, CH.Am) } },
    { name: '风雨', sub: '雨雾交加', time: 50, target: 1180, pal: PAL_FOG, rain: true, fog: true, hidden: true,
      pool: { minnow: 20, carp: 20, crucian: 16, loach: 14, koi: 12, snakehead: 6, puffer: 12 }, speed: 1.16, spawn: 0.8, density: 7, spook: 1.3, pufferMax: 3,
      music: { bpm: 72, bright: 2000, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.Bb, CH.G, CH.Am) } },
    { name: '血雾', sub: '天狗吞月 · 又起雾', time: 55, target: 1500, pal: PAL_FOG, eclipse: true, fog: true, hidden: true,
      pool: { minnow: 16, carp: 20, crucian: 16, loach: 16, koi: 14, snakehead: 8, moonfish: 4, puffer: 6 }, speed: 1.14, spawn: 0.78, density: 7, spook: 1.25, pufferMax: 3,
      music: { bpm: 61, bright: 1900, scale: DORIAN, chords: prog(CH.Dm, CH.G, CH.Bb, CH.Am) } },
    { name: '无尽', sub: '一直掉下去', time: 35, target: 0, endless: true, pal: PAL_NIGHT,
      pool: { minnow: 22, carp: 20, crucian: 14, loach: 14, koi: 10, snakehead: 8, moonfish: 3, puffer: 9 }, speed: 1.0, spawn: 1.0, density: 6, spook: 1.2, pufferMax: 2,
      music: { bpm: 68, bright: 2350, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.Bb, CH.F, CH.C) } },
    { name: '每日挑战', sub: '今日鱼群', time: 45, target: 1000, daily: true, pal: PAL_NIGHT,
      pool: { minnow: 20, carp: 22, crucian: 14, loach: 12, koi: 12, snakehead: 8, moonfish: 5, puffer: 7 }, speed: 1.1, spawn: 0.8, density: 7, spook: 1.2, pufferMax: 3,
      music: { bpm: 72, bright: 2500, scale: MINOR_PENTA, chords: prog(CH.Dm, CH.C, CH.Bb, CH.Am) } }
  ];
  const NIGHT_COUNT = 11;
  const NIGHT_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'];
  const BASE_NIGHTS = 5;              // 正片五夜
  const HIDDEN_AT = BASE_NIGHTS * 3;  // 集齐 15 ★ 才出现的隐藏两夜
  function levelTag(i) {
    const lv = LEVELS[i];
    if (lv.daily) return '每日挑战 · ' + dailyCombo().name;
    if (lv.endless) return '无尽 · 月下无尽';
    return '第' + NIGHT_CN[i] + '夜 · ' + lv.name;
  }

  /* ==================== 进度存档 ==================== */
  const PROGRESS_KEY = 'heron-levels-v1';
  function freshProgress() {
    return {
      unlocked: 1, best: LEVELS.map(() => 0), stars: LEVELS.map(() => 0),
      daily: { key: '', best: 0, streak: 0 },
      dex: {}, dexSeen: {}, poisoned: 0, skin: 'night', layout: 5
    };
  }
  function normalizeProgress(o) {
    if (!o || !Array.isArray(o.best) || !Array.isArray(o.stars)) return null;
    const fresh = freshProgress();
    const best = fresh.best.slice();
    const stars = fresh.stars.slice();
    for (let i = 0; i < Math.min(best.length, o.best.length); i++) best[i] = o.best[i] | 0;
    for (let i = 0; i < Math.min(stars.length, o.stars.length); i++) stars[i] = o.stars[i] | 0;
    const d = o.daily && typeof o.daily === 'object'
      ? { key: String(o.daily.key || ''), best: o.daily.best | 0, streak: o.daily.streak | 0 }
      : fresh.daily;
    // 关卡表改过多版：把老存档的星星搬到新位置，别让进度错位
    const lay = o.layout | 0;
    if (lay < 5) {
      let map = null;
      if (o.best.length === 7) map = [0, 1, 2, 3, 4, 12, 13];                       // 最初 7 关
      else if (o.best.length === 9 && lay === 4) map = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13]; // v3.2
      else if (o.best.length === 9 && lay === 3) map = [0, 1, 2, 3, 4, 5, 6, 12, 13]; // v3.1
      else if (o.best.length === 9 && lay === 2) map = [0, 1, 2, 5, 3, 6, 4, 12, 13]; // v3.0
      if (map) {
        const nb = LEVELS.map(() => 0), ns = LEVELS.map(() => 0);
        for (let i = 0; i < map.length; i++) { nb[map[i]] = best[i] | 0; ns[map[i]] = stars[i] | 0; }
        for (let i = 0; i < best.length; i++) { best[i] = nb[i]; stars[i] = ns[i]; }
      }
    }
    return {
      unlocked: Math.min(LEVELS.length, Math.max(1, o.unlocked | 0)),
      best, stars, daily: d,
      dex: (o.dex && typeof o.dex === 'object') ? o.dex : {},
      dexSeen: (o.dexSeen && typeof o.dexSeen === 'object') ? o.dexSeen : {},
      poisoned: o.poisoned | 0,
      skin: typeof o.skin === 'string' ? o.skin : 'night',
      layout: 5
    };
  }
  function loadProgress() {
    try {
      const n = normalizeProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'));
      if (n) return n;
    } catch (e) { /* ignore */ }
    return freshProgress();
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }
  let progress = loadProgress();
  if (params.has('skin')) progress.skin = params.get('skin');
  SK = skinById(progress.skin).c;
  let curLevel = 0;

  function starsFor(score, target) {
    if (target <= 0) return 0;
    if (score >= target * 1.7) return 3;
    if (score >= target * 1.35) return 2;
    if (score >= target) return 1;
    return 0;
  }
  function starsText(n) {
    return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
  }
  function totalStars() {
    return progress.stars.reduce((a, b) => a + b, 0);
  }
  // 无尽模式：越活越难
  function levelCfg() {
    const lv = LEVELS[curLevel];
    if (!lv.endless) return lv;
    const e = game.elapsed || 0;
    return {
      endless: true,
      pool: lv.pool,
      speed: 1 + Math.min(0.9, e / 120),
      density: 5 + Math.min(4, Math.floor(e / 25)),
      pufferMax: 1 + Math.min(3, Math.floor(e / 30)),
      spawn: Math.max(0.42, 1.05 - e / 130),
      spook: 1 + Math.min(0.5, e / 200)
    };
  }

  const $ = (s) => document.querySelector(s);
  const cvs = $('#game');
  let ctx = cvs.getContext('2d');
  const stage = $('#stage');
  if (params.has('noanim')) document.documentElement.classList.add('noanim');

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const sign = (v) => (v < 0 ? -1 : 1);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /* ==================== 日期与随机种子 ==================== */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dateKey(d) {
    const x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function shiftDay(key, delta) {
    const p = key.split('-').map(Number);
    return dateKey(new Date(p[0], p[1] - 1, p[2] + delta));
  }
  function fmtDate(key) {
    const p = key.split('-');
    return p[0] + '.' + p[1] + '.' + p[2];
  }

  /* 运行期异常：不让循环挂掉，并给用户一个可见提示 */
  let errShown = false;
  function reportError(err) {
    if (window.console && console.error) console.error('[night-heron]', err);
    if (errShown) return;
    errShown = true;
    try {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:999;' +
        'padding:10px 16px;border-radius:10px;background:rgba(130,24,24,.94);color:#fff;' +
        'font:13px/1.5 system-ui,sans-serif;max-width:92vw;text-align:center';
      el.textContent = '出了点小问题：' + (err && err.message ? err.message : err) + '（刷新页面即可恢复）';
      document.body.appendChild(el);
    } catch (e) { /* ignore */ }
  }

  /* ==================== 尺寸与自适应布局 ==================== */
  let SCALE = 1;
  let lastLayoutKey = '';

  // 按屏幕方向重排世界：横屏 960×600，竖屏 高度固定、宽度随屏幕比例（正好铺满）
  function applyLayout(vw, vh) {
    const aspect = vw / Math.max(1, vh);
    PORTRAIT = aspect < 1;
    if (PORTRAIT) {
      H = 1150;
      W = Math.round(clamp(H * aspect, 500, 800));
    } else {
      W = 960;
      H = 600;
    }
    const waterH = PORTRAIT ? H * 0.36 : 228;
    SURFACE = H - waterH;
    BODY_Y = SURFACE - 100;
    BASE_HY = SURFACE - 202;
    STRIKE_DEPTH = 202;
    AIM_MIN = W * 0.183;
    AIM_MAX = W * 0.817;
    SPD_K = W / 960;
    MOON.x = W * 0.82;
    MOON.y = H * 0.13;
    const key = W + 'x' + H;
    if (key !== lastLayoutKey) {
      lastLayoutKey = key;
      buildScenery();
      skyGrad = null;
      waterGrad = null;
    }
  }

  let lastVW = 0, lastVH = 0;
  function resize() {
    const vw = Math.max(240, Math.round(document.documentElement.clientWidth || window.innerWidth || 0));
    const vh = Math.max(240, Math.round(document.documentElement.clientHeight || window.innerHeight || 0));
    lastVW = vw; lastVH = vh;
    applyLayout(vw, vh);
    const s = Math.min(vw / W, vh / H);
    const cw = Math.max(1, Math.round(W * s));
    const ch = Math.max(1, Math.round(H * s));
    cvs.style.width = cw + 'px';
    cvs.style.height = ch + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = Math.max(1, Math.round(cw * dpr));
    cvs.height = Math.max(1, Math.round(ch * dpr));
    SCALE = cvs.width / W;
    stage.style.setProperty('--u', clamp(cw / 820, 0.86, 1.45).toFixed(3));
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* ==================== 音效 ==================== */
  const sfx = (function () {
    let actx = null, master = null, sfxBus = null, muted = false;
    let volMusic = 0.55, volSfx = 0.8;
    function init() {
      if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 1;
      master.connect(actx.destination);
      sfxBus = actx.createGain();
      sfxBus.gain.value = volSfx;
      sfxBus.connect(master);
      buildMusicBus();
      if (musicOn) startMusic();
    }
    function tone(freq, dur, type, vol, slideTo, delay) {
      if (!actx || muted) return;
      const t0 = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(sfxBus);
      o.start(t0); o.stop(t0 + dur + 0.03);
    }
    function noise(dur, f0, f1, vol, delay) {
      if (!actx || muted) return;
      const t0 = actx.currentTime + (delay || 0);
      const len = Math.max(1, Math.floor(actx.sampleRate * dur));
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = actx.createBufferSource(); src.buffer = buf;
      const flt = actx.createBiquadFilter(); flt.type = 'lowpass';
      flt.frequency.setValueAtTime(f0, t0);
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
      const g = actx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(sfxBus);
      src.start(t0);
    }

    /* ---------- 夜鹭的「呱」：锯齿 + 带通共振 + 32Hz 喉音 ---------- */
    function croak(freq, dur, vol, delay, rasp, far) {
      if (!actx || muted) return;
      const t0 = actx.currentTime + (delay || 0);
      const d = Math.max(0.05, dur || 0.12);
      const v = Math.max(0.004, vol || 0.1);

      const o1 = actx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(freq, t0);
      o1.frequency.exponentialRampToValueAtTime(Math.max(70, freq * 0.58), t0 + d * 0.9);

      const o2 = actx.createOscillator();
      o2.type = 'square';
      o2.frequency.setValueAtTime(freq * 1.008, t0);
      o2.frequency.exponentialRampToValueAtTime(Math.max(70, freq * 0.62), t0 + d * 0.9);
      const o2g = actx.createGain();
      o2g.gain.value = 0.28;

      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(far ? 720 : 1050, t0);
      bp.frequency.exponentialRampToValueAtTime(far ? 480 : 620, t0 + d);
      bp.Q.value = far ? 3.2 : 4.5;

      const lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = far ? 1500 : 3000;

      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.014);
      g.gain.exponentialRampToValueAtTime(v * 0.45, t0 + d * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

      // 喉音抖动，让「呱」听起来沙哑
      const lfo = actx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 32;
      const lfoG = actx.createGain();
      lfoG.gain.value = v * (rasp === undefined ? 0.28 : rasp);
      lfo.connect(lfoG);
      lfoG.connect(g.gain);

      o1.connect(bp); o2.connect(o2g); o2g.connect(bp);
      bp.connect(lp); lp.connect(g); g.connect(sfxBus);

      // 胸腔低频，给「呱」一点厚度
      const body = actx.createOscillator();
      const bg = actx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(freq * 0.5, t0);
      body.frequency.exponentialRampToValueAtTime(Math.max(50, freq * 0.34), t0 + d);
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(v * (far ? 0.15 : 0.5), t0 + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      body.connect(bg); bg.connect(sfxBus);

      // 气声
      const len = Math.max(1, Math.floor(actx.sampleRate * d * 0.8));
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const dd = buf.getChannelData(0);
      for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = actx.createBufferSource(); src.buffer = buf;
      const nf = actx.createBiquadFilter();
      nf.type = 'bandpass'; nf.frequency.value = 1500; nf.Q.value = 1.2;
      const ng = actx.createGain();
      ng.gain.setValueAtTime(v * 0.5, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + d * 0.7);
      src.connect(nf); nf.connect(ng); ng.connect(sfxBus);

      const end = t0 + d + 0.03;
      o1.start(t0); o2.start(t0); lfo.start(t0); src.start(t0); body.start(t0);
      o1.stop(end); o2.stop(end); lfo.stop(end); body.stop(end);
    }

    /* ---------- 夜曲：程序化背景音乐 ---------- */
    let musicGain = null, musicFilter = null, delayNode = null, ambSrc = null;
    let musicTimer = null, musicOn = true, musicRunning = false;
    let nextStepTime = 0, stepIdx = 0, duckFactor = 1;
    let STEP_DUR = 60 / 66 / 2;             // 八分音符时长
    let ROOT_HZ = 146.83;                   // D3
    const hz = (semi) => ROOT_HZ * Math.pow(2, semi / 12);
    let SCALE = [0, 3, 5, 7, 10, 12];       // D 小调五声
    let CHORDS = [
      [0, 3, 7], [0, 3, 7],                 // Dm
      [-4, 0, 3], [-4, 0, 3],               // Bb
      [3, 7, 10], [3, 7, 10],               // F
      [7, 10, 14], [7, 10, 14]              // Am
    ];
    function setMode(m) {
      if (!m) return;
      ROOT_HZ = m.root || 146.83;
      if (m.scale) SCALE = m.scale;
      if (m.chords) CHORDS = m.chords;
      STEP_DUR = 60 / (m.bpm || 66) / 2;
      if (musicFilter && actx) musicFilter.frequency.setTargetAtTime(m.bright || 2400, actx.currentTime, 0.5);
    }

    function musicTarget() {
      return (muted || !musicOn) ? 0.0001 : volMusic * 0.6 * duckFactor;
    }
    function applyMusicGain(ramp) {
      if (!musicGain || !actx) return;
      const t = actx.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), t);
      musicGain.gain.linearRampToValueAtTime(musicTarget(), t + (ramp || 0.6));
    }
    function buildMusicBus() {
      musicFilter = actx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 2400;
      musicGain = actx.createGain();
      musicGain.gain.value = 0.0001;
      musicFilter.connect(musicGain);
      musicGain.connect(master);
      // 一点回声空间
      delayNode = actx.createDelay(1.5);
      delayNode.delayTime.value = 0.34;
      const fb = actx.createGain(); fb.gain.value = 0.36;
      const wet = actx.createGain(); wet.gain.value = 0.42;
      delayNode.connect(fb); fb.connect(delayNode);
      delayNode.connect(wet); wet.connect(musicFilter);
    }
    function padNote(freq, t, dur, vol) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      const o2 = actx.createOscillator(), g2 = actx.createGain();
      o2.type = 'triangle'; o2.frequency.value = freq * 1.004;
      g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2); g2.connect(g);
      g.connect(musicFilter);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.45);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.start(t); o2.start(t);
      o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function pluck(freq, t, vol) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
      o.connect(g);
      g.connect(musicFilter);
      g.connect(delayNode);
      o.start(t); o.stop(t + 1.2);
    }
    function bassNote(freq, t, dur) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function startAmbience() {
      if (ambSrc) return;
      const len = Math.floor(actx.sampleRate * 4);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = actx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = actx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 380;
      const g = actx.createGain(); g.gain.value = 0.03;
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start();
      ambSrc = src;
    }
    function scheduleStep(s, t) {
      const bar = Math.floor(s / 8) % 8;
      const beat = s % 8;
      const ch = CHORDS[bar];
      if (beat === 0) {
        for (const n of ch) padNote(hz(n + 12), t, STEP_DUR * 8.6, 0.05);
        bassNote(hz(ch[0] - 12), t, STEP_DUR * 7.4);
      }
      if (beat % 2 === 0 && Math.random() < 0.36) {
        let semi = SCALE[Math.floor(Math.random() * SCALE.length)];
        if (Math.random() < 0.55) {
          const pcs = ch.map((c) => ((c % 12) + 12) % 12);
          const cands = SCALE.filter((v) => pcs.indexOf(((v % 12) + 12) % 12) >= 0);
          if (cands.length) semi = cands[Math.floor(Math.random() * cands.length)];
        }
        pluck(hz(semi + 12), t, 0.15);
        if (Math.random() < 0.22) pluck(hz(semi + 19), t + STEP_DUR * 0.5, 0.07);
      }
    }
    function scheduleAhead() {
      if (!actx || !musicRunning) return;
      while (nextStepTime < actx.currentTime + 0.35) {
        scheduleStep(stepIdx, nextStepTime);
        nextStepTime += STEP_DUR;
        stepIdx++;
      }
    }
    function startMusic() {
      if (!actx) return;
      if (musicRunning) { applyMusicGain(0.4); return; }
      musicRunning = true;
      stepIdx = 0;
      nextStepTime = actx.currentTime + 0.25;
      applyMusicGain(2.2);
      startAmbience();
      musicTimer = setInterval(scheduleAhead, 60);
      scheduleAhead();
    }
    function stopMusic() {
      musicRunning = false;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      applyMusicGain(0.9);
    }

    return {
      init,
      toggle() { muted = !muted; init(); applyMusicGain(0.4); return muted; },
      music: {
        start: startMusic,
        stop: stopMusic,
        setMode,
        toggle() {
          musicOn = !musicOn;
          if (musicOn) startMusic(); else applyMusicGain(0.5);
          return musicOn;
        },
        get on() { return musicOn; },
        setOn(v) {
          musicOn = !!v;
          if (musicOn) startMusic(); else applyMusicGain(0.35);
          return musicOn;
        },
        duck(v) { duckFactor = v; applyMusicGain(0.5); }
      },
      setVolumes(m, s) {
        if (typeof m === 'number') volMusic = clamp(m, 0, 1);
        if (typeof s === 'number') volSfx = clamp(s, 0, 1);
        if (sfxBus && actx) sfxBus.gain.setTargetAtTime(volSfx, actx.currentTime, 0.06);
        applyMusicGain(0.25);
      },
      getVolumes() { return { music: volMusic, sfx: volSfx }; },
      tap() { croak(280, 0.06, 0.05, 0, 0.15); noise(0.06, 1200, 300, 0.05); },
      splash() { noise(0.26, 2200, 180, 0.14); tone(150, 0.16, 'sine', 0.09, 70); },
      catchFish(n) {
        const base = 400 + Math.min(n, 12) * 16;
        croak(base, 0.1, 0.12);
        croak(base * 1.16, 0.11, 0.1, 0.09);
        noise(0.1, 2400, 600, 0.04);
      },
      miss() { croak(250, 0.15, 0.09, 0, 0.2); noise(0.16, 800, 150, 0.07); },
      // 啄在荷叶上：闷闷的一下
      padHit() { noise(0.14, 900, 260, 0.13); tone(110, 0.14, 'sine', 0.1, 70); croak(240, 0.09, 0.05, 0.02, 0.3, true); },
      poison() {
        croak(500, 0.12, 0.12, 0, 0.55);
        croak(390, 0.2, 0.11, 0.11, 0.55);
        noise(0.26, 700, 90, 0.12);
      },
      start() { croak(350, 0.1, 0.09); croak(400, 0.1, 0.09, 0.15); croak(470, 0.16, 0.1, 0.3); },
      goal() { croak(500, 0.09, 0.1); croak(580, 0.09, 0.1, 0.1); croak(690, 0.14, 0.1, 0.2); },
      discover() { croak(600, 0.08, 0.07); croak(740, 0.1, 0.06, 0.08); },
      win() { [0, 0.13, 0.26, 0.42, 0.58].forEach(function (d, i) { croak(390 + i * 65, 0.12, 0.1, d); }); },
      over() { croak(320, 0.15, 0.1); croak(240, 0.32, 0.1, 0.18); },
      // 远处另一只夜鹭：一声 + 两次回声（顺便把音乐压一点，免得盖住）
      distant() {
        const prev = duckFactor;
        duckFactor = Math.min(prev, 0.5);
        applyMusicGain(0.3);
        setTimeout(function () { duckFactor = prev; applyMusicGain(1.5); }, 1500);
        const f = 270 + Math.random() * 70;
        croak(f, 0.22, 0.085, 0, 0.38, true);
        croak(f * 0.94, 0.2, 0.04, 0.27, 0.38, true);
        croak(f * 0.88, 0.26, 0.018, 0.52, 0.38, true);
      }
    };
  })();

  /* ==================== 鱼种 ==================== */
  const FISH = {
    minnow: { name: '小鱼',  body: '#7fd0e2', light: '#e2fbff', fin: '#4f9fb4', size: 11, spd: [82, 118], pts: 10, w: 33, shape: 'fish' },
    crucian: { name: '鲫鱼', body: '#9fc0d8', light: '#e8f4ff', fin: '#6b8fac', size: 13, spd: [88, 120], pts: 15, w: 18, shape: 'fish' },
    carp:   { name: '鲤鱼',  body: '#d9a95c', light: '#ffe7b4', fin: '#a97c33', size: 16, spd: [62, 92],  pts: 25, w: 26, shape: 'fish' },
    koi:    { name: '锦鲤',  body: '#ff8f43', light: '#ffe4b0', fin: '#dd5f28', size: 20, spd: [98, 134], pts: 60, w: 10, shape: 'fish' },
    loach:  { name: '泥鳅',  body: '#a1957a', light: '#ece0b6', fin: '#6d6349', size: 10, spd: [124, 168], pts: 35, w: 14, shape: 'loach' },
    snakehead: { name: '黑鱼', body: '#5a6b60', light: '#a8bcae', fin: '#3a4a40', size: 23, spd: [44, 64], pts: 80, w: 7, shape: 'fish', big: true },
    moonfish: { name: '月光鱼', body: '#bfe8ff', light: '#ffffff', fin: '#8fd0f5', size: 14, spd: [150, 205], pts: 150, w: 3, shape: 'fish', glow: true },
    puffer: { name: '河豚',  body: '#cbd45c', light: '#f3f8ab', fin: '#8b9535', size: 16, spd: [46, 66],  pts: 0,  w: 17, shape: 'puffer', bad: true }
  };
  function pickFish(pool) {
    let total = 0;
    for (const k in pool) total += pool[k];
    let r = Math.random() * total;
    for (const k in pool) { r -= pool[k]; if (r <= 0) return k; }
    return Object.keys(pool)[0];
  }
  function pickWeighted(pool, rnd) {
    let total = 0;
    for (const k in pool) total += pool[k];
    let r = rnd() * total;
    for (const k in pool) { r -= pool[k]; if (r <= 0) return k; }
    return Object.keys(pool)[0];
  }

  /* ---- 每日挑战：按日期种子预生成整局鱼群 ---- */
  function buildDailyPlan(lv, seed) {
    const rnd = mulberry32(seed);
    const plan = [];
    let t = 0.15;
    while (t < lv.time + 2.5) {
      plan.push({
        t,
        key: pickWeighted(lv.pool, rnd),
        dir: rnd() < 0.5 ? 1 : -1,
        yRatio: rnd(),
        spdK: 0.85 + rnd() * 0.3,
        sizeK: 0.9 + rnd() * 0.22,
        ph: rnd() * TAU,
        bobA: 4 + rnd() * 7,
        bobF: 0.7 + rnd() * 1.0
      });
      t += 0.55 + rnd() * 0.5;
    }
    return plan;
  }
  function spawnFromPlan(p) {
    const t = FISH[p.key];
    const lv = LEVELS[curLevel];
    const y = SURFACE + 20 + p.yRatio * 94;
    const base = (t.spd[0] + t.spd[1]) * 0.5;
    game.fish.push({
      key: p.key, t,
      x: p.dir > 0 ? -70 : W + 70,
      y, baseY: y,
      vx: p.dir * base * p.spdK * lv.speed * (1 + game.difficulty * 0.35) * SPD_K,
      dir: p.dir,
      size: t.size * p.sizeK,
      ph: p.ph, bobA: p.bobA, bobF: p.bobF,
      alpha: 0.95 - (y - (SURFACE + 20)) / 95 * 0.22,
      flee: 0, alert: 0, state: 'swim', rot: 0
    });
  }

  /* ==================== 状态 ==================== */
  let lastResult = null;
  const game = {
    mode: 'title',
    t: 0,
    timeLeft: GAME_TIME,
    target: 0,
    goalHit: false,
    elapsed: 0,
    cfg: null,
    runT: 0,
    plan: null,
    planIdx: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    caught: 0,
    strikes: 0,
    hits: 0,
    fish: [], parts: [], rings: [], pops: [],
    spawnTimer: 0.5,
    difficulty: 0,
    shake: 0, flash: 0, flashColor: '255,255,255',
    toastT: 0,
    demoT: 0
  };

  const heron = {
    aimX: W / 2,
    hx: W / 2, hy: BASE_HY,
    vel: 0,
    tilt: 0,
    phase: 'idle',
    strikeT: 0,
    strikeX: W / 2,
    cooldown: 0,
    stun: 0,
    buffer: 0,
    blink: 0,
    blinkTimer: 2.6,
    lean: 0
  };

  /* ==================== 背景装饰（随布局重建） ==================== */
  const stars = [], clouds = [], reeds = [], fireflies = [], deepPlants = [];
  let shore = [], rocks = [];
  const MOON = { x: 786, y: 96, r: 34 };

  function buildScenery() {
    stars.length = 0;
    const starCount = Math.round(90 * (W * H) / (960 * 600) * 0.55) + 40;
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.pow(Math.random(), 1.35) * (SURFACE - 24),
        r: rand(0.5, 1.7), p: rand(0, TAU), s: rand(0.6, 2.2)
      });
    }
    clouds.length = 0;
    for (let i = 0; i < 5; i++) {
      clouds.push({ x: rand(-200, W + 200), y: rand(30, Math.max(90, SURFACE - 120)), w: rand(180, 360), h: rand(8, 20), v: rand(3, 9), a: rand(0.03, 0.07) });
    }
    reeds.length = 0;
    const reedCount = Math.round(34 * W / 960) + 8;
    for (let i = 0; i < reedCount; i++) {
      reeds.push({ x: rand(-20, W + 20), h: rand(18, 84), lean: rand(-16, 16), p: rand(0, TAU), w: rand(1.0, 1.9) });
    }
    shore = [];
    let x = -60;
    while (x < W + 80) {
      shore.push({ x, y: SURFACE - rand(2, 22) });
      x += rand(46, 96);
    }
    fireflies.length = 0;
    for (let i = 0; i < 16; i++) {
      fireflies.push({ x: rand(0, W), y: rand(SURFACE - 90, SURFACE - 8), p: rand(0, TAU), s: rand(0.4, 1.1), r: rand(0.9, 2.0) });
    }
    deepPlants.length = 0;
    for (let i = 0; i < 20; i++) {
      deepPlants.push({ x: rand(-30, W + 30), h: rand(45, 135), lean: rand(-20, 20), p: rand(0, TAU), w: rand(1.8, 4.5) });
    }
    const depth = H - SURFACE;
    rocks = [
      { x: W * 0.16, y: SURFACE + depth * 0.62, rx: 76, ry: 26 },
      { x: W * 0.84, y: SURFACE + depth * 0.78, rx: 104, ry: 32 },
      { x: W * 0.49, y: SURFACE + depth * 0.9, rx: 60, ry: 20 }
    ];
  }

  /* ==================== 粒子 ==================== */
  function addRing(x, y, maxR, life, color, lw) {
    game.rings.push({ x, y, r: 4, maxR, life, max: life, color: color || '160,210,245', lw: lw || 2 });
  }
  function addDrop(x, y, n, spread, up) {
    for (let i = 0; i < n; i++) {
      game.parts.push({
        x: x + rand(-8, 8), y,
        vx: rand(-spread, spread),
        vy: rand(-up, -up * 0.25),
        r: rand(1.2, 3.4),
        life: rand(0.4, 0.9), max: 0.9,
        c: '185,225,250'
      });
    }
  }
  function addSpark(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(30, 130);
      game.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: rand(1, 2.6), life: rand(0.35, 0.7), max: 0.7, c: color || '255,224,150', spark: true });
    }
  }
  function addPop(x, y, text, color, size) {
    game.pops.push({ x, y, text, color: color || '#ffe9a8', life: 1, max: 1, size: size || 20 });
  }

  /* ==================== 鱼群 ==================== */
  /* 记住「这条鱼我见过」，只在真正对局里算数 */
  function markFishSeen(key) {
    progress.dexSeen[key] = (progress.dexSeen[key] | 0) + 1;
    const first = progress.dexSeen[key] === 1;
    if (first) {
      const t = FISH[key];
      const all = dexCollected() >= dexTotal();
      toast(all ? '图鉴集齐！解锁「金鹭」' : ('图鉴 +1 · ' + t.name), true);
      if (all) sfx.win(); else sfx.discover();
    }
    saveProgress();
  }

  function spawnFish() {
    const lv = game.cfg || LEVELS[curLevel];
    let key = pickFish(lv.pool);
    if (key === 'puffer' && game.fish.filter((f) => f.t.bad && f.state === 'swim').length >= lv.pufferMax) key = 'minnow';
    const t = FISH[key];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? -70 : W + 70;
    const y = rand(SURFACE + 20, SURFACE + 114);
    const spd = rand(t.spd[0], t.spd[1]) * lv.speed * (1 + game.difficulty * 0.35) * SPD_K;
    game.fish.push({
      key, t,
      x, y, baseY: y,
      vx: dir * spd, dir,
      size: t.size * rand(0.9, 1.12),
      ph: rand(0, TAU), bobA: rand(4, 11), bobF: rand(0.7, 1.7),
      alpha: 0.95 - (y - (SURFACE + 20)) / 95 * 0.22,
      flee: 0, alert: 0, state: 'swim', rot: 0
    });
  }

  function scareFish(f, fromX) {
    if (f.state !== 'swim' || f.flee > 0) return;
    f.flee = rand(0.9, 1.5);
    f.vx = sign(f.x - fromX || (Math.random() - .5)) * rand(150, 230) * SPD_K;
    f.dir = sign(f.vx);
    f.alert = 0;
  }

  function updateFish(dt) {
    const list = game.fish;
    const spook = (game.cfg || LEVELS[curLevel]).spook;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.state === 'hooked') {
        const tip = beakTip();
        f.x = tip.x + Math.sin(game.t * 26 + f.ph) * 3.5;
        f.y = tip.y + 4 + Math.cos(game.t * 22 + f.ph) * 3.5;
        f.rot = -Math.PI / 2 + Math.sin(game.t * 18 + f.ph) * 0.28;
        continue;
      }
      if (f.flee > 0) {
        f.flee -= dt;
        f.baseY = Math.min(SURFACE + 144, f.baseY + 56 * dt);
        if (f.flee <= 0) { f.vx = f.dir * (f.t.spd[0] + f.t.spd[1]) * 0.5 * SPD_K; }
      } else {
        if (heron.phase === 'idle' && Math.abs(heron.vel) > (720 * SPD_K) / spook && Math.abs(f.x - heron.hx) < 140 * SPD_K) {
          f.alert = Math.min(1.35, f.alert + dt * 2.6);
          if (f.alert > 1) { scareFish(f, heron.hx); addPop(f.x, f.y - 26, '!', '#9fd8ff', 22); }
        } else {
          f.alert = Math.max(0, f.alert - dt * 1.6);
        }
      }
      f.x += f.vx * dt;
      // 只在真正对局里记「遇见」；菜单待机的背景鱼不算，免得挂机刷图鉴
      if (game.mode === 'playing' && !f.seen && f.x > -20 && f.x < W + 20) {
        f.seen = true;
        markFishSeen(f.key);
      }
      f.y = f.baseY + Math.sin(game.t * f.bobF + f.ph) * f.bobA;
      if (f.x < -110 || f.x > W + 110) list.splice(i, 1);
    }
  }

  /* ==================== 出击 ==================== */
  function beakTip() {
    return { x: heron.hx, y: heron.hy + BEAK_LEN };
  }

  function tryStrike() {
    if (game.mode !== 'playing') return;
    if (heron.phase !== 'idle' || heron.cooldown > 0 || heron.stun > 0) {
      heron.buffer = 0.16;          // 缓冲 160ms，冷却刚结束就补上这一击
      return;
    }
    heron.buffer = 0;
    hideHint();
    heron.phase = 'windup';
    heron.strikeT = 0;
    heron.strikeX = heron.hx;
    heron.cooldown = COOLDOWN;
    game.strikes++;
    sfx.tap();
  }

  function comboMult() {
    return Math.min(1 + 0.15 * Math.max(0, game.combo - 1), 3);
  }

  function resolveStrike() {
    const sx = heron.strikeX;

    // 荷叶挡住：啄在叶子上，算空手
    if (game.pads) {
      let pad = null;
      for (const p of game.pads) {
        if (Math.abs(p.x - sx) < p.r * 0.86) { pad = p; break; }
      }
      if (pad) {
        pad.knock = 1;
        addRing(pad.x, SURFACE + 7, 54, 0.4, '150,205,165', 2);
        addDrop(pad.x, SURFACE + 5, 10, 90, 150);
        if (game.combo > 0) toast('荷叶挡住了', false);
        game.combo = 0;
        game.shake = 5;
        sfx.padHit();
        updateHud(true);
        return;
      }
    }

    const band = [];
    for (const f of game.fish) {
      if (f.state === 'swim' && Math.abs(f.x - sx) <= CATCH_W) band.push(f);
    }
    const bad = band.filter((f) => f.t.bad);

    addRing(sx, SURFACE + 6, 96, 0.55, '175,220,255', 2.5);
    addDrop(sx, SURFACE + 4, 18, 120, 200);
    sfx.splash();

    for (const f of game.fish) {
      if (f.state === 'swim' && Math.abs(f.x - sx) < 210) scareFish(f, sx);
    }

    if (bad.length) {
      game.combo = 0;
      game.score = Math.max(0, game.score - 10);
      progress.poisoned = (progress.poisoned | 0) + 1;
      if (LEVELS[curLevel].endless) game.timeLeft = Math.max(0, game.timeLeft - 2.5);
      heron.stun = 0.9;
      game.shake = 16;
      game.flash = 0.85; game.flashColor = '255,90,80';
      toast('河豚有毒，别啄它', false);
      addPop(bad[0].x, bad[0].y - 18, '-10', '#ff9b8b', 22);
      addSpark(bad[0].x, bad[0].y, 14, '180,230,120');
      sfx.poison();
      updateHud(true);
      return;
    }

    if (band.length) {
      game.hits++;
      for (const f of band) {
        game.combo++;
        game.caught++;
        game.bestCombo = Math.max(game.bestCombo, game.combo);
        const eclMult = game.eclipse > 0.55 ? 2 : 1;
        const pts = Math.round(f.t.pts * comboMult() * eclMult);
        game.score += pts;
        progress.dex[f.key] = (progress.dex[f.key] | 0) + 1;
        f.state = 'hooked';
        f.alpha = 1;
        addPop(f.x, f.y - 14, '+' + pts, f.key === 'koi' ? '#ffd27a' : '#ffeec2', f.key === 'koi' ? 26 : 20);
        addSpark(f.x, f.y, 10, '255,225,150');
      }
      game.flash = 0.26; game.flashColor = '255,235,190';
      game.shake = Math.min(7, 2 + band.length * 1.5);
      if (LEVELS[curLevel].endless) {
        game.timeLeft = Math.min(50, game.timeLeft + 1.3 * band.length);
      }
      saveProgress();          // 图鉴计数随抓随存
      sfx.catchFish(game.combo);
      updateHud(true);
    } else {
      if (game.combo > 0) toast('连击中断', false);
      game.combo = 0;
      sfx.miss();
      updateHud(true);
    }
  }

  function updateStrike(dt) {
    if (heron.phase === 'idle') { heron.hy = lerp(heron.hy, BASE_HY, 0.25); return; }
    heron.strikeT += dt;
    const T = heron.strikeT;
    if (heron.phase === 'windup') {
      heron.hx = heron.strikeX;
      heron.hy = BASE_HY - 16 * easeOutCubic(Math.min(1, T / 0.09));
      if (T >= 0.09) { heron.phase = 'thrust'; heron.strikeT = 0; }
    } else if (heron.phase === 'thrust') {
      const p = Math.min(1, T / 0.1);
      heron.hx = heron.strikeX;
      heron.hy = BASE_HY - 16 + (STRIKE_DEPTH + 16) * Math.pow(p, 1.5);
      if (p >= 1) {
        heron.phase = 'hold'; heron.strikeT = 0;
        resolveStrike();
      }
    } else if (heron.phase === 'hold') {
      if (T >= 0.07) { heron.phase = 'retract'; heron.strikeT = 0; }
    } else if (heron.phase === 'retract') {
      const p = Math.min(1, T / 0.2);
      heron.hy = BASE_HY + STRIKE_DEPTH * (1 - easeOutCubic(p));
      if (p >= 1) {
        heron.phase = 'idle';
        heron.hy = BASE_HY;
        for (let i = game.fish.length - 1; i >= 0; i--) {
          const f = game.fish[i];
          if (f.state === 'hooked') {
            addSpark(f.x, f.y, 6, '255,232,170');
            game.fish.splice(i, 1);
          }
        }
      }
    }
  }

  /* ==================== 更新 ==================== */
  function update(dt) {
    game.t += dt;
    game.cfg = levelCfg();
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 42);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.6);
    if (game.toastT > 0) {
      game.toastT -= dt;
      if (game.toastT <= 0) $('#toast').classList.remove('on');
    }
    // 雨
    if (game.rain) {
      for (let i = 0; i < game.rain.length; i++) {
        const d = game.rain[i];
        d.y += d.v * dt;
        d.x -= d.v * 0.22 * dt;
        if (d.y > SURFACE + 6) { d.y = rand(-60, -10); d.x = rand(-40, W + 60); }
        if (d.x < -70) d.x = W + 50;
      }
    }
    // 荷叶摇晃
    if (game.pads) {
      for (let i = 0; i < game.pads.length; i++) {
        const p = game.pads[i];
        if (p.knock > 0) p.knock = Math.max(0, p.knock - dt * 2.2);
      }
    }
    // 月食循环：14s 正常 → 2.5s 进入 → 5s 全食 → 2.5s 退出
    if (game.ecOn) {
      const wasEcl = game.eclipse > 0.55;
      game.ecT += dt;
      const p = game.ecT % 24;
      let e;
      if (p < 14) e = 0;
      else if (p < 16.5) e = (p - 14) / 2.5;
      else if (p < 21.5) e = 1;
      else e = Math.max(0, 1 - (p - 21.5) / 2.5);
      game.eclipse = e;
      const isEcl = e > 0.55;
      if (isEcl && !wasEcl && game.mode === 'playing') toast('月食 · 得分 ×2', true);
      const showBadge = isEcl && game.mode === 'playing';
      if (showBadge !== game.ecShown) {
        game.ecShown = showBadge;
        $('#ecbadge').classList.toggle('on', showBadge);
      }
    } else if (game.ecShown || $('#ecbadge').classList.contains('on')) {
      game.ecShown = false;
      $('#ecbadge').classList.remove('on');
    }

    const prevHx = heron.hx;
    if (heron.phase === 'idle') {
      const k = 1 - Math.exp(-20 * dt);
      heron.hx += (heron.aimX - heron.hx) * k;
      heron.vel = (heron.hx - prevHx) / Math.max(dt, 1e-4);
    } else {
      heron.vel *= 0.8;
    }
    heron.lean = lerp(heron.lean, clamp((heron.hx - W / 2) * 0.34, -104, 104), 0.075);
    heron.tilt = lerp(heron.tilt, clamp(-heron.vel * 0.00022, -0.22, 0.22), 0.14);
    if (heron.cooldown > 0) heron.cooldown = Math.max(0, heron.cooldown - dt);
    if (heron.stun > 0) heron.stun = Math.max(0, heron.stun - dt);

    heron.blinkTimer -= dt;
    if (heron.blinkTimer <= 0) { heron.blink = 0.16; heron.blinkTimer = rand(2.4, 5.5); }
    if (heron.blink > 0) heron.blink = Math.max(0, heron.blink - dt);

    updateStrike(dt);
    if (heron.buffer > 0) {
      heron.buffer = Math.max(0, heron.buffer - dt);
      if (game.mode === 'playing' && heron.phase === 'idle' && heron.cooldown <= 0 && heron.stun <= 0) {
        heron.buffer = 0;
        tryStrike();
      }
    }
    updateFish(dt);

    for (let i = game.parts.length - 1; i >= 0; i--) {
      const p = game.parts[i];
      p.life -= dt;
      if (p.life <= 0) { game.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spark) { p.vx *= 0.94; p.vy *= 0.94; }
      else { p.vy += 620 * dt; }
    }
    for (let i = game.rings.length - 1; i >= 0; i--) {
      const r = game.rings[i];
      r.life -= dt;
      if (r.life <= 0) { game.rings.splice(i, 1); continue; }
      r.r = 4 + r.maxR * easeOutCubic(1 - r.life / r.max);
    }
    for (let i = game.pops.length - 1; i >= 0; i--) {
      const p = game.pops[i];
      p.life -= dt;
      if (p.life <= 0) { game.pops.splice(i, 1); continue; }
      p.y -= 34 * dt;
    }

    if (game.mode !== 'playing') {
      // 待机背景也要有鱼在游，别空水
      game.ambT = (game.ambT || 0) + dt;
      if (game.ambT > 1.1) {
        game.ambT = 0;
        if (game.fish.filter((f) => f.state === 'swim').length < 5) spawnFish();
      }
      // 入场动画：推到落水那一刻撒一圈涟漪
      if (intro.on) {
        if (!intro.freeze) intro.t += dt;
        const it = intro.t;
        // 影子慢慢显形
        intro.a = clamp((it - INTRO_SHOW) / 2.6, 0, 1);
        // 镜头缓缓推近左前方那个不动的影子
        const zp = clamp((it - 2.6) / 2.5, 0, 1);
        const ze = zp * zp * (3 - 2 * zp);
        intro.zoom = 1 + 0.95 * ze;
        intro.camX = W * 0.5 + (heron.hx - W * 0.5) * ze;
        const fy = BASE_HY - 8;      // 焦点压在脚边，鸟身落在画面上半
        intro.camY = H * 0.55 + (fy - H * 0.55) * ze;
        // 认出来的那一刻：它眨了一下眼
        if (!intro.blink && it > 4.75) { intro.blink = true; heron.blink = 0.18; }
        if (it >= INTRO_DUR && !intro.freeze) endIntro();
      }
      // 远处时不时传来一声夜鹭的呱
      game.callT = (game.callT === undefined ? 3.5 : game.callT) - dt;
      if (game.callT <= 0) {
        game.callT = rand(9, 16);
        sfx.distant();
      }
      return;
    }

    const lv = LEVELS[curLevel];
    game.runT += dt;
    // 无尽模式：越到后面时间掉得越快
    const drain = lv.endless ? 1 + Math.min(1.5, game.elapsed / 90) : 1;
    game.timeLeft -= dt * drain;
    if (lv.endless) {
      game.elapsed += dt;
      game.difficulty = 0;
    } else {
      game.difficulty = clamp(1 - game.timeLeft / GAME_TIME, 0, 1);
    }
    if (game.timeLeft <= 0) { game.timeLeft = 0; endGame(); return; }

    const cfg = game.cfg;
    if (lv.daily && game.plan) {
      // 每日：按预生成的时间表出鱼，与玩家操作无关
      while (game.planIdx < game.plan.length && game.plan[game.planIdx].t <= game.runT) {
        spawnFromPlan(game.plan[game.planIdx]);
        game.planIdx++;
      }
    } else {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        const cap = cfg.density + Math.round(game.difficulty * 3);
        if (game.fish.filter((f) => f.state === 'swim').length < cap) spawnFish();
        game.spawnTimer = lerp(cfg.spawn, cfg.spawn * 0.55, game.difficulty) * rand(0.75, 1.25);
      }
    }

    // 达标提示（只提示一次）
    if (!lv.endless && !game.goalHit && game.score >= game.target) {
      game.goalHit = true;
      toast('目标达成！继续冲星', true);
      sfx.goal();
    }

    if (DEMO) {
      // 近似「熟练玩家」：只在安全且对准时出击，用来校准关卡难度
      const puff = game.fish.filter((f) => f.state === 'swim' && f.t.bad);
      const inBand = game.fish.filter((f) => f.state === 'swim' && Math.abs(f.x - heron.hx) <= 40);
      const badInBand = inBand.some((f) => f.t.bad);
      const goodInBand = inBand.filter((f) => !f.t.bad);
      if (goodInBand.length && !badInBand && heron.phase === 'idle') {
        tryStrike();
      } else {
        let target = null, bd = 1e9;
        for (const f of game.fish) {
          if (f.state !== 'swim' || f.t.bad) continue;
          if (puff.some((p) => Math.abs(p.x - f.x) < 78)) continue;
          const d = Math.abs(f.x - heron.hx);
          if (d < bd) { bd = d; target = f; }
        }
        if (target) heron.aimX = clamp(target.x, AIM_MIN, AIM_MAX);
        else heron.aimX = clamp(480 + Math.sin(game.t * 1.3) * 160, AIM_MIN, AIM_MAX);
      }
    }

    updateHud(false);
  }

  /* ==================== HUD ==================== */
  const hud = { score: -1, time: -1, combo: -1, frac: -1, goal: -1 };
  function updateHud(force) {
    if (hud.score !== game.score) {
      hud.score = game.score;
      const el = $('#score');
      el.textContent = game.score;
      if (force) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      if (LEVELS[curLevel].endless) {
        $('#goaltext').textContent = '无尽模式 · 最高 ' + progress.best[curLevel];
      } else {
        const left = Math.max(0, game.target - game.score);
        $('#goaltext').textContent = left > 0 ? '目标 ' + game.target + ' · 还差 ' + left : '已达标 · 冲三星';
        const gf = clamp(game.score / Math.max(1, game.target), 0, 1);
        hud.goal = gf;
        $('#goalfill').style.transform = 'scaleX(' + gf.toFixed(3) + ')';
        $('#goalbar').classList.toggle('done', gf >= 1);
      }
    }
    const secs = Math.ceil(game.timeLeft);
    if (hud.time !== secs) {
      hud.time = secs;
      $('#clock').innerHTML = secs + '<span class="unit">s</span>';
      $('#clock').classList.toggle('warn', secs <= 10);
    }
    const frac = clamp(game.timeLeft / GAME_TIME, 0, 1);
    if (Math.abs(hud.frac - frac) > 0.002) {
      hud.frac = frac;
      $('#timefill').style.transform = 'scaleX(' + frac.toFixed(3) + ')';
    }
    if (hud.combo !== game.combo) {
      hud.combo = game.combo;
      const el = $('#combo');
      if (game.combo >= 2) {
        el.textContent = '连击 ' + game.combo + '　×' + comboMult().toFixed(2).replace(/0$/, '');
        el.classList.add('on');
      } else {
        el.classList.remove('on');
      }
    }
  }
  function toast(text, good) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.toggle('good', !!good);
    el.classList.add('on');
    game.toastT = 1.5;
  }

  /* ==================== 绘制 ==================== */
  let skyGrad = null, waterGrad = null;

  function ensureGrads() {
    if (skyGrad) return;
    // 菜单里统一用默认夜色，别把刚打完的雨/雾/破晓带回来
    const menu = game.mode === 'title' || game.mode === 'select' || game.mode === 'dex';
    const lv = (menu ? LEVELS[0] : (LEVELS[curLevel] || LEVELS[0]));
    const pal = (menu ? PAL_NIGHT : (game.pal || lv.pal || PAL_NIGHT));
    skyGrad = ctx.createLinearGradient(0, 0, 0, SURFACE + 4);
    pal.sky.forEach(function (c, i) {
      skyGrad.addColorStop(i / (pal.sky.length - 1), c);
    });

    waterGrad = ctx.createLinearGradient(0, SURFACE, 0, H);
    pal.water.forEach(function (c, i) {
      waterGrad.addColorStop(i / (pal.water.length - 1), c);
    });
  }

  function drawSky() {
    const overcast = !!game.rain;        // 雨天：阴云密布，没有月亮和星星
    const hazy = !!game.fog;             // 雾天：月亮只剩一团晕光

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, SURFACE + 4);

    if (!overcast) {
      const starA = hazy ? 0.22 : 1;
      for (const s of stars) {
        const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(game.t * s.s + s.p));
        ctx.globalAlpha = a * 0.9 * starA;
        ctx.fillStyle = '#dcecff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (const c of clouds) {
      c.x += c.v * 0.016;
      if (c.x - c.w > W + 60) c.x = -c.w - 60;
      const rr = c.w / 2;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      g.addColorStop(0, 'rgba(155,195,240,' + (c.a * 0.9).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(155,195,240,' + (c.a * 0.45).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(155,195,240,0)');
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, c.h / rr);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 阴云：几层低垂的灰云压在上方
    if (overcast) {
      for (let i = 0; i < 5; i++) {
        const x = ((i / 5) * W + Math.sin(game.t * 0.07 + i * 2.3) * 130 + W + 260) % (W + 520) - 260;
        const y = H * 0.1 + i * H * 0.055;
        const rr = W * 0.34 + Math.sin(i * 2.7) * 60;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
        gg.addColorStop(0, 'rgba(96,112,128,0.20)');
        gg.addColorStop(0.5, 'rgba(80,96,112,0.12)');
        gg.addColorStop(1, 'rgba(70,86,102,0)');
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.42);
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    const moonA = overcast ? 0 : (hazy ? 0.42 : 1);
    if (moonA > 0) {
      const hk = (1 - 0.8 * (game.eclipse || 0)) * moonA;
      const halo = ctx.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.5, MOON.x, MOON.y, 240);
      halo.addColorStop(0, 'rgba(190,220,255,' + (0.40 * hk).toFixed(3) + ')');
      halo.addColorStop(0.22, 'rgba(160,200,250,' + (0.18 * hk).toFixed(3) + ')');
      halo.addColorStop(0.55, 'rgba(130,180,240,' + (0.06 * hk).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(120,170,240,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(MOON.x, MOON.y, 240, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = moonA;
      if (hazy) {
        // 雾里的月亮：糊成一团
        const soft = ctx.createRadialGradient(MOON.x, MOON.y, 0, MOON.x, MOON.y, MOON.r * 1.5);
        soft.addColorStop(0, 'rgba(244,250,255,0.85)');
        soft.addColorStop(0.45, 'rgba(226,240,252,0.42)');
        soft.addColorStop(1, 'rgba(210,230,248,0)');
        ctx.fillStyle = soft;
        ctx.beginPath();
        ctx.arc(MOON.x, MOON.y, MOON.r * 1.5, 0, TAU);
        ctx.fill();
      } else {
        const moonG = ctx.createRadialGradient(MOON.x, MOON.y, 0, MOON.x, MOON.y, MOON.r);
        moonG.addColorStop(0, '#ffffff');
        moonG.addColorStop(0.6, '#f4f9ff');
        moonG.addColorStop(0.88, '#dcebfc');
        moonG.addColorStop(1, '#bcd4ee');
        ctx.fillStyle = moonG;
        ctx.beginPath();
        ctx.arc(MOON.x, MOON.y, MOON.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(160,185,215,0.20)';
        ctx.beginPath(); ctx.arc(MOON.x - 8, MOON.y + 6, 6.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(MOON.x + 10, MOON.y - 8, 4.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(MOON.x + 4, MOON.y + 16, 3.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 月食：地球的影子从左扫过月亮
      if (game.eclipse > 0.01) {
        const e = game.eclipse;
        const cx = MOON.x - MOON.r * 2.2 + MOON.r * 4.4 * e;
        ctx.save();
        ctx.beginPath();
        ctx.arc(MOON.x, MOON.y, MOON.r + 1, 0, TAU);
        ctx.clip();
        ctx.fillStyle = 'rgba(5,9,18,0.94)';
        ctx.beginPath();
        ctx.arc(cx, MOON.y - MOON.r * 0.15, MOON.r * 1.04, 0, TAU);
        ctx.fill();
        // 血月：暗红压暗，边缘留一点暖色
        const rg = ctx.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.15, MOON.x, MOON.y, MOON.r);
        rg.addColorStop(0, 'rgba(104,30,20,' + (0.62 * e).toFixed(3) + ')');
        rg.addColorStop(0.7, 'rgba(148,52,32,' + (0.44 * e).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(198,94,58,' + (0.26 * e).toFixed(3) + ')');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(MOON.x, MOON.y, MOON.r, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    const mist = ctx.createLinearGradient(0, SURFACE - 120, 0, SURFACE);
    mist.addColorStop(0, 'rgba(130,180,225,0)');
    mist.addColorStop(1, 'rgba(150,195,235,0.20)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, SURFACE - 120, W, 120);
  }

  function drawFarShore() {
    const drawShorePath = () => {
      ctx.beginPath();
      ctx.moveTo(shore[0].x, shore[0].y);
      for (let i = 1; i < shore.length; i++) {
        const a = shore[i - 1], b = shore[i];
        ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 6, b.x, b.y);
      }
    };

    ctx.beginPath();
    ctx.moveTo(-20, shore[0].y);
    drawShorePath();
    ctx.lineTo(W + 20, shore[shore.length - 1].y);
    ctx.lineTo(W + 20, SURFACE + 6);
    ctx.lineTo(-20, SURFACE + 6);
    ctx.closePath();
    const sg = ctx.createLinearGradient(0, SURFACE - 30, 0, SURFACE + 6);
    sg.addColorStop(0, 'rgba(9,20,33,0.55)');
    sg.addColorStop(1, 'rgba(5,12,20,0.96)');
    ctx.fillStyle = sg;
    ctx.fill();

    drawShorePath();
    ctx.strokeStyle = 'rgba(150,200,240,0.13)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.lineCap = 'round';
    for (const r of reeds) {
      const sway = Math.sin(game.t * 0.8 + r.p) * 4 + r.lean;
      ctx.strokeStyle = 'rgba(7,15,25,0.92)';
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.moveTo(r.x, SURFACE + 2);
      ctx.quadraticCurveTo(r.x + r.lean * 0.35, SURFACE - r.h * 0.6, r.x + sway, SURFACE - r.h);
      ctx.stroke();
      if (r.h > 46) {
        ctx.fillStyle = 'rgba(9,18,30,0.9)';
        ctx.beginPath();
        ctx.ellipse(r.x + sway, SURFACE - r.h - 4, 1.8, 5.5, sway * 0.02, 0, TAU);
        ctx.fill();
      }
    }

    for (const f of fireflies) {
      const bx = f.x + Math.sin(game.t * 0.5 + f.p) * 14;
      const by = f.y + Math.cos(game.t * 0.42 + f.p) * 10;
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(game.t * 1.8 + f.p));
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, f.r * 7);
      g.addColorStop(0, 'rgba(210,255,190,' + (a * 0.9).toFixed(3) + ')');
      g.addColorStop(0.3, 'rgba(180,255,150,' + (a * 0.32).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(160,255,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, f.r * 7, 0, TAU);
      ctx.fill();
    }
  }

  /* 荷叶：浮在水面，会挡住啄 */
  function drawPads() {
    for (const p of game.pads) {
      const bob = Math.sin(game.t * 1.1 + p.ph) * 2.2;
      const y = SURFACE + 7 + bob;
      const r = p.r;
      const k = p.knock > 0 ? Math.sin(game.t * 46) * p.knock * 5 : 0;
      ctx.save();
      ctx.translate(p.x + k, y);

      ctx.fillStyle = 'rgba(3,12,18,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 11, r * 1.02, r * 0.32, 0, 0, TAU);
      ctx.fill();

      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.1, 1, 0, 0, r * 1.05);
      g.addColorStop(0, '#3f6f49');
      g.addColorStop(0.62, '#26472f');
      g.addColorStop(1, '#122c1b');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.4, 0, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = 'rgba(150,205,160,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * Math.PI * 1.05;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.36);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(196,236,210,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.4, 0, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 雾：几个漂移的雾团，鱼在里面会变虚 */
  function fogAt(x) {
    return 0.5 + 0.34 * Math.sin(x * 0.012 + game.t * 0.3) * Math.cos(x * 0.005 - game.t * 0.17 + 0.7);
  }

  function drawFog() {
    if (!game.fog) return;
    const t = game.t;
    // 贴水面的一层薄雾
    const band = ctx.createLinearGradient(0, SURFACE - 110, 0, SURFACE + 90);
    band.addColorStop(0, 'rgba(200,222,236,0)');
    band.addColorStop(0.45, 'rgba(204,226,240,0.16)');
    band.addColorStop(0.7, 'rgba(198,220,236,0.20)');
    band.addColorStop(1, 'rgba(190,214,232,0.05)');
    ctx.fillStyle = band;
    ctx.fillRect(0, SURFACE - 110, W, 200);

    for (let i = 0; i < game.fog.blobs; i++) {
      const x = ((i / 7) * W + Math.sin(t * 0.16 + i * 1.7) * 110 + W + 120) % (W + 240) - 120;
      const y = SURFACE + 22 + Math.sin(t * 0.22 + i * 2.3) * 24;
      const r = 180 + Math.sin(i * 3.1) * 50;
      const a = 0.24 + 0.07 * Math.sin(t * 0.5 + i);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(212,232,244,' + a.toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(198,220,236,' + (a * 0.5).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(188,212,232,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.44, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawRain() {
    if (!game.rain) return;
    ctx.save();
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    for (const d of game.rain) {
      ctx.strokeStyle = 'rgba(186,214,238,' + d.a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.l * 0.22, d.y + d.l);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWater() {
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, SURFACE, W, H - SURFACE);

    // 石影
    for (const r of rocks) {
      const g = ctx.createRadialGradient(r.x, r.y - r.ry * 0.4, 2, r.x, r.y, r.rx);
      g.addColorStop(0, 'rgba(16,44,56,0.55)');
      g.addColorStop(1, 'rgba(6,20,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, TAU);
      ctx.fill();
    }

    // 水草
    ctx.lineCap = 'round';
    for (const p of deepPlants) {
      const sway = Math.sin(game.t * 0.55 + p.p) * 9;
      ctx.strokeStyle = 'rgba(12,52,58,0.5)';
      ctx.lineWidth = p.w;
      ctx.beginPath();
      ctx.moveTo(p.x, H + 12);
      ctx.quadraticCurveTo(p.x + p.lean * 0.6 + sway * 0.35, H - p.h * 0.45, p.x + p.lean + sway, H - p.h);
      ctx.stroke();
    }

    for (let i = 0; i < 24; i++) {
      const y = SURFACE + 8 + i * i * 1.05;
      if (y > H) break;
      const a = 0.055 * (1 - i / 26);
      ctx.strokeStyle = 'rgba(150,205,240,' + a.toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 26) {
        const yy = y + Math.sin(x * 0.012 + game.t * 0.9 + i * 0.7) * 1.8;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // 月光倒影：柔和的横向波光（雨天没有月亮，雾天只剩一点）
    const moonRefl = game.rain ? 0 : (game.fog ? 0.4 : 1);
    if (moonRefl > 0) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 34; i++) {
          const yy = SURFACE + 6 + i * 6.2;
          if (yy > H) break;
          const wdt = (pass ? 86 : 42) + Math.sin(i * 1.6 + game.t * (pass ? 1.1 : 1.4)) * 18 + i * 3.2;
          const off = Math.sin(i * 0.8 + game.t * 1.05) * (pass ? 16 : 11);
          const a = (pass ? 0.06 : 0.13) * Math.max(0, 1 - i / 34) * moonRefl;
          ctx.fillStyle = 'rgba(198,230,255,' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.ellipse(MOON.x + off, yy, wdt / 2, (pass ? 4.2 : 2.2) + i * 0.09, 0, 0, TAU);
          ctx.fill();
        }
      }

      ctx.save();
      ctx.globalAlpha = moonRefl;
      const shaft = ctx.createLinearGradient(0, SURFACE, 0, H);
      shaft.addColorStop(0, 'rgba(180,220,255,0.06)');
      shaft.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = shaft;
      ctx.beginPath();
      ctx.moveTo(MOON.x - 60, SURFACE);
      ctx.lineTo(MOON.x + 60, SURFACE);
      ctx.lineTo(MOON.x + 190, H);
      ctx.lineTo(MOON.x - 190, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawAimShaft() {
    if (game.mode === 'title') return;
    const pulse = 0.5 + 0.5 * Math.sin(game.t * 2.2);
    ctx.save();
    ctx.translate(heron.hx, SURFACE + 52);
    ctx.scale(1, 1.25);
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 80);
    g.addColorStop(0, 'rgba(185,225,255,' + (0.06 + pulse * 0.04).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(185,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function inReach(f) {
    return game.mode === 'playing' && heron.phase === 'idle' && Math.abs(f.x - heron.hx) <= CATCH_W;
  }

  function drawFish(f) {
    const t = f.t;
    const s = f.size;
    const glowing = f.state === 'swim' && inReach(f);

    if (t.glow) {
      // 月光鱼：自带一圈冷光
      const gg = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, s * 4.4);
      gg.addColorStop(0, 'rgba(200,238,255,0.55)');
      gg.addColorStop(0.45, 'rgba(150,215,255,0.2)');
      gg.addColorStop(1, 'rgba(150,215,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(f.x, f.y, s * 4.4, 0, TAU);
      ctx.fill();
    }

    if (glowing) {
      const col = t.bad ? '255,110,95' : '255,220,140';
      const pulse = 0.5 + 0.5 * Math.sin(game.t * 7);
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, s * 3.2);
      g.addColorStop(0, 'rgba(' + col + ',' + (0.22 + pulse * 0.14).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, s * 3.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(' + col + ',' + (0.3 + pulse * 0.28).toFixed(3) + ')';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, s * 2.0, s * 1.45, 0, 0, TAU);
      ctx.stroke();
    }

    const halo = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, s * 2.8);
    halo.addColorStop(0, 'rgba(190,228,255,0.12)');
    halo.addColorStop(0.6, 'rgba(180,220,255,0.05)');
    halo.addColorStop(1, 'rgba(180,220,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(f.x, f.y, s * 2.8, 0, TAU);
    ctx.fill();

    if (f.alert > 0.25 && f.state === 'swim') {
      ctx.globalAlpha = Math.min(1, f.alert);
      ctx.fillStyle = '#bfe6ff';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', f.x, f.y - s * 2.1);
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    if (f.state === 'hooked') ctx.rotate(f.rot);
    ctx.scale(f.dir, 1);
    const fogDim = game.fog ? (1 - 0.68 * fogAt(f.x)) : 1;
    const eclDim = game.eclipse > 0.3 ? (1 - 0.25 * game.eclipse) : 1;
    ctx.globalAlpha = f.alpha * Math.max(0.5, fogDim * eclDim);   // 雾+月食叠加也别把鱼变没

    const wag = Math.sin(game.t * (f.flee > 0 ? 18 : 9) + f.ph) * (f.flee > 0 ? 0.7 : 0.45);

    if (t.shape === 'puffer') {
      const puff = 1 + 0.06 * Math.sin(game.t * 3 + f.ph) + (glowing ? 0.1 : 0);
      const r = s * puff;
      ctx.fillStyle = t.fin;
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU + game.t * 0.2;
        const x1 = Math.cos(a) * r * 0.92, y1 = Math.sin(a) * r * 0.92;
        const x2 = Math.cos(a + 0.16) * r * 1.2, y2 = Math.sin(a + 0.16) * r * 1.2;
        const x3 = Math.cos(a + 0.32) * r * 0.92, y3 = Math.sin(a + 0.32) * r * 0.92;
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath(); ctx.fill();
      }
      const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.1);
      bg.addColorStop(0, t.light);
      bg.addColorStop(0.62, t.body);
      bg.addColorStop(1, '#8b9535');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

      ctx.fillStyle = t.fin;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(-r * 1.7, -r * 0.5 + wag * 5);
      ctx.lineTo(-r * 1.7, r * 0.5 + wag * 5);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = '#1a2410';
      ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.2, r * 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(35,45,15,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(r * 0.24, -r * 0.48); ctx.lineTo(r * 0.64, -r * 0.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,50,20,.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(r * 0.68, r * 0.2, r * 0.15, r * 0.09, 0, 0, TAU); ctx.stroke();
    } else if (t.shape === 'loach') {
      const len = s * 2.5;
      ctx.fillStyle = t.body;
      ctx.beginPath();
      ctx.moveTo(len * 0.8, 0);
      ctx.quadraticCurveTo(0, -s * 0.8 + Math.sin(game.t * 6 + f.ph) * 2, -len * 0.7, -s * 0.1);
      ctx.quadraticCurveTo(-len * 0.9, 0, -len * 0.7, s * 0.1);
      ctx.quadraticCurveTo(0, s * 0.8 + Math.sin(game.t * 6 + f.ph) * 2, len * 0.8, 0);
      ctx.fill();
      ctx.fillStyle = t.fin;
      ctx.beginPath();
      ctx.moveTo(-len * 0.62, 0);
      ctx.lineTo(-len * 1.05, -s * 0.6);
      ctx.lineTo(-len * 1.05, s * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a1c14';
      ctx.beginPath(); ctx.arc(len * 0.55, -s * 0.15, s * 0.2, 0, TAU); ctx.fill();
    } else {
      ctx.save();
      ctx.translate(-s * 0.95, 0);
      ctx.rotate(wag * 0.55);
      ctx.fillStyle = t.fin;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.95, -s * 1.2, -s * 1.0);
      ctx.quadraticCurveTo(-s * 0.72, 0, -s * 1.2, s * 1.0);
      ctx.quadraticCurveTo(-s * 0.6, s * 0.95, 0, 0);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = t.fin;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.5);
      ctx.quadraticCurveTo(0, -s * 1.5, s * 0.62, -s * 0.35);
      ctx.closePath();
      ctx.fill();

      const bg = ctx.createLinearGradient(0, -s, 0, s);
      bg.addColorStop(0, t.light);
      bg.addColorStop(0.45, t.body);
      bg.addColorStop(1, t.fin);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.18, s * 0.72, 0, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, -s * 0.1, s * 0.75, s * 0.32, -0.2, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();

      ctx.fillStyle = '#0b1420';
      ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.14, s * 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(s * 0.66, -s * 0.19, s * 0.05, 0, TAU); ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---- 夜鹭 ---- */
  const HERON_SIL = '#08111b';

  function neckGeom() {
    const bx = W / 2 + heron.lean, by = BODY_Y;
    const hx = heron.hx, hy = heron.hy;
    const p0 = { x: bx + clamp((hx - bx) * 0.32, -28, 28), y: by - 34 };
    const p3 = { x: hx, y: hy + 9 };
    const dx = p3.x - p0.x, dy = p3.y - p0.y;
    const d = Math.hypot(dx, dy) || 1;
    const sx = dx >= 0 ? 1 : -1;
    const rise = Math.min(40, 14 + d * 0.2);
    const p1 = { x: p0.x + dx * 0.10, y: p0.y - rise };
    const p2 = { x: p3.x - sx * Math.min(54, d * 0.4), y: p3.y + Math.min(36, d * 0.3) };
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, v = 1 - u;
      const x = v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x;
      const y = v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y;
      pts.push({ x, y, u });
    }
    return pts;
  }

  function drawNeck(silhouette) {
    const pts = neckGeom();
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(b.y - a.y), ny = (b.x - a.x);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const w = lerp(11, 6.5, pts[i].u) * (1 + 0.16 * Math.sin(pts[i].u * Math.PI));
      L.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      R.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(L[0].x, L[0].y);
      for (let i = 1; i < L.length; i++) ctx.lineTo(L[i].x, L[i].y);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
      ctx.closePath();
    };
    const top = Math.min(heron.hy, BODY_Y) - 12;
    const bot = Math.max(heron.hy, BODY_Y) + 16;

    path();
    if (silhouette) {
      ctx.fillStyle = HERON_SIL;
    } else {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, SK.light);
      g.addColorStop(0.5, SK.mid);
      g.addColorStop(1, SK.dark);
      ctx.fillStyle = g;
    }
    ctx.fill();

    if (!silhouette) {
      const rim = ctx.createLinearGradient(0, top, 0, bot);
      rim.addColorStop(0, 'rgba(198,226,255,0.42)');
      rim.addColorStop(0.5, 'rgba(150,195,242,0.12)');
      rim.addColorStop(1, 'rgba(150,195,242,0)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.5;
      path();
      ctx.stroke();
    }
  }

  function drawHeronHead(silhouette) {
    ctx.save();
    ctx.translate(heron.hx, heron.hy);
    ctx.rotate(heron.tilt);

    const top = -18, bot = 20;

    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 16, 0, 0, TAU);
    if (silhouette) {
      ctx.fillStyle = HERON_SIL;
      ctx.fill();
    } else {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, SK.headLight);
      g.addColorStop(0.45, SK.headMid);
      g.addColorStop(1, SK.headDark);
      ctx.fillStyle = g;
      ctx.fill();
    }

    if (!silhouette) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 16, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = SK.crown;
      ctx.beginPath();
      ctx.ellipse(-1, -12, 21, 11, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = SK.cheek;
      ctx.beginPath();
      ctx.ellipse(6, 8, 11, 6.5, -0.22, 0, TAU);
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(-8.5, 3);
      ctx.quadraticCurveTo(-5.5, 32, 0, BEAK_LEN);
      ctx.quadraticCurveTo(5.5, 32, 8.5, 3);
      ctx.closePath();
      const bg = ctx.createLinearGradient(-8.5, 0, 8.5, 0);
      bg.addColorStop(0, SK.bill1);
      bg.addColorStop(0.32, SK.bill2);
      bg.addColorStop(1, SK.bill3);
      ctx.fillStyle = bg;
      ctx.fill();

      ctx.strokeStyle = SK.billRim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-8.5, 3);
      ctx.quadraticCurveTo(-5.5, 32, 0, BEAK_LEN - 1);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.quadraticCurveTo(0, 30, 0, BEAK_LEN - 3);
      ctx.stroke();

      ctx.fillStyle = SK.lores;
      ctx.beginPath();
      ctx.ellipse(0, 4, 7.5, 3.4, 0, 0, TAU);
      ctx.fill();

      const eyeX = 7, eyeY = -2;
      ctx.fillStyle = SK.eyeRing;
      ctx.beginPath(); ctx.arc(eyeX, eyeY, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = SK.iris;
      ctx.beginPath(); ctx.arc(eyeX + 0.6, eyeY, 4.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b1016';
      ctx.beginPath(); ctx.arc(eyeX + 0.6, eyeY, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(eyeX - 0.9, eyeY - 1.8, 1.3, 0, TAU); ctx.fill();
      if (heron.blink > 0) {
        ctx.fillStyle = SK.headMid;
        ctx.beginPath(); ctx.ellipse(eyeX, eyeY, 6.4, 6.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,225,250,.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(eyeX - 6, eyeY); ctx.quadraticCurveTo(eyeX, eyeY + 3, eyeX + 6, eyeY); ctx.stroke();
      }

      const rim = ctx.createLinearGradient(0, top, 0, bot);
      rim.addColorStop(0, 'rgba(205,230,255,0.75)');
      rim.addColorStop(0.55, 'rgba(165,205,248,0.22)');
      rim.addColorStop(1, 'rgba(165,205,248,0)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 16, 0, 0, TAU);
      ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const w1 = Math.sin(game.t * 1.9 + i * 1.1) * 4;
        ctx.strokeStyle = 'rgba(' + SK.plumeRgb + ',' + (0.66 - i * 0.14).toFixed(2) + ')';
        ctx.lineWidth = 1.6 - i * 0.22;
        ctx.beginPath();
        ctx.moveTo(-7, -11 + i * 2);
        ctx.quadraticCurveTo(-30, -22 + i * 6 + w1, -46 - i * 8, -6 + i * 10 + w1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawHeronBody(silhouette) {
    const bx = W / 2 + heron.lean, by = BODY_Y;
    const breathe = Math.sin(game.t * 1.5) * 1.5;

    if (!silhouette) {
      const legs = [
        { x1: bx - 10, y1: by + 32, kx: bx - 18, ky: by + 68, fx: bx - 25 },
        { x1: bx + 18, y1: by + 34, kx: bx + 25, ky: by + 70, fx: bx + 32 }
      ];
      ctx.lineCap = 'round';
      for (const L of legs) {
        ctx.strokeStyle = SK.legDark;
        ctx.lineWidth = 5.4;
        ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.kx, L.ky); ctx.stroke();
        ctx.strokeStyle = SK.leg;
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.kx, L.ky); ctx.stroke();
        ctx.strokeStyle = SK.legFaint;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(L.kx, L.ky);
        ctx.lineTo(L.fx, SURFACE + 8);
        ctx.moveTo(L.fx, SURFACE + 8); ctx.lineTo(L.fx - 8, SURFACE + 12);
        ctx.moveTo(L.fx, SURFACE + 8); ctx.lineTo(L.fx + 9, SURFACE + 12);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(175,220,250,0.30)';
        ctx.lineWidth = 1.2;
        const rr = 10 + Math.sin(game.t * 2 + L.fx) * 2;
        ctx.beginPath();
        ctx.ellipse(L.fx, SURFACE + 6, rr, rr * 0.32, 0, 0, TAU);
        ctx.stroke();
      }
    }

    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(bx - 50, by - 8);
      ctx.bezierCurveTo(bx - 55, by - 36 - breathe, bx - 26, by - 50 - breathe, bx + 4, by - 48 - breathe);
      ctx.bezierCurveTo(bx + 32, by - 46 - breathe, bx + 46, by - 20, bx + 42, by + 6);
      ctx.bezierCurveTo(bx + 38, by + 32, bx + 8, by + 44, bx - 18, by + 40);
      ctx.bezierCurveTo(bx - 42, by + 36, bx - 54, by + 20, bx - 50, by - 8);
      ctx.closePath();
    };

    ctx.beginPath();
    ctx.moveTo(bx - 38, by - 15);
    ctx.lineTo(bx - 70, by + 3);
    ctx.lineTo(bx - 63, by + 14);
    ctx.lineTo(bx - 34, by + 13);
    ctx.closePath();
    ctx.fillStyle = silhouette ? HERON_SIL : SK.tail;
    ctx.fill();

    bodyPath();
    if (silhouette) {
      ctx.fillStyle = HERON_SIL;
    } else {
      const g = ctx.createLinearGradient(0, by - 50, 0, by + 42);
      g.addColorStop(0, SK.light);
      g.addColorStop(0.5, SK.mid);
      g.addColorStop(1, '#0a121a');
      ctx.fillStyle = g;
    }
    ctx.fill();

    if (!silhouette) {
      ctx.beginPath();
      ctx.moveTo(bx - 30, by - 30);
      ctx.bezierCurveTo(bx - 2, by - 45, bx + 26, by - 32, bx + 27, by - 6);
      ctx.bezierCurveTo(bx + 12, by + 14, bx - 16, by + 14, bx - 30, by - 6);
      ctx.closePath();
      const wg = ctx.createLinearGradient(bx - 20, by - 40, bx + 24, by + 10);
      wg.addColorStop(0, SK.wing1);
      wg.addColorStop(1, SK.wing2);
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(155,195,238,0.20)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(175,210,245,0.12)';
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(bx - 26 + i * 9, by - 26 + i * 3);
        ctx.quadraticCurveTo(bx - 4 + i * 9, by - 4 + i * 2, bx - 14 + i * 9, by + 13);
        ctx.stroke();
      }

      const rim = ctx.createLinearGradient(0, by - 50, 0, by + 40);
      rim.addColorStop(0, 'rgba(210,234,255,0.72)');
      rim.addColorStop(0.42, 'rgba(170,210,250,0.26)');
      rim.addColorStop(0.72, 'rgba(150,195,242,0.05)');
      rim.addColorStop(1, 'rgba(150,195,242,0)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.8;
      bodyPath();
      ctx.stroke();
    }
  }

  function drawHeronReflection() {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.translate(0, SURFACE * 1.45);
    ctx.scale(1, -0.42);
    drawHeronBody(true);
    drawNeck(true);
    drawHeronHead(true);
    ctx.restore();
  }

  function drawHeron() {
    drawHeronBody(false);
    drawNeck(false);
    drawHeronHead(false);

    if (heron.phase === 'thrust' || heron.phase === 'hold' || heron.phase === 'retract') {
      const d = clamp((heron.hy - BASE_HY) / STRIKE_DEPTH, 0, 1);
      const a = Math.sin(d * Math.PI) * 0.85;
      if (a > 0.02) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(220,242,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(heron.hx, SURFACE + 4, 26 + d * 16, 8 + d * 5, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a * 0.55;
        ctx.strokeStyle = 'rgba(200,235,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(heron.hx, SURFACE + 4, 34 + d * 42, 11 + d * 14, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (heron.stun > 0) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const a = game.t * 6 + i * TAU / 3;
        const x = heron.hx + Math.cos(a) * 24;
        const y = heron.hy - 34 + Math.sin(a) * 7;
        ctx.fillStyle = i % 2 ? '#ffd479' : '#a8f0c8';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEffects() {
    for (const r of game.rings) {
      const k = r.life / r.max;
      ctx.strokeStyle = 'rgba(' + r.color + ',' + (k * 0.75).toFixed(3) + ')';
      ctx.lineWidth = r.lw * k + 0.4;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.34, 0, 0, TAU);
      ctx.stroke();
    }
    for (const p of game.parts) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = 'rgba(' + p.c + ',' + (k * 0.9).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.8), 0, TAU);
      ctx.fill();
    }
    for (const p of game.pops) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      ctx.font = '600 ' + p.size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,.65)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.42, W / 2, H * 0.42, H * 1.02);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.40)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    const s = SCALE;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ensureGrads();
    if (intro.on) applyIntroCamera();          // 入场动画的缓推镜头

    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake * 0.7);
    }

    drawSky();
    drawFarShore();
    drawWater();
    if (!intro.on) drawHeronReflection();
    if (game.fog) drawFog();
    if (!intro.on) drawAimShaft();
    for (const f of game.fish) drawFish(f);
    if (game.pads) drawPads();
    if (!intro.on) {
      drawHeron();
    } else if (intro.t >= INTRO_SHOW) {
      // 从几乎看不见的影子，逐渐认出来
      ctx.save();
      ctx.globalAlpha = 0.05 + 0.95 * intro.a;
      drawHeron();
      ctx.restore();
    }
    drawEffects();
    drawIntro();

    const surf = ctx.createLinearGradient(0, SURFACE - 6, 0, SURFACE + 26);
    surf.addColorStop(0, 'rgba(150,200,240,0.10)');
    surf.addColorStop(0.5, 'rgba(160,205,240,0.22)');
    surf.addColorStop(1, 'rgba(150,200,240,0.05)');
    ctx.fillStyle = surf;
    ctx.fillRect(0, SURFACE - 6, W, 32);

    ctx.strokeStyle = 'rgba(180,220,250,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const yy = SURFACE + Math.sin(x * 0.018 + game.t * 1.3) * 1.8 + Math.sin(x * 0.006 - game.t * 0.8) * 1.4;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    drawVignette();
    if (game.eclipse > 0.005) {
      ctx.fillStyle = 'rgba(2,5,11,' + (0.42 * game.eclipse).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (game.rain) drawRain();

    if (game.flash > 0.001) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, 'rgba(' + game.flashColor + ',0)');
      g.addColorStop(1, 'rgba(' + game.flashColor + ',' + (game.flash * 0.62).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    drawIntroFade();
  }

  /* ==================== 流程 ==================== */
  let currentScreen = null;
  function showScreen(name) {
    currentScreen = name;
    const ov = $('#overlay');
    ov.classList.toggle('show', !!name);
    ov.style.visibility = '';
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('show', el.dataset.screen === name);
    });
    stage.classList.toggle('playing', game.mode === 'playing' || game.mode === 'paused');
    stage.classList.toggle('paused', game.mode === 'paused');
  }

  function resetGame() {
    const lv = LEVELS[curLevel];
    // 每日挑战用当天抽到的组合，其余关卡用自己的开关
    const mods = lv.daily ? dailyCombo() : lv;
    game.pal = mods.pal || lv.pal || PAL_NIGHT;
    skyGrad = null; waterGrad = null;                 // 换场景就重建渐变
    game.rain = mods.rain
      ? Array.from({ length: 70 }, () => ({
          x: rand(-60, W + 60), y: rand(-SURFACE, SURFACE),
          v: rand(760, 1180), l: rand(12, 26), a: rand(0.12, 0.3)
        }))
      : null;
    game.pads = mods.pads
      ? [{ x: W * 0.335, r: 40, ph: rand(0, 6), knock: 0 },
         { x: W * 0.665, r: 38, ph: rand(0, 6), knock: 0 }]
      : null;
    game.fog = mods.fog ? { blobs: 7 } : null;
    game.ecOn = !!mods.eclipse;
    game.ecT = 9;              // 开局 3 秒后第一次月食
    game.eclipse = 0;
    game.ecShown = false;
    $('#ecbadge').classList.remove('on');
    game.score = 0; game.combo = 0; game.bestCombo = 0;
    game.caught = 0; game.strikes = 0; game.hits = 0;
    game.target = lv.target; game.goalHit = false;
    game.elapsed = 0; game.cfg = levelCfg();
    game.runT = 0; game.planIdx = 0;
    game.plan = lv.daily ? buildDailyPlan(lv, hashStr(dateKey())) : null;
    GAME_TIME = SEC_OVERRIDE || lv.time;
    game.timeLeft = GAME_TIME; game.difficulty = 0; game.spawnTimer = 0.3;
    game.fish.length = 0; game.parts.length = 0; game.rings.length = 0; game.pops.length = 0;
    game.shake = 0; game.flash = 0;
    heron.phase = 'idle'; heron.hy = BASE_HY; heron.hx = W / 2;
    heron.aimX = W / 2; heron.cooldown = 0; heron.stun = 0; heron.lean = 0;
    hud.score = -1; hud.time = -1; hud.combo = -1; hud.frac = -1; hud.goal = -1;
    $('#leveltag').textContent = levelTag(curLevel);
    $('#goalbar').style.display = (lv.endless || lv.daily) ? 'none' : '';
    if (!lv.daily) for (let i = 0; i < 3; i++) spawnFish();
    updateHud(true);
    $('#combo').classList.remove('on');
    $('#toast').classList.remove('on');
  }

  function startLevel(i) {
    sfx.init();
    curLevel = clamp(i | 0, 0, LEVELS.length - 1);
    SK = skinById(progress.skin).c;
    const lv = LEVELS[curLevel];
    if (lv.daily) {
      const today = dateKey();
      if (progress.daily.key !== today) {
        progress.daily.streak = progress.daily.key === shiftDay(today, -1) ? (progress.daily.streak | 0) + 1 : 1;
        progress.daily.key = today;
        progress.daily.best = 0;
        saveProgress();
      }
    }
    sfx.music.setMode(lv.music);
    resetGame();
    game.mode = 'playing';
    showScreen(null);
    sfx.music.duck(1);
    disarmReset();
    if (!hintShown) {
      hintShown = true;
      showHint(touchMode ? '按住拖动瞄准 · 松手啄下去' : '移动鼠标瞄准 · 点击水面啄下去', 9000);
    }
    sfx.start();
  }

  function endGame() {
    game.mode = 'over';
    const lv = LEVELS[curLevel];
    const endless = !!lv.endless;
    const pass = endless ? true : game.score >= lv.target;
    const stars = endless ? 0 : starsFor(game.score, lv.target);
    const isNew = game.score > progress.best[curLevel];
    if (isNew) progress.best[curLevel] = game.score;
    if (stars > progress.stars[curLevel]) progress.stars[curLevel] = stars;
    if (!endless && pass && curLevel + 1 < BASE_NIGHTS) {
      progress.unlocked = Math.max(progress.unlocked, curLevel + 2);
    }
    saveProgress();
    if (lv.daily) {
      progress.daily.best = Math.max(progress.daily.best | 0, game.score);
      saveProgress();
    }
    lastResult = {
      kind: lv.daily ? 'daily' : endless ? 'endless' : 'level',
      tag: levelTag(curLevel),
      score: game.score,
      stars,
      caught: game.caught,
      combo: game.bestCombo,
      acc: game.strikes ? Math.round((game.hits / game.strikes) * 100) : 0,
      survived: endless ? game.elapsed : 0,
      date: dateKey()
    };

    // 下一关只在正片五夜之间连着走，不能靠它跳进没解锁的隐藏关
    const hasNext = !endless && !lv.daily && pass && curLevel + 1 < BASE_NIGHTS;

    $('#res-eyebrow').textContent = endless ? "Time's up · 收工"
      : (pass ? 'Cleared · 过关' : "Time's up · 差一点");
    $('#res-title').textContent = levelTag(curLevel);
    $('#res-stars').hidden = endless;
    document.querySelectorAll('#res-stars span').forEach((el, i) => {
      el.classList.toggle('on', i < stars);
    });
    $('#over-score').textContent = game.score;
    $('#over-score').classList.toggle('fail', !pass && !endless);
    $('#res-goal').textContent = endless
      ? '存活 ' + game.elapsed.toFixed(1) + ' 秒'
      : (pass ? '目标 ' + lv.target + ' · 已达成' : '目标 ' + lv.target + ' · 还差 ' + (lv.target - game.score));
    $('#res-goal').classList.toggle('miss', !pass && !endless);
    $('#st-catch').textContent = game.caught;
    $('#st-combo').textContent = game.bestCombo;
    $('#st-acc').textContent = game.strikes ? Math.round((game.hits / game.strikes) * 100) + '%' : '—';
    $('#st-best').textContent = progress.best[curLevel];
    $('#new-best').hidden = !isNew;
    $('#btn-next').hidden = !hasNext;
    if (hasNext) $('#btn-next').textContent = LEVELS[curLevel + 1].endless ? '进入无尽' : '下一关';
    $('#btn-retry').textContent = endless ? '再来一次' : (pass ? '再刷一次' : '再试一次');
    $('#res-hint').innerHTML = hasNext ? '按 <kbd>空格</kbd> 继续' : '按 <kbd>空格</kbd> 再来一次';
    $('#combo').classList.remove('on');
    hideHint();
    showScreen('over');
    if (!endless && pass) sfx.win(); else sfx.over();
  }

  function nextAction() {
    if (game.mode !== 'over') return;
    const pass = game.score >= LEVELS[curLevel].target;
    if (pass && curLevel + 1 < BASE_NIGHTS) startLevel(curLevel + 1);
    else startLevel(curLevel);
  }

  function buildLevels() {
    const wrap = $('#levels');
    wrap.innerHTML = '';
    const order = [];
    LEVELS.forEach((lv, i) => { if (lv.daily) order.push(i); });
    for (let i = 0; i < NIGHT_COUNT; i++) order.push(i);
    LEVELS.forEach((lv, i) => { if (lv.endless) order.push(i); });

    let hiddenShown = false;
    order.forEach((i) => {
      const lv = LEVELS[i];
      // 隐藏关：没集齐星星时只露一条占位
      if (lv.hidden && totalStars() < HIDDEN_AT) {
        if (hiddenShown) return;
        hiddenShown = true;
        const ph = document.createElement('button');
        ph.type = 'button';
        ph.className = 'lvl locked hiddenlvl';
        ph.innerHTML =
          '<span class="lvl-no">??</span>' +
          '<span class="lvl-main"><b>隐藏关</b><em>集齐 ' + HIDDEN_AT + ' ★ 才会出现 · 已有 ' + totalStars() + '</em></span>' +
          '<span class="lvl-goal">？？？</span>' +
          '<span class="lvl-stars">锁</span>';
        wrap.appendChild(ph);
        return;
      }
      const gateOk = totalStars() >= HIDDEN_AT;      // 每日 / 无尽 共用同一道门槛
      const unlocked = (lv.endless && gateOk) || (lv.daily && gateOk) || lv.hidden || i < progress.unlocked;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'lvl' + (unlocked ? '' : ' locked') +
        (lv.endless ? ' endless' : '') + (lv.daily ? ' daily' : '') + (lv.hidden ? ' hiddenlvl' : '');
      el.dataset.i = i;
      let no, sub = lv.sub, goal, st;
      if (lv.daily) {
        const today = dateKey();
        const played = progress.daily.key === today;
        no = '今';
        sub = fmtDate(today);
        if (!gateOk) {
          goal = '集齐 ' + HIDDEN_AT + ' ★ 解锁';
          st = '锁';
        } else {
          goal = played ? '今日最高 ' + progress.daily.best : '45 秒 · ' + dailyCombo().name;
          st = progress.daily.streak > 0 ? '连 ' + progress.daily.streak + ' 天' : '新';
        }
      } else if (lv.endless) {
        no = '∞';
        if (!gateOk) {
          goal = '集齐 ' + HIDDEN_AT + ' ★ 解锁';
          st = '锁';
        } else {
          goal = progress.best[i] ? '最高 ' + progress.best[i] : '生存挑战';
          st = '∞';
        }
      } else {
        no = String(i + 1).padStart(2, '0');
        goal = unlocked ? '目标 ' + lv.target : '未解锁';
        st = unlocked ? starsText(progress.stars[i]) : '锁';
      }
      el.innerHTML =
        '<span class="lvl-no">' + no + '</span>' +
        '<span class="lvl-main"><b>' + lv.name + '</b><em>' + sub + '</em></span>' +
        '<span class="lvl-goal">' + goal + '</span>' +
        '<span class="lvl-stars">' + st + '</span>';
      if (unlocked) {
        el.addEventListener('click', (e) => { e.stopPropagation(); sfx.init(); startLevel(i); });
      }
      wrap.appendChild(el);
    });
    $('#select-hint').textContent = totalStars() >= HIDDEN_AT
      ? '已获得 ' + totalStars() + ' / ' + (NIGHT_COUNT * 3) + ' ★ · 通关解锁下一夜'
      : '已获得 ' + totalStars() + ' / ' + (NIGHT_COUNT * 3) + ' ★ · 集齐 ' + HIDDEN_AT + ' ★ 解锁隐藏关';
  }

  function showSelect() {
    buildLevels();
    clearScene();
    game.mode = 'select';
    showScreen('select');
  }

  /* ==================== 图鉴 / 皮肤 ==================== */
  function withCtx(tempCtx, fn) {
    const old = ctx;
    ctx = tempCtx;
    try { fn(); } finally { ctx = old; }
  }

  function makeFishIcon(key, size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const t = FISH[key];
    withCtx(g, function () {
      drawFish({
        key: key, t: t, x: size * 0.5, y: size * 0.5,
        size: size / 5, dir: 1, ph: 1.2,
        flee: 0, alpha: 1, state: 'icon', rot: 0, alert: 0
      });
    });
    return c;
  }

  function makeSkinIcon(skin, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const oldSK = SK, ohx = heron.hx, ohy = heron.hy, otilt = heron.tilt, oblink = heron.blink;
    SK = skin.c;
    heron.hx = 0; heron.hy = 0; heron.tilt = 0; heron.blink = 0;
    try {
      withCtx(g, function () {
        const s = w / 70;
        g.setTransform(s, 0, 0, s, w * 0.62, h * 0.24);
        drawHeronHead(false);
      });
    } finally {
      SK = oldSK; heron.hx = ohx; heron.hy = ohy; heron.tilt = otilt; heron.blink = oblink;
    }
    return c;
  }

  function buildDex(tab) {
    const fishWrap = $('#dex-fish'), skinWrap = $('#dex-skin');
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    fishWrap.style.display = tab === 'fish' ? 'grid' : 'none';
    skinWrap.style.display = tab === 'skin' ? 'flex' : 'none';

    const got = dexCollected(), total = dexTotal();
    $('#dexbar').style.transform = 'scaleX(' + (got / total).toFixed(3) + ')';
    $('#dexcount').textContent = got >= total ? '图鉴集齐 ' + got + ' / ' + total : '图鉴 ' + got + ' / ' + total;
    $('#dexcount').parentNode.classList.toggle('done', got >= total);

    if (tab === 'fish') {
      fishWrap.innerHTML = '';
      Object.keys(FISH).forEach(function (k) {
        const t = FISH[k];
        const caught = progress.dex[k] | 0;
        const seen = progress.dexSeen[k] | 0;
        const known = caught > 0 || seen > 0;
        const card = document.createElement('div');
        card.className = 'dexcard' + (known ? '' : ' unseen') + (t.bad ? ' danger' : '');
        card.appendChild(makeFishIcon(k, 64));
        let sub;
        if (t.bad) {
          sub = progress.poisoned > 0 ? '挨过 ' + progress.poisoned + ' 次毒' : (seen ? '见过，别啄' : '还没遇见');
        } else if (caught > 0) {
          sub = '已捕获 ' + caught + ' 条';
        } else if (seen > 0) {
          sub = '遇见 ' + seen + ' 次，没逮着';
        } else {
          sub = '还没遇见';
        }
        const info = document.createElement('div');
        info.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1px';
        info.innerHTML = '<b>' + t.name + '</b>' +
          '<span class="pts">' + (t.bad ? '有毒 · 扣分' : '+' + t.pts) + '</span>' +
          '<em>' + sub + '</em>';
        card.appendChild(info);
        fishWrap.appendChild(card);
      });
    } else {
      skinWrap.innerHTML = '';
      SKINS.forEach(function (s) {
        const unlocked = skinUnlocked(s);
        const on = progress.skin === s.id;
        const row = document.createElement('div');
        row.className = 'dexskin' + (unlocked ? '' : ' locked') + (on ? ' on' : '');
        row.appendChild(makeSkinIcon(s, 48, 60));
        const main = document.createElement('div');
        main.className = 'sk-main';
        main.innerHTML = '<b>' + s.name + '</b><em>' + s.desc + '</em>';
        row.appendChild(main);
        const act = document.createElement('div');
        act.className = 'sk-act';
        act.innerHTML = unlocked
          ? (on ? '<span class="on-tag">使用中</span>' : '<button class="minibtn" data-skin="' + s.id + '">使用</button>')
          : '<span class="lock-tag">' + skinUnlockText(s) + '</span>';
        row.appendChild(act);
        skinWrap.appendChild(row);
      });
      skinWrap.querySelectorAll('button[data-skin]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          progress.skin = b.getAttribute('data-skin');
          saveProgress();
          SK = skinById(progress.skin).c;
          buildDex('skin');
        });
      });
    }
  }

  function showDex() {
    game.mode = 'dex';
    buildDex('fish');
    showScreen('dex');
  }

  /* 回到菜单时把场景特效收掉，别把雨/雾/月食带回标题 */
  function clearScene() {
    game.rain = null; game.pads = null; game.fog = null;
    game.ecOn = false; game.eclipse = 0; game.ecShown = false;
    $('#ecbadge').classList.remove('on');
    skyGrad = null; waterGrad = null;
  }

  /* ==================== 入场动画：入夜 → 猎手现身 ==================== */
  const INTRO_DUR = 6.1;
  const INTRO_SHOW = 2.5;          // 夜鹭开始「隐约出现」
  const intro = { on: false, t: 0, a: 0, zoom: 1, camX: 0, camY: 0, blink: false };

  function startIntro() {
    intro.on = true; intro.t = 0; intro.a = 0; intro.blink = false;
    intro.zoom = 1; intro.camX = W * 0.5; intro.camY = H * 0.55;
    game.mode = 'intro';
    // 让它站在画面左三分之一、芦苇边上，而不是正中央
    heron.hx = W * 0.285; heron.aimX = heron.hx;
    heron.hy = BASE_HY; heron.phase = 'idle';
    stage.classList.add('intro');
    showScreen(null);
  }
  function endIntro() {
    if (!intro.on) return;
    intro.on = false;
    heron.hx = W * 0.5; heron.aimX = W * 0.5;   // 淡黑之后归位，看不见
    stage.classList.remove('intro');
    showTitle();
  }
  function skipIntro() {
    if (intro.on) intro.t = Math.max(intro.t, INTRO_DUR);
  }

  /* 镜头：以 (camX, camY) 为中心放大 */
  function applyIntroCamera() {
    const z = intro.zoom;
    if (z <= 1.0005) return;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-intro.camX, -intro.camY);
  }

  function birdShadow(a) {
    ctx.fillStyle = 'rgba(9,15,23,' + a.toFixed(3) + ')';
    ctx.strokeStyle = 'rgba(9,15,23,' + a.toFixed(3) + ')';
  }

  // 猫头鹰：侧视滑翔，翅膀上下扇
  function drawOwlFly(x, y, s, ph) {
    const lift = Math.sin(ph * 4.2);
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    birdShadow(0.92);
    ctx.save();
    ctx.rotate(-0.12 + lift * 0.4);
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-28, -30 - lift * 20, -50, -6 - lift * 12);
    ctx.quadraticCurveTo(-26, 6, 2, 6);
    ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(6, 4, 21, 11, 0.16, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(25, -3, 9.5, 0, TAU); ctx.fill();
    // 耳簇
    ctx.beginPath(); ctx.moveTo(21, -10); ctx.lineTo(23, -17); ctx.lineTo(27, -10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(29, -10); ctx.lineTo(31, -16); ctx.lineTo(34, -9); ctx.fill();
    // 尾
    ctx.beginPath(); ctx.moveTo(-13, 1); ctx.lineTo(-31, 9); ctx.lineTo(-13, 10); ctx.fill();
    ctx.restore();
  }

  // 夜鹰：细长翅膀、快速扑翼
  function drawNightjarFly(x, y, s, ph) {
    const lift = Math.sin(ph * 11);
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    birdShadow(0.9);
    ctx.save();
    ctx.rotate(-0.05 + lift * 0.5);
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-22, -16 - lift * 16, -44, -2 - lift * 10);
    ctx.quadraticCurveTo(-20, 4, 2, 5);
    ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(6, 3, 15, 7.5, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(19, -1, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(-30, 6); ctx.lineTo(-8, 8); ctx.fill();
    ctx.restore();
  }

  function drawIntro() {
    if (!intro.on) return;
    const t = intro.t;
    // 猫头鹰 0.7–2.5
    if (t > 0.7 && t < 2.55) {
      const p = clamp((t - 0.7) / 1.8, 0, 1);
      drawOwlFly(-70 + (W + 150) * p, H * 0.17 + Math.sin(p * 5) * 7, 0.7 + p * 0.16, t);
    }
    // 夜鹰 1.9–3.35
    if (t > 1.9 && t < 3.4) {
      const p = clamp((t - 1.9) / 1.45, 0, 1);
      drawNightjarFly(W + 70 - (W + 160) * p, H * 0.4 + Math.sin(p * 10) * 5, 0.85, t);
    }
  }

  function drawIntroFade() {
    if (!intro.on) return;
    if (intro.t < 1.0) {
      ctx.fillStyle = 'rgba(0,0,0,' + (1 - intro.t).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    // 收尾淡出：把镜头复位藏在黑里
    const out = clamp((intro.t - (INTRO_DUR - 0.55)) / 0.55, 0, 1);
    if (out > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + out.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function showTitle() {
    game.mode = 'title';
    clearScene();
    $('#title-progress').textContent = totalStars() > 0
      ? '已获得 ' + totalStars() + ' / ' + (NIGHT_COUNT * 3) + ' ★ · ' + VERSION
      : '5 个夜晚 + 每日挑战 + 无尽模式 · ' + VERSION;
    if (/360SE|360EE|QIHU|360Browser/i.test(navigator.userAgent || '')) {
      $('#title-progress').textContent += ' · 检测到 360 浏览器，排版异常请改用 Edge / Chrome';
    }
    showScreen('title');
  }

  /* ==================== 战报分享 ==================== */
  let shareUrl = '';

  function buildShareCard() {
    const CW = 1080, CH = 1440;
    const IMG_H = 840;
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    const g = c.getContext('2d');
    const R = lastResult || {
      kind: 'level', tag: levelTag(0), score: 0, stars: 0,
      caught: 0, combo: 0, acc: 0, date: dateKey()
    };

    // —— 上半：场景（居中裁切，保证夜鹭在画面里）
    const sw = cvs.width || 1, sh = cvs.height || 1;
    const k = Math.max(CW / sw, IMG_H / sh);
    g.drawImage(cvs, (CW - sw * k) / 2, (IMG_H - sh * k) / 2, sw * k, sh * k);

    // 顶部压暗（放品牌字）
    let gr = g.createLinearGradient(0, 0, 0, 190);
    gr.addColorStop(0, 'rgba(3,7,13,0.8)');
    gr.addColorStop(1, 'rgba(3,7,13,0)');
    g.fillStyle = gr; g.fillRect(0, 0, CW, 190);

    // 图片与信息区之间的过渡
    gr = g.createLinearGradient(0, IMG_H - 170, 0, IMG_H);
    gr.addColorStop(0, 'rgba(6,11,20,0)');
    gr.addColorStop(1, 'rgba(6,11,20,1)');
    g.fillStyle = gr; g.fillRect(0, IMG_H - 170, CW, 170);

    // —— 下半：信息面板
    g.fillStyle = '#060b14';
    g.fillRect(0, IMG_H, CW, CH - IMG_H);

    const SANS = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
    const SERIF = '"Songti SC","STSong","Noto Serif SC","Microsoft YaHei",serif';

    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(212,232,250,0.9)';
    g.font = '500 30px ' + SANS;
    g.fillText('NYCTICORAX · 夜鹭捕鱼', 72, 108);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(196,218,242,0.62)';
    g.fillText(fmtDate(R.date), CW - 72, 108);

    // 关卡
    g.textAlign = 'center';
    g.fillStyle = 'rgba(150,180,212,0.95)';
    g.font = '500 34px ' + SANS;
    g.fillText(R.tag, CW / 2, 938);

    // 分数
    const grad = g.createLinearGradient(0, 980, 0, 1120);
    grad.addColorStop(0, '#fff6dc');
    grad.addColorStop(0.5, '#ffd479');
    grad.addColorStop(1, '#e2942f');
    g.fillStyle = grad;
    g.font = '700 168px ' + SERIF;
    g.fillText(String(R.score), CW / 2, 1108);

    // 星级
    g.font = '600 50px ' + SANS;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < R.stars ? '#ffd479' : 'rgba(150,180,210,0.22)';
      g.fillText('★', CW / 2 + (i - 1) * 58, 1178);
    }

    // 统计
    const sy = 1268;
    const cols = [['条鱼', R.caught], ['最高连击', R.combo], ['命中率', R.acc + '%']];
    cols.forEach((cc, i) => {
      const x = CW / 2 + (i - 1) * 250;
      g.font = '600 40px ' + SANS;
      g.fillStyle = 'rgba(232,242,255,0.95)';
      g.fillText(String(cc[1]), x, sy);
      g.font = '400 22px ' + SANS;
      g.fillStyle = 'rgba(150,180,210,0.8)';
      g.fillText(cc[0], x, sy + 34);
    });

    // 底部品牌
    g.strokeStyle = 'rgba(150,190,230,0.16)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(150, 1330); g.lineTo(CW - 150, 1330); g.stroke();

    g.font = '600 40px ' + SERIF;
    g.fillStyle = 'rgba(220,236,252,0.92)';
    g.fillText('你是鹭', CW / 2, 1392);
    g.font = '400 22px ' + SANS;
    g.fillStyle = 'rgba(150,180,210,0.72)';
    g.fillText(R.kind === 'daily' ? '每日挑战 · 同一天的鱼群' : '一根拇指的钓鱼游戏', CW / 2, 1424);

    return c.toDataURL('image/png');
  }

  function openShare() {
    shareUrl = buildShareCard();
    $('#share-img').src = shareUrl;
    showScreen('share');
  }

  function captionText() {
    const r = lastResult;
    if (!r) return '';
    const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    if (r.kind === 'daily') {
      return '《你是鹭》' + fmtDate(r.date) + ' 每日挑战：' + r.score + ' 分 ' + stars +
        '｜最高连击 ' + r.combo + '，命中 ' + r.acc + '%。同一天的鱼群，你也来试试？';
    }
    if (r.kind === 'endless') {
      return '《你是鹭》无尽模式活了 ' + r.survived.toFixed(1) + ' 秒，' + r.score + ' 分，接住 ' + r.caught + ' 条鱼。';
    }
    return '《你是鹭》' + r.tag + '拿了 ' + r.score + ' 分 ' + stars + '，接住 ' + r.caught + ' 条鱼。你能抓多少？';
  }

  /* ---- 小红书容器能力：保存相册 / 发笔记 ---- */
  function xhsMini() { return (window.xhs && window.xhs.miniTool) || null; }
  function xhsTempFile(dataUrl) {
    var m = xhsMini();
    if (!m || typeof m.writeTempFile !== 'function') return Promise.resolve(dataUrl);
    return m.writeTempFile({ data: dataUrl }).then(function (r) {
      return (r && r.filePath) || dataUrl;
    }, function () { return dataUrl; });
  }
  function saveCard() {
    if (!shareUrl) return;
    var m = xhsMini();
    if (!m || typeof m.saveImageToPhotosAlbum !== 'function') {
      toast('直接截图保存这张战报', true);
      return;
    }
    xhsTempFile(shareUrl).then(function (p) {
      return m.saveImageToPhotosAlbum({ filePath: p });
    }).then(function () { toast('已存到相册', true); },
            function () { toast('保存失败，可以直接截图', false); });
  }
  function postNoteWithCard() {
    if (!shareUrl) return;
    var m = xhsMini();
    if (!m || typeof m.postNote !== 'function') {
      toast('当前环境不支持发笔记', false);
      return;
    }
    var r = lastResult;
    var title = '夜鹭局 ' + (r ? r.score : 0) + ' 分';
    xhsTempFile(shareUrl).then(function (p) {
      return m.postNote({
        title: title.slice(0, 20),
        content: captionText().slice(0, 1000),
        pageType: 'photo_publish',
        mediaInfo: { image_resources: [{ url: p }] }
      });
    }).then(function () { toast('已打开发布页', true); },
            function () { toast('发笔记失败，可以先截图', false); });
  }
  function copyCaption() { toast('直接截图分享更方便', true); }

  function togglePause() {
    if (game.mode === 'playing') {
      game.mode = 'paused';
      showScreen('pause');
      sfx.music.duck(0.45);
    } else if (game.mode === 'paused') {
      game.mode = 'playing';
      showScreen(null);
      sfx.music.duck(1);
      disarmReset();
    }
  }

  /* ==================== 输入 ==================== */
  let touchMode = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window)
    || /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent || '');
  let dragging = false;
  let hintShown = false, hintTimer = 0;

  function pointerToX(clientX) {
    const r = cvs.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  }
  function setAim(clientX) {
    heron.aimX = clamp(pointerToX(clientX), AIM_MIN, AIM_MAX);
  }

  /* ---- 上手提示 ---- */
  function showHint(text, ms) {
    $('#hint-text').textContent = text;
    $('#hint').classList.add('show');
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(hideHint, ms);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    $('#hint').classList.remove('show');
  }
  function applyInputText() {
    if (touchMode) {
      $('#how-aim').textContent = '按住屏幕，左右拖动';
      $('#how-shoot').textContent = '手指抬起，长喙就啄下去';
      $('#how-tip').textContent = '河豚有毒，别啄；轻点一下也能直接啄';
      $('#how-touch').hidden = true;
    } else {
      $('#how-aim').innerHTML = '移动鼠标，或按 <kbd>A</kbd> <kbd>D</kbd>';
      $('#how-shoot').innerHTML = '点击水面，或按 <kbd>空格</kbd>';
      $('#how-tip').textContent = '河豚有毒，别啄；动作太重会惊跑鱼群';
      $('#how-touch').hidden = false;
    }
  }
  if (params.has('touch')) touchMode = true;
  applyInputText();

  stage.addEventListener('pointerdown', (e) => {
    sfx.init();
    if (intro.on) { skipIntro(); return; }          // 动画期间任意点击直接跳过
    if (e.pointerType === 'touch' && !touchMode) { touchMode = true; applyInputText(); }
    if (e.target.closest('button, .settings')) return;   // 按钮 / 音量面板不触发出击
    if (game.mode !== 'playing') return;
    if (e.pointerType === 'touch') {
      // 触屏：按下只是「拿起」，松手才出击
      dragging = true;
      setAim(e.clientX);
      heron.hx = heron.aimX;
    } else {
      setAim(e.clientX);
      tryStrike();
    }
  });

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      if (!dragging) return;
      setAim(e.clientX);
      heron.hx = heron.aimX;          // 跟手，不留延迟
      return;
    }
    setAim(e.clientX);
  }, { passive: true });

  stage.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !dragging) return;
    dragging = false;
    if (game.mode !== 'playing') return;
    setAim(e.clientX);
    heron.hx = heron.aimX;
    tryStrike();
  });
  stage.addEventListener('pointercancel', () => { dragging = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  const keys = { left: false, right: false };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
    if (intro.on) { e.preventDefault(); skipIntro(); return; }   // 动画期间任意键跳过
    if (game.mode === 'select' && /^Digit[1-9]$/.test(e.code)) {
      const i = parseInt(e.code.slice(5), 10) - 1;
      const lv = LEVELS[i];
      if (i >= 0 && i < LEVELS.length && lv &&
          (lv.hidden || i < progress.unlocked) &&
          (!(lv.daily || lv.endless) || totalStars() >= HIDDEN_AT)) startLevel(i);
      return;
    }
    switch (e.code) {
      case 'Space':
      case 'Enter':
        e.preventDefault();
        sfx.init();
        if (game.mode === 'title') showSelect();
        else if (game.mode === 'dex') showSelect();
        else if (game.mode === 'select') startLevel(Math.min(progress.unlocked - 1, NIGHT_COUNT - 1));
        else if (game.mode === 'over') {
          if (currentScreen === 'share') showScreen('over'); else nextAction();
        }
        else if (game.mode === 'paused') togglePause();
        else tryStrike();
        break;
      case 'ArrowLeft': case 'KeyA': keys.left = true; break;
      case 'ArrowRight': case 'KeyD': keys.right = true; break;
      case 'KeyP': case 'Escape':
        if (currentScreen === 'share') showScreen('over');
        else if (game.mode === 'dex') showSelect();
        else if (game.mode === 'select') showTitle();
        else togglePause();
        break;
      case 'KeyM': {
        const m = sfx.toggle();
        toast(m ? '已静音' : '声音已开', true);
        break;
      }
      case 'KeyR':
        if (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'over') startLevel(curLevel);
        break;
      default: break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });
  window.addEventListener('blur', () => {
    keys.left = keys.right = false;
    if (game.mode === 'playing') togglePause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'playing') togglePause();
  });

  $('#btn-start').addEventListener('click', () => { sfx.init(); showSelect(); });
  $('#btn-next').addEventListener('click', () => { sfx.init(); startLevel(curLevel + 1); });
  $('#btn-retry').addEventListener('click', () => { sfx.init(); startLevel(curLevel); });
  $('#btn-levels').addEventListener('click', () => { sfx.init(); showSelect(); });
  $('#btn-dex').addEventListener('click', (e) => { e.stopPropagation(); sfx.init(); showDex(); });
  $('#btn-dexback').addEventListener('click', (e) => { e.stopPropagation(); showSelect(); });
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); buildDex(b.dataset.tab); });
  });
  $('#btn-share').addEventListener('click', (e) => { e.stopPropagation(); sfx.init(); openShare(); });
  $('#btn-save').addEventListener('click', (e) => { e.stopPropagation(); saveCard(); });
  $('#btn-shareback').addEventListener('click', (e) => { e.stopPropagation(); showScreen('over'); });
  $('#btn-postnote').addEventListener('click', (e) => { e.stopPropagation(); postNoteWithCard(); });
  $('#btn-resume').addEventListener('click', togglePause);
  $('#btn-restart').addEventListener('click', () => { sfx.init(); startLevel(curLevel); });
  $('#btn-quit').addEventListener('click', () => { sfx.init(); showSelect(); });

  /* ---- 右下角控制键 ---- */
  $('#btn-pause').addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.init();
    togglePause();
  });
  $('#btn-music').addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.init();
    const on = sfx.music.toggle();
    $('#btn-music').classList.toggle('off', !on);
    saveAudio();
    toast(on ? '音乐已开' : '音乐已关', true);
  });

  /* ---- 音量（音乐 / 音效分开调） ---- */
  const AUDIO_KEY = 'heron-audio-v1';
  const audioCfg = (function () {
    try {
      const o = JSON.parse(localStorage.getItem(AUDIO_KEY) || 'null');
      if (o && typeof o.music === 'number' && typeof o.sfx === 'number') return o;
    } catch (err) { /* ignore */ }
    return { music: 0.55, sfx: 0.8 };
  })();
  sfx.setVolumes(audioCfg.music, audioCfg.sfx);
  if (audioCfg.on === false) {
    sfx.music.setOn(false);
    $('#btn-music').classList.add('off');
  }
  $('#vol-music').value = Math.round(audioCfg.music * 100);
  $('#vol-sfx').value = Math.round(audioCfg.sfx * 100);
  $('#vol-music-v').textContent = $('#vol-music').value;
  $('#vol-sfx-v').textContent = $('#vol-sfx').value;
  function applyAudio() {
    sfx.setVolumes(+$('#vol-music').value / 100, +$('#vol-sfx').value / 100);
    $('#vol-music-v').textContent = $('#vol-music').value;
    $('#vol-sfx-v').textContent = $('#vol-sfx').value;
  }
  function saveAudio() {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify({
        music: +$('#vol-music').value / 100,
        sfx: +$('#vol-sfx').value / 100,
        on: sfx.music.on
      }));
    } catch (err) { /* ignore */ }
  }
  ['vol-music', 'vol-sfx'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyAudio);
    el.addEventListener('change', saveAudio);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  });
  $('#btn-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.init();
    $('#settings').classList.toggle('show');
  });
  $('#btn-sfx-test').addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.init();
    sfx.catchFish(3);
    setTimeout(() => sfx.distant(), 420);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#settings') && !e.target.closest('#btn-settings')) {
      $('#settings').classList.remove('show');
    }
  }, true);

  /* ---- 重置进度（二次确认，设置面板和暂停面板共用） ---- */
  let resetArmed = false, resetTO = 0;
  function resetBtns() { return Array.prototype.slice.call(document.querySelectorAll('[data-reset]')); }
  function disarmReset() {
    resetArmed = false;
    clearTimeout(resetTO);
    resetBtns().forEach(function (b) {
      b.classList.remove('armed');
      b.textContent = b.getAttribute('data-label') || '重置进度';
    });
  }
  resetBtns().forEach(function (b) {
    b.setAttribute('data-label', b.textContent);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!resetArmed) {
        resetArmed = true;
        b.classList.add('armed');
        b.textContent = '再点一次确认清空';
        clearTimeout(resetTO);
        resetTO = setTimeout(disarmReset, 3200);
        return;
      }
      progress = freshProgress();
      saveProgress();
      curLevel = 0;
      disarmReset();
      $('#settings').classList.remove('show');
      game.mode = 'title';
      showTitle();
      toast('进度已清空', true);
    });
  });
  // 点面板空白处也能继续
  $('#overlay').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (game.mode === 'title') { sfx.init(); showSelect(); }
    else if (game.mode === 'paused') togglePause();
    else if (game.mode === 'over') {
      if (currentScreen === 'share') showScreen('over'); else nextAction();
    }
  });

  /* ==================== 主循环 ==================== */
  let last = 0;
  let frameN = 0;
  function frame(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    dt = clamp(dt, 0.0001, 1 / 24);

    // 布局看门狗：有些浏览器会漏掉 resize 事件
    if ((frameN++ % 60) === 0) {
      const vw = Math.round(document.documentElement.clientWidth || window.innerWidth || 0);
      const vh = Math.round(document.documentElement.clientHeight || window.innerHeight || 0);
      if (Math.abs(vw - lastVW) > 2 || Math.abs(vh - lastVH) > 2) resize();
    }

    // 保险：非对局状态如果遮罩没显示，强制显示（入场动画本身就是要盖住遮罩，排除）
    if (game.mode !== 'playing' && game.mode !== 'paused' && game.mode !== 'intro' &&
        !$('#overlay').classList.contains('show')) {
      showScreen(game.mode === 'over' ? 'over' : game.mode === 'select' ? 'select' : 'title');
    }

    if (game.mode === 'playing' && (keys.left || keys.right)) {
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      heron.aimX = clamp(heron.aimX + dir * 560 * dt, AIM_MIN, AIM_MAX);
    }

    try {
      if (game.mode !== 'paused') update(dt);
    } catch (err) { reportError(err); }
    try { draw(); } catch (err) { reportError(err); }
    requestAnimationFrame(frame);
  }

  resize();
  ensureGrads();
  const skipIntroForDebug = params.has('ui') || params.has('demo') || params.has('cardshot') ||
    params.has('flowtest') || params.has('dbg');
  if (skipIntroForDebug || params.has('nointro')) showTitle();
  else {
    startIntro();
    if (params.has('introseek')) {          // 调试：冻结在某一帧
      intro.t = clamp(parseFloat(params.get('introseek')) || 0, 0, INTRO_DUR - 0.01);
      intro.freeze = true;
    }
  }
  updateHud(true);
  requestAnimationFrame(frame);

  if (DEMO) {
    const lvParam = parseInt(params.get('level'), 10);
    if (lvParam >= 1 && lvParam <= LEVELS.length) curLevel = lvParam - 1;
    startLevel(curLevel);
    for (let i = 0; i < WARP * 60; i++) update(1 / 60);
    draw();
  }
  const uiParam = params.get('ui');
  if (uiParam === 'select') showSelect();
  else if (uiParam === 'pause') { startLevel(0); togglePause(); }
  else if (uiParam === 'volume') $('#settings').classList.add('show');
  else if (uiParam === 'dex') { if (params.get('tab') === 'skin') { game.mode = 'dex'; buildDex('skin'); showScreen('dex'); } else showDex(); }
  else if (uiParam === 'card') {
    startLevel(0);
    for (let i = 0; i < 380; i++) update(1 / 60);
    draw();
    lastResult = {
      kind: 'level', tag: '第三夜 · 子夜', score: 1044, stars: 2,
      caught: 29, combo: 18, acc: 90, survived: 0, date: dateKey()
    };
    openShare();
  }
  else if (uiParam === 'hint') showHint(touchMode ? '按住拖动瞄准 · 松手啄下去' : '移动鼠标瞄准 · 点击水面啄下去', 0);
  if (params.has('dbg')) {
    const r = cvs.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    document.title = 'viewport=' + vw + 'x' + vh + ' canvas=' + Math.round(r.left) + ',' + Math.round(r.top) +
      ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' world=' + W + 'x' + H +
      ' margins=' + Math.round(r.left) + '/' + Math.round(vw - r.right) + '/' + Math.round(r.top) + '/' + Math.round(vh - r.bottom);
  }
  if (params.has('flowtest')) {
    const log = [];
    const st = () => '[mode=' + game.mode + ' ov="' + $('#overlay').className + '" stage="' + stage.className +
      '" hud=' + getComputedStyle($('.hud')).display + ' fish=' + game.fish.length + ']';
    try {
      log.push('init' + st());
      document.querySelector('#btn-start').click();
      log.push('start' + st());
      const row = document.querySelector('.lvl:not(.locked)');
      if (row) { row.click(); log.push('row' + st()); }
      // 模拟「遮罩被隐藏但不在对局中」
      game.mode = 'over';
      $('#overlay').classList.remove('show');
      setTimeout(() => {
        log.push('heal' + st());
        document.title = log.join(' | ');
      }, 260);
    } catch (err) { log.push('ERR ' + err.message); document.title = log.join(' | '); }
  }
  if (params.has('cardshot') && shareUrl) {
    stage.style.display = 'none';
    const im = document.createElement('img');
    im.src = shareUrl;
    im.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#060b14';
    document.body.appendChild(im);
  }

})();