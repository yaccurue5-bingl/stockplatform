// New Relic does not ship TypeScript declarations and @types/newrelic does not exist.
// This stub silences the TS2307 "Could not find declaration file" error.
// We only import newrelic for its side-effect (agent init), so no API typings needed.
declare module 'newrelic';
