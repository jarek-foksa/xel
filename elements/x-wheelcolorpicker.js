
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
// @part slider
export default class XWheelColorPickerElement extends HTMLElement {
  static observedAttributes = ["value"];

  static #shadowTemplate = html`
    <template>
      <x-box vertical>
        <div id="huesat-slider" part="slider">
          <img id="huesat-image"></img>
          <div id="huesat-marker"></div>
        </div>

        <div id="value-slider" part="slider">
          <div id="value-slider-track">
            <div id="value-slider-marker"></div>
          </div>
        </div>

        <div id="alpha-slider" part="slider">
          <div id="alpha-slider-gradient"></div>
          <div id="alpha-slider-track">
            <div id="alpha-slider-marker"></div>
          </div>
        </div>
      </x-box>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      user-select: none;
      -webkit-user-select: none;
      --wheel-max-width: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
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
    :host([size="small"]) #value-slider {
      height: 24px;
    }
    :host([size="large"]) #value-slider {
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
    :host([size="small"]) #alpha-slider {
      height: 24px;
    }
    :host([size="large"]) #alpha-slider {
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
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  // @type boolean
  // @default false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot = null;
  #elements = {};

  // Note that HSVA color model is used only internally
  #h = 0;   // Hue (0 ~ 360)
  #s = 0;   // Saturation (0 ~ 100)
  #v = 100; // Value (0 ~ 100)
  #a = 1;   // Alpha (0 ~ 1)

  #isDraggingHuesatMarker      = false;
  #isDraggingValueSliderMarker = false;
  #isDraggingAlphaSliderMarker = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XWheelColorPickerElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XWheelColorPickerElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.#elements["huesat-slider"].addEventListener("pointerdown", (event) => this.#onHuesatSliderPointerDown(event));
    this.#elements["value-slider"].addEventListener("pointerdown",  (event) => this.#onValueSliderPointerDown(event));
    this.#elements["alpha-slider"].addEventListener("pointerdown",  (event) => this.#onAlphaSliderPointerDown(event));
  }

  async connectedCallback() {
    this.#update();

    if (this.#elements["huesat-image"].src === "") {
      this.#elements["huesat-image"].src = await getColorWheelImageURL();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this.#onValueAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updateHuesatMarker();
    this.#updateValueSliderMarker();
    this.#updateValueSliderBackground();
    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();
  }

  #updateHuesatMarker() {
    let h = this.#h;
    let s = this.#s;

    let wheelSize = 100;
    let angle = degToRad(h);
    let radius = (s / 100) * wheelSize/2;
    let centerPoint = {x: wheelSize/2, y: wheelSize/2};

    let x = ((wheelSize - (centerPoint.x + (radius * cos(angle)))) / wheelSize) * 100;
    let y = ((centerPoint.y - (radius * sin(angle))) / wheelSize) * 100;

    this.#elements["huesat-marker"].style.left = x + "%";
    this.#elements["huesat-marker"].style.top = y + "%";
  }

  #updateValueSliderMarker() {
    this.#elements["value-slider-marker"].style.left = (100 - normalize(this.#v, 0, 100, 2)) + "%";
  }

  #updateValueSliderBackground() {
    let gradientBackground = "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1))";
    let solidBackground = serializeColor([this.#h, this.#s, 100, 1], "hsva", "hex");
    this.#elements["value-slider"].style.background = `${gradientBackground}, ${solidBackground}`;
  }

  #updateAlphaSliderMarker() {
    this.#elements["alpha-slider-marker"].style.left = normalize((1 - this.#a) * 100, 0, 100, 2) + "%";
  }

  #updateAlphaSliderBackground() {
    let [r, g, b] = hsvToRgb(this.#h, this.#s, this.#v).map($0 => round($0, 0));

    this.#elements["alpha-slider-gradient"].style.background = `
      linear-gradient(to right, rgba(${r}, ${g}, ${b}, 1), rgba(${r}, ${g}, ${b}, 0))
    `;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onValueAttributeChange() {
    if (
      this.#isDraggingHuesatMarker === false &&
      this.#isDraggingValueSliderMarker === false &&
      this.#isDraggingAlphaSliderMarker === false
    ) {
      let [h, s, v, a] = new ColorParser().parse(this.value, "hsva");

      this.#h = h;
      this.#s = s;
      this.#v = v;
      this.#a = a;

      this.#update();
    }

    if (DEBUG) {
      console.log(`%c ${this.value}`, `background: ${this.value};`);
    }
  }

  #onHuesatSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    // @bugfix: https://bugs.chromium.org/p/chromium/issues/detail?id=1166044
    pointerDownEvent.preventDefault();

    let pointerMoveListener, pointerUpListener;
    let wheelBounds = this.#elements["huesat-slider"].getBoundingClientRect();

    this.#isDraggingHuesatMarker = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    this.#elements["huesat-slider"].style.cursor = "default";
    this.#elements["huesat-slider"].setPointerCapture(pointerDownEvent.pointerId);

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

      this.#h = round(((theta + PI) / (PI * 2)) * 360, 3);
      this.#s = round((sqrt(d) / radius) * 100, 3)

      this.value = serializeColor([this.#h, this.#s, this.#v, this.#a], "hsva", "hsla");
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updateHuesatMarker();
      this.#updateValueSliderBackground();
      this.#updateAlphaSliderBackground();
    };

    onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

    this.#elements["huesat-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
    });

    this.#elements["huesat-slider"].addEventListener("pointerup", pointerUpListener = (event) => {
      this.#elements["huesat-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["huesat-slider"].removeEventListener("pointerup", pointerUpListener);
      this.#elements["huesat-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this.#isDraggingHuesatMarker = false;
    });
  }

  #onValueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    // @bugfix: https://bugs.chromium.org/p/chromium/issues/detail?id=1166044
    pointerDownEvent.preventDefault();

    let trackBounds = this.#elements["value-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpListener;

    this.#isDraggingValueSliderMarker = true;
    this.#elements["value-slider"].style.cursor = "default";
    this.#elements["value-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let v = 100 - ((clientX - trackBounds.x) / trackBounds.width) * 100;
      v = normalize(v, 0, 100, 2);

      if (v !== this.#v) {
        this.#v = v;
        this.value = serializeColor([this.#h, this.#s, this.#v, this.#a], "hsva", "hsla");

        this.#updateValueSliderMarker();
        this.#updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["value-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["value-slider"].addEventListener("pointerup", pointerUpListener = () => {
      this.#elements["value-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["value-slider"].removeEventListener("pointerup", pointerUpListener);
      this.#elements["value-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this.#isDraggingValueSliderMarker = false;
    });
  }

  #onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    // @bugfix: https://bugs.chromium.org/p/chromium/issues/detail?id=1166044
    pointerDownEvent.preventDefault();

    let trackBounds = this.#elements["alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpListener;

    this.#isDraggingAlphaSliderMarker = true;
    this.#elements["alpha-slider"].style.cursor = "default";
    this.#elements["alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
      a = normalize(a, 0, 1, 2);

      if (a !== this.#a) {
        this.#a = a;
        this.value = serializeColor([this.#h, this.#s, this.#v, this.#a], "hsva", "hsla");
        this.#updateAlphaSliderMarker();
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["alpha-slider"].addEventListener("pointerup", pointerUpListener = () => {
      this.#elements["alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["alpha-slider"].removeEventListener("pointerup", pointerUpListener);
      this.#elements["alpha-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this.#isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-wheelcolorpicker", XWheelColorPickerElement);
