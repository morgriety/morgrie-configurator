import styled, {css} from 'styled-components';

export const KeycapContainer = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  height: 54px;
  &:hover {
    z-index: 1;
    & .tooltip {
      transform: scale(1) translateY(0px);
      opacity: 1;
    }
  }
  .tooltip {
    transform: translateY(5px) scale(0.6);
    opacity: 0;
  }
`;

export const TooltipContainer = styled.div<{$rotate: number}>`
  position: absolute;
  transform: rotate(${(p) => p.$rotate}rad);
  width: 100%;
  height: 100%;
  bottom: 0;
`;

export const TestOverlay = styled.div`
  transition: all 0.2s ease-out;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
`;

export const CanvasContainerBG = styled.div<{}>``;
export const CanvasContainer = styled.div<{}>`
  box-shadow: inset -1px -1px 0 rgb(0 0 0 / 20%),
    inset 1px 1px 0 rgb(255 255 255 / 10%);
`;

export const morgrieFacePaint = css`
  background-image: linear-gradient(
    to bottom,
    var(--mg-keycap-highlight),
    var(--mg-keycap) 7px,
    var(--mg-keycap) 40%,
    color-mix(in srgb, var(--mg-keycap) 60%, var(--mg-keyboard-frame))
  );
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 24%),
    0 1px 2px rgb(70 60 53 / 9%);
`;

export const morgrieWallPaint = css`
  /* Keep the bevel bands the same thickness on a 1u key and the spacebar. */
  background:
    linear-gradient(
      to right,
      rgb(241 238 235 / 34%),
      transparent 6px,
      transparent calc(100% - 6px),
      rgb(83 71 64 / 9%)
    ),
    linear-gradient(
      to bottom,
      var(--mg-keycap-highlight),
      var(--mg-keyboard-frame) 4px,
      var(--mg-keyboard-frame) calc(100% - 10px),
      color-mix(in srgb, var(--mg-keyboard-frame) 74%, var(--mg-keyboard-inner))
    );
  box-shadow: 0 1px 2px rgb(65 55 48 / 13%);
`;

export const morgrieSelectedPaint = css`
  --mg-keycap: var(--mg-selected);
  --mg-keycap-highlight: color-mix(in srgb, var(--mg-selected) 83%, var(--mg-editor));
  --mg-keyboard-frame: color-mix(in srgb, var(--mg-selected) 86%, var(--mg-keyboard-inner));
`;
