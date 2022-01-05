
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ColorParser from "../classes/color-parser.js";
import Xel from "../classes/xel.js";

import {serializeColor, hsvToRgb, getColorWheelImageURL} from "../utils/color.js";
import {html, css} from "../utils/template.js";
import {round, normalize, degToRad} from "../utils/math.js";

let {PI, sqrt, atan2, sin, cos, pow} = Math;

const DEBUG = false;

// @element x-wheelcolorpicker
// @event change
// @event changestart
// @event changeend
export default class XWheelColorPickerElement extends HTMLElement {
  static observedAttributes = ["value", "size"];

  static _shadowTemplate = html`
    <template>
      <x-box vertical>
        <div id="huesat-slider">
          <img id="huesat-image"></img>
          <div id="huesat-marker"></div>
        </div>

        <div id="value-slider">
          <div id="value-slider-track">
            <div id="value-slider-marker"></div>
          </div>
        </div>

        <div id="alpha-slider">
          <div id="alpha-slider-gradient"></div>
          <div id="alpha-slider-track">
            <div id="alpha-slider-marker"></div>
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
      --wheel-max-width: none;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Hue-saturation slider
     */

    #huesat-slider {
      display: flex;
      position: relative;
      width: 100%;
      max-width: var(--wheel-max-width);
      margin: 0 auto;
      height: auto;
      touch-action: pinch-zoom;
    }

    #huesat-image {
      width: 100%;
      height: 100%;
      border-radius: 999px;
      pointer-events: none;
    }

    #huesat-marker {
      position: absolute;
      top: 0%;
      left: 0%;
      width: var(--marker-size);
      height: var(--marker-size);
      transform: translate(calc(var(--marker-size) / -2), calc(var(--marker-size) / -2));
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 3px solid white;
      border-radius: 999px;
      box-shadow: 0 0 3px black;
      --marker-size: 20px;
    }

    /**
     * Value slider
     */

    #value-slider {
      width: 100%;
      height: 30px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }
    :host([computedsize="small"]) #value-slider {
      height: 24px;
    }
    :host([computedsize="large"]) #value-slider {
      height: 35px;
    }

    #value-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #value-slider-marker {
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
      position: relative;
      display: none;
      width: 100%;
      height: 30px;
      margin-top: 14px;
      padding: 0 calc(var(--marker-width) / 2);
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
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  _shadowRoot = null;
  _elements = {};
  _xelSizeChangeListener = null;

  // Note that HSVA color model is used only internally
  _h = 0;   // Hue (0 ~ 360)
  _s = 0;   // Saturation (0 ~ 100)
  _v = 100; // Value (0 ~ 100)
  _a = 1;   // Alpha (0 ~ 1)

  _isDraggingHuesatMarker = false;
  _isDraggingValueSliderMarker = false;
  _isDraggingAlphaSliderMarker = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XWheelColorPickerElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XWheelColorPickerElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this._elements["huesat-slider"].addEventListener("pointerdown", (event) => this._onHuesatSliderPointerDown(event));
    this._elements["value-slider"].addEventListener("pointerdown", (event) => this._onValueSliderPointerDown(event));
    this._elements["alpha-slider"].addEventListener("pointerdown", (event) => this._onAlphaSliderPointerDown(event));
  }

  async connectedCallback() {
    this._update();
    this._updateComputedSizeAttriubte();

    if (this._elements["huesat-image"].src === "") {
      this._elements["huesat-image"].src = await getColorWheelImageURL();
    }

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
    this._updateHuesatMarker();
    this._updateValueSliderMarker();
    this._updateValueSliderBackground();
    this._updateAlphaSliderMarker();
    this._updateAlphaSliderBackground();
  }

  _updateHuesatMarker() {
    let h = this._h;
    let s = this._s;

    let wheelSize = 100;
    let angle = degToRad(h);
    let radius = (s / 100) * wheelSize/2;
    let centerPoint = {x: wheelSize/2, y: wheelSize/2};

    let x = ((wheelSize - (centerPoint.x + (radius * cos(angle)))) / wheelSize) * 100;
    let y = ((centerPoint.y - (radius * sin(angle))) / wheelSize) * 100;

    this._elements["huesat-marker"].style.left = x + "%";
    this._elements["huesat-marker"].style.top = y + "%";
  }

  _updateValueSliderMarker() {
    this._elements["value-slider-marker"].style.left = (100 - normalize(this._v, 0, 100, 2)) + "%";
  }

  _updateValueSliderBackground() {
    let gradientBackground = "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1))";
    let solidBackground = serializeColor([this._h, this._s, 100, 1], "hsva", "hex");
    this._elements["value-slider"].style.background = `${gradientBackground}, ${solidBackground}`;
  }

  _updateAlphaSliderMarker() {
    this._elements["alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
  }

  _updateAlphaSliderBackground() {
    let [r, g, b] = hsvToRgb(this._h, this._s, this._v).map($0 => round($0, 0));

    this._elements["alpha-slider-gradient"].style.background = `
      linear-gradient(to right, rgba(${r}, ${g}, ${b}, 1), rgba(${r}, ${g}, ${b}, 0))
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
      this._isDraggingHuesatMarker === false &&
      this._isDraggingValueSliderMarker === false &&
      this._isDraggingAlphaSliderMarker === false
    ) {
      let [h, s, v, a] = new ColorParser().parse(this.value, "hsva");

      this._h = h;
      this._s = s;
      this._v = v;
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

  _onHuesatSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let pointerMoveListener, lostPointerCaptureListener;
    let wheelBounds = this._elements["huesat-slider"].getBoundingClientRect();

    this._isDraggingHuesatMarker = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    this._elements["huesat-slider"].style.cursor = "default";
    this._elements["huesat-slider"].setPointerCapture(pointerDownEvent.pointerId);

    let onPointerMove = (clientX, clientY) => {
      let radius = wheelBounds.width / 2;
      let x = clientX - wheelBounds.left - radius;
      let y = clientY - wheelBounds.top - radius;
      let d = pow(x, 2) + pow(y, 2);
      let theta = atan2(y, x);

      if (d > pow(radius, 2)) {
        x = radius * cos(theta);
        y = radius * sin(theta);
        d = pow(x, 2) + pow(y, 2);
        theta = atan2(y, x);
      }

      this._h = round(((theta + PI) / (PI * 2)) * 360, 3);
      this._s = round((sqrt(d) / radius) * 100, 3)

      this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this._updateHuesatMarker();
      this._updateValueSliderBackground();
      this._updateAlphaSliderBackground();
    };

    onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

    this._elements["huesat-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
    });

    this._elements["huesat-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
      this._elements["huesat-slider"].removeEventListener("pointermove", pointerMoveListener);
      this._elements["huesat-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this._elements["huesat-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingHuesatMarker = false;
    });
  }

  _onValueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this._elements["value-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingValueSliderMarker = true;
    this._elements["value-slider"].style.cursor = "default";
    this._elements["value-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let v = 100 - ((clientX - trackBounds.x) / trackBounds.width) * 100;
      v = normalize(v, 0, 100, 2);

      if (v !== this._v) {
        this._v = v;
        this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");

        this._updateValueSliderMarker();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this._elements["value-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this._elements["value-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this._elements["value-slider"].removeEventListener("pointermove", pointerMoveListener);
      this._elements["value-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this._elements["value-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingValueSliderMarker = false;
    });
  }

  _onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this._elements["alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingAlphaSliderMarker = true;
    this._elements["alpha-slider"].style.cursor = "default";
    this._elements["alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
      a = normalize(a, 0, 1, 2);

      if (a !== this._a) {
        this._a = a;
        this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
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
      this._elements["alpha-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-wheelcolorpicker", XWheelColorPickerElement);
