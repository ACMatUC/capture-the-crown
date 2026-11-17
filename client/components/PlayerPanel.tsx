import type { ReactNode } from "react";
import type { PlayerSnapshot } from "../../shared/protocol.js";
import { Icon } from "./Icon.js";

interface PlayerPanelProps {
  player: PlayerSnapshot | undefined;
  name: string;
  rank: number | undefined;
  automatic: boolean;
  strategyError: string;
  onAutomaticChange: (value: boolean) => void;
  onLeave: () => void;
  onStandings: () => void;
  children: ReactNode;
}

export function PlayerPanel({
  player,
  name,
  rank,
  automatic,
  strategyError,
  onAutomaticChange,
  onLeave,
  onStandings,
  children,
}: PlayerPanelProps) {
  const playerName = player?.name || name;
  return (
    <section id="gameScreen" className="game-screen" aria-label="Your live game">
      <div className="player-card">
        <div className="player-card-top">
          <span className="section-kicker">YOU’RE PLAYING AS</span>
          <button
            id="openStandings"
            className="text-button standings-launch"
            type="button"
            onClick={onStandings}
          >
            Standings ↗
          </button>
          <button
            id="leaveButton"
            className="text-button"
            type="button"
            onClick={onLeave}
          >
            Leave ↗
          </button>
        </div>
        <div className="player-identity">
          <span id="playerAvatar" className="player-avatar">
            {playerName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2 id="playerName">{playerName}</h2>
            <span id="controlModeLabel">
              {automatic ? "Strategy running" : "Keyboard / touch"}
            </span>
          </div>
        </div>
        <div className="personal-stats">
          <div>
            <span>CROWNS</span>
            <strong id="myScore">{player?.score ?? 0}</strong>
          </div>
          <div>
            <span>PLACE</span>
            <strong id="myRank">{rank ? `#${rank}` : "—"}</strong>
          </div>
        </div>
      </div>
      {children}
      <div className="strategy-panel">
        <label className="strategy-control" htmlFor="strategyToggle">
          <input
            type="checkbox"
            id="strategyToggle"
            aria-label="Run my code"
            checked={automatic}
            onChange={(event) => onAutomaticChange(event.target.checked)}
          />
          <span>Run my code</span>
          <Icon name="code" />
        </label>
        <p id="strategyDescription">
          {automatic
            ? "strategy.js is choosing your next move."
            : "Your strategy takes over the controls."}
        </p>
        <p className="strategy-note">
          Edit <code>strategy.js</code>, refresh, then check the box.
        </p>
        {strategyError && (
          <p className="join-error" role="alert">
            {strategyError}
          </p>
        )}
      </div>
    </section>
  );
}
