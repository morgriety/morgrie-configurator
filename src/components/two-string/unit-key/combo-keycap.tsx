import {useContext, useMemo} from 'react';
import {MorgrieScaleContext} from '../morgrie-legend';
import {getComboMaterial} from './combo-material';
import {KeyFocusRing} from './key-focus-ring';
import {DisplayMode} from 'src/types/keyboard-rendering';
import {getDarkenedColor} from 'src/utils/color-math';
import {CSSVarObject} from 'src/utils/keyboard-rendering';
import styled from 'styled-components';
import {Keycap2DTooltip} from '../../inputs/tooltip';
import {
  CanvasContainer,
  CanvasContainerBG,
  morgrieFacePaint,
  morgrieWallPaint,
  morgrieSelectedPaint,
  KeycapContainer,
  TestOverlay,
  TooltipContainer,
} from './keycap-base';

const MaterialHit = styled.div`
  position: relative;
  &[data-selected] {
    ${morgrieSelectedPaint}
  }
`;

const MaterialWall = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  ${morgrieWallPaint}
`;

const MaterialFace = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  ${morgrieFacePaint}
`;

const LegendBox = styled.div`
  position: absolute;
  pointer-events: none;
`;

export const ComboKeycap = (props: any) => {
  const {
    normalizedRects,
    clipPath,
    overflowsTexture,
    macroData,
    label,
    canvasRef,
    onClick,
    onPointerDown,
    onPointerOver,
    onPointerOut,
    disabled,
    navigation,
    ...otherProps
  } = props;
  const [r1, r2] = normalizedRects;
  const hasBrandMaterial = useContext(MorgrieScaleContext) !== null;
  const material = useMemo(
    () => (hasBrandMaterial ? getComboMaterial(normalizedRects) : null),
    [hasBrandMaterial, normalizedRects],
  );
  if (material) {
    return (
      <KeycapContainer {...navigation} style={{...props.style, pointerEvents: 'none'}}>
        <MaterialHit
          data-selected={props.selected || undefined}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          style={{
            width: material.width,
            height: material.height,
            clipPath,
            transform: `translateX(${-Math.abs(r1[0] - r2[0]) * CSSVarObject.keyXPos / 2}px)`,
            pointerEvents: disabled ? 'none' : 'auto',
            cursor: disabled ? 'initial' : 'pointer',
          }}
        >
          <MaterialWall style={{clipPath: material.wallClip}} />
          <MaterialFace style={{clipPath: material.faceClip}} />
          <LegendBox style={material.legendBox}>
            <canvas ref={canvasRef} />
          </LegendBox>
        </MaterialHit>
        {navigation && <KeyFocusRing rects={normalizedRects} />}
        {(macroData || overflowsTexture) && (
          <TooltipContainer $rotate={props.rotation[2]}>
            <Keycap2DTooltip>{macroData || label?.tooltipLabel}</Keycap2DTooltip>
          </TooltipContainer>
        )}
      </KeycapContainer>
    );
  }
  // Separate custom rectangles keep VIA's geometry and use the same selected palette.
  const brandSelected = hasBrandMaterial && props.selected;
  const face = brandSelected ? 'var(--mg-keycap)' : props.color.c;
  const wall = brandSelected
    ? 'var(--mg-keyboard-frame)'
    : getDarkenedColor(props.color.c, 0.8);
  return (
    <>
      <KeycapContainer {...otherProps} {...navigation}>
        <ComboKeyBoundingContainer
          $selected={props.selected}
          data-selected={brandSelected || undefined}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          style={{
            cursor: !disabled ? 'pointer' : 'initial',
            position: 'relative',
            animation: disabled || hasBrandMaterial
              ? 'initial' // This prevents the hover animation from firing when the keycap can't be interacted with
              : props.selected
              ? '.75s infinite alternate select-glow'
              : '',
            transform: `translateX(${
              (-Math.abs(r1[0] - r2[0]) * CSSVarObject.keyXPos) / 2
            }px) perspective(100px) translateZ(${props.keycapZ}px)`,
            width:
              Math.max(r1[2], r2[2]) * CSSVarObject.keyXPos -
              CSSVarObject.keyXSpacing,
            height:
              Math.max(r1[3], r2[3]) * CSSVarObject.keyYPos -
              CSSVarObject.keyYSpacing,
            clipPath,
          }}
        >
          <ComboKeyRectContainer
            style={{
              position: 'absolute',
              borderRadius: 3,
              background: wall,
              transform: `translate(${CSSVarObject.keyXPos * r1[0]}px,${
                CSSVarObject.keyYPos * r1[1]
              }px)`,
              width: r1[2] * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing,
              height: r1[3] * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing,
            }}
          />
          <ComboKeyRectContainer
            style={{
              position: 'absolute',
              borderRadius: 3,
              transform: `translate(${CSSVarObject.keyXPos * r2[0]}px,${
                CSSVarObject.keyYPos * r2[1]
              }px)`,
              background: wall,
              width: r2[2] * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing,
              height: r2[3] * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing,
            }}
          />
          <ComboKeyBGContainer
            style={{
              position: 'absolute',
              borderRadius: 3,
              background: wall,
              transform: `translate(${CSSVarObject.keyXPos * r1[0] + 1}px,${
                1 + CSSVarObject.keyYPos * r1[1]
              }px)`,
              width:
                r1[2] * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing - 2,
              height:
                r1[3] * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing - 2,
            }}
          />
          <CanvasContainer
            style={{
              borderRadius: 4,
              background: face,
              position: 'absolute',
              transform: `translate(${
                CSSVarObject.keyXPos * r1[0] + CSSVarObject.faceXPadding[0]
              }px,${
                CSSVarObject.faceYPadding[0] + CSSVarObject.keyYPos * r1[1]
              }px)`,
              width:
                r1[2] * CSSVarObject.keyXPos -
                CSSVarObject.keyXSpacing -
                CSSVarObject.faceXPadding[0] -
                CSSVarObject.faceXPadding[1],
              height:
                r1[3] * CSSVarObject.keyYPos -
                CSSVarObject.keyYSpacing -
                CSSVarObject.faceYPadding[0] -
                CSSVarObject.faceYPadding[1],
            }}
          />
          <CanvasContainer
            style={{
              borderRadius: 4,
              background: face,
              position: 'absolute',
              transform: `translate(${
                CSSVarObject.keyXPos * r2[0] + CSSVarObject.faceXPadding[0]
              }px,${
                CSSVarObject.faceYPadding[0] + CSSVarObject.keyYPos * r2[1]
              }px)`,
              width:
                r2[2] * CSSVarObject.keyXPos -
                CSSVarObject.keyXSpacing -
                CSSVarObject.faceXPadding[0] -
                CSSVarObject.faceXPadding[1],
              height:
                r2[3] * CSSVarObject.keyYPos -
                CSSVarObject.keyYSpacing -
                CSSVarObject.faceYPadding[0] -
                CSSVarObject.faceYPadding[1],
            }}
          />
          <CanvasContainerBG
            style={{
              borderRadius: 4,
              background: face,
              position: 'absolute',
              transform: `translate(${
                1 + CSSVarObject.keyXPos * r1[0] + CSSVarObject.faceXPadding[0]
              }px,${
                1 + CSSVarObject.faceYPadding[0] + CSSVarObject.keyYPos * r1[1]
              }px)`,
              width:
                r1[2] * CSSVarObject.keyXPos -
                CSSVarObject.keyXSpacing -
                CSSVarObject.faceXPadding[0] -
                CSSVarObject.faceXPadding[1] -
                2,
              height:
                r1[3] * CSSVarObject.keyYPos -
                CSSVarObject.keyYSpacing -
                CSSVarObject.faceYPadding[0] -
                CSSVarObject.faceYPadding[1] -
                2,
            }}
          >
            <canvas ref={canvasRef} style={{}} />
          </CanvasContainerBG>
          {DisplayMode.Test === props.mode ? (
            <TestOverlay
              style={{
                background: props.keycapColor,
                opacity: props.keycapOpacity,
              }}
            ></TestOverlay>
          ) : null}
        </ComboKeyBoundingContainer>
        {navigation && <KeyFocusRing rects={normalizedRects} />}
        {(props.macroData || props.overflowsTexture) && (
          <TooltipContainer $rotate={props.rotation[2]}>
            <Keycap2DTooltip>
              {props.macroData || (props.label && props.label.tooltipLabel)}
            </Keycap2DTooltip>
          </TooltipContainer>
        )}
      </KeycapContainer>
    </>
  );
};

const ComboKeyBoundingContainer = styled(MaterialHit)<{$selected: boolean}>`
  box-sizing: border-box;
  transition: transform 0.2s ease-out;
  animation: ${(p) =>
    p.$selected ? '.75s infinite alternate select-glow' : 'initial'};
  &:hover {
    transform: perspective(100px) translateZ(-5px);
    animation: 0.5s 1 forwards select-glow;
  }
`;

const ComboKeyRectContainer = styled.div<{}>`
  box-sizing: border-box;
  padding: 2px 6px 10px 6px;
  box-shadow: inset -1px -1px 0 rgb(0 0 0 / 20%),
    inset 1px 1px 0 rgb(255 255 255 / 20%);
`;
const ComboKeyBGContainer = styled.div<{}>`
  box-sizing: border-box;
  padding: 3px 7px 10px 6px;
`;
