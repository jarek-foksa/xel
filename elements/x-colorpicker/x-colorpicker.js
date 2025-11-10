
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import "./x-lablinearsliders.js";
import "./x-labplanarsliders.js";
import "./x-lchlinearsliders.js";
import "./x-lchplanarsliders.js";
import "./x-rgblinearsliders.js";
import "./x-rgbplanarsliders.js";
import "./x-rgbpolarsliders.js";
import "./x-xyzlinearsliders.js";
import "./x-xyzplanarsliders.js";

import Xel from "../../classes/xel.js";

import {convertColor, parseColor, serializeColor, isColorInGamut} from "../../utils/color.js";
import {createElement} from "../../utils/element.js";
import {html, css} from "../../utils/template.js";
import {throttle} from "../../utils/time.js";

const COLOR_PRECISION = 3;
const DEBUG = false;

/**
 * @element x-colorpicker
 * @fires ^change
 * @fires ^changestart
 * @fires ^changeend
 */
export default class XColorPickerElement extends HTMLElement {
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

      <div id="main"></div>

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
      font-size: 0.8125rem;
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
      min-height: 1px;
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
    :host([context~="x-popover"]) #sliders {
      height: 250px;
    }
    :host([context~="x-popover"]):host([alpha]) #sliders {
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

  /**
   * Any valid CSS color value.
   *
   * @property
   * @attribute
   * @type {string}
   * @default "#000000"
   */
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "#000000";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  /**
   * Whether to allow manipulation of the alpha channel.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  /**
   * Available color spaces.
   *
   * @property
   * @attribute
   * @type {Array<string>}
   * @default ["srgb", "srgb-linear", "a98rgb", "p3", "rec2020", "prophoto", "lch", "oklch", "lab", "oklab", "xyz-d65", "xyz-d50"]
   */
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

  /**
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
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
    this["#type-buttons"].addEventListener("toggle", () => this.#onTypeButtonsToggle());

    this["#main"].addEventListener("pointerdown", (event) => this.#onSlidersPointerDown(event), true);
    this["#main"].addEventListener("changestart", (event) => this.#onSlidersChangeStart(event));
    this["#main"].addEventListener("change", (event) => this.#onSlidersChange(event));
    this["#main"].addEventListener("changeend", (event) => this.#onSlidersChangeEnd(event));

    this["#input"].addEventListener("change", (event) => this.#onInputChange(event));
    this["#input"].addEventListener("keydown", (event) => this.#onInputKeyDown(event));

    this["#grab-button"].addEventListener("toggle", () => this.#onGrabButtonToggle());

    if (DEBUG) {
      this.addEventListener("change", () => {
        document.documentElement.style.background = this.value;
      });
    }
  }

  connectedCallback() {
    Xel.addEventListener("configchange", this.#configChangeListener = (event) => {
      this.#onConfigChange(event);
    });

    if (this.parentElement?.localName === "x-popover") {
      this.setAttribute("context", "x-popover");
    }
    else {
      this.removeAttribute("context");
    }

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

  /**
   * Grab a color using Eye Dropper API. Override this method to use alternative APIs.
   *
   * @type {() => string | null}
   */
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
        catch (_error) {
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
      // @see https://www.w3.org/TR/css-color-4/#missing
      for (let i = 0; i < convertedColor.coords.length; i += 1) {
        if (convertedColor.coords[i] === null || Number.isNaN(convertedColor.coords[i])) {
          convertedColor.coords[i] = 0;
        }
      }

      this.value =  serializeColor(convertedColor, {precision: COLOR_PRECISION});
    }

    this.dispatchEvent(new CustomEvent("change", {bubbles: true}))
    this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}))
  }

  #onTypeButtonsToggle() {
    Xel.setConfig(`${this.localName}:type`, this["#type-buttons"].value);
    this.#update();
  }

  #onSlidersPointerDown(event) {
    if (this["#input"].matches(":focus")) {
      event.stopImmediatePropagation();
    }
  }

  #onSlidersChangeStart() {
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

  #onSlidersChangeEnd() {
    this.#isDraggingSlider = false;
    this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}))
  }

  #onInputChange() {
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

  async #onGrabButtonToggle() {
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
    return new Promise(async (resolve) => {
      let allowedSpaces = this.spaces;

      await customElements.whenDefined("x-select");
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

      resolve();
    });
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
    return new Promise(async (resolve) => {
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

      await customElements.whenDefined(localName);

      this["#sliders"].space = space;
      this["#sliders"].value = value;
      this["#sliders"].alpha = this.alpha;
      this["#sliders"].disabled = this.disabled;

      resolve();
    });
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
    // @see https://www.w3.org/TR/css-color-4/#missing
    for (let i = 0; i < color.coords.length; i += 1) {
      if (color.coords[i] === null || Number.isNaN(color.coords[i])) {
        color.coords[i] = 0;
      }
    }

    // @bugfix: parseColor() returns inconsistent objects
    {
      if (color.spaceId === undefined) {
        color.spaceId = color.space.id;
      }

      color.coords = color.coords.map(coord => Number.parseFloat(coord));
    }

    return color;
  }
}

if (customElements.get("x-colorpicker") === undefined) {
  customElements.define("x-colorpicker", XColorPickerElement);
}
