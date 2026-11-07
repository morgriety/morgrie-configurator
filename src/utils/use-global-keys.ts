import {useEffect, useState} from 'react';
import {TestKeyState} from 'src/types/types';
import {getIndexByEvent} from './key-event';

type TestKeys = {[code: number]: TestKeyState};
export const useGlobalKeys = (enableGlobalKeys: boolean) => {
  const selectedKeysState = useState<TestKeys>({});
  const [, setSelectedKeys] = selectedKeysState;

  useEffect(() => {
    if (!enableGlobalKeys) return;
    const record = (evt: KeyboardEvent, state: TestKeyState) => {
      evt.preventDefault();
      const index = getIndexByEvent(evt);
      if (index < 0 || (state === TestKeyState.KeyDown && evt.repeat)) return;
      setSelectedKeys(keys => keys[index] === state ? keys : {...keys, [index]: state});
    };
    const down = (evt: KeyboardEvent) => record(evt, TestKeyState.KeyDown);
    const up = (evt: KeyboardEvent) => record(evt, TestKeyState.KeyUp);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enableGlobalKeys]);

  return selectedKeysState;
};
