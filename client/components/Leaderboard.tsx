import { MAX_PLAYERS, type GameState } from "../../shared/protocol.js";
import { rankPlayers } from "../game.js";

export function Leaderboard({
  players,
  playerId,
}: {
  players: GameState["players"];
  playerId: string | null;
}) {
  return (
    <div className="leaderboard-panel">
      <div className="panel-heading">
        <h2>THE STANDINGS</h2>
        <span>
          <span id="playerCount">{players.length}</span> / {MAX_PLAYERS} playing
        </span>
      </div>
      <ol id="scoreboard" className="scoreboard-list">
        {rankPlayers(players).map(({ player, rank }) => {
          const mine = player.id === playerId;
          return (
            <li
              key={player.id}
              className={mine ? "is-you" : undefined}
              aria-label={`Rank ${rank}, ${player.name}${mine ? ", you" : ""}, ${player.score} ${player.score === 1 ? "point" : "points"}`}
            >
              <span className="leaderboard-rank">{String(rank).padStart(2, "0")}</span>
              <span className="leaderboard-name">{player.name}</span>
              {mine && <span className="you-badge">YOU</span>}
              <span className="score-value">{player.score}</span>
            </li>
          );
        })}
      </ol>
      <p className="leaderboard-footer">Tied scores share a place.</p>
    </div>
  );
}
