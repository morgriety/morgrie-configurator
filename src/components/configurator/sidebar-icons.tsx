import type {ComponentType, ReactNode} from 'react';

// These glyphs are local to the Sidebar; pane and keyboard icons stay unchanged.
const glyphs: Record<string, ReactNode> = {
  keymap: (
    <>
      <path d="M7 5V3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V5" />
      <path d="M7 5H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M10 8v6m-2-2 2 2 2-2" />
    </>
  ),
  macros: (
    <>
      <rect x="3" y="2" width="14" height="16" rx="6" />
      <path d="M7 8h4a2 2 0 0 1 0 4H9m0-6L7 8l2 2m1 2v2" />
    </>
  ),
  lighting: (
    <>
      <path d="M7.5 14v-1.2a4.5 4.5 0 1 1 5 0V14m-5 0h5m-5 2h5m-4 2h3M10 2V1m6.4 4.6 1-1M3.6 4.6l-1-1M17 9h2M1 9h2m.6 4.4-1 1m13.8-1 1 1" />
    </>
  ),
  layouts: (
    <>
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="12" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="12" width="6" height="6" rx="1" />
      <rect x="12" y="12" width="6" height="6" rx="1" />
    </>
  ),
  'key-tester': (
    <>
      <path d="M9 16H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4M5 8h.01M8 8h.01M11 8h.01M14 8h.01M5 12h3m4 2 2 2 4-5" />
    </>
  ),
  settings: (
    <>
      <path d="m8 1.5 .5 2a6 6 0 0 1 3 0l.5-2 2 1-.5 2a6 6 0 0 1 2 2l2-.5 1 2-2 .5a6 6 0 0 1 0 3l2 .5-1 2-2-.5a6 6 0 0 1-2 2l.5 2-2 1-.5-2a6 6 0 0 1-3 0l-.5 2-2-1 .5-2a6 6 0 0 1-2-2l-2 .5-1-2 2-.5a6 6 0 0 1 0-3l-2-.5 1-2 2 .5a6 6 0 0 1 2-2L6 2.5Z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
};

export const SidebarIcon = ({
  name,
  fallback: Fallback,
}: {
  name: string;
  fallback?: ComponentType<any>;
}) => {
  const glyph = glyphs[name];
  if (!glyph) return Fallback ? <Fallback /> : null;

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  );
};
