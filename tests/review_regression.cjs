/* No renderer or layout engine: exercise the shipped logic with DOM/canvas doubles. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sourceRoot = process.env.DH_REVIEW_SOURCE || root;
let failed = 0;
let passed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, e.message); }
}
function env() {
  const nodes = new Map();
  const listeners = {};
  let context;
  const ctx = new Proxy({}, { get: (o, k) => o[k] || (k === 'measureText' ? (() => ({ width: 50 })) : k.startsWith('create') ? (() => ({ addColorStop() {} })) : (() => {})), set: (o, k, v) => (o[k] = v, true) });
  function node(tag = 'div') {
    const classes = new Set();
    const n = { tagName: tag.toUpperCase(), children: [], style: {}, dataset: {}, hidden: false, width: 640, height: 480,
      offsetWidth: 120, offsetHeight: 44, clientWidth: 640, clientHeight: 480, offsetParent: {}, scrollTop: 0, scrollHeight: 480,
      classList: { add: (...s) => s.forEach(x => classes.add(x)), remove: (...s) => s.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle(x, on) { if (on) classes.add(x); else classes.delete(x); } },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      append(...cs) { cs.forEach(c => this.appendChild(c)); },
      setAttribute(k, v) { this[k] = String(v); }, getAttribute(k) { return this[k]; }, removeAttribute(k) { delete this[k]; },
      getContext: () => ctx, addEventListener(k, f) { (this.listeners[k] ||= []).push(f); }, listeners: {},
      focus(options) { context.document.activeElement = this; this.focusOptions = options; }, contains(c) { return this === c || this.children.some(n => n.contains(c)); },
      getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 640, height: 480, bottom: 480, right: 640 }; },
      querySelectorAll() { return this.children; }, closest() { return null; }, scrollBy(o) { this.lastScroll = o; },
      setPointerCapture() {}, remove() {}, getClientRects() { return [this.getBoundingClientRect()]; },
    };
    Object.defineProperty(n, 'firstChild', { get: () => n.children[0] });
    Object.defineProperty(n, 'textContent', { get: () => n.text || '', set(v) { n.text = String(v); n.children = []; } });
    return n;
  }
  const document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
    createElement: node, createElementNS: (_ns, tag) => node(tag), createTextNode: text => ({ textContent: text }), querySelector: q => document.getElementById(q), querySelectorAll: () => [], addEventListener() {}, documentElement: node(), body: node() };
  const storage = new Map();
  context = vm.createContext({ console, URL, URLSearchParams, Set, Map, Math, JSON, Date, performance,
    document, localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    location: { search: '', protocol: 'http:', hostname: 'localhost', href: 'http://localhost/' }, navigator: {},
    matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ getPropertyValue: () => 'sans-serif', overflowY: 'auto' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {},
    Path2D: class {}, MutationObserver: class { observe() {} }, Element: Object,
  });
  context.window = context;
  context.addEventListener = (k, f) => (listeners[k] ||= []).push(f);
  context.DH = {};
  function load(file, transform = s => s) {
    const selected = fs.existsSync(path.join(sourceRoot, file)) ? sourceRoot : root;
    vm.runInContext(transform(fs.readFileSync(path.join(selected, file), 'utf8')), context, { filename: file });
  }
  return { c: context, nodes, load, listeners, node };
}
function coreEnv() { const e = env(); e.load('js/core.js'); return e; }
function worldEnv() {
  const e = coreEnv();
  e.load('js/vendor/three.min.js');
  e.c.DH.art = { text() {}, reducedMotion: () => false };
  e.load('js/hero3d.js');
  e.load('js/biomes3d.js');
  e.load('js/stage3d.js');
  e.load('js/world3d.js');
  const w = e.c.DH.world3d, T = e.c.THREE;
  Object.assign(w, { scene: new T.Scene(), heightAt: () => 0, props: new T.Group(), markers: new T.Group(), npcs: new T.Group() });
  return e;
}
function mainEnv(three = false, still = false) {
  const e = coreEnv(), d = e.c.DH;
  e.load('js/photo.js');
  const no = () => {};
  d.art = { reducedMotion: () => still };
  d.world = { buildDecor: () => [], buildNpcs: () => [], applyRoute: no, clearAroundEvents: no, PATH_H: 100, makeLayout: () => ({ camX: 0, vw: 640, z: 1 }) };
  d.hero3d = { supported: () => three };
  if (three) d.world3d = { ready: true, capturePhoto: () => e.node('canvas') };
  d.audio = new Proxy({}, { get: () => no });
  d.prepLogic = { isPrepId: () => false };
  d.prep = {};
  d.ui = new Proxy({ modalOpen: false }, { get: (o, k) => k in o ? o[k] : no });
  e.load('js/main.js', s => s.replace('  ui.init({', `  window.review = { startGame, arriveAt, closeObserve, startPhoto, closePhoto, updatePhoto, doAction, setScreen, input, drag, setPaused, updateSection, setLayout: x => layout = x }; return;\n  ui.init({`));
  e.c.__game.state.bankReady = true;
  e.c.__game.state.screen = 'play';
  e.c.__game.state.photos = [];
  return e;
}

test('rescue does not persist hidden awards', () => {
  const { c } = coreEnv(), s = c.DH.core.store;
  s.data.seen.test = { seen: 1, correct: 1 };
  const result = s.recordEnding({ risk: 100, grade: c.DH.core.gradeFor(100), completed: false, bestStreak: 5, bankIds: ['test'] });
  assert.equal(result.fresh.length, 0); assert.equal(s.data.badges.length, 0);
});
test('required rescue sentence survives verbatim', () => {
  assert.ok(coreEnv().c.DH.core.gradeFor(100).safety.includes('真的出事要立刻撥 119 或 112，不要怕丟臉。'));
});
test('legacy rescue badge removed; gender and other badges preserved', () => {
  const { c } = coreEnv();
  c.localStorage.setItem('digital-hiking.v1', JSON.stringify({ badges: ['first', 'rescue'], heroGender: 'female' }));
  c.DH.core.store.load(); c.DH.player.load();
  assert.deepEqual(Array.from(c.DH.core.store.data.badges), ['first']); assert.equal(c.DH.player.gender, 'female');
  c.DH.core.store.reset(); assert.equal(c.DH.core.store.data.heroGender, 'female');
});
test('photo occlusion restores NPCs without revealing initially hidden objects', () => {
  const { c } = worldEnv(), w = c.DH.world3d, T = c.THREE;
  const visible = new T.Group(), hidden = new T.Group(); hidden.visible = false;
  w.npcs.add(visible, hidden);
  w.clearShot(new T.Vector3(0, 0, 0), new T.Vector3(0, 0, 2), true);
  assert.equal(visible.visible, false);
  w.clearShot(new T.Vector3(), new T.Vector3(), false);
  assert.equal(visible.visible, true); assert.equal(hidden.visible, false);
});
test('rebuilding stages disposes private geometries/materials/textures once', () => {
  const { c } = worldEnv(), w = c.DH.world3d;
  const events = ['falling-rock', 'fog-junction', 'flash-flood'].map((id, i) => ({ x: 1800 + i * 1000, scenario: { id, title: id } }));
  w.buildStages(events);
  const resources = new Set();
  w.stages.traverse(n => {
    if (n.userData.parts) return;
    if (n.geometry && !n.isSprite && (n.geometry.type === 'BufferGeometry' || n.geometry.type === 'BoxGeometry')) resources.add(n.geometry);
    for (const m of [].concat(n.material || [])) {
      if (m.type === 'SpriteMaterial') resources.add(m);
      if (Array.isArray(n.material)) { resources.add(m); if (m.map) resources.add(m.map); }
    }
  });
  const counts = new Map();
  resources.forEach(r => { counts.set(r, 0); r.addEventListener('dispose', () => counts.set(r, counts.get(r) + 1)); });
  w.buildStages(events);
  assert.ok(counts.size > 10);
  assert.ok([...counts.values()].every(n => n === 1), `${[...counts.values()].filter(n => n === 0).length} resources not disposed`);
});
test('album reset removes old thumbnails, download closure and large canvases', () => {
  const e = coreEnv(); e.load('js/photo.js');
  const p = { canvas: e.node('canvas'), info: { mountain: '<img src=x>', altitude: 3000 } };
  e.c.DH.photo.showAlbum([p]); e.c.DH.photo.showAlbum([]);
  assert.equal(e.c.document.getElementById('album-thumbs').children.length, 0);
  assert.equal(e.c.document.getElementById('album-save').onclick, null);
  assert.equal(e.c.document.getElementById('album-big').width, 0);
});
test('reopening photo mode cannot call stale close handler during zoom', () => {
  const e = coreEnv(); e.load('js/photo.js');
  const p = { canvas: e.node('canvas'), info: { mountain: 'test', altitude: 1000 } };
  e.c.DH.photo.openViewer(p, { index: 1, close() {}, again() {} });
  e.c.DH.photo.showMode(false); e.c.DH.photo.showMode(true);
  assert.equal(e.c.document.getElementById('photo-mode').onclick, null);
});
test('new play session closes old observer/photo state', () => {
  const { c } = mainEnv();
  c.__game.view.observe = { ev: {}, stage: {} };
  c.__game.view.photoMode = { phase: 'show' };
  c.review.startGame();
  assert.equal(c.__game.view.observe, null); assert.equal(c.__game.view.photoMode, null);
});
test('photo entry clears held movement and background actions cannot change pose', () => {
  const { c } = mainEnv();
  c.review.input.keys.add('up'); c.review.input.joy.x = 1;
  c.review.startPhoto();
  assert.equal(c.review.input.keys.size, 0); assert.equal(c.review.input.joy.x, 0);
  c.review.doAction('drink'); assert.equal(c.__game.state.player.pose, 'idle');
});
test('observer blocks ground pointer drag', () => {
  const { c } = mainEnv();
  c.__game.view.observe = { ev: {}, stage: {} };
  c.document.getElementById('scene').listeners.pointerdown[0]({ pointerId: 7, clientX: 100, clientY: 100 });
  assert.equal(c.review.drag.id, null);
});
test('Shift+Tab does not dismiss the photograph', () => {
  const e = mainEnv();
  e.c.review.startPhoto(); e.c.__game.view.photoMode.phase = 'show';
  e.listeners.keydown.forEach(f => f({ code: 'ShiftLeft', target: e.node(), preventDefault() {} }));
  assert.ok(e.c.__game.view.photoMode);
});
test('Enter on answer explanation keeps the card open', () => {
  const e = mainEnv();
  e.c.__game.state.screen = 'card';
  e.c.__game.state.current = { done: true };
  const target = e.node('summary'); target.closest = () => target;
  e.listeners.keydown.forEach(f => f({ code: 'Enter', target, preventDefault() {} }));
  assert.equal(e.c.__game.state.screen, 'card');
});
test('no-WebGL mode can take a photo and leave viewer', () => {
  const { c } = mainEnv(false, true);
  c.review.startPhoto(); c.review.updatePhoto();
  assert.equal(c.__game.state.photos.length, 1);
  assert.equal(c.document.getElementById('photo-view').hidden, false);
  c.review.closePhoto(); assert.equal(c.__game.view.photoMode, null);
});
test('reduced motion still records the summit photo', () => {
  const { c } = mainEnv(true, true);
  c.review.updateSection();
  c.__game.state.player.x = 5340; c.review.updateSection();
  assert.ok(c.__game.state.autoPhoto);
  assert.ok(!c.__game.view.moment);
});
test('stage animals remain at ground height across repeated idle frames', () => {
  const { c } = worldEnv(), w = c.DH.world3d;
  w.buildStages([{ x: 1800, scenario: { id: 'monkey-no-feeding', title: 'test' } }, { x: 2000, scenario: { id: 'black-bear-distance', title: 'test' } }]);
  for (const st of w.stageList) {
    const animals = st.kind === 'macaques' ? st.group.children : st.group.children.slice(0, 1);
    const baseline = animals.map(m => m.position.y);
    for (let i = 0; i < 120; i++) c.DH.stage3d.update(st, { dt: 1/60, t: 1, heroX: st.ev.x, still: false, inCard: false });
    animals.forEach((m, i) => assert.ok(Math.abs(m.position.y - baseline[i]) <= 0.09));
  }
});
test('reduced-motion stage reactions stay still and leave without sinking', () => {
  const { c } = worldEnv(), w = c.DH.world3d;
  const ev = { x: 1800, done: false, scenario: { id: 'falling-rock', title: 'test' } };
  w.buildStages([ev]); const st = w.stageList[0]; ev.done = true; ev.correct = false;
  const update = () => c.DH.stage3d.update(st, { dt: .1, t: 1, heroX: ev.x, still: true, inCard: true });
  update();
  const before = st.group.children.map(m => m.position.toArray());
  update();
  assert.deepEqual(st.group.children.map(m => m.position.toArray()), before);
  c.DH.stage3d.update(st, { dt: .1, t: 1, heroX: ev.x, still: true, inCard: false });
  assert.equal(st.group.visible, false);
});
test('overlapping projected clues fall back to separate list buttons', () => {
  const e = coreEnv(); e.c.DH.art = { reducedMotion: () => false }; e.load('js/ui.js');
  const spots = e.c.document.getElementById('observe-spots');
  for (let i = 0; i < 3; i++) spots.appendChild(e.node('button'));
  e.c.DH.ui.placeObserve([{ x: 20, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 0 }]);
  assert.equal(spots.classList.contains('as-list'), true);
});
test('new observation resets panel scroll and focused decision is allowed to scroll into view', () => {
  const e = coreEnv(); e.load('js/ui.js');
  const panel = e.c.document.getElementById('observe-panel'); panel.scrollTop = 90;
  const stage = { title: '<img src=x onerror=alert(1)>', list: [{ name: 'one' }, { name: 'two' }] };
  e.c.DH.ui.openObserve(stage, () => {}, () => {});
  assert.equal(panel.scrollTop, 0);
  assert.equal(e.c.document.getElementById('observe-title').textContent, stage.title);
  assert.equal(e.c.document.getElementById('observe-title').children.length, 0);
  e.c.DH.ui.updateObserve(2, 2);
  assert.equal(e.c.document.activeElement, e.c.document.getElementById('observe-go'));
  assert.ok(!e.c.document.activeElement.focusOptions?.preventScroll);
});
test('overlay Tab and Shift+Tab wrap within visible controls', () => {
  const e = coreEnv(); e.load('js/ui.js');
  const box = e.c.document.getElementById('photo-mode');
  const first = e.node('button'), last = e.node('button'); box.append(first, last);
  let prevented = 0;
  first.focus(); e.c.DH.ui.trapFocus({ shiftKey: true, preventDefault() { prevented++; } }, 'photo-mode');
  assert.equal(e.c.document.activeElement, last);
  e.c.DH.ui.trapFocus({ shiftKey: false, preventDefault() { prevented++; } }, 'photo-mode');
  assert.equal(e.c.document.activeElement, first); assert.equal(prevented, 2);
});
function resourcesOf(root) {
  const resources = new Set();
  root.traverse(n => {
    if (n.geometry) resources.add(n.geometry);
    if (n.isInstancedMesh) resources.add(n);
    for (const m of [].concat(n.material || [])) {
      resources.add(m);
      Object.values(m).forEach(v => { if (v && v.isTexture) resources.add(v); });
    }
  });
  return resources;
}
function watchDisposal(resources) {
  const counts = new Map();
  resources.forEach(r => {
    counts.set(r, 0);
    r.addEventListener('dispose', () => counts.set(r, counts.get(r) + 1));
  });
  return counts;
}
function assertDisposal(counts, shared = new Set()) {
  assert.ok(counts.size > 0);
  counts.forEach((count, r) => assert.equal(count, shared.has(r) ? 0 : 1, `${r.type || 'Texture'} ${r.uuid}`));
}
function sharedHeroResources(c) {
  const H = c.DH.hero3d, gender = c.DH.player.gender, shared = new Set();
  for (const g of ['male', 'female']) {
    c.DH.player.gender = g;
    const a = H.build({}), b = H.build({});
    const other = resourcesOf(b);
    resourcesOf(a).forEach(r => { if (other.has(r)) shared.add(r); });
    H.dispose(a); H.dispose(b);
  }
  c.DH.player.gender = gender;
  return shared;
}
test('hero disposal frees private resources once and preserves shared resources for both genders', () => {
  const { c } = worldEnv(), H = c.DH.hero3d;
  for (const gender of ['male', 'female']) {
    c.DH.player.gender = gender;
    const a = H.build({}), b = H.build({});
    const shared = resourcesOf(b), counts = watchDisposal(resourcesOf(a));
    const face = a.userData.parts.head.userData.face;
    a.add(new c.THREE.Mesh(face.geometry, [face.material, face.material]));
    H.dispose(a);
    assertDisposal(counts, shared);
    H.pose(b, { t: 1, pose: 'cheer' });
    assert.ok(b.userData.parts.head.userData.face.material.map.isTexture);
  }
});
test('setHero disposes replaced actors and keeps unchanged actors live', () => {
  const { c } = worldEnv(), w = c.DH.world3d;
  const shared = sharedHeroResources(c);
  w.setHero({});
  const old = w.hero, counts = watchDisposal(resourcesOf(old));
  w.setHero({});
  assert.equal(w.hero, old);
  assert.ok([...counts.values()].every(n => n === 0));
  c.DH.player.gender = 'female';
  w.setHero({});
  assert.equal(old.parent, null);
  assertDisposal(counts, shared);
  assert.equal(w.hero.parent, w.scene);
});
test('actor cache eviction disposes retired actors while cached reuse stays live', () => {
  const e = worldEnv(), { c } = e, H = c.DH.hero3d;
  c.DH.art.reducedMotion = () => true;
  const colors = { jacket: '#f59e6c', pack: '#4fb3a5', hat: '#f4c76b', hatBand: '#e8785c' };
  const shared = resourcesOf(H.build({ colors })), actors = [], watches = [];
  c.THREE.WebGLRenderer = class {
    constructor() { this.domElement = e.node('canvas'); }
    setClearColor() {}
    setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }
    render(scene) {
      const actor = scene.children.find(n => n.type === 'Group').children[0];
      if (!actors.includes(actor)) { actors.push(actor); watches.push(watchDisposal(resourcesOf(actor))); }
    }
  };
  const ctx = e.node('canvas').getContext('2d');
  const draw = i => H.drawSprite(ctx, 0, 0, { colors: { ...colors, variant: i }, t: 1 });
  draw(0); draw(0);
  assert.equal(actors.length, 1);
  assert.ok([...watches[0].values()].every(n => n === 0));
  for (let i = 1; i <= 50; i++) draw(i);
  assert.equal(actors.length, 51);
  actors.slice(0, 50).forEach((actor, i) => {
    assert.equal(actor.parent, null);
    assertDisposal(watches[i], shared);
  });
  assert.ok([...watches[50].values()].every(n => n === 0));
});
test('sync disposes props, NPCs and marker instances while retaining marker textures', () => {
  const { c } = worldEnv(), w = c.DH.world3d;
  Object.assign(c.DH.art, { markerIcon: () => 'sign', icons: { sign() {} } });
  const events = [{ x: 2000, scenario: { id: 'falling-rock', title: 'rock' } }];
  const npcs = [{ kind: 'hiker', x: 1500, oy: 1, dir: 1 }, { kind: 'bear', x: 1900, oy: 2 }];
  w.sync([], npcs, events);
  const markerTextures = new Set([...resourcesOf(w.markers)].filter(r => r.isTexture));
  const groups = [w.props, w.markers, w.npcs];
  const watched = groups.map(g => watchDisposal(resourcesOf(g)));
  w.sync([], npcs, events);
  watched.forEach((counts, i) => assertDisposal(counts, resourcesOf(groups[i])));
  assert.deepEqual(new Set([...resourcesOf(w.markers)].filter(r => r.isTexture)), markerTextures);
});
test('all stage kinds dispose private resources across rebuilds and retain fog texture and sprite geometry', () => {
  const { c } = worldEnv(), w = c.DH.world3d;
  const events = c.DH.stage3d.ids.map((id, i) => ({ x: 1600 + i * 100, scenario: { id, title: id } }));
  w.buildStages(events);
  const soft = [...resourcesOf(w.stages)].find(r => r.isTexture && c.DH.stage3d.isSharedTexture(r));
  assert.ok(soft);
  for (let i = 0; i < 3; i++) {
    const counts = watchDisposal(resourcesOf(w.stages));
    w.buildStages(events);
    assertDisposal(counts, resourcesOf(w.stages));
    assert.ok(resourcesOf(w.stages).has(soft));
  }
});
test('stage sphere allocation is lazy, reused within a stage, and owned by that stage', () => {
  const { c } = worldEnv(), w = c.DH.world3d, T = c.THREE;
  const Original = T.IcosahedronGeometry;
  let allocated = 0;
  T.IcosahedronGeometry = class extends Original { constructor(...args) { super(...args); allocated++; } };
  const ev = { x: 2000, scenario: { id: 'unknown', title: 'unknown' } };
  const kit = w.stageKit(ev);
  w.buildStages([ev]);
  assert.equal(allocated, 0);
  assert.equal(kit.geoSphere, kit.geoSphere);
  assert.equal(allocated, 1);
  assert.notEqual(w.stageKit(ev).geoSphere, kit.geoSphere);
  assert.equal(allocated, 2);
});
test('resource teardown restores temporary visibility before removing tracked objects', () => {
  const { c } = worldEnv(), w = c.DH.world3d, T = c.THREE;
  for (const [group, clear] of [
    ['props', () => w.sync([], [], [])],
    ['stages', () => w.buildStages([])],
    ['extras', () => w.leaveEnding()],
  ]) {
    w[group] ||= new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
    w[group].add(mesh);
    let restored = false;
    w.restoreShot = () => { if (mesh.parent) restored = true; };
    mesh.geometry.addEventListener('dispose', () => assert.ok(restored));
    clear();
    assert.equal(mesh.parent, null);
    assert.ok(restored);
  }
});
test('ending replacement and exit dispose extras, shared material arrays and instanced meshes once', () => {
  const { c } = worldEnv(), w = c.DH.world3d, T = c.THREE;
  c.DH.art.reducedMotion = () => true;
  Object.assign(w, { extras: new T.Group(), camera: new T.PerspectiveCamera(),
    resize() {}, applySky() {}, placeSun() {}, updateRain() {}, renderer: { render() {} } });
  const g = { tier: 'bad', player: { x: 3000 }, t: 1 };
  w.renderEnding(null, 640, 480, g);
  const first = resourcesOf(w.extras), firstCounts = watchDisposal(first);
  w.endingTier = null;
  w.renderEnding(null, 640, 480, g);
  const second = resourcesOf(w.extras);
  assertDisposal(firstCounts, second);
  const shared = new Set([...first].filter(r => second.has(r)));
  const previous = watchDisposal(second);
  g.tier = 'good';
  w.renderEnding(null, 640, 480, g);
  assertDisposal(previous, shared);
  assert.equal(w.heli, null);
  const tex = new T.Texture(), geo = new T.BoxGeometry(), mat = new T.MeshStandardMaterial({ map: tex, normalMap: tex });
  w.extras.add(new T.InstancedMesh(geo, [mat, mat], 2), new T.Mesh(geo, mat));
  const ending = watchDisposal(resourcesOf(w.extras));
  w.leaveEnding(); w.leaveEnding();
  assertDisposal(ending);
  assert.equal(w.extras.children.length, 0);
});

console.log(`${passed} passed, ${failed} failed (logic only; no WebGL renderer or CSS layout)`);
process.exitCode = failed ? 1 : 0;
