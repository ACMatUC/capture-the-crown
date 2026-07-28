# Capture the Crown

A tiny browser multiplayer game built for one purpose: teaching the
fundamentals of real-time networking with WebSockets. The "game" itself is
deliberately trivial (move a circle, touch a crown, score a point) so that
every line of interesting code is about **networking**, not game
development.

This version is a true LAN client-server workshop app:

- One university PC runs the WebSocket server only.
- Multiple university PCs open the browser client only.
- The client never starts, embeds, or depends on a local server.
- The server is the single authority for all shared game state.
- All communication is WebSocket traffic to `ws://<SERVER_IP>:<PORT>`.
- No cloud services, tunneling, NAT traversal, or peer-to-peer networking
  are used.

If you're looking for the workshop lesson plan and concept explanations,
see **[WorkshopGuide.md](./WorkshopGuide.md)**. This file just covers
running the project.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer on the server PC
- Any modern browser on each client PC
- All PCs connected to the same university network
- One open LAN port, default `3000`
- No database, no build tools, no bundler

## Installation

From the `capture-the-crown` folder on the server PC:

```bash
npm install
```

This installs one runtime dependency:

- `ws` — a minimal, raw WebSocket library for the Node.js server

The client PCs only need the `public/` folder and a browser.

## Starting The Server PC

On exactly one PC, run:

```bash
npm start
```

Optionally choose another port:

```bash
PORT=4000 npm start
```

The server binds to `0.0.0.0:<PORT>`, which means it listens on the
server PC's LAN network interfaces. You should see:

```text
=================================================
 Capture the Crown -- WebSocket server
=================================================
Binding to ws://0.0.0.0:3000
Clients must connect to ws://<SERVER_LAN_IP>:3000
Use the server PC's LAN IP, not localhost or 127.0.0.1.
Watch this terminal for SEND/RECV network logs.
=================================================
 Server is listening for LAN WebSocket clients
=================================================
```

Find the server PC's LAN IP address, such as `10.x.x.x` or
`192.168.x.x`. Do not give students `localhost` or `127.0.0.1`; those
addresses point back at each student's own machine.

## Starting Client PCs

On each client PC:

1. Copy or open the `public/index.html` file in a browser.
2. In the server address field, enter `ws://<SERVER_IP>:<PORT>`.
3. Enter a player name.
4. Click **Connect & Join**.

Example:

```text
ws://10.25.14.83:3000
```

Every client connects directly to the same server PC over the university
LAN. Clients can be opened before the server starts; they will show
`disconnected` until the server is running and the student clicks
**Connect & Join** again.

You can also prefill the server field with a query string:

```text
public/index.html?server=ws://10.25.14.83:3000
```

## Project Structure

```text
capture-the-crown/
  package.json          npm metadata + server dependency
  README.md             this file
  WorkshopGuide.md      concepts, timeline, and exercise walkthroughs

  server/               everything that runs on the server PC in Node.js
    server.js           entry point: starts the WebSocket server on 0.0.0.0
    networking.js       WebSocket connection handling, message routing
    game.js             the authoritative game loop (20 ticks/second)
    protocol.js         documents & validates every message type
    player.js           player data + movement
    crown.js            crown data + pickup detection
    constants.js        tunable numbers (speed, tick rate, arena size)

  public/               browser-only client files for each client PC
    index.html          page structure (server field + join/game screens)
    styles.css          visual styling
    main.js             wires all client files together
    networking.js       owns the browser's WebSocket connection
    input.js            keyboard -> "input" messages
    renderer.js         draws the current state onto <canvas>
    debug.js            the on-page network debug panel
```

## Troubleshooting

**Client shows "disconnected" and never joins**
Confirm the server terminal says it is listening. Check that the client
entered the server PC's LAN IP and the same port, for example
`ws://10.25.14.83:3000`.

**A student used localhost**
That will not connect to the workshop server. `localhost` and
`127.0.0.1` always mean "this same computer," so on a client PC they point
at the client PC, not the server PC.

**Port 3000 already in use on the server PC**
Start the server on a different port:

```bash
PORT=4000 npm start
```

Then clients must enter the matching address, such as
`ws://10.25.14.83:4000`.

**Some clients connect and others do not**
Make sure every client is on the same university network and is using the
same `ws://<SERVER_IP>:<PORT>` address. Also check whether the server PC's
local firewall asks for permission to allow incoming connections.

**Movement feels laggy**
This can be a genuinely useful teaching moment: check
`server/constants.js`'s `TICK_RATE`. If someone changed it low during
Workshop Exercise #5 and forgot to change it back, that's why.

**I changed server code but nothing happened**
The Node.js server does not hot-reload. Stop it with `Ctrl+C` in its
terminal and run `npm start` again after any change to files inside
`server/`. Changes to files inside `public/` only need a browser refresh.
