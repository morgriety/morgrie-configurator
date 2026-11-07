import React, {useMemo} from 'react';
import {shallowEqual} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {getThemeName} from 'src/store/settingsSlice';
import {MORGRIE_LIGHT} from 'src/utils/themes';
import {
  calculateKeyboardFrameDimensions,
  CSSVarObject,
} from 'src/utils/keyboard-rendering';
import styled from 'styled-components';
import {
  DisplayMode,
  KeyboardCanvasProps,
  KeyboardCanvasContentProps,
} from 'src/types/keyboard-rendering';
import {Case} from './case';
import {KeyGroup} from './key-group';
import {MatrixLines} from './matrix-lines';
import {MorgrieScaleContext} from './morgrie-legend';
export const KeyboardCanvas: React.FC<KeyboardCanvasProps<React.MouseEvent>> = (
  props,
) => {
  const {containerDimensions, shouldHide, ...otherProps} = props;
  const {width, height} = useMemo(
    () => calculateKeyboardFrameDimensions(otherProps.keys),
    [otherProps.keys],
  );
  const frameWidth = width * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing + CSSVarObject.insideBorder * 3;
  const frameHeight = height * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing + CSSVarObject.insideBorder * 3;
  const minPadding = 4;
  const ratio =
    Math.min(
      940 / frameWidth,
      Math.max(1, containerDimensions.width - minPadding * 2) / frameWidth,
      Math.max(1, containerDimensions.height - minPadding * 2) / frameHeight,
    ) || 1;

  return (
    <div
      style={{
        transform: `scale(${ratio}, ${ratio})`,
        opacity: shouldHide ? 0 : 1,
        position: 'absolute',
        pointerEvents: shouldHide ? 'none' : 'all',
      }}
    >
      <KeyboardCanvasContent {...otherProps} selectable={otherProps.selectable && !shouldHide} width={width} height={height} ratio={ratio} />
    </div>
  );
};
const KeyboardGroup = styled.div`
  position: relative;
`;

const KeyboardCanvasContent: React.FC<
  KeyboardCanvasContentProps<React.MouseEvent> & {ratio: number}
> = React.memo((props) => {
  const {
    matrixKeycodes,
    keys,
    definition,
    pressedKeys,
    mode,
    showMatrix,
    selectable,
    width,
    height,
  } = props;

  const themeName = useAppSelector(getThemeName);
  const hasMorgrieMaterial =
    mode === DisplayMode.Configure && themeName === MORGRIE_LIGHT;
  const [pixelRatio, setPixelRatio] = React.useState(() => globalThis.devicePixelRatio || 1);
  React.useEffect(() => {
    if (!hasMorgrieMaterial) return;
    const update = () => setPixelRatio(window.devicePixelRatio || 1);
    const query = window.matchMedia(`(resolution: ${pixelRatio}dppx)`);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, [hasMorgrieMaterial, pixelRatio]);
  React.useEffect(() => {
    if (hasMorgrieMaterial) {
      // Canvas initially uses the available fallback. Each key also repaints on loadingdone.
      document.fonts.load('500 14px Inter').catch(() => {});
    }
  }, [hasMorgrieMaterial]);
  const legendScale = useMemo(
    () => hasMorgrieMaterial ? {scale: props.ratio, pixelRatio} : null,
    [hasMorgrieMaterial, props.ratio, pixelRatio],
  );

  return (
    <KeyboardGroup
      data-keyboard-material={hasMorgrieMaterial ? 'morgrie-light' : undefined}
      style={{'--key-focus-width': 2 / props.ratio + 'px'} as React.CSSProperties}
    >
      <Case width={width} height={height} />
      <MorgrieScaleContext.Provider value={legendScale}>
        <KeyGroup
          {...props}
          keys={keys}
          mode={mode}
          matrixKeycodes={matrixKeycodes}
          selectable={selectable}
          definition={definition}
          pressedKeys={pressedKeys}
        />
      </MorgrieScaleContext.Provider>
      {showMatrix && (
        <MatrixLines
          keys={keys}
          rows={definition.matrix.rows}
          cols={definition.matrix.cols}
          width={width}
          height={height}
        />
      )}
    </KeyboardGroup>
  );
}, shallowEqual);
