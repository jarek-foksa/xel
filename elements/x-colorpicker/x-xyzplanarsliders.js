
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {serializeColor, normalizeColorSpaceName, isColorInGamut} from "../../utils/color.js";
import {normalize, rotatePoint} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";
import {throttle} from "../../utils/time.js";

/**
 * Planar sliders for XYZ-based color spaces (CIE XYZ D65, CIE XYZ D50).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XXYZPlanarSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="linear-slider" class="slider" part="slider">
        <div id="linear-slider-track" class="slider-track">
          <svg id="linear-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="linear-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="linear-slider-marker" class="slider-marker">
            <span id="linear-slider-label" class="slider-label">L</span>
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
            <x-label><x-message href="#color-model" autocapitalize>Color Model</x-message></x-label>

            <x-menu id="color-model-menu">
              <x-menuitem value="x-zy"><x-label>X-ZY</x-label></x-menuitem>
              <x-menuitem value="y-xz"><x-label>Y-XZ</x-label></x-menuitem>
              <x-menuitem value="z-xy"><x-label>Z-XY</x-label></x-menuitem>
            </x-menu>
          </x-menuitem>

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
   * @type {"xyz-d65" | "xyz-d50"}
   * @default "xyz-d65"
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

  #space = "xyz-d65";   // Either "xyz-d65" or "xyz-d50"
  #model = "x-zy";      // Either "x-zy", "y-xz" or "z-xy"
  #gamutHints = "srgb"; // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];  // [0-1, 0-1, 0-1]
  #a = 1;               // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XXYZPlanarSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XXYZPlanarSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#planar-slider"].addEventListener("pointerdown", (event) => this.#onPlanarSliderPointerDown(event));
    this["#linear-slider"].addEventListener("pointerdown", (event) => this.#onLinearSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
    this.#model = Xel.getConfig(`${this.localName}:model`, "x-zy");
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
      if (key === `${this.localName}:model`) {
        let model = (value || "x-zy");

        if (model !== this.#model) {
          this.#model = model;
          this.#update();
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
        if (item.value !== this.#model) {
          this.#model = item.value;
          this.#update();
          Xel.setConfig(`${this.localName}:model`, item.value);
        }
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

  #onResize() {
    this.#updatePlanarSliderGamutPathThrottled();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

      let index;

      if (this.#model === "x-zy") {
        index = 0;
      }
      else if (this.#model === "y-xz") {
        index = 1;
      }
      else if (this.#model === "z-xy") {
        index = 2;
      }

      if (coord !== this.#coords[index]) {
        this.#coords[index] = coord;

        this.#updatePlanarSliderBackground();
        this.#updatePlanarSliderGamutPathThrottled();
        this.#updateLinearSliderMarker();
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
      let left = (clientX - sliderBounds.left) / sliderBounds.width;
      let top = (clientY - sliderBounds.top) / sliderBounds.height;

      left = normalize(left, 0, 1);
      top = normalize(top, 0, 1);

      let [x, y, z] = this.#coords;

      if (this.#model === "x-zy") {
        this.#coords = [x, top, left];
      }
      else if (this.#model === "y-xz") {
        this.#coords = [left, y, top];
      }
      else if (this.#model === "z-xy") {
        this.#coords = [left, top, z];
      }

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePlanarSliderMarker();
      this.#updateLinearSliderBackground();
      this.#updateLinearSliderGamutPath();
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
    this.#updateLinearSliderMarker();
    this.#updateLinearSliderBackground();
    this.#updateLinearSliderGamutPath();

    this.#updatePlanarSliderMarker();
    this.#updatePlanarSliderBackground();
    this.#updatePlanarSliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updateLinearSliderMarker() {
    let [x, y, z] = this.#coords;

    if (this.#model === "x-zy") {
      this["#linear-slider-marker"].style.left = (x * 100) + "%";
    }
    else if (this.#model === "y-xz") {
      this["#linear-slider-marker"].style.left = (y * 100) + "%";
    }
    else if (this.#model === "z-xy") {
      this["#linear-slider-marker"].style.left = (z * 100) + "%";
    }
  }

  #updateLinearSliderBackground() {
    let [x, y, z] = this.#coords;
    let colors = [];

    if (this.#model === "x-zy") {
      for (let x = 0; x <= 1; x += 0.02) {
        colors.push({space: this.#space, coords: [x, y, z]});
      }
    }
    else if (this.#model === "y-xz") {
      for (let y = 0; y <= 1; y += 0.02) {
        colors.push({space: this.#space, coords: [x, y, z]});
      }
    }
    else if (this.#model === "z-xy") {
      for (let z = 0; z <= 1; z += 0.02) {
        colors.push({space: this.#space, coords: [x, y, z]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#linear-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateLinearSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#linear-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#linear-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [x, y, z] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let coord = (column / width);
          let color;

          if (this.#model === "x-zy") {
            color = {space: this.#space, coords: [coord, y, z]};
          }
          else if (this.#model === "y-xz") {
            color = {space: this.#space, coords: [x, coord, z]};
          }
          else if (this.#model === "z-xy") {
            color = {space: this.#space, coords: [x, y, coord]};
          }

          if (isColorInGamut(color, this.#gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(coord * 100);
          }
          else {
            range = null;
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

  #updatePlanarSliderMarker() {
    let [x, y, z] = this.#coords;
    let left;
    let top;

    if (this.#model === "x-zy") {
      if (z < 0) {
        left = "calc(0% - 18px)";
      }
      else if (z > 1) {
        left = "calc(100% + 18px)";
      }
      else {
        left = (z * 100) + "%";
      }

      if (y < 0) {
        top = "calc(0% - 18px)";
      }
      else if (y > 1) {
        top = "calc(100% + 18px)";
      }
      else {
        top = (y * 100) + "%";
      }
    }
    else if (this.#model === "y-xz") {
      if (x < 0) {
        left = "calc(0% - 18px)";
      }
      else if (x > 1) {
        left = "calc(100% + 18px)";
      }
      else {
        left = (x * 100) + "%";
      }

      if (z < 0) {
        top = "calc(0% - 18px)";
      }
      else if (z > 1) {
        top = "calc(100% + 18px)";
      }
      else {
        top = (z * 100) + "%";
      }
    }
    else if (this.#model === "z-xy") {
      if (x < 0) {
        left = "calc(0% - 18px)";
      }
      else if (x > 1) {
        left = "calc(100% + 18px)";
      }
      else {
        left = (x * 100) + "%";
      }

      if (y < 0) {
        top = "calc(0% - 18px)";
      }
      else if (y > 1) {
        top = "calc(100% + 18px)";
      }
      else {
        top = (y * 100) + "%";
      }
    }

    this["#planar-slider-marker"].style.left = left;
    this["#planar-slider-marker"].style.top = top;
  }

  #updatePlanarSliderBackground() {
    let canvas = this["#planar-slider-canvas"];
    let context = canvas.getContext("2d", {colorSpace: "display-p3"});
    let {width, height} = canvas;
    let step = 1;
    let [x, y, z] = this.#coords;

    context.clearRect(0, 0, width, height);

    for (let col = 0; col <= width ; col += step) {
      let stopColors = [];

      for (let row = 0; row <= height; row += 10) {
        let color;

        if (this.#model === "x-zy") {
          let z = col / width;
          let y = (row / height);
          color = {space: this.#space, coords: [x, y, z]};
        }
        else if (this.#model === "y-xz") {
          let x = col / width;
          let z = (row / height);
          color = {space: this.#space, coords: [x, y, z]};
        }
        else if (this.#model === "z-xy") {
          let x = col / width;
          let y = (row / height);
          color = {space: this.#space, coords: [x, y, z]};
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
      let width = this["#planar-slider-gamut-svg"].clientWidth;
      let height = this["#planar-slider-gamut-svg"].clientHeight;
      let maxR = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2));
      let centerPoint = {x: width/2, y: height/2};
      // let [x, y, z] = this.#coords;
      let points = [];

      for (let angle = 0; angle < 360; angle += 3) {
        let minR;
        let [x, y, z] = this.#coords;

        for (let r = maxR; r >= 0; r -= 15) {
          let point = rotatePoint({x: width/2, y: (height/2) - r}, centerPoint, angle);

          if (this.#model === "x-zy") {
            z = point.x / width;
            y = point.y / height;
          }
          else if (this.#model === "y-xz") {
            x = point.x / width;
            z = point.y / height;
          }
          else if (this.#model === "z-xy") {
            x = point.x / width;
            y = point.y / height;
          }

          if (isColorInGamut({space: this.#space, coords: [x, y, z]}, this.#gamutHints)) {
            minR = r;
            break;
          }
        }

        for (let r = minR; r <= maxR; r += 1) {
          let point = rotatePoint({x: width/2, y: (height/2) - r}, centerPoint, angle);
          let [x, y, z] = this.#coords;

          if (this.#model === "x-zy") {
            z = point.x / width;
            y = point.y / height;
          }
          else if (this.#model === "y-xz") {
            x = point.x / width;
            z = point.y / height;
          }
          else if (this.#model === "z-xy") {
            x = point.x / width;
            y = point.y / height;
          }

          if (isColorInGamut({space: this.#space, coords: [x, y, z]}, this.#gamutHints) === false) {
            points.push(point);
            break;
          }
        }
      }

      if (points.length === 0) {
        this["#planar-slider-gamut-path"].removeAttribute("d");
      }
      else {
        let d = points.map(({x, y}, i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") + " Z";
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
    let [x, y, z] = this.#coords;

    let colors = [
      {space: this.#space, coords: [x, y, z], alpha: 0},
      {space: this.#space, coords: [x, y, z], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateGamutWarnings() {
    if (this.#gamutHints === "none") {
      this["#linear-slider-marker"].removeAttribute("data-warn");
      this["#planar-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let inGamut = isColorInGamut({space: this.#space, coords: [...this.#coords]}, this.#gamutHints);

      if (inGamut) {
        this["#linear-slider-marker"].removeAttribute("data-warn");
        this["#planar-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#linear-slider-marker"].setAttribute("data-warn", "");
        this["#planar-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    this["#linear-slider-label"].hidden = !this.#labels;
    this["#linear-slider-label"].textContent = this.#model[0].toUpperCase();
    this["#alpha-slider-label"].hidden = !this.#labels;
  }

  #updateContextMenu() {
    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#model);
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
  }
}

if (customElements.get("x-xyzplanarsliders") === undefined) {
  customElements.define("x-xyzplanarsliders", XXYZPlanarSlidersElement);
}
