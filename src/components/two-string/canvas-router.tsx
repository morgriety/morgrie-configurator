import {useRef} from 'react';
import {useLocation} from 'wouter';
import styled from 'styled-components';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getSelectedDefinition} from 'src/store/definitionsSlice';
import {
  getIsSelectedDeviceReady,
  getSelectedConnectedDevice,
} from 'src/store/devicesSlice';
import {
  clearSelectedKey,
  getConfigureKeyboardIsSelectable,
} from 'src/store/keymapSlice';
import {useSize} from 'src/utils/use-size';
import {ConfigureKeyboard} from '../n-links/keyboard/configure';
import {Design} from '../n-links/keyboard/design';
import {Test} from '../n-links/keyboard/test';

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
`;

const Scene = styled.div<{$active: boolean}>`
  position: absolute;
  inset: 0;
  display: ${({$active}) => ($active ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
`;

export const CanvasRouter = () => {
  const [path] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const dimensions = useSize(ref);
  const dispatch = useAppDispatch();
  const definition = useAppSelector(getSelectedDefinition);
  const ready = useAppSelector(getIsSelectedDeviceReady);
  const device = useAppSelector(getSelectedConnectedDevice);
  const selectable = useAppSelector(getConfigureKeyboardIsSelectable);
  const clearBackground = () => {
    // Real key clicks stop propagation in KeyGroup; case gaps clear selection.
    dispatch(clearSelectedKey());
  };

  return (
    <Container
      ref={ref}
      onClick={clearBackground}
      data-testid="keyboard-renderer-2d"
    >
      <Scene
        $active={path === '/' && !!definition && !!device && ready}
        aria-hidden={path !== '/' || !ready}
      >
        <ConfigureKeyboard
          dimensions={dimensions}
          selectable={selectable}
          nDimension="2D"
        />
      </Scene>
      <Scene $active={path === '/test'} aria-hidden={path !== '/test'}>
        <Test dimensions={dimensions} nDimension="2D" />
      </Scene>
      <Scene $active={path === '/design'} aria-hidden={path !== '/design'}>
        <Design dimensions={dimensions} nDimension="2D" />
      </Scene>
    </Container>
  );
};
