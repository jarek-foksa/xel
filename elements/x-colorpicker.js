
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {convertColor, parseColor, serializeColor, prettySerializeColor} from "../utils/color.js";
import {degToRad, normalize, round} from "../utils/math.js";
import {html, css} from "../utils/template.js";
import {throttle} from "../utils/time.js";

let {PI, sin, cos, pow, atan2, sqrt} = Math;

const DEBUG = false;
const COLOR_PRECISION = 3;

// @element x-colorpicker
// @event ^change
// @event ^changestart
// @event ^changeend
class XColorPickerElement extends HTMLElement {
  static observedAttributes = ["value", "alpha", "spaces", "disabled", "size"];

  static #shadowTemplate = html`
    <template>
      <header id="header">
        <x-select id="space-select" condensed>
          <x-menu id="space-select-menu">
            <x-menuitem value="srgb" toggled><x-label>sRGB</x-label></x-menuitem>
            <hr/>
            <x-menuitem value="p3"><x-label>Display P3</x-label></x-menuitem>
            <x-menuitem value="rec2020"><x-label>Rec. 2020</x-label></x-menuitem>
            <x-menuitem value="a98rgb"><x-label>A98 RGB</x-label></x-menuitem>
            <x-menuitem value="prophoto"><x-label>ProPhoto</x-label></x-menuitem>
            <!-- TO BE IMPLEMENTED LATER
            <hr/>
            <x-menuitem value="oklch"><x-label>okLCH</x-label></x-menuitem>
            -->
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
        <x-colorinput id="input" space="srgb"></x-colorinput>

        <x-button id="grab-button" condensed togglable>
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
    :host([size="small"]) {
      width: 180px;
    }
    :host([size="large"]) {
      width: 210px;
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
      width: 20px;
      height: 20px;
    }
    #type-buttons x-button[size="small"] x-icon {
      width: 15px;
      height: 15px;
    }
    #type-buttons x-button[size="large"] x-icon {
      width: 22px;
      height: 22px;
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
    :host-context(x-popover) #sliders[alpha] {
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
      flex: 1;
    }
    #input:focus {
      z-index: 1;
    }

    /* Grab button */

    #grab-button {
      margin: 0 0 0 5px;
      padding: 0;
      aspect-ratio: auto 1;
    }
    :host([size="small"]) #grab-button {
      padding: 0 3px;
    }

    :host([size="small"]) #grab-button x-icon {
      width: 14px;
      height: 14px;
    }
    :host([size="large"]) #grab-button x-icon {
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
  // @default ["srgb", "p3", "rec2020", "prophoto", "a98rgb"]
  //
  // Available color spaces.
  get spaces() {
    if (this.hasAttribute("spaces")) {
      return this.getAttribute("spaces").replace(/\s+/g, " ").split(" ");
    }
    else {
      return ["srgb", "p3", "rec2020", "prophoto", "a98rgb"];
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

  // @property
  // @attribute
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  #shadowRoot;
  #configChangeListener;

  #isDraggingSlider = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XColorPickerElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XColorPickerElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#space-select"].addEventListener("change", () => this.#onSpaceSelectChange());
    this["#type-buttons"].addEventListener("toggle", (event) => this.#onTypeButtonsToggle());

    this["#main"].addEventListener("pointerdown", (event) => this.#onSlidersPointerDown(event), true);
    this["#main"].addEventListener("changestart", (event) => this.#onSlidersChangeStart(event));
    this["#main"].addEventListener("change", (event) => this.#onSlidersChange(event));
    this["#main"].addEventListener("changeend", (event) => this.#onSlidersChangeEnd(event));

    this["#input"].addEventListener("change", (event) => this.#onInputChange(event));
    this["#input"].addEventListener("keydown", (event) => this.#onInputKeyDown(event));

    this["#grab-button"].addEventListener("toggle", () => this.#onGrabButtonToggle());
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
    else if (name === "size") {
      this.#onSizeAttributeChange();
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

  #onSizeAttributeChange() {
    this["#space-select"].size = this.size;
    [...this["#type-buttons"].children].forEach(button => button.size = this.size);
    this["#input"].size = this.size;
    this["#grab-button"].size = this.size;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (key === `${this.localName}:type` ) {
      // If element is not current visible on the screen
      if (this.offsetParent === null) {
        if (this["#type-buttons"].value !== value) {
          this["#type-buttons"].value = value;
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
    else if (["p3", "rec2020", "prophoto", "a98rgb"].includes(this["#space-select"].value)) {
      this.value =  serializeColor(
        convertColor(color, this["#space-select"].value, {inGamut: true}),
        {precision: COLOR_PRECISION}
      );
    }
    else if (this["#space-select"].value === "oklch") {
      this.value =  serializeColor(
        convertColor(color, "oklch", {inGamut: true}),
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
    else if (["p3", "rec2020", "prophoto", "a98rgb"].includes(sliders.space)) {
      let [r, g, b, a] = event.target.value;

      this.value = serializeColor(
        {space: sliders.space, coords: [r, g, b], alpha: a},
        {format: "default", precision: COLOR_PRECISION}
      );
    }
    else if (sliders.space === "oklch") {
      let [l, c, h, a] = event.target.value;

      this.value = serializeColor(
        {space: "oklch", coords: [l, c, h], alpha: a},
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

    this.value = serializeColor(
      convertColor(parseColor(this["#input"].value), this["#space-select"].value, {inGamut: true})
    );

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
      let color = await this.grab();
      this["#grab-button"].toggled = false;

      if (color !== null) {
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

        this.value = serializeColor(
          convertColor(parseColor(color), this["#space-select"].value, {inGamut: true})
        );

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

  #updateTypeButtons(color = this.#getColor()) {
    let supportedTypes;

    if (["srgb", "p3", "rec2020", "prophoto", "a98rgb"].includes(color.spaceId)) {
      supportedTypes = ["planar", "polar", "linear"];
    }
    else if (color.spaceId === "oklch") {
      supportedTypes = ["planar", "linear"];
    }

    if (supportedTypes.includes(this["#type-buttons"].value) === false) {
      this["#type-buttons"].value = supportedTypes[0];
    }

    for (let button of this["#type-buttons"].children) {
      button.disabled = this.disabled;
      button.hidden = (supportedTypes.includes(button.value) === false)
    }
  }

  #updateSliders(color = this.#getColor()) {
    let type = this["#type-buttons"].value;
    let space = color.spaceId;
    let value = [...color.coords, color.alpha];
    let localName;

    if (["srgb", "p3", "rec2020", "a98rgb", "prophoto"].includes(space)) {
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
    else if (space === "oklch") {
      if (type === "linear") {
        localName = "x-oklchlinearsliders";
      }
      else if (type === "planar") {
        localName = "x-oklchplanarliders";
      }
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
// Planar sliders for RGB-based color spaces (sRBG, Display P3, Rec. 2020, A98 RGB, ProPhoto)
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

  // @type "srgb" || "p3" || "rec2020" || "a98rgb" || "prophoto"
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
    this.#shadowRoot.append(document.importNode(this.constructor.#shadowTemplate.content, true));
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
      let model = value;

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
      colors = [
        { space: this.space, coords: [1, 0, 0] },
        { space: this.space, coords: [1, 1, 0] },
        { space: this.space, coords: [0, 1, 0] },
        { space: this.space, coords: [0, 1, 1] },
        { space: this.space, coords: [0, 0, 1] },
        { space: this.space, coords: [1, 0, 1] },
        { space: this.space, coords: [1, 0, 0] }
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#hue-slider"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
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

      let backgroundColor = {
        space: this.space,
        coords: convertColor({space: "hsv", coords: [h*360, 100, 100]}, "srgb").coords
      };

      let firstOverlayColors = [
        {space: this.space, coords: [1, 1, 1], alpha: 1},
        {space: this.space, coords: [1, 1, 1], alpha: 0}
      ];

      let secondOverlayColors = [
        {space: this.space, coords: [0, 0, 0], alpha: 0},
        {space: this.space, coords: [0, 0, 0], alpha: 1}
      ];

      backgroundColor = serializeColor(backgroundColor);
      firstOverlayColors = firstOverlayColors.map(color => serializeColor(color));
      secondOverlayColors = secondOverlayColors.map(color => serializeColor(color));

      this["#planar-slider"].style.background = `
        linear-gradient(in srgb to bottom, ${secondOverlayColors.join(",")}),
        linear-gradient(in srgb to right,  ${firstOverlayColors.join(",")}),
        ${backgroundColor}
      `;
    }
    else if (this.#model === "hsl") {
      let [h] = this.#modelCoords;

      let backgroundColors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360,   0, 50]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 100, 50]}, "srgb").coords },
      ];

      let overylayColors = [
        { space: this.space, coords: [1, 1, 1], alpha: 1 },
        { space: this.space, coords: [1, 1, 1], alpha: 0 },
        { space: this.space, coords: [0, 0, 0], alpha: 1 }
      ];

      backgroundColors = backgroundColors.map(color => serializeColor(color));
      overylayColors = overylayColors.map(color => serializeColor(color));

      this["#planar-slider"].style.background = `
        linear-gradient(in srgb to bottom, ${overylayColors.join(",")}),
        linear-gradient(in srgb to right, ${backgroundColors.join(",")})
      `;
    }
  }

  /**
   * Alpha slider
   */

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let colors;

    if (this.#model === "hsv") {
      let [h, s, v] = this.#modelCoords;

      colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords, alpha: 1}
      ];
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;

      colors = [
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords, alpha: 1}
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
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
// Polar sliders for RGB-based color spaces (sRBG, Display P3, Rec. 2020, A98 RGB, ProPhoto)
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

  // @type "srgb" || "p3" || "rec2020" || "a98rgb" || "prophoto"
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
    this.#shadowRoot.append(document.importNode(this.constructor.#shadowTemplate.content, true));
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
      let model = value;

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

      if (coord !== this.#modelCoords[0]) {
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
      let overlayColors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [0, 0, 100]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [0, 0,   0]}, "srgb").coords },
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

      this["#polar-slider-circle"].style.background = `
        radial-gradient(circle closest-side, ${overlayColors.map(c => serializeColor(c)).join(",")} 90%),
        conic-gradient(from -90deg in srgb, ${backgroundColors.map(c => serializeColor(c)).join(",")})
      `;

      this["#polar-slider-circle"].style.backgroundBlendMode = "screen, normal";
    }
    else if (this.#model === "hsl") {
      let overlayColors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [0, 0, 50]}, "srgb").coords, alpha: 1 },
        { space: this.space, coords: convertColor({space: "hsl", coords: [0, 0, 50]}, "srgb").coords, alpha: 0 },
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

      this["#polar-slider-circle"].style.background = `
        radial-gradient(circle closest-side, ${overlayColors.map(c => serializeColor(c)).join(",")}),
        conic-gradient(from -90deg in srgb, ${backgroundColors.map(c => serializeColor(c)).join(",")})
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
    let colors;

    if (this.#model === "hsv") {
      let [h, s] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100,   0]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, 100]}, "srgb").coords }
      ];
    }
    else if (this.#model === "hsl") {
      let [h, s] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,   0]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100,  50]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, 100]}, "srgb").coords }
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#linear-slider"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
  }

  /**
   * Alpha slider
   */

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let colors;

    if (this.#model === "hsv") {
      let [h, s, v] = this.#modelCoords;

      colors = [
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsv", coords: [h*360, s*100, v*100]}, "srgb").coords, alpha: 1}
      ];
    }
    else if (this.#model === "hsl") {
      let [h, s, l] = this.#modelCoords;

      colors = [
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hsl", coords: [h*360, s*100, l*100]}, "srgb").coords, alpha: 1}
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
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
// Linear sliders for RGB-based color spaces (sRBG, Display P3, Rec. 2020, A98 RGB, ProPhoto)
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
          <x-menuitem value="hsl"><x-label>HSL</x-label></x-menuitem>
          <x-menuitem value="hwb"><x-label>HWB</x-label></x-menuitem>
          <hr id="separator-1"/>
          <x-menuitem value="okhsv" data-srgb-only><x-label>okHSV</x-label></x-menuitem>
          <x-menuitem value="okhsl" data-srgb-only><x-label>okHSL</x-label></x-menuitem>
          <x-menuitem value="hsluv" data-srgb-only><x-label>HSLuv</x-label></x-menuitem>
          <hr id="separator-2"/>
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

  // @type "srgb" || "p3" || "rec2020" || "a98rgb" || "prophoto"
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
  #srgbModel = "hsv"; // "rgb", "hsv", "hsl", "hwb", "okhsv", "okhsl" or "hsluv"
  #wideGamutModel = "hsv"; // "rgb", "hsv", "hsl", or "hwb"
  #modelCoords = [0, 0, 0]; // Coordinates normalized to 0 ~ 1 range
  #a = 1; // Alpha normalized to 0 ~ 1 range

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.append(document.importNode(this.constructor.#shadowTemplate.content, true));
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
        let wideGamutModel = value;

        if (wideGamutModel !== this.#wideGamutModel) {
          let [r, g, b] = this.value;
          this.#wideGamutModel = wideGamutModel;
          this.value = [r, g, b, this.#a];
        }
      }
      else if (key === `${this.localName}:srgbModel`) {
        let srgbModel = value;

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
    let colors;

    if (model === "rgb") {
      let [ , g, b] = this.#modelCoords;

      colors = [
        { space: this.space, coords: [0, g, b] },
        { space: this.space, coords: [1, g, b] }
      ];
    }
    else if (model === "hsv" || model === "hsl" || model === "hwb") {
      colors = [
        { space: this.space, coords: [1, 0, 0] },
        { space: this.space, coords: [1, 1, 0] },
        { space: this.space, coords: [0, 1, 0] },
        { space: this.space, coords: [0, 1, 1] },
        { space: this.space, coords: [0, 0, 1] },
        { space: this.space, coords: [1, 0, 1] },
        { space: this.space, coords: [1, 0, 0] }
      ];
    }
    else if (model === "okhsv" || model === "okhsl" || model === "hsluv") {
      colors = [
        { space: "okhsv", coords: [0,   100, 100] },
        { space: "okhsv", coords: [60,  100, 100] },
        { space: "okhsv", coords: [120, 100, 100] },
        { space: "okhsv", coords: [180, 100, 100] },
        { space: "okhsv", coords: [240, 100, 100] },
        { space: "okhsv", coords: [300, 100, 100] },
        { space: "okhsv", coords: [360, 100, 100] }
      ];

      colors = colors.map(color => convertColor(color, "srgb"))
    }

    colors = colors.map(color => serializeColor(color));
    this["#coord-1-slider"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
  }

  /**
   * Coord 2 slider
   */

  #updateCoord2SliderMarker() {
    this["#coord-2-slider-marker"].style.left = (this.#modelCoords[1] * 100) + "%";
  }

  #updateCoord2SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let colors;

    if (model === "rgb") {
      let [r, , b] = this.#modelCoords;

      colors = [
        { space: this.space, coords: [r, 0, b] },
        { space: this.space, coords: [r, 1, b] }
      ];
    }
    else if (model === "hsv" || model === "okhsv") {
      let [h] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: model, coords: [h*360,   0, 100]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: model, coords: [h*360, 100, 100]}, "srgb").coords }
      ];
    }
    else if (model === "hsl") {
      let [h] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360,   0, 50]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hsl", coords: [h*360, 100, 50]}, "srgb").coords }
      ];
    }
    else if (model === "hwb") {
      let [h] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: "hwb", coords: [h*360,   0,  0]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hwb", coords: [h*360, 100,  0]}, "srgb").coords }
      ];
    }
    else if (model === "okhsl" || model === "hsluv") {
      let [h] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: model, coords: [h*360,   0, 65]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: model, coords: [h*360, 100, 65]}, "srgb").coords }
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#coord-2-slider"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
  }

  /**
   * Coord 3 slider
   */

  #updateCoord3SliderMarker() {
    this["#coord-3-slider-marker"].style.left = (this.#modelCoords[2] * 100) + "%";
  }

  #updateCoord3SliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let colors;

    if (model === "rgb") {
      let [r, g, b] = this.#modelCoords;

      colors = [
        { space: this.space, coords: [r, g, 0] },
        { space: this.space, coords: [r, g, 1] }
      ];
    }
    else if (model === "hsv" || model === "okhsv") {
      let [h, s] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: model, coords: [h*360, s*100,   0]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: model, coords: [h*360, s*100, 100]}, "srgb").coords }
      ];
    }
    else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
      let [h, s] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: model, coords: [h*360, s*100,   0]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: model, coords: [h*360, s*100,  50]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: model, coords: [h*360, s*100, 100]}, "srgb").coords }
      ];
    }
    else if (model === "hwb") {
      let [h, w] = this.#modelCoords;

      colors = [
        { space: this.space, coords: convertColor({space: "hwb", coords: [h*360, w*100,   0]}, "srgb").coords },
        { space: this.space, coords: convertColor({space: "hwb", coords: [h*360, w*100, 100]}, "srgb").coords }
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#coord-3-slider"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
  }

  /**
   * Alpha slider
   */

  #updateAlphaSliderMarker() {
    this["#alpha-slider-marker"].style.left = (this.#a * 100) + "%";
  }

  #updateAlphaSliderBackground() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let colors;

    if (model === "rgb") {
      let [r, g, b] = this.#modelCoords;

      colors = [
        { space: this.space, coords: [r, g, b], alpha: 0 },
        { space: this.space, coords: [r, g, b], alpha: 1 }
      ];
    }
    else if (model === "hsv" || model === "okhsv") {
      let [h, s, v] = this.#modelCoords;

      colors = [
        {
          space: this.space,
          coords: convertColor({space: model, coords: [h*360, s*100, v*100]}, "srgb").coords,
          alpha: 0
        },
        {
          space: this.space,
          coords: convertColor({space: model, coords: [h*360, s*100, v*100]}, "srgb").coords,
          alpha: 1
        }
      ];
    }
    else if (model === "hsl" || model === "okhsl" || model === "hsluv") {
      let [h, s, l] = this.#modelCoords;

      colors = [
        {
          space: this.space,
          coords: convertColor({space: model, coords: [h*360, s*100, l*100]}, "srgb").coords,
          alpha: 0
        },
        {
          space: this.space,
          coords: convertColor({space: model, coords: [h*360, s*100, l*100]}, "srgb").coords,
          alpha: 1
        }
      ];
    }
    else if (model === "hwb") {
      let [h, w, b] = this.#modelCoords;

      colors = [
        {space: this.space, coords: convertColor({space: "hwb", coords: [h*360, w*100, b*100]}, "srgb").coords, alpha: 0},
        {space: this.space, coords: convertColor({space: "hwb", coords: [h*360, w*100, b*100]}, "srgb").coords, alpha: 1}
      ];
    }

    colors = colors.map(color => serializeColor(color));
    this["#alpha-slider-gradient"].style.background = `linear-gradient(in srgb to right, ${colors.join(",")})`;
  }

  /**
   * Context menu
   */

  #updateContextMenu() {
    let model = (this.#space === "srgb") ? this.#srgbModel : this.#wideGamutModel;
    let items = [...this["#context-menu"].querySelectorAll("x-menuitem")];

    for (let item of items) {
      item.toggled = (item.value === model);
      item.hidden = item.hasAttribute("data-srgb-only") && this.space !== "srgb";
    }

    this["#separator-1"].hidden = this.space !== "srgb";
  }
}

if (customElements.get("x-rgblinearsliders") === undefined) {
  customElements.define("x-rgblinearsliders", XRGBLinearSlidersElement);
}
