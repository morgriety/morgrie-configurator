import styled from 'styled-components';
import {
  ControlRow,
  Detail,
  Label,
  OverflowCell,
  SubmenuOverflowCell,
  SubmenuRow,
} from '../../grid';
import {RangeValueDisplay} from '../../../inputs/accent-range';
import {AccentButton} from '../../../inputs/accent-button';

// Mounted only for a definition's Lighting menu. Other v3 menus keep their CSS.
export const LightingMenuRow = styled(SubmenuRow).attrs((props) => ({
  as: 'button',
  type: 'button',
  'aria-pressed': props.$selected,
}))``;

export const LightingMenuStyles = styled.div`
  display: contents;
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;

  ${SubmenuOverflowCell} {
    border-top: 0;
    border-right: 1px solid var(--mg-border);
    background: var(--mg-editor);
    scrollbar-width: thin;
    scrollbar-color: var(--mg-border) transparent;

    > div {
      padding: 24px 16px;
    }
  }

  ${SubmenuRow.toString()} {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 34px;
    margin: 0 0 7px;
    padding: 5px 14px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--mg-text);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;
    text-transform: none;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
    transition: background 140ms ease;

    &:hover {
      background: rgba(33, 33, 33, 0.04);
    }

    &:active {
      background: var(--mg-nav-active);
    }

    &:focus-visible {
      outline: 2px solid var(--mg-text-secondary);
      outline-offset: -2px;
    }
  }

  ${LightingMenuRow.toString()}[aria-pressed='true'] {
    background: var(--mg-nav-active);
    font-weight: 600;
  }

  ${OverflowCell} {
    border: 0;
    background: var(--mg-editor);
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--mg-border) transparent;

    > div {
      height: auto;
      min-height: 100%;
      overflow: visible;
      background: var(--mg-editor);

      > div {
        align-items: stretch;
        box-sizing: border-box;
        width: 100%;
        max-width: 1024px;
        margin: 0 auto;
        padding: 24px 32px 32px;
      }
    }
  }

  ${ControlRow} {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(200px, 280px);
    gap: 24px;
    max-width: none;
    min-height: 64px;
    padding: 14px 0;
    border-bottom: 1px solid var(--mg-border);
    align-items: center;
  }

  ${Label} {
    min-width: 0;
    color: var(--mg-text);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }

  ${Detail} {
    min-width: 0;
    color: var(--mg-text);
    justify-content: flex-end;

    > span:has(input[type='range']) {
      width: 100%;
      min-width: 0;
    }
  }

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

    &::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 2px;
      background: var(--mg-nav-active);
    }

    &::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      margin-top: -5px;
      border: 2px solid var(--mg-editor);
      border-radius: 50%;
      background: var(--mg-text);
      box-shadow: 0 0 0 1px var(--mg-text-secondary);
    }

    &::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: var(--mg-nav-active);
    }

    &::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border: 2px solid var(--mg-editor);
      border-radius: 50%;
      background: var(--mg-text);
      box-shadow: 0 0 0 1px var(--mg-text-secondary);
    }
  }

  input[type='number'] {
    box-sizing: border-box;
    height: 34px;
    width: 80px;
    padding: 5px 8px;
    border: 1px solid var(--mg-border);
    border-radius: 7px;
    background: var(--mg-editor);
    color: var(--mg-text);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;

    &:invalid,
    &:placeholder-shown {
      color: var(--color_error);
    }
  }

  ${RangeValueDisplay} {
    color: var(--mg-text);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;
  }

  ${AccentButton} {
    box-sizing: border-box;
    min-height: 34px;
    border: 1px solid var(--mg-border);
    border-radius: 7px;
    padding: 5px 14px;
    background: var(--mg-nav-active);
    color: var(--mg-text);
    font: 400 14px/22px var(--mg-font);
    letter-spacing: 0;
  }

  && :focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 2px;
  }

  && ${SubmenuRow.toString()}:focus-visible {
    outline-offset: -2px;
  }

  /* Keep the original color gradient, swatch values and pointer handlers.
     An opened picker participates in this scroll region, so it stays reachable. */
  [data-mg-lighting-control='color'] ${Detail} > div {
    flex-direction: column;
    align-items: flex-end;

    > div:nth-child(2) {
      position: relative;
      transform: none;
      margin-top: 12px;
      box-shadow: none;

      &::after {
        display: none;
      }

      input[type='text'] {
        font: 400 14px/22px var(--mg-font);
        color: var(--mg-text);
      }
    }
  }

  @media (max-width: 1400px) {
    ${OverflowCell} > div > div {
      padding: 20px 24px 24px;
    }
  }

  @media (max-width: 900px) {
    ${ControlRow} {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }

    ${Detail} {
      justify-content: flex-start;
    }
  }
`;
