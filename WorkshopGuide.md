# Capture the Crown: workshop guide

A 30-minute ACM@UC meeting for up to 32 players: play together, trace a network message, edit a
strategy, then compete. Members need a browser and a text editor. The host
needs Node.js 24 or newer.

## Before the meeting

1. Connect the host and players to a network that allows device-to-device traffic.
2. On the host, run `npm ci`, `npm run build`, then `npm start`.
3. Find the host's LAN IPv4 address with `ipconfig` on Windows or network settings
   on macOS/Linux. Share `ws://HOST_LAN_IP:3000`.
4. Give each player a copy of the **entire `dist/client/` folder**. They open its
   `index.html`, enter a name and the shared address, then click **Let me in**.
5. Test with two computers before the meeting. Check firewall access and whether
   the Wi-Fi permits connections between devices.

Keep the server terminal running. Players do not need Node or npm. See the
[README](README.md) for full host setup, client instructions, and troubleshooting.

## Run of show

| Time      | Activity                                                                             |
| --------- | ------------------------------------------------------------------------------------ |
| 0–3 min   | Join and play. Find your red player and collect a crown.                             |
| 3–7 min   | Open **Watch the messages**. Explain client, server, WebSocket, and JSON.            |
| 7–11 min  | Trace a key press through input, the server tick, and the canvas renderer.           |
| 11–19 min | Edit `strategy.js`, refresh, rejoin, and enable **Run my code**.                     |
| 19–20 min | Save and freeze edits. Restart the server and have everyone rejoin for fresh scores. |
| 20–27 min | Run the competition. The facilitator calls the start and finish.                     |
| 27–30 min | Read the standings and ask members how their strategies work.                        |

If joining takes longer, shorten the source walkthrough to protect the coding time.

## Trace one move

The browser requests a direction:

```json
{ "type": "input", "dx": 1, "dy": 0 }
```

`client/input.ts` reads controls. `client/networking.ts` sends the message.
`shared/protocol.ts` validates messages on both sides. `server/networking.ts`
accepts the request, and `server/game.ts` applies it on the next tick.

The server runs at 20 ticks per second. Each tick moves players, checks crown
pickups, and broadcasts a `state` message. `client/renderer.ts` draws that
state. The server owns positions and scores; browsers request movement.

Open **Watch the messages** to inspect the last sent and received JSON. Turn
off **Live updates** to hold a message on screen. Movement pauses while a
dialog is open. The clock difference includes differences between the two
computers' clocks; it is not round-trip ping.

For terminal-level message logging, restart the host server with
`DEBUG_NETWORK=1`. In PowerShell:

```powershell
$env:DEBUG_NETWORK = "1"
npm start
```

## Coding challenge: chase crowns

Players edit `strategy.js` beside the `index.html` in their own client folder.
The starter `chooseDirection(state, me)` heads toward the nearest crown.
Return an object with `dx` and `dy`, each one of `-1`, `0`, or `1`:

```js
return { dx: 1, dy: 0 }; // right
```

`me` contains your player's position and score. `state.players` contains all
players, and `state.coins` contains the ten crowns with their IDs and positions.
Each crown you touch earns one point and respawns elsewhere.

Try a change:

- Choose a crown another player is less likely to reach first.
- Compare horizontal, vertical, and diagonal routes.
- Keep chasing one target until it respawns instead of changing targets every tick.

Save, refresh, rejoin, then check **Run my code**. Uncheck it to return to
manual controls. Invalid return values or thrown errors stop movement and show
an error beside the strategy control. The server still decides movement and
scoring.

## Optional: change the game from source

These exercises need a repository copy and Node.js 24+. Run `npm ci`, then
`npm run dev:server` and `npm run dev` in separate terminals. Open the address
Vite prints. Use localhost on the server PC, or its LAN/VPN address on another device.

| Change                                        | File                                               |
| --------------------------------------------- | -------------------------------------------------- |
| Player colors, crown shapes, or canvas labels | `client/renderer.ts`                               |
| Interface text and panels                     | `client/components/`                               |
| Layout and typography                         | `client/styles.css`                                |
| Strategy copied into the build                | `public/strategy.js`                               |
| Tick rate or arena settings                   | `server/constants.ts`                              |
| A new message type                            | `shared/protocol.ts`, then its sender and receiver |

Client changes update through Vite. Server changes restart the development
server and reset scores. Run `npm run check` after source changes, and
`npm run build` before distributing the updated `dist/client/` folder.
Keep edits to the distributed `strategy.js` outside that build folder before
rebuilding; a build replaces its contents.

## Competition

1. Save and freeze code changes.
2. Restart the host server, then have everyone refresh and rejoin. Scores start at zero.
3. Announce the start. Manual controls and strategies both count.
4. Announce the finish and have everyone stop. Read the live standings together.

Equal scores share a rank. The game has no round timer, so the facilitator
sets the play window. Recognize the top score, an interesting strategy, and
someone who helped another player get connected.

## Questions for the room

- Which computer knows the real score?
- Why does the client send a direction instead of a new position?
- What happens when two players reach the same crown?
- How does your strategy choose its next target?
- What would change if the server tick rate were two instead of twenty?
