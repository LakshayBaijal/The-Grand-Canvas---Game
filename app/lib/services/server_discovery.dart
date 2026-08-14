import 'package:multicast_dns/multicast_dns.dart';

// Must match SERVICE_TYPE in server/src/discovery.ts.
const _serviceName = '_grand-canvas._tcp.local';

/// Looks for a Grand Canvas server advertising itself on the local
/// Wi-Fi network and returns its `host:port`, or null if none answers within
/// [timeout]. This is what lets the app "just work" across different
/// networks (home, office, ...) without anyone typing an IP address.
Future<String?> discoverServer({Duration timeout = const Duration(seconds: 3)}) async {
  final client = MDnsClient();
  try {
    await client.start();

    await for (final ptr in client
        .lookup<PtrResourceRecord>(ResourceRecordQuery.serverPointer(_serviceName))
        .timeout(timeout, onTimeout: (sink) => sink.close())) {
      await for (final srv in client.lookup<SrvResourceRecord>(
        ResourceRecordQuery.service(ptr.domainName),
      )) {
        await for (final ip in client.lookup<IPAddressResourceRecord>(
          ResourceRecordQuery.addressIPv4(srv.target),
        )) {
          return '${ip.address.address}:${srv.port}';
        }
      }
    }
  } catch (_) {
    // Best-effort: some networks block multicast entirely (client
    // isolation). Falling back to manual entry is the expected behavior.
  } finally {
    client.stop();
  }
  return null;
}
