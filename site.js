// nevinv.com — shared behaviour for every page.
//  1. star cursor (generated from a pixel bitmap)
//  2. dithered background canvas: sparkle trail, click burst, idle "ghost star"
//  3. data widgets: projects (GitHub), codeforces rating
// (posts, nav state and the "updated" date are rendered by Jekyll)
// Network results are cached in localStorage for an hour so visitors don't
// hit API rate limits.

(() => {
  const CF_HANDLE = "nevinv";
  const GH_USER = "nevin314";
  const HOUR = 60 * 60 * 1000;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. star cursor ---------- */
  const STAR = [
    ".....k.....",
    "....kwk....",
    "....kwk....",
    "...kwwwk...",
    "kkkkwwwkkkk",
    "kwwwwwwwwwk",
    ".kwwwwwwwk.",
    "..kwwwwwk..",
    "..kwwkwwk..",
    ".kwwk.kwwk.",
    ".kwk...kwk.",
    ".kk.....kk.",
  ];
  function starCursor(fill, scale = 2) {
    const fills = { k: "#22223a", w: fill };
    let rects = "";
    STAR.forEach((row, y) => [...row].forEach((c, x) => {
      if (fills[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fills[c]}"/>`;
    }));
    const w = STAR[0].length, h = STAR.length;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
    const hx = Math.floor(w / 2) * scale, hy = Math.floor(h / 2) * scale;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}`;
  }
  const root = document.documentElement.style;
  root.setProperty("--cursor", `${starCursor("#ffffff")}, auto`);
  root.setProperty("--cursor-link", `${starCursor("#3b3bd0")}, pointer`);

  /* ---------- 2. background field ---------- */
  const cv = document.getElementById("field");
  if (cv) initField(cv);

  function initField(cv) {
    const ctx = cv.getContext("2d");
    const CELL = 4;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
    const DESK = [185, 184, 207], DESK2 = [174, 173, 198], GLOW = [214, 213, 228],
      WHITE = [246, 245, 251], BLUE = [59, 59, 208], GHOST_EDGE = [150, 148, 184];
    let W = 0, H = 0, field, img;

    function resize() {
      W = Math.ceil(innerWidth / CELL); H = Math.ceil(innerHeight / CELL);
      cv.width = W; cv.height = H;
      field = new Float32Array(W * H);
      img = ctx.createImageData(W, H);
      if (reduceMotion) render(performance.now());
    }

    const ptr = { x: 0, y: 0, active: false, last: 0, travel: 0 };
    const sparks = [];
    const ghost = { x: -100, y: -100, emit: 0 };

    function spark(x, y, vx, vy, life) {
      if (sparks.length > 220) sparks.shift();
      sparks.push({ x, y, vx, vy, age: 0, life, blue: Math.random() < 0.2 });
    }

    addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      const x = e.clientX / CELL, y = e.clientY / CELL;
      if (ptr.active) ptr.travel += Math.hypot(x - ptr.x, y - ptr.y);
      ptr.x = x; ptr.y = y; ptr.active = true; ptr.last = performance.now();
      while (ptr.travel > 3.5) {
        ptr.travel -= 3.5;
        spark(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 0.004, 0.006 + Math.random() * 0.006, 550 + Math.random() * 550);
      }
    });
    document.addEventListener("pointerleave", () => { ptr.active = false; });
    addEventListener("pointerdown", e => {
      if (reduceMotion) return;
      const x = e.clientX / CELL, y = e.clientY / CELL;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3, s = 0.025 + Math.random() * 0.03;
        spark(x, y, Math.cos(a) * s, Math.sin(a) * s, 600 + Math.random() * 300);
      }
    });

    function stamp(cx, cy, R, amt) {
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / R;
        if (d < 1) { const i = y * W + x; field[i] = Math.min(1, field[i] + amt * (1 - d) * (1 - d)); }
      }
    }

    function put(x, y, c) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2];
    }

    function render(now) {
      const d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = field[i] > BAYER[(y & 3) * 4 + (x & 3)] ? GLOW : ((x + y) & 1) ? DESK2 : DESK;
        const o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      // sparkles: a dot that blooms into a + and shrinks back, with a twinkle
      for (const s of sparks) {
        const t = s.age / s.life, c = s.blue ? BLUE : WHITE;
        const twinkle = Math.sin(s.age / 60 + s.x) > -0.6;
        if (!twinkle && t > 0.3) continue;
        put(s.x, s.y, c);
        if (t > 0.15 && t < 0.65) { put(s.x - 1, s.y, c); put(s.x + 1, s.y, c); put(s.x, s.y - 1, c); put(s.x, s.y + 1, c); }
      }
      // ghost star (idle only)
      if (ghost.x > -50) {
        const ox = Math.round(ghost.x - 5), oy = Math.round(ghost.y - 6);
        STAR.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === "w") put(ox + x, oy + y, GLOW); else if (ch === "k") put(ox + x, oy + y, GHOST_EDGE);
        }));
      }
      ctx.putImageData(img, 0, 0);
    }

    let prev = performance.now();
    function frame(now) {
      const dt = Math.min(50, now - prev); prev = now;
      const decay = Math.pow(0.92, dt / 16.7);
      for (let i = 0; i < field.length; i++) field[i] *= decay;

      const idle = !ptr.active || now - ptr.last > 3000;
      if (ptr.active && !idle) stamp(ptr.x, ptr.y, 9, 0.07);

      if (idle) {
        // the ghost star drifts slowly through the left or right margin
        const s = now / 1000;
        const side = Math.sin(s * 0.09) > 0 ? 0.1 : 0.9;
        const tx = W * (side + 0.05 * Math.sin(s * 0.6)), ty = H * (0.5 + 0.36 * Math.sin(s * 0.27));
        if (ghost.x < -50) { ghost.x = tx; ghost.y = ty; }
        ghost.x += (tx - ghost.x) * 0.02; ghost.y += (ty - ghost.y) * 0.02;
        ghost.emit += dt;
        if (ghost.emit > 260) {
          ghost.emit = 0;
          spark(ghost.x + (Math.random() - 0.5) * 10, ghost.y + (Math.random() - 0.5) * 10, 0, 0.004, 900);
        }
      } else {
        ghost.x = -100;
      }

      for (let j = sparks.length - 1; j >= 0; j--) {
        const s = sparks[j];
        s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.97; s.vy = s.vy * 0.97 + 0.00005 * dt;
        if (s.age > s.life) sparks.splice(j, 1);
      }
      render(now);
      requestAnimationFrame(frame);
    }

    resize();
    addEventListener("resize", resize);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  /* ---------- 3. data widgets ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    return res.json();
  }
  // returns fresh cache if < ttl old; otherwise fetches, falling back to stale cache on error
  async function cached(key, ttl, load) {
    let c = null;
    try { c = JSON.parse(localStorage.getItem(key)); } catch (_) {}
    if (c && Date.now() - c.t < ttl) return c.v;
    try {
      const v = await load();
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (_) {}
      return v;
    } catch (e) {
      if (c) return c.v;
      throw e;
    }
  }

  // projects
  const projEls = document.querySelectorAll("[data-projects]");
  if (projEls.length) {
    cached(`gh:${GH_USER}:repos`, HOUR, () => getJSON(`https://api.github.com/users/${GH_USER}/repos?per_page=100`)
      .then(rs => rs.map(r => ({ name: r.name, url: r.html_url, desc: r.description, lang: r.language, fork: r.fork, pushed: r.pushed_at, stars: r.stargazers_count }))))
      .then(repos => {
        repos = repos.filter(r => !r.fork).sort((a, b) => b.pushed.localeCompare(a.pushed));
        projEls.forEach(el => {
          const full = el.classList.contains("full");
          const list = repos.slice(0, +el.dataset.limit || repos.length);
          el.innerHTML = list.map(r => {
            const meta = [r.lang && r.lang.toLowerCase(), r.pushed.slice(0, 7), r.stars ? `★${r.stars}` : ""].filter(Boolean).join(" · ");
            const desc = r.desc ? esc(r.desc.trim().replace(/\.$/, "").toLowerCase()) : "";
            return full
              ? `<li><a href="${esc(r.url)}">${esc(r.name)}</a><span class="meta">${esc(meta)}</span>${desc ? `<span class="desc">${desc}</span>` : ""}</li>`
              : `<li><div><a href="${esc(r.url)}">${esc(r.name)}</a>${desc ? ` <span class="desc">— ${desc}</span>` : ""}</div><span class="meta">${esc(meta)}</span></li>`;
          }).join("");
        });
      })
      .catch(() => projEls.forEach(el => {
        el.innerHTML = `<li class="empty">couldn't reach github. <a href="https://github.com/${GH_USER}">see repos there</a>.</li>`;
      }));
  }

  // codeforces
  const RANKS = [
    [0, "newbie", "#808080"], [1200, "pupil", "#008000"], [1400, "specialist", "#03a89e"],
    [1600, "expert", "#0000ff"], [1900, "candidate master", "#aa00aa"], [2100, "master", "#ff8c00"],
    [2300, "international master", "#ff8c00"], [2400, "grandmaster", "#ff0000"],
    [2600, "international grandmaster", "#ff0000"], [3000, "legendary grandmaster", "#ff0000"],
  ];
  const rankOf = r => { let i = 0; while (i + 1 < RANKS.length && r >= RANKS[i + 1][0]) i++; return i; };

  const cfEl = document.querySelector("[data-cf]");
  if (cfEl) {
    cached(`cf:${CF_HANDLE}`, HOUR, async () => {
      const [info, hist] = await Promise.all([
        getJSON(`https://codeforces.com/api/user.info?handles=${CF_HANDLE}`),
        getJSON(`https://codeforces.com/api/user.rating?handle=${CF_HANDLE}`),
      ]);
      if (info.status !== "OK" || hist.status !== "OK") throw new Error("codeforces api error");
      const u = info.result[0];
      return {
        rating: u.rating, maxRating: u.maxRating,
        history: hist.result.map(h => ({ r: h.newRating, d: h.newRating - h.oldRating, name: h.contestName })),
      };
    }).then(cf => renderCF(cfEl, cf)).catch(() => {
      cfEl.innerHTML = `<span class="empty">couldn't reach codeforces. <a href="https://codeforces.com/profile/${CF_HANDLE}">profile</a></span>`;
    });
  }

  function renderCF(el, cf) {
    if (cf.rating == null) { el.innerHTML = `<span class="mute">unrated so far.</span>`; return; }
    const ri = rankOf(cf.rating), [, rank, color] = RANKS[ri];
    const last = cf.history[cf.history.length - 1];
    const next = RANKS[ri + 1];
    let nextHTML = "";
    if (next) {
      const base = ri === 0 ? 800 : RANKS[ri][0];
      const pct = Math.max(2, Math.min(100, ((cf.rating - base) / (next[0] - base)) * 100));
      nextHTML = `<div class="cf-next"><div class="cf-bar" title="${pct.toFixed(0)}%"><i style="width:${pct}%"></i></div>
        <span>${esc(next[1])} at ${next[0]} · ${next[0] - cf.rating} to go</span></div>`;
    }
    const delta = last ? `<span class="cf-delta" title="${esc(last.name)}" style="color:${last.d >= 0 ? "#2a7a2a" : "#b02a2a"}">${last.d >= 0 ? "▲+" : "▼"}${last.d}</span>` : "";
    el.innerHTML = `
      <div class="cf-top"><a class="cf-rating" href="https://codeforces.com/profile/${CF_HANDLE}" style="color:${color}">${cf.rating}</a>
        <span class="cf-rank" style="color:${color}">${esc(rank)}</span>${delta}</div>
      <canvas class="cf-graph" aria-label="rating history over ${cf.history.length} contests"></canvas>
      ${nextHTML}
      <span class="mute" style="font-size:11px">max ${cf.maxRating} · ${cf.history.length} contests</span>`;
    const g = el.querySelector(".cf-graph");
    drawGraph(g, cf.history.map(h => h.r));
    new ResizeObserver(() => drawGraph(g, cf.history.map(h => h.r))).observe(g);
  }

  // pixel rating graph: dithered rank bands behind a 1px line
  function drawGraph(cv, pts) {
    const S = 2, W = Math.max(20, Math.floor(cv.clientWidth / S)), H = Math.max(10, Math.floor(cv.clientHeight / S));
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const lo = Math.min(...pts, 1000) - 80, hi = Math.max(...pts) + 80;
    const yOf = r => Math.round((H - 1) - ((r - lo) / (hi - lo)) * (H - 1));
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const r = lo + ((H - 1 - y) / (H - 1)) * (hi - lo);
      const c = hex(RANKS[rankOf(r)][2]);
      const tint = c.map(v => Math.round(v * 0.3 + 255 * 0.7));
      for (let x = 0; x < W; x++) {
        const col = ((x + y) & 1) ? tint : [255, 255, 255];
        const o = (y * W + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!pts.length) return;
    ctx.fillStyle = "#22223a";
    const xs = pts.map((_, i) => pts.length === 1 ? W - 3 : Math.round(1 + (i / (pts.length - 1)) * (W - 4)));
    for (let i = 0; i < pts.length - 1; i++) {
      // bresenham between consecutive contests
      let x0 = xs[i], y0 = yOf(pts[i]); const x1 = xs[i + 1], y1 = yOf(pts[i + 1]);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += 1; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    ctx.fillStyle = "#3b3bd0";
    const lx = xs[xs.length - 1], ly = yOf(pts[pts.length - 1]);
    ctx.fillRect(lx - 1, ly - 1, 2, 2);
  }
})();
