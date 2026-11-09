import { describe, it, expect } from 'vitest';
import { getNetworkInfo } from '../../src/modules/network/network.service.js';

describe('Network Service', () => {
  it('should return network info with primaryIp and interfaces array', () => {
    const info = getNetworkInfo();
    expect(info).toBeDefined();
    expect(info.primaryIp).toBeDefined();
    expect(typeof info.primaryIp).toBe('string');
    expect(Array.isArray(info.interfaces)).toBe(true);
  });
});
