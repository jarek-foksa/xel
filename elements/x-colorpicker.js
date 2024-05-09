
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {convertColor, parseColor, serializeColor, prettySerializeColor, inGamut} from "../utils/color.js";
import {degToRad, normalize, round} from "../utils/math.js";
import {html, css} from "../utils/template.js";
import {throttle} from "../utils/time.js";

let {PI, sin, cos, pow, atan2, sqrt} = Math;

const COLOR_PRECISION = 3;
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

        if (inGamut(color, space)) {
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
      this["#sliders"] = document.createElement(localName);
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
// Planar sliders for RGB-based color spaces (sRBG, sRGB Linear, Display P3, Rec. 2020, A98 RGB, ProPhoto)
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
          <x-menuitem value="hsv"><x-label>HSV</x-label></x-menuitem>
          <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
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
      box-sizing: border-box;
      transform: translate(calc(var(--marker-size) / -2), calc(var(--marker-size) / -2));
      background: rgba(0, 0, 0, 0.3);
      border: 3px solid white;
      border-radius: 999px;
      box-shadow: 0 0 3px black;
      --marker-size: 20px;
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
      let [h, s, v] = this.#modelCoords;
      let [r, g, b] = convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;
      let [r, g, b] = convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
  }
  set value([r, g, b, a]) {
    // HSV
    if (this.#model === "hsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, "hsv").coords;
      this.#modelCoords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, "hsl").coords;
      this.#modelCoords = [h/360, s/100, l/100];
      this.#a = a;
    }

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(this.#modelCoords[0])) {
      this.#modelCoords[0] = 0;
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
  //
  // Whether to show the alpha slider.
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
  #configChangeListener;

  #space = "srgb";
  #model = "hsv"; // "hsv" or "hsl"
  #modelCoords = [0, 0, 0]; // Coordinates normalized to 0 ~ 1 range
  #a = 1; // Alpha normalized to 0 ~ 1 range

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

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (key === `${this.localName}:model`) {
      let model = (value || "hsv");

      if (model !== this.#model && origin === "self") {
        let [r, g, b] = this.value;
        this.#model = model;
        this.value = [r, g, b, this.#a];
      }
    }
  }

  #onContextMenuClick(event) {
    let item = event.target.closest("x-menuitem");
    let model = item?.value;

    if (model && model !== this.#model) {
      let [r, g, b] = this.value;
      this.#model = model;
      this.value = [r, g, b, this.#a];

      Xel.setConfig(`${this.localName}:model`, item.value);
    }
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

      if (coord !== this.#modelCoords[0]) {
        this.#modelCoords[0] = coord;

        this.#updateHueSliderMarker();
        this.#updatePlanarSliderBackground();
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
        let [h, s, v] = this.#modelCoords;
        s = x;
        v = 1 - y;

        this.#modelCoords = [h, s, v];
      }
      else if (this.#model === "hsl") {
        let [h, s, l] = this.#modelCoords;
        s = x;
        l = 1 - y;

        this.#modelCoords = [h, s, l];
      }

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePlanarSliderMarker();
      this.#updatePlanarSliderBackground();
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

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();

    this.#updateContextMenu();
  }

  /**
   * Hue slider
   */

  #updateHueSliderMarker() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h] = this.#modelCoords;
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

  /**
   * Planar slider
   */

  #updatePlanarSliderMarker() {
    if (this.#model === "hsv") {
      let [h, s, v] = this.#modelCoords;
      let left = s * 100;
      let top = 100 - (v * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;
      let left = s * 100;
      let top = 100 - (l * 100);

      this["#planar-slider-marker"].style.left = `${left}%`;
      this["#planar-slider-marker"].style.top = `${top}%`;
    }
  }

  #updatePlanarSliderBackground() {
    if (this.#model === "hsv") {
      let [h] = this.#modelCoords;
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
      let [h] = this.#modelCoords;
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

  /**
   * Alpha slider
   */

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s, v] = this.#modelCoords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  /**
   * Context menu
   */

  #updateContextMenu() {
    let items = [...this["#context-menu"].querySelectorAll("x-menuitem")];

    for (let item of items) {
      item.toggled = (item.value === this.#model);
    }
  }
}

if (customElements.get("x-rgbplanarsliders") === undefined) {
  customElements.define("x-rgbplanarsliders", XRGBPlanarSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Polar sliders for RGB-based color spaces (sRBG, sRGB Linear, Display P3, Rec. 2020, A98 RGB, ProPhoto)
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
          <x-menuitem value="hsv"><x-label>HSV</x-label></x-menuitem>
          <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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
      let [h, s, v] = this.#modelCoords;
      let [r, g, b] = convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;
      let [r, g, b] = convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
  }
  set value([r, g, b, a]) {
    // HSV
    if (this.#model === "hsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, "hsv").coords;
      this.#modelCoords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // HSL
    else if (this.#model === "hsl") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, "hsl").coords;
      this.#modelCoords = [h/360, s/100, l/100];
      this.#a = a;
    }

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(this.#modelCoords[0])) {
      this.#modelCoords[0] = 0;
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
  //
  // Whether to show the alpha slider.
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
  #configChangeListener;

  #space = "srgb";
  #model = "hsv"; // "hsv" or "hsl"
  #modelCoords = [0, 0, 0]; // Coordinates normalized to 0 ~ 1 range
  #a = 1; // Alpha normalized to 0 ~ 1 range

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

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (key === `${this.localName}:model`) {
      let model = (value || "hsv");

      if (model !== this.#model && origin === "self") {
        let [r, g, b] = this.value;
        this.#model = model;
        this.value = [r, g, b, this.#a];
      }
    }
  }

  #onContextMenuClick(event) {
    let item = event.target.closest("x-menuitem");
    let model = item?.value;

    if (model && model !== this.#model) {
      let [r, g, b] = this.value;
      this.#model = model;
      this.value = [r, g, b, this.#a];

      Xel.setConfig(`${this.localName}:model`, item.value);
    }
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

      this.#modelCoords[0] = (theta + PI) / (PI * 2);
      this.#modelCoords[1] = sqrt(d) / radius;

      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

      this.#updatePolarSliderMarker();
      this.#updateLinearSliderBackground();
      this.#updateAlphaSliderBackground();
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

      if (coord !== this.#modelCoords[2]) {
        this.#modelCoords[2] = coord;

        this.#updateLinearSliderMarker();
        this.#updatePolarSliderBackground();
        this.#updateAlphaSliderBackground();

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
  }

  /**
   * Polar slider
   */

  #updatePolarSliderMarker() {
    if (this.#model === "hsv" || this.#model === "hsl") {
      let [h, s] = this.#modelCoords;
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

  /**
   * Linear slider
   */

  #updateLinearSliderMarker() {
    if (this.#model === "hsv") {
      let [h, , v] = this.#modelCoords;
      this["#linear-slider-marker"].style.left = (v * 100) + "%";
    }
    else if (this.#model === "hsl") {
      let [h, , l] = this.#modelCoords;
      this["#linear-slider-marker"].style.left = (l * 100) + "%";
    }
  }

  #updateLinearSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s] = this.#modelCoords;
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
      let [h, s] = this.#modelCoords;
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

  /**
   * Alpha slider
   */

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    if (this.#model === "hsv") {
      let [h, s, v] = this.#modelCoords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;
      let hSpace = (this.space === "srgb-linear") ? "srgb" : this.space;

      let colors = [
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, hSpace).coords, alpha: 1}
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  /**
   * Context menu
   */

  #updateContextMenu() {
    let items = [...this["#context-menu"].querySelectorAll("x-menuitem")];

    for (let item of items) {
      item.toggled = (item.value === this.#model);
    }
  }
}

if (customElements.get("x-rgbpolarsliders") === undefined) {
  customElements.define("x-rgbpolarsliders", XRGBPolarSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Linear sliders for RGB-based color spaces (sRBG, sRGB Linear, Display P3, Rec. 2020, A98 RGB, ProPhoto)
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
        </div>
      </div>

      <div id="coord-2-slider" class="slider" part="slider">
        <div id="coord-2-slider-track" class="slider-track">
          <div id="coord-2-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <div id="coord-3-slider" class="slider" part="slider">
        <div id="coord-3-slider-track" class="slider-track">
          <div id="coord-3-slider-marker" class="slider-marker"></div>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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
      let [r, g, b] = this.#modelCoords;
      return [r, g, b, this.#a];
    }
    // (ok)HSV
    else if (model === "hsv" || model === "okhsv") {
      let [h, s, v] = this.#modelCoords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s*100, v*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // (ok)HSL, HSLuv
    else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
      let [h, s, l] = this.#modelCoords;
      let [r, g, b] = convertColor({space: model, coords: [h*360, s*100, l*100]}, "srgb").coords;
      return [r, g, b, this.#a];
    }
    // HWB
    else if (model === "hwb") {
      let [h, w, b] = this.#modelCoords;
      let [rr, gg, bb] = convertColor({space: "hwb", coords: [h*360, w*100, b*100]}, "srgb").coords;
      return [rr, gg, bb, this.#a];
    }
  }
  set value([r, g, b, a]) {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    // RGB
    if (model === "rgb") {
      this.#modelCoords = [r, g, b];
      this.#a = a;
    }
    // (ok)HSV
    else if (model === "hsv" || model === "okhsv") {
      let [h, s, v] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#modelCoords = [h/360, s/100, v/100];
      this.#a = a;
    }
    // (ok)HSL, HSLuv
    else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
      let [h, s, l] = convertColor({space: "srgb", coords: [r, g, b]}, model).coords;
      this.#modelCoords = [h/360, s/100, l/100];
      this.#a = a;
    }
    // HWB
    else if (model === "hwb") {
      let [hh, ww, bb] = convertColor({space: "srgb", coords: [r, g, b]}, "hwb").coords;
      this.#modelCoords = [hh/360, ww/100, bb/100];
      this.#a = a;
    }

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(this.#modelCoords[0])) {
      this.#modelCoords[0] = 0;
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
  //
  // Whether to show the alpha slider.
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
  #configChangeListener;

  #space = "srgb";
  #srgbModel = "hsv"; // "hsv", "hsl", "hwb", "okhsv", "okhsl", "hsluv" or "rgb"
  #wideGamutModel = "hsv"; // "hsv", "hsl", "hwb" or "rgb"
  #modelCoords = [0, 0, 0]; // Coordinates normalized to 0 ~ 1 range
  #a = 1; // Alpha normalized to 0 ~ 1 range

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
    }
  }

  #onContextMenuClick(event) {
    let item = event.target.closest("x-menuitem");
    let model = item?.value;

    if (model) {
      let [r, g, b] = this.value;

      this.#srgbModel = model;
      Xel.setConfig(`${this.localName}:srgbModel`, model);

      if (["okhsv", "okhsl", "hsluv"].includes(model) === false) {
        this.#wideGamutModel = model;
        Xel.setConfig(`${this.localName}:wideGamutModel`, model);
      }

      this.value = [r, g, b, this.#a];
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

      if (coord !== this.#modelCoords[0]) {
        this.#modelCoords[0] = coord;

        this.#updateCoord1SliderMarker();
        this.#updateCoord2SliderBackground();
        this.#updateCoord3SliderBackground();
        this.#updateAlphaSliderBackground();

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

      if (coord !== this.#modelCoords[1]) {
        this.#modelCoords[1] = coord;

        if (model === "rgb") {
          this.#updateCoord1SliderBackground();
        }

        this.#updateCoord2SliderMarker();
        this.#updateCoord2SliderBackground();
        this.#updateCoord3SliderBackground();
        this.#updateAlphaSliderBackground();

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

      if (coord !== this.#modelCoords[2]) {
        this.#modelCoords[2] = coord;

        if (model === "rgb") {
          this.#updateCoord1SliderBackground();
          this.#updateCoord2SliderBackground();
        }

        this.#updateCoord3SliderMarker();
        this.#updateAlphaSliderBackground();

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

    this.#updateContextMenu();
  }

  /**
   * Coord 1 slider
   */

  #updateCoord1SliderMarker() {
    this["#coord-1-slider-marker"].style.left = (this.#modelCoords[0] * 100) + "%";
  }

  #updateCoord1SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [ , g, b] = this.#modelCoords;
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

  /**
   * Coord 2 slider
   */

  #updateCoord2SliderMarker() {
    this["#coord-2-slider-marker"].style.left = (this.#modelCoords[1] * 100) + "%";
  }

  #updateCoord2SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [r, , b] = this.#modelCoords;
      let interpolation = (this.space === "srgb-linear") ? "srgb-linear" : "srgb";

      let colors = [
        { space: this.space, coords: [r, 0, b] },
        { space: this.space, coords: [r, 1, b] }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      let [h] = this.#modelCoords;
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
      let [h] = this.#modelCoords;
      let colors = [];

      for (let s = 0; s <= 100; s += 1) {
        colors.push({space: model, coords: [h*360, s, model === "okhsv" ? 100 : 65]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-2-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  /**
   * Coord 3 slider
   */

  #updateCoord3SliderMarker() {
    this["#coord-3-slider-marker"].style.left = (this.#modelCoords[2] * 100) + "%";
  }

  #updateCoord3SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [r, g] = this.#modelCoords;
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
        let [h, s] = this.#modelCoords;

        colors = [
          { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100,   0]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hsl") {
        let [h, s] = this.#modelCoords;

        colors = [
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,   0]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,  50]}, hSpace).coords },
          { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, 100]}, hSpace).coords }
        ];
      }
      else if (model === "hwb") {
        let [h, w] = this.#modelCoords;

        for (let b = 0; b <= 100; b += 10) {
          colors.push({space: this.space, coords: convertColor({space: "hwb", coords: [h*360, w*100, b]}, hSpace).coords});
        }
      }

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#coord-3-slider"].style.background = `linear-gradient(in ${interpolation} to right, ${colors})`;
    }

    else if (model === "okhsv" || model === "okhsl" || model === "hsluv") {
      let [h, s] = this.#modelCoords;
      let colors = [];

      for (let l = 0; l <= 100; l += 1) {
        colors.push({space: model, coords: [h*360, s*100, l]});
      }

      colors = colors.map(color => serializeColor(convertColor(color, "srgb"))).join(",");
      this["#coord-3-slider"].style.background = `linear-gradient(in srgb to right, ${colors})`;
    }
  }

  /**
   * Alpha slider
   */

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;

    if (model === "rgb") {
      let [r, g, b] = this.#modelCoords;

      let colors = [
        { space: this.space, coords: [r, g, b], alpha: 0 },
        { space: this.space, coords: [r, g, b], alpha: 1 }
      ];

      colors = colors.map(color => serializeColor(color)).join(",");
      this["#alpha-slider-gradient"].style.background = `linear-gradient(to right, ${colors})`;
    }
    else {
      let [h, a, b] = this.#modelCoords;
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

  /**
   * Context menu
   */

  #updateContextMenu() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let items = [...this["#context-menu"].querySelectorAll("x-menuitem")];
    let separators = [...this["#context-menu"].querySelectorAll("hr")];

    for (let item of items) {
      item.toggled = (item.value === model);
      item.hidden = item.hasAttribute("data-srgb-only") && this.space !== "srgb";
    }

    for (let separator of separators) {
      separator.hidden = (this.space !== "srgb");
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
          <x-menuitem value="lch" toggled><x-label>LCH</x-label></x-menuitem>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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
  //
  // Whether to show the alpha slider.
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

  #MAX_LCH_CHROMA = 150;
  #MAX_OKLCH_CHROMA = 0.4;

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
        this.#updateLightnessSliderBackground();
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
        coord = normalize(coord * this.#MAX_OKLCH_CHROMA, 0, this.#MAX_OKLCH_CHROMA);
      }
      else if (this.#space === "lch") {
        coord = normalize(coord * this.#MAX_LCH_CHROMA, 0, this.#MAX_LCH_CHROMA);
      }

      if (coord !== this.#coords[1]) {
        this.#coords[1] = coord;

        this.#updateChromaSliderMarker();
        this.#updateChromaSliderBackground();
        this.#updateLightnessSliderBackground();
        this.#updateAlphaSliderBackground();

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

    this.#updateChromaSliderMarker();
    this.#updateChromaSliderBackground();

    this.#updateLightnessSliderMarker();
    this.#updateLightnessSliderBackground();

    this.#updateAlphaSliderMarker();
    this.#updateAlphaSliderBackground();
  }

  #updateHueSliderMarker() {
    let [l, c, h] = this.#coords;
    this["#hue-slider-marker"].style.left = ((h/360) * 100) + "%";
  }

  #updateHueSliderBackground() {
    let colors = [];

    if (this.#space === "oklch") {
      for (let h = 0; h <= 360; h += 5) {
        colors.push({space: "oklch", coords: [0.8, this.#MAX_OKLCH_CHROMA, h]});
      }
    }
    else if (this.#space === "lch") {
      for (let h = 0; h <= 360; h += 5) {
        colors.push({space: "lch", coords: [75, this.#MAX_LCH_CHROMA, h]});
      }
    }

    colors = colors.map(color => serializeColor(color));
    this["#hue-slider"].style.background = `linear-gradient(in ${this.#space} to right, ${colors.join(",")})`;
  }

  #updateChromaSliderMarker() {
    let [l, c, h] = this.#coords;

    if (this.#space === "oklch") {
      // Maximum chroma value is theoretically unbounded, but the slider can show values only up to MAX_OKLCH_CHROMA
      if (c > this.#MAX_OKLCH_CHROMA) {
        this["#chroma-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#chroma-slider-marker"].style.left = ((c / this.#MAX_OKLCH_CHROMA) * 100) + "%";
      }
    }
    else if (this.#space === "lch") {
      // Maximum chroma value is theoretically unbounded, but the slider can show values only up to MAX_LCH_CHROMA
      if (c > this.#MAX_LCH_CHROMA) {
        this["#chroma-slider-marker"].style.left = "calc(100% + 18px)";
      }
      else {
        this["#chroma-slider-marker"].style.left = ((c / this.#MAX_LCH_CHROMA) * 100) + "%";
      }
    }
  }

  #updateChromaSliderBackground() {
    let [, , h] = this.#coords;
    let colors = [];

    if (this.#space === "oklch") {
      for (let c = 0; c <= this.#MAX_OKLCH_CHROMA; c += 0.03) {
        colors.push({space: "oklch", coords: [0.75, c, h]});
      }
    }
    else if (this.#space === "lch") {
      for (let c = 0; c <= this.#MAX_LCH_CHROMA; c += 10) {
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
}

if (customElements.get("x-lchlinearsliders") === undefined) {
  customElements.define("x-lchlinearsliders", XLCHLinearSlidersElement);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Linear sliders for LAB-based color spaces (okLAB, CIE LAB)
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
          <x-menuitem value="lab" toggled><x-label>LAB</x-label></x-menuitem>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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

  // @type "oklab" || "lab"
  // @default "oklab"
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
  //
  // Whether to show the alpha slider.
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

  #space = "oklab";
  #coords = [0, 0, 0];
  #a = 1;

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
        </div>
      </div>

      <div id="y-slider" class="slider" part="slider">
        <div id="y-slider-track" class="slider-track">
          <div id="y-slider-marker" class="slider-marker"></div>
        </div>
      </div>

      <div id="z-slider" class="slider" part="slider">
        <div id="z-slider-track" class="slider-track">
          <div id="z-slider-marker" class="slider-marker"></div>
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
          <x-menuitem value="lab" toggled><x-label>LAB</x-label></x-menuitem>
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
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      background: rgba(0, 0, 0, 0.2);
      border: 3px solid white;
      box-shadow: 0 0 3px black;
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
  //
  // Whether to show the alpha slider.
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

  #space = "xyz-d65";
  #coords = [0, 0, 0];
  #a = 1;

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

        this.#updateZSliderMarker();
        this.#updateZSliderBackground();
        this.#updateAlphaSliderBackground();

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
}

if (customElements.get("x-xyzlinearsliders") === undefined) {
  customElements.define("x-xyzlinearsliders", XXYZLinearSlidersElement);
}
