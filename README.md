# Ember Ridge Airlift

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Dedypol22/best-flight-game-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Dedypol22/best-flight-game-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A warm-island bush-pilot campaign: fly a six-ring route, deliver village supplies, then bring the aircraft home to the coastal strip.

## Play

Run `node serve.ts` from this repository and open <http://127.0.0.1:8080> in a desktop browser. The game is offline and uses only Canvas 2D and procedural WebAudio.

- **W / S** — throttle up / down
- **Arrow keys** — pitch and bank; **A / D** also bank
- **Mouse** — gentle steering in chase view
- **Space** — drop a crate near a target, otherwise toggle flaps
- **C** — chase / cockpit camera; **P** pause; **M** mute; **R** restart
- Choose sorties with the title-screen buttons (or 1 / 2 / 3)

Three sorties share a fuel and damage model: Ring Run, Cargo Drop, and Island Return. The aircraft needs careful speed management to clear the route and make a safe runway stop.

Deterministic render states are available at `?shot=start|play|ring|land&seed=1`.
