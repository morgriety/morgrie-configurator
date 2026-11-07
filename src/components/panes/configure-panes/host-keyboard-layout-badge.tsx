import {useEffect, useId, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {faAngleDown} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import styled from 'styled-components';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getHostKeyboardLayout,
  updateHostKeyboardLayout,
} from 'src/store/settingsSlice';
import {keymapExtras} from 'src/utils/keymap-extras';

const Container = styled.div`
  position: relative;
  font-size: 14px;
  pointer-events: none;
  font-weight: 400;
  flex: 0 0 auto;
`;

const LayoutTitle = styled.button`
  pointer-events: all;
  display: inline-block;
  background: transparent;
  border-radius: 7px;
  font-family: inherit;
  font-size: 13px;
  &:focus-visible { outline: 2px solid var(--mg-text); outline-offset: 2px; }
  color: var(--mg-text-secondary);
  padding: 5px 10px;
  border: solid 1px var(--mg-border);
  cursor: pointer;
  transition: all 0.1s ease-out;
  white-space: nowrap;

  &:hover {
    filter: brightness(0.7);
  }
`;

const LayoutList = styled.ul`
  padding: 0;
  border: 1px solid var(--bg_control);
  width: 220px;
  border-radius: 6px;
  background-color: var(--bg_menu);
  margin: 0;
  margin-top: 5px;
  right: 0;
  position: absolute;
  pointer-events: auto;
  list-style: none;
  z-index: 42;
  overflow-y: auto;
  max-height: 400px;
`;

const LayoutButton = styled.button<{$selected?: boolean}>`
  display: block;
  &:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  border: none;
  background: ${(props) =>
    props.$selected ? 'var(--bg_icon-highlighted)' : 'transparent'};
  color: ${(props) =>
    props.$selected
      ? 'var(--color_icon_highlighted)'
      : 'var(--color_label-highlighted)'};
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  padding: 5px 10px;

  &:hover {
    border: none;
    background: ${(props) =>
      props.$selected ? 'var(--bg_icon-highlighted)' : 'var(--bg_control)'};
    color: ${(props) =>
      props.$selected
        ? 'var(--color_control-highlighted)'
        : 'var(--color_label-highlighted)'};
  }
`;

const ClickCover = styled.div`
  position: fixed;
  z-index: 41;
  pointer-events: all;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.4;
  background: rgba(0, 0, 0, 0.75);
`;

const layoutOptions = Object.entries(keymapExtras).map(([key, value]) => ({
  key,
  label: value.label,
}));

export const HostKeyboardLayoutBadge = () => {
  const {t} = useTranslation();
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const dispatch = useAppDispatch();
  const hostKeyboardLayout = useAppSelector(getHostKeyboardLayout);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (showList) list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
  }, [showList]);
  const close = () => {
    setShowList(false);
    trigger.current?.focus({preventScroll: true});
  };

  const currentLabel =
    keymapExtras[hostKeyboardLayout]?.label ?? hostKeyboardLayout;

  return (
    <Container
      onKeyDown={(event) => {
        if (showList && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setShowList(false);
      }}
    >
      <LayoutTitle
        ref={trigger}
        type="button"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-label={`${t('Host Keyboard Layout')}: ${currentLabel}`}
        onClick={() => setShowList(!showList)}
      >
        {currentLabel}

        <FontAwesomeIcon
          icon={faAngleDown}
          style={{
            transform: showList ? 'rotate(180deg)' : '',
            transition: 'transform 0.2s ease-out',
            marginLeft: '5px',
          }}
        />
      </LayoutTitle>

      {showList && (
        <>
          <ClickCover onMouseDown={(event) => event.preventDefault()} onClick={close} />
          <LayoutList id={listId} ref={list}>
            {layoutOptions.map(({key, label}) => (
              <li key={key}>
                <LayoutButton
                  type="button"
                  $selected={key === hostKeyboardLayout}
                  aria-current={key === hostKeyboardLayout}
                  onClick={() => {
                    dispatch(updateHostKeyboardLayout(key));
                    close();
                  }}
                >
                  {label}
                </LayoutButton>
              </li>
            ))}
          </LayoutList>
        </>
      )}
    </Container>
  );
};
