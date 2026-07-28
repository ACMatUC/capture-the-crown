# Workshop Guide: Networking Fundamentals with Capture the Crown

This guide is for instructors and students working through the 60-minute
workshop. It assumes students know basic JavaScript but have never used
WebSockets or built anything multiplayer/real-time before.

The game is not the lesson. The game is a visible, pokeable demonstration
of a client-server networking system. Every section below ties a concept
back to a specific file and line of code you can open right now.

---

## 1. Client-server architecture

In this project there are two kinds of programs:

- **One server** (`server/server.js` and friends) — a single Node.js
  process on one university PC that is the source of truth for the entire
  game world.
- **Many clients** — browser pages opened from `public/index.html` on
  other university PCs. Each client connects to
  `ws://<SERVER_IP>:<PORT>`, where `<SERVER_IP>` is the server PC's LAN IP.

Clients never talk to each other directly. They only talk to the server.
The server decides what's true (where everyone is, who has the crown,
what the score is) and tells every client. This is called a
**client-server** architecture, as opposed to **peer-to-peer**, where
clients would talk directly to one another.

**Why use a server at all?** Try to imagine the alternative: if each
client tracked its own position and just broadcast it to every other
client, what stops one client from lying about its position, or claiming an
impossibly high score? A server gives you one place to enforce the rules.

---

## 2. Request/response vs. real-time communication

Opening `public/index.html` in your browser loads local static files. That
initial page load is separate from the networked game. The actual
multiplayer connection begins only when the browser opens a WebSocket to
the server PC.

That model doesn't work well for a multiplayer game, where the server
needs to push new information (another player moved!) to your browser
*without* your browser having to ask for it first. That's what
**WebSockets** are for — see the next section.

---

## 3. WebSockets

A WebSocket connection starts as a normal HTTP request that gets
"upgraded" into a persistent, two-way connection. Once open:

- Either side (client or server) can send a message at any time.
- Messages arrive without the other side having to ask/poll for them.
- The connection stays open until explicitly closed.

In this project:

- **Server side:** `server/networking.js` uses the `ws` library to accept
  LAN connections (`new WebSocket.Server(...)`) and send/receive messages.
- **Client side:** `public/networking.js` uses the browser's built-in
  `WebSocket` object (`new WebSocket(serverUrl)`) — no library needed at
  all, it's part of every modern browser.

Open your browser's DevTools → Network tab → filter by "WS" while playing
to see the raw WebSocket connection and its frames.

---

## 4. JSON messages

WebSockets transmit raw text (or binary) — they have no built-in concept
of "messages" with structure. We impose that structure ourselves by
agreeing that every message is a JSON object with a `type` field.

- `JSON.stringify(obj)` turns a JS object into text before sending —
  called **serialization**.
- `JSON.parse(text)` turns received text back into a JS object — called
  **deserialization**.

Every message type this project uses is documented in
`server/protocol.js` (and mirrored, from the client's point of view, at
the top of `public/networking.js`). Read that file start to finish before
touching any other code — it's the contract everything else depends on.

---

## 5. Client → server: sending input

The client is only ever allowed to send two kinds of messages:

- `join` — once, when you click "Connect & Join" (`public/networking.js`,
  `connectToServer`)
- `input` — whenever your held movement keys change
  (`public/input.js`, `updateAndSendInput`)

Notice `input` messages say "I want to move this direction," never "I am
now at this position." The client makes a *request*; it never asserts a
*fact* about the world.

---

## 6. Server → client: receiving synchronized state

`server/game.js` runs a loop 20 times per second (`TICK_RATE` in
`server/constants.js`) that:

1. Moves every player according to their last known input.
2. Checks if anyone touched the crown.
3. Builds one JSON snapshot of the whole world (`getStateSnapshot()`).
4. Broadcasts that snapshot to every connected client as a `state`
   message.

Every client receives the *exact same* `state` message at roughly the
same time. That shared broadcast is what "synchronization" means in
practice — nobody's screen is a special case.

---

## 7. Server-authoritative game state

"Server-authoritative" means the server's copy of the game world is the
only one that counts. Look at `public/renderer.js`'s `drawFrame()`: it
does not calculate anything, it only draws exactly what the last `state`
message said. If you disconnect your network (or the server crashes), the
canvas simply freezes — nothing on screen can move without the server
saying so first. That's a deliberate, visible proof of server authority
you can demonstrate live.

Compare this to `server/player.js`'s `movePlayer()` — the *only* function
in the entire codebase that changes a player's `x`/`y`, and it only runs
inside the server's tick loop.

---

## 8. How multiple clients stay synchronized

Because every client redraws itself purely from the most recently
received `state` broadcast, and every client receives the same
broadcasts, all client PCs converge on the same picture of the world —
usually within one tick (50ms at the default 20Hz tick rate) of each
other. There's no negotiation between clients and no merging of
conflicting data, because clients never had authority over the data in
the first place.

---

## 9. Reading and modifying networking code

The whole project is intentionally split so that "networking" and "game
rules" never live in the same function:

| Concern | Server file | Client file |
|---|---|---|
| Owns the socket / sends & receives messages | `server/networking.js` | `public/networking.js` |
| Defines what messages look like | `server/protocol.js` | (documented in `public/networking.js`) |
| Game rules (movement, scoring) | `server/game.js`, `player.js`, `crown.js` | — (client has no rules) |
| Drawing / UI | — (server draws nothing) | `public/renderer.js`, `debug.js`, `main.js` |

When you want to see "what happens when a player moves," you should be
able to answer it by reading exactly two files:
`public/input.js` (send) and `server/game.js` + `server/player.js`
(receive & apply).

---

## 10. Debugging networking applications

Two tools are built into this project specifically for debugging:

- **The server terminal** — every message in or out is logged as
  `[SEND]`/`[RECV]` with its full JSON, from `server/networking.js`'s
  `logDebug()`.
- **The in-browser Network Debug panel** — connection status, your player
  id, ping, live counters, and the literal last message sent/received, all
  driven by `public/debug.js`.

When something isn't working, the standard debugging move in this
project is: **compare what was actually sent against what the receiving
side expects**, using these two panels side by side. This mirrors real
network debugging, where you'd reach for a tool like a browser's Network
tab or `wireshark` to inspect actual traffic rather than guessing.

---

## Project walkthrough (suggested live-code order)

1. `server/protocol.js` — what messages exist
2. `server/server.js` — how the server starts
3. `server/networking.js` — how connections and messages are handled
4. `server/game.js` + `player.js` + `crown.js` — the authoritative loop
5. `public/networking.js` — how the client connects and sends/receives
6. `public/input.js` — turning keystrokes into an `input` message
7. `public/renderer.js` — turning a `state` message into pixels
8. `public/debug.js` + `main.js` — tying it all together, and how to see
   it happen live

---

## Message flow, end to end

```
   CLIENT PC A                       SERVER                     CLIENT PC B
        |                               |                               |
        |------ join {name:"Alice"} --->|                               |
        |<----- welcome {id} -----------|                               |
        |                               |<---- join {name:"Bob"} -------|
        |                               |------ welcome {id} ---------->|
        |<----- playerJoined -----------|------ playerJoined ---------->|
        |                               |                               |
        |------ input {dx:1,dy:0} ----->|                               |
        |                               |  (tick loop moves Alice)      |
        |<----- state {...} ------------|------ state {...} ----------->|
        |<----- state {...} ------------|------ state {...} ----------->|
        |                (repeats ~20 times per second forever)         |
```

---

## Suggested 60-minute timeline

| Time | Activity |
|---|---|
| 0–5 min | Start one server PC with `npm install && npm start`, open `public/index.html` on 2–3 client PCs, connect them to `ws://<SERVER_IP>:3000`, and just play. Frame the question: "how did that just happen?" |
| 5–15 min | Sections 1–4 above: client-server, request/response vs real-time, WebSockets, JSON. Live-code walkthrough of `protocol.js`. |
| 15–25 min | Sections 5–6: walk through `input.js` → `server/networking.js` → `game.js` → back out to `state`. Show the server terminal's SEND/RECV logs live. |
| 25–35 min | Sections 7–8: server authority + synchronization. Demo: disconnect wifi/kill the server and show the canvas freeze. |
| 35–50 min | Hands-on: students work through Exercises #1–#6 individually or in pairs. |
| 50–58 min | Hands-on: Exercise #9 (intentionally break a message, then fix it) as a group debugging exercise using both debug panels. |
| 58–60 min | Wrap-up + questions. |

Adjust freely — if your group is faster, add Exercises #7, #8, #10.

---

## Exercise reference

All exercises are marked in the code with:

```
// ==========================================================
// WORKSHOP EXERCISE #N
// ==========================================================
```

| # | File | What it teaches |
|---|---|---|
| 1 | `public/networking.js` | Reading an incoming message type you haven't handled yet (`playerJoined`/`playerLeft`) — practice with `handleIncomingMessage`. |
| 2 | `public/input.js` | Seeing what it would take to add a new field to an outgoing message, and tracing where it would need to be read on the server. |
| 3 | `public/renderer.js` | Using data the server *could* send (a timestamp) to drive a purely visual effect. |
| 4 | `public/main.js` | Displaying a value that already arrives in a message (`welcome`) but isn't shown anywhere yet. |
| 5 | `server/constants.js` | Feeling the effect of `TICK_RATE` firsthand — how often the server pushes state. |
| 6 | `server/crown.js` | Confirming that pickup rules are 100% server-side by exaggerating `CROWN_PICKUP_DISTANCE`. |
| 7 | `public/renderer.js` | The difference between data (from the server) and presentation (drawing choices made only on the client). |
| 8 | `public/debug.js` | Computing and displaying a new derived metric (message size) from data already available. |
| 9 | `public/input.js` | Intentionally breaking the `input` message's field names, then using both debug panels to diagnose and fix it. |
| 10 | `server/game.js` + `server/player.js` | Adding a brand-new field to the `state` message end-to-end, from server data to client display. |

Exercises are designed so none of them require modifying server-side
*networking* infrastructure (`server/networking.js`, `server/protocol.js`
validation) — only game data, client display, or tunable constants.
