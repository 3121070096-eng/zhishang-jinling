'use strict';
/**
 * 本地规则式「AI 起稿」引擎：根据灵感词生成虚线建议轮廓（非剪口）。
 * 确定性种子 + 对称几何路径；不调用云端大模型。
 */
(function (global) {
  const TAU = Math.PI * 2;
  const CHIP_PRESETS = [
    { label: '窗花', prompt: '窗花 对称' },
    { label: '喜鹊', prompt: '喜鹊 花枝' },
    { label: '牡丹', prompt: '牡丹 团花' },
    { label: '福字韵', prompt: '福 圆孔' },
    { label: '门笺', prompt: '门笺 菱形' },
    { label: '夜窗', prompt: '窗影 细镂' }
  ];

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tokenize(prompt) {
    return String(prompt || '')
      .toLowerCase()
      .replace(/[，,。.！!？?\s]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
  }

  function interpret(tokens) {
    const joined = tokens.join(' ');
    const mood = {
      fold: 4,
      outline: 'flower',
      motif: 'floral',
      density: 1,
      fine: false
    };
    if (/八|放射|满/.test(joined)) mood.fold = 8;
    if (/二|对联|门笺/.test(joined)) mood.fold = 2;
    if (/自由|写意/.test(joined)) mood.fold = 1;
    if (/窗|窗花|窗影|格|门笺/.test(joined)) {
      mood.outline = 'square';
      mood.motif = 'lattice';
    }
    if (/圆|团花|福/.test(joined)) {
      mood.outline = 'round';
      mood.motif = 'fu';
    }
    if (/花|牡丹|梅|枝|喜鹊|鸟/.test(joined)) mood.motif = 'floral';
    if (/细|镂|线/.test(joined)) {
      mood.fine = true;
      mood.density = 1.3;
    }
    return mood;
  }

  /** Build a closed or open guide path in paper-local coords (origin at center). */
  function petalLoop(rng, cx, cy, len, widen) {
    const pts = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = -Math.PI / 2 + t * Math.PI;
      const r = len * (0.35 + 0.65 * Math.sin(t * Math.PI));
      pts.push({
        x: cx + Math.cos(a) * widen * r + (rng() - 0.5) * 2,
        y: cy + Math.sin(a) * r + (rng() - 0.5) * 2
      });
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const a = -Math.PI / 2 + t * Math.PI;
      const r = len * (0.35 + 0.65 * Math.sin(t * Math.PI));
      pts.push({
        x: cx - Math.cos(a) * widen * r + (rng() - 0.5) * 2,
        y: cy + Math.sin(a) * r + (rng() - 0.5) * 2
      });
    }
    return pts;
  }

  function diamondLoop(cx, cy, s) {
    return [
      { x: cx, y: cy - s },
      { x: cx + s * 0.55, y: cy },
      { x: cx, y: cy + s },
      { x: cx - s * 0.55, y: cy },
      { x: cx, y: cy - s }
    ];
  }

  function circleLoop(cx, cy, r, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function latticeCell(cx, cy, s) {
    return [
      { x: cx - s, y: cy - s },
      { x: cx + s, y: cy - s },
      { x: cx + s, y: cy + s },
      { x: cx - s, y: cy + s },
      { x: cx - s, y: cy - s }
    ];
  }

  function generateGuides(prompt, options = {}) {
    const text = String(prompt || '').trim() || '团花';
    const seedBase = options.seed != null ? options.seed : hashString(text + '|guide|' + (options.salt || 'jinling'));
    const rng = mulberry32(seedBase);
    const tokens = tokenize(text);
    const mood = interpret(tokens);
    if (options.fold) mood.fold = options.fold;

    const guides = []; // { points:[{x,y}], closed:boolean, label?:string }
    const sector = mood.fold === 1 ? TAU : TAU / mood.fold;
    const count = Math.round((5 + rng() * 5) * mood.density);

    // Center guide
    if (mood.motif === 'fu' || mood.motif === 'floral') {
      guides.push({ points: circleLoop(0, 0, 28 + rng() * 16, 24), closed: true, kind: 'center' });
    }

    for (let i = 0; i < count; i++) {
      const a = sector * (0.12 + rng() * 0.76);
      const r = 70 + rng() * (mood.fine ? 140 : 160);
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r;
      if (mood.motif === 'lattice') {
        const s = 12 + rng() * 18;
        guides.push({ points: latticeCell(cx, cy, s), closed: true, kind: 'lattice' });
        if (rng() > 0.45) guides.push({ points: diamondLoop(cx, cy, s * 0.7), closed: true, kind: 'diamond' });
      } else if (mood.motif === 'fu') {
        guides.push({ points: circleLoop(cx, cy, 10 + rng() * 14, 16), closed: true, kind: 'dot' });
        if (rng() > 0.5) guides.push({ points: diamondLoop(cx * 0.85, cy * 0.85, 14 + rng() * 10), closed: true, kind: 'diamond' });
      } else {
        const len = 22 + rng() * 28;
        guides.push({ points: petalLoop(rng, cx, cy, len, 0.45 + rng() * 0.25), closed: true, kind: 'petal' });
      }
    }

    // Outer motif for bird/flower words
    if (/喜鹊|鸟|枝|牡丹|梅/.test(tokens.join(''))) {
      const ring = Math.min(mood.fold === 1 ? 6 : mood.fold, 8);
      for (let k = 0; k < ring; k++) {
        const a = (k / ring) * (mood.fold === 1 ? TAU : sector * 0.9) + 0.18;
        const rr = 175 + rng() * 30;
        guides.push({
          points: petalLoop(rng, Math.cos(a) * rr, Math.sin(a) * rr, 26 + rng() * 10, 0.5),
          closed: true,
          kind: 'ring'
        });
      }
    }

    // Mirror guides into fold sectors for preview richness when fold>1
    // Keep only the canonical sector paths; studio will draw them once and
    // visually suggest symmetry via fold guides already on canvas.

    return {
      prompt: text,
      seed: seedBase,
      fold: mood.fold,
      outline: mood.outline,
      engine: 'local-rule-guide-v1',
      notice: '本地规则式生成虚线建议轮廓，需人手落剪；非云端大模型，非传统纹样复刻。',
      guides,
      waitMs: Math.round(1200 + rng() * 600)
    };
  }

  /** Convert guides to SVG path strings in absolute 600×600 paper space. */
  function guidesToSvgPaths(guides) {
    return (guides || []).map((g) => {
      const d = g.points
        .map((p, i) => `${i ? 'L' : 'M'}${+(p.x + 300).toFixed(2)} ${+(p.y + 300).toFixed(2)}`)
        .join(' ') + (g.closed ? ' Z' : '');
      return { d, kind: g.kind || 'guide' };
    });
  }

  global.AiInspire = { generateGuides, guidesToSvgPaths, CHIP_PRESETS, hashString };
})(typeof window !== 'undefined' ? window : globalThis);
