import {consoleDeviceKey as deviceKey, autoFollowConsoleDevice} from 'src/utils/console-device';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import {AccentSelect} from '../inputs/accent-select';
import {Pane} from './pane';
import {isQMKConsoleDevice, QMK_CONSOLE_FILTER} from 'src/shims/node-hid';
import {formatNumberAsHex} from 'src/utils/format';
import {getDeviceDisplayName} from 'src/utils/device-display-name';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from 'src/store/hooks';
import {
  getIsSelectedDeviceReady,
  getSelectedConnectedDevice,
} from 'src/store/devicesSlice';

const ConsolePane = styled(Pane)`
  background: var(--mg-editor);
  color: var(--mg-text);
`;

const Container = styled.div`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  min-width: 0;
  padding: 28px 38px;
  font: 400 14px/22px var(--mg-font);

  @media (max-width: 1100px) {
    padding: 24px;
  }
`;

const Title = styled.h2`
  flex: 0 0 auto;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 1.3px;
`;

const Toolbar = styled.div`
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const DeviceSelect = styled.div`
  flex: 1 1 280px;
  min-width: 0;
  max-width: 520px;

  .mg-console-select__control {
    width: 100%;
  }
`;

const Console = styled.pre`
  background: var(--mg-sidebar);
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  box-sizing: border-box;
  color: var(--mg-text);
  flex: 1;
  font:
    12px/20px ui-monospace,
    SFMono-Regular,
    Menlo,
    Consolas,
    monospace;
  margin: 0;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const ActionButton = styled.button`
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 34px;
  background: var(--mg-editor);
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  color: var(--mg-text);
  cursor: pointer;
  padding: 0 16px;
  font: inherit;
  transition: background-color 140ms ease, border-color 140ms ease;

  &:hover:not(:disabled) {
    background: var(--mg-nav-active);
    border-color: var(--mg-text-secondary);
  }

  &:active:not(:disabled) {
    background: var(--mg-border);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 3px;
  }

  &:disabled {
    cursor: not-allowed;
    color: var(--mg-text-secondary);
    opacity: 0.5;
  }
`;

let sessionOutputs: Record<string, string> = {};

type HIDConsoleProps = {
  isActive?: boolean;
  params?: unknown;
};

export const HIDConsole = ({isActive = true}: HIDConsoleProps) => {
  const {t} = useTranslation();
  const selectedConnectedDevice = useAppSelector(getSelectedConnectedDevice);
  const isSelectedDeviceReady = useAppSelector(getIsSelectedDeviceReady);
  const [devices, setDevices] = useState<HIDDevice[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, string>>(
    sessionOutputs,
  );
  const consoleRef = useRef<HTMLPreElement>(null);
  const lastScopedPath = useRef<string | null>(null);
  const autoFollowedPath = useRef<string | null>(null);
  const decoder = useMemo(() => new TextDecoder(), []);

  useEffect(() => {
    sessionOutputs = outputs;
  }, [outputs]);

  const refreshDevices = useCallback(async () => {
    const consoleDevices = (await navigator.hid.getDevices()).filter(
      isQMKConsoleDevice,
    );
    setDevices(consoleDevices);
    setSelectedKey((current) =>
      current && consoleDevices.some((device) => deviceKey(device) === current)
        ? current
        : null,
    );
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.hid.addEventListener('connect', refreshDevices);
    navigator.hid.addEventListener('disconnect', refreshDevices);
    return () => {
      navigator.hid.removeEventListener('connect', refreshDevices);
      navigator.hid.removeEventListener('disconnect', refreshDevices);
    };
  }, [refreshDevices]);

  useEffect(() => {
    const scopedPath = selectedConnectedDevice?.path ?? null;
    if (lastScopedPath.current !== scopedPath) {
      lastScopedPath.current = scopedPath;
      autoFollowedPath.current = null;
      setSelectedKey(null);
    }
  }, [selectedConnectedDevice?.path]);

  useEffect(() => {
    if (!selectedConnectedDevice || !isSelectedDeviceReady) {
      return;
    }
    if (autoFollowedPath.current === selectedConnectedDevice.path) return;

    const consoleDevice = autoFollowConsoleDevice(devices, selectedConnectedDevice);
    if (consoleDevice) {
      setSelectedKey(deviceKey(consoleDevice));
      autoFollowedPath.current = selectedConnectedDevice.path;
    }
  }, [devices, isSelectedDeviceReady, selectedConnectedDevice]);

  const selectedDevice = devices.find(
    (device) => deviceKey(device) === selectedKey,
  );

  useEffect(() => {
    if (!selectedDevice) return;

    let cancelled = false;

    const handleReport = (event: HIDInputReportEvent) => {
      const bytes = new Uint8Array(
        event.data.buffer,
        event.data.byteOffset,
        event.data.byteLength,
      );
      const text = decoder.decode(bytes).replaceAll('\0', '');
      if (text) {
        setOutputs((current) => ({
          ...current,
          [selectedKey as string]:
            (current[selectedKey as string] ?? '') + text,
        }));
      }
    };

    const startListening = async () => {
      try {
        if (!selectedDevice.opened) await selectedDevice.open();
        if (!cancelled) {
          selectedDevice.addEventListener('inputreport', handleReport);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setOutputs((current) => ({
            ...current,
            [selectedKey as string]: `[Unable to open HID console: ${message}]\n`,
          }));
        }
      }
    };

    startListening();
    return () => {
      cancelled = true;
      selectedDevice.removeEventListener('inputreport', handleReport);
    };
  }, [decoder, selectedDevice, selectedKey]);

  const output = selectedKey ? (outputs[selectedKey] ?? '') : '';

  useLayoutEffect(() => {
    if (isActive && consoleRef.current) {
      consoleRef.current.scrollTo({
        top: consoleRef.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [isActive, output, selectedKey]);

  const options = devices.map((device) => ({
    value: deviceKey(device),
    label: `${getDeviceDisplayName(device) || t('Unnamed device')} (${formatNumberAsHex(device.vendorId, 4)}:${formatNumberAsHex(device.productId, 4)})`,
  }));

  const authorizeDevice = async () => {
    try {
      const requestedDevices = await navigator.hid.requestDevice({
        filters: [QMK_CONSOLE_FILTER],
      });
      const consoleDevice = requestedDevices.find(isQMKConsoleDevice);
      if (!consoleDevice) return;

      setDevices((current) => [
        ...current.filter(
          (candidate) => deviceKey(candidate) !== deviceKey(consoleDevice),
        ),
        consoleDevice,
      ]);
      setSelectedKey(deviceKey(consoleDevice));
    } catch (error) {
      // Cancelling the browser's device picker leaves the current selection alone.
      if (error instanceof DOMException && error.name === 'NotFoundError') return;
      const message = error instanceof Error ? error.message : String(error);
      setOutputs((current) => ({
        ...current,
        authorization: `[Unable to authorize HID console: ${message}]\n`,
      }));
      setSelectedKey('authorization');
    }
  };

  const save = () => {
    if (!selectedDevice) return;

    const exportedAt = new Date();
    const vendorId = formatNumberAsHex(selectedDevice.vendorId, 4);
    const productId = formatNumberAsHex(selectedDevice.productId, 4);
    const header = [
      'HID Console Log',
      `Board: ${getDeviceDisplayName(selectedDevice) || 'Unnamed device'}`,
      `Vendor ID: ${vendorId}`,
      `Product ID: ${productId}`,
      `Device ID: ${vendorId}:${productId}`,
      `Exported: ${exportedAt.toISOString()}`,
      '',
      '--- Console Output ---',
      '',
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob([header, output], {type: 'text/plain'}),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hid-console-${exportedAt.toISOString().replaceAll(':', '-')}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ConsolePane>
      <Container>
        <Title>{t('HID Console')}</Title>
        <Toolbar>
          <DeviceSelect>
            <AccentSelect
              classNamePrefix="mg-console-select"
              menuPosition="fixed"
              menuPlacement="auto"
              value={
                options.find((option) => option.value === selectedKey) ?? null
              }
              options={options}
              placeholder={
                options.length
                  ? t('Select console device')
                  : t('No console device connected')
              }
              isDisabled={!options.length}
              onChange={(option: any) => setSelectedKey(option?.value ?? null)}
            />
          </DeviceSelect>
          <ActionButton onClick={authorizeDevice}>
            {t('Add device')}
          </ActionButton>
          <ActionButton
            onClick={() =>
              selectedKey &&
              setOutputs((current) => ({...current, [selectedKey]: ''}))
            }
            disabled={!output}
          >
            {t('Clear')}
          </ActionButton>
          <ActionButton onClick={save} disabled={!output}>
            {t('Save')}
          </ActionButton>
        </Toolbar>
        <Console ref={consoleRef}>{output}</Console>
      </Container>
    </ConsolePane>
  );
};
