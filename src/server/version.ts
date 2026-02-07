export const appVersion = {
  version: process.env.KLOVI_VERSION ?? "dev",
  commitHash: process.env.KLOVI_COMMIT || null,
};
