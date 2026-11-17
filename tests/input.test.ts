// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInputController, type InputController } from "../client/input.js";
import type { Direction } from "../shared/protocol.js";

const controllers: InputController[] = [];
function setup() {
  const directions: Direction[] = [];
  const controller = createInputController((direction) => directions.push(direction));
  controllers.push(controller);
  controller.attach();
  controller.setEnabled(true);
  const key = (
    type: "keydown" | "keyup",
    value: string,
    extra: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent(type, {
      key: value,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
    window.dispatchEvent(event);
    return event;
  };
  return { controller, directions, key, last: () => directions.at(-1) };
}
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  document.body.innerHTML = "";
});

describe("input controller", () => {
  it("combines WASD/arrows, retains aliases, and deduplicates repeat input", () => {
    const { controller, directions, key, last } = setup();
    key("keydown", "w");
    key("keydown", "ArrowUp");
    key("keydown", "w");
    expect(directions).toEqual([{ dx: 0, dy: -1 }]);
    key("keyup", "w");
    expect(last()).toEqual({ dx: 0, dy: -1 });
    key("keydown", "d");
    expect(last()).toEqual({ dx: 1, dy: -1 });
    key("keyup", "ArrowUp");
    key("keyup", "d");
    expect(last()).toEqual({ dx: 0, dy: 0 });
    expect(controller.getPressed().size).toBe(0);
  });

  it("keeps a stable pressed snapshot until held directions change", () => {
    const { controller, key } = setup();
    key("keydown", "a");
    const pressed = controller.getPressed();
    key("keydown", "a");
    expect(controller.getPressed()).toBe(pressed);
    key("keyup", "a");
    expect(controller.getPressed()).not.toBe(pressed);
  });

  it("does not capture typing or modified browser shortcuts", () => {
    const { directions, key } = setup();
    expect(key("keydown", "a", { ctrlKey: true }).defaultPrevented).toBe(false);
    const input = document.createElement("input");
    document.body.append(input);
    const typed = new KeyboardEvent("keydown", {
      key: "w",
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(false);
    expect(directions).toEqual([]);
  });

  it("releases motion on blur, hidden tabs, dialog disablement, and form focus", () => {
    const { controller, key, last } = setup();
    key("keydown", "w");
    window.dispatchEvent(new Event("blur"));
    expect(last()).toEqual({ dx: 0, dy: 0 });
    window.dispatchEvent(new Event("focus"));
    key("keydown", "w");
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(last()).toEqual({ dx: 0, dy: 0 });
    hidden.mockRestore();
    key("keydown", "a");
    controller.setEnabled(false);
    expect(last()).toEqual({ dx: 0, dy: 0 });
    controller.setEnabled(true);
    key("keydown", "w");
    const input = document.createElement("input");
    document.body.append(input);
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(last()).toEqual({ dx: 0, dy: 0 });
  });

  it("combines touch pointers and stops when they release", () => {
    const { controller, last } = setup();
    controller.setPointer(1, "up");
    controller.setPointer(2, "right");
    expect(last()).toEqual({ dx: 1, dy: -1 });
    controller.releasePointer(1);
    expect(last()).toEqual({ dx: 1, dy: 0 });
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 2 }));
    expect(last()).toEqual({ dx: 0, dy: 0 });
  });

  it("excludes manual controls in strategy mode and stops invalid directions", () => {
    const { controller, directions, key, last } = setup();
    controller.setMode("strategy");
    key("keydown", "w");
    controller.setPointer(1, "up");
    expect(directions).toEqual([]);
    expect(controller.sendStrategy({ dx: 1, dy: 1 })).toBe(true);
    expect(controller.sendStrategy({ dx: 100, dy: 1 })).toBe(false);
    expect(last()).toEqual({ dx: 0, dy: 0 });
    window.dispatchEvent(new Event("blur"));
    expect(controller.sendStrategy({ dx: 1, dy: 1 })).toBe(false);
  });

  it("sends turns and stops when a strategy reuses its direction object", () => {
    const { controller, directions } = setup();
    controller.setMode("strategy");
    const direction = { dx: 1, dy: 0 };
    controller.sendStrategy(direction);
    direction.dx = 0;
    direction.dy = 1;
    controller.sendStrategy(direction);
    controller.sendStrategy(direction);
    direction.dy = 0;
    controller.sendStrategy(direction);

    expect(directions).toEqual([
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: 0 },
    ]);
  });

  it("supports setup-cleanup-setup without duplicate listeners or stale motion", () => {
    const { controller, directions, key, last } = setup();
    controller.attach();
    key("keydown", "w");
    expect(directions).toHaveLength(1);
    controller.dispose();
    key("keydown", "d");
    expect(last()).toEqual({ dx: 0, dy: 0 });
    controller.attach();
    controller.setEnabled(true);
    key("keydown", "d");
    expect(last()).toEqual({ dx: 1, dy: 0 });
    expect(directions).toHaveLength(3);
  });
});
