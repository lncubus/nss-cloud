const fs = require('fs');
const vm = require('vm');
const elements = {};
function el(id) {
  return elements[id] ??= {
    checked: true, addEventListener() {}, style: {}, classList: { toggle() {}, remove() {} },
    replaceChildren() {}, append() {}, setAttribute() {},
    getBoundingClientRect() { return { width: 900, height: 700 }; },
    getContext() { return {}; }, textContent: ''
  };
}
const sandbox = {
  document: { getElementById: el, createElement: () => el('span'), createTextNode: x => x, querySelectorAll: () => [], querySelector: () => el('viewport'), addEventListener() {} },
  window: { addEventListener() {}, matchMedia: () => ({matches: false}) }, performance: { now: () => 0 },
  requestAnimationFrame() {}, console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('dist/game.js', 'utf8') + `
const assert = (v, message) => { if (!v) throw Error(message); };
assert(planets.length === 8, 'Eight planets');
assert(Math.abs(planets[7].r - 30.11) < .01, 'Neptune AU');
for (const p of planets) {
  const b = bodyAt(p, 0), r = Math.hypot(b.x, b.y, b.z);
  assert(r >= p.r * (1 - p.e) - 1e-8 && r <= p.r * (1 + p.e) + 1e-8, 'Elliptical radial bounds');
}
const g = gravity(1, 0, 0, 1);
assert(g.ax < 0 && g.az < 0, '3D gravity');
for (let n = 0; n < 5000; n++) step(.002);
assert(Number.isFinite(ships[0].z), 'Finite flight');
assert(ships[0].crashes === 0, 'Stable initial flight');

function flightWith(pressed, pitch = 0) {
  keys.clear(); mode(true);
  ships.forEach(s => { s.orientation = [Math.cos(pitch/2),0,-Math.sin(pitch/2),0]; });
  pressed.forEach(key => keys.add(key));
  step(.002);
  return ships.map(s => ({...s}));
}
const coast = flightWith([]);
const reverse = flightWith(['KeyS', 'ArrowDown']);
for (let i = 0; i < 2; i++) {
  assert(reverse[i].burn === 0, 'Former reverse controls must leave engine off');
  for (const prop of ['x', 'y', 'z', 'vx', 'vy', 'vz']) {
    assert(reverse[i][prop] === coast[i][prop], 'Former reverse controls must match coasting: ' + prop);
  }
}
const turnOnly = flightWith(['KeyQ', 'PageUp']);
for (let i = 0; i < 2; i++) {
  assert(forwardDirection(turnOnly[i]).z > 0 && turnOnly[i].burn === 0, 'Pitch steering without engine burn');
  for (const prop of ['vx', 'vy', 'vz']) {
    assert(turnOnly[i][prop] === coast[i][prop], 'Pitch steering must not apply propulsion');
  }
}
const forward = flightWith(['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown']);
for (let i = 0; i < 2; i++) {
  assert(forward[i].burn === 1, 'Forward engine for both players');
  assert(forward[i].vx > coast[i].vx, 'Engine accelerates along heading');
}
const pitchedCoast = flightWith([], Math.PI / 2);
const pitchedBurn = flightWith(['KeyW', 'ArrowUp'], Math.PI / 2);
for (let i = 0; i < 2; i++) {
  assert(pitchedBurn[i].vz > pitchedCoast[i].vz, 'Forward engine follows vertical orientation');
}
// Equal rates and full turns about either local steering axis.
const identity = () => ({orientation: [1,0,0,0]});
const pitchLoop = identity(), yawLoop = identity();
for (let n = 0; n < 400; n++) {
  rotateShip(pitchLoop,0,1,Math.PI/400);
  rotateShip(yawLoop,1,0,Math.PI/400);
  if (n === 199) assert(forwardDirection(pitchLoop).x < -.999, 'Pitch passes vertical into inverted flight');
}
assert(forwardDirection(pitchLoop).x > .999999, 'Pitch completes a full loop');
assert(forwardDirection(yawLoop).x > .999999, 'Yaw completes a full loop');
const atPole = identity();rotateShip(atPole,0,1,Math.PI/4);
const beforeYaw = forwardDirection(atPole);rotateShip(atPole,1,0,.1);
assert(Math.abs(forwardDirection(atPole).y-beforeYaw.y) > .1, 'Local yaw remains effective when pointed vertically');
const mixed = identity();
for(let n=0;n<10000;n++)rotateShip(mixed,.7,.9,.002);
assert(Math.abs(Math.hypot(...mixed.orientation)-1)<1e-12,'Orientation remains normalized');
const invertedCoast = flightWith([],Math.PI), invertedBurn = flightWith(['KeyW','ArrowUp'],Math.PI);
assert(invertedBurn[0].vx < invertedCoast[0].vx,'Forward engine follows ship after a half-loop');
keys.clear();
ships[0].x = ships[0].y = ships[0].z = 0;
ships[0].vx = ships[0].vy = ships[0].vz = 0;
step(.002);
assert(ships[0].crashes === 1, 'Collision recovery');
console.log('PASS: orbital bounds, 3D gravity, stable flight, forward-only propulsion for both pilots, pitch steering without thrust, full loops and local-axis steering, pitched forward burn, collision recovery');
`, sandbox);
