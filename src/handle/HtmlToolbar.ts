// Fresh code - the opt-in HTML alternative to the GeoCanvas-drawn finish/cancel icons, for callers
// that want a fixed, always-comfortably-sized on-screen button rather than a small 3D-anchored
// icon (harder to hit reliably on touch, and can end up tiny/off-screen at a distance or bad
// angle). Every element gets a stable, documented class name so a consuming app can restyle freely
// via CSS specificity - same "inline default + stable class name" convention already used for the
// live drag-distance label (see Shape3DEditController.ts's LABEL_STYLE).
//
// Cancel/Finish are icon buttons (X/checkmark), not text, for the exact same reason the
// GeoCanvas-drawn handles use icons rather than text: a symbol needs no translation. The height
// value's unit sits in its own read-only field beside it, showing a bare symbol ("m"/"ft", supplied
// by the caller from the active `uom` family) rather than a full word, for the same reason.
// Nothing here is hardcoded English text a consuming app can't change: `labels` only ever supplies
// `aria-label`/`title` attributes (for screen readers, which can't read an icon), not visible text.

const TOOLBAR_STYLE = "position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:10;" +
    "display:flex;gap:8px;align-items:center;background:rgba(30,30,30,0.75);padding:8px;" +
    "border-radius:8px;font-family:sans-serif;";
const ICON_BUTTON_STYLE = "font-size:18px;line-height:1;padding:0;width:44px;height:44px;cursor:pointer;" +
    "border:1px solid rgba(255,255,255,0.3);border-radius:6px;background:rgba(255,255,255,0.08);color:#fff;";
const ICON_BUTTON_DISABLED_STYLE = ICON_BUTTON_STYLE + "opacity:0.4;cursor:default;";
// Same dark translucent background/border/height as ICON_BUTTON_STYLE, so it reads as part of the
// same toolbar rather than a mismatched light box interrupting it - box-sizing:border-box so the
// border is included in that height rather than adding to it, and no vertical padding to inflate
// the box (height is set directly, not padding-driven).
//
// The value field and the unit field share this one box declaration rather than each carrying their
// own copy: they sit immediately next to each other, so any drift in height/border/radius between
// them would be plainly visible.
const HEIGHT_FIELD_BOX = "font-size:14px;height:44px;box-sizing:border-box;border-radius:6px;" +
    "border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.08);color:#fff;";
const HEIGHT_INPUT_STYLE = HEIGHT_FIELD_BOX + "padding:0 8px;width:70px;";
// The unit is its own read-only field rather than loose text: as a bare span it was the only
// unboxed element in a row of 44px boxed controls, which read as stray text sitting beside the
// widget instead of part of it. Narrower than the value field, centered, and dimmed so it still
// reads as "not editable" despite looking like an input.
const HEIGHT_UNIT_STYLE = HEIGHT_FIELD_BOX +
    "padding:0;width:42px;text-align:center;cursor:default;user-select:none;opacity:0.75;";
// The two fields are one flex child of the toolbar, spaced like the toolbar spaces its own controls.
const HEIGHT_WRAPPER_STYLE = "display:flex;gap:4px;align-items:center;";

const CANCEL_GLYPH = "✕"; // ✕
const FINISH_GLYPH = "✓"; // ✓

// The toolbar's elements are appended into map.domNode (see the constructor) so they sit visually
// on top of the map - but that also puts them inside whatever map-wide keyboard/mouse/touch
// listeners LuciadRIA itself attaches there for navigation (arrow-key pan, this controller's own
// Escape handling, drag-to-pan, wheel-to-zoom, pinch-to-zoom, etc.), which have no way to know a
// foreign <input>/<button> we injected isn't part of the map surface. Without stopping these from
// bubbling past the toolbar, keystrokes typed into the height input (or clicks/taps on the
// buttons) can be intercepted as map gestures instead of reaching the form controls normally -
// this is the standard fix for overlaying ordinary HTML controls on a canvas/map library's own
// DOM node. stopPropagation() only - never preventDefault() - so the input's own native behavior
// (typing, caret movement, number spinners) is completely unaffected; only bubbling past this
// container is what's stopped.
const STOPPED_EVENT_TYPES = [
  "mousedown", "mouseup", "click", "dblclick", "wheel",
  "touchstart", "touchmove", "touchend",
  "pointerdown", "pointerup", "pointermove",
  "keydown", "keyup", "keypress",
];

export interface HtmlToolbarLabels {
  /** `aria-label`/`title` for the cancel button - not visible text (the button is an icon). Default "Cancel". */
  cancel?: string;
  /** `aria-label`/`title` for the finish button - not visible text (the button is an icon). Default "Finish". */
  finish?: string;
  /**
   * `aria-label` for the height input - not visible text. The rendered unit symbol is appended to it
   * automatically (e.g. "Height (m)"), since the unit's own field is aria-hidden. Default "Height".
   */
  height?: string;
}

export interface HtmlToolbarCallbacks {
  onCancel(): void;
  onFinish(): void;
  /**
   * Called when the height input is confirmed (Enter/blur), with the raw number the user typed - in
   * whatever unit the most recent `setHeightValue` named, NOT necessarily meters. The caller owns
   * the conversion, so all unit maths stays in one place.
   */
  onHeightCommit(value: number): void;
}

/**
 * Creates and owns the toolbar's DOM elements, appended into the map's own DOM node. Callers
 * (Shape3DEditController) create one in `onActivate` and `destroy()` it in `onDeactivate` - it
 * holds no reference to the controller itself, only the callbacks and labels it's given.
 */
export class HtmlToolbar {
  private readonly _container: HTMLDivElement;
  private readonly _cancelButton: HTMLButtonElement;
  private readonly _finishButton: HTMLButtonElement;
  private readonly _heightWrapper: HTMLSpanElement;
  private readonly _heightInput: HTMLInputElement;
  private readonly _heightUnit: HTMLInputElement;
  /**
   * The unit symbol currently rendered, so setHeightValue - called on every redraw - only touches
   * the DOM when it actually changes.
   */
  private _heightUnitSymbol: string | null = null;
  /** Kept so the value field's aria-label can be rebuilt whenever either half changes. */
  private _heightLabel = "Height";

  constructor(mapDomNode: HTMLElement, callbacks: HtmlToolbarCallbacks, labels?: HtmlToolbarLabels) {
    this._container = document.createElement("div");
    this._container.className = "ria-3d-shape-editor-toolbar";
    this._container.setAttribute("style", TOOLBAR_STYLE);

    this._cancelButton = document.createElement("button");
    this._cancelButton.type = "button";
    this._cancelButton.className = "ria-3d-shape-editor-btn-cancel";
    this._cancelButton.setAttribute("style", ICON_BUTTON_STYLE);
    this._cancelButton.textContent = CANCEL_GLYPH;
    this._cancelButton.addEventListener("click", () => callbacks.onCancel());

    this._heightWrapper = document.createElement("span");
    this._heightWrapper.setAttribute("style", HEIGHT_WRAPPER_STYLE);
    this._heightWrapper.style.display = "none";
    this._heightInput = document.createElement("input");
    this._heightInput.type = "number";
    this._heightInput.className = "ria-3d-shape-editor-height-input";
    this._heightInput.setAttribute("style", HEIGHT_INPUT_STYLE);
    this._heightUnit = document.createElement("input");
    this._heightUnit.className = "ria-3d-shape-editor-height-unit";
    this._heightUnit.setAttribute("style", HEIGHT_UNIT_STYLE);
    // readOnly alone would still put this in the tab order and have it announced as a text field,
    // so it's also removed from both: it is a label that happens to be drawn as a box. The unit
    // still reaches screen readers, via the value field's own aria-label (see syncHeightAriaLabel).
    this._heightUnit.readOnly = true;
    this._heightUnit.tabIndex = -1;
    this._heightUnit.setAttribute("aria-hidden", "true");
    const commitHeight = () => {
      // `input[type=number]`.value is "" for anything the browser can't parse as a number, and
      // Number("") is 0 - which Number.isFinite happily accepts - so without the empty check,
      // clearing the field and clicking away would commit a height of ZERO rather than leaving the
      // vertex alone. Same for any entry the browser rejects outright, e.g. a locale-comma decimal.
      const raw = this._heightInput.value.trim();
      if (raw === "") {
        return;
      }
      const value = Number(raw);
      if (Number.isFinite(value)) {
        callbacks.onHeightCommit(value);
      }
    };
    this._heightInput.addEventListener("keydown", (domEvent) => {
      if (domEvent.key === "Enter") {
        commitHeight();
      }
    });
    this._heightInput.addEventListener("blur", commitHeight);
    this._heightWrapper.appendChild(this._heightInput);
    this._heightWrapper.appendChild(this._heightUnit);

    this._finishButton = document.createElement("button");
    this._finishButton.type = "button";
    this._finishButton.className = "ria-3d-shape-editor-btn-finish";
    this._finishButton.setAttribute("style", ICON_BUTTON_STYLE);
    this._finishButton.textContent = FINISH_GLYPH;
    this._finishButton.addEventListener("click", () => callbacks.onFinish());

    this.setLabels(labels);

    for (const type of STOPPED_EVENT_TYPES) {
      this._container.addEventListener(type, (domEvent) => domEvent.stopPropagation());
    }

    this._container.appendChild(this._cancelButton);
    this._container.appendChild(this._heightWrapper);
    this._container.appendChild(this._finishButton);
    // Hidden until the caller's first setVisible(true) (once editing begins) - avoids a one-frame
    // flash of a visible toolbar between construction and that first sync call.
    this._container.style.display = "none";
    mapDomNode.appendChild(this._container);
  }

  /**
   * Updates the aria-label/title text on the cancel/finish buttons and the height input, falling
   * back to the English defaults for anything not supplied. Pure attribute updates on already-
   * existing elements - no DOM is created/destroyed - so unlike enabling/disabling the toolbar
   * itself, this is safe to call live, mid-session (see Shape3DEditController.updateController).
   */
  setLabels(labels?: HtmlToolbarLabels): void {
    const cancelLabel = labels?.cancel ?? "Cancel";
    const finishLabel = labels?.finish ?? "Finish";
    const heightLabel = labels?.height ?? "Height";
    this._cancelButton.setAttribute("aria-label", cancelLabel);
    this._cancelButton.title = cancelLabel;
    this._finishButton.setAttribute("aria-label", finishLabel);
    this._finishButton.title = finishLabel;
    this._heightLabel = heightLabel;
    this.syncHeightAriaLabel();
  }

  /**
   * The value field's accessible name carries the unit, since the unit field itself is aria-hidden -
   * so a screen reader landing on the only focusable control still hears which unit it is typing in.
   * The symbol needs no translation, which keeps `labels.height` the only translatable half.
   */
  private syncHeightAriaLabel(): void {
    this._heightInput.setAttribute("aria-label",
        this._heightUnitSymbol ? `${this._heightLabel} (${this._heightUnitSymbol})` : this._heightLabel);
  }

  setFinishEnabled(enabled: boolean): void {
    this._finishButton.disabled = !enabled;
    this._finishButton.setAttribute("style", enabled ? ICON_BUTTON_STYLE : ICON_BUTTON_DISABLED_STYLE);
  }

  /**
   * The toolbar only makes sense while EDITING - there's no canvas finish/cancel affordance during
   * CREATING either (see Shape3DEditController.ts's drawCreationPreview), so this stays hidden
   * until the caller explicitly shows it once editing begins.
   */
  setVisible(visible: boolean): void {
    // "flex", never "": assigning an empty string REMOVES the inline display declaration, and
    // display:flex only ever existed there (it comes from TOOLBAR_STYLE, applied as one inline
    // style attribute). Clearing it dropped the container to a div's default display:block, which
    // silently disabled TOOLBAR_STYLE's own gap/align-items and - once the height wrapper became a
    // block-level flex container - broke the row into three lines.
    this._container.style.display = visible ? "flex" : "none";
  }

  /**
   * Shows and syncs the height input to `value`, expressed in the unit `unitSymbol` names (hides it
   * when `value` is `null` - e.g. no single active target). The caller converts: this class holds no
   * opinion on units beyond rendering the symbol it is handed.
   *
   * Never overwrites the input's value while it has focus, so a live sync (called every redraw)
   * doesn't fight the user mid-typing - EXCEPT when the unit itself changed (a live `uom` switch),
   * where leaving the stale number under a new symbol would silently relabel e.g. 25.00m as 25.00ft.
   */
  setHeightValue(value: number | null, unitSymbol: string): void {
    if (value === null) {
      this._heightWrapper.style.display = "none";
      return;
    }
    this._heightWrapper.style.display = "flex";
    const unitChanged = unitSymbol !== this._heightUnitSymbol;
    if (unitChanged) {
      this._heightUnit.value = unitSymbol;
      this._heightUnitSymbol = unitSymbol;
      this.syncHeightAriaLabel();
    }
    if (unitChanged || document.activeElement !== this._heightInput) {
      this._heightInput.value = value.toFixed(2);
    }
  }

  destroy(): void {
    this._container.remove();
  }
}
