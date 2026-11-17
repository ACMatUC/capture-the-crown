import { Icon } from "./Icon.js";
import { MAX_PLAYERS } from "../../shared/protocol.js";

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <>
      <p>
        Up to {MAX_PLAYERS} players can join using the host’s LAN or forwarded VPN
        address. Look for the player with the <strong>red ring</strong> and{" "}
        <strong>YOU</strong> label.
      </p>
      <ol>
        <li>
          <strong>Move</strong> with WASD, arrow keys, or the on-screen buttons.
        </li>
        <li>
          <strong>Collect</strong> a crown for +1. It immediately respawns somewhere new.
        </li>
        <li>
          <strong>Win</strong> by having the most crowns when your host calls time. Ties
          share a rank.
        </li>
      </ol>
      <p className="dialog-tip">
        Want your code to play? Edit <code>strategy.js</code> and check{" "}
        <strong>Run my code</strong> after joining.
      </p>
      <button id="helpDone" className="primary-button" onClick={onClose}>
        Got it <Icon name="arrow" />
      </button>
    </>
  );
}
