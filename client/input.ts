import { isDirection, type Axis, type Direction } from "../shared/protocol.js";

export type InputDirection = "up" | "down" | "left" | "right";
export type InputMode = "manual" | "strategy";
type PointerId = number | string;

const KEY_DIRECTIONS: Readonly<Record<string, InputDirection>> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

function editingControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false']), button:not([data-direction])",
    ) !== null
  );
}

function axis(positive: boolean, negative: boolean): Axis {
  return positive === negative ? 0 : positive ? 1 : -1;
}

export class InputController {
  private enabled = false;
  private focused = true;
  private mode: InputMode = "manual";
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<PointerId, InputDirection>();
  private pressed: ReadonlySet<InputDirection> = new Set();
  private lastDirection: Direction = { dx: 0, dy: 0 };
  private readonly listeners = new Set<() => void>();
  private detach: (() => void) | null = null;

  constructor(private readonly send: (direction: Direction) => void) {}

  getPressed = (): ReadonlySet<InputDirection> => this.pressed;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  attach(): () => void {
    if (this.detach) return this.detach;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("pointerup", this.onPointerRelease);
    window.addEventListener("pointercancel", this.onPointerRelease);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    document.addEventListener("focusin", this.onFocusIn);
    this.detach = () => {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      window.removeEventListener("blur", this.onBlur);
      window.removeEventListener("focus", this.onFocus);
      window.removeEventListener("pointerup", this.onPointerRelease);
      window.removeEventListener("pointercancel", this.onPointerRelease);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      document.removeEventListener("focusin", this.onFocusIn);
      this.detach = null;
      this.reset();
    };
    return this.detach;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.reset();
  }

  setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.reset();
  }

  setPointer(id: PointerId, direction: InputDirection): void {
    if (!this.canSend() || this.mode !== "manual") return;
    this.pointers.set(id, direction);
    this.update();
  }

  releasePointer(id: PointerId): void {
    if (this.pointers.delete(id)) this.update();
  }

  sendStrategy(direction: unknown): boolean {
    if (!isDirection(direction)) {
      this.stop();
      return false;
    }
    if (!this.canSend() || this.mode !== "strategy") return false;
    this.sendChanged(direction);
    return true;
  }

  reset(): void {
    this.keys.clear();
    this.pointers.clear();
    this.updatePressed(new Set());
    this.stop();
  }

  dispose(): void {
    this.detach?.();
    this.setEnabled(false);
    this.listeners.clear();
  }

  private canSend(): boolean {
    return this.enabled && this.focused && document.visibilityState !== "hidden";
  }

  private update(): void {
    const next = new Set<InputDirection>(this.pointers.values());
    for (const key of this.keys) {
      const direction = KEY_DIRECTIONS[key];
      if (direction) next.add(direction);
    }
    this.updatePressed(next);
    if (!this.canSend() || this.mode !== "manual") return;
    this.sendChanged({
      dx: axis(next.has("right"), next.has("left")),
      dy: axis(next.has("down"), next.has("up")),
    });
  }

  private updatePressed(next: ReadonlySet<InputDirection>): void {
    if (
      next.size === this.pressed.size &&
      [...next].every((value) => this.pressed.has(value))
    )
      return;
    this.pressed = next;
    for (const listener of this.listeners) listener();
  }

  private stop(): void {
    this.sendChanged({ dx: 0, dy: 0 });
  }

  private sendChanged(direction: Direction): void {
    if (direction.dx === this.lastDirection.dx && direction.dy === this.lastDirection.dy)
      return;
    this.lastDirection = { dx: direction.dx, dy: direction.dy };
    this.send(this.lastDirection);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.canSend() ||
      this.mode !== "manual" ||
      editingControl(event.target) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const key = event.key.toLowerCase();
    if (!Object.hasOwn(KEY_DIRECTIONS, key)) return;
    event.preventDefault();
    this.keys.add(key);
    this.update();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!this.keys.delete(key)) return;
    if (this.canSend() && this.mode === "manual" && !editingControl(event.target))
      event.preventDefault();
    this.update();
  };

  private onBlur = (): void => {
    this.focused = false;
    this.reset();
  };
  private onFocus = (): void => {
    this.focused = true;
  };
  private onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.reset();
  };
  private onFocusIn = (event: FocusEvent): void => {
    if (editingControl(event.target)) this.reset();
  };
  private onPointerRelease = (event: PointerEvent): void =>
    this.releasePointer(event.pointerId);
}

export function createInputController(
  send: (direction: Direction) => void,
): InputController {
  return new InputController(send);
}
