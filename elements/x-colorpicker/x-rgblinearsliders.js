
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {convertColor, serializeColor, normalizeColorSpaceName} from "../../utils/color.js";
import {closest} from "../../utils/element.js";
import {normalize} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";

/**
 * Linear sliders for RGB-based color spaces (sRBG, Linear sRGB, Adobe RGB, Display P3, Rec. 2020, ProPhoto RGB).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XRGBLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="coord-0-slider" class="slider" part="slider">
        <div id="coord-0-slider-track" class="slider-track">
          <svg id="coord-0-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="coord-0-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="coord-0-slider-marker" class="slider-marker">
            <span id="coord-0-slider-label" class="slider-label"></span>
          </div>
        </div>
      </div>

      <div id="coord-1-slider" class="slider" part="slider">
        <div id="coord-1-slider-track" class="slider-track">
          <svg id="coord-1-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="coord-1-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="coord-1-slider-marker" class="slider-marker">
            <span id="coord-1-slider-label" class="slider-label"></span>
          </div>
        </div>
      </div>

      <div id="coord-2-slider" class="slider" part="slider">
        <div id="coord-2-slider-track" class="slider-track">
          <svg id="coord-2-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="coord-2-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="coord-2-slider-marker" class="slider-marker">
            <span id="coord-2-slider-label" class="slider-label"></span>
          </div>
        </div>
      </div>

      <div id="alpha-slider" class="slider" part="slider">
        <div id="alpha-slider-gradient"></div>

        <div id="alpha-slider-track" class="slider-track">
          <div id="alpha-slider-marker" class="slider-marker">
            <span id="alpha-slider-label" class="slider-label">α</span>
          </div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
          <x-label><x-message href="#color-picker" autocapitalize>Color Picker</x-message></x-label>

          <x-menuitem>
            <x-label><x-message href="#color-model" autocapitalize>Color Model</x-message></x-label>

            <x-menu id="color-model-menu">
              <x-menuitem value="hsv"><x-label>HSV</x-label></x-menuitem>
              <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
              <x-menuitem value="hwb"><x-label>HWB</x-label></x-menuitem>
              <hr/>
              <x-menuitem value="okhsv" data-srgb-only><x-label>OK HSV</x-label></x-menuitem>
              <x-menuitem value="okhsl" data-srgb-only><x-label>OK HSL</x-label></x-menuitem>
              <x-menuitem value="hsluv" data-srgb-only><x-label>HSLuv</x-label></x-menuitem>
              <hr/>
              <x-menuitem value="rgb"><x-label>RGB</x-label></x-menuitem>
            </x-menu>
          </x-menuitem>

          <x-menuitem id="gamut-hints-menu-item">
            <x-label><x-message href="#gamut-hints" autocapitalize>Gamut Hints</x-message></x-label>
            <x-menu id="gamut-hints-menu"></x-menu>
          </x-menuitem>

          <hr/>

          <x-menuitem id="labels-menu-item" value="labels">
            <x-label><x-message href="#labels" autocapitalize>Labels</x-message></x-label>
          </x-menuitem>
        </x-menu>
      </x-contextmenu>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      user-select: none;
      -webkit-user-select: none;
      --marker-width: 18px;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }

    /**
     * Sliders
     */

    .slider {
      width: 100%;
      height: 35px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      touch-action: pinch-zoom;
    }

    .slider-track {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
    }

    .slider-marker {
      position: absolute;
      left: 0%;
      width: var(--marker-width);
      height: calc(100% + 6px);
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
    }
    .slider-marker[data-warn]::after {
      content: "⚠";
      position: absolute;
      right: -26px;
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 1.125rem;
    }

    .slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    .slider-gamut-path {
      fill: none;
      stroke: white;
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 2px;
      opacity: 0.8;
    }

    .slider-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.625rem;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      display: none;
      margin-top: 10px;
      position: relative;
      background: var(--checkboard-background);
    }
    :host([alpha]) #alpha-slider {
      display: block;
    }

    #alpha-slider-gradient {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }
  `;

  /**
   * @type {[number, number, number, number]}
   */
  get value() {
    let model = this.#getResolvedModel();

    // RGB
    if (model === "rgb") {
      let [r, g, b] = this.#coords;
      return [r, g, b, this.#a];
    }
    // HSV
    else if (model === "hsv") {
      let [h, s, v] = this.#coords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // OK HSV
    else if (model === "okhsv") {
      let [h, s, v] = this.#coords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s, v]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HSL, HSLuv
    else if (model === "hsl" || model === "hsluv") {
      let [h, s, l] = this.#coords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // OK HSL
    else if (model === "okhsl") {
      let [h, s, l] = this.#coords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s, l]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HWB
    else {
      let [h, w, b] = this.#coords;
      let [rr, gg, bb] = convertColor({space: "hwb", coords: [h*360, w*100, b*100]}, "srgb").coords;
      return [rr, gg, bb, this.#a];
    }
  }
  set value([r, g, b, a]) {
    let model = this.#getResolvedModel();

    // RGB
    if (model === "rgb") {
      this.#coords = [r, g, b];
      this.#a = a;
    }
    // HSV
    else if (model === "hsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#coords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // OK HSV
    else if (model === "okhsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#coords = [h/360, s, v];
      this.#a = a;
    }
    // HSL, HSLuv
    else if (model === "hsl" ||model === "hsluv") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#coords = [h/360, s/100, l/100];
      this.#a = a;
    }
    // OK HSL
    else if (model === "okhsl") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#coords = [h/360, s, l];
      this.#a = a;
    }
    // HWB
    else if (model === "hwb") {
      let [hh, ww, bb] = convertColor({space: "srgb", coords: [r, g, b]}, "hwb").coords;
      this.#coords = [hh/360, ww/100, bb/100];
      this.#a = a;
    }

    // Convert missing components to 0
    // @see https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < this.#coords.length; i += 1) {
      if (this.#coords[i] === null || Number.isNaN(this.#coords[i])) {
        this.#coords[i] = 0;
      }
    }

    this.#update();
  }

  /**
   * @type {"srgb" | "srgb-linear" | "a98rgb" | "p3" | "rec2020" | "prophoto"}
   * @default "srgb"
   */
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  /**
   * @type {boolean}
   * @default false
   * @attribute
   */
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  /**
   * @type {boolean}
   * @default false
   * @attribute
   */
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot = null;
  #ownerColorPicker;
  #configChangeListener;
  #isDraggingSlider = false;

  #space = "srgb";      // Either "srgb", "srgb-linear", "a98rgb", "p3", "rec2020" or "prophoto"
  #model = "hsv";       // Either "hsv", "hsl", "hwb", "okhsv", "okhsl", "hsluv" or "rgb"
  #gamutHints = "srgb"; // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];  // Values in the current MODEL coordinate system normalized to 0.00 - 1.00 range
  #a = 1;               // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XRGBLinearSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XRGBLinearSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#coord-0-slider"].addEventListener("pointerdown", (event) => this.#onCoord0SliderPointerDown(event));
    this["#coord-1-slider"].addEventListener("pointerdown", (event) => this.#onCoord1SliderPointerDown(event));
    this["#coord-2-slider"].addEventListener("pointerdown", (event) => this.#onCoord2SliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
    this.#ownerColorPicker = closest(this, "x-colorpicker");
    this.#model = Xel.getConfig(`${this.localName}:model`, "hsv");
    this.#gamutHints = normalizeColorSpaceName(Xel.getConfig("x-colorpicker:gamutHints", "srgb"), "color.js");
    this.#labels = Xel.getConfig("x-colorpicker:labels", true);

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  #getResolvedModel() {
    if (this.#model === "okhsv") {
      return this.#space === "srgb" ? "okhsv" : "hsv";
    }
    else if (this.#model === "okhsl") {
      return this.#space === "srgb" ? "okhsl" : "hsl";
    }
    else if (this.#model === "hsluv") {
      return this.#space === "srgb" ? "hsluv" : "hsl";
    }
    else {
      return this.#model;
    }
  }

  #getResolvedGamutHints() {
    if (
      (this.#gamutHints === "none") ||
      (this.#gamutHints === "srgb"    && ["srgb", "srgb-linear"].includes(this.#space)) ||
      (this.#gamutHints === "p3"      && ["srgb", "srgb-linear", "p3"].includes(this.#space)) ||
      (this.#gamutHints === "a98rgb"  && ["srgb", "srgb-linear", "a98rgb"].includes(this.#space)) ||
      (this.#gamutHints === "rec2020" && ["srgb", "srgb-linear", "a98rgb", "p3", "rec2020"].includes(this.#space)) ||
      (this.#gamutHints === "prophoto")
    ) {
      return "none";
    }
    else {
      return this.#gamutHints;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (origin === "self") {
      if (key === `${this.localName}:model`) {
        let model = (value || "hsv");

        if (model !== this.#model) {
          let [r, g, b] = this.value;
          this.#model = model;
          this.value = [r, g, b, this.#a];
        }
      }
      else if (key === "x-colorpicker:gamutHints") {
        let gamutHints = normalizeColorSpaceName(value || "srgb", "color.js");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
        }
      }
      else if (key === "x-colorpicker:labels") {
        let labels = (value === null ? false : value);

        if (labels !== this.#labels) {
          this.#labels = labels;
          this.#updateLabels();
        }
      }
    }
  }

  #onContextMenuClick(event) {
    let item = event.target.closest("x-menuitem");

    if (item) {
      if (item.parentElement === this["#color-model-menu"]) {
        let model = item.value;
        let [r, g, b] = this.value;

        this.#model = model;
        Xel.setConfig(`${this.localName}:model`, model);
        this.value = [r, g, b, this.#a];
      }
      else if (item.parentElement === this["#gamut-hints-menu"]) {
        if (item.value !== this.#gamutHints) {
          this.#gamutHints = item.value;
          this.#update();
          Xel.setConfig("x-colorpicker:gamutHints", normalizeColorSpaceName(this.#gamutHints, "css"));
        }
      }
      else if (item.value === "labels") {
        this.#labels = !item.toggled;
        Xel.setConfig("x-colorpicker:labels", this.#labels);
        this.#update();
      }
    }
  }

  #onContextMenuOpen() {
    this.#updateContextMenu();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onCoord0SliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#coord-0-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#coord-0-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[0]) {
        this.#coords[0] = coord;

        this.#updateCoord0SliderMarker();
        this.#updateCoord1SliderBackground();
        this.#updateCoord1SliderGamutPath();
        this.#updateCoord2SliderBackground();
        this.#updateCoord2SliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#coord-0-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#coord-0-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#coord-0-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#coord-0-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#coord-0-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#coord-0-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onCoord1SliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let model = this.#getResolvedModel();
    let trackBounds = this["#coord-1-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#coord-1-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[1]) {
        this.#coords[1] = coord;

        if (model === "rgb") {
          this.#updateCoord0SliderBackground();
        }

        this.#updateCoord0SliderGamutPath();
        this.#updateCoord1SliderMarker();
        this.#updateCoord1SliderBackground();
        this.#updateCoord2SliderBackground();
        this.#updateCoord2SliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#coord-1-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#coord-1-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#coord-1-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#coord-1-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#coord-1-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#coord-1-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onCoord2SliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let model = this.#getResolvedModel();
    let trackBounds = this["#coord-2-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#coord-2-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[2]) {
        this.#coords[2] = coord;

        if (model === "rgb") {
          this.#updateCoord0SliderBackground();
          this.#updateCoord1SliderBackground();
        }

        this.#updateCoord0SliderGamutPath();
        this.#updateCoord1SliderGamutPath();
        this.#updateCoord2SliderMarker();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#coord-2-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#coord-2-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#coord-2-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#coord-2-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#coord-2-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#coord-2-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onAlphaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#alpha-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let a = (clientX - trackBounds.x) / trackBounds.width;
      a = normalize(a, 0, 1);

      if (a !== this.#a) {
        this.#a = a;
        this.#updateAlphaSliderMarker();
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#alpha-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#alpha-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#alpha-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#alpha-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updateCoord0SliderMarker();
    this.#updateCoord0SliderBackground();
    this.#updateCoord0SliderGamutPath();

    this.#updateCoord1SliderMarker();
    this.#updateCoord1SliderBackground();
    this.#updateCoord1SliderGamutPath();

    this.#updateCoord2SliderMarker();
    this.#updateCoord2SliderBackground();
    this.#updateCoord2SliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updateCoord0SliderMarker() {
    this["#coord-0-slider-marker"].style.left = (this.#coords[0] * 100) + "%";
  }

  #updateCoord0SliderBackground() {
    let model = this.#getResolvedModel();

    if (model === "rgb") {
      let [ , g, b] = this.#coords;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.#space, coords: [0, g, b] },
        { space: this.#space, coords: [1, g, b] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-0-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.#space, coords: [1, 0, 0] },
        { space: this.#space, coords: [1, 1, 0] },
        { space: this.#space, coords: [0, 1, 0] },
        { space: this.#space, coords: [0, 1, 1] },
        { space: this.#space, coords: [0, 0, 1] },
        { space: this.#space, coords: [1, 0, 1] },
        { space: this.#space, coords: [1, 0, 0] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-0-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl") {
      let colors = [];

      for (let h = 0; h <= 360; h += 60) {
        colors.push({space: "okhsv", coords: [h, 1, 1]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-0-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }

    else if ( model === "hsluv") {
      let colors = [];

      for (let h = 0; h <= 360; h += 60) {
        colors.push({space: "okhsv", coords: [h, 1, 1]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-0-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  async #updateCoord0SliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#coord-0-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let model = this.#getResolvedModel();
        let width = this["#coord-0-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [, c1, c2] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let c0 = (column / width);
          let inGamut = false;

          if (model === "hsv" || model === "hsl" || model === "hwb") {
            let [r, g, b] = convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, "srgb").coords;
            let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
          }
          else if (model === "rgb") {
            let [x, y, z] = convertColor({space: this.#space, coords: [c0, c1, c2]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
          }

          if (inGamut) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(c0 * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#coord-0-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#coord-0-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateCoord1SliderMarker() {
    this["#coord-1-slider-marker"].style.left = (this.#coords[1] * 100) + "%";
  }

  #updateCoord1SliderBackground() {
    let model = this.#getResolvedModel();

    if (model === "rgb") {
      let [r, , b] = this.#coords;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.#space, coords: [r, 0, b] },
        { space: this.#space, coords: [r, 1, b] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let [h] = this.#coords;
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.space;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";
      let colors;

      if (model === "hsv") {
        colors = [
          { space: this.#space, coords: convertColor({space: "hsv", coords: [h*360,   0, 100]}, hSpace).coords },
          { space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, 100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hsl") {
        colors = [
          { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360,   0, 50]}, hSpace).coords },
          { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 100, 50]}, hSpace).coords }
        ];
      }
      else if (model === "hwb") {
        colors = [
          { space: this.#space, coords: convertColor({space: "hwb", coords: [h*360,   0,  0]}, hSpace).coords },
          { space: this.#space, coords: convertColor({space: "hwb", coords: [h*360, 100,  0]}, hSpace).coords }
        ];
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl") {
      let [h] = this.#coords;
      let colors = [];

      for (let s = 0; s <= 1; s += 0.01) {
        colors.push({space: model, coords: [h*360, s, model === "okhsv" ? 1 : 0.65]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }

    else if (model === "hsluv") {
      let [h] = this.#coords;
      let colors = [];

      for (let s = 0; s <= 100; s += 1) {
        colors.push({space: model, coords: [h*360, s, 65]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  async #updateCoord1SliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#coord-1-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let model = this.#getResolvedModel();
        let width = this["#coord-1-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [c0, , c2] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let c1 = (column / width);
          let inGamut = false;

          if (model === "hsv" || model === "hsl" || model === "hwb") {
            let [r, g, b] = convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, "srgb").coords;
            let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
          }
          else if (model === "rgb") {
            let [x, y, z] = convertColor({space: this.#space, coords: [c0, c1, c2]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
          }

          if (inGamut) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(c1 * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#coord-1-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#coord-1-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateCoord2SliderMarker() {
    this["#coord-2-slider-marker"].style.left = (this.#coords[2] * 100) + "%";
  }

  #updateCoord2SliderBackground() {
    let model = this.#getResolvedModel();

    if (model === "rgb") {
      let [r, g] = this.#coords;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.#space, coords: [r, g, 0] },
        { space: this.#space, coords: [r, g, 1] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";
      let colors = [];

      if (model === "hsv") {
        let [h, s] = this.#coords;

        colors = [
          { space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, s*100,   0]}, hSpace).coords },
          { space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, s*100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hsl") {
        let [h, s] = this.#coords;

        colors = [
          { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, s*100,   0]}, hSpace).coords },
          { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, s*100,  50]}, hSpace).coords },
          { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, s*100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hwb") {
        let [h, w] = this.#coords;

        for (let b = 0; b <= 100; b += 10) {
          colors.push({space: this.#space, coords: convertColor({space: "hwb", coords: [h*360, w*100, b]}, hSpace).coords});
        }
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl") {
      let [h, s] = this.#coords;
      let colors = [];

      for (let l = 0; l <= 1; l += 0.01) {
        colors.push({space: model, coords: [h*360, s, l]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }

    else if (model === "hsluv") {
      let [h, s] = this.#coords;
      let colors = [];

      for (let l = 0; l <= 100; l += 1) {
        colors.push({space: model, coords: [h*360, s*100, l]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  async #updateCoord2SliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#coord-2-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let model = this.#getResolvedModel();
        let width = this["#coord-2-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [c0, c1] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let inGamut = false;
          let c2 = (column / width);

          if (model === "hsv" || model === "hsl" || model === "hwb") {
            let [r, g, b] = convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, "srgb").coords;
            let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
          }
          else if (model === "rgb") {
            let [x, y, z] = convertColor({space: this.#space, coords: [c0, c1, c2]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
          }

          if (inGamut) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(c2 * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#coord-2-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#coord-2-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let model = this.#getResolvedModel();

    if (model === "rgb") {
      let [r, g, b] = this.#coords;

      let colors = [
        { space: this.#space, coords: [r, g, b], alpha: 0 },
        { space: this.#space, coords: [r, g, b], alpha: 1 }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(to right, ${colors})`;
    }
    else if (model === "okhsv" || model === "okhsl") {
      let [h, a, b] = this.#coords;
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;
      let colors = [];

      for (let alpha of [0, 1]) {
        colors.push({
          space: this.#space,
          coords: convertColor({space: model, coords: [h*360, a, b]}, hSpace).coords,
          alpha: alpha
        });
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(to right, ${colors})`;
    }
    else {
      let [h, a, b] = this.#coords;
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;
      let colors = [];

      for (let alpha of [0, 1]) {
        colors.push({
          space: this.#space,
          coords: convertColor({space: model, coords: [h*360, a*100, b*100]}, hSpace).coords,
          alpha: alpha
        });
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(to right, ${colors})`;
    }
  }

  async #updateGamutWarnings() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#coord-0-slider-marker"].removeAttribute("data-warn");
      this["#coord-1-slider-marker"].removeAttribute("data-warn");
      this["#coord-2-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let model = this.#getResolvedModel();
      let [c0, c1, c2] = this.#coords;
      let inGamut = false;

      if (model === "hsv" || model === "hsl" || model === "hwb") {
        let [r, g, b] = convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, "srgb").coords;
        let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
        inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
      }
      else if (model === "rgb") {
        let [x, y, z] = convertColor({space: this.#space, coords: [c0, c1, c2]}, "xyz-d65").coords;
        inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
      }

      if (inGamut) {
        this["#coord-0-slider-marker"].removeAttribute("data-warn");
        this["#coord-1-slider-marker"].removeAttribute("data-warn");
        this["#coord-2-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#coord-0-slider-marker"].setAttribute("data-warn", "");
        this["#coord-1-slider-marker"].setAttribute("data-warn", "");
        this["#coord-2-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    if (this.#labels) {
      let model = this.#getResolvedModel();

      if (model === "hsv" || model === "okhsv") {
        this["#coord-0-slider-label"].textContent = "H";
        this["#coord-1-slider-label"].textContent = "S";
        this["#coord-2-slider-label"].textContent = "V";
      }
      else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
        this["#coord-0-slider-label"].textContent = "H";
        this["#coord-1-slider-label"].textContent = "S";
        this["#coord-2-slider-label"].textContent = "L";
      }
      else if (model === "hwb") {
        this["#coord-0-slider-label"].textContent = "H";
        this["#coord-1-slider-label"].textContent = "W";
        this["#coord-2-slider-label"].textContent = "B";
      }
      else if (model === "rgb") {
        this["#coord-0-slider-label"].textContent = "R";
        this["#coord-1-slider-label"].textContent = "G";
        this["#coord-2-slider-label"].textContent = "B";
      }

      this["#alpha-slider-label"].textContent = "α";
    }
    else {
      this["#coord-0-slider-label"].textContent = "";
      this["#coord-1-slider-label"].textContent = "";
      this["#coord-2-slider-label"].textContent = "";
      this["#alpha-slider-label"].textContent = "";
    }
  }

  #updateContextMenu() {
    // Color model
    {
      let model = this.#getResolvedModel();

      for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
        item.toggled = (item.value === model);
        item.hidden = item.hasAttribute("data-srgb-only") && this.#space !== "srgb";
      }

      for (let separator of this["#color-model-menu"].querySelectorAll("hr")) {
        separator.hidden = (this.#space !== "srgb" && separator.nextElementSibling?.value !== "rgb");
      }
    }

    // Gamut hints
    {
      if (this.#ownerColorPicker.gamuts.length === 0) {
        this["#gamut-hints-menu-item"].hidden = true;
        this["#gamut-hints-menu"].innerHTML = "";
      }
      else {
        let gamutHintsMenuHTML = `
          <x-menuitem value="none"><x-label><x-message href="#gamut-hints.none">None</x-message></x-label></x-menuitem>
          <hr/>
        `;

        for (let id of this.#ownerColorPicker.gamuts) {
          gamutHintsMenuHTML += `
            <x-menuitem value="${id}"><x-label>${this.#ownerColorPicker.getGamutLabel(id)}</x-label></x-menuitem>
          `;
        }

        this["#gamut-hints-menu"].innerHTML = gamutHintsMenuHTML;
        this["#gamut-hints-menu-item"].hidden = false;
      }

      for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
        item.toggled = (item.value === this.#gamutHints);
      }
    }

    // Labels
    {
      this["#labels-menu-item"].toggled = this.#labels;
    }
  }
}

if (customElements.get("x-rgblinearsliders") === undefined) {
  customElements.define("x-rgblinearsliders", XRGBLinearSlidersElement);
}
