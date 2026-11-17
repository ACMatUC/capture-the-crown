// @vitest-environment happy-dom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, GameState, ServerMessage } from "../shared/protocol.js";
import { App } from "../client/App.js";
import { createGameConnection } from "../client/networking.js";

class TestSocket extends EventTarget {
  readyState = 0;
  sent: ClientMessage[] = [];
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  receive(message: ServerMessage) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw) as ClientMessage);
  }
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}

let mobile = false;
let mediaListeners: Set<() => void>;

beforeEach(() => {
  localStorage.clear();
  mobile = false;
  mediaListeners = new Set();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return mobile;
    },
    addEventListener: (_event: string, listener: () => void) =>
      mediaListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      mediaListeners.delete(listener),
  }));
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  window.chooseDirection = () => ({ dx: 1, dy: 0 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.chooseDirection;
});

const state: GameState = {
  type: "state",
  players: [
    { id: "player-1", name: "Krish", x: 100, y: 100, score: 9 },
    { id: "player-2", name: "Riley", x: 200, y: 200, score: 9 },
    { id: "player-3", name: "Sam", x: 300, y: 300, score: 1 },
  ],
  coins: [{ id: "coin-1", x: 500, y: 300 }],
};

function setup() {
  const sockets: TestSocket[] = [];
  const connection = createGameConnection({
    createSocket: () => {
      const socket = new TestSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  const view = render(
    <StrictMode>
      <App connection={connection} />
    </StrictMode>,
  );
  function join() {
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Krish" } });
    fireEvent.change(screen.getByLabelText("Server address"), {
      target: { value: "10.1.2.3" },
    });
    fireEvent.submit(document.getElementById("joinForm")!);
    const socket = sockets.at(-1)!;
    act(() => {
      socket.open();
      socket.receive({
        type: "welcome",
        id: "player-1",
        arenaWidth: 800,
        arenaHeight: 600,
      });
      socket.receive(state);
    });
    return socket;
  }
  return { sockets, connection, join, ...view };
}

describe("game interface", () => {
  it("rejects a listen address without creating a connection", () => {
    const { sockets } = setup();
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Krish" } });
    fireEvent.change(screen.getByLabelText("Server address"), {
      target: { value: "0.0.0.0:3000" },
    });
    fireEvent.submit(document.getElementById("joinForm")!);
    expect(screen.getByRole("alert").textContent).not.toBe("");
    expect(sockets).toHaveLength(0);
  });

  it("lets the host join through localhost on the forwarded local port", () => {
    const { sockets, connection } = setup();
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Krish" } });
    fireEvent.change(screen.getByLabelText("Server address"), {
      target: { value: "localhost:27411" },
    });
    fireEvent.submit(document.getElementById("joinForm")!);
    expect(sockets).toHaveLength(1);
    const socket = sockets[0]!;
    act(() => {
      socket.open();
      socket.receive({
        type: "welcome",
        id: "player-1",
        arenaWidth: 800,
        arenaHeight: 600,
      });
      socket.receive(state);
    });
    expect(connection.getSnapshot().status).toBe("connected");
    expect(screen.getByRole("heading", { name: "Krish" })).toBeTruthy();
  });

  it("pauses strategy movement for the network dialog and resumes on close", () => {
    const { join } = setup();
    const socket = join();
    fireEvent.click(screen.getByRole("checkbox", { name: "Run my code" }));
    expect(socket.sent.at(-1)).toEqual({ type: "input", dx: 1, dy: 0 });
    fireEvent.click(screen.getByRole("button", { name: /WATCH THE MESSAGES/ }));
    expect(socket.sent.at(-1)).toEqual({ type: "input", dx: 0, dy: 0 });
    const sent = socket.sent.length;
    act(() => socket.receive(state));
    expect(socket.sent).toHaveLength(sent);
    expect(screen.getByRole("dialog", { name: "Watch the messages" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close network lab" }));
    expect(socket.sent.at(-1)).toEqual({ type: "input", dx: 1, dy: 0 });
  });

  it("renders tied ranks in one React-owned scoreboard when the viewport changes", () => {
    mobile = true;
    const { join } = setup();
    join();
    expect(document.querySelectorAll("#scoreboard")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Standings ↗" }));
    const dialog = screen.getByRole("dialog", { name: "The standings" });
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("aria-label")),
    ).toEqual([
      "Rank 1, Krish, you, 9 points",
      "Rank 1, Riley, 9 points",
      "Rank 3, Sam, 1 point",
    ]);
    act(() => {
      mobile = false;
      mediaListeners.forEach((listener) => listener());
    });
    expect(document.querySelectorAll("#scoreboard")).toHaveLength(1);
    expect(document.getElementById("scoreboard")!.closest("dialog")).toBeNull();
    expect(document.getElementById("standingsDialog")!.hasAttribute("open")).toBe(false);
  });

  it("reports a strategy failure and keeps the player stopped", () => {
    const { join } = setup();
    const socket = join();
    window.chooseDirection = () => {
      throw new Error("No route was selected.");
    };
    fireEvent.click(screen.getByRole("checkbox", { name: "Run my code" }));
    expect(screen.getByRole("alert").textContent).toBe("No route was selected.");
    expect(
      socket.sent.some(
        (message) => message.type === "input" && (message.dx !== 0 || message.dy !== 0),
      ),
    ).toBe(false);
  });

  it("keeps all 32 players and the local rank in one scoreboard across layouts", () => {
    const { join } = setup();
    const socket = join();
    const fullArena: GameState = {
      ...state,
      players: Array.from({ length: 32 }, (_, index) => ({
        id: `player-${index + 1}`,
        name: index === 0 ? "Krish" : `Player ${String(index + 1).padStart(2, "0")}`,
        x: 100 + (index % 8) * 70,
        y: 100 + Math.floor(index / 8) * 70,
        score: index,
      })),
    };
    act(() => socket.receive(fullArena));
    const assertStandings = () => {
      expect(document.querySelectorAll("#scoreboard")).toHaveLength(1);
      const list = document.getElementById("scoreboard")!;
      expect(within(list).getAllByRole("listitem")).toHaveLength(32);
      expect(
        within(list).getByRole("listitem", { name: "Rank 32, Krish, you, 0 points" })
          .classList,
      ).toContain("is-you");
      expect(document.getElementById("myRank")!.textContent).toBe("#32");
      expect(document.getElementById("playerCount")!.parentElement!.textContent).toBe(
        "32 / 32 playing",
      );
    };
    assertStandings();
    act(() => {
      mobile = true;
      mediaListeners.forEach((listener) => listener());
    });
    fireEvent.click(screen.getByRole("button", { name: "Standings ↗" }));
    expect(document.getElementById("scoreboard")!.closest("dialog")?.open).toBe(true);
    assertStandings();
    act(() => {
      mobile = false;
      mediaListeners.forEach((listener) => listener());
    });
    expect(document.getElementById("scoreboard")!.closest("dialog")).toBeNull();
    assertStandings();
  });

  it("stops input and closes the socket on unmount after StrictMode remounts", () => {
    const { join, unmount } = setup();
    const socket = join();
    fireEvent.keyDown(window, { key: "d" });
    expect(socket.sent.at(-1)).toEqual({ type: "input", dx: 1, dy: 0 });
    unmount();
    expect(socket.sent.at(-1)).toEqual({ type: "input", dx: 0, dy: 0 });
    expect(socket.readyState).toBe(3);
    const count = socket.sent.length;
    fireEvent.keyDown(window, { key: "a" });
    expect(socket.sent).toHaveLength(count);
  });
});
