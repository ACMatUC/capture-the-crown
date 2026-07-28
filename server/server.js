// ============================================================================
// server.js
//
// WHAT THIS FILE IS:
// The entry point for the workshop's SERVER PC. Running `npm start` runs
// this file. It starts only a WebSocket server; it does not serve the
// browser client and it never assumes clients are on the same machine.
//
// WHY IT EXISTS:
// Kept deliberately tiny. All the interesting networking logic lives in
// networking.js and game.js -- this file just wires everything together
// and starts listening.
//
// WHEN IT EXECUTES:
// Once, when you run `npm start` (or `node server/server.js` directly).
// ============================================================================

const { startWebSocketServer } = require("./networking");

const HOST = "0.0.0.0";
const PORT = process.env.PORT || 3000;

console.log("=================================================");
console.log(" Capture the Crown -- WebSocket server");
console.log("=================================================");
console.log(`Binding to ws://${HOST}:${PORT}`);
console.log("Clients must connect to ws://<SERVER_LAN_IP>:" + PORT);
console.log("Use the server PC's LAN IP, not localhost or 127.0.0.1.");
console.log("Watch this terminal for SEND/RECV network logs.");

startWebSocketServer({ host: HOST, port: PORT }, () => {
  console.log("=================================================");
  console.log(" Server is listening for LAN WebSocket clients");
  console.log("=================================================");
});
