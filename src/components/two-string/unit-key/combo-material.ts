import {CSSVarObject} from 'src/utils/keyboard-rendering';

type Point = [number, number];
type Rect = [number, number, number, number];

function perimeter(rects: Rect[]): Point[] {
  // A horizontal slice of two overlapping VIA rectangles is one interval.
  // Walking its right edge down and its left edge up also handles stepped keys.
  const heights = [...new Set(rects.flatMap(([, y, , h]) => [y, y + h]))]
    .sort((a, b) => a - b);
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 1; i < heights.length; i++) {
    const top = heights[i - 1];
    const bottom = heights[i];
    const band = rects.filter(([, y, , h]) => y < bottom && y + h > top);
    const x0 = Math.min(...band.map(([x]) => x));
    const x1 = Math.max(...band.map(([x, , w]) => x + w));
    left.push([x0, top], [x0, bottom]);
    right.push([x1, top], [x1, bottom]);
  }
  const walk = [...right, ...left.reverse()];
  const points = walk.filter(([x, y], i) =>
    i === 0 || x !== walk[i - 1][0] || y !== walk[i - 1][1],
  );
  return points.filter(([x, y], i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    return !(previous[0] === x && next[0] === x || previous[1] === y && next[1] === y);
  });
}

// Inset the clockwise outline perpendicular to each edge, including the notch.
// Both faces are single paths so overlapping rectangles never introduce a seam.
function roundedInset(points: Point[], side: number, top: number, bottom: number) {
  const corners: Point[] = points.map(([x, y], i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    return [x - Math.sign(next[1] - previous[1]) * side,
      y + (next[0] > previous[0] ? top : -bottom)];
  });
  const segments = corners.map(([x, y], i) => {
    const [px, py] = corners[(i + corners.length - 1) % corners.length];
    const [nx, ny] = corners[(i + 1) % corners.length];
    const radius = Math.min(5, Math.hypot(px - x, py - y) / 2, Math.hypot(nx - x, ny - y) / 2);
    const start = [x + Math.sign(px - x) * radius, y + Math.sign(py - y) * radius];
    const end = [x + Math.sign(nx - x) * radius, y + Math.sign(ny - y) * radius];
    return `${i === 0 ? 'M' : 'L'} ${start.join(' ')} Q ${x} ${y} ${end.join(' ')}`;
  });
  return `path('${segments.join(' ')} Z')`;
}

export function getComboMaterial(rects: [Rect, Rect], wallInset = 0.75) {
  const [[x1, y1, w1, h1], [x2, y2, w2, h2]] = rects;
  // A disconnected custom shape has no single bevel. Let VIA draw it as supplied.
  if (x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1) {
    return null;
  }
  const widthUnits = Math.max(w1, w2);
  const heightUnits = Math.max(h1, h2);
  const width = widthUnits * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing;
  const height = heightUnits * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing;
  const points: Point[] = perimeter(rects).map(([x, y]) =>
    [x * width / widthUnits, y * height / heightUnits],
  );
  const [left, right] = CSSVarObject.faceXPadding;
  const [top, bottom] = CSSVarObject.faceYPadding;
  const [x, y, w, h] = rects[0];
  return {
    width, height,
    wallClip: roundedInset(points, wallInset, wallInset, wallInset),
    faceClip: roundedInset(points, left, top, bottom),
    legendBox: {
      left: x * CSSVarObject.keyXPos + left,
      top: y * CSSVarObject.keyYPos + top,
      width: w * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing - left - right,
      height: h * CSSVarObject.keyYPos - CSSVarObject.keyYSpacing - top - bottom,
    },
  };
}
