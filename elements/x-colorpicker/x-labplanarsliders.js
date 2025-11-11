
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../../classes/xel.js";

import {convertColor, serializeColor, normalizeColorSpaceName} from "../../utils/color.js";
import {closest} from "../../utils/element.js";
import {normalize, rotatePoint} from "../../utils/math.js";
import {html, css} from "../../utils/template.js";
import {throttle} from "../../utils/time.js";

/**
 * Planar sliders for LAB-based color spaces (CIE LAB, OK LAB).
 *
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 * @part slider
 */
class XLABPlanarSlidersElement extends HTMLElement {
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
     * Lightness slider
     */

    #lightness-slider {
      width: 100%;
      height: 35px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      touch-action: pinch-zoom;
    }

    #lightness-slider-track {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
    }

    #lightness-slider-marker {
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
    #lightness-slider-marker[data-warn]::after {
      content: "⚠";
      position: absolute;
      right: -26px;
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 1.125rem;
    }

    #lightness-slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    #lightness-slider-gamut-path {
      fill: none;
      stroke: white;
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 2px;
      opacity: 0.8;
    }

    #lightness-slider-label {
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
  #resizeObserver = new ResizeObserver(() => this.#onResize());
  #isDraggingSlider = false;

  #space = "lab";         // Either "lab" or "oklab"
  #gamutHints = "srgb";   // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #labels = true;
  #coords = [0, 0, 0];    // LAB: [0-100, -125-125, -125-125], OK LAB: [0-1, -0.4-0.4, -0.4-0.4]
  #a = 1;                 // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XLABPlanarSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XLABPlanarSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#lightness-slider"].addEventListener("pointerdown", (event) => this.#onLightnessSliderPointerDown(event));
    this["#planar-slider"].addEventListener("pointerdown", (event) => this.#onPlanarSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
    this["#context-menu"].addEventListener("open", (event) => this.#onContextMenuOpen(event));
  }

  connectedCallback() {
    this.#ownerColorPicker = closest(this, "x-colorpicker");
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

        this.#updateLightnessSliderMarker();
        this.#updatePlanarSliderGamutPathThrottled();
        this.#updatePlanarSliderBackground();
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

      let [l, a, b] = this.#coords;

      if (this.#space === "lab") {
        a = (x * 250) - 125;
        b = ((1 - y) * 250) - 125;
      }
      else if (this.#space === "oklab") {
        a = (x * 0.8) - 0.4;
        b = ((1 - y) * 0.8) - 0.4;
      }

      this.#coords = [l, a, b];

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePlanarSliderMarker();
      this.#updateLightnessSliderBackground();
      this.#updateLightnessSliderGamutPath();
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
    this.#updatePlanarSliderMarker();
    this.#updatePlanarSliderBackground();
    this.#updatePlanarSliderGamutPath();

    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();
    this.#updateLightnessSliderGamutPath();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutWarnings();
    this.#updateLabels();
  }

  #updatePlanarSliderMarker() {
      let [, a, b] = this.#coords;
      let left;
      let top;

      if (this.#space === "lab") {
        if (a < -125) {
          left = "calc(0% - 18px)";
        }
        else if (a > 125) {
          left = "calc(100% + 18px)";
        }
        else {
          left = (((a + 125) / 250) * 100) + "%";
        }

        if (b < -125) {
          top = "calc(0% - 18px)";
        }
        else if (b > 125) {
          top = "calc(100% + 18px)";
        }
        else {
          top = (100 - (((b + 125) / 250) * 100)) + "%";
        }
      }

      else if (this.#space === "oklab") {
        if (a < -0.4) {
          left = "calc(0% - 18px)";
        }
        else if (a > 0.4) {
          left = "calc(100% + 18px)";
        }
        else {
          left = (((a + 0.4) / 0.8) * 100) + "%";
        }

        if (b < -0.4) {
          top = "calc(0% - 18px)";
        }
        else if (b > 0.4) {
          top = "calc(100% + 18px)";
        }
        else {
          top = (100 - (((b + 0.4) / 0.8) * 100)) + "%";
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
    let [l] = this.#coords;

    context.clearRect(0, 0, width, height);

    for (let col = 0; col <= width ; col += step) {
      let stopColors = [];

      for (let row = 0; row <= height; row += 10) {
        let a = col / width;
        let b = 1 - (row / height);
        let color;

        if (this.#space === "lab") {
          color = {space: "lab", coords: [l,  (a * 250) - 125, (b * 250) - 125]};
        }
        else if (this.#space === "oklab") {
          color = {space: "oklab", coords: [l,  (a * 0.8) - 0.4, (b * 0.8) - 0.4]};
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

  async #updatePlanarSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#planar-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let width = this["#planar-slider-gamut-svg"].clientWidth;
      let height = this["#planar-slider-gamut-svg"].clientHeight;
      let maxR = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2));
      let centerPoint = {x: width/2, y: height/2};
      let [l] = this.#coords;
      let points = [];

      for (let angle = 0; angle < 360; angle += 3) {
        let minR;

        for (let r = maxR; r >= 0; r -= 15) {
          let point = rotatePoint({x: width/2, y: (height/2) - r}, centerPoint, angle);
          let a, b;

          if (this.#space === "lab") {
            a = ((point.x / width) * 250) - 125;
            b = -(((point.y / height) * 250) - 125);
          }
          else if (this.#space === "oklab") {
            a = ((point.x / width) * 0.8) - 0.4;
            b = -(((point.y / height) * 0.8) - 0.4);
          }

          let [x, y, z] = convertColor({space: this.#space, coords: [l, a, b]}, "xyz-d65").coords;
          let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);

          if (inGamut) {
            minR = r;
            break;
          }
        }

        for (let r = minR; r <= maxR; r += 1) {
          let point = rotatePoint({x: width/2, y: (height/2) - r}, centerPoint, angle);
          let a, b;

          if (this.#space === "lab") {
            a = ((point.x / width) * 250) - 125;
            b = -(((point.y / height) * 250) - 125);
          }
          else if (this.#space === "oklab") {
            a = ((point.x / width) * 0.8) - 0.4;
            b = -(((point.y / height) * 0.8) - 0.4);
          }

          let [x, y, z] = convertColor({space: this.#space, coords: [l, a, b]}, "xyz-d65").coords;
          let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);

          if (inGamut === false) {
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
    let [, a, b] = this.#coords;
    let colors = [];

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
      this["#planar-slider-marker"].removeAttribute("data-warn");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let [x, y, z] = convertColor({space: this.#space, coords: this.#coords}, "xyz-d65").coords;
      let inGamut = await this.#ownerColorPicker.isColorInGamut(x, y, z, this.#gamutHints);

      if (inGamut) {
        this["#planar-slider-marker"].removeAttribute("data-warn");
        this["#lightness-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#planar-slider-marker"].setAttribute("data-warn", "");
        this["#lightness-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updateLabels() {
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

if (customElements.get("x-labplanarsliders") === undefined) {
  customElements.define("x-labplanarsliders", XLABPlanarSlidersElement);
}