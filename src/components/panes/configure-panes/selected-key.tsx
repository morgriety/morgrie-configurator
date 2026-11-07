import type {FC} from 'react';
import {useTranslation} from 'react-i18next';
import styled from 'styled-components';
import {
  getBasicKeyToByte,
  getSelectedDefinition,
  getSelectedKeyDefinitions,
} from 'src/store/definitionsSlice';
import {useAppSelector} from 'src/store/hooks';
import {
  getSelectedKey,
  getSelectedKeymap,
  getSelectedLayerIndex,
} from 'src/store/keymapSlice';
import {getHostKeyboardLayout} from 'src/store/settingsSlice';
import {anyKeycodeToString} from 'src/utils/advanced-keys';
import {getLabelForByte} from 'src/utils/key';
import {keymapExtras} from 'src/utils/keymap-extras';
import {LayoutControls} from './layouts';

const Details = styled.aside`
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  margin: 27px 0 30px;
  padding: 0 50px 0 38px;
  box-sizing: border-box;
  border-left: 1px solid var(--mg-border);
  color: var(--mg-text);
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 6px;
    background: var(--mg-border);
  }

  @media (max-width: 1440px) {
    padding-right: 28px;
    padding-left: 28px;
  }

  @media (max-width: 1100px) {
    overflow-y: visible;
    margin: 0 24px 24px;
    padding: 24px 0 0;
    border-left: 0;
    border-top: 1px solid var(--mg-border);
  }
`;

const Heading = styled.h2`
  margin: 0 0 16px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 1.3px;
  text-transform: uppercase;
`;

const KeyDetails = styled.div`
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  min-width: 0;
  min-height: 116px;
  align-items: start;
  gap: 26px;
  box-sizing: border-box;

  @media (min-width: 1536px) {
    padding-left: 31px;
    gap: 60px;
  }

  @media (max-width: 1440px) {
    gap: 18px;
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
`;

const KeyPreview = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 92px;
  margin-top: 12px;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid var(--mg-keyboard-frame);
  border-radius: 8px;
  background: linear-gradient(
    145deg,
    var(--mg-keycap-highlight) 0%,
    var(--mg-keycap) 42%,
    var(--mg-keyboard-frame) 100%
  );
  color: var(--mg-text);
  box-shadow: inset 0 1px 0 var(--mg-keycap-highlight),
    inset 1px 0 2px var(--mg-keycap-highlight),
    inset -1px -2px 3px var(--mg-keyboard-frame),
    0 2px 3px color-mix(in srgb, var(--mg-keyboard-frame) 55%, transparent);
  font-size: 14px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0;
  text-align: center;
  overflow-wrap: anywhere;
  white-space: pre-wrap;

  &::before {
    content: '';
    position: absolute;
    z-index: 0;
    inset: 7px 8px 10px;
    border-radius: 6px;
    background: linear-gradient(
      165deg,
      var(--mg-keycap-highlight),
      var(--mg-keycap)
    );
    box-shadow: inset 0 1px 0 var(--mg-keycap-highlight),
      0 1px 2px color-mix(in srgb, var(--mg-keyboard-frame) 70%, transparent);
    pointer-events: none;
  }
`;

const PreviewLabel = styled.span`
  position: relative;
  z-index: 1;
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
`;

const Fields = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;

  > div {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  dt {
    min-width: 0;
    color: var(--mg-text-secondary);
    overflow-wrap: anywhere;
  }

  @media (min-width: 1536px) {
    > div {
      grid-template-columns: 91px minmax(0, 1fr);
    }
  }

  dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  @media (max-width: 1440px) {
    > div {
      grid-template-columns: 58px minmax(0, 1fr);
      gap: 8px;
    }
  }
`;

const KeycodeInput = styled.button`
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 34px;
  min-height: 34px;
  padding: 5px 10px;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  background: var(--mg-editor);
  color: var(--mg-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background 140ms, border-color 140ms;

  &:hover {
    border-color: var(--mg-text-secondary);
    background: var(--mg-canvas);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text);
    outline-offset: 2px;
  }
`;

const EmptySelection = styled.p`
  margin: 0;
  min-height: 116px;
  color: var(--mg-text-secondary);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;
`;

const Options = styled.section`
  margin-top: 25px;
  padding-top: 16px;
  border-top: 1px solid var(--mg-border);

  ${Heading} {
    margin-bottom: 9px;
  }

  label {
    gap: 16px;
    min-width: 0;
    min-height: 38px;
    font-size: 14px;
    font-weight: 400;
    line-height: 22px;
    letter-spacing: 0;
  }

  label > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  input[type='checkbox'] {
    box-sizing: border-box;
    width: 42px;
    height: 22px;
    flex: 0 0 42px;
    border-color: transparent;
    background: var(--mg-keyboard-frame);
    transition: background 140ms, border-color 140ms;

    &:checked {
      background: var(--mg-text);
    }

    &:hover {
      border-color: var(--mg-text-secondary);
    }
  }

  select {
    box-sizing: border-box;
    min-width: 0;
    height: 34px;
    font-size: 13px;
    text-overflow: ellipsis;
  }
`;

export const SelectedKey: FC<{onEdit: () => void}> = ({onEdit}) => {
  const {t} = useTranslation();
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedKey = useAppSelector(getSelectedKey);
  const keys = useAppSelector(getSelectedKeyDefinitions);
  const keymap = useAppSelector(getSelectedKeymap);
  const layer = useAppSelector(getSelectedLayerIndex);
  const {basicKeyToByte, byteToKey} = useAppSelector(getBasicKeyToByte);
  const hostKeyboardLayout = useAppSelector(getHostKeyboardLayout);
  const key = selectedKey === null ? undefined : keys[selectedKey];
  const value = selectedKey === null ? undefined : keymap?.[selectedKey];
  const keycode =
    value === undefined
      ? ''
      : anyKeycodeToString(value, basicKeyToByte, byteToKey) ||
        `0x${value.toString(16).toUpperCase()}`;
  const label =
    value === undefined
      ? ''
      : getLabelForByte(
          value,
          100,
          basicKeyToByte,
          byteToKey,
          keymapExtras[hostKeyboardLayout]?.keycodeLUT,
        ) || keycode;
  const hasLayoutOptions = !!selectedDefinition?.layouts.labels?.length;

  return (
    <Details aria-label={t('Selected Key')}>
      <Heading>{t('Selected Key')}</Heading>
      {key && value !== undefined ? (
        <KeyDetails>
          <KeyPreview title={keycode}>
            <PreviewLabel>{label}</PreviewLabel>
          </KeyPreview>
          <Fields>
            <div>
              <dt>{t('Keycode')}</dt>
              <dd>
                <KeycodeInput
                  type="button"
                  onClick={onEdit}
                  title={`${t('Edit keycode')}: ${keycode}`}
                  aria-label={`${t('Edit keycode')}: ${keycode}`}
                >
                  {keycode}
                </KeycodeInput>
              </dd>
            </div>
            <div>
              <dt>{t('Layer')}</dt>
              <dd>{layer}</dd>
            </div>
            <div>
              <dt>{t('Matrix')}</dt>
              <dd>
                {key.row}, {key.col}
              </dd>
            </div>
          </Fields>
        </KeyDetails>
      ) : (
        <EmptySelection>
          {t('Select a key on the keyboard to edit its keycode.')}
        </EmptySelection>
      )}
      {hasLayoutOptions && (
        <Options>
          <Heading>{t('Keyboard Options')}</Heading>
          <LayoutControls />
        </Options>
      )}
    </Details>
  );
};
