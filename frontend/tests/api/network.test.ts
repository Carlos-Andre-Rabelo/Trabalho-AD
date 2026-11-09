import { describe, it, expect } from 'vitest';
import { getNetworkInfo } from '../../src/api/network.js';

describe('Network API Utility', () => {
  it('should return fallback network info when offline or in mock', async () => {
    const info = await getNetworkInfo();
    expect(info).toBeDefined();
    expect(info.primaryIp).toBeDefined();
    expect(Array.isArray(info.interfaces)).toBe(true);
  });
});
