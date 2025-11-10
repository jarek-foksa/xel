
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {serializeColor, normalizeColorSpaceName, isColorInGamut} from "../../utils/color.js";
import {normalize} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";

/**
 * Linear sliders for XYZ-based color spaces (CIE XYZ D65, CIE XYZ D50).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XXYZLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="x-slider" class="slider" part="slider">
        <div id="x-slider-track" class="slider-track">
          <svg id="x-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="x-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="x-slider-marker" class="slider-marker">
            <span id="x-slider-label" class="slider-label">X</span>
          </div>
        </div>
      </div>

      <div id="y-slider" class="slider" part="slider">
        <div id="y-slider-track" class="slider-track">
          <svg id="y-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="y-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="y-slider-marker" class="slider-marker">
            <span id="y-slider-label" class="slider-label">Y</span>
          </div>
        </div>
      </div>

      <div id="z-slider" class="slider" part="slider">
        <div id="z-slider-track" class="slider-track">
          <svg id="z-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <path id="z-slider-gamut-path" class="slider-gamut-path"></path>
          </svg>

          <div id="z-slider-marker" class="slider-marker">
            <span id="z-slider-label" class="slider-label">Z</span>
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

    .slider-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.625rem;
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
    let [x, y, z] = this.#coords;
    return [x, y, z, this.#a];
  }
  set value([x, y, z, a]) {
    this.#coords = [x, y, z];
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
  #isDraggingSlider = false;

  #space = "xyz-d65";     // Either "xyz-d65" or "xyz-d50"
  #gamutHints = "srgb";   // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];    // Values normalized to 0 - 1 range
  #a = 1;                 // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XXYZLinearSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XXYZLinearSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#x-slider"].addEventListener("pointerdown", (event) => this.#onXSliderPointerDown(event));
    this["#y-slider"].addEventListener("pointerdown", (event) => this.#onYSliderPointerDown(event));
    this["#z-slider"].addEventListener("pointerdown", (event) => this.#onZSliderPointerDown(event));
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

  #onXSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#x-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#x-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[0]) {
        this.#coords[0] = coord;

        this.#updateXSliderMarker();
        this.#updateYSliderBackground();
        this.#updateYSliderGamutPath();
        this.#updateZSliderBackground();
        this.#updateZSliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#x-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#x-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#x-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#x-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#x-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#x-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onYSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#y-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#y-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[1]) {
        this.#coords[1] = coord;

        this.#updateXSliderBackground();
        this.#updateXSliderGamutPath();
        this.#updateYSliderMarker();
        this.#updateYSliderBackground();
        this.#updateZSliderBackground();
        this.#updateZSliderGamutPath();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#y-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#y-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#y-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#y-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#y-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#y-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onZSliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#z-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#z-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[2]) {
        this.#coords[2] = coord;

        this.#updateXSliderBackground();
        this.#updateXSliderGamutPath();
        this.#updateYSliderBackground();
        this.#updateYSliderGamutPath();
        this.#updateZSliderMarker();
        this.#updateZSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutWarnings();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#z-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#z-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#z-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#z-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#z-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#z-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
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
    this.#updateXSliderMarker();
    this.#updateXSliderBackground();
    this.#updateXSliderGamutPath();

    this.#updateYSliderMarker();
    this.#updateYSliderBackground();
    this.#updateYSliderGamutPath();

    this.#updateZSliderMarker();
    this.#updateZSliderBackground();
    this.#updateZSliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updateXSliderMarker() {
    let [x] = this.#coords;

    // "x" value is theoretically unbounded, but the slider can show values only in [0, 1] range
    if (x < 0) {
      this["#x-slider-marker"].style.left = "calc(0% - 18px)";
    }
    else if (x > 1) {
      this["#x-slider-marker"].style.left = "calc(100% + 18px)";
    }
    else {
      this["#x-slider-marker"].style.left = (x * 100) + "%";
    }
  }

  #updateXSliderBackground() {
    let [, y, z] = this.#coords;
    let colors = [];

    for (let x = 0; x <= 1; x += 0.05) {
      colors.push({space: this.#space, coords: [x, y, z]});
    }

    colors = colors.map(color => serializeColor(color));
    this["#x-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateXSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#x-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#x-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [, y, z] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let x = (column / width);
          let color = {space: this.#space, coords: [x, y, z]};

          if (isColorInGamut(color, this.#gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(x * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#x-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#x-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateYSliderMarker() {
    let [, y] = this.#coords;

    // "y" value is theoretically unbounded, but the slider can show values only in [0, 1] range
    if (y < 0) {
      this["#y-slider-marker"].style.left = "calc(0% - 18px)";
    }
    else if (y > 1) {
      this["#y-slider-marker"].style.left = "calc(100% + 18px)";
    }
    else {
      this["#y-slider-marker"].style.left = (y * 100) + "%";
    }
  }

  #updateYSliderBackground() {
    let [x, , z] = this.#coords;
    let colors = [];

    for (let y = 0; y <= 1; y += 0.05) {
      colors.push({space: this.#space, coords: [x, y, z]});
    }

    colors = colors.map(color => serializeColor(color));
    this["#y-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateYSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#y-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#y-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [x, , z] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let y = (column / width);
          let color = {space: this.#space, coords: [x, y, z]};

          if (isColorInGamut(color, this.#gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(y * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#y-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#y-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

  #updateZSliderMarker() {
    let [, , z] = this.#coords;

    // "z" value is theoretically unbounded, but the slider can show values only in [0, 1] range
    if (z < 0) {
      this["#z-slider-marker"].style.left = "calc(0% - 18px)";
    }
    else if (z > 1) {
      this["#z-slider-marker"].style.left = "calc(100% + 18px)";
    }
    else {
      this["#z-slider-marker"].style.left = (z * 100) + "%";
    }
  }

  #updateZSliderBackground() {
    let [x, y] = this.#coords;
    let colors = [];

    for (let z = 0; z <= 1; z += 0.05) {
      colors.push({space: this.#space, coords: [x, y, z]});
    }

    colors = colors.map(color => serializeColor(color));
    this["#z-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateZSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#z-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let ranges = [];

      // Determine ranges
      {
        let width = this["#z-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let [x, y] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let z = (column / width);
          let color = {space: this.#space, coords: [x, y, z]};

          if (isColorInGamut(color, this.#gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(z * 100);
          }
          else {
            range = null;
          }
        }

        ranges = ranges.map(range => [range.at(0), range.at(-1)]);
      }

      if (ranges.length > 0) {
        let subpaths = ranges.map(([startX, endX]) => `M ${startX} 35 L ${startX} 17 L ${endX} 17 L ${endX} 35`);
        this["#z-slider-gamut-path"].setAttribute("d", subpaths.join(" "));
      }
      else {
        this["#z-slider-gamut-path"].removeAttribute("d");
      }
    }
  }

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
      this["#x-slider-marker"].removeAttribute("data-warn");
      this["#y-slider-marker"].removeAttribute("data-warn");
      this["#z-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let color = {space: this.#space, coords: this.#coords};

      if (isColorInGamut(color, this.#gamutHints)) {
        this["#x-slider-marker"].removeAttribute("data-warn");
        this["#y-slider-marker"].removeAttribute("data-warn");
        this["#z-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#x-slider-marker"].setAttribute("data-warn", "");
        this["#y-slider-marker"].setAttribute("data-warn", "");
        this["#z-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
    this["#x-slider-label"].hidden = !this.#labels;
    this["#y-slider-label"].hidden = !this.#labels;
    this["#z-slider-label"].hidden = !this.#labels;
    this["#alpha-slider-label"].hidden = !this.#labels;
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
  }
}

if (customElements.get("x-xyzlinearsliders") === undefined) {
  customElements.define("x-xyzlinearsliders", XXYZLinearSlidersElement);
}
