import type {VIAKey} from '@the-via/reader';
import {getMacroKeycodeIndex, isMacroKeycodeByte} from 'src/utils/key';
import {calculatePointPosition} from 'src/utils/keyboard-rendering';

// Rows are built from the currently visible physical layout, including its options.
export function getKeyboardFocusTarget(current: VIAKey, rows: VIAKey[][], key: string) {
  const rowIndex = rows.findIndex((row) => row.includes(current));
  if (rowIndex < 0) return;
  const row = rows[rowIndex];
  const column = row.indexOf(current);
  switch (key) {
    case 'Home': return row[0];
    case 'End': return row[row.length - 1];
    case 'ArrowLeft': return row[column - 1] ?? rows[rowIndex - 1]?.at(-1) ?? current;
    case 'ArrowRight': return row[column + 1] ?? rows[rowIndex + 1]?.[0] ?? current;
    case 'ArrowUp':
    case 'ArrowDown': {
      const adjacent = rows[rowIndex + (key === 'ArrowDown' ? 1 : -1)];
      if (!adjacent?.length) return current;
      const [x] = calculatePointPosition(current);
      const distance = (k: VIAKey) => Math.abs(calculatePointPosition(k)[0] - x);
      return adjacent.reduce((closest, k) => distance(k) < distance(closest) ? k : closest);
    }
  }
}

export function getNavigableKeyName(
  legend: {label?: string; tooltipLabel?: string; topLabel?: string; bottomLabel?: string} | undefined,
  byte: number,
  basicKeyToByte: Record<string, number>,
  byteToKey: Record<number, string>,
) {
  // The macro tooltip can contain the user's entire recorded sequence.
  if (isMacroKeycodeByte(byte, basicKeyToByte)) {
    return `MACRO(${getMacroKeycodeIndex(byte, basicKeyToByte)})`;
  }
  return legend?.tooltipLabel || legend?.label ||
    [legend?.topLabel, legend?.bottomLabel].filter(Boolean).join(' ') ||
    byteToKey[byte] || '';
}
