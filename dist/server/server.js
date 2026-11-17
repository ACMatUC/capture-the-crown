import { startGameServer } from "./networking.js";
import { parsePort } from "./constants.js";
import { MAX_PLAYERS } from "../shared/protocol.js";
async function main() {
    const server = await startGameServer({
        host: "0.0.0.0",
        port: parsePort(process.env.PORT),
        debug: process.env.DEBUG_NETWORK === "1",
    });
    const { port } = server.address();
    console.log(`Capture the Crown is listening on ws://0.0.0.0:${port}`);
    console.log(`Capacity: ${MAX_PLAYERS} players`);
    console.log(`Host PC: ws://127.0.0.1:${port}`);
    console.log(`Health check: http://127.0.0.1:${port}/health`);
    console.log(`Other players: ws://<HOST_LAN_OR_VPN_IP>:${port}`);
    console.log("For VPN forwarding, use the assigned incoming port. Press Ctrl+C to stop.");
    let stopping = false;
    const shutdown = () => {
        if (stopping)
            return;
        stopping = true;
        void server.close().catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=server.js.map