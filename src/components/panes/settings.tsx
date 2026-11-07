import {useEffect, useState} from 'react';
import {Pane} from './pane';
import styled from 'styled-components';
import {
  ControlRow,
  Label,
  Detail,
  Grid,
  MenuCell,
  Row,
  IconContainer,
  SpanOverflowCell,
} from './grid';
import {AccentSlider} from '../inputs/accent-slider';
import {useDispatch} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {
  getShowDesignTab,
  getShowConsoleTab,
  getShowDesignTabConfirmationNotice,
  getDisableFastRemap,
  getShowSliderValuesMode,
  toggleCreatorMode,
  toggleConsoleTab,
  toggleFastRemap,
  updateShowSliderValuesMode,
  getThemeMode,
  toggleThemeMode,
  getThemeName,
  updateThemeName,
  getRenderMode,
  updateRenderMode,
  setShowDesignTabConfirmationNotice,
} from 'src/store/settingsSlice';
import {AccentSelect} from '../inputs/accent-select';
import {THEMES} from 'src/utils/themes';
import {MenuContainer} from './configure-panes/custom/menu-generator';
import {MenuTooltip} from '../inputs/tooltip';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faToolbox} from '@fortawesome/free-solid-svg-icons';
import {getSelectedConnectedDevice} from 'src/store/devicesSlice';
import {getSelectedBuiltinDefinition} from 'src/store/definitionsSlice';
import {getSelectedFirmwareVersion} from 'src/store/firmwareSlice';
import {getDeviceDisplayName} from 'src/utils/device-display-name';
import {getDefinitionRevision} from 'src/utils/definition-revision';
import {ErrorMessage} from '../styled';
import {webGLIsAvailable} from 'src/utils/test-webgl';
import {useTranslation} from 'react-i18next';
import {MessageDialog} from '../inputs/message-dialog';

const SettingsPane = styled(Pane)`
  color: var(--mg-text);
  background: var(--mg-editor);
  font-family: var(--mg-font);
  font-size: 14px;
  line-height: 22px;

  ${MenuCell} {
    border-color: var(--mg-border);
  }
`;

const SettingsContent = styled(SpanOverflowCell)`
  min-height: 0;
  padding: 28px 38px;
  box-sizing: border-box;
  overscroll-behavior: contain;
  scrollbar-color: var(--mg-keyboard-frame) transparent;

  @media (max-width: 900px) {
    padding: 24px;
  }
`;

const Container = styled.div`
  display: flex;
  align-items: stretch;
  flex-direction: column;
  width: 100%;
  max-width: 960px;
  min-width: 0;
  margin: 0 auto;

  ${ControlRow} {
    min-width: 0;
    min-height: 56px;
    flex-shrink: 0;
    gap: 24px;
    padding: 10px 0;
    border-color: var(--mg-border);
  }

  ${Label} {
    color: var(--mg-text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  ${Detail} {
    justify-content: flex-end;
    flex: 0 1 250px;
    min-width: 0;
  }

  label:has(input[type='checkbox']):hover > span {
    outline: 1px solid var(--mg-text-secondary);
    outline-offset: 2px;
  }

  @media (max-width: 900px) {
    ${ControlRow} {
      flex-wrap: wrap;
      gap: 10px 16px;
    }
  }
`;

const SectionTitle = styled.h2`
  margin: 0 0 12px;
  color: var(--mg-text);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 1.3px;
`;

const DiagnosticContainer = styled(Container)`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--mg-border);
  user-select: text;

  ${Detail} {
    color: var(--mg-text);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
`;

const SettingsErrorMessage = styled(ErrorMessage)`
  margin: 0;
  color: var(--mg-text-secondary);
  font: inherit;
  text-align: right;
  overflow-wrap: anywhere;
`;

declare const __BUILTIN_DEFINITION_REVISIONS__: Readonly<Record<string, string>>;

export function DiagnosticInformation() {
  const {t} = useTranslation();
  const device = useAppSelector(getSelectedConnectedDevice);
  const builtIn = useAppSelector(getSelectedBuiltinDefinition);
  const firmware = useAppSelector(getSelectedFirmwareVersion);
  const [revision, setRevision] = useState<{definition: object; value: string}>();
  useEffect(() => {
    if (!builtIn) return;
    let current = true;
    getDefinitionRevision(builtIn, __BUILTIN_DEFINITION_REVISIONS__)
      .then((value) => {
        if (current && value) setRevision({definition: builtIn, value});
      })
      .catch(() => { /* No verifiable revision in this environment. */ });
    return () => { current = false; };
  }, [builtIn]);

  if (!device) return null;
  const fields = [
    ['Device Model', device.modelDefinitionId || getDeviceDisplayName(device)],
    // QMK leaves VIA_FIRMWARE_VERSION at zero when no release was specified.
    ['Firmware Version', device.protocol >= 11 && firmware ? `0x${firmware.toString(16).toUpperCase().padStart(8, '0')}` : undefined],
    ['JSON Definition Version', revision && revision.definition === builtIn ? revision.value : undefined],
    ['VIA Protocol Version', device.protocol],
  ] as const;
  return (
    <DiagnosticContainer>
      <SectionTitle>{t('Show Diagnostic Information')}</SectionTitle>
      {fields.map(([label, value]) => (
        <ControlRow key={label}>
          <Label as="span">{t(label)}</Label>
          <Detail>{value || t('Not available')}</Detail>
        </ControlRow>
      ))}
    </DiagnosticContainer>
  );
}

export const Settings = () => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const showDesignTab = useAppSelector(getShowDesignTab);
  const showConsoleTab = useAppSelector(getShowConsoleTab);
  const showDesignTabConfirmationNotice = useAppSelector(
    getShowDesignTabConfirmationNotice,
  );
  const disableFastRemap = useAppSelector(getDisableFastRemap);
  const ShowSliderValuesMode = useAppSelector(getShowSliderValuesMode);
  const themeMode = useAppSelector(getThemeMode);
  const themeName = useAppSelector(getThemeName);
  const renderMode = useAppSelector(getRenderMode);
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showDesignTabNotice, setShowDesignTabNotice] = useState(false);

  useEffect(() => {
    if (showDesignTabConfirmationNotice) {
      setShowDesignTabNotice(true);
      dispatch(setShowDesignTabConfirmationNotice(false));
    }
  }, [dispatch, showDesignTabConfirmationNotice]);

  const themeSelectOptions = Object.keys(THEMES).map((k) => ({
    label: t(k.replaceAll('_', ' ')),
    value: k,
  }));
  const selectedThemeOption = themeSelectOptions.find(
    (opt) => opt.value === themeName,
  );

  const ShowSliderModeOptions = webGLIsAvailable
    ? [
        {
          label: t('Slider Only'),
          value: 'Slider Only',
        },
        {
          label: t('Slider & Show Value'),
          value: 'Slider & Show Value',
        },
        {
          label: t('Slider & Input Field'),
          value: 'Slider & Input Field',
        },
      ]
    : [{label: t('Slider Only'), value: 'Slider Only'}];
  const selectedSliderModeOption = ShowSliderModeOptions.find(
    (opt) => opt.value === ShowSliderValuesMode,
  );

  const renderModeOptions = webGLIsAvailable
    ? [
        {
          label: t('2D'),
          value: '2D',
        },
        {
          label: t('3D'),
          value: '3D',
        },
      ]
    : [{label: t('2D'), value: '2D'}];
  const selectedRenderModeOption = renderModeOptions.find(
    (opt) => opt.value === renderMode,
  );
  return (
    <SettingsPane>
      <Grid style={{overflow: 'hidden'}}>
        <MenuCell style={{pointerEvents: 'all', borderTop: 'none'}}>
          <MenuContainer>
            <Row $selected={true}>
              <IconContainer>
                <FontAwesomeIcon icon={faToolbox} />
                <MenuTooltip>{t('General')}</MenuTooltip>
              </IconContainer>
            </Row>
          </MenuContainer>
        </MenuCell>
        <SettingsContent style={{flex: 1, borderWidth: 0}}>
          <Container>
            <SectionTitle>{t('General')}</SectionTitle>
            <ControlRow>
              <Label htmlFor="settings-design">{t('Show Design tab')}</Label>
              <Detail>
                <AccentSlider
                  keepFocus
                  id="settings-design"
                  onChange={() => dispatch(toggleCreatorMode())}
                  isChecked={showDesignTab}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor="settings-hid-console">{t('Show HID Console tab')}</Label>
              <Detail>
                <AccentSlider
                  keepFocus
                  id="settings-hid-console"
                  onChange={() => dispatch(toggleConsoleTab())}
                  isChecked={showConsoleTab}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor="settings-fast-remap">{t('Fast Key Mapping')}</Label>
              <Detail>
                <AccentSlider
                  keepFocus
                  id="settings-fast-remap"
                  onChange={() => dispatch(toggleFastRemap())}
                  isChecked={!disableFastRemap}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor="settings-slider-mode">{t('Slider Mode')}</Label>
              <Detail>
                <AccentSelect
                  inputId="settings-slider-mode"
                  menuPosition="fixed"
                  menuPlacement="auto"
                  value={selectedSliderModeOption}
                  options={ShowSliderModeOptions}
                  onChange={(option: any) => {
                    option && dispatch(updateShowSliderValuesMode(option.value));
                  }}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor="settings-light-mode">{t('Light Mode')}</Label>
              <Detail>
                <AccentSlider
                  keepFocus
                  id="settings-light-mode"
                  onChange={() => dispatch(toggleThemeMode())}
                  isChecked={themeMode === 'light'}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor="settings-theme">{t('Keycap Theme')}</Label>
              <Detail>
                <AccentSelect
                  inputId="settings-theme"
                  menuPosition="fixed"
                  menuPlacement="auto"
                  value={selectedThemeOption}
                  options={themeSelectOptions}
                  onChange={(option: any) => {
                    option && dispatch(updateThemeName(option.value));
                  }}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor="settings-renderer">{t('Render Mode')}</Label>
              <Detail>
                <AccentSelect
                  inputId="settings-renderer"
                  menuPosition="fixed"
                  menuPlacement="auto"
                  value={selectedRenderModeOption}
                  options={renderModeOptions}
                  onChange={(option: any) => {
                    option && dispatch(updateRenderMode(option.value));
                  }}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label htmlFor={selectedDevice ? "settings-diagnostics" : undefined}>{t('Show Diagnostic Information')}</Label>

              <Detail>
                {selectedDevice ? (
                  <AccentSlider
                    keepFocus
                    id="settings-diagnostics"
                    onChange={() => setShowDiagnostics(!showDiagnostics)}
                    isChecked={showDiagnostics}
                  />
                ) : (
                  <SettingsErrorMessage>
                    {t('Requires connected device')}
                  </SettingsErrorMessage>
                )}
              </Detail>
            </ControlRow>
          </Container>
          <MessageDialog
            isOpen={showDesignTabNotice}
            onConfirm={() => setShowDesignTabNotice(false)}
            confirmLabel="OK"
          >
            {t(
              "You didn't click \"Confirm\". To enable the Design tab, you must confirm first.",
            )}
          </MessageDialog>
          {showDiagnostics && selectedDevice && <DiagnosticInformation />}
        </SettingsContent>
      </Grid>
    </SettingsPane>
  );
};
