
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {convertColor, serializeColor, normalizeColorSpaceName} from "../../utils/color.js";
import {closest} from "../../utils/element.js";
import {degToRad, normalize, rotatePoint} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";
import {throttle} from "../../utils/time.js";

/**
 * Polar sliders for RGB-based color spaces (sRBG, Linear sRGB, Adobe RGB, Display P3, Rec. 2020, ProPhoto RGB).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XRGBPolarSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="polar-slider" part="slider">
        <div id="polar-slider-circle">
          <canvas id="polar-slider-canvas" width="100" height="100"></canvas>

          <svg id="polar-slider-gamut-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path id="polar-slider-gamut-path"></path>
          </svg>

          <div id="polar-slider-marker"></div>
        </div>
      </div>

      <div id="linear-slider" part="slider">
        <div id="linear-slider-track">
          <div id="linear-slider-marker">
            <span id="linear-slider-label"></span>
          </div>

          <svg id="linear-slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="linear-slider-gamut-path"></path>
          </svg>
        </div>
      </div>

      <div id="alpha-slider" part="slider">
        <div id="alpha-slider-gradient"></div>

        <div id="alpha-slider-track">
          <div id="alpha-slider-marker">
            <span id="alpha-slider-label">H</span>
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
     * Polar slider
     */

    #polar-slider {
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 200px;
      height: 200px;
      margin: 0 auto;
    }

    #polar-slider-circle {
      touch-action: pinch-zoom;
      position: relative;
      width: 100%;
      height: fit-content;
      aspect-ratio: 1 / 1;
      border-radius: 999px !important;
    }

    #polar-slider-marker {
      position: absolute;
      top: 0%;
      left: 0%;
      width: var(--marker-size);
      height: var(--marker-size);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      transform: translate(calc(var(--marker-size) / -2), calc(var(--marker-size) / -2));
      background: rgba(0, 0, 0, 0.3);
      border: 3px solid white;
      border-radius: 999px;
      box-shadow: 0 0 3px black;
      --marker-size: 20px;
    }
    #polar-slider-marker[data-warn]::after {
      content: "⚠";
      position: absolute;
      top: -30px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.125rem;
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
    }

    #polar-slider-canvas {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 9999px;
    }

    #polar-slider-gamut-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    #polar-slider-gamut-path {
      fill: none;
      stroke: white;
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 2px;
      opacity: 0.8;
    }

    /**
     * Linear slider
     */

    #linear-slider {
      width: 100%;
      height: 35px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      touch-action: pinch-zoom;
    }

    #linear-slider-track {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
    }

    #linear-slider-marker {
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
    #linear-slider-marker[data-warn]::after {
      content: "⚠";
      position: absolute;
      right: -26px;
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 1.125rem;
    }

    #linear-slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    #linear-slider-gamut-path {
      fill: none;
      stroke: white;
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 2px;
      opacity: 0.8;
    }

    #linear-slider-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.625rem;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      display: none;
      width: 100%;
      height: 35px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      position: relative;
      box-sizing: border-box;
      touch-action: pinch-zoom;
      background: var(--checkboard-background);
    }
    :host([alpha]) #alpha-slider {
      display: block;
    }

    #alpha-slider-track {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
    }

    #alpha-slider-marker {
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

    #alpha-slider-gradient {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }

    #alpha-slider-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.625rem;
    }
  `;

  /**
   * @type {[number, number, number, number]}
   */
  get value() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, c1, c2] = this.#coords;
      let [r, g, b] = convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    else {
      return [0, 0, 0, 0];
    }
  }
  set value([r, g, b, a]) {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, c1, c2] = convertColor({space: "srgb", coords: [r, g, b]}, this.#model).coords;
      this.#coords = [h/360, c1/100, c2/100];
      this.#a = a;
    }

    // Convert missing components to 0
    // @see https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < this.#coords.length; i += 1) {
      if (this.#coords[i] === null) {
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
  #resizeObserver = new ResizeObserver(() => this.#onResize());
  #isDraggingSlider = false;

  #space = "srgb";        // Either "srgb", "srgb-linear", "a98rgb", "p3", "rec2020" or "prophoto"
  #model = "hsv";         // Either "hsv" or "hsl"
  #gamutHints = "srgb";   // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];    // Values in the current MODEL coordinate system normalized to 0.00 - 1.00 range
  #a = 1;                 // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XRGBPolarSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XRGBPolarSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#polar-slider"].addEventListener("pointerdown", (event) => this.#onPolarSliderPointerDown(event));
    this["#linear-slider"].addEventListener("pointerdown", (event) => this.#onLinearSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
    this.#ownerColorPicker = closest(this, "x-colorpicker");
    this.#model = Xel.getConfig(`${this.localName}:model`, "hsv");
    this.#gamutHints = normalizeColorSpaceName(Xel.getConfig("x-colorpicker:gamutHints", "srgb"), "color.js");
    this.#labels = Xel.getConfig("x-colorpicker:labels", true);

    this.#resizeObserver.observe(this);
    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    this.#resizeObserver.unobserve(this);
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  #getResolvedGamutHints() {
    if (
      (this.#gamutHints === "none") ||
      (this.#gamutHints === "srgb" && ["srgb", "srgb-linear"].includes(this.#space)) ||
      (this.#gamutHints === "p3" && ["srgb", "srgb-linear", "p3"].includes(this.#space)) ||
      (this.#gamutHints === "a98rgb" && ["srgb", "srgb-linear", "a98rgb"].includes(this.#space)) ||
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
      if (item.parentElement === this["#gamut-hints-menu"]) {
        if (item.value !== this.#gamutHints) {
          this.#gamutHints = item.value;
          this.#update();
          Xel.setConfig("x-colorpicker:gamutHints", normalizeColorSpaceName(this.#gamutHints, "css"));
        }
      }
      else if (item.parentElement === this["#color-model-menu"]) {
        if (item.value !== this.#model) {
          let [r, g, b] = this.value;
          this.#model = item.value;
          this.value = [r, g, b, this.#a];
          Xel.setConfig(`${this.localName}:model`, item.value);
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

  #onResize() {
    this.#updatePolarSliderGamutPathThrottled();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onPolarSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let pointerMoveListener, pointerUpOrCancelListener;
    let wheelBounds = this["#polar-slider"].getBoundingClientRect();

    this.#isDraggingSlider = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    this["#polar-slider"].style.cursor = "default";
    this["#polar-slider"].setPointerCapture(pointerDownEvent.pointerId);

    let onPointerMove = (clientX, clientY) => {
      let radius = wheelBounds.width / 2;
      let x = clientX - wheelBounds.left - radius;
      let y = clientY - wheelBounds.top - radius;
      let d = Math.pow(x, 2) + Math.pow(y, 2);
      let theta = Math.atan2(y, x);

      if (d > Math.pow(radius, 2)) {
        x = radius * Math.cos(theta);
        y = radius * Math.sin(theta);
        d = Math.pow(x, 2) + Math.pow(y, 2);
        theta = Math.atan2(y, x);
      }

      this.#coords[0] = (theta + Math.PI) / (Math.PI * 2);

      if (this.#model === "hsv" || this.#model === "hsl") {
        this.#coords[1] = Math.sqrt(d) / radius;
      }

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePolarSliderMarker();
      this.#updateLinearSliderBackground();
      this.#updateLinearSliderGamutPath();
      this.#updateAlphaSliderBackground();
      this.#updateGamutWarnings();
    };

    onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

    this["#polar-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
      }
    });

    this["#polar-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#polar-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#polar-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#polar-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this["#polar-slider"].style.cursor = null;

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this.#isDraggingSlider = false;
    });

    this["#polar-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onLinearSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#linear-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#linear-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[2]) {
        this.#coords[2] = coord;

        this.#updateLinearSliderMarker();
        this.#updatePolarSliderGamutPathThrottled();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#linear-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#linear-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#linear-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#linear-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#linear-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#linear-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
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
    this.#updatePolarSliderMarker();
    this.#updatePolarSliderBackground();
    this.#updatePolarSliderGamutPath();

    this.#updateLinearSliderMarker();
    this.#updateLinearSliderBackground();
    this.#updateLinearSliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updatePolarSliderMarker() {
    let [h, c1] = this.#coords;

    if (this.#model === "hsv" || this.#model === "hsl") {
      let wheelSize = 100;
      let angle = degToRad(h*360);
      let radius = c1 * wheelSize/2;
      let centerPoint = {x: wheelSize/2, y: wheelSize/2};

      let x = ((wheelSize - (centerPoint.x + (radius * Math.cos(angle)))) / wheelSize) * 100;
      let y = ((centerPoint.y - (radius * Math.sin(angle))) / wheelSize) * 100;

      this["#polar-slider-marker"].style.left = x + "%";
      this["#polar-slider-marker"].style.top = y + "%";
    }
  }

  #updatePolarSliderBackground() {
    let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";
    let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;

    if (this.#model === "hsv") {
      let overlayColors = [
        { space: this.#space, coords: convertColor({space: "hsv", coords: [0, 0, 100]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsv", coords: [0, 0,   0]}, hSpace).coords },
      ];

      let backgroundColors = [
        { space: this.#space, coords: [1, 0, 0] },
        { space: this.#space, coords: [1, 1, 0] },
        { space: this.#space, coords: [0, 1, 0] },
        { space: this.#space, coords: [0, 1, 1] },
        { space: this.#space, coords: [0, 0, 1] },
        { space: this.#space, coords: [1, 0, 1] },
        { space: this.#space, coords: [1, 0, 0] }
      ];

      overlayColors = overlayColors.map(c => serializeColor(c)).join(",");
      backgroundColors = backgroundColors.map(c => serializeColor(c)).join(",");

      this["#polar-slider-circle"].style.background = `
        radial-gradient(circle closest-side in ${interpolation}, ${overlayColors} 100%),
        conic-gradient(from -90deg in hsl, ${backgroundColors})
      `;

      this["#polar-slider-circle"].style.backgroundBlendMode = "screen, normal";
    }
    else if (this.#model === "hsl") {
      let overlayColors = [
        { space: this.#space, coords: convertColor({space: "hsl", coords: [0, 0, 50]}, hSpace).coords, alpha: 1 },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [0, 0, 50]}, hSpace).coords, alpha: 0 },
      ];

      let backgroundColors = [
        { space: this.#space, coords: [1, 0, 0] },
        { space: this.#space, coords: [1, 1, 0] },
        { space: this.#space, coords: [0, 1, 0] },
        { space: this.#space, coords: [0, 1, 1] },
        { space: this.#space, coords: [0, 0, 1] },
        { space: this.#space, coords: [1, 0, 1] },
        { space: this.#space, coords: [1, 0, 0] }
      ];

      overlayColors = overlayColors.map(c => serializeColor(c)).join(",");
      backgroundColors = backgroundColors.map(c => serializeColor(c)).join(",");

      this["#polar-slider-circle"].style.background = `
        radial-gradient(circle closest-side in ${interpolation}, ${overlayColors}),
        conic-gradient(from -90deg in hsl, ${backgroundColors})
      `;

      this["#polar-slider-circle"].style.backgroundBlendMode = "normal, normal";
    }
  }

  async #updatePolarSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#polar-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let width = this["#polar-slider-gamut-svg"].clientWidth;
      let height = this["#polar-slider-gamut-svg"].clientHeight;
      let step = 1 / window.devicePixelRatio;
      let [, , c2] = this.#coords;

      let points = [];

      if (this.#model === "hsv" || this.#model === "hsl") {
        for (let h = 0; h <= 1; h += 0.01) {
          for (let row = height/2; row >= 0; row -= step) {
            let c1 = row / (height/2);
            let [r, g, b] = convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords;
            let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
            let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);

            if (inGamut) {
              let point = rotatePoint({x: width/2, y: (height/2) - row}, {x: width/2, y: height/2}, h*360);
              points.push(point);
              break;
            }
          }
        }
      }

      if (points.length === 0) {
        this["#polar-slider-gamut-path"].removeAttribute("d");
      }
      else {
        let d = points.map(({x, y}, i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") + " Z";
        this["#polar-slider-gamut-path"].setAttribute("d", d);
        this["#polar-slider-gamut-svg"].setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
    }
  }

  #updatePolarSliderGamutPathThrottled = throttle(this.#updatePolarSliderGamutPath, 40, this);

  #updateLinearSliderMarker() {
    let [, , coord2] = this.#coords;

    if (this.#model === "hsv" || this.#model === "hsl") {
      this["#linear-slider-marker"].style.left = (coord2 * 100) + "%";
    }
  }

  #updateLinearSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s] = this.#coords;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;

      let colors = [
        { space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, s*100,   0]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, s*100, 100]}, hSpace).coords }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#linear-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }
    else if (this.#model === "hsl") {
      let [h, s] = this.#coords;
      let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;

      let colors = [
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, s*100,   0]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, s*100,  50]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, s*100, 100]}, hSpace).coords }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#linear-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }
  }

  async #updateLinearSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#linear-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let [h, c1] = this.#coords;
      let width = this["#linear-slider"].clientWidth;
      let step = 1 / window.devicePixelRatio;

      let ranges = [];

      // Determine ranges
      {
        let range = null;

        for (let column = 0; column <= width; column += step) {
          if (this.#model === "hsv" || this.#model === "hsl") {
            let c2 = (column / width);
            let [r, g, b] = convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords;
            let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
            let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);

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
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#linear-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#linear-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [c0, c1, c2] = this.#coords;
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;

      let colors = [
        {
          space: this.#space,
          coords: convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, hSpace).coords,
          alpha: 0
        },
        {
          space: this.#space,
          coords: convertColor({space:this.#model, coords: [c0*360, c1*100, c2*100]}, hSpace).coords,
          alpha: 1
        }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  async #updateGamutWarnings() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#polar-slider-marker"].removeAttribute("data-warn");
      this["#linear-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let [c0, c1, c2] = this.#coords;
      let [r, g, b] = convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, "srgb").coords;
      let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
      let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);

      if (inGamut) {
        this["#polar-slider-marker"].removeAttribute("data-warn");
        this["#linear-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#polar-slider-marker"].setAttribute("data-warn", "");
        this["#linear-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    if (this.#labels) {
      if (this.#model === "hsv") {
        this["#linear-slider-label"].textContent = "V";
      }
      else if (this.#model === "hsl") {
        this["#linear-slider-label"].textContent = "L";
      }

      this["#alpha-slider-label"].textContent = "A";
    }
    else {
      this["#linear-slider-label"].textContent = "";
      this["#alpha-slider-label"].textContent = "";
    }
  }

  #updateContextMenu() {
    // Color model
    {
      for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
        item.toggled = (item.value === this.#model);
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

if (customElements.get("x-rgbpolarsliders") === undefined) {
  customElements.define("x-rgbpolarsliders", XRGBPolarSlidersElement);
}