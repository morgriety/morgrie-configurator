import {useState} from 'react';
import {Link, useLocation, useRoute} from 'wouter';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {Settings} from '../panes/settings';
import {Errors} from '../panes/errors';
import * as SaveLoad from '../panes/configure-panes/save-load';
import {useAppSelector} from 'src/store/hooks';
import {
  getSelectedConnectedDevice,
  getIsSelectedDeviceReady,
} from 'src/store/devicesSlice';
import {getSelectedDefinition} from 'src/store/definitionsSlice';
import {getNumberOfLayers} from 'src/store/keymapSlice';
import {getShowConsoleTab, getShowDesignTab} from 'src/store/settingsSlice';
import {ConnectionStatus} from './connection-status';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--mg-text);
  background: var(--mg-editor);
  min-height: 0;
  min-width: 0;
`;

const Heading = styled.div`
  flex-shrink: 0;
  margin: 30px 38px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 500;
    line-height: 38px;
    letter-spacing: 3.5px;
  }

  @media (max-width: 850px) {
    flex-wrap: wrap;
  }
`;

const Tabs = styled.nav`
  flex-shrink: 0;
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  padding: 0 38px 20px;
  border-bottom: 1px solid var(--mg-border);

  button,
  a {
    color: var(--mg-text-secondary);
    background: none;
    border: 0;
    padding: 5px 0;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    line-height: 22px;
    cursor: pointer;
    text-decoration: none;
    transition: color 140ms ease, border-color 140ms ease;

    &:hover {
      color: var(--mg-text);
    }

    &:focus-visible {
      outline: 2px solid var(--mg-text-secondary);
      outline-offset: 4px;
      border-radius: 2px;
    }
  }

  [aria-selected='true'],
  [aria-current='page'] {
    color: var(--mg-text);
    border-bottom-color: var(--mg-text);
  }
`;

const Content = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;

  > * {
    flex: 1;
    min-width: 0;
  }
`;

export const SettingsWorkspace = () => {
  const {t} = useTranslation();
  const [tab, setTab] = useState('preferences');
  const [, navigate] = useLocation();
  const [isErrors] = useRoute('/errors');
  const device = useAppSelector(getSelectedConnectedDevice);
  const ready = useAppSelector(getIsSelectedDeviceReady);
  const definition = useAppSelector(getSelectedDefinition);
  const layers = useAppSelector(getNumberOfLayers);
  const showDesign = useAppSelector(getShowDesignTab);
  const showConsole = useAppSelector(getShowConsoleTab);
  const canSave = !!device && ready && !!definition && layers > 0;
  const showDebug = import.meta.env.DEV || import.meta.env.DEBUG_PROD === 'true';

  return (
    <Container>
      <Heading>
        <h1>{t('Settings')}</h1>
        <ConnectionStatus />
      </Heading>
      <Tabs aria-label={t('Settings tools')}>
        <button
          aria-selected={!isErrors && (tab === 'preferences' || !canSave)}
          onClick={() => {
            setTab('preferences');
            if (isErrors) navigate('/settings');
          }}
        >
          {t('Settings')}
        </button>
        {canSave && (
          <button
            aria-selected={!isErrors && tab === 'save-load'}
            onClick={() => {
              setTab('save-load');
              if (isErrors) navigate('/settings');
            }}
          >
            {t(SaveLoad.Title)}
          </button>
        )}
        <Link to="/errors" aria-current={isErrors ? 'page' : undefined}>
          {t('Errors')}
        </Link>
        {showDesign && <Link to="/design">{t('Design')}</Link>}
        {showConsole && <Link to="/console">{t('HID Console')}</Link>}
        {showDebug && <Link to="/debug">{t('Debug')}</Link>}
      </Tabs>
      <Content>
        {isErrors ? (
          <Errors />
        ) : canSave && tab === 'save-load' ? (
          <SaveLoad.Pane key={device.path} />
        ) : (
          <Settings />
        )}
      </Content>
    </Container>
  );
};
