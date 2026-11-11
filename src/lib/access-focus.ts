// One-shot, browser-memory-only navigation intent; never credentials or authority.
let architectReturn = false;
export function requestArchitectReturnFocus() { architectReturn = true; }
export function takeArchitectReturnFocus() {
  const requested = architectReturn;
  architectReturn = false;
  return requested;
}