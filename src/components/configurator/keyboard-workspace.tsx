import {useState} from 'react';
import styled from 'styled-components';
import {useLocation} from 'wouter';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getConnectedDevices,
  getIsSelectedDeviceReady,
  getSelectedConnectedDevice,
  getSupportedIds,
} from 'src/store/devicesSlice';
import {getSelectedDefinition} from 'src/store/definitionsSlice';
import {getSelectedDefinitionName} from 'src/store/definitionNameSlice';
import {getLoadProgress} from 'src/store/keymapSlice';
import {reloadConnectedDevices} from 'src/store/devicesThunks';
import {getRenderMode} from 'src/store/settingsSlice';
import {LayerControl} from '../panes/configure-panes/layer-control';
import {HostKeyboardLayoutBadge} from '../panes/configure-panes/host-keyboard-layout-badge';
import {CanvasRouter as CanvasRouter2D} from '../two-string/canvas-router';
import {CanvasRouter as CanvasRouter3D} from '../three-fiber/canvas-router';
import {ConnectionStatus} from './connection-status';

const Workspace = styled.section<{$visible: boolean}>`
  display: ${({$visible}) => ($visible ? 'flex' : 'none')};
  flex-direction: column;
  position: relative;
  height: var(--mg-workspace-height);
  flex: 0 0 var(--mg-workspace-height);
  min-width: 0;
  box-sizing: border-box;
  padding: 34px 50px 24px 62px;
  background: linear-gradient(
    110deg,
    var(--mg-canvas),
    var(--mg-canvas-secondary)
  );

  @media (max-width: 1250px) {
    padding-left: 36px;
    padding-right: 36px;
  }

  @media (max-height: 900px) {
    padding-top: 25px;
    padding-bottom: 18px;
  }

  @media (max-width: 850px) {
    padding: 24px 20px;
  }
`;

const Heading = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex: 0 0 auto;

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 500;
    line-height: 38px;
    letter-spacing: 3.5px;
    text-transform: uppercase;
  }

  p {
    margin: 8px 0 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 21px;
    letter-spacing: 5px;
    color: var(--mg-text-secondary);
  }

  @media (max-width: 1100px) {
    h1 {
      font-size: 24px;
      line-height: 34px;
      letter-spacing: 2px;
    }
  }

  @media (max-width: 850px) {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;

    h1 {
      font-size: 20px;
    }

    p {
      letter-spacing: 2px;
    }
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 33px;
  min-height: 34px;
  flex: 0 0 auto;

  @media (max-height: 900px) {
    margin-top: 20px;
  }
`;

const Stage = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  margin-top: 20px;
`;

const ConnectionPrompt = styled.div`
  position: absolute;
  z-index: 3;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  text-align: center;

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 500;
    line-height: 30px;
    letter-spacing: 1px;
  }

  p {
    margin: 0;
    max-width: 440px;
    color: var(--mg-text-secondary);
  }

  button {
    border: 1px solid var(--mg-text);
    border-radius: 7px;
    padding: 10px 24px;
    background: var(--mg-text);
    color: var(--mg-editor);
    font-size: 14px;
    line-height: 22px;
    cursor: pointer;
  }
`;

export const KeyboardWorkspace = () => {
  const {t} = useTranslation();
  const [path] = useLocation();
  const dispatch = useAppDispatch();
  const definition = useAppSelector(getSelectedDefinition);
  const name = useAppSelector(getSelectedDefinitionName);
  const device = useAppSelector(getSelectedConnectedDevice);
  const devices = useAppSelector(getConnectedDevices);
  const isReady = useAppSelector(getIsSelectedDeviceReady);
  const supportedIds = useAppSelector(getSupportedIds);
  const progress = useAppSelector(getLoadProgress);
  const renderMode = useAppSelector(getRenderMode);
  const [requesting, setRequesting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const ready = !!device && isReady;
  const initializing = !!device || Object.keys(devices).length > 0;
  const configure = path === '/';
  const visible = ['/', '/test', '/design', '/debug'].includes(path);
  // The primary configurator uses the real 2D renderer. The saved VIA 3D option
  // remains available for its existing Design/Tester views.
  const CanvasRouter =
    !configure && renderMode === '3D' ? CanvasRouter3D : CanvasRouter2D;
  const title = configure
    ? definition && name
      ? name
      : 'MORGRIE CONFIGURATOR'
    : path === '/test'
    ? t('Key Tester')
    : path === '/design'
    ? t('Design')
    : t('Debug');
  const authorize = async () => {
    setRequesting(true);
    setConnectionError(false);
    try {
      await dispatch(reloadConnectedDevices());
    } catch {
      setConnectionError(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Workspace $visible={visible} data-testid="keyboard-workspace">
      <Heading>
        <div>
          <h1>{title}</h1>
          <p>KEYBOARD CONFIGURATOR</p>
        </div>
        <ConnectionStatus />
      </Heading>
      <Toolbar>
        {configure && ready ? (
          <>
            <LayerControl />
            <HostKeyboardLayoutBadge />
          </>
        ) : null}
      </Toolbar>
      <Stage data-testid="keyboard-stage">
        <CanvasRouter />
        {configure && (!ready || !definition || progress !== 1) && (
          <ConnectionPrompt>
            <h2>
              {t(initializing ? 'Loading keyboard' : 'Connect Your Keyboard')}
            </h2>
            <p>
              {t(
                initializing
                  ? 'Reading your keyboard configuration.'
                  : 'Connect your VIA-compatible keyboard by USB, then authorize it in your browser.',
              )}
            </p>
            {!initializing && (
              <button
                onClick={authorize}
                disabled={requesting || Object.keys(supportedIds).length === 0}
              >
                {t(requesting ? 'Connecting…' : 'Authorize device')}
              </button>
            )}
            {connectionError && (
              <p role="alert">
                {t('Unable to connect. Check your keyboard and try again.')}
              </p>
            )}
          </ConnectionPrompt>
        )}
      </Stage>
    </Workspace>
  );
};
