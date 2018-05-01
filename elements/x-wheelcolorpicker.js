
// @copyright
//   © 2016-2017 Jarosław Foksa

import {parseColor, serializeColor, hsvToRgb} from "../utils/color.js";
import {createElement} from "../utils/element.js";
import {round, normalize, degToRad} from "../utils/math.js";

let {PI, sqrt, atan2, sin, cos, pow} = Math;
let debug = false;

let shadowHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      user-select: none;
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
      height: 28px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
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
      height: 32px;
      position: absolute;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      display: none;
      width: 100%;
      height: 28px;
      margin-top: 14px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }
    :host([alphaslider]) #alpha-slider {
      display: block;
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
      height: 32px;
      position: absolute;
    }
  </style>

  <x-box vertical>
    <div id="huesat-slider">
      <img id="huesat-image" src="node_modules/xel/images/wheel-spectrum.png"></img>
      <div id="huesat-marker"></div>
    </div>

    <div id="value-slider">
      <div id="value-slider-track">
        <div id="value-slider-marker"></div>
      </div>
    </div>

    <div id="alpha-slider">
      <div id="alpha-slider-track">
        <div id="alpha-slider-marker"></div>
      </div>
    </div>
  </x-box>
`;

// @events
//   change
//   changestart
//   changeend
export class XWheelColorPickerElement extends HTMLElement {
  static get observedAttributes() {
    return ["value"];
  }

  // @type
  //   string
  // @default
  //   "hsla(0, 0%, 100%, 1)"
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "hsla(0, 0%, 100%, 1)";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    // Note that HSVA color model is used only internally
    this._h = 0;   // Hue (0 ~ 360)
    this._s = 0;   // Saturation (0 ~ 100)
    this._v = 100; // Value (0 ~ 100)
    this._a = 1;   // Alpha (0 ~ 1)

    this._isDraggingHuesatMarker = false;
    this._isDraggingValueSliderMarker = false;
    this._isDraggingAlphaSliderMarker = false;

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.innerHTML = shadowHTML;

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#huesat-slider"].addEventListener("pointerdown", (event) => this._onHuesatSliderPointerDown(event));
    this["#value-slider"].addEventListener("pointerdown", (event) => this._onValueSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this._onAlphaSliderPointerDown(event));
  }

  connectedCallback() {
    this._update();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this._onValueAttributeChange();
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

    this["#huesat-marker"].style.left = x + "%";
    this["#huesat-marker"].style.top = y + "%";
  }

  _updateValueSliderMarker() {
    this["#value-slider-marker"].style.left = (100 - normalize(this._v, 0, 100, 2)) + "%";
  }

  _updateValueSliderBackground() {
    let gradientBackground = "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1))";
    let solidBackground = serializeColor([this._h, this._s, 100, 1], "hsva", "hex");
    this["#value-slider"].style.background = `${gradientBackground}, ${solidBackground}`;
  }

  _updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
  }

  _updateAlphaSliderBackground() {
    let [r, g, b] = hsvToRgb(this._h, this._s, this._v).map($0 => round($0, 0));
    let backroundA = `url(node_modules/xel/images/checkboard.png) repeat 0 0`;
    let background = `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 1), rgba(${r}, ${g}, ${b}, 0))`;
    this["#alpha-slider"].style.background = background + "," + backroundA;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    if (
      this._isDraggingHuesatMarker === false &&
      this._isDraggingValueSliderMarker === false &&
      this._isDraggingAlphaSliderMarker === false
    ) {
      let [h, s, v, a] = parseColor(this.value, "hsva");

      this._h = h;
      this._s = s;
      this._v = v;
      this._a = a;

      this._update();
    }

    if (debug) {
      console.log(`%c ${this.value}`, `background: ${this.value};`);
    }
  }

  _onHuesatSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let pointerMoveListener, lostPointerCaptureListener;
    let wheelBounds = this["#huesat-slider"].getBoundingClientRect();

    this._isDraggingHuesatMarker = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    this["#huesat-slider"].style.cursor = "default";
    this["#huesat-slider"].setPointerCapture(pointerDownEvent.pointerId);

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

    this["#huesat-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
    });

    this["#huesat-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
      this["#huesat-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#huesat-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this["#huesat-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingHuesatMarker = false;
    });
  }

  _onValueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this["#value-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingValueSliderMarker = true;
    this["#value-slider"].style.cursor = "default";
    this["#value-slider"].setPointerCapture(pointerDownEvent.pointerId);
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

    this["#value-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this["#value-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this["#value-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#value-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this["#value-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingValueSliderMarker = false;
    });
  }

  _onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this["#alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingAlphaSliderMarker = true;
    this["#alpha-slider"].style.cursor = "default";
    this["#alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
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

    this["#alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this["#alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this["#alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this["#alpha-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-wheelcolorpicker", XWheelColorPickerElement);
