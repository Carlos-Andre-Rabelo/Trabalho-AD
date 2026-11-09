import os from 'os';

export interface NetworkInterfaceOption {
  name: string;
  address: string;
  family: string;
  isWifiOrEthernet: boolean;
}

export interface NetworkInfoResponse {
  primaryIp: string;
  interfaces: NetworkInterfaceOption[];
}

export function getNetworkInfo(): NetworkInfoResponse {
  const interfaces = os.networkInterfaces();
  const candidates: NetworkInterfaceOption[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const lower = name.toLowerCase();
        const isWifiOrEthernet =
          lower.includes('wi-fi') ||
          lower.includes('wifi') ||
          lower.includes('wlan') ||
          lower.includes('wireless') ||
          lower.includes('ethernet') ||
          lower.includes('eth') ||
          lower.includes('en');

        candidates.push({
          name,
          address: addr.address,
          family: addr.family,
          isWifiOrEthernet,
        });
      }
    }
  }

  // Ordena para que Wi-Fi e Ethernet venham no topo, seguidos de 192.168.x.x e 10.x.x.x
  candidates.sort((a, b) => {
    if (a.isWifiOrEthernet && !b.isWifiOrEthernet) return -1;
    if (!a.isWifiOrEthernet && b.isWifiOrEthernet) return 1;
    if (a.address.startsWith('192.168.') && !b.address.startsWith('192.168.')) return -1;
    if (!a.address.startsWith('192.168.') && b.address.startsWith('192.168.')) return 1;
    return 0;
  });

  const primaryIp = candidates.length > 0 ? candidates[0].address : 'localhost';

  return {
    primaryIp,
    interfaces: candidates,
  };
}
