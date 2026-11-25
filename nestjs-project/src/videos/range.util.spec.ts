import { parseByteRange } from './range.util';

describe('parseByteRange', () => {
  it('parses an inclusive range', () => {
    expect(parseByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
  });

  it('clamps the end to the object size', () => {
    expect(parseByteRange('bytes=90-999', 100)).toEqual({ start: 90, end: 99 });
  });

  it('supports an open-ended range', () => {
    expect(parseByteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
  });

  it('supports suffix ranges', () => {
    expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
  });

  it('rejects unsatisfiable ranges', () => {
    expect(() => parseByteRange('bytes=100-', 100)).toThrow('INVALID_RANGE');
  });
});
