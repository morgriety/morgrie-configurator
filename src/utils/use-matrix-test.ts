import {VIADefinitionV2, VIADefinitionV3} from '@the-via/reader';
import {useDispatch} from 'react-redux';
import {KeyboardAPI, KeyboardValue, PROTOCOL_GAMMA} from './keyboard-api';
import {useEffect, useState} from 'react';
import {setTestMatrixEnabled} from 'src/store/settingsSlice';
import {ConnectedDevice, TestKeyState} from 'src/types/types';

function applyMatrixChanges(
  previousKeys: TestKeyState[],
  previousBytes: number[],
  bytes: number[],
  rows: number,
  cols: number,
) {
  const keys = previousKeys.length === rows * cols
    ? [...previousKeys]
    : Array<TestKeyState>(rows * cols).fill(TestKeyState.Initial);
  const bytesPerRow = Math.ceil(cols / 8);
  bytes.forEach((value, index) => {
    const changed = value ^ (previousBytes[index] || 0);
    if (!changed) return;
    const row = Math.floor(index / bytesPerRow);
    const firstCol = 8 * (bytesPerRow - 1 - (index % bytesPerRow));
    for (let bit = 0; bit < Math.min(8, cols - firstCol); bit++) {
      const mask = 1 << bit;
      if (changed & mask) {
        keys[row * cols + firstCol + bit] = (value & mask)
          ? TestKeyState.KeyDown
          : TestKeyState.KeyUp;
      }
    }
  });
  return keys;
}

export const useMatrixTest = (
  startTest: boolean,
  api?: KeyboardAPI,
  device?: ConnectedDevice,
  selectedDefinition?: VIADefinitionV2 | VIADefinitionV3,
) => {
  const selectedKeyArr = useState<TestKeyState[]>([]);
  const [, setSelectedKeys] = selectedKeyArr;
  const dispatch = useDispatch();
  const path = device?.path;
  const protocol = device?.protocol;

  useEffect(() => {
    if (!startTest) return;
    if (!api || !path || protocol === undefined || protocol < PROTOCOL_GAMMA || !selectedDefinition) {
      dispatch(setTestMatrixEnabled(false));
      return;
    }
    // Every activation owns its cancellation flag, even when reusing the same API.
    let active = true;
    const {rows, cols} = selectedDefinition.matrix;
    const bytesPerRow = Math.ceil(cols / 8);
    // Legacy reports have two header bytes and no row-offset parameter.
    const rowsPerQuery = Math.floor((protocol >= 12 ? 28 : 30) / bytesPerRow);
    setSelectedKeys([]);

    async function poll(target: KeyboardAPI, version: number) {
      let previous: number[] = [];
      try {
        if (!bytesPerRow || !rowsPerQuery || (version < 12 && rows > rowsPerQuery)) {
          throw new Error('Matrix exceeds the supported report size');
        }
        while (active) {
          const bytes: number[] = [];
          for (let offset = 0; offset < rows; offset += rowsPerQuery) {
            const size = Math.min(rows - offset, rowsPerQuery) * bytesPerRow;
            const chunk = await target.getKeyboardValue(
              KeyboardValue.SWITCH_MATRIX_STATE, version >= 12 ? [offset] : [], size,
            );
            if (!active) return;
            if (chunk.length !== size) throw new Error('Incomplete matrix response');
            bytes.push(...chunk);
          }
          if (bytes.some((value, index) => value !== (previous[index] || 0))) {
            const before = previous;
            setSelectedKeys(keys => active ? applyMatrixChanges(keys, before, bytes, rows, cols) : keys);
          }
          previous = bytes;
          await target.timeout(20);
        }
      } catch {
        if (active) dispatch(setTestMatrixEnabled(false));
      }
    }

    void poll(api.whileCurrent(() => active), protocol);
    return () => { active = false; };
  }, [startTest, api, path, protocol, selectedDefinition, dispatch]);

  useEffect(() => {
    if (!startTest) return;
    const preventDefault = (evt: KeyboardEvent) => evt.preventDefault();
    window.addEventListener('keydown', preventDefault);
    window.addEventListener('keyup', preventDefault);
    return () => {
      window.removeEventListener('keydown', preventDefault);
      window.removeEventListener('keyup', preventDefault);
    };
  }, [startTest]);

  return selectedKeyArr;
};
