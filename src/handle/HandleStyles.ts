// Fresh code - not derived from @luciad/ria-toolbox-geolocation/HandleStyles.ts (that file's actual
// visual values aren't reused; only the general idea of "guide line + endpoint markers" is, per
// Notes3DEdit.md's decision log).
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";
import {DrapeTarget} from "@luciad/ria/view/style/DrapeTarget.js";
import {
  createCheckmarkIconImage,
  createCircleIconImage,
  createDiamondIconImage,
  createHorizontalArrowIconImage,
  createVerticalArrowIconImage,
  createXMarkIconImage,
} from "./IconFactory.js";

// Every style below explicitly sets drapeTarget: NOT_DRAPED. This is not redundant with the
// default: per the installed @luciad/ria type declarations, a shape/icon with zero Z is draped on
// terrain BY DEFAULT when drapeTarget is left unspecified - only non-zero Z defaults to not-draped.
// Our own handle visuals must never be draped regardless of the vertex's Z (a drag to Z=0 would
// otherwise silently start draping mid-interaction), so this is set explicitly everywhere.

const VERTEX_COLOR = "rgb(255,255,255)";
const VERTEX_STROKE = "rgb(60,60,60)";
// Smaller and more muted than VERTEX_COLOR, so the one active vertex (with its full handle set)
// reads as visually distinct at a glance from every other, plain-marker vertex.
const INACTIVE_COLOR = "rgb(160,160,160)";
const INACTIVE_STROKE = "rgb(50,50,50)";
const FOCUSED_COLOR = "rgb(116,207,221)";
const FOCUSED_STROKE = "rgb(20,90,100)";
const GUIDE_COLOR = "rgb(255,200,0)";
const MOVE_COLOR = "rgb(110,200,110)";
const HEIGHT_COLOR = "rgb(255,150,60)";
// Distinct from GUIDE_COLOR above (yellow), which is already used for the drag-displacement line -
// the drop line needs its own identity, not to be confused with that one.
const DROP_LINE_COLOR = "rgb(60,140,240)";
const FINISH_COLOR = "rgb(80,150,255)";
const CANCEL_COLOR = "rgb(230,80,80)";
const HANDLE_BG = "rgba(30,30,30,0.55)";
// Deliberately more saturated than HEIGHT_COLOR above, so an occluded height handle still reads
// as a clear, distinct warning rather than just "still kind of orange."
const OCCLUDED_COLOR = "rgb(255,102,0)";
const OCCLUDED_STROKE = "rgb(120,45,0)";

// Occlusion-aware icons are drawn TWICE, back to back, at the same position - once with
// occlusionMode: VISIBLE_ONLY (normal color, shown only where nothing obscures it) and once with
// occlusionMode: OCCLUDED_ONLY (OCCLUDED_COLOR, shown only where something does) - so LuciadRIA's
// own depth test picks whichever actually applies each frame, with no manual raycasting needed.
// This is the exact idiom LuciadRIA's own toolbox uses for the same purpose (confirmed directly:
// @luciad/ria-toolbox-ria/geolocation/HandleStyles.ts's MAIN_STROKE_STYLE/MAIN_STROKE_OCCLUDED_STYLE
// pair, drawn together in AltitudeHandleSupport.ts's drawBody). Deliberately scoped to just the
// vertex/free handle and the drag-position ("current") diamond - the two things that actually
// represent the shape's real position. Move/height/finish/cancel/drag-start all keep
// occlusionMode: ALWAYS_VISIBLE with no occluded variant - they're fixed-offset UI affordances,
// not the shape's own geometry, so an occlusion cue on them isn't wanted.

export const VERTEX_DEFAULT_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(VERTEX_COLOR, VERTEX_STROKE, 5),
  width: "16px",
  height: "16px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const VERTEX_DEFAULT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(OCCLUDED_COLOR, OCCLUDED_STROKE, 5),
  width: "16px",
  height: "16px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const VERTEX_FOCUSED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(FOCUSED_COLOR, FOCUSED_STROKE, 6),
  width: "18px",
  height: "18px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const VERTEX_FOCUSED_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(OCCLUDED_COLOR, OCCLUDED_STROKE, 6),
  width: "18px",
  height: "18px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

/** A non-active vertex in a multi-vertex shape - a plain, clickable marker, no move/height/finish/cancel. */
export const VERTEX_INACTIVE_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(INACTIVE_COLOR, INACTIVE_STROKE, 4),
  width: "13px",
  height: "13px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const VERTEX_INACTIVE_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(OCCLUDED_COLOR, OCCLUDED_STROKE, 4),
  width: "13px",
  height: "13px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const GUIDE_START_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(VERTEX_COLOR, VERTEX_STROKE, 4),
  width: "14px",
  height: "14px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const GUIDE_END_ICON_STYLE: IconStyle = {
  url: createDiamondIconImage(FOCUSED_COLOR, FOCUSED_STROKE, 6),
  width: "16px",
  height: "16px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const GUIDE_END_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createDiamondIconImage(OCCLUDED_COLOR, OCCLUDED_STROKE, 6),
  width: "16px",
  height: "16px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const FINISH_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createCheckmarkIconImage(FINISH_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const FINISH_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createCheckmarkIconImage(FINISH_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const CANCEL_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createXMarkIconImage(CANCEL_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const CANCEL_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createXMarkIconImage(CANCEL_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

/** Shared guide-line style for all three handle kinds' live drag feedback. */
export const GUIDE_LINE_STYLE: ShapeStyle = {
  stroke: {color: GUIDE_COLOR, width: 2},
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const PREVIEW_SHAPE_STYLE: ShapeStyle = {
  stroke: {color: "rgb(255,255,255)", width: 2},
  fill: {color: "rgba(255,255,255,0.15)"},
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const PREVIEW_CLOSING_SEGMENT_STYLE: ShapeStyle = {
  stroke: {color: "rgba(255,255,255,0.6)", width: 1, dash: [6, 4]},
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

// A minimalistic wireframe grid, drawn as a VISIBLE_ONLY/OCCLUDED_ONLY pair, same general idiom
// as the occlusion-aware icons above. Main color is the same translucent cyan/alpha as
// @luciad/ria-toolbox-ria/slicing/controllers/BoxCreateController.ts's PLANE_STYLE_HIDDEN (fainter
// than the toolbox's own visible PLANE_STYLE, by design - less visually loud) - occlusion switches
// to red at the same alpha, so hitting a building reads as a clear color change, not just a fade.
export const MOVE_PLANE_STYLE: ShapeStyle = {
  stroke: {color: "rgba(171,232,229,0.50)", width: 1},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_PLANE_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: "rgba(230,40,40,0.75)", width: 1},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

// A vertical line drawn during height/free drags, from the current position downward - styled as
// the same VISIBLE_ONLY/OCCLUDED_ONLY pair, so the portion that passes into/behind terrain or a
// mesh shows in OCCLUDED_COLOR. This needs no raycasting at all: the drag's own direction is
// already the correct true-vertical axis, and RIA's own depth test is what actually reveals
// "this has reached the ground/a building," not any computed intersection.
export const HEIGHT_DROP_LINE_STYLE: ShapeStyle = {
  stroke: {color: DROP_LINE_COLOR, width: 2},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_DROP_LINE_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: OCCLUDED_COLOR, width: 2},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};
