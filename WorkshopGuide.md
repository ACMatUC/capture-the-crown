# Capture the Crown: 30-Minute Club GBM

This is a play-first, beginner-friendly General Body Meeting for a student
club. Members will play a tiny multiplayer game, learn how browsers and
servers communicate in real time, and make one visible code change they can
demo before leaving.

The project is intentionally small: one Node.js server, several browser
clients, and raw WebSocket messages. No database, framework, or cloud account
is needed.

## What members should leave knowing

By the end, a member should be able to:

1. Explain the difference between a browser client and the authoritative
   server.
2. Point to a client-to-server `input` message and a server-to-client `state`
   message.
3. Make and demo a small visual change in `public/renderer.js`.

No previous networking experience is required. Basic JavaScript familiarity is
helpful, but the activity is designed so members can copy a starter change and
then experiment.

## Before the GBM

### Organizer checklist

- Choose one laptop as the server PC and connect every laptop to the same LAN.
- Install Node.js 18+ on the server PC.
- Clone or copy this repository to the server PC.
- Run `npm install` once.
- Find the server PC's LAN IP address. Do not use `localhost`.
- Bring one backup copy of the project and a screenshot of the expected game.
- If the university network blocks device-to-device traffic, use a small
  private hotspot/router approved by your club or IT policy.

### Start the server

On the server PC:

```bash
npm install
npm start
```

The terminal prints the port and reminds you to use the server PC's LAN IP.
Keep this terminal visible: its `[SEND]` and `[RECV]` logs are useful teaching
material.

On every client PC, open `public/index.html` in a modern browser. Enter:

```text
ws://SERVER_LAN_IP:3000
```

Then enter a name and click **Let me in**. If the browser cannot connect,
check the IP, port, shared network, and firewall prompt on the server PC.

## The 30-minute run of show

| Time | Activity | Facilitator move |
|---|---|---|
| 0-3 min | Welcome and play | Put members in the arena immediately. Ask, “What do you think is happening between these screens?” |
| 3-7 min | Two-minute networking reveal | Explain client, server, WebSocket, and JSON using the live debug panel. Avoid a long lecture. |
| 7-11 min | Trace one move | Open `public/input.js`, `server/networking.js`, `server/game.js`, and `public/renderer.js`. Follow one key press to one visible move. |
| 11-19 min | Individual build challenge | Members edit `public/strategy.js`, enable strategy mode, and test whether their code reaches crowns faster; optional visual changes stay in `public/renderer.js`. |
| 19-20 min | Code freeze | Ask everyone to save, refresh, and stop editing. Announce that the competition leaderboard is now live. |
| 20-27 min | Open-play competition | Members chase crowns. Call out the leaderboard, encourage fair play, and announce the final standings at the end. |
| 27-30 min | Awards and takeaway | Recognize the top scorer and creative builds, then re-state server authority and collect next-feature ideas. |

If setup takes longer, skip the file walkthrough before skipping build time.
The best GBM outcome is that every member gets a working result and a chance
to compete with it.

## The live explanation

Use the game to explain three ideas:

### 1. The client asks; the server decides

When a member presses a key, `public/input.js` sends a small message such as:

```json
{ "type": "input", "dx": 1, "dy": 0 }
```

It does not send a new position or score. The server applies the request in
its fixed tick loop. This prevents a client from claiming an impossible
position or score.

### 2. The server broadcasts the shared state

About 20 times per second, `server/game.js` moves players, checks all ten
coins, and broadcasts a `state` message containing every player's position
and score plus every coin's position. Each browser draws the latest state.
That is why everyone sees the same coins and players.

### 3. Network traffic is observable

The **Network Debug** panel shows the connection, ping, message counters, and
last JSON messages. Ask members to watch `input` appear when they press or
release a movement key, then watch `state` arrive from the server.

## Individual build challenge

### Competition starter: write a coin-chasing strategy

Open `public/strategy.js`. The starter `chooseDirection(state, me)` chooses
the nearest coin from `state.coins` and returns a legal direction. After
joining, check **Run my code**. Your code now chooses the movement
requests sent to the server, so better decisions can produce more points.

Try improving the strategy by:

- Choosing horizontal or vertical movement based on which distance is larger.
- Avoiding another player when they are closer to a coin.
- Choosing a safer coin instead of always choosing the nearest one.

The strategy can inspect state, but it can only return `{ dx, dy }`, with each
value in `-1`, `0`, or `1`. The server remains authoritative: it decides the
actual movement, collision, and score. Do not edit the server or send fake
positions/scores during the competition.

### Starter: make score visible on the player

Open `public/renderer.js` and find `drawPlayer`. Replace:

```js
const radius = 16;
```

with:

```js
const radius = 16 + player.score * 2;
```

Refresh the page and collect a coin. The player grows because `score` is
server data, while the radius is a client-side drawing choice.

### Personalize it

Members can then choose one:

- Give each score level a different color.
- Draw a ring around players with a score above zero.
- Add a “COIN!” label when a player is close to a coin.
- Change the grid, coin shape, or player name styling.

Keep strategy changes in `public/strategy.js` and visual changes in
`public/renderer.js`. Browser-only changes need a refresh, not a server
restart. Each member should use their own final copy of these files.

### Optional stretch challenges

For members who finish early:

- Add an “arena size” row to the debug panel using the values in `welcome`.
- Add a message-size metric to `public/debug.js`.
- Change `TICK_RATE` in `server/constants.js` to `2`, observe the lag, then
  restore it to `20`.
- Add a new field to the `state` message in `server/game.js` and display it.

## Competition finale: Crown Clash

After the build challenge, run a short open-play competition. The app does not
enforce a timer; the facilitator announces when the competition starts and
stops. This keeps the rules simple and lets the club adjust the play window
to the room.

### Competition procedure

1. **Freeze the code:** everyone saves their strategy and rendering files and
   stops editing. Record which client copy belongs to each player.
2. **Refresh clients:** each member refreshes their browser. If a browser
   disconnected, reconnect it with the same server address and name.
3. **Start the call:** say “Crown Clash starts now.” The live **Leaderboard**
   shows each player's rank and crown count.
4. **Play fairly:** no changing code during the round, no unplugging another
   player's laptop, and no claiming a crown without the server showing the
   score change. Strategies may request movement only; the server rejects
   invalid directions and owns positions and scores.
5. **Stop together:** announce “last crown,” allow the current movement to
   finish, then read the leaderboard aloud.

The leaderboard is sorted by crowns collected. Equal scores share a rank.
Use the live leaderboard at the end as the official result. If the club wants
a completely fresh event, stop and restart the server before reconnecting;
the server's in-memory scores and leaderboard then start at zero.

### Recognition ideas

- **Crown Champion:** highest score.
- **Fastest Learner:** best explanation of the client/server message flow.
- **Best Build:** most creative visual change.
- **Good Sport:** helpful, respectful competition.

Keep the competition about celebrating participation, not only winning. A
member who finishes with zero crowns but can explain why the server is
authoritative still achieved the learning goal.

## Facilitator prompts

Use questions rather than a lecture:

- “Which computer knows the real score?”
- “What would happen if the browser sent `score: 999`?”
- “Why does the screen freeze when the server stops?”
- “Which parts of your change are data, and which are presentation?”
- “How does your strategy decide where to move next?”
- “What can the server prevent your strategy from changing?”
- “Who is currently #1, and what message made that score visible?”
- “Why should we freeze code before comparing leaderboard scores?”
- “What message would we need to add for a chat feature?”

When someone is stuck, ask them to:

1. Make one small change.
2. Save the file.
3. Refresh the browser.
4. Read the browser console and the server terminal.
5. Compare the last `SEND` and `RECV` messages.

## Troubleshooting during the event

- **Disconnected:** use `ws://SERVER_LAN_IP:3000`, not `localhost`.
- **Only some members connect:** confirm the same Wi-Fi/LAN and approve the
  server firewall prompt.
- **A server change does nothing:** stop with `Ctrl+C`, then run `npm start`
  again. Browser-only changes need a refresh.
- **Everyone sees a frozen game:** check that the server terminal is still
  running.
- **Members cannot edit locally:** give them a copy of the repository or
  have them work in a shared editor while the organizer demonstrates.

## Closing

Ask each member to share one change or one networking idea they learned.
Invite interested members to turn the next meeting into a feature sprint:
teams can add power-ups, a countdown, chat, or a new message type while
keeping the server as the authority.
