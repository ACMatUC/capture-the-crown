import type { FormEvent } from "react";
import { MAX_PLAYER_NAME_LENGTH, MAX_PLAYERS } from "../../shared/protocol.js";
import { Icon } from "./Icon.js";

interface JoinFormProps {
  name: string;
  address: string;
  connecting: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function JoinForm({
  name,
  address,
  connecting,
  error,
  onNameChange,
  onAddressChange,
  onSubmit,
}: JoinFormProps) {
  return (
    <section id="joinScreen" className="join-screen" aria-labelledby="joinTitle">
      <p className="section-kicker">01 / GET IN HERE</p>
      <h2 id="joinTitle">Join the game.</h2>
      <p className="panel-description">Use the address on your host’s screen.</p>
      <form id="joinForm" onSubmit={onSubmit}>
        <label htmlFor="nameInput">
          Your name <span>MAX. {MAX_PLAYER_NAME_LENGTH}</span>
        </label>
        <input
          id="nameInput"
          type="text"
          maxLength={MAX_PLAYER_NAME_LENGTH}
          placeholder="Pick a name"
          autoComplete="nickname"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={connecting}
          required
        />
        <label htmlFor="serverUrlInput">Server address</label>
        <input
          id="serverUrlInput"
          type="text"
          placeholder="ws://192.168.1.10:3000"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          disabled={connecting}
          required
          aria-describedby="serverHelp joinError"
        />
        <p id="serverHelp" className="field-help">
          Host PC: localhost:PORT. Players: host’s LAN or VPN address.
        </p>
        <p id="joinError" className="join-error" role="alert">
          {error}
        </p>
        <button
          id="joinButton"
          className="primary-button"
          type="submit"
          disabled={connecting}
        >
          <span>{connecting ? "Connecting..." : "Let me in"}</span>
          <Icon name="arrow" />
        </button>
      </form>
      <p className="join-footnote">Up to {MAX_PLAYERS} players. No account needed.</p>
    </section>
  );
}
