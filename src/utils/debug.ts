// Dev-only logging utility. Production builds emit no console output.
const isDev = import.meta.env.DEV === true;

export const debugLog = (...args: unknown[]): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export const debugError = (...args: unknown[]): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export const debugWarn = (...args: unknown[]): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
};
