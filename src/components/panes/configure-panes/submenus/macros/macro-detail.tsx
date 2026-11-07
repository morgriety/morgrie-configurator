import {getAST} from 'src/store/macrosSlice';
import React, {useCallback, useEffect, useState} from 'react';
import styled from 'styled-components';
import {MacroRecorder} from './macro-recorder';
import {useAppSelector} from 'src/store/hooks';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faClapperboard, faCode} from '@fortawesome/free-solid-svg-icons';
import {ScriptMode} from './script-mode';
import {getIsDelaySupported, getMacroBufferSize} from 'src/store/macrosSlice';
import {
  getSelectedConnectedDevice,
  getSelectedKeyboardAPI,
} from 'src/store/devicesSlice';
import {getMacroAPI} from 'src/utils/macro-api';
import {useTranslation} from 'react-i18next';
import {getSelectedKeycodesVersion} from 'src/store/firmwareSlice';

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 20px;
  min-height: 34px;
  margin-bottom: 20px;
`;

const ProgressBarContainer = styled.div`
  width: 250px;
  max-width: 50%;
  color: var(--mg-text-secondary);
`;

const ProgressBar = styled.div`
  position: relative;
  height: 4px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--mg-nav-active);

  > span {
    position: absolute;
    inset: 0;
    background: var(--mg-text-secondary);
    transform: scaleX(0.1);
    transform-origin: left;
    transition: transform 140ms ease;
  }
`;

const CapacityLabel = styled.div`
  margin-top: 6px;
  font: 400 12px/18px var(--mg-font);
  letter-spacing: 0;
  text-align: right;
  overflow-wrap: anywhere;
`;

const MacroTab = styled.button<{$selected: boolean}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 40px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  background: ${({$selected}) =>
    $selected ? 'var(--mg-nav-active)' : 'transparent'};
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;

  &:hover {
    border-color: var(--mg-text-secondary);
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 3px;
  }
`;

const TabBar = styled.div`
  display: flex;
  gap: 7px;
`;

const CenterTabContainer = styled.div`
  display: flex;
  flex: 0 0 auto;
`;

type Props = {
  macroExpressions: string[];
  selectedMacro: number;
  saveMacros: (macro: string) => void;
  protocol: number;
};

const printBytesUsed = (bytesUsed: number, bufferSize: number) => {
  const {t} = useTranslation();
  const units = ['Bytes', 'kB', 'MB', 'GB'];
  const scale = Math.floor(Math.log10(bufferSize) / 3);
  const suffix = units[scale];
  const denominator = scale === 0 ? 1 : Math.pow(1000, scale);
  const convertedBytesUsed = bytesUsed / denominator;
  const convertedBufferSize = bufferSize / denominator;

  return `${convertedBytesUsed.toFixed(scale)} / ${convertedBufferSize.toFixed(
    scale,
  )} ${suffix} ${t('space used')}`;
};

const BufferSizeUsage = () => {
  const ast = useAppSelector(getAST);
  const bufferSize = useAppSelector(getMacroBufferSize);
  const connectedDevice = useAppSelector(getSelectedConnectedDevice);
  const api = useAppSelector(getSelectedKeyboardAPI);
  const keycodesVersion = useAppSelector(getSelectedKeycodesVersion);
  if (!connectedDevice || !api) {
    return null;
  }
  const {protocol} = connectedDevice;
  const macroApi = getMacroAPI(protocol, keycodesVersion, api);
  const bytesUsed = macroApi.rawKeycodeSequencesToMacroBytes(ast).length;
  return (
    <ProgressBarContainer>
      <ProgressBar>
        <span style={{transform: `scaleX(${bytesUsed / bufferSize})`}} />
      </ProgressBar>
      <CapacityLabel>
        {printBytesUsed(bytesUsed, bufferSize)}
      </CapacityLabel>
    </ProgressBarContainer>
  );
};

export const MacroDetailPane: React.FC<Props> = (props) => {
  const currentMacro = props.macroExpressions[props.selectedMacro] || '';
  const [showAdvancedView, setShowAdvancedView] = React.useState(false);
  const ast = useAppSelector(getAST);
  const isDelaySupported = useAppSelector(getIsDelaySupported);
  const [unsavedMacro, setUnsavedMacro] = useState(currentMacro);

  useEffect(() => {
    setUnsavedMacro(currentMacro);
  }, [currentMacro]);

  const undoChanges = useCallback(() => {
    setUnsavedMacro(currentMacro);
  }, [currentMacro]);

  const saveMacro = useCallback(
    (macro?: string) => {
      if (macro !== undefined) {
        props.saveMacros('');
        setUnsavedMacro('');
      } else if (unsavedMacro !== currentMacro) {
        props.saveMacros(unsavedMacro);
        setUnsavedMacro(unsavedMacro);
      }
    },
    [unsavedMacro, currentMacro, props.saveMacros],
  );

  return (
    <>
      <DetailHeader>
        <CenterTabContainer>
          <TabBar>
            <MacroTab
              type="button"
              aria-label="Macro recorder"
              aria-pressed={!showAdvancedView}
              $selected={!showAdvancedView}
              onClick={() => setShowAdvancedView(false)}
            >
              <FontAwesomeIcon icon={faClapperboard} />
            </MacroTab>
            <MacroTab
              type="button"
              aria-label="Macro script"
              aria-pressed={showAdvancedView}
              $selected={showAdvancedView}
              onClick={() => setShowAdvancedView(true)}
            >
              <FontAwesomeIcon icon={faCode} />
            </MacroTab>
          </TabBar>
        </CenterTabContainer>
        <BufferSizeUsage />
      </DetailHeader>
      {showAdvancedView ? (
        <ScriptMode
          macro={currentMacro}
          macroIndex={props.selectedMacro}
          protocol={props.protocol}
          isDelaySupported={isDelaySupported}
          setUnsavedMacro={setUnsavedMacro}
          saveMacros={props.saveMacros}
          key={props.selectedMacro}
        />
      ) : (
        <MacroRecorder
          selectedMacro={ast[props.selectedMacro]}
          setUnsavedMacro={setUnsavedMacro}
          undoMacro={undoChanges}
          saveMacro={saveMacro}
          isDelaySupported={isDelaySupported}
        />
      )}
    </>
  );
};
