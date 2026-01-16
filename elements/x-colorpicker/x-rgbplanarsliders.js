
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {convertColor, serializeColor, normalizeColorSpaceName} from "../../utils/color.js";
import {closest} from "../../utils/element.js";
import {normalize} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";
import {throttle} from "../../utils/time.js";

/**
 * Planar sliders for RGB-based color spaces (sRBG, Linear sRGB, Adobe RGB, Display P3, Rec. 2020, ProPhoto RGB).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XRGBPlanarSlidersElement extends HTMLElement {
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

    #planar-slider-gamut-svg {
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
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, s, lv] = this.#coords;
      let [r, g, b] = convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    else {
      return [0, 0, 0, 0];
    }
  }
  set value([r, g, b, a]) {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, s, lv] = convertColor({space: "srgb", coords: [r, g, b]}, this.#model).coords;
      this.#coords = [h/360, s/100, lv/100];
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
    this.#shadowRoot.append(document.importNode(XRGBPlanarSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XRGBPlanarSlidersElement.#shadowStyleSheet];

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

      if (coord !== this.#coords[0]) {
        this.#coords[0] = coord;

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

      if (this.#model === "hsv") {
        let [h, s, v] = this.#coords;
        s = x;
        v = 1 - y;

        this.#coords = [h, s, v];
      }
      else if (this.#model === "hsl") {
        let [h, s, l] = this.#coords;
        s = x;
        l = 1 - y;

        this.#coords = [h, s, l];
      }

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
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h] = this.#coords;
      this["#hue-slider-marker"].style.left = (h * 100) + "%";
    }
  }

  #updateHueSliderBackground() {
    if (this.#model === "hsv" || this.#model === "hsl") {
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
      this["#hue-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }
  }

  async #updateHueSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#hue-slider-gamut-path"].removeAttribute("d");
    }
    else {
      if (this.#model === "hsv" || this.#model === "hsl") {
        let [, s, lv] = this.#coords;
        let width = this["#hue-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let ranges = [];

        // Determine ranges
        {
          let range = null;

          for (let column = 0; column <= width; column += step) {
            let h = (column / width);
            let [r, g, b] = convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, "srgb").coords;
            let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
            let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);

            if (inGamut) {
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
  }

  #updatePlanarSliderMarker() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [, s, lv] = this.#coords;
      let left = s * 100;
      let top = 100 - (lv * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
  }

  #updatePlanarSliderBackground() {
    let [h] = this.#coords;
    let interpolation = (this.#space === "srgb-linear") ? "srgb-linear" : "srgb";
    let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;

    if (this.#model === "hsv") {
      let bg1Colors = [
        {space: this.#space, coords: convertColor({space: "hsv", coords: [h*360,   0, 100]}, hSpace).coords},
        {space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, 100, 100]}, hSpace).coords}
      ];

      let bg2Colors = [
        {space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, 0, 100]}, hSpace).coords},
        {space: this.#space, coords: convertColor({space: "hsv", coords: [h*360, 0,   0]}, hSpace).coords}
      ];

      this["#planar-slider"].style.background = `
        linear-gradient(in ${interpolation} to bottom, ${bg2Colors.map(c => serializeColor(c)).join(",")}),
        linear-gradient(in ${interpolation} to right,  ${bg1Colors.map(c => serializeColor(c)).join(",")})
      `;

      this["#planar-slider"].style.backgroundBlendMode = "multiply, normal";
    }
    else if (this.#model === "hsl") {
      let bg1Colors = [
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360,   0, 50]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360,   100, 50]}, hSpace).coords },
      ];

      let bg2Colors = [
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 0, 100]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 0, 100]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 0, 0]}, hSpace).coords },
      ];

      // @bug: Colors with alpha channel are not interpolated correctly in srgb-linear color space
      let bg3Colors = [
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 0, 100]}, hSpace).coords },
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 0, 0]}, hSpace).coords, alpha: 0},
        { space: this.#space, coords: convertColor({space: "hsl", coords: [h*360, 0, 0]}, hSpace).coords, alpha: 0},
      ];

      bg1Colors = bg1Colors.map(color => serializeColor(color));
      bg2Colors = bg2Colors.map(color => serializeColor(color));
      bg3Colors = bg3Colors.map(color => serializeColor(color));

      this["#planar-slider"].style.background = `
        linear-gradient(in ${interpolation} to bottom, ${bg3Colors.join(",")}),
        linear-gradient(in ${interpolation} to bottom, ${bg2Colors.join(",")}),
        linear-gradient(in ${interpolation} to right, ${bg1Colors.join(",")})
      `;

      this["#planar-slider"].style.backgroundBlendMode = "normal, multiply, normal";
    }
  }

  async #updatePlanarSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#planar-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let width = this["#planar-slider"].clientWidth;
      let height = this["#planar-slider"].clientHeight;
      let step = 1 / window.devicePixelRatio;
      let [h] = this.#coords;
      let points = [];

      let isInGamut = (h, s, lv) => {
        let [r, g, b] = convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, "srgb").coords;
        let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
        return this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);
      };

      if (this.#model === "hsv") {
        let col = 0;

        for (let row = 0; row < height; row += step) {
          while (col <= width) {
            let s = col / width;
            let lv = 1 - (row / height);
            let inGamut = await isInGamut(h, s, lv);

            if (inGamut === false) {
              points.push([col, row]);
              break;
            }
            else {
              col += step;
            }
          }
        }

        if (points.length > 0 && points.at(-1)[0] < width) {
          points.push([width, points.at(-1)[1]]);
        }
      }

      else if (this.#model === "hsl") {
        for (let row = 0; row < height; row += step) {
          let col = width;

          while (col >= 0) {
            let inGamut = await isInGamut(h, col/width, 1-(row/height));

            if (inGamut) {
              break;
            }
            else {
              col -= 10;
            }
          }

          let maxCol = Math.min(col + 10, width);

          while (col <= maxCol) {
            col += step;
            let inGamut = await isInGamut(h, col/width, 1-(row/height));

            if (inGamut === false) {
              break;
            }
          }

          points.push([col, row]);
        }
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
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, s, lv] = this.#coords;
      let hSpace = (this.#space === "srgb-linear") ? "srgb" : this.#space;

      let colors = [
        {
          space: this.#space,
          coords: convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, hSpace).coords,
          alpha: 0
        },
        {
          space: this.#space,
          coords: convertColor({space:this.#model, coords: [h*360, s*100, lv*100]}, hSpace).coords,
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
      this["#hue-slider-marker"].removeAttribute("data-warn");
      this["#planar-slider-marker"].removeAttribute("data-warn");
    }
    else {
      if (this.#model === "hsv" || this.#model === "hsl") {
        let [h, s, lv] = this.#coords;
        let [r, g, b] = convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, "srgb").coords;
        let [x, y, z] = convertColor({space: this.#space, coords: [r, g, b]}, "xyz-d65").coords;
        let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, gamutHints);

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
  }

  #updateLabels() {
    this["#hue-slider-label"].hidden = !this.#labels;
    this["#alpha-slider-label"].hidden = !this.#labels;
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

if (customElements.get("x-rgbplanarsliders") === undefined) {
  customElements.define("x-rgbplanarsliders", XRGBPlanarSlidersElement);
}
