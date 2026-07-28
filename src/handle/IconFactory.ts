// Fresh code - small inline SVG icons as data URIs, so this package ships no binary asset files.
function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * A filled circle with a contrasting stroke - used for vertex/handle markers.
 */
export function createCircleIconImage(fillColor: string, strokeColor: string, radiusPx = 6): string {
  const size = radiusPx * 2 + 4;
  const c = size / 2;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${radiusPx}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>` +
      `</svg>`
  );
}

/**
 * A small filled diamond - used to distinguish an endpoint (e.g. a drag's current position) from
 * a regular vertex marker.
 */
export function createDiamondIconImage(fillColor: string, strokeColor: string, sizePx = 7): string {
  const size = sizePx * 2 + 4;
  const c = size / 2;
  const half = sizePx;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<polygon points="${c},${c - half} ${c + half},${c} ${c},${c + half} ${c - half},${c}" ` +
      `fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>` +
      `</svg>`
  );
}

/**
 * A horizontal double-headed arrow inside a circle - used for the move (X/Y-only) handle.
 */
export function createHorizontalArrowIconImage(color: string, bgColor: string, sizePx = 9): string {
  const r = sizePx + 2;
  const size = r * 2;
  const c = size / 2;
  const armHalf = sizePx - 2;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>` +
      `<line x1="${c - armHalf}" y1="${c}" x2="${c + armHalf}" y2="${c}" stroke="${color}" stroke-width="2"/>` +
      `<polygon points="${c - armHalf},${c} ${c - armHalf + 4},${c - 4} ${c - armHalf + 4},${c + 4}" fill="${color}"/>` +
      `<polygon points="${c + armHalf},${c} ${c + armHalf - 4},${c - 4} ${c + armHalf - 4},${c + 4}" fill="${color}"/>` +
      `</svg>`
  );
}

/**
 * A vertical double-headed arrow inside a circle - used for the height (Z-only) handle.
 */
export function createVerticalArrowIconImage(color: string, bgColor: string, sizePx = 9): string {
  const r = sizePx + 2;
  const size = r * 2;
  const c = size / 2;
  const armHalf = sizePx - 2;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>` +
      `<line x1="${c}" y1="${c - armHalf}" x2="${c}" y2="${c + armHalf}" stroke="${color}" stroke-width="2"/>` +
      `<polygon points="${c},${c - armHalf} ${c - 4},${c - armHalf + 4} ${c + 4},${c - armHalf + 4}" fill="${color}"/>` +
      `<polygon points="${c},${c + armHalf} ${c - 4},${c + armHalf - 4} ${c + 4},${c + armHalf - 4}" fill="${color}"/>` +
      `</svg>`
  );
}

/**
 * A checkmark inside a circle - used for the "finish editing" (OK/confirm) handle.
 */
export function createCheckmarkIconImage(color: string, bgColor: string, sizePx = 9): string {
  const r = sizePx + 2;
  const size = r * 2;
  const c = size / 2;
  const s = sizePx;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>` +
      `<polyline points="${c - s * 0.5},${c} ${c - s * 0.1},${c + s * 0.4} ${c + s * 0.55},${c - s * 0.35}" ` +
      `fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`
  );
}

/**
 * An X mark inside a circle - used for the "cancel editing" (discard) handle.
 */
export function createXMarkIconImage(color: string, bgColor: string, sizePx = 9): string {
  const r = sizePx + 2;
  const size = r * 2;
  const c = size / 2;
  const s = sizePx * 0.55;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>` +
      `<line x1="${c - s}" y1="${c - s}" x2="${c + s}" y2="${c + s}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<line x1="${c + s}" y1="${c - s}" x2="${c - s}" y2="${c + s}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>` +
      `</svg>`
  );
}

/**
 * A single horizontal line inside a circle (the conventional "remove this one item" glyph, as
 * opposed to a trash can, which reads more like "delete the whole thing") - used for the "remove
 * this vertex" handle. Deliberately a different silhouette from `createXMarkIconImage` (used by
 * `cancel`) so "discard the whole session" and "remove this one vertex" stay unambiguous even
 * though both may share a similar warning color.
 */
export function createMinusIconImage(color: string, bgColor: string, sizePx = 9): string {
  const r = sizePx + 2;
  const size = r * 2;
  const c = size / 2;
  const half = sizePx * 0.55;
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>` +
      `<line x1="${c - half}" y1="${c}" x2="${c + half}" y2="${c}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>` +
      `</svg>`
  );
}

/**
 * The actual keyboard-Shift glyph (⇧) - one outlined arrow shape (a wide triangular head merging
 * directly into a narrower rectangular stem, as a single polygon outline, not filled solid), not a
 * thin line with a separate arrowhead - inside a circle, used for the whole-shape move/height
 * toggle handle. On/off is conveyed entirely by the color and size the caller passes in (muted and
 * small when off, a saturated "indicator light" green and bigger when on - see HandleStyles.ts),
 * not by the glyph itself changing shape.
 */
export function createShiftUpArrowIconImage(color: string, bgColor: string, sizePx = 9): string {
  const r = sizePx + 2;
  const size = r * 2;
  const c = size / 2;
  const headHalf = sizePx * 0.55;
  const stemHalf = sizePx * 0.28;
  const top = c - sizePx * 0.75;
  const headBase = c - sizePx * 0.1;
  const stemBottom = c + sizePx * 0.65;
  const points = [
    [c, top],
    [c + headHalf, headBase],
    [c + stemHalf, headBase],
    [c + stemHalf, stemBottom],
    [c - stemHalf, stemBottom],
    [c - stemHalf, headBase],
    [c - headHalf, headBase],
  ].map(([x, y]) => `${x},${y}`).join(" ");
  return encodeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${r - 1}" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>` +
      `<polygon points="${points}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `</svg>`
  );
}
