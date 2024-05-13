
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {convertColor, parseColor, serializeColor, isColorInGamut} from "../utils/color.js";
import {createElement} from "../utils/element.js";
import {degToRad, normalize, round} from "../utils/math.js";
import {html, css} from "../utils/template.js";
import {throttle} from "../utils/time.js";

let {PI, sin, cos, pow, atan2, sqrt} = Math;

const COLOR_PRECISION = 3;
const MAX_LCH_CHROMA = 150;
const MAX_OKLCH_CHROMA = 0.4;
const DEBUG = false;

// @element x-colorpicker
// @event ^change
// @event ^changestart
// @event ^changeend
class XColorPickerElement extends HTMLElement {
  static observedAttributes = ["value", "alpha", "spaces", "disabled"];

  static #shadowTemplate = html`
    <template>
      <header id="header">
        <x-select id="space-select" size="small">
          <x-menu id="space-select-menu">
            <x-menuitem value="srgb"><x-label>sRGB</x-label></x-menuitem>
            <x-menuitem value="srgb-linear"><x-label><x-message href="#color-space.srgb-linear">Linear sRGB</x-message></x-label></x-menuitem>
            <x-menuitem value="a98rgb"><x-label>Adobe RGB</x-label></x-menuitem>
            <x-menuitem value="p3"><x-label>Display P3</x-label></x-menuitem>
            <x-menuitem value="rec2020"><x-label>Rec. 2020</x-label></x-menuitem>
            <x-menuitem value="prophoto"><x-label>ProPhoto RGB</x-label></x-menuitem>
            <hr/>
            <x-menuitem value="lch"><x-label>CIE LCH</x-label></x-menuitem>
            <x-menuitem value="oklch"><x-label>OK LCH</x-label></x-menuitem>
            <hr/>
            <x-menuitem value="lab"><x-label>CIE LAB</x-label></x-menuitem>
            <x-menuitem value="oklab"><x-label>OK LAB</x-label></x-menuitem>
            <hr/>
            <x-menuitem value="xyz-d65"><x-label>CIE XYZ D65</x-label></x-menuitem>
            <x-menuitem value="xyz-d50"><x-label>CIE XYZ D50</x-label></x-menuitem>
          </x-menu>
        </x-select>

        <x-buttons id="type-buttons" tracking="1">
          <x-button value="planar" skin="flat">
            <x-icon href="#square"></x-icon>
          </x-button>

          <x-button value="polar" skin="flat">
            <x-icon href="#circle"></x-icon>
          </x-button>

          <x-button value="linear" skin="flat">
            <x-icon href="#bars"></x-icon>
          </x-button>
        </x-buttons>
      </header>

      <main id="main"></main>

      <footer id="footer">
        <x-colorinput id="input" space="srgb" size="small"></x-colorinput>

        <x-button id="grab-button" size="small" condensed togglable>
          <x-icon href="#eye-dropper"></x-icon>
        </x-button>
      </footer>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 200px;
      box-sizing: border-box;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Header
     */

    #header {
      display: flex;
      align-items: center;
    }

    /* Space select */

    #space-select {
      min-width: 110px;
      font-size: 13px;
    }

    #space-select x-menuitem[data-warn] x-label::after {
      content: " ⚠";
    }

    /* Type buttons */

    #type-buttons {
      margin-left: auto;
    }

    #type-buttons x-button {
      margin-left: 4px;
      min-height: 1px;;
    }

    #type-buttons x-button x-icon {
      width: 18px;
      height: 18px;
    }

    /**
     * Main
     */

    #main {
      margin-top: 10px;
    }

    /* Sliders */

    #sliders {
      width: 100%;
    }
    :host-context(x-popover) #sliders {
      height: 250px;
    }
    :host-context(x-popover):host([alpha]) #sliders {
      height: 290px;
    }

    /**
     * Footer
     */

    #footer {
      display: flex;
      margin-top: 10px;
    }

    /* Input */

    #input {
      max-width: none;
      min-height: 1px;
      flex: 1;
      font-size: 13px;
    }
    #input:focus {
      z-index: 1;
    }

    /* Grab button */

    #grab-button {
      margin: 0 0 0 5px;
      padding: 0px 6px;
    }

    #grab-button x-icon {
      width: 14px;
      height: 14px;
    }
  `;

  // @property
  // @attribute
  // @type string
  // @default "#000000"
  //
  // Any valid CSS color value.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "#000000";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether to allow manipulation of the alpha channel.
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @property
  // @attribute
  // @type Array<string>
  // @default ["srgb", "srgb-linear", "a98rgb", "p3", "rec2020", "prophoto", "lch", "oklch", "lab", "oklab", "xyz-d65", "xyz-d50"]
  //
  // Available color spaces.
  get spaces() {
    if (this.hasAttribute("spaces")) {
      return this.getAttribute("spaces").replace(/\s+/g, " ").split(" ");
    }
    else {
      return ["srgb", "srgb-linear", "a98rgb", "p3", "rec2020", "prophoto", "lch", "oklch", "lab", "oklab", "xyz-d65", "xyz-d50"];
    }
  }
  set spaces(spaces) {
    this.setAttribute("spaces", spaces.join(" "));
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot;
  #configChangeListener;

  #isDraggingSlider = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "open"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XColorPickerElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XColorPickerElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#space-select"].addEventListener("change", () => this.#onSpaceSelectChange());
    this["#space-select"].addEventListener("open", () => this.#updateSpaceSelectWarningIcons());
    this["#type-buttons"].addEventListener("toggle", (event) => this.#onTypeButtonsToggle());

    this["#main"].addEventListener("pointerdown", (event) => this.#onSlidersPointerDown(event), true);
    this["#main"].addEventListener("changestart", (event) => this.#onSlidersChangeStart(event));
    this["#main"].addEventListener("change", (event) => this.#onSlidersChange(event));
    this["#main"].addEventListener("changeend", (event) => this.#onSlidersChangeEnd(event));

    this["#input"].addEventListener("change", (event) => this.#onInputChange(event));
    this["#input"].addEventListener("keydown", (event) => this.#onInputKeyDown(event));

    this["#grab-button"].addEventListener("toggle", () => this.#onGrabButtonToggle());

    if (DEBUG) {
      this.addEventListener("change", () => {
        document.body.style.background = this.value;
      });
    }
  }

  connectedCallback() {
    Xel.addEventListener("configchange", this.#configChangeListener = (event) => {
      this.#onConfigChange(event);
    });

    this["#type-buttons"].value = Xel.getConfig(`${this.localName}:type`, "planar");

    this.#update();
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "alpha") {
      this.#onAlphaAttributeChange();
    }
    else if (name === "spaces") {
      this.#onSpacesAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type () => string?
  //
  // Grab a color using Eye Dropper API. Override this method to use alternative APIs.
  grab() {
    return new Promise(async (resolve) => {
      if (window.EyeDropper === undefined) {
        window.alert("Your web browser does not support Eye Dropper API");
        resolve(null);
      }
      else {
        let eyeDropper = new EyeDropper();
        let eyeDropperAbortController = new AbortController();
        let result;

        try {
          result = await eyeDropper.open({signal: eyeDropperAbortController.signal});
        }
        catch (error) {
          result = null;
        }

        let color = result?.sRGBHex || null;
        resolve(color);
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onValueAttributeChange() {
    if (this.isConnected) {
      if (this.#isDraggingSlider) {
        this.#updateInputThrottled();
      }
      else {
        this.#update();
      }
    }
  }

  #onAlphaAttributeChange() {
    for (let sliders of this["#main"].children) {
      if (this.alpha) {
        sliders.setAttribute("alpha", "");
      }
      else {
        sliders.removeAttribute("alpha");
      }
    }

    if (this.alpha) {
      this["#input"].setAttribute("alpha", "");
    }
    else {
      this["#input"].removeAttribute("alpha");
    }
  }

  #onSpacesAttributeChange() {
    if (this.isConnected) {
      this.#update();
    }
  }

  #onDisabledAttributeChange() {
    if (this.isConnected) {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (origin === "self") {
      if (key === `${this.localName}:type` ) {
        let type = (value || "planar");

        // If element is not current visible on the screen
        if (this.offsetParent === null) {
          if (this["#type-buttons"].value !== type) {
            this["#type-buttons"].value = type;
            this.#update();
          }
        }
      }
    }
  }

  #onSpaceSelectChange() {
    let color = parseColor(this.value);

    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}))

    if (this["#space-select"].value === "srgb") {
      this.value = serializeColor(
        convertColor(color, "srgb", {inGamut: true}),
        {format: "hex"}
      );
    }
    else {
      this.value =  serializeColor(
        convertColor(color, this["#space-select"].value, {inGamut: true}),
        {precision: COLOR_PRECISION}
      );
    }

    this.dispatchEvent(new CustomEvent("change", {bubbles: true}))
    this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}))
  }

  #onTypeButtonsToggle(event) {
    Xel.setConfig(`${this.localName}:type`, this["#type-buttons"].value);
    this.#update();
  }

  #onSlidersPointerDown(event) {
    if (this["#input"].matches(":focus")) {
      event.stopImmediatePropagation();
    }
  }

  #onSlidersChangeStart(event) {
    this.#isDraggingSlider = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}))
  }

  #onSlidersChange(event) {
    let sliders = event.target;

    if (sliders.space === "srgb") {
      let [r, g, b, a] = event.target.value;

      this.value = serializeColor(
        {space: "srgb", coords: [r, g, b], alpha: a},
        {format: "hex"}
      );
    }
    else if (["srgb-linear", "a98rgb", "p3", "rec2020", "prophoto"].includes(sliders.space)) {
      let [r, g, b, a] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [r, g, b], alpha: a},
        {format: "default", precision: COLOR_PRECISION}
      );
    }
    else if (sliders.space === "lch" || sliders.space === "oklch") {
      let [l, c, h, a] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [l, c, h], alpha: a},
        {format: "default", precision: COLOR_PRECISION}
      );
    }
    else if (sliders.space === "lab" || sliders.space === "oklab") {
      let [l, a, b, alpha] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [l, a, b], alpha: alpha},
        {format: "default", precision: COLOR_PRECISION}
      );
    }
    else if (sliders.space === "xyz-d65" || sliders.space === "xyz-d50") {
      let [x, y, z, a] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [x, y, z], alpha: a},
        {format: "default", precision: COLOR_PRECISION}
      );
    }

    this.dispatchEvent(new CustomEvent("change", {bubbles: true}))
  }

  #onSlidersChangeEnd(event) {
    this.#isDraggingSlider = false;
    this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}))
  }

  #onInputChange(event) {
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let color = parseColor(this["#input"].value);

    if (this["#space-select"].value === "srgb") {
      this.value = serializeColor(
        convertColor(color, "srgb", {inGamut: true}),
        {format: "hex"}
      );
    }
    else {
      this.value = serializeColor(
        convertColor(color, this["#space-select"].value, {inGamut: true}),
        {precision: COLOR_PRECISION}
      );
    }

    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
  }

  #onInputKeyDown(event) {
    // Don't close the popover when user presses enter or space key while inside text input
    if (event.key === "Enter" || event.code === "Space") {
      if (this.closest("x-popover")) {
        event.stopPropagation();
      }
    }
  }

  #onGrabButtonToggle() {
    return new Promise(async (resolve) => {
      let hexColor = await this.grab();
      this["#grab-button"].toggled = false;

      if (hexColor !== null) {
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

        if (this["#space-select"].value === "srgb") {
          this.value = hexColor;
        }
        else {
          this.value = serializeColor(
            convertColor(parseColor(hexColor), this["#space-select"].value, {inGamut: true}),
            {precision: COLOR_PRECISION}
          );
        }

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    let color = this.#getColor();

    this.#updateSpaceSelect(color);
    this.#updateTypeButtons(color);
    this.#updateSliders(color);
    this.#updateInput(color);
    this.#updateGrabButton();
  }

  #updateSpaceSelect(color = this.#getColor()) {
    let allowedSpaces = this.spaces;

    if (allowedSpaces.length === 1) {
      this["#space-select"].hidden = true;
    }
    else {
      this["#space-select"].hidden = false;
      this["#space-select"].disabled = this.disabled;
      this["#space-select"].value = color.spaceId;

      for (let item of this["#space-select-menu"].children) {
        if (item.localName === "x-menuitem") {
          item.disabled = !allowedSpaces.includes(item.value);
        }
      }
    }
  }

  #updateSpaceSelectWarningIcons() {
    let color = this.#getColor();

    for (let item of this["#space-select-menu"].children) {
      if (item.localName === "x-menuitem") {
        let space = item.value;

        if (isColorInGamut(color, space)) {
          item.removeAttribute("data-warn");
        }
        else {
          item.setAttribute("data-warn", "");
        }
      }
    }
  }

  #updateTypeButtons(color = this.#getColor()) {
    let supportedTypes;

    if (["srgb", "srgb-linear", "a98rgb", "p3", "rec2020", "prophoto"].includes(color.spaceId)) {
      supportedTypes = ["planar", "polar", "linear"];
    }
    else if (["lch", "oklch"].includes(color.spaceId)) {
      supportedTypes = ["planar", "linear"];
    }
    else if (["lab", "oklab", "xyz-d65", "xyz-d50"].includes(color.spaceId)) {
      supportedTypes = ["linear"];
    }

    if (supportedTypes.includes(this["#type-buttons"].value) === false) {
      this["#type-buttons"].value = supportedTypes[0];
    }

    for (let button of this["#type-buttons"].children) {
      button.disabled = this.disabled;
      button.hidden = (supportedTypes.includes(button.value) === false || supportedTypes.length <= 1);
    }
  }

  #updateSliders(color = this.#getColor()) {
    let type = this["#type-buttons"].value;
    let space = color.spaceId;
    let value = [...color.coords, color.alpha];
    let localName;

    if (["srgb", "srgb-linear", "a98rgb", "p3", "rec2020", "prophoto"].includes(space)) {
      if (type === "linear") {
        localName = "x-rgblinearsliders";
      }
      else if (type === "planar") {
        localName = "x-rgbplanarsliders";
      }
      else if (type === "polar") {
        localName = "x-rgbpolarsliders";
      }
    }
    else if (space === "lch" || space === "oklch") {
      if (type === "linear") {
        localName = "x-lchlinearsliders";
      }
      else if (type === "planar") {
        localName = "x-lchplanarsliders";
      }
    }
    else if (space === "lab" || space === "oklab") {
      localName = "x-lablinearsliders";
    }
    else if (space === "xyz-d65" || space === "xyz-d50") {
      localName = "x-xyzlinearsliders";
    }

    if (this["#main"].firstElementChild?.localName !== localName) {
      this["#main"].innerHTML = "";
      this["#sliders"] = createElement(localName);
      this["#sliders"].setAttribute("id", "sliders");
      this["#sliders"].setAttribute("exportparts", "slider");
      this["#main"].append(this["#sliders"]);
    }

    this["#sliders"].space = space;
    this["#sliders"].value = value;
    this["#sliders"].alpha = this.alpha;
    this["#sliders"].disabled = this.disabled;
  }

  #updateInput(color = this.#getColor()) {
    this["#input"].space = color.spaceId;
    this["#input"].alpha = this.alpha;
    this["#input"].value = serializeColor(color);
    this["#input"].disabled = this.disabled;
  }

  #updateInputThrottled = throttle(this.#updateInput, 50, this);

  #updateGrabButton() {
    this["#grab-button"].disabled = this.disabled;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #getColor() {
    let color = parseColor(this.value);

    if (this.spaces.includes(color.spaceId) === false) {
      if (color.spaceId === "hsl" || color.spaceId === "hwb") {
        color = convertColor(color, "srgb", {inGamut: true});
      }
      else {
        color = convertColor(color, "p3", {inGamut: true});
      }
    }

    // @bugfix: parseColor() returns inconsistent objects
    {
      if (color.spaceId === undefined) {
        color.spaceId = color.space.id;
      }

      color.coords = color.coords.map(coord => coord * 1);
    }

    return color;
  }
}

if (customElements.get("x-colorpicker") === undefined) {
  customElements.define("x-colorpicker", XColorPickerElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Linear sliders for RGB-based color spaces (sRBG, Linear sRGB, Adobe RGB, Display P3, Rec. 2020, ProPhoto RGB)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XRGBLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="coord-1-slider" class="slider" part="slider">
        <div id="coord-1-slider-track" class="slider-track">
          <div id="coord-1-slider-marker" class="slider-marker"></div>

          <svg id="coord-1-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="coord-1-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="coord-2-slider" class="slider" part="slider">
        <div id="coord-2-slider-track" class="slider-track">
          <div id="coord-2-slider-marker" class="slider-marker"></div>

          <svg id="coord-2-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="coord-2-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="coord-3-slider" class="slider" part="slider">
        <div id="coord-3-slider-track" class="slider-track">
          <div id="coord-3-slider-marker" class="slider-marker"></div>

          <svg id="coord-3-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="coord-3-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="alpha-slider" class="slider" part="slider">
        <div id="alpha-slider-gradient"></div>

        <div id="alpha-slider-track" class="slider-track">
          <div id="alpha-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
          <x-menuitem>
            <x-label><x-message href="#color-model" autocapitalize>Color Model</x-message></x-label>

            <x-menu id="color-model-menu">
              <x-menuitem value="hsv"><x-label>HSV</x-label></x-menuitem>
              <x-menuitem value="okhsv" data-srgb-only><x-label>OK HSV</x-label></x-menuitem>
              <hr/>
              <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
              <x-menuitem value="okhsl" data-srgb-only><x-label>OK HSL</x-label></x-menuitem>
              <x-menuitem value="hsluv" data-srgb-only><x-label>HSLuv</x-label></x-menuitem>
              <hr/>
              <x-menuitem value="hwb"><x-label>HWB</x-label></x-menuitem>
              <hr/>
              <x-menuitem value="rgb"><x-label>RGB</x-label></x-menuitem>
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
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 18px;
    }
    .slider-marker[data-warn="right"]::after {
      right: -26px;
    }
    .slider-marker[data-warn="left"]::after {
      left: -26px;
    }

    .slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    .slider-gamut-polyline {
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

  // @type [number, number, number, number]
  get value() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    // RGB
    if (model === "rgb") {
      let [r, g, b] = this.#coords;
      return [r, g, b, this.#a];
    }
    // (ok)HSV
    else if (model === "hsv" || model === "okhsv") {
      let [h, s, v] = this.#coords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // (ok)HSL, HSLuv
    else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
      let [h, s, l] = this.#coords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HWB
    else if (model === "hwb") {
      let [h, w, b] = this.#coords;
      let [rr, gg, bb] = convertColor({space: "hwb", coords: [h*360, w*100, b*100]}, "srgb").coords;
      return [rr, gg, bb, this.#a];
    }
  }
  set value([r, g, b, a]) {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    // RGB
    if (model === "rgb") {
      this.#coords = [r, g, b];
      this.#a = a;
    }
    // (ok)HSV
    else if (model === "hsv" || model === "okhsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#coords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // (ok)HSL, HSLuv
    else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#coords = [h/360, s/100, l/100];
      this.#a = a;
    }
    // HWB
    else if (model === "hwb") {
      let [hh, ww, bb] = convertColor({space: "srgb", coords: [r, g, b]}, "hwb").coords;
      this.#coords = [hh/360, ww/100, bb/100];
      this.#a = a;
    }

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(this.#coords[0])) {
      this.#coords[0] = 0;
    }

    this.#update();
  }

  // @type "srgb" || "srgb-linear" || "a98rgb" || "p3" || "rec2020" || "prophoto"
  // @default "srgb"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  // @attribute
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot = null;
  #configChangeListener;
  #isDraggingSlider = false;

  #space = "srgb";         // Either "srgb", "srgb-linear", "a98rgb", "p3", "rec2020" or "prophoto"
  #srgbModel = "hsv";      // Model used in "srgb" space, either "hsv", "hsl", "hwb", "okhsv", "okhsl", "hsluv" or "rgb"
  #wideGamutModel = "hsv"; // Model used in other spaces, either "hsv", "hsl", "hwb" or "rgb"
  #gamutHints = "srgb";    // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #coords = [0, 0, 0];     // Values in the current MODEL coordinate system normalized to 0.00 - 1.00 range
  #a = 1;                  // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XRGBLinearSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XRGBLinearSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#coord-1-slider"].addEventListener("pointerdown", (event) => this.#onCoord1SliderPointerDown(event));
    this["#coord-2-slider"].addEventListener("pointerdown", (event) => this.#onCoord2SliderPointerDown(event));
    this["#coord-3-slider"].addEventListener("pointerdown", (event) => this.#onCoord3SliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
  }

  connectedCallback() {
    this.#srgbModel = Xel.getConfig(`${this.localName}:srgbModel`, "hsv");
    this.#wideGamutModel = Xel.getConfig(`${this.localName}:wideGamutModel`, "hsv");
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (origin === "self") {
      if (key === `${this.localName}:wideGamutModel`) {
        let wideGamutModel = (value || "hsv");

        if (wideGamutModel !== this.#wideGamutModel) {
          let [r, g, b] = this.value;
          this.#wideGamutModel = wideGamutModel;
          this.value = [r, g, b, this.#a];
        }
      }
      else if (key === `${this.localName}:srgbModel`) {
        let srgbModel = (value || "hsv");

        if (srgbModel !== this.#srgbModel) {
          let [r, g, b] = this.value;
          this.#srgbModel = srgbModel;
          this.value = [r, g, b, this.#a];
        }
      }
      else if (key === "x-colorpicker:gamutHints") {
        let gamutHints = (value || "srgb");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
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
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
        }
      }
      else if (item.parentElement === this["#color-model-menu"]) {
        let model = item.value;
        let [r, g, b] = this.value;

        this.#srgbModel = model;
        Xel.setConfig(`${this.localName}:srgbModel`, model);

        if (["hsv", "hsl", "hwb", "rgb"].includes(model)) {
          this.#wideGamutModel = model;
          Xel.setConfig(`${this.localName}:wideGamutModel`, model);
        }

        this.value = [r, g, b, this.#a];
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onCoord1SliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let trackBounds = this["#coord-1-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#coord-1-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[0]) {
        this.#coords[0] = coord;

        this.#updateCoord1SliderMarker();
        this.#updateCoord2SliderBackground();
        this.#updateCoord3SliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let trackBounds = this["#coord-2-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#coord-2-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[1]) {
        this.#coords[1] = coord;

        if (model === "rgb") {
          this.#updateCoord1SliderBackground();
        }

        this.#updateCoord2SliderMarker();
        this.#updateCoord2SliderBackground();
        this.#updateCoord3SliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

  #onCoord3SliderPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button > 0 || this.#isDraggingSlider) {
      return;
    }

    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let trackBounds = this["#coord-3-slider-track"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;

    this.#isDraggingSlider = true;
    this["#coord-3-slider"].setPointerCapture(pointerDownEvent.pointerId);
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

    let onPointerMove = (clientX) => {
      let coord = ((clientX - trackBounds.x) / trackBounds.width);
      coord = normalize(coord, 0, 1);

      if (coord !== this.#coords[2]) {
        this.#coords[2] = coord;

        if (model === "rgb") {
          this.#updateCoord1SliderBackground();
          this.#updateCoord2SliderBackground();
        }

        this.#updateCoord3SliderMarker();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    onPointerMove(pointerDownEvent.clientX);

    this["#coord-3-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId === pointerDownEvent.pointerId) {
        onPointerMove(pointerMoveEvent.clientX);
      }
    });

    this["#coord-3-slider"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#coord-3-slider"].removeEventListener("pointermove", pointerMoveListener);
      this["#coord-3-slider"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#coord-3-slider"].removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

      this.#isDraggingSlider = false;
    });

    this["#coord-3-slider"].addEventListener("pointercancel", pointerUpOrCancelListener);
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
    this.#updateCoord1SliderMarker();
    this.#updateCoord1SliderBackground();

    this.#updateCoord2SliderMarker();
    this.#updateCoord2SliderBackground();

    this.#updateCoord3SliderMarker();
    this.#updateCoord3SliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutHints();
    this.#updateContextMenu();
  }

  #updateCoord1SliderMarker() {
    this["#coord-1-slider-marker"].style.left = (this.#coords[0] * 100) + "%";
  }

  #updateCoord1SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [ , g, b] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.space, coords: [0, g, b] },
        { space: this.space, coords: [1, g, b] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.space, coords: [1, 0, 0] },
        { space: this.space, coords: [1, 1, 0] },
        { space: this.space, coords: [0, 1, 0] },
        { space: this.space, coords: [0, 1, 1] },
        { space: this.space, coords: [0, 0, 1] },
        { space: this.space, coords: [1, 0, 1] },
        { space: this.space, coords: [1, 0, 0] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl" || model === "hsluv") {
      let colors = [];

      for (let h = 0; h <= 360; h += 60) {
        colors.push({space: "okhsv", coords: [h, 100, 100]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-1-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  #updateCoord2SliderMarker() {
    this["#coord-2-slider-marker"].style.left = (this.#coords[1] * 100) + "%";
  }

  #updateCoord2SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [r, , b] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.space, coords: [r, 0, b] },
        { space: this.space, coords: [r, 1, b] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let [h] = this.#coords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let colors;

      if (model === "hsv") {
        colors = [
          { space: this.space, coords: convertColor({space: "hsv", coords: [h*360,   0, 100]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, 100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hsl") {
        colors = [
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360,   0, 50]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 100, 50]}, hSpace).coords }
        ];
      }
      else if (model === "hwb") {
        colors = [
          { space: this.space, coords: convertColor({space: "hwb", coords: [h*360,   0,  0]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hwb", coords: [h*360, 100,  0]}, hSpace).coords }
        ];
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl" || model === "hsluv") {
      let [h] = this.#coords;
      let colors = [];

      for (let s = 0; s <= 100; s += 1) {
        colors.push({space: model, coords: [h*360, s, model === "okhsv" ? 100 : 65]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  #updateCoord3SliderMarker() {
    this["#coord-3-slider-marker"].style.left = (this.#coords[2] * 100) + "%";
  }

  #updateCoord3SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [r, g] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.space, coords: [r, g, 0] },
        { space: this.space, coords: [r, g, 1] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-3-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let colors = [];

      if (model === "hsv") {
        let [h, s] = this.#coords;

        colors = [
          { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100,   0]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hsl") {
        let [h, s] = this.#coords;

        colors = [
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,   0]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,  50]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hwb") {
        let [h, w] = this.#coords;

        for (let b = 0; b <= 100; b += 10) {
          colors.push({space: this.space, coords: convertColor({space: "hwb", coords: [h*360, w*100, b]}, hSpace).coords});
        }
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-3-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl" || model === "hsluv") {
      let [h, s] = this.#coords;
      let colors = [];

      for (let l = 0; l <= 100; l += 1) {
        colors.push({space: model, coords: [h*360, s*100, l]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-3-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [r, g, b] = this.#coords;

      let colors = [
        { space: this.space, coords: [r, g, b], alpha: 0 },
        { space: this.space, coords: [r, g, b], alpha: 1 }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(to right, ${colors})`;
    }
    else {
      let [h, a, b] = this.#coords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;
      let colors = [];

      for (let alpha of [0, 1]) {
        colors.push({
          space: this.space,
          coords: convertColor({space: model, coords: [h*360, a*100, b*100]}, hSpace).coords,
          alpha: alpha
        });
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(to right, ${colors})`;
    }
  }

  #updateGamutHints() {
    if (this.#gamutHints === "none") {
      this["#coord-1-slider-gamut-polyline"].removeAttribute("points");
      this["#coord-1-slider-marker"].removeAttribute("data-warn");

      this["#coord-2-slider-gamut-polyline"].removeAttribute("points");
      this["#coord-2-slider-marker"].removeAttribute("data-warn");

      this["#coord-3-slider-gamut-polyline"].removeAttribute("points");
      this["#coord-3-slider-marker"].removeAttribute("data-warn");
    }
    else {
      // @todo
    }
  }

  #updateContextMenu() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === model);
      item.hidden = item.hasAttribute("data-srgb-only") && this.space !== "srgb";
    }

    for (let separator of this["#color-model-menu"].querySelectorAll("hr")) {
      separator.hidden = (this.space !== "srgb");
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-rgblinearsliders") === undefined) {
  customElements.define("x-rgblinearsliders", XRGBLinearSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Linear sliders for LCH-based color spaces (okLCH, CIE LCH)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XLCHLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="hue-slider" class="slider" part="slider">
        <div id="hue-slider-track" class="slider-track">
          <div id="hue-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <div id="chroma-slider" class="slider" part="slider">
        <div id="chroma-slider-track" class="slider-track">
          <div id="chroma-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <div id="lightness-slider" class="slider" part="slider">
        <div id="lightness-slider-track" class="slider-track">
          <div id="lightness-slider-marker" class="slider-marker"></div>

          <svg id="lightness-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="lightness-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="alpha-slider" class="slider" part="slider">
        <div id="alpha-slider-gradient"></div>

        <div id="alpha-slider-track" class="slider-track">
          <div id="alpha-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
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
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 18px;
    }
    .slider-marker[data-warn="right"]::after {
      right: -26px;
    }
    .slider-marker[data-warn="left"]::after {
      left: -26px;
    }

    .slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    .slider-gamut-polyline {
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

  // @type [number, number, number, number]
  get value() {
    let [l, c, h] = this.#coords;
    return [l, c, h, this.#a];
  }
  set value([l, c, h, a]) {
    this.#coords = [l, c, h];
    this.#a = a;

    this.#update();
  }

  // @type "oklch" || "lch"
  // @default "oklch"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  // @attribute
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #isDraggingSlider = false;
  #shadowRoot = null;

  #space = "oklch";
  #coords = [0, 0, 0];
  #a = 1;
  #gamutHints = "srgb";

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
  }

  connectedCallback() {
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");
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
        this.#updateLightnessSliderMarker();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

        this.#updateChromaSliderMarker();
        this.#updateChromaSliderBackground();
        this.#updateLightnessSliderMarker();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

        this.#updateLightnessSliderMarker();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

  #onContextMenuClick(event) {
    let item = event.target.closest("x-menuitem");

    if (item) {
      if (item.parentElement === this["#gamut-hints-menu"]) {
        if (item.value !== this.#gamutHints) {
          this.#gamutHints = item.value;
          this.#update();
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updateHueSliderMarker();
    this.#updateHueSliderBackground();

    this.#updateChromaSliderMarker();
    this.#updateChromaSliderBackground();

    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutHints();
    this.#updateContextMenu();
  }

  #updateHueSliderMarker() {
    let [l, c, h] = this.#coords;
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

  #updateChromaSliderMarker() {
    let [l, c, h] = this.#coords;

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
    this["#chroma-slider"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateLightnessSliderMarker() {
    let [l, c, h] = this.#coords;

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
    this["#lightness-slider"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let [l, c, h] = this.#coords;

    let colors = [
      {space: this.space, coords: [l, c, h], alpha: 0},
      {space: this.space, coords: [l, c, h], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateGamutHints() {
    if (this.#gamutHints === "none") {
      this["#lightness-slider-gamut-polyline"].removeAttribute("points");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let [l, c, h] = this.#coords;
      let points = [];

      if (this.space === "oklch") {
        for (let l = 0; l <= 1.01; l += 0.01) {
          let color = {space: this.space, coords: [l, c, h]};

          if (isColorInGamut(color, this.#gamutHints)) {
            let x = l * 100;
            let y = (c / MAX_OKLCH_CHROMA) * 100;
            points.push([x, y]);
          }
        }
      }
      else if (this.space === "lch") {
        for (let l = 0; l <= 100.5; l += 1.5) {
          let color = {space: this.space, coords: [l, c, h]};

          if (isColorInGamut(color, this.#gamutHints)) {
            let x = l;
            let y = (c / MAX_LCH_CHROMA) * 100;
            points.push([x, y]);
          }
        }
      }

      if (points.length < 2) {
        let currentX = this.space === "oklch" ? l * 100 : l;
        this["#lightness-slider-gamut-polyline"].removeAttribute("points");
        this["#lightness-slider-marker"].setAttribute("data-warn", currentX >= 50 ? "right" : "left");
      }
      else {
        let currentX = this.space === "oklch" ? l * 100 : l;
        let startX = points.at(0)[0];
        let endX = points.at(-1)[0];

        this["#lightness-slider-gamut-polyline"].setAttribute("points", `${startX} 35 ${startX} 17 ${endX} 17 ${endX} 35` );

        if (currentX < startX) {
          this["#lightness-slider-marker"].setAttribute("data-warn", "left");
        }
        else if (currentX > endX) {
          this["#lightness-slider-marker"].setAttribute("data-warn", "right");
        }
        else {
          this["#lightness-slider-marker"].removeAttribute("data-warn");
        }
      }
    }
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-lchlinearsliders") === undefined) {
  customElements.define("x-lchlinearsliders", XLCHLinearSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Linear sliders for LAB-based color spaces (CIE LAB, OK LAB)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XLABLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="a-slider" class="slider" part="slider">
        <div id="a-slider-track" class="slider-track">
          <div id="a-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <div id="b-slider" class="slider" part="slider">
        <div id="b-slider-track" class="slider-track">
          <div id="b-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <div id="lightness-slider" class="slider" part="slider">
        <div id="lightness-slider-track" class="slider-track">
          <div id="lightness-slider-marker" class="slider-marker"></div>

          <svg id="lightness-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="lightness-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="alpha-slider" class="slider" part="slider">
        <div id="alpha-slider-gradient"></div>
        <div id="alpha-slider-track" class="slider-track">
          <div id="alpha-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
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
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 18px;
    }
    .slider-marker[data-warn="right"]::after {
      right: -26px;
    }
    .slider-marker[data-warn="left"]::after {
      left: -26px;
    }

    .slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    .slider-gamut-polyline {
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

  // @type [number, number, number, number]
  get value() {
    let [l, c, h] = this.#coords;
    return [l, c, h, this.#a];
  }
  set value([l, c, h, a]) {
    this.#coords = [l, c, h];
    this.#a = a;

    this.#update();
  }

  // @type "lab" || "oklab"
  // @default "lab"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot = null;
  #configChangeListener;
  #isDraggingSlider = false;

  #space = "lab";       // Either "lab" or "oklab"
  #gamutHints = "srgb"; // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #coords = [0, 0, 0];  // LAB: [0-100, -125-125, -125-125], OK LAB: [0.0-1.0, -0.4-0.4, -0.4-0.4]
  #a = 1;               // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(XLABLinearSlidersElement.#shadowTemplate.content, true));
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XLABLinearSlidersElement.#shadowStyleSheet];

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#a-slider"].addEventListener("pointerdown", (event) => this.#onASliderPointerDown(event));
    this["#b-slider"].addEventListener("pointerdown", (event) => this.#onBSliderPointerDown(event));
    this["#lightness-slider"].addEventListener("pointerdown", (event) => this.#onLightnessSliderPointerDown(event));
    this["#alpha-slider"].addEventListener("pointerdown", (event) => this.#onAlphaSliderPointerDown(event));
    this["#context-menu"].addEventListener("click", (event) => this.#onContextMenuClick(event));
  }

  connectedCallback() {
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");

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
        let gamutHints = (value || "srgb");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
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
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
        this.#updateASliderMarker();
        this.#updateBSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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
        this.#updateASliderBackground();
        this.#updateBSliderMarker();
        this.#updateBSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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
    this.#updateASliderMarker();
    this.#updateASliderBackground();

    this.#updateBSliderMarker();
    this.#updateBSliderBackground();

    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutHints();
    this.#updateContextMenu();
  }

  #updateASliderMarker() {
    let [l, a, b] = this.#coords;

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
        colors.push({space: "oklab", coords: [0.8, a, b]});
      }
    }
    else if (this.#space === "lab") {
      for (let a = -125; a <= 125; a += 5) {
        colors.push({space: "lab", coords: [75, a, b]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#a-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateBSliderMarker() {
    let [l, a, b] = this.#coords;

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
        colors.push({space: "oklab", coords: [0.8, a, b]});
      }
    }
    else if (this.#space === "lab") {
      for (let b = -125; b <= 125; b += 5) {
        colors.push({space: "lab", coords: [75, a, b]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#b-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateLightnessSliderMarker() {
    let [l, a, b] = this.#coords;

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
    this["#lightness-slider"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let [l, a, b] = this.#coords;

    let colors = [
      {space: this.space, coords: [l, a, b], alpha: 0},
      {space: this.space, coords: [l, a, b], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateGamutHints() {
    if (this.#gamutHints === "none") {
      this["#lightness-slider-gamut-polyline"].removeAttribute("points");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      // @todo
    }
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-lablinearsliders") === undefined) {
  customElements.define("x-lablinearsliders", XLABLinearSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Linear sliders for XYZ-based color spaces (CIE XYZ D65, CIE XYZ D50)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XXYZLinearSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="x-slider" class="slider" part="slider">
        <div id="x-slider-track" class="slider-track">
          <div id="x-slider-marker" class="slider-marker"></div>

          <svg id="x-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="x-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="y-slider" class="slider" part="slider">
        <div id="y-slider-track" class="slider-track">
          <div id="y-slider-marker" class="slider-marker"></div>

          <svg id="y-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="y-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="z-slider" class="slider" part="slider">
        <div id="z-slider-track" class="slider-track">
          <div id="z-slider-marker" class="slider-marker"></div>

          <svg id="z-slider-gamut-svg" class="slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="z-slider-gamut-polyline" class="slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="alpha-slider" class="slider" part="slider">
        <div id="alpha-slider-gradient"></div>
        <div id="alpha-slider-track" class="slider-track">
          <div id="alpha-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
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
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 18px;
    }
    .slider-marker[data-warn="right"]::after {
      right: -26px;
    }
    .slider-marker[data-warn="left"]::after {
      left: -26px;
    }

    .slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    .slider-gamut-polyline {
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

  // @type [number, number, number, number]
  get value() {
    let [x, y, z] = this.#coords;
    return [x, y, z, this.#a];
  }
  set value([x, y, z, a]) {
    this.#coords = [x, y, z];
    this.#a = a;

    this.#update();
  }

  // @type "xyz-d65" || "xyz-d50"
  // @default "xyz-d65"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  // @attribute
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot = null;
  #configChangeListener;
  #isDraggingSlider = false;

  #space = "xyz-d65";   // Either "xyz-d65" or "xyz-d50"
  #gamutHints = "srgb"; // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #coords = [0, 0, 0];  // Values normalized to 0 - 1 range
  #a = 1;               // Alpha normalized to 0 ~ 1 range

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
  }

  connectedCallback() {
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");

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
        let gamutHints = (value || "srgb");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
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
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
        }
      }
    }
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
        this.#updateZSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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
        this.#updateYSliderMarker();
        this.#updateYSliderBackground();
        this.#updateZSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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
        this.#updateYSliderBackground();
        this.#updateZSliderMarker();
        this.#updateZSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

    this.#updateYSliderMarker();
    this.#updateYSliderBackground();

    this.#updateZSliderMarker();
    this.#updateZSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateGamutHints();
    this.#updateContextMenu();
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

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let [x, y, z] = this.#coords;

    let colors = [
      {space: this.space, coords: [x, y, z], alpha: 0},
      {space: this.space, coords: [x, y, z], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateGamutHints() {
    if (this.#gamutHints === "none") {
      this["#x-slider-gamut-polyline"].removeAttribute("points");
      this["#x-slider-marker"].removeAttribute("data-warn");

      this["#y-slider-gamut-polyline"].removeAttribute("points");
      this["#y-slider-marker"].removeAttribute("data-warn");

      this["#z-slider-gamut-polyline"].removeAttribute("points");
      this["#z-slider-marker"].removeAttribute("data-warn");
    }
    else {
      // @todo
    }
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-xyzlinearsliders") === undefined) {
  customElements.define("x-xyzlinearsliders", XXYZLinearSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Planar sliders for RGB-based color spaces (sRBG, Linear sRGB, Adobe RGB, Display P3, Rec. 2020, ProPhoto RGB)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XRGBPlanarSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="hue-slider" part="slider">
        <div id="hue-slider-track">
          <div id="hue-slider-marker"></div>
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
          <div id="alpha-slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
          <x-menuitem>
            <x-label><x-message href="#color-model" autocapitalize>Color Model</x-message></x-label>
            <x-menu id="color-model-menu">
              <x-menuitem value="hsv"><x-label>HSV</x-label></x-menuitem>
              <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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
      font-size: 18px;
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
  `;

  // @type [number, number, number, number]
  get value() {
    // HSV
    if (this.#model === "hsv") {
      let [h, s, v] = this.#coords;
      let [r, g, b] = convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#coords;
      let [r, g, b] = convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
  }
  set value([r, g, b, a]) {
    // HSV
    if (this.#model === "hsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, "hsv").coords;
      this.#coords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, "hsl").coords;
      this.#coords = [h/360, s/100, l/100];
      this.#a = a;
    }

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(this.#coords[0])) {
      this.#coords[0] = 0;
    }

    this.#update();
  }

  // @type "srgb" || "srgb-linear" || "a98rgb" || "p3" || "rec2020" || "prophoto"
  // @default "srgb"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  // @attribute
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
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

  #space = "srgb";       // Either "srgb", "srgb-linear", "a98rgb", "p3", "rec2020" or "prophoto"
  #model = "hsv";        // Either "hsv" or "hsl"
  #gamutHints = "srgb";  // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #coords = [0, 0, 0];   // Values in the current MODEL coordinate system normalized to 0.00 - 1.00 range
  #a = 1;                // Alpha normalized to 0 ~ 1 range

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
  }

  connectedCallback() {
    this.#model = Xel.getConfig(`${this.localName}:model`, "hsv");
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");
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
        let model = (value || "hsv");

        if (model !== this.#model) {
          let [r, g, b] = this.value;
          this.#model = model;
          this.value = [r, g, b, this.#a];
        }
      }
      else if (key === "x-colorpicker:gamutHints") {
        let gamutHints = (value || "srgb");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
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
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
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
    }
  }

  #onResize() {
    this.#updatePlanarSliderGamutLineThrottled();
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
        this.#updatePlanarSliderMarker();
        this.#updatePlanarSliderBackground();
        this.#updatePlanarSliderGamutLineThrottled();
        this.#updateAlphaSliderBackground();

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

      this.#updatePlanarSliderMarker();
      this.#updateAlphaSliderBackground();
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

    this.#updatePlanarSliderMarker();
    this.#updatePlanarSliderBackground();
    this.#updatePlanarSliderGamutLine();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateContextMenu();
  }

  #updateHueSliderMarker() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h] = this.#coords;
      this["#hue-slider-marker"].style.left = (h * 100) + "%";
    }
  }

  #updateHueSliderBackground() {
    let colors;

    if (this.#model === "hsv" || this.#model === "hsl") {
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";

      colors = [
        { space: this.space, coords: [1, 0, 0] },
        { space: this.space, coords: [1, 1, 0] },
        { space: this.space, coords: [0, 1, 0] },
        { space: this.space, coords: [0, 1, 1] },
        { space: this.space, coords: [0, 0, 1] },
        { space: this.space, coords: [1, 0, 1] },
        { space: this.space, coords: [1, 0, 0] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#hue-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }
  }

  #updatePlanarSliderMarker() {
    if (this.#model === "hsv") {
      let [h, s, v] = this.#coords;
      let left = s * 100;
      let top = 100 - (v * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#coords;
      let left = s * 100;
      let top = 100 - (l * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }

    if (this.#gamutHints === "none") {
      this["#planar-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let [h, s, v] = this.#coords;

      let color = {
        space: this.space,
        coords: convertColor({space: this.#model, coords: [h*360, s*100, v*100]}, "srgb").coords
      };

      if (isColorInGamut(color, this.#gamutHints)) {
        this["#planar-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#planar-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updatePlanarSliderBackground() {
    if (this.#model === "hsv") {
      let [h] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let bg1Colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360,   0, 100]}, hSpace).coords},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, 100, 100]}, hSpace).coords}
      ];

      let bg2Colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, 0, 100]}, hSpace).coords},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, 0,   0]}, hSpace).coords}
      ];

      this["#planar-slider"].style.background = `
        linear-gradient(in ${interpolation} to bottom, ${bg2Colors.map(c => serializeColor(c)).join(",")}),
        linear-gradient(in ${interpolation} to right,  ${bg1Colors.map(c => serializeColor(c)).join(",")})
      `;

      this["#planar-slider"].style.backgroundBlendMode = "multiply, normal";
    }
    else if (this.#model === "hsl") {
      let [h] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let bg1Colors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360,   0, 50]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360,   100, 50]}, hSpace).coords },
      ];

      let bg2Colors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 0, 100]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 0, 100]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 0, 0]}, hSpace).coords },
      ];

      // @bug: Colors with alpha channel are not interpolated correctly in srgb-linear color space
      let bg3Colors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 0, 100]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 0, 0]}, hSpace).coords, alpha: 0},
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 0, 0]}, hSpace).coords, alpha: 0},
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

  #updatePlanarSliderGamutLine() {
    if (
      (this.#gamutHints === "none") ||
      (this.#gamutHints === "srgb" && ["srgb", "srgb-linear"].includes(this.space)) ||
      (this.#gamutHints === "p3" && ["srgb", "srgb-linear", "p3"].includes(this.space)) ||
      (this.#gamutHints === "a98rgb" && ["srgb", "srgb-linear", "a98rgb"].includes(this.space)) ||
      (this.#gamutHints === "rec2020" && ["srgb", "srgb-linear", "a98rgb", "p3", "rec2020"].includes(this.space)) ||
      (this.#gamutHints === "prophoto")
    ) {
      this["#planar-slider-gamut-path"].style.d = null;
    }
    else {
      let width = this.clientWidth;
      let height = this.clientHeight;
      let step = 1 / window.devicePixelRatio;
      let [h] = this.#coords;
      let points = [];

      let isInGamut = (h, s, lv) => {
        let color = {
          space: this.space,
          coords: convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, "srgb").coords
        };

        return isColorInGamut(color, this.#gamutHints);
      };

      if (this.#model === "hsv") {
        let col = 0;

        for (let row = 0; row < height; row += step) {
          while (col <= width) {
            if (isInGamut(h, col/width, 1-(row/height)) === false) {
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
            if (isInGamut(h, col/width, 1-(row/height))) {
              break;
            }
            else {
              col -= 10;
            }
          }

          let maxCol = Math.min(col + 10, width);

          while (col <= maxCol) {
            col += step;

            if (isInGamut(h, col/width, 1-(row/height)) === false) {
              break;
            }
          }

          points.push([col, row]);
        }
      }

      if (points.length === 0) {
        this["#planar-slider-gamut-path"].style.d = null;
      }
      else {
        let d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
        this["#planar-slider-gamut-path"].style.d = `path("${d}")`;
        this["#planar-slider-gamut-svg"].setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
    }
  }

  #updatePlanarSliderGamutLineThrottled = throttle(this.#updatePlanarSliderGamutLine, 40, this);

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s, v] = this.#coords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#coords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  #updateContextMenu() {
    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#model);
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-rgbplanarsliders") === undefined) {
  customElements.define("x-rgbplanarsliders", XRGBPlanarSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Planar sliders for LCH-based color spaces (CIE LCH, OK LCH)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XLCHPlanarSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="hue-slider" part="slider">
        <div id="hue-slider-track">
          <div id="hue-slider-marker"></div>
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
          <div id="alpha-slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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
      font-size: 18px;
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
  `;

  // @type [number, number, number, number]
  get value() {
    let [l, c, h] = this.#coords;
    return [l, c, h, this.#a];
  }
  set value([l, c, h, a]) {
    this.#coords = [l, c, h];
    this.#a = a;

    this.#update();
  }

  // @type "lch" || "oklch"
  // @default "lch"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  // @attribute
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
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

  #space = "lch";       // Either "lch" or "oklch"
  #gamutHints = "srgb"; // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #coords = [0, 0, 0];  // LCH: [0-100, 0-150, 0-360], OK LCH: [0.0-1.0, 0.0-0.4, 0-360]
  #a = 1;               // Alpha normalized to 0 ~ 1 range

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
  }

  connectedCallback() {
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");
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
        let gamutHints = (value || "srgb");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
        }
      }
    }
  }

  #onResize() {
    this.#updatePlanarSliderGamutLineThrottled();
  }

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
        this.#updatePlanarSliderMarker();
        this.#updatePlanarSliderBackground();
        this.#updatePlanarSliderGamutLineThrottled();
        this.#updateAlphaSliderBackground();

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

      if (this.space === "lch") {
        l = x * 100;
        c = (1 - y) * MAX_LCH_CHROMA;
      }
      else if (this.space === "oklch") {
        l = x;
        c = (1 - y) * MAX_OKLCH_CHROMA;
      }

      this.#coords = [l, c, h];

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePlanarSliderMarker();
      this.#updateAlphaSliderBackground();
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

  #onContextMenuClick(event) {
    let item = event.target.closest("x-menuitem");

    if (item) {
      if (item.parentElement === this["#gamut-hints-menu"]) {
        if (item.value !== this.#gamutHints) {
          this.#gamutHints = item.value;
          this.#update();
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updateHueSliderMarker();
    this.#updateHueSliderBackground();

    this.#updatePlanarSliderMarker();
    this.#updatePlanarSliderBackground();
    this.#updatePlanarSliderGamutLine();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateContextMenu();
  }

  #updateHueSliderMarker() {
    let [l, c, h] = this.#coords;
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

  #updatePlanarSliderMarker() {
    if (this.space === "lch") {
      let [l, c] = this.#coords;
      let left = l;
      let top = 100 - ((c / MAX_LCH_CHROMA) * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
    else if (this.space === "oklch") {
      let [l, c] = this.#coords;
      let left = l * 100;
      let top = 100 - ((c / MAX_OKLCH_CHROMA) * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }

    if (this.#gamutHints === "none") {
      this["#planar-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let inGamut = isColorInGamut({space: this.space, coords: [...this.#coords]}, this.#gamutHints)

      if (inGamut) {
        this["#planar-slider-marker"].removeAttribute("data-warn");
      }
      else {
        this["#planar-slider-marker"].setAttribute("data-warn", "");
      }
    }
  }

  #updatePlanarSliderBackground() {
    let [l, c, h] = this.#coords;
    let backgroundColors = [];
    let overlayColors = [];

    if (this.space === "lch") {
      for (let l = 0; l <= 100; l += 1) {
        backgroundColors.push({space: this.space, coords: [l, MAX_LCH_CHROMA, h]});
      }

      for (let a = 0; a <= 1; a += 0.01) {
        overlayColors.push({space: this.space, coords: [100, 0, h], alpha: a});
      }
    }
    else if (this.space === "oklch") {
      for (let l = 0; l <= 1; l += 0.01) {
        backgroundColors.push({space: this.space, coords: [l, MAX_OKLCH_CHROMA, h]});
      }

      for (let a = 0; a <= 1; a += 0.01) {
        overlayColors.push({space: this.space, coords: [1, 0, h], alpha: a});
      }
    }

    this["#planar-slider"].style.background = `
      linear-gradient(in ${this.space} to bottom, ${overlayColors.map(c => serializeColor(c)).join(",")}),
      linear-gradient(in ${this.space} to right,  ${backgroundColors.map(c => serializeColor(c)).join(",")})
    `;

    this["#planar-slider"].style.backgroundBlendMode = "color, normal";
  }

  #updatePlanarSliderGamutLine() {
    if (this.#gamutHints === "none") {
      this["#planar-slider-gamut-path"].style.d = null;
    }
    else {
      let width = this.clientWidth;
      let height = this.clientHeight;
      let step = 1 / window.devicePixelRatio;
      let [, , h] = this.#coords;
      let points = [];

      let isInGamut = (l, c, h) => {
        let color;

        if (this.space === "lch") {
          color = {space: "lch", coords: [l*100, c*MAX_LCH_CHROMA, h]};
        }
        else if (this.space === "oklch") {
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
        this["#planar-slider-gamut-path"].style.d = null;
      }
      else {
        let d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
        this["#planar-slider-gamut-path"].style.d = `path("${d}")`;
        this["#planar-slider-gamut-svg"].setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
    }
  }

  #updatePlanarSliderGamutLineThrottled = throttle(this.#updatePlanarSliderGamutLine, 40, this);

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let [l, c, h] = this.#coords;

    let colors = [
      {space: this.space, coords: [l, c, h], alpha: 0},
      {space: this.space, coords: [l, c, h], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.space} to right, ${colors.join(",")})`;
  }

  #updateContextMenu() {
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-lchplanarsliders") === undefined) {
  customElements.define("x-lchplanarsliders", XLCHPlanarSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Polar sliders for RGB-based color spaces (sRBG, Linear sRGB, Adobe RGB, Display P3, Rec. 2020, ProPhoto RGB)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
class XRGBPolarSlidersElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="polar-slider" part="slider">
        <div id="polar-slider-circle">
          <div id="polar-slider-marker"></div>
        </div>
      </div>

      <div id="linear-slider" part="slider">
        <div id="linear-slider-track">
          <div id="linear-slider-marker"></div>

          <svg id="linear-slider-gamut-svg" viewBox="0 0 100 35" preserveAspectRatio="none">
            <polyline id="linear-slider-gamut-polyline"></polyline>
          </svg>
        </div>
      </div>

      <div id="alpha-slider" part="slider">
        <div id="alpha-slider-gradient"></div>
        <div id="alpha-slider-track">
          <div id="alpha-slider-marker"></div>
        </div>
      </div>

      <x-contextmenu id="context-menu">
        <x-menu>
          <x-menuitem>
            <x-label><x-message href="#color-model" autocapitalize>Color Model</x-message></x-label>
            <x-menu id="color-model-menu">
              <x-menuitem value="hsv"><x-label>HSV</x-label></x-menuitem>
              <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
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
      transform: translate(calc(var(--marker-size) / -2), calc(var(--marker-size) / -2));
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 3px solid white;
      border-radius: 999px;
      box-shadow: 0 0 3px black;
      --marker-size: 20px;
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
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(1px 1px 1px black);
      pointer-events: none;
      font-size: 18px;
    }
    #linear-slider-marker[data-warn="right"]::after {
      right: -26px;
    }
    #linear-slider-marker[data-warn="left"]::after {
      left: -26px;
    }

    #linear-slider-gamut-svg {
      width: 100%;
      height: 100%;
    }

    #linear-slider-gamut-polyline {
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
  `;

  // @type [number, number, number, number]
  get value() {
    // HSV
    if (this.#model === "hsv") {
      let [h, s, v] = this.#coords;
      let [r, g, b] = convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#coords;
      let [r, g, b] = convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
  }
  set value([r, g, b, a]) {
    // HSV
    if (this.#model === "hsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, "hsv").coords;
      this.#coords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, "hsl").coords;
      this.#coords = [h/360, s/100, l/100];
      this.#a = a;
    }

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(this.#coords[0])) {
      this.#coords[0] = 0;
    }

    this.#update();
  }

  // @type "srgb" || "srgb-linear"|| "a98rgb" || "p3" || "rec2020" || "prophoto"
  // @default "srgb"
  get space() {
    return this.#space;
  }
  set space(space) {
    if (this.#space !== space) {
      this.#space = space;
      this.#update();
    }
  }

  // @type boolean
  // @default false
  // @attribute
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @type boolean
  // @default false
  // @attribute
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

  #space = "srgb";       // Either "srgb", "srgb-linear", "a98rgb", "p3", "rec2020" or "prophoto"
  #model = "hsv";        // Either "hsv" or "hsl"
  #gamutHints = "srgb";  // Either "srgb", "a98rgb", "p3", "rec2020" or "prophoto"
  #coords = [0, 0, 0];   // Values in the current MODEL coordinate system normalized to 0.00 - 1.00 range
  #a = 1;                // Alpha normalized to 0 ~ 1 range

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
  }

  connectedCallback() {
    this.#model = Xel.getConfig(`${this.localName}:model`, "hsv");
    this.#gamutHints = Xel.getConfig("x-colorpicker:gamutHints", "srgb");
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
        let model = (value || "hsv");

        if (model !== this.#model) {
          let [r, g, b] = this.value;
          this.#model = model;
          this.value = [r, g, b, this.#a];
        }
      }
      else if (key === "x-colorpicker:gamutHints") {
        let gamutHints = (value || "srgb");

        if (gamutHints !== this.#gamutHints) {
          this.#gamutHints = gamutHints;
          this.#update();
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
          Xel.setConfig("x-colorpicker:gamutHints", this.#gamutHints);
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
    }
  }

  #onResize() {
    // @todo: Might need to redraw if using canvas-based color wheel
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
      let d = pow(x, 2) + pow(y, 2);
      let theta = atan2(y, x);

      if (d > pow(radius, 2)) {
        x = radius * cos(theta);
        y = radius * sin(theta);
        d = pow(x, 2) + pow(y, 2);
        theta = atan2(y, x);
      }

      this.#coords[0] = (theta + PI) / (PI * 2);
      this.#coords[1] = sqrt(d) / radius;

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePolarSliderMarker();
      this.#updateLinearSliderBackground();
      this.#updateAlphaSliderBackground();
      this.#updateGamutHints();
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
        this.#updatePolarSliderBackground();
        this.#updateAlphaSliderBackground();
        this.#updateGamutHints();

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

    this.#updateLinearSliderMarker();
    this.#updateLinearSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateContextMenu();
    this.#updateGamutHints();
  }

  #updatePolarSliderMarker() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, s] = this.#coords;
      let wheelSize = 100;
      let angle = degToRad(h*360);
      let radius = s * wheelSize/2;
      let centerPoint = {x: wheelSize/2, y: wheelSize/2};

      let x = ((wheelSize - (centerPoint.x + (radius * cos(angle)))) / wheelSize) * 100;
      let y = ((centerPoint.y - (radius * sin(angle))) / wheelSize) * 100;

      this["#polar-slider-marker"].style.left = x + "%";
      this["#polar-slider-marker"].style.top = y + "%";
    }
  }

  #updatePolarSliderBackground() {
    if (this.#model === "hsv") {
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let overlayColors = [
        { space: this.space, coords: convertColor({space: "hsv", coords: [0, 0, 100]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsv", coords: [0, 0,   0]}, hSpace).coords },
      ];

      let backgroundColors = [
        { space: this.space, coords: [1, 0, 0] },
        { space: this.space, coords: [1, 1, 0] },
        { space: this.space, coords: [0, 1, 0] },
        { space: this.space, coords: [0, 1, 1] },
        { space: this.space, coords: [0, 0, 1] },
        { space: this.space, coords: [1, 0, 1] },
        { space: this.space, coords: [1, 0, 0] }
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
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let overlayColors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [0, 0, 50]}, hSpace).coords, alpha: 1 },
        { space: this.space, coords: convertColor({space: "hsl", coords: [0, 0, 50]}, hSpace).coords, alpha: 0 },
      ];

      let backgroundColors = [
        { space: this.space, coords: [1, 0, 0] },
        { space: this.space, coords: [1, 1, 0] },
        { space: this.space, coords: [0, 1, 0] },
        { space: this.space, coords: [0, 1, 1] },
        { space: this.space, coords: [0, 0, 1] },
        { space: this.space, coords: [1, 0, 1] },
        { space: this.space, coords: [1, 0, 0] }
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

  #updateLinearSliderMarker() {
    if (this.#model === "hsv") {
      let [h, , v] = this.#coords;
      this["#linear-slider-marker"].style.left = (v * 100) + "%";
    }
    else if (this.#model === "hsl") {
      let [h, , l] = this.#coords;
      this["#linear-slider-marker"].style.left = (l * 100) + "%";
    }
  }

  #updateLinearSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100,   0]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, 100]}, hSpace).coords }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#linear-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }
    else if (this.#model === "hsl") {
      let [h, s] = this.#coords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,   0]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,  50]}, hSpace).coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, 100]}, hSpace).coords }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#linear-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }
  }

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s, v] = this.#coords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#coords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  #updateGamutHints() {
    if (this.#gamutHints === "none") {
      this["#linear-slider-gamut-polyline"].removeAttribute("points");
      this["#linear-slider-marker"].removeAttribute("data-warn");
    }
    else {
      // @todo
    }
  }

  #updateContextMenu() {
    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#model);
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }
  }
}

if (customElements.get("x-rgbpolarsliders") === undefined) {
  customElements.define("x-rgbpolarsliders", XRGBPolarSlidersElement);
}
