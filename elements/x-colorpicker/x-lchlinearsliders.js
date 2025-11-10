
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {serializeColor, normalizeColorSpaceName, isColorInGamut} from "../../utils/color.js";
import {normalize} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";

const MAX_LCH_CHROMA = 150;
const MAX_OKLCH_CHROMA = 0.4;

/**
 * Linear sliders for LCH-based color spaces (okLCH, CIE LCH).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XLCHLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="hue-slider" class="slider" part="slider">
        <div id="hue-slider-track" class="slider-track">
          <svg id="hue-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="hue-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="hue-slider-marker" class="slider-marker">
            <span id="hue-slider-label" class="slider-label">H</span>
          </div>
        </div>
      </div>

      <div id="chroma-slider" class="slider" part="slider">
        <div id="chroma-slider-track" class="slider-track">
          <svg id="chroma-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="chroma-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="chroma-slider-marker" class="slider-marker">
            <span id="chroma-slider-label" class="slider-label">C</span>
          </div>
        </div>
      </div>

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
            <x-label><x-message href="#gamut-hints" autocapitalize>Gamut Hints</x-message></x-label>
            <x-menu id="gamut-hints-menu">
              <x-menuitem value="none"><x-label><x-message href="#gamut-hints.none">None</x-message></x-label></x-menuitem>
              <hr/>
              <x-menuitem value="srgb" toggled><x-label>sRGB</x-label></x-menuitem>
              <x-menuitem value="a98rgb"><x-label>Adobe RGB</x-label></x-menuitem>
              <x-menuitem value="p3"><x-label>Display P3</x-label></x-menuitem>
              <x-menuitem value="rec2020"><x-label>Rec. 2020</x-label></x-menuitem>
              <x-menuitem value="prophoto"><x-label>ProPhoto RGB</x-label></x-menuitem>
            </x-menu>
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
   * @type {"lch" | "oklch"}
   * @default "lch"
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
  #configChangeListener;
  #isDraggingSlider = false;

  #space = "lch";        // Either "lch" or "oklch"
  #gamutHints = "srgb";  // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];   // LCH: [0-100, 0-150, 0-360], OK LCH: [0-1, 0-0.4, 0-360]
  #a = 1;                // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XLCHLinearSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XLCHLinearSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#hue-slider"].addEventListener("pointerdown", (event) => this.#onHueSliderPointerDown(event));
    this["#chroma-slider"].addEventListener("pointerdown", (event) => this.#onChromaSliderPointerDown(event));
    this["#lightness-slider"].addEventListener("pointerdown", (event) => this.#onLightnessSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
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

  #onHueSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#hue-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord * 360 !== this.#coords[2]) {
        this.#coords[2] = coord * 360;

        this.#updateHueSliderMarker();
        this.#updateChromaSliderBackground();
        this.#updateChromaSliderGamutPath();
        this.#updateLightnessSliderBackground();
        this.#updateLightnessSliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#hue-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#hue-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#hue-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#hue-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#hue-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onChromaSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#chroma-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#chroma-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);

      if (this.#space === "oklch") {
        coord = normalize(coord * MAX_OKLCH_CHROMA, 0, MAX_OKLCH_CHROMA);
      }
      else if (this.#space === "lch") {
        coord = normalize(coord * MAX_LCH_CHROMA, 0, MAX_LCH_CHROMA);
      }

      if (coord !== this.#coords[1]) {
        this.#coords[1] = coord;

        this.#updateHueSliderGamutPath();
        this.#updateChromaSliderMarker();
        this.#updateLightnessSliderBackground();
        this.#updateLightnessSliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#chroma-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#chroma-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#chroma-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#chroma-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#chroma-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#chroma-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

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

      if (this.#space === "oklch") {
        coord = normalize(coord, 0, 1);
      }
      else if (this.#space === "lch") {
        coord = normalize(coord * 100, 0, 100);
      }

      if (coord !== this.#coords[0]) {
        this.#coords[0] = coord;

        this.#updateHueSliderGamutPath();
        this.#updateChromaSliderGamutPath();
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
    this.#updateHueSliderMarker();
    this.#updateHueSliderBackground();
    this.#updateHueSliderGamutPath();

    this.#updateChromaSliderMarker();
    this.#updateChromaSliderBackground();
    this.#updateChromaSliderGamutPath();

    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();
    this.#updateLightnessSliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updateHueSliderMarker() {
    let [, , h] = this.#coords;
    this["#hue-slider-marker"].style.left = ((h/360) * 100) + "%";
  }

  #updateHueSliderBackground() {
    let colors = [];

    if (this.#space === "oklch") {
      for (let h = 0; h <= 360; h += 5) {
        colors.push({space: "oklch", coords: [0.8, MAX_OKLCH_CHROMA, h]});
      }
    }
    else if (this.#space === "lch") {
      for (let h = 0; h <= 360; h += 5) {
        colors.push({space: "lch", coords: [75, MAX_LCH_CHROMA, h]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#hue-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateHueSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#hue-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#hue-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [l, c] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let h = (column / width);
          let color = {space: this.#space, coords: [l, c, h*360]};

          if (isColorInGamut(color, this.#gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(h * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#hue-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#hue-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateChromaSliderMarker() {
    let [, c] = this.#coords;

    if (this.#space === "oklch") {
      // Maximum chroma value is theoretically unbounded, but the slider can show values only up to MAX_OKLCH_CHROMA
      if (c > MAX_OKLCH_CHROMA) {
        this["#chroma-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#chroma-slider-marker"].style.left = ((c / MAX_OKLCH_CHROMA) * 100) + "%";
      }
    }
    else if (this.#space === "lch") {
      // Maximum chroma value is theoretically unbounded, but the slider can show values only up to MAX_LCH_CHROMA
      if (c > MAX_LCH_CHROMA) {
        this["#chroma-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#chroma-slider-marker"].style.left = ((c / MAX_LCH_CHROMA) * 100) + "%";
      }
    }
  }

  #updateChromaSliderBackground() {
    let [, , h] = this.#coords;
    let colors = [];

    if (this.#space === "oklch") {
      for (let c = 0; c <= MAX_OKLCH_CHROMA; c += 0.03) {
        colors.push({space: "oklch", coords: [0.75, c, h]});
      }
    }
    else if (this.#space === "lch") {
      for (let c = 0; c <= MAX_LCH_CHROMA; c += 10) {
        colors.push({space: "lch", coords: [75, c, h]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#chroma-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateChromaSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#chroma-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#chroma-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [l, , h] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let c = (column / width);
          let maxChroma = (this.#space === "lch") ? MAX_LCH_CHROMA : MAX_OKLCH_CHROMA;
          let color = {space: this.#space, coords: [l, c * maxChroma, h]};

          if (isColorInGamut(color, this.#gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(c * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#chroma-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#chroma-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateLightnessSliderMarker() {
    let [l] = this.#coords;

    if (this.#space === "oklch") {
      this["#lightness-slider-marker"].style.left = (l * 100) + "%";
    }
    else if (this.#space === "lch") {
      this["#lightness-slider-marker"].style.left = l + "%";
    }
  }

  #updateLightnessSliderBackground() {
    let [, c, h] = this.#coords;
    let colors = [];

    if (this.#space === "oklch") {
      for (let l = 0; l <= 1; l += 0.02) {
        colors.push({space: "oklch", coords: [l, c, h]});
      }
    }
    else if (this.#space === "lch") {
      for (let l = 0; l <= 100; l += 2) {
        colors.push({space: "lch", coords: [l, c, h]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#lightness-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateLightnessSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#lightness-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#lightness-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [, c, h] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let l = (column / width);

          let color = {
            space: this.#space,
            coords: [this.#space === "oklch" ? l : l*100, c, h]
          };

          if (isColorInGamut(color, this.#gamutHints)) {
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

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let [l, c, h] = this.#coords;

    let colors = [
      {space: this.#space, coords: [l, c, h], alpha: 0},
      {space: this.#space, coords: [l, c, h], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateGamutWarnings() {
    if (this.#gamutHints === "none") {
      this["#hue-slider-marker"].removeAttribute("data-warn");
      this["#chroma-slider-marker"].removeAttribute("data-warn");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let color = {space: this.#space, coords: this.#coords};

      if (isColorInGamut(color, this.#gamutHints)) {
        this["#hue-slider-marker"].removeAttribute("data-warn");
        this["#chroma-slider-marker"].removeAttribute("data-warn");
        this["#lightness-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#hue-slider-marker"].setAttribute("data-warn", "");
        this["#chroma-slider-marker"].setAttribute("data-warn", "");
        this["#lightness-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    this["#hue-slider-label"].hidden = !this.#labels;
    this["#chroma-slider-label"].hidden = !this.#labels;
    this["#lightness-slider-label"].hidden = !this.#labels;
    this["#alpha-slider-label"].hidden = !this.#labels;
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
  }
}

if (customElements.get("x-lchlinearsliders") === undefined) {
  customElements.define("x-lchlinearsliders", XLCHLinearSlidersElement);
}
