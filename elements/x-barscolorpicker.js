
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

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

  static #shadowTemplate = html`
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

  #h = 0;  // Hue (0 ~ 360)
  #s = 0;  // Saturation (0 ~ 100)
  #l = 80; // Lightness (0 ~ 100)
  #a = 1;  // Alpha (0 ~ 1)

  #shadowRoot = null;
  #elements = {};
  #xelSizeChangeListener = null;

  #isDraggingHueSliderMarker = false;
  #isDraggingSaturationSliderMarker = false;
  #isDraggingLightnessSliderMarker = false;
  #isDraggingAlphaSliderMarker = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XBarsColorPickerElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XBarsColorPickerElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.#elements["hue-slider"].addEventListener("pointerdown", (event) => {
      this.#onHueSliderPointerDown(event);
    });

    this.#elements["saturation-slider"].addEventListener("pointerdown", (event) => {
      this.#onSaturationSliderPointerDown(event);
    });

    this.#elements["lightness-slider"].addEventListener("pointerdown", (event) => {
      this.#onLightnessSliderPointerDown(event);
    });

    this.#elements["alpha-slider"].addEventListener("pointerdown", (event) => {
      this.#onAlphaSliderPointerDown(event);
    });
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

    this.#updateSaturationSliderMarker();
    this.#updateSaturationSliderBackground();

    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();
  }

  #updateHueSliderMarker() {
    this.#elements["hue-slider-marker"].style.left = ((normalize(this.#h, 0, 360, 0) / 360) * 100) + "%";
  }

  #updateSaturationSliderMarker() {
    this.#elements["saturation-slider-marker"].style.left = normalize(this.#s, 0, 100, 2) + "%";
  }

  #updateLightnessSliderMarker() {
    this.#elements["lightness-slider-marker"].style.left = normalize(this.#l, 0, 100, 2) + "%";
  }

  #updateAlphaSliderMarker() {
    this.#elements["alpha-slider-marker"].style.left = normalize((1 - this.#a) * 100, 0, 100, 2) + "%";
  }

  #updateSaturationSliderBackground() {
    let h = this.#h;

    this.#elements["saturation-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, 0%, 50%), hsl(${h}, 100%, 50%)
    )`;
  }

  #updateLightnessSliderBackground() {
    let h = this.#h;
    let s = this.#s;

    this.#elements["lightness-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%)
    )`;
  }

  #updateAlphaSliderBackground() {
    let h = this.#h;
    let s = this.#s;
    let l = this.#l

    this.#elements["alpha-slider-gradient"].style.background = `
      linear-gradient(to right, hsla(${h}, ${s}%, ${l}%, 1), hsla(${h}, ${s}%, ${l}%, 0))
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
      this.#isDraggingSaturationSliderMarker === false &&
      this.#isDraggingLightnessSliderMarker === false &&
      this.#isDraggingAlphaSliderMarker === false
    ) {
      let [h, s, l, a] = new ColorParser().parse(this.value, "hsla");

      this.#h = h;
      this.#s = s;
      this.#l = l;
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

  #onHueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this.#elements["hue-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this.#isDraggingHueSliderMarker = true;
    this.#elements["hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let h = ((clientX - trackBounds.x) / trackBounds.width) * 360;
      h = normalize(h, 0, 360, 0);

      if (h !== this.#h) {
        this.#h = h;
        this.value = serializeColor([this.#h, this.#s, this.#l, this.#a], "hsla", "hsla");

        this.#updateHueSliderMarker();
        this.#updateSaturationSliderBackground();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["hue-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this.#elements["hue-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["hue-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingHueSliderMarker = false;
    });
  }

  #onSaturationSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this.#elements["saturation-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this.#isDraggingSaturationSliderMarker = true;
    this.#elements["saturation-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let s = ((clientX - trackBounds.x) / trackBounds.width) * 100;
      s = normalize(s, 0, 100, 0);

      if (s !== this.#s) {
        this.#s = s;
        this.value = serializeColor([this.#h, this.#s, this.#l, this.#a], "hsla", "hsla");

        this.#updateSaturationSliderMarker();
        this.#updateSaturationSliderBackground();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["saturation-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["saturation-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this.#elements["saturation-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["saturation-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSaturationSliderMarker = false;
    });
  }

  #onLightnessSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this.#elements["lightness-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this.#isDraggingLightnessSliderMarker = true;
    this.#elements["lightness-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let l = ((clientX - trackBounds.x) / trackBounds.width) * 100;
      l = normalize(l, 0, 100, 0);

      if (l !== this.#l) {
        this.#l = l;
        this.value = serializeColor([this.#h, this.#s, this.#l, this.#a], "hsla", "hsla");

        this.#updateLightnessSliderMarker();
        this.#updateSaturationSliderBackground();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["lightness-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["lightness-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this.#elements["lightness-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["lightness-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingLightnessSliderMarker = false;
    });
  }

  #onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let trackBounds = this.#elements["alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;

    this.#isDraggingAlphaSliderMarker = true;
    this.#elements["alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
      a = normalize(a, 0, 1, 2);

      if (a !== this.#a) {
        this.#a = a;
        this.value = serializeColor([this.#h, this.#s, this.#l, this.#a], "hsla", "hsla");
        this.#updateAlphaSliderMarker();
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this.#elements["alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      onPointerMove(pointerMoveEvent.clientX);
    });

    this.#elements["alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this.#elements["alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
      this.#elements["alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingAlphaSliderMarker = false;
    });
  }
};

customElements.define("x-barscolorpicker", XBarsColorPickerElement);
