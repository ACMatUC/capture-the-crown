import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { isDirection } from "../shared/protocol.js";
import { createGameConnection } from "./networking.js";
import { createInputController } from "./input.js";
import {
  isUnspecifiedServerUrl,
  normalizeServerUrl,
  PREVIEW_PLAYER_ID,
  PREVIEW_STATE,
  rankPlayers,
} from "./game.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { Arena } from "./components/Arena.js";
import { Header, Poster } from "./components/Header.js";
import { Icon } from "./components/Icon.js";
import { JoinForm } from "./components/JoinForm.js";
import { Leaderboard } from "./components/Leaderboard.js";
import { Modal } from "./components/Modal.js";
import { NetworkLab } from "./components/NetworkLab.js";
import { PlayerPanel } from "./components/PlayerPanel.js";
import { Rules } from "./components/Rules.js";

type DialogName = "rules" | "network" | "standings" | null;
type GameConnection = ReturnType<typeof createGameConnection>;

function initialFields() {
  const fields = { name: "", address: "" };
  try {
    fields.name = localStorage.getItem("ctc-name") ?? "";
    fields.address = localStorage.getItem("ctc-server") ?? "";
  } catch {
    // Local file clients may not have access to browser storage.
  }
  fields.address =
    new URLSearchParams(window.location.search).get("server") ?? fields.address;
  return fields;
}

export function App({ connection: suppliedConnection }: { connection?: GameConnection }) {
  const [connection] = useState(() => suppliedConnection ?? createGameConnection());
  const [input] = useState(() =>
    createInputController((direction) => {
      connection.sendDirection(direction);
    }),
  );
  const snapshot = useSyncExternalStore(
    useCallback((listener) => connection.subscribe(listener), [connection]),
    useCallback(() => connection.getSnapshot(), [connection]),
  );
  const [fields, setFields] = useState(initialFields);
  const [localError, setLocalError] = useState("");
  const [automatic, setAutomatic] = useState(false);
  const [strategyError, setStrategyError] = useState("");
  const [dialog, setDialog] = useState<DialogName>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mobile = useMediaQuery("(max-width: 780px)");
  const joined = snapshot.status === "connected" && snapshot.playerId !== null;
  const me = snapshot.state.players.find((player) => player.id === snapshot.playerId);
  const myRank = rankPlayers(snapshot.state.players).find(
    ({ player }) => player.id === snapshot.playerId,
  )?.rank;

  useEffect(() => {
    const detach = input.attach();
    return () => {
      detach();
      input.setEnabled(false);
      connection.disconnect();
    };
  }, [connection, input]);

  useEffect(() => {
    document.body.classList.toggle("is-playing", joined);
    return () => document.body.classList.remove("is-playing");
  }, [joined]);

  useEffect(() => {
    input.setMode(automatic ? "strategy" : "manual");
    input.setEnabled(joined && dialog === null);
    if (joined && dialog === null) canvasRef.current?.focus({ preventScroll: true });
  }, [automatic, dialog, input, joined]);

  useEffect(() => {
    if (!joined) return;
    try {
      localStorage.setItem("ctc-name", fields.name.trim());
      localStorage.setItem("ctc-server", fields.address);
    } catch {
      // Remembering fields is optional; the connection remains usable.
    }
  }, [fields.address, fields.name, joined]);

  useEffect(() => {
    if (dialog === "standings" && (!mobile || !joined)) setDialog(null);
  }, [dialog, joined, mobile]);

  useEffect(() => {
    if (!joined || !automatic || dialog !== null || !me) return;
    try {
      if (!window.chooseDirection)
        throw new Error(
          "strategy.js did not provide chooseDirection(). Refresh after checking the file.",
        );
      const direction: unknown = window.chooseDirection(snapshot.state, me);
      if (!isDirection(direction))
        throw new Error("Your strategy must return dx and dy values of -1, 0, or 1.");
      input.sendStrategy(direction);
      setStrategyError("");
    } catch (error) {
      input.reset();
      setStrategyError(
        error instanceof Error
          ? error.message
          : "Your strategy failed. Check strategy.js and refresh.",
      );
    }
  }, [automatic, dialog, input, joined, me, snapshot.state]);

  const openDialog = (name: Exclude<DialogName, null>) => {
    input.setEnabled(false);
    setDialog(name);
  };
  const closeDialog = () => setDialog(null);

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (snapshot.status !== "disconnected") return;
    const name = fields.name.trim();
    if (!name) {
      setLocalError("Pick a player name to enter the arena.");
      return;
    }
    const address = normalizeServerUrl(fields.address);
    if (!address) {
      setLocalError("Enter a server address, like ws://192.168.1.10:3000.");
      return;
    }
    if (isUnspecifiedServerUrl(address)) {
      setLocalError(
        "Use localhost on the server PC, or its LAN/VPN address on another device.",
      );
      return;
    }
    setLocalError("");
    setFields({ name, address });
    connection.connect(name, address);
  }

  function leave() {
    input.setEnabled(false);
    setDialog(null);
    setLocalError("You left the arena. Rejoining starts a new score.");
    connection.disconnect();
  }

  const standings = (
    <Leaderboard players={snapshot.state.players} playerId={snapshot.playerId} />
  );

  return (
    <>
      <Header status={snapshot.status} onHelp={() => openDialog("rules")} />
      <main className="layout">
        <Poster />
        <div className="game-layout">
          <Arena
            canvasRef={canvasRef}
            state={joined ? snapshot.state : PREVIEW_STATE}
            playerId={joined ? snapshot.playerId : PREVIEW_PLAYER_ID}
            width={snapshot.arena.width}
            height={snapshot.arena.height}
            live={joined}
            controlsEnabled={joined && !automatic && dialog === null}
            input={input}
            onHelp={() => openDialog("rules")}
          />
          <aside className="side-panel">
            {joined ? (
              <PlayerPanel
                player={me}
                name={fields.name}
                rank={myRank}
                automatic={automatic}
                strategyError={strategyError}
                onAutomaticChange={(value) => {
                  setAutomatic(value);
                  setStrategyError("");
                }}
                onLeave={leave}
                onStandings={() => openDialog("standings")}
              >
                {mobile ? null : standings}
              </PlayerPanel>
            ) : (
              <JoinForm
                name={fields.name}
                address={fields.address}
                connecting={snapshot.status === "connecting"}
                error={localError || snapshot.error}
                onNameChange={(name) => {
                  setFields((value) => ({ ...value, name }));
                  setLocalError("");
                }}
                onAddressChange={(address) => {
                  setFields((value) => ({ ...value, address }));
                  setLocalError("");
                }}
                onSubmit={join}
              />
            )}
          </aside>
        </div>
        <button
          id="openNetwork"
          className="network-launch"
          type="button"
          onClick={() => openDialog("network")}
        >
          <Icon name="code" />
          <strong>WATCH THE MESSAGES</strong>
          <span className="tools-subtitle">Keyboard → server → everyone</span>
          <span className="tools-action">
            OPEN LAB <span aria-hidden="true">↗</span>
          </span>
        </button>
      </main>
      <Modal
        id="helpDialog"
        title="Go for the gold."
        open={dialog === "rules"}
        closeLabel="Close guide"
        onClose={closeDialog}
      >
        <Rules onClose={closeDialog} />
      </Modal>
      <Modal
        id="networkDialog"
        title="Watch the messages"
        className="network-dialog"
        open={dialog === "network"}
        closeLabel="Close network lab"
        onClose={closeDialog}
      >
        {dialog === "network" && <NetworkLab snapshot={snapshot} />}
      </Modal>
      <Modal
        id="standingsDialog"
        title="The standings"
        className="standings-dialog"
        open={dialog === "standings" && mobile && joined}
        closeLabel="Close standings"
        onClose={closeDialog}
      >
        <div id="standingsDialogBody">{mobile && joined ? standings : null}</div>
      </Modal>
    </>
  );
}
