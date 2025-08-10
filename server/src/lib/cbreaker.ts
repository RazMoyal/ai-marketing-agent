
type State = "CLOSED" | "OPEN" | "HALF";
type Bucket = { state: State; failCount: number; lastFail: number; openUntil?: number };

const breakers = new Map<string, Bucket>();

export function cbAllow(key: string, failThreshold = 5, coolMs = 60_000) {
  const now = Date.now();
  const b = breakers.get(key);
  if (!b) { breakers.set(key, { state: "CLOSED", failCount: 0, lastFail: 0 }); return true; }
  if (b.state === "OPEN") {
    if (b.openUntil && now > b.openUntil) { b.state = "HALF"; return true; }
    return false;
  }
  return true;
}

export function cbReport(key: string, ok: boolean, failThreshold = 5, coolMs = 60_000) {
  const now = Date.now();
  const b = breakers.get(key) || { state: "CLOSED", failCount: 0, lastFail: 0 };
  if (ok) {
    if (b.state === "HALF") { b.state = "CLOSED"; b.failCount = 0; }
    else if (b.state === "CLOSED") { /* noop */ }
  } else {
    b.failCount += 1; b.lastFail = now;
    if (b.failCount >= failThreshold) { b.state = "OPEN"; b.openUntil = now + coolMs; }
  }
  breakers.set(key, b);
}
