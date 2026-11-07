import {
  faCircle,
  faCompress,
  faExpand,
  faMagicWandSparkles,
  faSave,
  faSquare,
  faStopwatch,
  faTrash,
  faUndo,
} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
  IconButtonContainer,
  IconToggleContainer,
} from 'src/components/inputs/icon-button';
import {IconButtonTooltip} from 'src/components/inputs/tooltip';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const MacroEditControlsContainer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0;
  background: var(--mg-editor);

  .tooltip {
    top: auto !important;
    left: auto !important;
    right: 0;
    bottom: 42px;
    width: max-content;
    max-width: 240px;
    transform-origin: right bottom !important;
  }

  .tooltip > div:first-child {
    padding: 6px 10px !important;
    border: 1px solid var(--mg-border);
    border-radius: 7px !important;
    font: 400 12px/18px var(--mg-font) !important;
    letter-spacing: 0;
    text-transform: none !important;
    white-space: normal !important;
    box-sizing: border-box;
    max-width: 240px;
    margin-left: 0 !important;
    transform: none !important;
    overflow-wrap: anywhere;
  }

  .tooltip > div:last-child {
    display: none;
  }
`;

const MacroControlGroupContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 1px;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  background: var(--mg-border);
`;

const MacroControlGroupDivider = styled.div`
  width: 1px;
  height: 20px;
  background: var(--mg-border);
`;

const MacroButton = styled(IconButtonContainer)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--mg-editor);
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  transition: background 140ms ease;

  svg {
    position: static;
    color: var(--mg-text);
  }

  &:hover:not(:disabled) {
    border: 0;
    background: var(--mg-nav-active);
    color: var(--mg-text);
    svg { color: var(--mg-text); }
  }

  &:disabled {
    border: 0;
    background: var(--mg-editor);
    svg { color: var(--mg-text-secondary); }
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -2px;
    .tooltip {
      transform: none;
      opacity: 1;
    }
  }
`;

const MacroToggle = styled(IconToggleContainer)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: ${({$selected}) =>
    $selected ? 'var(--mg-nav-active)' : 'var(--mg-editor)'};
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  transition: background 140ms ease;

  svg {
    position: static;
    color: var(--mg-text);
  }

  &:hover:not(:disabled) {
    border: 0;
    background: var(--mg-nav-active);
    svg { color: var(--mg-text); }
  }

  &:disabled {
    border: 0;
    background: var(--mg-editor);
    svg { color: var(--mg-text-secondary); }
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -2px;
    .tooltip {
      transform: none;
      opacity: 1;
    }
  }
`;

export const MacroEditControls: React.FC<{
  isFullscreen: boolean;
  isRecording: boolean;
  optimizeRecording: boolean;
  recordDelays: boolean;
  hasUnsavedChanges?: boolean;
  undoChanges(): void;
  deleteMacro(): void;
  saveChanges(): void;
  toggleOptimizeRecording(): void;
  toggleRecordDelays(): void;
  toggleFullscreen(): void;
  isEmpty?: boolean;
  recordingToggleChange: (a: boolean) => void;
  addText: () => void;
  isDelaySupported: boolean;
}> = ({
  isFullscreen,
  isRecording,
  recordingToggleChange,
  hasUnsavedChanges,
  undoChanges,
  saveChanges,
  recordDelays,
  toggleRecordDelays,
  optimizeRecording,
  toggleOptimizeRecording,
  isEmpty,
  deleteMacro,
  toggleFullscreen,
  isDelaySupported,
}) => {
  const {t} = useTranslation();
  const recordComponent = (
    <MacroButton
      onClick={() => {
        recordingToggleChange(!isRecording);
      }}
      disabled={!isFullscreen}
    >
      <FontAwesomeIcon
        size={'sm'}
        color={'var(--color_label)'}
        icon={isRecording ? faSquare : faCircle}
      />
      <IconButtonTooltip>
        {isFullscreen
          ? isRecording
            ? t('Stop Recording')
            : t('Record Keystrokes')
          : t('Can only record when fullscreen')}
      </IconButtonTooltip>
    </MacroButton>
  );
  return (
    <MacroEditControlsContainer>
      {hasUnsavedChanges ? (
        <>
          {!isRecording ? (
            <>
              <MacroControlGroupContainer>
                <MacroButton
                  disabled={!hasUnsavedChanges || isRecording}
                  onClick={undoChanges}
                >
                  <FontAwesomeIcon
                    size={'sm'}
                    color="var(--color_label)"
                    icon={faUndo}
                  />
                  <IconButtonTooltip>Undo Changes</IconButtonTooltip>
                </MacroButton>
                <MacroButton
                  disabled={!hasUnsavedChanges || isRecording}
                  onClick={() => saveChanges()}
                >
                  <FontAwesomeIcon
                    size={'sm'}
                    color="var(--color_label)"
                    icon={faSave}
                  />
                  <IconButtonTooltip>Save Changes</IconButtonTooltip>
                </MacroButton>
              </MacroControlGroupContainer>
              <MacroControlGroupDivider />
            </>
          ) : null}
        </>
      ) : !isEmpty ? (
        <>
          <MacroControlGroupContainer>
            <MacroButton
              disabled={hasUnsavedChanges || isRecording}
              onClick={deleteMacro}
            >
              <FontAwesomeIcon
                size={'sm'}
                color="var(--color_label)"
                icon={faTrash}
              />
              <IconButtonTooltip>Delete Macro</IconButtonTooltip>
            </MacroButton>
          </MacroControlGroupContainer>
          <MacroControlGroupDivider />
        </>
      ) : (
        <></>
      )}
      <MacroControlGroupContainer>
        {recordComponent}
        {
          <MacroButton onClick={toggleFullscreen}>
            <FontAwesomeIcon
              size={'sm'}
              color="var(--color_label)"
              icon={isFullscreen ? faCompress : faExpand}
            />
            <IconButtonTooltip>
              {isFullscreen ? t('Exit Fullscreen') : t('Fullscreen')}
            </IconButtonTooltip>
          </MacroButton>
        }
      </MacroControlGroupContainer>
      {!isRecording ? (
        <>
          <MacroControlGroupDivider />
          <MacroControlGroupContainer>
            <MacroToggle
              $selected={optimizeRecording}
              onClick={toggleOptimizeRecording}
            >
              <FontAwesomeIcon size={'sm'} icon={faMagicWandSparkles} />
              <IconButtonTooltip>
                {!optimizeRecording
                  ? t('Use Smart Optimization')
                  : t('Skip Smart Optimization')}
              </IconButtonTooltip>
            </MacroToggle>
            <MacroToggle
              disabled={!isDelaySupported}
              $selected={recordDelays}
              onClick={toggleRecordDelays}
            >
              <FontAwesomeIcon
                size={'sm'}
                icon={faStopwatch}
                className={'fa-stack-1x'}
              />
              <IconButtonTooltip>
                {!isDelaySupported
                  ? t('Upgrade firmware to use delays')
                  : !recordDelays
                  ? t('Record Delays')
                  : t('Skip Recording Delays')}
              </IconButtonTooltip>
            </MacroToggle>
          </MacroControlGroupContainer>
        </>
      ) : null}
    </MacroEditControlsContainer>
  );
};
