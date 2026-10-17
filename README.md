# Orbital — 3D Solar System flight lab

Play at **https://lncubus.github.io/nss/**.

A desktop browser game with eight planets at real orbital distances, Newtonian starships, and one or two local pilots. Open `dist/index.html` directly; there is no build step or package installation. Google Fonts are optional; system fonts work offline.

## Controls

- Player 1: W/S thrust, A/D yaw, Q/E vertical thrust.
- Player 2: arrow keys for thrust/yaw, Page Up/Down for vertical thrust.
- Drag to rotate the camera; scroll to zoom.
- Inner system, All planets, and Follow ship select viewing ranges.
- Space pauses; R resets. Select Two pilots for local multiplayer.
- True sizes displays physical body radii; distant planets may be smaller than a pixel.

## Physics

Distances are AU (149,597,870.7 km); time is days since J2000; masses are solar masses. All eight planets follow inclined elliptical Kepler orbits with approximate J2000 mean elements. The Sun is fixed. This is not a live ephemeris or a full planetary N-body integration; moons and planetary mutual perturbations are omitted.

Ships feel 3D inverse-square gravity from the Sun and every planet, integrated with velocity Verlet. Visual planet radii are enlarged by default; gravity and collision checks use physical quantities. Forecasts assume no thrust. Ships start near Earth with its orbital velocity.

## Validation

Run `node --check dist/game.js` and `node tests/physics.cjs` from the repository root. The physics checks cover orbital bounds, 3D gravity, stable initial flight, vertical thrust, local multiplayer, and collision recovery. These checks do not replace visual browser testing.

## Publishing

Source lives in `lncubus/nss-cloud`. The three files in `dist/` are published unchanged to `nss/` on the `master` branch of `lncubus/lncubus.github.io`, whose existing GitHub Pages deployment serves them. Keep the relative asset paths so the game works under `/nss/`.

To update, copy `dist/index.html`, `dist/game.js`, and `dist/style.css` into that repository's `nss/` directory, commit, and push. Other site content should be preserved.
