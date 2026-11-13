const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function makeTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatch(type, properties = {}) {
      const event = {
        target: this,
        key: "",
        button: 0,
        prevented: false,
        preventDefault() {
          this.prevented = true;
        },
        ...properties,
      };
      for (const callback of listeners.get(type) || []) callback(event);
      return event;
    },
    closest() {
      return null;
    },
  };
}

function setup() {
  const window = makeTarget();
  const buttons = ["up", "down", "left", "right"].map((direction) => ({
    ...makeTarget(),
    dataset: { direction },
    attributes: {},
    classList: { toggle() {} },
    setPointerCapture() {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  }));
  const document = {
    ...makeTarget(),
    visibilityState: "visible",
    querySelectorAll: () => buttons,
  };
  const sent = [];
  const context = vm.createContext({
    window,
    document,
    console: { warn() {} },
    sendMessage: (message) => sent.push({ ...message }),
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../public/input.js"), "utf8"),
    context,
  );
  context.startListeningForInput();
  const lastDirection = () => {
    const message = sent.at(-1);
    return message && [message.dx, message.dy];
  };
  return { context, window, document, buttons, sent, lastDirection };
}

test("WASD and arrows combine, releases stop, and duplicate keys retain a direction", () => {
  const { window, sent, lastDirection } = setup();
  assert.equal(window.dispatch("keydown", { key: "w" }).prevented, true);
  window.dispatch("keydown", { key: "ArrowUp" });
  window.dispatch("keyup", { key: "w" });
  assert.deepEqual(lastDirection(), [0, -1]);
  assert.equal(sent.length, 1);
  window.dispatch("keydown", { key: "d" });
  assert.deepEqual(lastDirection(), [1, -1]);
  window.dispatch("keyup", { key: "ArrowUp" });
  window.dispatch("keyup", { key: "d" });
  assert.deepEqual(lastDirection(), [0, 0]);
});

test("typing and modified browser shortcuts do not move the player or cancel defaults", () => {
  const { window, sent } = setup();
  const input = { closest: () => ({ tagName: "INPUT" }) };
  assert.equal(
    window.dispatch("keydown", { key: "w", target: input }).prevented,
    false,
  );
  assert.equal(
    window.dispatch("keydown", { key: "ArrowDown", target: input }).prevented,
    false,
  );
  assert.equal(
    window.dispatch("keydown", { key: "a", ctrlKey: true }).prevented,
    false,
  );
  assert.equal(sent.length, 0);
});

test("changing focus or hiding the tab releases movement", () => {
  const { window, document, lastDirection } = setup();
  window.dispatch("keydown", { key: "a" });
  document.dispatch("focusin", { target: { closest: () => ({}) } });
  assert.deepEqual(lastDirection(), [0, 0]);
  window.dispatch("keydown", { key: "d" });
  window.dispatch("blur");
  assert.deepEqual(lastDirection(), [0, 0]);
  window.dispatch("focus");
  window.dispatch("keydown", { key: "w" });
  document.visibilityState = "hidden";
  document.dispatch("visibilitychange");
  assert.deepEqual(lastDirection(), [0, 0]);
});

test("rejoining installs no duplicate listeners and starts with released keys", () => {
  const { context, window, lastDirection } = setup();
  window.dispatch("keydown", { key: "w" });
  context.setInputEnabled(false);
  const event = window.dispatch("keydown", { key: "ArrowDown" });
  assert.equal(event.prevented, false);
  context.startListeningForInput();
  assert.equal(window.listeners.get("keydown").length, 1);
  assert.deepEqual(lastDirection(), [0, 0]);
  window.dispatch("keydown", { key: "w" });
  assert.deepEqual(lastDirection(), [0, -1]);
});

test("touch controls combine two pointers and clear on cancellation or capture loss", () => {
  const { window, buttons, lastDirection } = setup();
  buttons[0].dispatch("pointerdown", { pointerId: 1 });
  buttons[3].dispatch("pointerdown", { pointerId: 2 });
  assert.deepEqual(lastDirection(), [1, -1]);
  assert.equal(buttons[0].attributes["aria-pressed"], "true");
  window.dispatch("pointercancel", { pointerId: 1 });
  assert.deepEqual(lastDirection(), [1, 0]);
  buttons[3].dispatch("lostpointercapture", { pointerId: 2 });
  assert.deepEqual(lastDirection(), [0, 0]);
});

test("direction buttons can be held with Space or Enter and release on blur", () => {
  const { buttons, lastDirection } = setup();
  buttons[2].dispatch("keydown", { key: " " });
  assert.deepEqual(lastDirection(), [-1, 0]);
  buttons[2].dispatch("blur");
  assert.deepEqual(lastDirection(), [0, 0]);
  buttons[1].dispatch("keydown", { key: "Enter" });
  assert.deepEqual(lastDirection(), [0, 1]);
  buttons[1].dispatch("keyup", { key: "Enter" });
  assert.deepEqual(lastDirection(), [0, 0]);
});

test("strategy mode excludes manual input, rejects bad values, and pauses when unfocused", () => {
  const { context, window, sent, lastDirection } = setup();
  context.setInputMode("strategy");
  context.sendStrategyDirection(1, -1);
  assert.deepEqual(lastDirection(), [1, -1]);
  assert.equal(window.dispatch("keydown", { key: "w" }).prevented, false);
  context.sendStrategyDirection(5, 0);
  assert.deepEqual(lastDirection(), [0, 0]);
  context.sendStrategyDirection(1, 0);
  window.dispatch("blur");
  assert.deepEqual(lastDirection(), [0, 0]);
  const count = sent.length;
  context.sendStrategyDirection(1, 0);
  assert.equal(sent.length, count);
  window.dispatch("focus");
  context.sendStrategyDirection(1, 0);
  assert.deepEqual(lastDirection(), [1, 0]);
  context.setInputMode("keyboard");
  assert.deepEqual(lastDirection(), [0, 0]);
});
