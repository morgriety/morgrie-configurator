import type {CSSProperties} from 'react';
import styled from 'styled-components';
import {CSSVarObject} from 'src/utils/keyboard-rendering';
import {getComboMaterial} from './combo-material';

type Rect = [number, number, number, number];

const FocusRing = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 2;
  visibility: hidden;
  fill: none;
  stroke: var(--mg-text, #212121);
  stroke-width: var(--key-focus-width, 2px);
  stroke-linejoin: round;

  /* The focus owner is the individual navigation target, never the toolbar. */
  [data-key-index]:focus > & {
    visibility: visible;
  }
`;

export function KeyFocusRing({rects, style, radius = 5}: {
  rects?: [Rect, Rect];
  style?: CSSProperties;
  radius?: number;
}) {
  // Inset the indicator onto the light shell so it contrasts with the dark plate.
  const material = rects ? getComboMaterial(rects, 3) : null;
  const shapeStyle = rects ? {
    width: Math.max(rects[0][2], rects[1][2]) * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing,
    height: Math.max(rects[0][3], rects[1][3]) * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing,
    transform: 'translateX(' + (-Math.abs(rects[0][0] - rects[1][0]) * CSSVarObject.keyXPos / 2) + 'px)',
  } : undefined;
  return (
    <FocusRing data-key-focus-ring aria-hidden="true" focusable="false" style={{...shapeStyle, ...style}}>
      {material ? (
        // Reuse the accepted continuous perimeter; no new key/hit geometry.
        <path d={material.wallClip.slice(6, -2)} />
      ) : rects ? rects.map(([x, y, w, h], index) => (
        <rect key={index} x={x * CSSVarObject.keyXPos + 3} y={y * CSSVarObject.keyYPos + 3}
          width={w * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing - 6}
          height={h * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing - 6} rx={radius} />
      )) : (
        <rect x="3" y="3" width="calc(100% - 6px)" height="calc(100% - 6px)" rx={radius} />
      )}
    </FocusRing>
  );
}
