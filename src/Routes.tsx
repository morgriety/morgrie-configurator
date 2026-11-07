import {UnconnectedGlobalMenu} from './components/menus/global';
import {Route, useRoute} from 'wouter';
import PANES from './utils/pane-config';
import {Home} from './components/Home';
import {TestContext} from './components/panes/test';
import {useMemo, useState} from 'react';
import {OVERRIDE_HID_CHECK} from './utils/override';
import {useAppSelector} from './store/hooks';
import {getShowConsoleTab} from './store/settingsSlice';
import {useLocation} from 'wouter';
import {HIDConsole} from './components/panes/hid-console';
import styled from 'styled-components';
import {ConfigureNavigationProvider} from './components/configurator/configure-navigation';
import {Sidebar} from './components/configurator/sidebar';
import {KeyboardWorkspace} from './components/configurator/keyboard-workspace';
import {SettingsWorkspace} from './components/configurator/settings-workspace';

const Main = styled.main`
  position: fixed;
  top: var(--mg-header-height);
  left: var(--mg-sidebar-width);
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: auto;
`;

const EditorRegion = styled.div<{$withKeyboard: boolean}>`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 0 ${({$withKeyboard}) => ($withKeyboard ? '409px' : '0px')};
  min-height: ${({$withKeyboard}) => ($withKeyboard ? '409px' : '0')};
  min-width: 0;
  border-top: ${({$withKeyboard}) =>
    $withKeyboard ? '1px solid var(--mg-border)' : 'none'};
  box-sizing: border-box;
  background: var(--mg-editor);

  @media (max-height: 900px) {
    flex-basis: ${({$withKeyboard}) => ($withKeyboard ? '300px' : '0')};
    min-height: ${({$withKeyboard}) => ($withKeyboard ? '300px' : '0')};
  }

  @media (max-height: 800px) {
    flex-basis: ${({$withKeyboard}) => ($withKeyboard ? '280px' : '0')};
    min-height: ${({$withKeyboard}) => ($withKeyboard ? '280px' : '0')};
  }
`;

const PersistentPane = styled.div<{$active: boolean}>`
  display: ${({$active}) => ($active ? 'flex' : 'none')};
  flex: 1;
  min-height: 0;
`;

export default () => {
  const hasHIDSupport = 'hid' in navigator || OVERRIDE_HID_CHECK;

  const showConsoleTab = useAppSelector(getShowConsoleTab);
  const [location] = useLocation();
  const [isSettingsRoute] = useRoute('/settings');
  const [isErrorsRoute] = useRoute('/errors');
  const RouteComponents = useMemo(
    () =>
      PANES.filter(
        (pane) => !['console', 'settings', 'errors'].includes(pane.key),
      ).map((pane) => {
        return (
          <Route
            component={pane.component}
            key={pane.key}
            path={pane.path}
          />
        );
      }),
    [],
  );

  const testContextState = useState({clearTestKeys: () => {}});
  const withKeyboard = ['/', '/test', '/design', '/debug'].includes(location);
  return (
    <div className="mg-app">
      <TestContext.Provider value={testContextState}>
        <ConfigureNavigationProvider>
          <UnconnectedGlobalMenu />
          <Sidebar />
          <Main data-testid="main-workspace">
            <Home hasHIDSupport={hasHIDSupport}>
              <KeyboardWorkspace />
              <EditorRegion
                $withKeyboard={withKeyboard}
                data-testid="editor-region"
              >
                {RouteComponents}
                {(isSettingsRoute || isErrorsRoute) && (
                  <SettingsWorkspace />
                )}
                {showConsoleTab && (
                  <PersistentPane $active={location === '/console'}>
                    <HIDConsole isActive={location === '/console'} />
                  </PersistentPane>
                )}
              </EditorRegion>
            </Home>
          </Main>
        </ConfigureNavigationProvider>
      </TestContext.Provider>
    </div>
  );
};
