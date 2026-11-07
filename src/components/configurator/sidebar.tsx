import {useTranslation} from 'react-i18next';
import {useLocation} from 'wouter';
import styled from 'styled-components';
import {useConfigureNavigation} from './configure-navigation';
import {SidebarIcon} from './sidebar-icons';

const SidebarRoot = styled.aside`
  position: fixed;
  top: var(--mg-header-height);
  bottom: 0;
  left: 0;
  width: var(--mg-sidebar-width);
  box-sizing: border-box;
  background: var(--mg-sidebar);
  border-right: 1px solid var(--mg-border);
  padding: 35px 0 24px 20px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;
  z-index: 20;
  --bg_control: var(--mg-text);
  --bg_icon-highlighted: var(--mg-text);
`;

const Item = styled.button<{$active: boolean}>`
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 18px;
  border: 0;
  border-radius: 8px;
  background: ${({$active}) =>
    $active ? 'var(--mg-nav-active)' : 'transparent'};
  color: var(--mg-text);
  font-family: Inter, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: ${({$active}) => ($active ? 600 : 400)} !important;
  letter-spacing: 0;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease;

  &:hover {
    background: ${({$active}) =>
      $active ? 'var(--mg-nav-active)' : 'rgba(33, 33, 33, 0.04)'};
  }

  &:active {
    background: var(--mg-nav-active);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -3px;
  }

  > span:first-child {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
  }

  svg {
    display: block;
    width: 20px;
    height: 20px;
  }

  @media (max-width: 1050px) {
    padding-inline: 14px;
    gap: 12px;
  }
`;

export const Sidebar = () => {
  const {t} = useTranslation();
  const [location, navigate] = useLocation();
  const {rows, selectedId, selectPane} = useConfigureNavigation();
  const priority = ['Keymap', 'Macros', 'Lighting', 'Layouts'];
  const menus = rows
    .filter((row) => row.id !== 'save-load')
    .sort((a, b) => {
      const index = (title: string) =>
        priority.includes(title) ? priority.indexOf(title) : priority.length;
      return index(a.Title) - index(b.Title);
    });
  const openPane = (id: string) => {
    selectPane(id);
    navigate('/');
  };

  return (
    <SidebarRoot data-testid="sidebar">
      <nav aria-label={t('Main navigation')}>
        {menus.length ? (
          menus.map(({id, Title, Icon}) => (
            <Item
              key={id}
              $active={location === '/' && selectedId === id}
              aria-current={
                location === '/' && selectedId === id ? 'page' : undefined
              }
              onClick={() => openPane(id)}
            >
              <span>
                <SidebarIcon
                  name={
                    id === 'v2-lighting' || Title === 'Lighting' ? 'lighting' : id
                  }
                  fallback={Icon}
                />
              </span>
              <span>{t(Title)}</span>
            </Item>
          ))
        ) : (
          <Item
            $active={location === '/'}
            aria-current={location === '/' ? 'page' : undefined}
            onClick={() => openPane('keymap')}
          >
            <span>
              <SidebarIcon name="keymap" />
            </span>
            <span>{t('Keymap')}</span>
          </Item>
        )}
        <Item
          $active={location === '/test'}
          aria-current={location === '/test' ? 'page' : undefined}
          onClick={() => navigate('/test')}
        >
          <span>
            <SidebarIcon name="key-tester" />
          </span>
          <span>{t('Key Tester')}</span>
        </Item>
        <Item
          $active={!['/', '/test'].includes(location)}
          aria-current={location === '/settings' ? 'page' : undefined}
          onClick={() => navigate('/settings')}
        >
          <span>
            <SidebarIcon name="settings" />
          </span>
          <span>{t('Settings')}</span>
        </Item>
      </nav>
    </SidebarRoot>
  );
};
