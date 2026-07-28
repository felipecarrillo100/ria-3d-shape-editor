// Fresh code - the opt-in HTML alternative to the GeoCanvas-drawn finish/cancel icons, for callers
// that want a fixed, always-comfortably-sized on-screen button rather than a small 3D-anchored
// icon (harder to hit reliably on touch, and can end up tiny/off-screen at a distance or bad
// angle). Every element gets a stable, documented class name so a consuming app can restyle freely
// via CSS specificity - same "inline default + stable class name" convention already used for the
// live drag-distance label (see Shape3DEditController.ts's LABEL_STYLE).
//
// Cancel/Finish are icon buttons (X/checkmark), not text, for the exact same reason the
// GeoCanvas-drawn handles use icons rather than text: a symbol needs no translation. The height
// input keeps only a bare "m" unit suffix - already near-universal - rather than a full word.
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
// border is included in that height rather than adding to it, and padding is horizontal-only
// (there's no vertical padding to inflate the box - height is set directly, not padding-driven).
const HEIGHT_INPUT_STYLE = "font-size:14px;padding:0 8px;height:44px;box-sizing:border-box;width:70px;" +
    "border-radius:6px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.08);color:#fff;";
const HEIGHT_UNIT_STYLE = "color:#fff;font-size:13px;margin-left:4px;";

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
  /** `aria-label` for the height input - not visible text (the input only shows a bare unit suffix). Default "Height". */
  height?: string;
}

export interface HtmlToolbarCallbacks {
  onCancel(): void;
  onFinish(): void;
  /** Called with the committed value, in meters, when the height input is confirmed (Enter/blur). */
  onHeightCommit(meters: number): void;
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
    this._heightWrapper.style.display = "none";
    this._heightInput = document.createElement("input");
    this._heightInput.type = "number";
    this._heightInput.className = "ria-3d-shape-editor-height-input";
    this._heightInput.setAttribute("style", HEIGHT_INPUT_STYLE);
    const heightUnit = document.createElement("span");
    heightUnit.className = "ria-3d-shape-editor-height-unit";
    heightUnit.setAttribute("style", HEIGHT_UNIT_STYLE);
    heightUnit.textContent = "m";
    const commitHeight = () => {
      const value = Number(this._heightInput.value);
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
    this._heightWrapper.appendChild(heightUnit);

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
    this._heightInput.setAttribute("aria-label", heightLabel);
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
    this._container.style.display = visible ? "" : "none";
  }

  /**
   * Shows and syncs the height input to `meters` (hides it when `null` - e.g. no single active
   * vertex, such as while a midpoint is merely selected but not yet promoted). Never overwrites
   * the input's value while it currently has focus, so a live sync (called every redraw) never
   * fights the user mid-typing.
   */
  setHeightValue(meters: number | null): void {
    if (meters === null) {
      this._heightWrapper.style.display = "none";
      return;
    }
    this._heightWrapper.style.display = "";
    if (document.activeElement !== this._heightInput) {
      this._heightInput.value = meters.toFixed(2);
    }
  }

  destroy(): void {
    this._container.remove();
  }
}
