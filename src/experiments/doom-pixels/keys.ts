// Woof's own codes, from its doomkeys.h, for the keys it binds by default.
const upArrow = 0xad;
const downArrow = 0xaf;
const leftArrow = 0xac;
const rightArrow = 0xae;
const rightShift = 0x8c;
const rightControl = 0x8d;
const rightAlt = 0x8e;
const escape = 27;
const enter = 13;
const tab = 9;
const backspace = 0x7f;
const space = 32;

const byCode: Record<string, number> = {
  ArrowUp: upArrow,
  ArrowDown: downArrow,
  ArrowLeft: leftArrow,
  ArrowRight: rightArrow,
  ShiftLeft: rightShift,
  ShiftRight: rightShift,
  ControlLeft: rightControl,
  ControlRight: rightControl,
  AltLeft: rightAlt,
  AltRight: rightAlt,
  Escape: escape,
  Enter: enter,
  Backspace: backspace,
  Space: space,
  KeyF: rightControl,
  KeyE: space,
  KeyM: tab,
  Minus: "-".charCodeAt(0),
  Equal: "=".charCodeAt(0),
};

export interface GameKey {
  code: string;
  key: string;
}

export function doomKey({ code, key }: GameKey) {
  const mapped = byCode[code];
  if (mapped !== undefined) return mapped;
  if (/^Digit\d$/.test(code)) return code.charCodeAt(5);
  if (/^Key[A-Z]$/.test(code)) return code.toLowerCase().charCodeAt(3);
  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    return key.toLowerCase().charCodeAt(0);
  }
  return null;
}

export const pauseCode = "KeyP";
