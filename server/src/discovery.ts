import { Bonjour } from "bonjour-service";

// Must match the service type the app browses for in
// app/lib/services/server_discovery.dart.
const SERVICE_TYPE = "grand-canvas";

/** Advertises this server on the local network via mDNS/Bonjour, so the app
 *  can find it automatically without anyone typing an IP address — handy
 *  since that address changes every time you move to a different Wi-Fi. */
export function advertiseOnLocalNetwork(port: number): void {
  const bonjour = new Bonjour();
  bonjour.publish({ name: "Grand Canvas", type: SERVICE_TYPE, port });
  console.log(`Advertising on local network as _${SERVICE_TYPE}._tcp`);
}
