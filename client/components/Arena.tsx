import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { GameState } from "../../shared/protocol.js";
import { createInputController } from "../input.js";
import { createRenderer } from "../renderer.js";
import { Icon } from "./Icon.js";

type InputController = ReturnType<typeof createInputController>;
type MoveDirection = "up" | "down" | "left" | "right";
const controls: { direction: MoveDirection; symbol: string }[] = [
  { direction: "up", symbol: "↑" },
  { direction: "left", symbol: "←" },
  { direction: "down", symbol: "↓" },
  { direction: "right", symbol: "→" },
];

interface ArenaProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: GameState;
  playerId: string | null;
  width: number;
  height: number;
  live: boolean;
  controlsEnabled: boolean;
  input: InputController;
  onHelp: () => void;
}

function usePickupNotice(state: GameState, playerId: string | null) {
  const score = state.players.find((player) => player.id === playerId)?.score;
  const previous = useRef<{ playerId: string | null; score: number | undefined }>(null);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const before = previous.current;
    previous.current = { playerId, score };
    if (
      !before ||
      before.playerId !== playerId ||
      score === undefined ||
      before.score === undefined ||
      score <= before.score
    ) {
      setGain(0);
      return;
    }
    setGain(score - before.score);
    const timer = window.setTimeout(() => setGain(0), 1600);
    return () => window.clearTimeout(timer);
  }, [playerId, score]);
  return gain;
}

export function Arena({
  canvasRef,
  state,
  playerId,
  width,
  height,
  live,
  controlsEnabled,
  input,
  onHelp,
}: ArenaProps) {
  const [renderer] = useState(createRenderer);
  const latest = useRef({ state, playerId });
  const gain = usePickupNotice(state, live ? playerId : null);
  const pressed = useSyncExternalStore(
    useCallback((listener) => input.subscribe(listener), [input]),
    useCallback(() => input.getPressed(), [input]),
  );

  useEffect(() => {
    latest.current = { state, playerId };
  }, [state, playerId]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser does not support the game canvas.");
    canvas.width = width;
    canvas.height = height;
    renderer.reset();
    let frame: number;
    const draw = () => {
      renderer.draw(context, latest.current.state, latest.current.playerId);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [canvasRef, width, height, renderer, playerId]);

  return (
    <section id="arena" className="arena-card" aria-labelledby="arenaTitle">
      <div className="arena-header">
        <div className="arena-title">
          <h2 id="arenaTitle">THE PLAYING FIELD</h2>
          <span id="arenaState" className="small-badge">
            {live ? "LIVE" : "PREVIEW"}
          </span>
        </div>
        <span className="arena-rule">
          <Icon name="crown" />
          <span id="crownCount">{state.coins.length}</span> on the map{" "}
          <span aria-hidden="true">/</span> +1 each
        </span>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          id="gameCanvas"
          width={width}
          height={height}
          tabIndex={0}
          aria-label="Game arena. Move with W A S D or arrow keys. Your player has a red ring and a YOU label."
          aria-describedby="arenaCaption"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
        {!live && (
          <div id="previewNotice" className="preview-notice">
            <strong>
              YOU’RE UP<span>↗</span>
            </strong>
            <span>Pick a name. Join the game.</span>
            <span className="preview-label">
              ILLUSTRATED PREVIEW — JOIN FOR LIVE PLAY
            </span>
          </div>
        )}
        <div
          id="pickupNotice"
          className={`pickup-notice${gain ? " visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          {gain ? `+${gain} ${gain === 1 ? "crown" : "crowns"}` : ""}
        </div>
        <span className="arena-corner-label" aria-hidden="true">
          NO ELIMINATIONS. JUST CROWNS.
        </span>
      </div>
      <div className="arena-bottom">
        <div className="control-keys">
          <span className="key-group" aria-hidden="true">
            <kbd>W</kbd>
            <span>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
            </span>
          </span>
          <span className="control-copy">
            WASD / arrow keys<span>Touch a crown to collect it.</span>
          </span>
        </div>
        <div className="arena-legend">
          <span className="legend-you" /> YOU <span className="legend-crown" /> +1
        </div>
        <button className="text-button" onClick={onHelp}>
          Rules ↗
        </button>
      </div>
      <div className="touch-controls" aria-label="Touch movement controls">
        <span>
          Hold a button
          <br />
          to move.
        </span>
        <div className="dpad">
          {controls.map(({ direction, symbol }) => (
            <button
              key={direction}
              type="button"
              data-direction={direction}
              aria-label={`Move ${direction}`}
              disabled={!controlsEnabled}
              aria-pressed={pressed.has(direction)}
              className={pressed.has(direction) ? "is-pressed" : undefined}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                input.setPointer(event.pointerId, direction);
              }}
              onPointerUp={(event) => input.releasePointer(event.pointerId)}
              onPointerCancel={(event) => input.releasePointer(event.pointerId)}
              onLostPointerCapture={(event) => input.releasePointer(event.pointerId)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  input.setPointer(`button-${direction}`, direction);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  input.releasePointer(`button-${direction}`);
                }
              }}
              onBlur={() => input.releasePointer(`button-${direction}`)}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>
      <p id="arenaCaption" className="sr-only">
        {live
          ? "Live arena. You have a red ring and a YOU label. Collect gold crowns for one point each. The standings show your rank and score."
          : "The preview shows example players. Join for live play. Collect a gold crown for one point. It respawns somewhere new. Equal scores share a rank."}
      </p>
    </section>
  );
}
