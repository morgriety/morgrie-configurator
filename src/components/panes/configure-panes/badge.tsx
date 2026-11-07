import {definitionForDevice} from 'src/utils/model-definitions';
import {useEffect, useMemo, useRef, useState} from 'react';
import styled from 'styled-components';
import {HeaderChevron, HeaderPlus} from '../../menus/header-icons';
import {HID} from '../../../shims/node-hid';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getDefinitions,
  getSelectedDefinition,
} from 'src/store/definitionsSlice';
import {
  getConnectedDevices,
  getSelectedDevicePath,
} from 'src/store/devicesSlice';
import {
  reloadConnectedDevices,
  selectConnectedDeviceByPath,
} from 'src/store/devicesThunks';
import {isElectron} from 'src/utils/running-context';
import {useTranslation} from 'react-i18next';
import {
  getConnectedDefinitionNames,
  getSelectedDefinitionName,
} from 'src/store/definitionNameSlice';

const Container = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: 228px;
  pointer-events: all;

  @media (max-width: 760px) {
    width: 190px;
  }
`;

const KeyboardTitle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 0 15px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9px;
  background: transparent;
  color: #f1eeeb;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover,
  &[aria-expanded="true"] {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.25);
  }

  &:active {
    background: rgba(255, 255, 255, 0.1);
  }

  &&:focus-visible {
    outline: 2px solid #e0dedc;
    outline-offset: 3px;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
`;

const KeyboardList = styled.div`
  position: absolute;
  top: 47px;
  right: 0;
  z-index: 2;
  box-sizing: border-box;
  width: max-content;
  min-width: 228px;
  max-width: min(360px, calc(100vw - 32px));
  max-height: min(360px, calc(100vh - 90px));
  overflow-y: auto;
  padding: 5px;
  border: 1px solid var(--mg-border);
  border-radius: 9px;
  background: var(--mg-editor);
  box-shadow: 0 6px 18px rgba(33, 33, 33, 0.1);
`;

const KeyboardButton = styled.button<{$selected?: boolean}>`
  display: block;
  width: 100%;
  padding: 9px 11px;
  border: none;
  border-radius: 5px;
  background: ${(p) => (p.$selected ? 'var(--mg-nav-active)' : 'transparent')};
  color: var(--mg-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: ${(p) => (p.$selected ? 600 : 400)};
  line-height: 20px;
  letter-spacing: 0;
  cursor: pointer;
  text-align: left;

  transition: background 140ms ease;
  overflow-wrap: anywhere;

  &:hover,
  &:active {
    background: var(--mg-nav-active);
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -2px;
  }

  svg {
    margin-left: 10px;
  }
`;

const ConnectionError = styled.div`
  position: absolute;
  top: 47px;
  right: 0;
  box-sizing: border-box;
  width: 280px;
  padding: 12px;
  border: 1px solid var(--mg-border);
  border-radius: 9px;
  background: var(--mg-editor);
  color: var(--mg-text-secondary);
  font-size: 13px;
  line-height: 20px;
`;

export const Badge = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const definitions = useAppSelector(getDefinitions);
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedDefinitionName = useAppSelector(getSelectedDefinitionName);
  const getConnectedDefinitionName = useAppSelector(getConnectedDefinitionNames);
  const connectedDevices = useAppSelector(getConnectedDevices);
  const selectedPath = useAppSelector(getSelectedDevicePath);
  const [showList, setShowList] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const connectedKeyboards = useMemo(
    () =>
      Object.entries(connectedDevices)
        .filter(
          ([, device]) =>
            definitionForDevice(device, definitions),
        )
        .map(([path, device]) => ({
          path,
          name: getConnectedDefinitionName(device),
        })),
    [connectedDevices, definitions, getConnectedDefinitionName],
  );
  const hasSelectedDevice = !!(
    selectedDefinition &&
    selectedPath &&
    connectedDevices[selectedPath]
  );

  useEffect(() => {
    if (!showList && !connectionError) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowList(false);
        setConnectionError(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowList(false);
        setConnectionError(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showList, connectionError]);

  const connectKeyboard = async (authorizeNew = false) => {
    setShowList(false);
    setConnectionError(false);
    setIsConnecting(true);
    try {
      if (authorizeNew) {
        const device = await HID.requestDevice();
        if (device) {
          await dispatch(selectConnectedDeviceByPath((device as any).__path));
        }
      } else {
        await dispatch(reloadConnectedDevices());
      }
    } catch {
      setConnectionError(true);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Container ref={containerRef}>
      <KeyboardTitle
        ref={triggerRef}
        type="button"
        disabled={isConnecting}
        aria-label={t('Select keyboard')}
        aria-expanded={showList}
        aria-controls="morgrie-device-options"
        title={hasSelectedDevice ? selectedDefinitionName : t('Connect keyboard')}
        onClick={() => {
          setConnectionError(false);
          if (connectedKeyboards.length) {
            setShowList((open) => !open);
          } else {
            connectKeyboard();
          }
        }}
      >
        <span>
          {isConnecting
            ? t('Connecting…')
            : hasSelectedDevice
            ? selectedDefinitionName
            : t('Connect keyboard')}
        </span>
        {connectedKeyboards.length ? <HeaderChevron /> : <HeaderPlus />}
      </KeyboardTitle>
      {showList && (
        <KeyboardList id="morgrie-device-options" aria-label={t('Connected keyboards')}>
          {connectedKeyboards.map(({path, name}) => (
            <KeyboardButton
              type="button"
              key={path}
              $selected={path === selectedPath}
              aria-pressed={path === selectedPath}
              onClick={() => {
                dispatch(selectConnectedDeviceByPath(path));
                setShowList(false);
                triggerRef.current?.focus();
              }}
            >
              {name}
            </KeyboardButton>
          ))}
          {!isElectron && (
            <KeyboardButton type="button" onClick={() => connectKeyboard(true)}>
              {t('Authorize New')}
              <HeaderPlus />
            </KeyboardButton>
          )}
        </KeyboardList>
      )}
      {connectionError && (
        <ConnectionError role="status">
          {t('Unable to connect. Check your keyboard and try again.')}
        </ConnectionError>
      )}
    </Container>
  );
};