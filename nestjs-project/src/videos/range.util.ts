export interface ByteRange {
  start: number;
  end: number;
}

export function parseByteRange(
  header: string | undefined,
  size: number,
): ByteRange | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) throw new RangeError('INVALID_RANGE');

  let start: number;
  let end: number;

  if (match[1] === '' && match[2] !== '') {
    const suffixLength = Number(match[2]);
    if (suffixLength <= 0) throw new RangeError('INVALID_RANGE');
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    if (match[1] === '') throw new RangeError('INVALID_RANGE');
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }

  if (start >= size || end < start) throw new RangeError('INVALID_RANGE');
  return { start, end };
}
