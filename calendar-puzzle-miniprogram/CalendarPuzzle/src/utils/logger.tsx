export const logAction = (message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  console.log(`[ACTION] ${timestamp} - ${message}`, ...args);
};

export const logDebug = (message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  console.debug(`[DEBUG] ${timestamp} - ${message}`, ...args);
};

export const logError = (message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  console.error(`[ERROR] ${timestamp} - ${message}`, ...args);
};

export const logWarn = (message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  console.warn(`[WARN] ${timestamp} - ${message}`, ...args);
};
