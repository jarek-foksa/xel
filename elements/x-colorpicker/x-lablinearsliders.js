
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
 * Linear sliders for LAB-based color spaces (CIE LAB, OK LAB).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XLABLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="lightness-slider" class="slider" part="slider">
        <div id="lightness-slider-track" class="slider-track">
          <svg id="lightness-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="lightness-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="lightness-slider-marker" class="slider-marker">
            <span id="lightness-slider-label" class="slider-label">L</span>
          </div>
        </div>
      </div>

      <div id="a-slider" class="slider" part="slider">
        <div id="a-slider-track" class="slider-track">
          <svg id="a-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="a-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="a-slider-marker" class="slider-marker">
            <span id="a-slider-label" class="slider-label">A</span>
          </div>
        </div>
      </div>

      <div id="b-slider" class="slider" part="slider">
        <div id="b-slider-track" class="slider-track">
          <svg id="b-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="b-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="b-slider-marker" class="slider-marker">
            <span id="b-slider-label" class="slider-label">B</span>
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
    let [l, c, h] = this.#coords;
    return [l, c, h, this.#a];
  }
  set value([l, c, h, a]) {
    this.#coords = [l, c, h];
    this.#a = a;

    this.#update();
  }

  /**
   * @type {"lab" | "oklab"}
   * @default "lab"
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

  #space = "lab";        // Either "lab" or "oklab"
  #gamutHints = "srgb";  // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];   // LAB: [0-100, -125-125, -125-125], OK LAB: [0-1, -0.4-0.4, -0.4-0.4]
  #a = 1;                // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XLABLinearSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XLABLinearSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#lightness-slider"].addEventListener("pointerdown", (event) => this.#onLightnessSliderPointerDown(event));
    this["#a-slider"].addEventListener("pointerdown", (event) => this.#onASliderPointerDown(event));
    this["#b-slider"].addEventListener("pointerdown", (event) => this.#onBSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
    this.#ownerColorPicker = closest(this, "x-colorpicker");
    this.#gamutHints = normalizeColorSpaceName(Xel.getConfig("x-colorpicker:gamutHints", "srgb"), "color.js");
    this.#labels = Xel.getConfig("x-colorpicker:labels", true);

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (origin === "self") {
      if (key === "x-colorpicker:gamutHints") {
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

  #onLightnessSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#lightness-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#lightness-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);

      if (this.#space === "oklab") {
        coord = normalize(coord, 0, 1);
      }
      else if (this.#space === "lab") {
        coord = normalize(coord * 100, 0, 100);
      }

      if (coord !== this.#coords[0]) {
        this.#coords[0] = coord;

        this.#updateASliderBackground();
        this.#updateASliderGamutPath();
        this.#updateBSliderBackground();
        this.#updateBSliderGamutPath();
        this.#updateLightnessSliderMarker();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#lightness-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#lightness-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#lightness-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#lightness-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#lightness-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#lightness-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onASliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#a-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#a-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (this.#space === "oklab") {
        coord = (coord * 0.8) - 0.4;
      }
      else if (this.#space === "lab") {
        coord = (coord * 250) - 125;
      }

      if (coord !== this.#coords[1]) {
        this.#coords[1] = coord;

        this.#updateLightnessSliderBackground();
        this.#updateLightnessSliderGamutPath();
        this.#updateASliderMarker();
        this.#updateBSliderBackground();
        this.#updateBSliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#a-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#a-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#a-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#a-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#a-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#a-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onBSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#b-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#b-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (this.#space === "oklab") {
        coord = (coord * 0.8) - 0.4;
      }
      else if (this.#space === "lab") {
        coord = (coord * 250) - 125;
      }

      if (coord !== this.#coords[2]) {
        this.#coords[2] = coord;

        this.#updateLightnessSliderBackground();
        this.#updateLightnessSliderGamutPath();
        this.#updateASliderBackground();
        this.#updateASliderGamutPath();
        this.#updateBSliderMarker();
        this.#updateBSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#b-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#b-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#b-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#b-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#b-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#b-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
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
    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();
    this.#updateLightnessSliderGamutPath();

    this.#updateASliderMarker();
    this.#updateASliderBackground();
    this.#updateASliderGamutPath();

    this.#updateBSliderMarker();
    this.#updateBSliderBackground();
    this.#updateBSliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updateLightnessSliderMarker() {
    let [l] = this.#coords;

    if (this.#space === "oklab") {
      this["#lightness-slider-marker"].style.left = (l * 100) + "%";
    }
    else if (this.#space === "lab") {
      this["#lightness-slider-marker"].style.left = l + "%";
    }
  }

  #updateLightnessSliderBackground() {
    let colors = [];
    let [, a, b] = this.#coords;

    if (this.#space === "oklab") {
      for (let l = 0; l <= 1; l += 0.02) {
        colors.push({space: "oklab", coords: [l, a, b]});
      }
    }
    else if (this.#space === "lab") {
      for (let l = 0; l <= 100; l += 2) {
        colors.push({space: "lab", coords: [l, a, b]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#lightness-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  async #updateLightnessSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#lightness-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#lightness-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [, a, b] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let l = (column / width);
          let inGamut = false;

          if (this.#space === "lab") {
            let [x, y, z] = convertColor({space: this.#space, coords: [l*100, a, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);
          }
          else if (this.#space === "oklab") {
            let [x, y, z] = convertColor({space: this.#space, coords: [l, a, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);
          }

          if (inGamut) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(l * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#lightness-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#lightness-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateASliderMarker() {
    let [, a] = this.#coords;

    if (this.#space === "oklab") {
      // Maximum "a" value is theoretically unbounded, but the slider can show values only in [-0.4, 0.4] range
      if (a < -0.4) {
        this["#a-slider-marker"].style.left = "calc(0% - 18px)";
      }
      else if (a > 0.4) {
        this["#a-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#a-slider-marker"].style.left = (((a + 0.4) / 0.8) * 100) + "%";
      }
    }
    else if (this.#space === "lab") {
      // Maximum "a" value is theoretically unbounded, but the slider can show values only in [-125, 125] range
      if (a < -125) {
        this["#a-slider-marker"].style.left = "calc(0% - 18px)";
      }
      else if (a > 125) {
        this["#a-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#a-slider-marker"].style.left = (((a + 125) / 250) * 100) + "%";
      }
    }
  }

  #updateASliderBackground() {
    let [l, , b] = this.#coords;
    let colors = [];

    if (this.#space === "oklab") {
      for (let a = -0.4; a <= 0.4; a += 0.05) {
        colors.push({space: "oklab", coords: [l, a, b]});
      }
    }
    else if (this.#space === "lab") {
      for (let a = -125; a <= 125; a += 5) {
        colors.push({space: "lab", coords: [l, a, b]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#a-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  async #updateASliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#a-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#a-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [l, , b] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let a = (column / width);
          let inGamut = false;

          if (this.#space === "lab") {
            let [x, y, z] = convertColor({space: this.#space, coords: [l, (a * 250) - 125, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);
          }
          else if (this.#space === "oklab") {
            let [x, y, z] = convertColor({space: this.#space, coords: [l, (a * 0.8) - 0.4, b]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);
          }

          if (inGamut) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(a * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#a-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#a-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateBSliderMarker() {
    let [, , b] = this.#coords;

    if (this.#space === "oklab") {
      // Maximum "b" value is theoretically unbounded, but the slider can show values only in [-0.4, 0.4] range
      if (b < -0.4) {
        this["#b-slider-marker"].style.left = "calc(0% - 18px)";
      }
      else if (b > 0.4) {
        this["#b-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#b-slider-marker"].style.left = (((b + 0.4) / 0.8) * 100) + "%";
      }
    }
    else if (this.#space === "lab") {
      // Maximum "b" value is theoretically unbounded, but the slider can show values only in [-125, 125] range
      if (b < -125) {
        this["#b-slider-marker"].style.left = "calc(0% - 18px)";
      }
      else if (b > 125) {
        this["#b-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#b-slider-marker"].style.left = (((b + 125) / 250) * 100) + "%";
      }
    }
  }

  #updateBSliderBackground() {
    let [l, a] = this.#coords;
    let colors = [];

    if (this.#space === "oklab") {
      for (let b = -0.4; b <= 0.4; b += 0.05) {
        colors.push({space: "oklab", coords: [l, a, b]});
      }
    }
    else if (this.#space === "lab") {
      for (let b = -125; b <= 125; b += 5) {
        colors.push({space: "lab", coords: [l, a, b]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#b-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  async #updateBSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#b-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#b-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [l, a] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let b = (column / width);
          let inGamut = false;

          if (this.#space === "lab") {
            let [x, y, z] = convertColor({space: this.#space, coords: [l, a, (b * 250) - 125]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);
          }
          else if (this.#space === "oklab") {
            let [x, y, z] = convertColor({space: this.#space, coords: [l, a, (b * 0.8) - 0.4]}, "xyz-d65").coords;
            inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);
          }

          if (inGamut) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(b * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#b-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#b-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let [l, a, b] = this.#coords;

    let colors = [
      {space: this.#space, coords: [l, a, b], alpha: 0},
      {space: this.#space, coords: [l, a, b], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  async #updateGamutWarnings() {
    if (this.#gamutHints === "none") {
      this["#a-slider-marker"].removeAttribute("data-warn");
      this["#b-slider-marker"].removeAttribute("data-warn");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let [x, y, z] = convertColor({space: this.#space, coords: this.#coords}, "xyz-d65").coords;
      let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);

      if (inGamut) {
        this["#a-slider-marker"].removeAttribute("data-warn");
        this["#b-slider-marker"].removeAttribute("data-warn");
        this["#lightness-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#a-slider-marker"].setAttribute("data-warn", "");
        this["#b-slider-marker"].setAttribute("data-warn", "");
        this["#lightness-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    this["#a-slider-label"].hidden = !this.#labels;
    this["#b-slider-label"].hidden = !this.#labels;
    this["#lightness-slider-label"].hidden = !this.#labels;
    this["#alpha-slider-label"].hidden = !this.#labels;
  }

  #updateContextMenu() {
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

if (customElements.get("x-lablinearsliders") === undefined) {
  customElements.define("x-lablinearsliders", XLABLinearSlidersElement);
}
