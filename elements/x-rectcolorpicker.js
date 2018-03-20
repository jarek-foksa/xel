
// @copyright
//   © 2016-2017 Jarosław Foksa

import {parseColor, serializeColor, hsvToRgb} from "../utils/color.js";
import {createElement} from "../utils/element.js";
import {round, normalize} from "../utils/math.js";

let debug = false;

let shadowHTML = `
  <link rel="stylesheet" href="node_modules/xel/stylesheets/x-rectcolorpicker.css" data-vulcanize>

  <x-box vertical>
    <div id="hue-slider">
      <div id="hue-slider-track">
        <div id="hue-slider-marker"></div>
      </div>
    </div>

    <div id="satlight-slider">
      <div id="satlight-marker"></div>
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
export class XRectColorPickerElement extends HTMLElement {
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

    this._isDraggingHueSliderMarker = false;
    this._isDraggingSatlightMarker = false;
    this._isDraggingAlphaSliderMarker = false;

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.innerHTML = shadowHTML;

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#hue-slider"].addEventListener("pointerdown", (event) => this._onHueSliderPointerDown(event));
    this["#satlight-slider"].addEventListener("pointerdown", (event) => this._onSatlightSliderPointerDown(event));
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

    this._updateSatlightSliderMarker();
    this._updateSatlightSliderBackground();

    this._updateAlphaSliderMarker();
    this._updateAlphaSliderBackground();
  }

  _updateHueSliderMarker() {
    this["#hue-slider-marker"].style.left = ((normalize(this._h, 0, 360, 0) / 360) * 100) + "%";
  }

  _updateSatlightSliderMarker() {
    let left = (this._s / 100) * 100;
    let top = 100 - ((this._v / 100) * 100);

    this["#satlight-marker"].style.left = `${left}%`;
    this["#satlight-marker"].style.top = `${top}%`;
  }

  _updateSatlightSliderBackground() {
    let background1 = serializeColor([this._h, 100, 50, 1], "hsla", "hex");
    let background2 = "linear-gradient(to left, rgba(255,255,255,0), rgba(255,255,255,1))";
    let background3 = "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))";
    this["#satlight-slider"].style.background = `${background3}, ${background2}, ${background1}`;
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
      this._isDraggingHueSliderMarker === false &&
      this._isDraggingSatlightMarker === false &&
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

  _onSatlightSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let pointerMoveListener, lostPointerCaptureListener;
    let sliderBounds = this["#satlight-slider"].getBoundingClientRect();

    this._isDraggingSatlightMarker = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
    this["#satlight-slider"].setPointerCapture(pointerDownEvent.pointerId);

    let onPointerMove = (clientX, clientY) => {
      let x = ((clientX - sliderBounds.left) / sliderBounds.width) * 100;
      let y = ((clientY - sliderBounds.top) / sliderBounds.height) * 100;

      x = normalize(x, 0, 100, 2);
      y = normalize(y, 0, 100, 2);

      this._s = x;
      this._v = 100 - y;

      this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this._updateSatlightSliderMarker();
      this._updateSatlightSliderBackground();
      this._updateAlphaSliderBackground();
    };

    onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

    this["#satlight-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
    });

    this["#satlight-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
      this["#satlight-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#satlight-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this._isDraggingSatlightMarker = false;
    });
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
        this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");

        this._updateHueSliderMarker();
        this._updateSatlightSliderBackground();
        this._updateSatlightSliderMarker();
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
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this._isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-rectcolorpicker", XRectColorPickerElement);
