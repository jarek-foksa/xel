
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";
import ColorParser from "../classes/color-parser.js";

import {serializeColor} from "../utils/color.js";
import {normalize} from "../utils/math.js";
import {html, css} from "../utils/template.js";

const DEBUG = false;

// @element x-barscolorpicker
// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
// @part marker
export default class XBarsColorPickerElement extends HTMLElement {
  static observedAttributes = ["value", "size"];

  static _shadowTemplate = html`
    <template>
      <x-box vertical>
        <div id="hue-slider" part="slider">
          <div id="hue-slider-track">
            <div id="hue-slider-marker" part="marker"></div>
          </div>
        </div>

        <div id="saturation-slider" part="slider">
          <div id="saturation-slider-track">
            <div id="saturation-slider-marker" part="marker"></div>
          </div>
        </div>

        <div id="lightness-slider" part="slider">
          <div id="lightness-slider-track">
            <div id="lightness-slider-marker" part="marker"></div>
          </div>
        </div>

        <div id="alpha-slider" part="slider">
          <div id="alpha-slider-gradient"></div>
          <div id="alpha-slider-track">
            <div id="alpha-slider-marker" part="marker"></div>
          </div>
        </div>
      </x-box>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      user-select: none;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Hue slider
     */

    #hue-slider {
      width: 100%;
      height: 30px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      background: red;
      --marker-width: 18px;
    }
    :host([computedsize="small"]) #hue-slider {
      height: 24px;
    }
    :host([computedsize="large"]) #hue-slider {
      height: 35px;
    }

    #hue-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      background: linear-gradient(to right,
        rgba(255, 0, 0, 1),
        rgba(255, 255, 0, 1),
        rgba(0, 255, 0, 1),
        rgba(0, 255, 255, 1),
        rgba(0, 0, 255, 1),
        rgba(255, 0, 255, 1),
        rgba(255, 0, 0, 1)
      );
    }

    #hue-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: calc(100% + 6px);
      position: absolute;
    }

    /**
     * Saturation slider
     */

    #saturation-slider {
      width: 100%;
      height: 30px;
      margin-top: 20px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }
    :host([computedsize="small"]) #saturation-slider {
      height: 24px;
    }
    :host([computedsize="large"]) #saturation-slider {
      height: 35px;
    }

    #saturation-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #saturation-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: calc(100% + 6px);
      position: absolute;
    }

    /**
     * Lightness slider
     */

    #lightness-slider {
      width: 100%;
      height: 30px;
      margin-top: 20px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }
    :host([computedsize="small"]) #lightness-slider {
      height: 24px;
    }
    :host([computedsize="large"]) #lightness-slider {
      height: 35px;
    }

    #lightness-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #lightness-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: calc(100% + 6px);
      position: absolute;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      display: none;
      width: 100%;
      height: 30px;
      margin-top: 20px;
      margin-bottom: 8px;
      padding: 0 calc(var(--marker-width) / 2);
      position: relative;
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      /* Checkerboard pattern */
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      background-image: linear-gradient(45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(-45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #d6d6d6 75%),
                        linear-gradient(-45deg, transparent 75%, #d6d6d6 75%);
    }
    :host([alphaslider]) #alpha-slider {
      display: block;
    }
    :host([computedsize="small"]) #alpha-slider {
      height: 24px;
    }
    :host([computedsize="large"]) #alpha-slider {
      height: 35px;
    }

    #alpha-slider-gradient {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    #alpha-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #alpha-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: calc(100% + 6px);
      position: absolute;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default "hsla(0, 0%, 100%, 1)"
  //
  // Color value, must be a valid CSS color string.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "hsla(0, 0%, 100%, 1)";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  //
  // Custom widget size.
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property readOnly
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  //
  // Resolved widget size, used for theming purposes.
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  _h = 0;  // Hue (0 ~ 360)
  _s = 0;  // Saturation (0 ~ 100)
  _l = 80; // Lightness (0 ~ 100)
  _a = 1;  // Alpha (0 ~ 1)

  _shadowRoot = null;
  _elements = {};
  _xelSizeChangeListener = null;

  _isDraggingHueSliderMarker = false;
  _isDraggingSaturationSliderMarker = false;
  _isDraggingLightnessSliderMarker = false;
  _isDraggingAlphaSliderMarker = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XBarsColorPickerElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XBarsColorPickerElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this._elements["hue-slider"].addEventListener("pointerdown", (event) => {
      this._onHueSliderPointerDown(event);
    });

    this._elements["saturation-slider"].addEventListener("pointerdown", (event) => {
      this._onSaturationSliderPointerDown(event);
    });

    this._elements["lightness-slider"].addEventListener("pointerdown", (event) => {
      this._onLightnessSliderPointerDown(event);
    });

    this._elements["alpha-slider"].addEventListener("pointerdown", (event) => {
      this._onAlphaSliderPointerDown(event);
    });
  }

  connectedCallback() {
    this._update();
    this._updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "size") {
      this._onSizeAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    this._updateHueSliderMarker();

    this._updateSaturationSliderMarker();
    this._updateSaturationSliderBackground();

    this._updateLightnessSliderMarker();
    this._updateLightnessSliderBackground();

    this._updateAlphaSliderMarker();
    this._updateAlphaSliderBackground();
  }

  _updateHueSliderMarker() {
    this._elements["hue-slider-marker"].style.left = ((normalize(this._h, 0, 360, 0) / 360) * 100) + "%";
  }

  _updateSaturationSliderMarker() {
    this._elements["saturation-slider-marker"].style.left = normalize(this._s, 0, 100, 2) + "%";
  }

  _updateLightnessSliderMarker() {
    this._elements["lightness-slider-marker"].style.left = normalize(this._l, 0, 100, 2) + "%";
  }

  _updateAlphaSliderMarker() {
    this._elements["alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
  }

  _updateSaturationSliderBackground() {
    let h = this._h;

    this._elements["saturation-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, 0%, 50%), hsl(${h}, 100%, 50%)
    )`;
  }

  _updateLightnessSliderBackground() {
    let h = this._h;
    let s = this._s;

    this._elements["lightness-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%)
    )`;
  }

  _updateAlphaSliderBackground() {
    let h = this._h;
    let s = this._s;
    let l = this._l

    this._elements["alpha-slider-gradient"].style.background = `
      linear-gradient(to right, hsla(${h}, ${s}%, ${l}%, 1), hsla(${h}, ${s}%, ${l}%, 0))
    `;
  }

  _updateComputedSizeAttriubte() {
    let defaultSize = Xel.size;
    let customSize = this.size;
    let computedSize = "medium";

    if (customSize === null) {
      computedSize = defaultSize;
    }
    else if (customSize === "smaller") {
      computedSize = (defaultSize === "large") ? "medium" : "small";
    }
    else if (customSize === "larger") {
      computedSize = (defaultSize === "small") ? "medium" : "large";
    }
    else {
      computedSize = customSize;
    }

    if (computedSize === "medium") {
      this.removeAttribute("computedsize");
    }
    else {
      this.setAttribute("computedsize", computedSize);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    if (
      this._isDraggingHueSliderMarker === false &&
      this._isDraggingSaturationSliderMarker === false &&
      this._isDraggingLightnessSliderMarker === false &&
      this._isDraggingAlphaSliderMarker === false
    ) {
      let [h, s, l, a] = new ColorParser().parse(this.value, "hsla");

      this._h = h;
      this._s = s;
      this._l = l;
      this._a = a;

      this._update();
    }

    if (DEBUG) {
      console.log(`%c ${this.value}`, `background: ${this.value};`);
    }
  }

  _onSizeAttributeChange() {
    this._updateComputedSizeAttriubte();
  }

  _onHueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this._elements["hue-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingHueSliderMarker = true;
    this._elements["hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let h = ((clientX - trackBounds.x) / trackBounds.width) * 360;
      h = normalize(h, 0, 360, 0);

      if (h !== this._h) {
        this._h = h;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

        this._updateHueSliderMarker();
        this._updateSaturationSliderBackground();
        this._updateLightnessSliderBackground();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this._elements["hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this._elements["hue-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this._elements["hue-slider"].removeEventListener("pointermove", pointerMoveListener);
      this._elements["hue-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingHueSliderMarker = false;
    });
  }

  _onSaturationSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this._elements["saturation-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingSaturationSliderMarker = true;
    this._elements["saturation-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let s = ((clientX - trackBounds.x) / trackBounds.width) * 100;
      s = normalize(s, 0, 100, 0);

      if (s !== this._s) {
        this._s = s;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

        this._updateSaturationSliderMarker();
        this._updateSaturationSliderBackground();
        this._updateLightnessSliderBackground();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this._elements["saturation-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this._elements["saturation-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this._elements["saturation-slider"].removeEventListener("pointermove", pointerMoveListener);
      this._elements["saturation-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingSaturationSliderMarker = false;
    });
  }

  _onLightnessSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this._elements["lightness-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingLightnessSliderMarker = true;
    this._elements["lightness-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let l = ((clientX - trackBounds.x) / trackBounds.width) * 100;
      l = normalize(l, 0, 100, 0);

      if (l !== this._l) {
        this._l = l;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

        this._updateLightnessSliderMarker();
        this._updateSaturationSliderBackground();
        this._updateLightnessSliderBackground();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this._elements["lightness-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this._elements["lightness-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this._elements["lightness-slider"].removeEventListener("pointermove", pointerMoveListener);
      this._elements["lightness-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingLightnessSliderMarker = false;
    });
  }

  _onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this._elements["alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingAlphaSliderMarker = true;
    this._elements["alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
      a = normalize(a, 0, 1, 2);

      if (a !== this._a) {
        this._a = a;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");
        this._updateAlphaSliderMarker();
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this._elements["alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this._elements["alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this._elements["alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
      this._elements["alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-barscolorpicker", XBarsColorPickerElement);
