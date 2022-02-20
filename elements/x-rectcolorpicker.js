
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";
import ColorParser from "../classes/color-parser.js";

import {serializeColor, hsvToRgb} from "../utils/color.js";
import {round, normalize} from "../utils/math.js";
import {html, css} from "../utils/template.js";

const DEBUG = false;

// @element x-rectcolorpicker
// @event change
// @event changestart
// @event changeend
export default class XRectColorPickerElement extends HTMLElement {
  static observedAttributes = ["value", "size"];

  static #shadowTemplate = html`
    <template>
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
      margin-bottom: 14px;
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      background: red;
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
     * Saturation-lightness slider
     */

    #satlight-slider {
      width: 100%;
      height: 174px;
      border-radius: 2px;
      position: relative;
      touch-action: pinch-zoom;
    }

    #satlight-marker {
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

  // @attribute
  // @property
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

  #shadowRoot = null;
  #elements = {};
  #xelSizeChangeListener = null;

  // Note that HSVA color model is used only internally
  #h = 0;   // Hue (0 ~ 360)
  #s = 0;   // Saturation (0 ~ 100)
  #v = 100; // Value (0 ~ 100)
  #a = 1;   // Alpha (0 ~ 1)

  #isDraggingHueSliderMarker   = false;
  #isDraggingSatlightMarker    = false;
  #isDraggingAlphaSliderMarker = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XRectColorPickerElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XRectColorPickerElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.#elements["hue-slider"].addEventListener("pointerdown", (e) => this.#onHueSliderPointerDown(e));
    this.#elements["satlight-slider"].addEventListener("pointerdown", (e) => this.#onSatlightSliderPointerDown(e));
    this.#elements["alpha-slider"].addEventListener("pointerdown", (e) => this.#onAlphaSliderPointerDown(e));
  }

  connectedCallback() {
    this.#update();
    this.#updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => this.#updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "size") {
      this.#onSizeAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updateHueSliderMarker();

    this.#updateSatlightSliderMarker();
    this.#updateSatlightSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();
  }

  #updateHueSliderMarker() {
    this.#elements["hue-slider-marker"].style.left = ((normalize(this.#h, 0, 360, 0) / 360) * 100) + "%";
  }

  #updateSatlightSliderMarker() {
    let left = (this.#s / 100) * 100;
    let top = 100 - ((this.#v / 100) * 100);

    this.#elements["satlight-marker"].style.left = `${left}%`;
    this.#elements["satlight-marker"].style.top = `${top}%`;
  }

  #updateSatlightSliderBackground() {
    let background1 = serializeColor([this.#h, 100, 50, 1], "hsla", "hex");
    let background2 = "linear-gradient(to left, rgba(255,255,255,0), rgba(255,255,255,1))";
    let background3 = "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))";
    this.#elements["satlight-slider"].style.background = `${background3}, ${background2}, ${background1}`;
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

  #updateComputedSizeAttriubte() {
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

  #onValueAttributeChange() {
    if (
      this.#isDraggingHueSliderMarker === false &&
      this.#isDraggingSatlightMarker === false &&
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

  #onSizeAttributeChange() {
    this.#updateComputedSizeAttriubte();
  }

  #onSatlightSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    let sliderBounds = this.#elements["satlight-slider"].getBoundingClientRect();
    let pointerMoveListener, pointerUpListener;

    this.#isDraggingSatlightMarker = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
    this.#elements["satlight-slider"].setPointerCapture(pointerDownEvent.pointerId);

    let onPointerMove = (clientX, clientY) => {
      let x = ((clientX - sliderBounds.left) / sliderBounds.width) * 100;
      let y = ((clientY - sliderBounds.top) / sliderBounds.height) * 100;

      x = normalize(x, 0, 100, 2);
      y = normalize(y, 0, 100, 2);

      this.#s = x;
      this.#v = 100 - y;

      this.value = serializeColor([this.#h, this.#s, this.#v, this.#a], "hsva", "hsla");
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updateSatlightSliderMarker();
      this.#updateSatlightSliderBackground();
      this.#updateAlphaSliderBackground();
    };

    onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

    this.#elements["satlight-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
    });

    this.#elements["satlight-slider"].addEventListener("pointerup", pointerUpListener = (pointerUpEvent) => {
      this.#elements["satlight-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["satlight-slider"].removeEventListener("pointerup", pointerUpListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this.#isDraggingSatlightMarker = false;
    });
  }

  #onHueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    let trackBounds = this.#elements["hue-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpListener;

    this.#isDraggingHueSliderMarker = true;
    this.#elements["hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let h = ((clientX - trackBounds.x) / trackBounds.width) * 360;
      h = normalize(h, 0, 360, 0);

      if (h !== this.#h) {
        this.#h = h;
        this.value = serializeColor([this.#h, this.#s, this.#v, this.#a], "hsva", "hsla");

        this.#updateHueSliderMarker();
        this.#updateSatlightSliderBackground();
        this.#updateSatlightSliderMarker();
        this.#updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["hue-slider"].addEventListener("pointerup", pointerUpListener = () => {
      this.#elements["hue-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["hue-slider"].removeEventListener("pointerup", pointerUpListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingHueSliderMarker = false;
    });
  }

  #onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    let trackBounds = this.#elements["alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpListener;

    this.#isDraggingAlphaSliderMarker = true;
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
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-rectcolorpicker", XRectColorPickerElement);
