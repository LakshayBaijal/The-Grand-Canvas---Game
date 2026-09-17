import { existsSync } from "node:fs";

/**
 * Loads the .env file, and must be the first import in index.ts.
 *
 * ES module imports run before the importing file's own body. google.ts
 * reads GOOGLE_CLIENT_ID the moment it is loaded, so if the .env file is
 * loaded from index.ts's body -- as it was -- google.ts has already looked
 * and found nothing, and sign-in is off however the server is configured.
 * A day was lost to that. Putting the load in its own module, imported
 * first, is the one ordering that ES modules guarantee.
 *
 * Settings come from a .env file at the repo root (see .env.example there),
 * or from the process environment, which wins when both set the same name.
 * Looked for in the server folder first, then one level up, so it works
 * both from `server/` (the start scripts) and from a deployed checkout.
 */
for (const candidate of [".env", "../.env"]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}
