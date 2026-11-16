import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getData, loadSample, replaceData, undoSample } from './store';
import { emptyData } from './seed';

describe('sample data over real data', () => {
  it('keeps the real data, marks sample mode, and brings the real data back', async () => {
    const real = { ...emptyData(getData()), incomeStr: '1234567' };
    real.settings = { ...real.settings, name: 'Real me' };
    replaceData(real);
    await loadSample();
    expect(getData().settings.sampleMode).toBe(true);
    expect(getData().incomeStr).not.toBe('1234567');
    await loadSample(); // a second load must not overwrite the saved real copy
    expect(await undoSample()).toBe(true);
    expect(getData().incomeStr).toBe('1234567');
    expect(getData().settings.name).toBe('Real me');
    expect(getData().settings.sampleMode).toBeUndefined();
    expect(await undoSample()).toBe(false);
  });
  it('starting fresh leaves sample mode', () => {
    expect(emptyData({ ...getData(), settings: { ...getData().settings, sampleMode: true } }).settings.sampleMode).toBeUndefined();
  });
});
