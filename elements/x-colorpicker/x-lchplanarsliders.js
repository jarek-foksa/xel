
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {serializeColor, normalizeColorSpaceName, isColorInGamut} from "../../utils/color.js";
import {normalize} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";
import {throttle} from "../../utils/time.js";

const MAX_LCH_CHROMA = 150;
const MAX_OKLCH_CHROMA = 0.4;

/**
 * Planar sliders for LCH-based color spaces (CIE LCH, OK LCH).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XLCHPlanarSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="hue-slider" part="slider">
        <div id="hue-slider-track">
          <svg id="hue-slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="hue-slider-gamut-path"></path>
          </svg>

          <div id="hue-slider-marker">
            <span id="hue-slider-label">H</span>
          </div>
        </div>
      </div>

      <div id="planar-slider" part="slider">
        <canvas id="planar-slider-canvas" width="100" height="100"></canvas>

        <svg id="planar-slider-gamut-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path id="planar-slider-gamut-path"></path>
        </svg>

        <div id="planar-slider-marker"></div>
      </div>

      <div id="alpha-slider" part="slider">
        <div id="alpha-slider-gradient"></div>

        <div id="alpha-slider-track">
          <div id="alpha-slider-marker">
            <span id="alpha-slider-label">α</span>
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
     * Hue slider
     */

    #hue-slider {
      width: 100%;
      height: 35px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      touch-action: pinch-zoom;
    }

    #hue-slider-track {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
    }

    #hue-slider-marker {
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
    #hue-slider-marker[data-warn]::after {
      content: "⚠";
      position: absolute;
      right: -26px;
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 1.125rem;
    }

    #hue-slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    #hue-slider-gamut-path {
      fill: none;
      stroke: white;
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 2px;
      opacity: 0.8;
    }

    #hue-slider-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.625rem;
    }

    /**
     * Planar slider
     */

    #planar-slider {
      width: 100%;
      height: 200px;
      margin-top: 10px;
      position: relative;
      touch-action: pinch-zoom;
    }

    #planar-slider-marker {
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
    #planar-slider-marker[data-warn]::after {
      content: "⚠";
      position: absolute;
      top: -30px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.125rem;
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
    }

    #planar-slider-canvas {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: inherit;
    }

    #planar-slider-gamut-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    #planar-slider-gamut-path {
      fill: none;
      stroke: white;
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 2px;
      opacity: 0.8;
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
  #resizeObserver = new ResizeObserver(() => this.#onResize());
  #isDraggingSlider = false;

  #space = "lch";         // Either "lch" or "oklch"
  #gamutHints = "srgb";   // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];    // LCH: [0-100, 0-150, 0-360], OK LCH: [0.0-1.0, 0.0-0.4, 0-360]
  #a = 1;                 // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XLCHPlanarSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XLCHPlanarSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#hue-slider"].addEventListener("pointerdown", (event) => this.#onHueSliderPointerDown(event));
    this["#planar-slider"].addEventListener("pointerdown", (event) => this.#onPlanarSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
    this.#gamutHints = normalizeColorSpaceName(Xel.getConfig("x-colorpicker:gamutHints", "srgb"), "color.js");
    this.#labels = Xel.getConfig("x-colorpicker:labels", true);

    this.#resizeObserver.observe(this);
    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    this.#resizeObserver.unobserve(this);
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

  #onResize() {
    this.#updatePlanarSliderGamutPathThrottled();
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
    this["#planar-slider-gamut-path"].style.transition = "d 60ms ease";
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord * 360 !== this.#coords[2]) {
        this.#coords[2] = coord * 360;

        this.#updateHueSliderMarker();
        this.#updateHueSliderGamutPath();
        this.#updatePlanarSliderMarker();
        this.#updatePlanarSliderBackground();
        this.#updatePlanarSliderGamutPathThrottled();
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
      this["#planar-slider-gamut-path"].style.transition = "none";
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#hue-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onPlanarSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let sliderBounds = this["#planar-slider"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
    this["#planar-slider"].setPointerCapture(pointerDownEvent.pointerId);

    let onPointerMove = (clientX, clientY) => {
      let x = (clientX - sliderBounds.left) / sliderBounds.width;
      let y = (clientY - sliderBounds.top) / sliderBounds.height;

      x = normalize(x, 0, 1);
      y = normalize(y, 0, 1);

      let [l, c, h] = this.#coords;

      if (this.#space === "lch") {
        l = x * 100;
        c = (1 - y) * MAX_LCH_CHROMA;
      }
      else if (this.#space === "oklch") {
        l = x;
        c = (1 - y) * MAX_OKLCH_CHROMA;
      }

      this.#coords = [l, c, h];

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updateHueSliderGamutPath();
      this.#updatePlanarSliderMarker();
      this.#updateAlphaSliderBackground();
      this.#updateGamutWarnings();
    };

    onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

    this["#planar-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
      }
    });

    this["#planar-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#planar-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#planar-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#planar-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      this.#isDraggingSlider = false;
    });

    this["#planar-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
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

    this.#updatePlanarSliderMarker();
    this.#updatePlanarSliderBackground();
    this.#updatePlanarSliderGamutPath();

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
    let gamutHints = this.#gamutHints;

    if (gamutHints === "none") {
      this["#hue-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let [l, c] = this.#coords;
      let width = this["#hue-slider"].clientWidth;
      let step = 1 / window.devicePixelRatio;

      let ranges = [];

      // Determine ranges
      {
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let h = (column / width);
          let color;

          if (this.#space === "lch") {
            color = {space: "lch", coords: [l, c, h*360]};
          }
          else if (this.#space === "oklch") {
            color = {space: "oklch", coords: [l, c, h*360]};
          }

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

  #updatePlanarSliderMarker() {
    if (this.#space === "lch") {
      let [l, c] = this.#coords;
      let left = l;
      let top = 100 - ((c / MAX_LCH_CHROMA) * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
    else if (this.#space === "oklch") {
      let [l, c] = this.#coords;
      let left = l * 100;
      let top = 100 - ((c / MAX_OKLCH_CHROMA) * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
  }

  #updatePlanarSliderBackground() {
    let canvas = this["#planar-slider-canvas"];
    let context = canvas.getContext("2d", {colorSpace: "display-p3"});
    let {width, height} = canvas;
    let step = 1;
    let [, , h] = this.#coords;

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let col = 0; col <= width; col += step) {
      let stopColors = [];

      for (let row = 0; row <= height; row += 10) {
        let l = col / width;
        let c = 1 - (row / height);
        let color;

        if (this.#space === "lch") {
          color = {space: "lch", coords: [l*100, c*MAX_LCH_CHROMA, h]};
        }
        else if (this.#space === "oklch") {
          color = {space: "oklch", coords: [l, c*MAX_OKLCH_CHROMA, h]};
        }

        stopColors.push(color);
      }

      let gradient = context.createLinearGradient(col, 0, width, height);

      for (let i = 0; i < stopColors.length; i += 1) {
        let stopColor = stopColors[i];
        gradient.addColorStop(i / stopColors.length, serializeColor(stopColor));
      }

      context.fillStyle = gradient;
      context.fillRect(col, 0, step, height);
    }
  }

  #updatePlanarSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#planar-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let width = this.clientWidth;
      let height = this.clientHeight;
      let step = 1 / window.devicePixelRatio;
      let [, , h] = this.#coords;
      let points = [];

      let isInGamut = (l, c, h) => {
        let color;

        if (this.#space === "lch") {
          color = {space: "lch", coords: [l*100, c*MAX_LCH_CHROMA, h]};
        }
        else if (this.#space === "oklch") {
          color = {space: "oklch", coords: [l, c*MAX_OKLCH_CHROMA, h]};
        }

        return isColorInGamut(color, this.#gamutHints);
      };

      for (let col = 0; col <= width; col += step) {
        let row = height;

        while (row >= 0) {
          if (isInGamut(col/width, 1 - (row/height), h)) {
            row -= 10;
          }
          else {
            break;
          }
        }

        let maxRow = Math.max(row + 10, height);

        while (row <= maxRow) {
          row += step;

          if (isInGamut(col/width, 1 - (row/height), h)) {
            break;
          }
        }

        points.push([col, row]);
      }

      if (points.length === 0) {
        this["#planar-slider-gamut-path"].removeAttribute("d");
      }
      else {
        let d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
        this["#planar-slider-gamut-path"].setAttribute("d", d);
        this["#planar-slider-gamut-svg"].setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
    }
  }

  #updatePlanarSliderGamutPathThrottled = throttle(this.#updatePlanarSliderGamutPath, 40, this);

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
      this["#planar-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let inGamut = isColorInGamut({space: this.#space, coords: [...this.#coords]}, this.#gamutHints)

      if (inGamut) {
        this["#hue-slider-marker"].removeAttribute("data-warn");
        this["#planar-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#hue-slider-marker"].setAttribute("data-warn", "");
        this["#planar-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    this["#hue-slider-label"].hidden = !this.#labels;
    this["#alpha-slider-label"].hidden = !this.#labels;
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
  }
}

if (customElements.get("x-lchplanarsliders") === undefined) {
  customElements.define("x-lchplanarsliders", XLCHPlanarSlidersElement);
}