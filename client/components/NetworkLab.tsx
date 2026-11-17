import { useState } from "react";
import type { ConnectionSnapshot } from "../networking.js";

export function NetworkLab({ snapshot }: { snapshot: ConnectionSnapshot }) {
  const [frozen, setFrozen] = useState<ConnectionSnapshot | null>(null);
  const view = frozen ?? snapshot;
  const { stats, state, playerId } = view;
  const details = [
    ["Connection", "dbgConnection", view.status],
    ["Player ID", "dbgPlayerId", playerId ?? "—"],
    [
      "Clock difference*",
      "dbgPing",
      stats.clockDeltaMs === null ? "—" : `${stats.clockDeltaMs} ms`,
    ],
    ["Players", "dbgPlayers", state.players.length],
    ["Sent", "dbgSent", stats.sent],
    ["Received", "dbgReceived", stats.received],
  ] as const;

  return (
    <div id="workshopTools" className="workshop-tools">
      <div className="workshop-content">
        <section className="debug-panel">
          <div className="panel-heading">
            <h2>Network Debug</h2>
            <label className="debug-toggle">
              <input
                type="checkbox"
                id="debugToggle"
                checked={frozen === null}
                onChange={(event) => setFrozen(event.target.checked ? null : snapshot)}
              />{" "}
              Live updates
            </label>
          </div>
          <p className="field-help">
            The client asks to move. The server updates the shared world.
          </p>
          <dl className="debug-grid">
            {details.map(([label, id, value]) => (
              <div className="debug-entry" key={id}>
                <dt>{label}</dt>
                <dd id={id}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="field-help">
            *Arrival time minus server timestamp, including clock differences. This is not
            round-trip ping.
          </p>
          <div className="message-grid">
            <div>
              <h3>SEND / client → server</h3>
              <pre id="dbgLastSent" className="debug-json">
                {stats.lastSent
                  ? JSON.stringify(stats.lastSent, null, 2)
                  : "Waiting for a connection."}
              </pre>
            </div>
            <div>
              <h3>RECV / server → client</h3>
              <pre id="dbgLastReceived" className="debug-json">
                {stats.lastReceived
                  ? JSON.stringify(stats.lastReceived, null, 2)
                  : "Waiting for a connection."}
              </pre>
            </div>
          </div>
        </section>
        <section className="location-panel">
          <h2>Live coordinates</h2>
          <p className="field-help">The same world on every screen.</p>
          <ul id="locationSummary" className="location-list">
            {state.players.map((player) => (
              <li
                className={player.id === playerId ? "is-you" : undefined}
                key={player.id}
              >
                {player.name}: ({player.x}, {player.y})
              </li>
            ))}
            <li className="coin-locations">
              {state.coins.length
                ? `Crowns: ${state.coins.map((coin) => `#${coin.id.replace("coin-", "")} (${coin.x}, ${coin.y})`).join(" · ")}`
                : "Join to see live coordinates."}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
