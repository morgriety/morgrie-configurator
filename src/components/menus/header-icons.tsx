import {CSSProperties} from 'react';

const iconStyle: CSSProperties = {
  flex: '0 0 auto',
  verticalAlign: 'middle',
};

export const HeaderChevron = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={iconStyle}
    aria-hidden="true"
    focusable="false"
  >
    <path d="m3 6 5 5 5-5" />
  </svg>
);

export const HeaderPlus = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    style={iconStyle}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);
