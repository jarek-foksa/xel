
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {convertColor, parseColor, serializeColor, normalizeColorSpaceName, isColorInGamut} from "../utils/color.js";
import {createElement} from "../utils/element.js";
import {degToRad, normalize, round, rotatePoint} from "../utils/math.js";
import {html, css} from "../utils/template.js";
import {throttle} from "../utils/time.js";

let {PI, sin, cos, pow, atan2, sqrt, min, max} = Math;
let {isNaN} = Number;

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

        <x-button id="grab-button" part="grab-button" size="small" condensed togglable>
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
      let convertedColor = convertColor(color, this["#space-select"].value, {inGamut: true});

      // Convert missing components to 0
      // @doc https://www.w3.org/TR/css-color-4/#missing
      for (let i = 0; i < convertedColor.coords.length; i += 1) {
        if (convertedColor.coords[i] === null || isNaN(convertedColor.coords[i])) {
          convertedColor.coords[i] = 0;
        }
      }

      this.value =  serializeColor(convertedColor, {precision: COLOR_PRECISION});
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
      let [r, g, b, alpha] = event.target.value;

      this.value = serializeColor(
        {space: "srgb", coords: [r, g, b], alpha},
        {format: "hex"}
      );
    }
    else if (["srgb-linear", "a98rgb", "p3", "rec2020", "prophoto"].includes(sliders.space)) {
      let [r, g, b, alpha] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [r, g, b], alpha},
        {format: "default", precision: COLOR_PRECISION}
      );
    }
    else if (sliders.space === "lch" || sliders.space === "oklch") {
      let [l, c, h, alpha] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [l, c, h], alpha},
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
      let [x, y, z, alpha] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [x, y, z], alpha},
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

    this["#space-select"].value = color.spaceId;

    if (allowedSpaces.length === 1) {
      this["#space-select"].hidden = true;
    }
    else {
      this["#space-select"].hidden = false;
      this["#space-select"].disabled = this.disabled;

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
    else if (["lch", "oklch", "lab", "oklab", "xyz-d65", "xyz-d50"].includes(color.spaceId)) {
      supportedTypes = ["planar", "linear"];
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
      if (type === "linear") {
        localName = "x-lablinearsliders";
      }
      else if (type === "planar") {
        localName = "x-labplanarsliders";
      }
    }
    else if (space === "xyz-d65" || space === "xyz-d50") {
      if (type === "linear") {
        localName = "x-xyzlinearsliders";
      }
      else if (type === "planar") {
        localName = "x-xyzplanarsliders";
      }
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

    // Convert missing components to 0
    // @doc https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < color.coords.length; i += 1) {
      if (color.coords[i] === null || isNaN(color.coords[i])) {
        color.coords[i] = 0;
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
      font-size: 18px;
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
      font-size: 10px;
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
    else if (model === "hwb") {
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
    // @doc https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < this.#coords.length; i += 1) {
      if (this.#coords[i] === null || isNaN(this.#coords[i])) {
        this.#coords[i] = 0;
      }
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
    this.#model = Xel.getConfig(`${this.localName}:model`, "hsv");
    this.#gamutHints = normalizeColorSpaceName(Xel.getConfig("x-colorpicker:gamutHints", "srgb"), "color.js");
    this.#labels = Xel.getConfig("x-colorpicker:labels", true);

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  #getResolvedModel() {
    let model = this.#model;

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

  #updateCoord0SliderGamutPath() {
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
        let [, coord1, coord2] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let coord0 = (column / width);
          let color;

          if (model === "hsv" || model === "hsl" || model === "hwb") {
            color = {
              space: this.#space,
              coords: convertColor({space: model, coords: [coord0*360, coord1*100, coord2*100]}, "srgb").coords
            };
          }
          else if (model === "rgb") {
            color = {
              space: this.#space,
              coords: [coord0, coord1, coord2]
            };
          }

          if (isColorInGamut(color, gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(coord0 * 100);
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

  #updateCoord1SliderGamutPath() {
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
        let [coord0, , coord2] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let coord1 = (column / width);
          let color;

          if (model === "hsv" || model === "hsl" || model === "hwb") {
            color = {
              space: this.#space,
              coords: convertColor({space: model, coords: [coord0*360, coord1*100, coord2*100]}, "srgb").coords
            };
          }
          else if (model === "rgb") {
            color = {
              space: this.#space,
              coords: [coord0, coord1, coord2]
            };
          }

          if (isColorInGamut(color, gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(coord1 * 100);
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

  #updateCoord2SliderGamutPath() {
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
        let [coord0, coord1] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let coord2 = (column / width);
          let color;

          if (model === "hsv" || model === "hsl" || model === "hwb") {
            color = {
              space: this.#space,
              coords: convertColor({space: model, coords: [coord0*360, coord1*100, coord2*100]}, "srgb").coords
            };
          }
          else if (model === "rgb") {
            color = {
              space: this.#space,
              coords: [coord0, coord1, coord2]
            };
          }

          if (isColorInGamut(color, gamutHints)) {
            if (range === null) {
              range = [];
              ranges.push(range);
            }

            range.push(coord2 * 100);
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

  #updateGamutWarnings() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#coord-0-slider-marker"].removeAttribute("data-warn");
      this["#coord-1-slider-marker"].removeAttribute("data-warn");
      this["#coord-2-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let model = this.#getResolvedModel();
      let color;

      if (model === "hsv" || model === "hsl" || model === "hwb") {
        let [coord0, coord1, coord2] = this.#coords;

        color = {
          space: this.#space,
          coords: convertColor({space: model, coords: [coord0*360, coord1*100, coord2*100]}, "srgb").coords
        };
      }
      else if (model === "rgb") {
        let [r, g, b] = this.#coords;

        color = {
          space: this.#space,
          coords: [...this.#coords]
        };
      }

      if (isColorInGamut(color, gamutHints)) {
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
    let model = this.#getResolvedModel();

    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === model);
      item.hidden = item.hasAttribute("data-srgb-only") && this.#space !== "srgb";
    }

    for (let separator of this["#color-model-menu"].querySelectorAll("hr")) {
      separator.hidden = (this.#space !== "srgb" && separator.nextElementSibling?.value !== "rgb");
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
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
      font-size: 18px;
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
      font-size: 10px;
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
      font-size: 18px;
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
      font-size: 10px;
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
    let [l, a, b] = this.#coords;

    if (this.#space === "oklab") {
      this["#lightness-slider-marker"].style.left = (l * 100) + "%";
    }
    else if (this.#space === "lab") {
      this["#lightness-slider-marker"].style.left = l + "%";
    }
  }

  #updateLightnessSliderBackground() {
    let colors = [];
    let [l, a, b] = this.#coords;

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
        let [, a, b] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let l = (column / width);
          let color;

          if (this.#space === "lab") {
            color = {space: this.#space, coords: [l*100, a, b]};
          }
          else if (this.#space === "oklab") {
            color = {space: this.#space, coords: [l, a, b]};
          }

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

  #updateASliderGamutPath() {
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
          let color;

          if (this.#space === "lab") {
            color = {space: this.#space, coords: [l, (a * 250) - 125, b]};
          }
          else if (this.#space === "oklab") {
            color = {space: this.#space, coords: [l, (a * 0.8) - 0.4, b]};
          }

          if (isColorInGamut(color, this.#gamutHints)) {
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

  #updateBSliderGamutPath() {
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
          let color;

          if (this.#space === "lab") {
            color = {space: this.#space, coords: [l, a, (b * 250) - 125]};
          }
          else if (this.#space === "oklab") {
            color = {space: this.#space, coords: [l, a, (b * 0.8) - 0.4]};
          }

          if (isColorInGamut(color, this.#gamutHints)) {
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

  #updateGamutWarnings() {
    if (this.#gamutHints === "none") {
      this["#a-slider-marker"].removeAttribute("data-warn");
      this["#b-slider-marker"].removeAttribute("data-warn");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let color = {space: this.#space, coords: this.#coords};

      if (isColorInGamut(color, this.#gamutHints)) {
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
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
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
      font-size: 18px;
    }

    .slider-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      font-size: 10px;
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
      font-size: 18px;
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
      font-size: 10px;
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
      font-size: 10px;
    }
  `;

  // @type [number, number, number, number]
  get value() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, c1, c2] = this.#coords;
      let [r, g, b] = convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
  }
  set value([r, g, b, a]) {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, c1, c2] = convertColor({space: "srgb", coords: [r, g, b]}, this.#model).coords;
      this.#coords = [h/360, c1/100, c2/100];
      this.#a = a;
    }

    // Convert missing components to 0
    // @doc https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < this.#coords.length; i += 1) {
      if (this.#coords[i] === null || isNaN(this.#coords[i])) {
        this.#coords[i] = 0;
      }
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

  #updateHueSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#hue-slider-gamut-path"].removeAttribute("d");
    }
    else {
      if (this.#model === "hsv" || this.#model === "hsl") {
        let [h, c1, c2] = this.#coords;
        let width = this["#hue-slider"].clientWidth;
        let step = 1 / window.devicePixelRatio;
        let ranges = [];

        // Determine ranges
        {
          let range = null;

          for (let column = 0; column <= width; column += step) {
            let h = (column / width);

            let color = {
              space: this.#space,
              coords: convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords
            };

            if (isColorInGamut(color, gamutHints)) {
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
      let [c0, c1, c2] = this.#coords;
      let left = c1 * 100;
      let top = 100 - (c2 * 100);

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

  #updatePlanarSliderGamutPath() {
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
        let color = {
          space: this.#space,
          coords: convertColor({space: this.#model, coords: [h*360, s*100, lv*100]}, "srgb").coords
        };

        return isColorInGamut(color, gamutHints);
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

          let maxCol = min(col + 10, width);

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

  #updateGamutWarnings() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#hue-slider-marker"].removeAttribute("data-warn");
      this["#planar-slider-marker"].removeAttribute("data-warn");
    }
    else {
      if (this.#model === "hsv" || this.#model === "hsl") {
        let [c0, c1, c2] = this.#coords;

        let color = {
          space: this.#space,
          coords: convertColor({space: this.#model, coords: [c0*360, c1*100, c2*100]}, "srgb").coords
        };

        if (isColorInGamut(color, gamutHints)) {
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
    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#model);
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
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
      font-size: 18px;
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
      font-size: 10px;
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
      font-size: 10px;
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

        let maxRow = max(row + 10, height);

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

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Planar sliders for LAB-based color spaces (CIE LAB, OK LAB)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
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
      font-size: 18px;
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
      font-size: 10px;
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
      font-size: 10px;
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
      let [l, a, b] = this.#coords;
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

  #updatePlanarSliderGamutPath() {
    if (this.#gamutHints === "none") {
      this["#planar-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let width = this["#planar-slider-gamut-svg"].clientWidth;
      let height = this["#planar-slider-gamut-svg"].clientHeight;
      let maxR = sqrt(pow(width/2, 2) + pow(height/2, 2));
      let centerPoint = {x: width/2, y: height/2};
      let [l, a, b] = this.#coords;
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

          if (isColorInGamut({space: this.#space, coords: [l, a, b]}, this.#gamutHints)) {
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

          if (isColorInGamut({space: this.#space, coords: [l, a, b]}, this.#gamutHints) === false) {
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
        let [, a, b] = this.#coords;
        let range = null;

        for (let column = 0; column <= width; column += step) {
          let l = (column / width);
          let color;

          if (this.#space === "lab") {
            color = {space: this.#space, coords: [l*100, a, b]};
          }
          else if (this.#space === "oklab") {
            color = {space: this.#space, coords: [l, a, b]};
          }

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
    let [l, a, b] = this.#coords;

    let colors = [
      {space: this.#space, coords: [l, a, b], alpha: 0},
      {space: this.#space, coords: [l, a, b], alpha: 1}
    ];

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateGamutWarnings() {
    if (this.#gamutHints === "none") {
      this["#planar-slider-marker"].removeAttribute("data-warn");
      this["#lightness-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let inGamut = isColorInGamut({space: this.#space, coords: [...this.#coords]}, this.#gamutHints)

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
    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
  }
}

if (customElements.get("x-labplanarsliders") === undefined) {
  customElements.define("x-labplanarsliders", XLABPlanarSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Planar sliders for XYZ-based color spaces (CIE XYZ D65, CIE XYZ D50)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @event ^change
// @event ^changestart
// @event ^changeend
// @part slider
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
      font-size: 18px;
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
      font-size: 10px;
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
      font-size: 10px;
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
      let maxR = sqrt(pow(width/2, 2) + pow(height/2, 2));
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
      font-size: 18px;
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
      font-size: 18px;
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
      font-size: 10px;
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
      font-size: 10px;
    }
  `;

  // @type [number, number, number, number]
  get value() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, c1, c2] = this.#coords;
      let [r, g, b] = convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
  }
  set value([r, g, b, a]) {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, c1, c2] = convertColor({space: "srgb", coords: [r, g, b]}, this.#model).coords;
      this.#coords = [h/360, c1/100, c2/100];
      this.#a = a;
    }

    // Convert missing components to 0
    // @doc https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < this.#coords.length; i += 1) {
      if (this.#coords[i] === null || isNaN(this.#coords[i])) {
        this.#coords[i] = 0;
      }
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
      let d = pow(x, 2) + pow(y, 2);
      let theta = atan2(y, x);

      if (d > pow(radius, 2)) {
        x = radius * cos(theta);
        y = radius * sin(theta);
        d = pow(x, 2) + pow(y, 2);
        theta = atan2(y, x);
      }

      this.#coords[0] = (theta + PI) / (PI * 2);

      if (this.#model === "hsv" || this.#model === "hsl") {
        this.#coords[1] = sqrt(d) / radius;
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
    let [h, c1, c2] = this.#coords;

    if (this.#model === "hsv" || this.#model === "hsl") {
      let wheelSize = 100;
      let angle = degToRad(h*360);
      let radius = c1 * wheelSize/2;
      let centerPoint = {x: wheelSize/2, y: wheelSize/2};

      let x = ((wheelSize - (centerPoint.x + (radius * cos(angle)))) / wheelSize) * 100;
      let y = ((centerPoint.y - (radius * sin(angle))) / wheelSize) * 100;

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

  #updatePolarSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#polar-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let width = this["#polar-slider-gamut-svg"].clientWidth;
      let height = this["#polar-slider-gamut-svg"].clientHeight;
      let step = 1 / window.devicePixelRatio;
      let [c0, c1, c2] = this.#coords;

      let isInGamut = (h, c1, c2) => {
        let color = {
          space: this.#space,
          coords: convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords
        };

        return isColorInGamut(color, gamutHints);
      };

      let points = [];

      if (this.#model === "hsv" || this.#model === "hsl") {
        for (let h = 0; h <= 1; h += 0.01) {
          for (let row = height/2; row >= 0; row -= step) {
            let c1 = row / (height/2);

            if (isInGamut(h, c1, c2)) {
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
    let [, coord1, coord2] = this.#coords;

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

  #updateLinearSliderGamutPath() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#linear-slider-gamut-path"].removeAttribute("d");
    }
    else {
      let [h, c1, c2] = this.#coords;
      let width = this["#linear-slider"].clientWidth;
      let step = 1 / window.devicePixelRatio;

      let ranges = [];

      // Determine ranges
      {
        let range = null;

        for (let column = 0; column <= width; column += step) {
          if (this.#model === "hsv" || this.#model === "hsl") {
            let c2 = (column / width);

            let color = {
              space: this.#space,
              coords: convertColor({space: this.#model, coords: [h*360, c1*100, c2*100]}, "srgb").coords
            };

            if (isColorInGamut(color, gamutHints)) {
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

  #updateGamutWarnings() {
    let gamutHints = this.#getResolvedGamutHints();

    if (gamutHints === "none") {
      this["#polar-slider-marker"].removeAttribute("data-warn");
      this["#linear-slider-marker"].removeAttribute("data-warn");
    }
    else {
      let [h, s, vl] = this.#coords;

      let color = {
        space: this.#space,
        coords: convertColor({space: this.#model, coords: [h*360, s*100, vl*100]}, "srgb").coords
      };

      if (isColorInGamut(color, gamutHints)) {
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
    for (let item of this["#color-model-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#model);
    }

    for (let item of this["#gamut-hints-menu"].querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === this.#gamutHints);
    }

    this["#labels-menu-item"].toggled = this.#labels;
  }
}

if (customElements.get("x-rgbpolarsliders") === undefined) {
  customElements.define("x-rgbpolarsliders", XRGBPolarSlidersElement);
}
