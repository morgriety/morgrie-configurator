import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from 'src/store/hooks';
import {
  getConnectedDevices,
  getIsSelectedDeviceReady,
  getSelectedConnectedDevice,
} from 'src/store/devicesSlice';

const Status = styled.div<{$ready: boolean}>`
  height: 40px;
  min-width: 180px;
  padding: 0 14px;
  box-sizing: border-box;
  border: 1px solid var(--mg-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  flex: 0 0 auto;
  &:before {
    content: '';
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${({$ready}) =>
      $ready ? 'var(--mg-connected)' : 'var(--mg-text-secondary)'};
  }
`;

export const ConnectionStatus = () => {
  const {t} = useTranslation();
  const device = useAppSelector(getSelectedConnectedDevice);
  const devices = useAppSelector(getConnectedDevices);
  const isReady = useAppSelector(getIsSelectedDeviceReady);
  const ready = !!device && isReady;
  const initializing = !!device || Object.keys(devices).length > 0;
  return (
    <Status role="status" $ready={ready}>
      {t(ready ? 'Connected' : initializing ? 'Initializing' : 'Disconnected')}
    </Status>
  );
};
