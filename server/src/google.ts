import { OAuth2Client } from "google-auth-library";

/**
 * Verifying "who is this player" against Google.
 *
 * The point of this file is one sentence: **the server checks the signature,
 * it does not take the client's word.** A client saying "I am google user X"
 * is worth exactly as much as the device ids it replaces — the security comes
 * entirely from validating the token Google signed, against Google's own
 * public keys, and confirming it was minted for this app.
 *
 * Configuration is a single environment variable, GOOGLE_CLIENT_ID, holding
 * the **Web** OAuth client id from the Google Cloud console. It is the Web one
 * even though the app is Android: the Android client is what the phone signs
 * in with, but the id token's `aud` is the "server client id" the app passes
 * as serverClientId, which is the web credential.
 *
 * Unset means "no Google sign-in on this server" rather than a crash. That is
 * deliberate — the game is built to run on someone's laptop on a home Wi-Fi
 * with no internet, where Google sign-in cannot work anyway, and the rest of
 * the game must keep working there.
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";

export const googleEnabled = CLIENT_ID.length > 0;

const client = googleEnabled ? new OAuth2Client(CLIENT_ID) : null;

export type GoogleUser = {
  /** Google's stable per-user id. The only thing worth storing. */
  sub: string;
};

/**
 * Returns the verified user, or null if the token is anything other than a
 * genuine, unexpired, correctly-audienced Google id token.
 *
 * Never throws: a bad token is an ordinary thing for a server to be handed,
 * and the caller turns it into a normal error message.
 */
export async function verifyGoogle(idToken: string): Promise<GoogleUser | null> {
  if (!client) return null;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      // Rejects a token minted for some other application, which is the check
      // that stops one app's tokens being replayed against this one.
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    // verifyIdToken already checks `iss`, expiry and signature; sub is all we
    // want from what is left.
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
