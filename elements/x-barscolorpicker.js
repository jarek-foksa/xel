
// @copyright
//   © 2016-2017 Jarosław Foksa

import {parseColor, serializeColor} from "../utils/color.js";
import {createElement} from "../utils/element.js";
import {normalize} from "../utils/math.js";

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
     * Hue slider
     */

    #hue-slider {
      width: 100%;
      height: 28px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      background: red;
      --marker-width: 18px;
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
      height: 32px;
      position: absolute;
    }

    /**
     * Saturation slider
     */

    #saturation-slider {
      width: 100%;
      height: 28px;
      margin-top: 20px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
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
      height: 32px;
      position: absolute;
    }

    /**
     * Lightness slider
     */

    #lightness-slider {
      width: 100%;
      height: 28px;
      margin-top: 20px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
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
      margin-top: 20px;
      margin-bottom: 8px;
      padding: 0 calc(var(--marker-width) / 2);
      position: relative;
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      /* Checkerboard pattern */
      background-color: white;
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
      height: 32px;
      position: absolute;
    }
  </style>

  <x-box vertical>
    <div id="hue-slider">
      <div id="hue-slider-track">
        <div id="hue-slider-marker"></div>
      </div>
    </div>

    <div id="saturation-slider">
      <div id="saturation-slider-track">
        <div id="saturation-slider-marker"></div>
      </div>
    </div>

    <div id="lightness-slider">
      <div id="lightness-slider-track">
        <div id="lightness-slider-marker"></div>
      </div>
    </div>

    <div id="alpha-slider">
      <div id="alpha-slider-gradient"></div>
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
export class XBarsColorPickerElement extends HTMLElement {
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

    this._h = 0;  // Hue (0 ~ 360)
    this._s = 0;  // Saturation (0 ~ 100)
    this._l = 80; // Lightness (0 ~ 100)
    this._a = 1;  // Alpha (0 ~ 1)

    this._isDraggingHueSliderMarker = false;
    this._isDraggingSaturationSliderMarker = false;
    this._isDraggingLightnessSliderMarker = false;
    this._isDraggingAlphaSliderMarker = false;

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.innerHTML = shadowHTML;

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#hue-slider"].addEventListener("pointerdown", (event) => this._onHueSliderPointerDown(event));
    this["#saturation-slider"].addEventListener("pointerdown", (event) => this._onSaturationSliderPointerDown(event));
    this["#lightness-slider"].addEventListener("pointerdown", (event) => this._onLightnessSliderPointerDown(event));
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
    this._updateHueSliderMarker();

    this._udpateSaturationSliderMarker();
    this._udpateSaturationSliderBackground();

    this._udpateLightnessSliderMarker();
    this._udpateLightnessSliderBackground();

    this._updateAlphaSliderMarker();
    this._updateAlphaSliderBackground();
  }

  _updateHueSliderMarker() {
    this["#hue-slider-marker"].style.left = ((normalize(this._h, 0, 360, 0) / 360) * 100) + "%";
  }

  _udpateSaturationSliderMarker() {
    this["#saturation-slider-marker"].style.left = normalize(this._s, 0, 100, 2) + "%";
  }

  _udpateLightnessSliderMarker() {
    this["#lightness-slider-marker"].style.left = normalize(this._l, 0, 100, 2) + "%";
  }

  _updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
  }

  _udpateSaturationSliderBackground() {
    let h = this._h;

    this["#saturation-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, 0%, 50%), hsl(${h}, 100%, 50%)
    )`;
  }

  _udpateLightnessSliderBackground() {
    let h = this._h;
    let s = this._s;

    this["#lightness-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%)
    )`;
  }

  _updateAlphaSliderBackground() {
    let h = this._h;
    let s = this._s;
    let l = this._l

    this["#alpha-slider-gradient"].style.background = `
      linear-gradient(to right, hsla(${h}, ${s}%, ${l}%, 1), hsla(${h}, ${s}%, ${l}%, 0))
    `;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    if (
      this._isDraggingHueSliderMarker === false &&
      this._isDraggingSaturationSliderMarker === false &&
      this._isDraggingLightnessSliderMarker === false &&
      this._isDraggingAlphaSliderMarker === false
    ) {
      let [h, s, l, a] = parseColor(this.value, "hsla");

      this._h = h;
      this._s = s;
      this._l = l;
      this._a = a;

      this._update();
    }

    if (debug) {
      console.log(`%c ${this.value}`, `background: ${this.value};`);
    }
  }

  _onHueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this["#hue-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingHueSliderMarker = true;
    this["#hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let h = ((clientX - trackBounds.x) / trackBounds.width) * 360;
      h = normalize(h, 0, 360, 0);

      if (h !== this._h) {
        this._h = h;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

        this._updateHueSliderMarker();
        this._udpateSaturationSliderBackground();
        this._udpateLightnessSliderBackground();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this["#hue-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this["#hue-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#hue-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingHueSliderMarker = false;
    });
  }

  _onSaturationSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this["#saturation-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingSaturationSliderMarker = true;
    this["#saturation-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let s = ((clientX - trackBounds.x) / trackBounds.width) * 100;
      s = normalize(s, 0, 100, 0);

      if (s !== this._s) {
        this._s = s;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

        this._udpateSaturationSliderMarker();
        this._udpateSaturationSliderBackground();
        this._udpateLightnessSliderBackground();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#saturation-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this["#saturation-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this["#saturation-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#saturation-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingSaturationSliderMarker = false;
    });
  }

  _onLightnessSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this["#lightness-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingLightnessSliderMarker = true;
    this["#lightness-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let l = ((clientX - trackBounds.x) / trackBounds.width) * 100;
      l = normalize(l, 0, 100, 0);

      if (l !== this._l) {
        this._l = l;
        this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

        this._udpateLightnessSliderMarker();
        this._udpateSaturationSliderBackground();
        this._udpateLightnessSliderBackground();
        this._updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#lightness-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this["#lightness-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this["#lightness-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#lightness-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingLightnessSliderMarker = false;
    });
  }

  _onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this["#alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this._isDraggingAlphaSliderMarker = true;
    this["#alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
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

    this["#alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this["#alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this["#alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-barscolorpicker", XBarsColorPickerElement);
