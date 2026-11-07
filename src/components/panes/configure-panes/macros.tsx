import {useState, useMemo, FC, useCallback} from 'react';
import styled from 'styled-components';
import {OverflowCell, SubmenuOverflowCell} from '../grid';
import {CenterPane} from '../pane';
import {title, component} from '../../icons/adjust';
import {MacroDetailPane} from './submenus/macros/macro-detail';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {getSelectedConnectedDevice} from '../../../store/devicesSlice';
import {
  getExpressions,
  getMacroCount,
  saveMacros,
} from '../../../store/macrosSlice';

const MacroListCell = styled(SubmenuOverflowCell)`
  height: 100%;
  max-height: max(0px, calc(100dvh - var(--mg-header-height) - var(--mg-workspace-height) - 1px));
  min-height: 0;
  box-sizing: border-box;
  overscroll-behavior: contain;
  border-top: 0;
  border-right: 1px solid var(--mg-border);
  background: var(--mg-editor);
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;
`;

const MacroEditorCell = styled(OverflowCell)`
  height: 100%;
  max-height: max(0px, calc(100dvh - var(--mg-header-height) - var(--mg-workspace-height) - 1px));
  min-height: 0;
  border: 0;
  overflow: hidden;
  background: var(--mg-editor);
`;

const MacroPane = styled(CenterPane)`
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--mg-editor);
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;
`;

const Container = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-items: stretch;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  min-width: 0;
  max-width: 1024px;
  overflow: hidden;
  margin: 0 auto;
  padding: 24px 32px;

  @media (max-width: 1400px) {
    padding: 20px 24px;
  }
`;

const MenuContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 24px 16px;
`;

const MacroListButton = styled.button<{$selected: boolean}>`
  display: block;
  width: 100%;
  min-height: 34px;
  padding: 5px 14px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: ${({$selected}) =>
    $selected ? 'var(--mg-nav-active)' : 'transparent'};
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  font-weight: ${({$selected}) => ($selected ? 600 : 400)} !important;
  letter-spacing: 0;
  text-align: center;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;

  &:hover {
    background: ${({$selected}) =>
      $selected ? 'var(--mg-nav-active)' : 'rgba(33, 33, 33, 0.04)'};
  }

  &:active {
    background: var(--mg-nav-active);
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -2px;
  }
`;

export const Pane: FC = () => {
  const dispatch = useAppDispatch();
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const macroExpressions = useAppSelector(getExpressions);
  const macroCount = useAppSelector(getMacroCount);

  const [selectedMacro, setSelectedMacro] = useState(0);

  const saveMacro = useCallback(
    async (macro: string) => {
      if (!selectedDevice) {
        return;
      }

      const newMacros = macroExpressions.map((oldMacro, i) =>
        i === selectedMacro ? macro : oldMacro,
      );

      dispatch(saveMacros(selectedDevice, newMacros));
    },
    [macroExpressions, saveMacros, dispatch, selectedDevice, selectedMacro],
  );

  const macroMenus = useMemo(
    () =>
      Array(macroCount)
        .fill(0)
        .map((_, idx) => idx)
        .map((idx) => (
          <MacroListButton
            type="button"
            aria-pressed={selectedMacro === idx}
            $selected={selectedMacro === idx}
            onClick={() => setSelectedMacro(idx)}
            key={idx}
          >
            {`M${idx}`}
          </MacroListButton>
        )),
    [selectedMacro, macroCount],
  );

  if (!selectedDevice) {
    return null;
  }
  return (
    <>
      <MacroListCell>
        <MenuContainer>{macroMenus}</MenuContainer>
      </MacroListCell>
      <MacroEditorCell>
        <MacroPane>
          <Container>
            <MacroDetailPane
              macroExpressions={macroExpressions}
              selectedMacro={selectedMacro}
              saveMacros={saveMacro}
              protocol={selectedDevice ? selectedDevice.protocol : -1}
            />
          </Container>
        </MacroPane>
      </MacroEditorCell>
    </>
  );
};

// TODO: these are used in the context that configure.tsx imports menus with props Icon, Title, Pane.
// Should we encapsulate this type and wrap the exports to conform to them?
export const Icon = component;
export const Title = title;
