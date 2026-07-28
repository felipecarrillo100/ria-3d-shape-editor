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
const HANDLE_BG = "rgb(10,10,10)";
// Deliberately more saturated than HEIGHT_COLOR above, so an occluded height handle still reads
// as a clear, distinct warning rather than just "still kind of orange."
const OCCLUDED_COLOR = "rgb(255,102,0)";
// Deliberately near-black rather than a darker shade of the same orange hue - every non-occluded
// icon pair in this file contrasts a bright/light fill against a dark, low-saturation stroke (e.g.
// VERTEX_COLOR/VERTEX_STROKE, FOCUSED_COLOR/FOCUSED_STROKE), and OCCLUDED_COLOR/OCCLUDED_STROKE
// needs the same lightness contrast to read as two distinct colors instead of "two shades of orange."
const OCCLUDED_STROKE = "rgb(40,20,10)";
// Shape-body geometry (the polygon/line being edited) must always render beneath every handle/icon,
// which all keep the default zOrder (0, unset) - LuciadRIA paints lower zOrder first, so a negative
// value here is what actually guarantees that, independent of occlusionMode or draw-call order.
const SHAPE_BODY_Z_ORDER = -1;

// Occlusion-aware icons are drawn TWICE, back to back, at the same position - once with
// occlusionMode: VISIBLE_ONLY and once with occlusionMode: OCCLUDED_ONLY - so LuciadRIA's own
// depth test picks whichever actually applies each frame, with no manual raycasting needed. This
// is the exact idiom LuciadRIA's own toolbox uses for the same purpose (confirmed directly:
// @luciad/ria-toolbox-ria/geolocation/HandleStyles.ts's MAIN_STROKE_STYLE/MAIN_STROKE_OCCLUDED_STYLE
// pair, drawn together in AltitudeHandleSupport.ts's drawBody).
//
// For the vertex/free handle, the drag-position ("current") diamond, and the shape's own
// body/closing-segment preview (see PREVIEW_SHAPE_STYLE/PREVIEW_CLOSING_SEGMENT_STYLE below), the
// OCCLUDED_ONLY variant also switches to OCCLUDED_COLOR/OCCLUDED_STROKE - these represent the
// shape's real position/geometry, so recoloring when hidden behind terrain is a meaningful cue.
//
// The move/height/finish/cancel handle icons ALSO use this VISIBLE_ONLY/OCCLUDED_ONLY split, but
// their OCCLUDED_ONLY variant deliberately uses the SAME color as its VISIBLE_ONLY counterpart, not
// OCCLUDED_COLOR - they're temporary drawing aids with no corresponding real point in the edited
// shape, so unlike everything else above, they must always render in one single, unchanging color
// regardless of occlusion. The split exists purely as a stacking mechanism, not a visual cue: with
// the shape body given a lower zOrder (SHAPE_BODY_Z_ORDER) so handles paint above it, an
// ALWAYS_VISIBLE icon and a VISIBLE_ONLY/OCCLUDED_ONLY shape don't reliably respect that zOrder
// against each other (empirically confirmed - these icons kept rendering underneath the shape body
// despite their higher zOrder, while still ALWAYS_VISIBLE). Matching the shape body's own
// VISIBLE_ONLY/OCCLUDED_ONLY category is the one configuration proven to respect zOrder here, since
// it's exactly what already made the vertex icons above stack correctly.
//
// Only drag-start (the small diamond marking a drag's origin point) still keeps occlusionMode:
// ALWAYS_VISIBLE with no occluded variant at all - it's never drawn anywhere near the shape body,
// so this stacking issue doesn't apply to it.

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

// A "virtual" per-segment marker, calculated by the controller, not stored in the shape - dragging
// one inserts a real vertex at that position. Half the size of VERTEX_DEFAULT_ICON_STYLE (8px vs
// 16px), muted the same way VERTEX_INACTIVE_* is, so it visibly reads as "not a real vertex yet."
export const MIDPOINT_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(INACTIVE_COLOR, INACTIVE_STROKE, 2),
  width: "8px",
  height: "8px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MIDPOINT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(OCCLUDED_COLOR, OCCLUDED_STROKE, 2),
  width: "8px",
  height: "8px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

// Grows toward vertex size and brightens on hover, matching the DEFAULT/FOCUSED convention used by
// every other handle here - a visual cue that dragging this will add a vertex.
export const MIDPOINT_HOVERED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(FOCUSED_COLOR, FOCUSED_STROKE, 4),
  width: "12px",
  height: "12px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MIDPOINT_HOVERED_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCircleIconImage(OCCLUDED_COLOR, OCCLUDED_STROKE, 4),
  width: "12px",
  height: "12px",
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
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

// Same size as *_FOCUSED (bigger, signals "dragging this now does something different"), but built
// from the plain MOVE_COLOR/HEIGHT_COLOR rather than FOCUSED_COLOR - size (driven by whether Shift
// is held) and color (driven by hover/drag state) stay independent, so a shift-enlarged handle you
// aren't otherwise hovering doesn't look identical to one you are.
export const MOVE_HANDLE_SHIFT_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const MOVE_HANDLE_SHIFT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createHorizontalArrowIconImage(MOVE_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_SHIFT_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const HEIGHT_HANDLE_SHIFT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createVerticalArrowIconImage(HEIGHT_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const FINISH_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createCheckmarkIconImage(FINISH_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const FINISH_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCheckmarkIconImage(FINISH_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const FINISH_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createCheckmarkIconImage(FINISH_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const FINISH_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createCheckmarkIconImage(FINISH_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const CANCEL_HANDLE_DEFAULT_ICON_STYLE: IconStyle = {
  url: createXMarkIconImage(CANCEL_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const CANCEL_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createXMarkIconImage(CANCEL_COLOR, HANDLE_BG, 8),
  width: "22px",
  height: "22px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const CANCEL_HANDLE_FOCUSED_ICON_STYLE: IconStyle = {
  url: createXMarkIconImage(CANCEL_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const CANCEL_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE: IconStyle = {
  url: createXMarkIconImage(CANCEL_COLOR, HANDLE_BG, 10),
  width: "26px",
  height: "26px",
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
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
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
  zOrder: SHAPE_BODY_Z_ORDER,
};

export const PREVIEW_SHAPE_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: OCCLUDED_COLOR, width: 2},
  fill: {color: "rgba(255,102,0,0.15)"},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
  zOrder: SHAPE_BODY_Z_ORDER,
};

export const PREVIEW_CLOSING_SEGMENT_STYLE: ShapeStyle = {
  stroke: {color: "rgba(255,255,255,0.6)", width: 1, dash: [6, 4]},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
  zOrder: SHAPE_BODY_Z_ORDER,
};

export const PREVIEW_CLOSING_SEGMENT_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: "rgba(255,102,0,0.6)", width: 1, dash: [6, 4]},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
  zOrder: SHAPE_BODY_Z_ORDER,
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

// A vertical line drawn during height/move drags, from the current position downward - styled as
// the same VISIBLE_ONLY/OCCLUDED_ONLY pair, so the portion that passes into/behind terrain or a
// mesh shows in OCCLUDED_COLOR. This needs no raycasting at all: the drag's own direction is
// already the correct true-vertical axis, and RIA's own depth test is what actually reveals
// "this has reached the ground/a building," not any computed intersection.
export const DROP_LINE_STYLE: ShapeStyle = {
  stroke: {color: DROP_LINE_COLOR, width: 2},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};

export const DROP_LINE_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: OCCLUDED_COLOR, width: 2},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
  drapeTarget: DrapeTarget.NOT_DRAPED,
};
