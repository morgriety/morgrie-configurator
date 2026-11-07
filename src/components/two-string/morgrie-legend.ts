import {createContext} from 'react';

type LegendScale = {scale: number; pixelRatio: number};
export const MorgrieScaleContext = createContext<LegendScale | null>(null);

type KeyLegend = {
  label?: string;
  topLabel?: string;
  bottomLabel?: string;
  tooltipLabel?: string;
  shortLabel?: string;
};

// Keys here are VIA keycodes, never strings taken from a custom key or a macro.
const names: Record<string, readonly [string, string]> = {
  KC_CAPS: ['Caps', 'Caps Lock'],
  KC_LSFT: ['LShift', 'Left Shift'], KC_RSFT: ['RShift', 'Right Shift'],
  KC_PGUP: ['PgUp', 'Page Up'], KC_PGDN: ['PgDn', 'Page Down'],
  KC_LCTL: ['LCtrl', 'Left Ctrl'], KC_RCTL: ['RCtrl', 'Right Ctrl'],
  KC_LALT: ['LAlt', 'Left Alt'], KC_RALT: ['RAlt', 'Right Alt'],
  KC_DEL: ['Del', 'Delete'], KC_INS: ['Ins', 'Insert'],
  KC_BSPC: ['Backspace', 'Backspace'],
};

export function getMorgrieLegend(legend: KeyLegend, code?: string, shortName?: string): KeyLegend {
  const standard = code && names[code];
  if (standard) {
    return {...legend, label: standard[0], tooltipLabel: standard[1],
      shortLabel: code === 'KC_BSPC' ? 'Bksp' : undefined};
  }
  return shortName ? {...legend, shortLabel: shortName} : legend;
}

// Face dimensions are CSS px before the board transform. Only the backing
// bitmap follows DPR; all measurements below use final, visible CSS px.
export function paintMorgrieLegend(
  canvas: HTMLCanvasElement,
  faceWidth: number,
  faceHeight: number,
  {scale, pixelRatio}: LegendScale,
  legend?: KeyLegend,
  sideRoom = 0,
) {
  const width = faceWidth * scale;
  const height = faceHeight * scale;
  const setBitmapWidth = (extra: number) => {
    canvas.width = Math.max(1, Math.round((width + 2 * extra) * pixelRatio));
    canvas.style.width = `${faceWidth + (extra ? 2 * extra / scale : 0)}px`;
    canvas.style.marginLeft = extra ? `${-extra / scale}px` : '';
  };
  setBitmapWidth(0);
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  canvas.style.height = `${faceHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx || !legend || width <= 0 || height <= 0) return false;

  const stacked = !!(legend.topLabel && legend.bottomLabel);
  const lines = stacked ? [legend.topLabel!, legend.bottomLabel!] : [legend.label || ''];
  if (!lines[0]) return false;

  const named = !stacked && Array.from(lines[0]).length > 1;
  const gap = stacked ? Math.min(3, height * 0.08) : 0;
  // Keep the accepted glyph placement, including its two-row height constraint.
  const size = named ? 11 : Math.min(stacked ? 13 : 14, (height * 0.85 - gap) / lines.length);
  const font = `500 ${size}px Inter, Arial, sans-serif`;
  ctx.font = font;

  let inset = Math.min(5, width * 0.1);
  let extra = 0;
  let needsTooltip = false;
  if (named) {
    const measure = (s: string) => {
      const metrics = ctx.measureText(s);
      // Glyph ink can extend past the advance, even in upright Inter.
      const overhangLeft = Math.max(0, metrics.actualBoundingBoxLeft || 0);
      return {left: overhangLeft, width: overhangLeft +
        Math.max(metrics.width, metrics.actualBoundingBoxRight || 0)};
    };
    let text = lines[0];
    // Reclaim the label padding first; for a narrow key the text canvas may
    // also use the existing shoulder, staying inside the same key's outline.
    const maxExtra = sideRoom * scale;
    const maxWidth = width + 2 * maxExtra;
    let ink = measure(text);
    if (ink.width > maxWidth && legend.shortLabel) {
      const shorter = measure(legend.shortLabel);
      if (shorter.width < ink.width) {
        text = legend.shortLabel;
        ink = shorter;
      }
    }
    extra = Math.min(maxExtra, Math.max(0, (ink.width + 1 - width) / 2));
    if (extra) setBitmapWidth(extra); // changing backing width resets the context
    inset = ink.left + Math.max(0, Math.min(inset + extra, (width + 2 * extra - ink.width) / 2));
    lines[0] = text;
    // Never synthesize an abbreviation or squeeze an unknown keycode. If even
    // the complete canvas is too small, its own bounds clip ink; hover is intact.
    needsTooltip = ink.width > maxWidth || text !== (legend.tooltipLabel || legend.label);
  }
  ctx.setTransform(canvas.width / (width + 2 * extra), 0, 0, canvas.height / height, 0, 0);
  ctx.font = font;
  ctx.fillStyle = '#212121';
  const blockHeight = size * lines.length + gap;
  let lineTop = (height - blockHeight) / 2;
  if (!stacked && !named) lineTop = Math.min(lineTop, height * 0.16);
  for (const text of lines) {
    const metrics = ctx.measureText(text);
    const baseline = lineTop + (size + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, inset, baseline);
    lineTop += size + gap;
  }
  return needsTooltip;
}
