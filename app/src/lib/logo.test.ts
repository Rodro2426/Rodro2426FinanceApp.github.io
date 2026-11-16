import { describe, expect, it } from 'vitest';
import { logoUrl, siteHost } from './logo';

describe('siteHost', () => {
  it('takes the domain out of whatever was typed or pasted', () => {
    expect(siteHost('davivienda.com')).toBe('davivienda.com');
    expect(siteHost('  https://www.Bancolombia.com/personas?x=1 ')).toBe('bancolombia.com');
    expect(siteHost('nequi.com.co/')).toBe('nequi.com.co');
  });
  it('rejects things that are not websites', () => {
    for (const t of ['', 'Davivienda', 'my bank', 'http://', 'javascript:alert(1)']) expect(siteHost(t)).toBeNull();
  });
  it('builds the icon address with only the domain', () => {
    expect(logoUrl('nu.com.co')).toBe('https://www.google.com/s2/favicons?domain=nu.com.co&sz=128');
  });
});
