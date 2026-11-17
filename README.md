# Capture the Crown

A browser game for ACM@UC's networking workshop. Collect crowns to earn
points and compete with the other players in the room.

One computer runs the server for up to **32 players**. Players connect over
the same LAN or through a forwarded VPN port.

## Host: set up the game

You need Node.js 24 or newer, a copy of this repository, and either LAN access
between devices or a working incoming TCP port through your VPN.

### 1. Build the client and start the server

Open a terminal in the `capture-the-crown` folder:

```sh
npm ci
npm run build
npm start
```

Keep the terminal running during the game. The default port is `3000`.
The build creates the player files in `dist/client/` and the compiled server
in `dist/server/`. You can also run the compiled server with `npm run start:built`.

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

Share the **entire `dist/client/` folder**, including `game.js`, `strategy.js`,
`assets/`, and `fonts/`. Have everyone follow the [client instructions](#clients-join-and-play)
below.

Players open the client files in their browsers. The server accepts game
connections over WebSocket and provides a small connectivity check at
`http://SERVER_IP:3000/health`; it does not serve the game interface.
The built stylesheet includes the interface fonts, so opening the client
from disk does not need a font service or separate font requests.

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

LAN players then connect to `ws://YOUR_LAN_IP:4000`. For a VPN, the server's
local port must match the port receiving forwarded traffic; players use the
VPN's public IP and external port.

### Host through PIA VPN

Use the **forwarded port displayed by PIA**, not the port used to connect the
VPN tunnel. The game must listen on that same port. For example, if PIA
assigns `27411`, start the server in PowerShell with:

```powershell
$env:PORT = "27411"
npm start
```

Check the two connections separately:

| Where                        | Address                             | Expected result                                             |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| Server PC, browser           | `http://127.0.0.1:27411/health`     | JSON showing `status: "ok"` and `maxPlayers: 32`            |
| Server PC, game client       | `ws://127.0.0.1:27411`              | Join locally without going through the VPN's public address |
| Another network, browser     | `http://VPN_PUBLIC_IP:27411/health` | The same health response through the forwarded port         |
| Another network, game client | `ws://VPN_PUBLIC_IP:27411`          | Join the game through PIA                                   |

Test the public address from another device on a different network, such as
a phone on mobile data with Wi-Fi and its own VPN off. Connecting to your own
VPN public address from the host PC is not a reliable forwarding test.
[PIA's testing guide](https://helpdesk.privateinternetaccess.com/kb/articles/pdf/how-to-test-port-forwarding-on-linux)
uses a second device on a different network.

If the local health check fails, confirm that the terminal is still running
and that its printed port is correct. If local access works but the external
health check fails, check the current PIA assignment and Windows Firewall's
incoming TCP access for Node.js. Stay connected to the PIA location that
assigned the port, and check the current IP and port again after reconnecting.
See [PIA's port-forwarding guide](https://www.privateinternetaccess.com/blog/the-beginners-guide-to-vpn-port-forwarding/).

## Clients: join and play

You need the client folder from the host and a modern browser. You do not need Node.js
or npm on your computer.

1. Connect to the host's LAN, or get its public VPN address and forwarded port.
2. Open `index.html` from that folder in your browser. Keep the other files and
   subfolders alongside it.
3. Enter your name, up to 16 characters.
4. Enter the host's `ws://...` address in **Server address**. Use `localhost`
   only when playing on the computer running the server.
5. Click **Let me in**.

The field shown before you join is an illustrated preview.
The game accepts 32 simultaneous players. If it is full, wait for someone
to leave and try joining again.

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

1. Edit `chooseDirection(state, me)` in your client folder's `strategy.js`. Return `dx`
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

| Problem                              | What to check                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Connection fails or times out        | Check the server's /health locally first, then from another network for VPN forwarding.                                   |
| Only some players can connect        | Check the host's firewall and whether the network blocks traffic between devices. Ask the host to resolve network access. |
| Port 3000 is already in use          | The host can choose [a different port](#use-a-different-port) and share the updated address.                              |
| Movement is unusually slow or jumpy  | Check `tickRate` in `server/constants.ts`; the default is 20 updates per second.                                          |
| A strategy change does not appear    | Edit the `strategy.js` beside the `index.html` you opened, then save and refresh.                                         |
| A source-code change does not appear | Rebuild the client or use the development server below. Restart the game server after changing its source.                |

## Workshop and development

See [WorkshopGuide.md](WorkshopGuide.md) for the meeting agenda and coding
exercises.

The interface uses React and TypeScript, built with Vite. The Node server
uses `ws`. Both sides share message types and runtime validation in
`shared/protocol.ts`.

For development, run these in separate terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

Open the local address Vite prints. Enter the game server's local, LAN, or VPN address in
the join form. Client edits update automatically; server edits restart the
development server and clear the game. Edit `public/strategy.js` when working
from source. Rebuild before sharing a new client folder.

| Location  | Contents                                                          |
| --------- | ----------------------------------------------------------------- |
| `client/` | React components, controls, canvas renderer, and styles           |
| `server/` | WebSocket server, movement, scoring, and configuration            |
| `shared/` | Message types and runtime validation for both sides               |
| `public/` | Editable strategy, logo, and bundled fonts copied into each build |
| `tests/`  | Component, input, networking, rendering, and game-rule checks     |

Run the checks from the repository root:

```sh
npm run check
```

This runs formatting, ESLint, TypeScript, Vitest, real WebSocket integration
tests, and a production build. The build also checks the standalone client
for missing files, module scripts, and external font requests.
CI runs the same command. `npm run format`
formats the source; `npm run test:watch` watches unit and component tests.
The WebSocket tests start and stop their own servers on temporary loopback
ports and leave a running workshop game alone.

An optional pre-commit hook runs the faster local checks. Enable it with
`git config core.hooksPath .githooks`. On macOS or Linux, also run
`chmod +x .githooks/pre-commit`.

## Credits

Interface references: [Frontend Slides](https://github.com/zarazhangrui/frontend-slides)
and the [ACM@UC workshop slides](https://ucai2026secondbrainworkshop.myaiworkspace2026.workers.dev/).
Bundled fonts and their licenses are listed in [public/fonts/README.md](public/fonts/README.md).
