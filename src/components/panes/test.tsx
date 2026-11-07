import React, {FC, useContext} from 'react';
import fullKeyboardDefinition from '../../utils/test-keyboard-definition.json';
import {Pane} from './pane';
import styled from 'styled-components';
import {PROTOCOL_GAMMA} from '../../utils/keyboard-api';
import {
  ControlRow,
  Label,
  Detail,
  MenuCell,
  Row,
  IconContainer,
  Grid,
  SpanOverflowCell,
} from './grid';
import {AccentSlider} from '../inputs/accent-slider';
import {AccentButton} from '../inputs/accent-button';
import {useDispatch} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {getSelectedConnectedDevice} from 'src/store/devicesSlice';
import {
  getSelectedDefinition,
  getSelectedKeyDefinitions,
} from 'src/store/definitionsSlice';
import {
  getIsTestMatrixEnabled,
  setTestMatrixEnabled,
  getTestKeyboardSoundsSettings,
  setTestKeyboardSoundsSettings,
} from 'src/store/settingsSlice';
import {MenuContainer} from './configure-panes/custom/menu-generator';
import {MenuTooltip} from '../inputs/tooltip';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCircleQuestion} from '@fortawesome/free-solid-svg-icons';
import {AccentSelect} from '../inputs/accent-select';
import {AccentRange, RangeValueDisplay} from '../inputs/accent-range';
import {TestKeyboardSoundsMode} from '../void/test-keyboard-sounds';
import {useTranslation} from 'react-i18next';

const Container = styled.div`
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 32px;
  @media (max-width: 1400px) { padding: 20px 24px; }
`;

const SectionHeading = styled.h2`
  margin: 0 0 12px;
  color: var(--mg-text);
  font: 600 12px/18px var(--mg-font);
  letter-spacing: 1.3px;
  text-transform: uppercase;
`;

const PrimaryControls = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 32px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--mg-border);
  padding-bottom: 10px;
  @media (max-width: 1050px) { grid-template-columns: minmax(0, 1fr); }
`;

const ScrollControls = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 0 32px;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;
  @media (max-width: 1050px) { grid-template-columns: minmax(0, 1fr); }
`;

const TestPane = styled(Pane)`
  display: flex;
  height: 100%;
  max-height: max(0px, calc(100dvh - var(--mg-header-height) - var(--mg-workspace-height) - 1px));
  max-width: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--mg-editor);
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;

  ${MenuCell} {
    border-top: 0;
    border-right: 1px solid var(--mg-border);
    background: var(--mg-editor);
    padding: 0;
  }
  ${MenuContainer} { padding: 24px 14px; }
  ${Row} { color: var(--mg-text-secondary); margin: 0; cursor: default; }
  ${SpanOverflowCell} { border: 0; overflow: hidden; background: var(--mg-editor); }

  ${ControlRow} {
    min-height: 52px;
    max-width: none;
    padding: 9px 0;
    border-bottom: 1px solid var(--mg-border);
    gap: 16px;
  }
  ${PrimaryControls} ${ControlRow} { border: 0; }
  ${Label} {
    min-width: 0;
    color: var(--mg-text);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }
  ${Detail} {
    flex: 0 1 250px;
    min-width: 0;
    justify-content: flex-end;
    color: var(--mg-text);
    > span:has(input[type='range']) { width: 100%; min-width: 0; }
  }
  ${AccentButton} {
    box-sizing: border-box;
    min-height: 34px;
    padding: 5px 18px;
    border: 1px solid var(--mg-border);
    border-radius: 7px;
    color: var(--mg-text);
    background: var(--mg-editor);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;
    transition: background 140ms ease, border-color 140ms ease;
    &:hover:not(:disabled) { background: var(--mg-nav-active); border-color: var(--mg-text-secondary); }
    &:active:not(:disabled) { background: var(--mg-nav-active); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  input[type='checkbox']:hover + span { box-shadow: 0 0 0 1px var(--mg-text-secondary); }
  input[type='checkbox']:disabled + span { opacity: 0.5; cursor: not-allowed; }
  input[type='range'] {
    appearance: none;
    flex: 1 1 auto;
    min-width: 0;
    height: 22px;
    margin: 0;
    border: 0;
    background: transparent;
    accent-color: var(--mg-text);
    cursor: pointer;
    &::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--mg-nav-active); }
    &::-webkit-slider-thumb {
      appearance: none;
      width: 14px; height: 14px; margin-top: -5px;
      border: 2px solid var(--mg-editor); border-radius: 50%;
      background: var(--mg-text); box-shadow: 0 0 0 1px var(--mg-text-secondary);
    }
    &::-moz-range-track { height: 4px; border-radius: 2px; background: var(--mg-nav-active); }
    &::-moz-range-thumb {
      width: 10px; height: 10px;
      border: 2px solid var(--mg-editor); border-radius: 50%;
      background: var(--mg-text); box-shadow: 0 0 0 1px var(--mg-text-secondary);
    }
  }
  input[type='number'] {
    box-sizing: border-box; flex: 0 0 64px;
    width: 64px; height: 34px; padding: 5px 8px;
    border: 1px solid var(--mg-border); border-radius: 7px;
    background: var(--mg-editor); color: var(--mg-text);
    font: 400 14px/22px var(--mg-font); letter-spacing: 0;
  }
  ${RangeValueDisplay} { color: var(--mg-text); font: 400 14px/22px var(--mg-font); letter-spacing: 0; }
  && :focus-visible { outline: 2px solid var(--mg-text-secondary); outline-offset: 2px; }
`;
export const TestContext = React.createContext([
  {clearTestKeys: () => {}},
  (...a: any[]) => {},
] as const);

export const Test: FC = () => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const keyDefinitions = useAppSelector(getSelectedKeyDefinitions);
  const isTestMatrixEnabled = useAppSelector(getIsTestMatrixEnabled);
  const testKeyboardSoundsSettings = useAppSelector(
    getTestKeyboardSoundsSettings,
  );

  const [testContextObj] = useContext(TestContext);

  const hasTestMatrixDevice =
    selectedDevice && selectedDefinition && keyDefinitions;
  const canUseMatrixState =
    hasTestMatrixDevice && PROTOCOL_GAMMA <= selectedDevice.protocol;

  const testDefinition = isTestMatrixEnabled
    ? selectedDefinition
    : fullKeyboardDefinition;

  if (!testDefinition || typeof testDefinition === 'string') {
    return null;
  }

  const waveformOptions = [
    {
      label: t('Sine'),
      value: 'sine',
    },
    {
      label: t('Triangle'),
      value: 'triangle',
    },
    {
      label: t('Sawtooth'),
      value: 'sawtooth',
    },
    {
      label: t('Square'),
      value: 'square',
    },
  ];
  const waveformDefaultValue = waveformOptions.find(
    (opt) => opt.value === testKeyboardSoundsSettings.waveform,
  );

  const modeOptions = [
    {
      label: t('Wicki-Hayden'),
      value: TestKeyboardSoundsMode.WickiHayden,
    },
    {
      label: t('Chromatic'),
      value: TestKeyboardSoundsMode.Chromatic,
    },
    {
      label: t('Random'),
      value: TestKeyboardSoundsMode.Random,
    },
  ];
  const modeDefaultValue = modeOptions.find(
    (opt) => opt.value === testKeyboardSoundsSettings.mode,
  );

  return (
    <TestPane data-testid="key-tester-controls">
      <Grid>
        <MenuCell style={{pointerEvents: 'all'}}>
          <MenuContainer>
            <Row $selected={true}>
              <IconContainer>
                <FontAwesomeIcon icon={faCircleQuestion} />
                <MenuTooltip>{t('Check Key')}</MenuTooltip>
              </IconContainer>
            </Row>
          </MenuContainer>
        </MenuCell>
        <SpanOverflowCell>
          <Container>
            <SectionHeading>{t('Check Key')}</SectionHeading>
            <PrimaryControls>
              <ControlRow>
                <Label>{t('Reset Keyboard')}</Label>
                <Detail>
                  <AccentButton onClick={testContextObj.clearTestKeys}>
                    {t('Reset')}
                  </AccentButton>
                </Detail>
              </ControlRow>
              {canUseMatrixState && selectedDefinition ? (
                <ControlRow>
                  <Label>{t('Test Matrix')}</Label>
                  <Detail>
                    <AccentSlider
                      isChecked={isTestMatrixEnabled}
                      onChange={(val) => {
                        dispatch(setTestMatrixEnabled(val));
                        testContextObj.clearTestKeys();
                      }}
                    />
                  </Detail>
                </ControlRow>
              ) : null}
            </PrimaryControls>
            <ScrollControls>
              <ControlRow>
                <Label>{t('Key Sounds')}</Label>
                <Detail>
                  <AccentSlider
                    isChecked={testKeyboardSoundsSettings.isEnabled}
                    onChange={(val) => {
                      dispatch(
                        setTestKeyboardSoundsSettings({
                          isEnabled: val,
                        }),
                      );
                    }}
                  />
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>{t('Volume')}</Label>
                <Detail>
                  <AccentRange
                    max={100}
                    min={0}
                    defaultValue={testKeyboardSoundsSettings.volume}
                    onChange={(value: number) => {
                      dispatch(
                        setTestKeyboardSoundsSettings({
                          volume: value,
                        }),
                      );
                    }}
                  />
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>{t('Transpose')}</Label>
                <Detail>
                  <AccentRange
                    max={24}
                    min={-24}
                    defaultValue={testKeyboardSoundsSettings.transpose}
                    onChange={(value: number) => {
                      dispatch(
                        setTestKeyboardSoundsSettings({
                          transpose: value,
                        }),
                      );
                    }}
                  />
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>{t('Waveform')}</Label>
                <Detail>
                  <AccentSelect
                    menuPosition="fixed"
                    menuPlacement="auto"
                    maxMenuHeight={180}
                    isSearchable={false}
                    value={waveformDefaultValue}
                    options={waveformOptions}
                    onChange={(option: any) => {
                      option &&
                        dispatch(
                          setTestKeyboardSoundsSettings({
                            waveform: option.value,
                          }),
                        );
                    }}
                  />
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>{t('Mode')}</Label>
                <Detail>
                  <AccentSelect
                    menuPosition="fixed"
                    menuPlacement="auto"
                    maxMenuHeight={180}
                    isSearchable={false}
                    defaultValue={modeDefaultValue}
                    options={modeOptions}
                    onChange={(option: any) => {
                      option &&
                        dispatch(
                          setTestKeyboardSoundsSettings({
                            mode: option.value,
                          }),
                        );
                    }}
                  />
                </Detail>
              </ControlRow>
            </ScrollControls>
          </Container>
        </SpanOverflowCell>
      </Grid>
    </TestPane>
  );
};
