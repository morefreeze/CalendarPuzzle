// Stamina system: each game costs stamina equal to blocks to place
// Recovery: 1 point per 8 minutes, max 120

const STORAGE_KEY = 'calendarPuzzleStamina';
const MAX_STAMINA = 120;
const RECOVER_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes in ms

interface StaminaData {
  stamina: number;
  lastUpdateTime: number;
}

function load(): StaminaData {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  // First time: full stamina
  return { stamina: MAX_STAMINA, lastUpdateTime: Date.now() };
}

function save(data: StaminaData): void {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/** Calculate current stamina with time-based recovery */
export function getStamina(): number {
  const data = load();
  const now = Date.now();
  const elapsed = now - data.lastUpdateTime;
  const recovered = Math.floor(elapsed / RECOVER_INTERVAL_MS);
  const current = Math.min(data.stamina + recovered, MAX_STAMINA);

  // Persist the updated value and advance the timestamp
  if (recovered > 0) {
    save({
      stamina: current,
      lastUpdateTime: data.lastUpdateTime + recovered * RECOVER_INTERVAL_MS,
    });
  }

  return current;
}

/** Get time in seconds until next stamina point recovers, 0 if full */
export function getRecoverSeconds(): number {
  const data = load();
  const current = getStamina(); // also persists recovery
  if (current >= MAX_STAMINA) return 0;
  const reloaded = load(); // re-read after getStamina persisted
  const elapsed = Date.now() - reloaded.lastUpdateTime;
  const remaining = RECOVER_INTERVAL_MS - elapsed;
  return Math.max(0, Math.ceil(remaining / 1000));
}

/** Try to consume stamina. Returns true if successful, false if insufficient. */
export function consumeStamina(cost: number): boolean {
  const current = getStamina(); // triggers recovery calculation
  if (current < cost) return false;
  const data = load(); // re-read after getStamina persisted recovery
  save({ stamina: current - cost, lastUpdateTime: data.lastUpdateTime });
  return true;
}

export const MAX_STAMINA_VALUE = MAX_STAMINA;
