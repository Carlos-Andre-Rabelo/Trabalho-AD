import { apiRequest } from './client.js';

export interface NetworkInterfaceOption {
  name: string;
  address: string;
  family: string;
  isWifiOrEthernet: boolean;
}

export interface NetworkInfo {
  primaryIp: string;
  interfaces: NetworkInterfaceOption[];
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    const res = await apiRequest<{ success: boolean; data: NetworkInfo }>('/network-info');
    return res.data;
  } catch (err) {
    return {
      primaryIp: typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost',
      interfaces: [],
    };
  }
}
