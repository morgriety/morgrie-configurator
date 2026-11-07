import {useEffect} from 'react';
import styled from 'styled-components';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getSelectedDefinition} from 'src/store/definitionsSlice';
import {
  getIsSelectedDeviceReady,
  getSelectedConnectedDevice,
} from 'src/store/devicesSlice';
import {
  getLoadProgress,
  setConfigureKeyboardIsSelectable,
} from 'src/store/keymapSlice';
import {useConfigureNavigation} from '../configurator/configure-navigation';
import {useTranslation} from 'react-i18next';

const Editor = styled.div<{$keymap: boolean}>`
  display: grid;
  grid-template-columns: ${({$keymap}) =>
    $keymap ? 'minmax(0, 1fr)' : 'minmax(150px, max-content) minmax(0, 1fr)'};
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--mg-editor);
`;

const EmptyEditor = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 56.79fr) minmax(0, 43.21fr);
  flex: 1;
  min-height: 0;
  padding: 28px 0;
  box-sizing: border-box;

  > section {
    padding: 0 38px;
  }

  > section + section {
    border-left: 1px solid var(--mg-border);
  }

  h2 {
    margin: 0 0 20px;
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  p {
    color: var(--mg-text-secondary);
    margin: 0;
  }
`;

export const ConfigurePane = () => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const definition = useAppSelector(getSelectedDefinition);
  const loadProgress = useAppSelector(getLoadProgress);
  const device = useAppSelector(getSelectedConnectedDevice);
  const isReady = useAppSelector(getIsSelectedDeviceReady);
  const {selectedPane, selectedId} = useConfigureNavigation();
  const ready = !!device && isReady && !!definition && loadProgress === 1;

  useEffect(() => {
    dispatch(setConfigureKeyboardIsSelectable(ready && selectedId === 'keymap'));
    return () => {
      dispatch(setConfigureKeyboardIsSelectable(false));
    };
  }, [dispatch, ready, selectedId]);

  if (!ready || !selectedPane) {
    return (
      <EmptyEditor data-testid="keymap-editor-empty">
        <section>
          <h2>{t('Keycode')}</h2>
          <p>{t('Connect your keyboard to edit its keymap.')}</p>
        </section>
        <section>
          <h2>{t('Selected Key')}</h2>
          <p>{t('Select a key on your connected keyboard.')}</p>
        </section>
      </EmptyEditor>
    );
  }

  const SelectedPane = selectedPane.Pane;
  return (
    <Editor $keymap={selectedId === 'keymap'}>
      <SelectedPane key={`${device?.path}:${selectedId}`} />
    </Editor>
  );
};
