# Capture the Crown

A browser game for ACM@UC's networking workshop. Collect crowns to earn
points and compete with the other players in the room.

One computer runs the server. Players use a browser on the same local
network.

## Host: set up the game

You need Node.js 18 or newer, a copy of this repository, and a network that
allows the players' computers to reach yours.

### 1. Start the server

Open a terminal in the `capture-the-crown` folder:

```sh
npm install
npm start
```

Keep the terminal running during the game. The default port is `3000`.

### 2. Find your LAN address

On Windows, run:

```powershell
ipconfig
```

Use the IPv4 address of the Wi-Fi or Ethernet adapter connected to the
players' network. On macOS or Linux, find the active adapter's address in
network settings.

Give players the address in this format:

```text
ws://192.168.1.10:3000
```

Replace `192.168.1.10` with your computer's LAN address. `localhost` and
`127.0.0.1` point to each player's own computer; `0.0.0.0` is the server's
listen address, not an address to share.

### 3. Give players the client files

Share the **entire `public/` folder**, including its scripts, `assets/`, and
`fonts/`. Have everyone follow the [client instructions](#clients-join-and-play)
below.

The server handles WebSocket connections only. It does not serve a webpage
at `http://SERVER_IP:3000`. Players open the client files in their browsers.

### Stop or reset the game

Press **Ctrl+C** in the server terminal to stop it. Start it again with
`npm start` and have everyone rejoin to begin a fresh game. Scores are kept
in memory and are cleared when the server stops.

### Use a different port

In PowerShell:

```powershell
$env:PORT = "4000"
npm start
```

In Bash:

```sh
PORT=4000 npm start
```

Players then connect to `ws://YOUR_LAN_IP:4000`. Use the same port on the
server and every client.

## Clients: join and play

You need the `public/` folder and a modern browser. You do not need Node.js
or npm on your computer.

1. Connect to the same local network as the host.
2. Open `public/index.html` in your browser. Keep the other files and
   subfolders alongside it.
3. Enter your name, up to 16 characters.
4. Enter the host's `ws://...` address in **Server address**.
5. Click **Let me in**.

Everyone uses the same server address. The field shown before you join is
an illustrated preview.

### Controls and scoring

- Move with **WASD**, **arrow keys**, or the on-screen direction buttons.
- Your player has a red ring and a **YOU** label.
- Touch a gold crown to earn one point. It respawns somewhere else; there
  are always ten crowns on the field.
- The highest score leads. Equal scores share a rank. The host calls the
  start and finish of a competition.
- On phones, tap **Standings** to see the full leaderboard.
- Open **How to play** or **Rules** for the controls during a game.

Leaving, refreshing, or losing your connection ends your current run.
Joining again creates a new player with a score of zero.

### Play with your strategy code

1. Edit `chooseDirection(state, me)` in `public/strategy.js`. Return `dx`
   and `dy`, each set to `-1`, `0`, or `1`.
2. Save the file, refresh your browser, and rejoin.
3. Check **Run my code**. Uncheck it to return to manual controls.

Your code chooses a direction. The server still controls movement,
pickups, and scores.

### View the network messages

Open **Watch the messages** to see outgoing requests, incoming game state,
and live coordinates. Movement pauses while the lab or a guide is open,
and when you switch away from the window.

The lab's clock difference compares timestamps from two computers. It is
not a round-trip ping measurement.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Connection fails or times out | The host's server is running, the address and port match, and both computers are on the same LAN. |
| Only some players can connect | Check the host's firewall and whether the network blocks traffic between devices. Ask the host to resolve network access. |
| Port 3000 is already in use | The host can choose [a different port](#use-a-different-port) and share the updated address. |
| Movement is unusually slow or jumpy | Check `TICK_RATE` in `server/constants.js`; the default is 20 updates per second. |
| A code change does not appear | Refresh for changes in `public/`. Restart the server for changes in `server/`. |

## Workshop and development

See [WorkshopGuide.md](WorkshopGuide.md) for the meeting agenda and coding
exercises.

| Location | Contents |
| --- | --- |
| `server/` | WebSocket server, movement, scoring, and message validation |
| `public/` | Browser client, controls, rendering, strategy, and local assets |
| `tests/` | Input, networking, rendering, and game-rule checks |

Run the checks from the repository root:

```sh
npm test
npm run test:lan
```

The LAN test starts and stops its own server on a temporary loopback port.
It does not connect to or reset a running workshop game.

## Credits

Interface references: [Frontend Slides](https://github.com/zarazhangrui/frontend-slides)
and the [ACM@UC workshop slides](https://ucai2026secondbrainworkshop.myaiworkspace2026.workers.dev/).
Bundled fonts and their licenses are listed in [public/fonts/README.md](public/fonts/README.md).
