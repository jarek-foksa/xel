
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {isValidColorString, convertColor, parseColor, prettySerializeColor} from "../utils/color.js";
import {closest, createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

const WINDOW_PADDING = 7;

// @element x-input
// @event ^input
// @event ^change
// @event ^textinputmodestart
// @event ^textinputmodeend
// @part input
export default class XColorInputElement extends HTMLElement {
  static observedAttributes = ["value", "space", "disabled"];

  static #shadowTemplate = html`
    <template>
      <main id="main">
        <slot></slot>

        <input id="input" type="text" spellcheck="false" autocomplete="false" part="input"></input>

        <svg id="arrow" part="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path id="arrow-path"></path>
        </svg>

        <slot></slot>
      </main>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      position: relative;
      max-width: 160px;
      height: 32px;
      padding: 0 2px 0 8px;
      box-sizing: border-box;
      background: white;
      font-size: 14px;
    }
    :host([size="small"]) {
      height: 24px;
      padding: 0 2px 0 6px;
      font-size: 12.5px;
    }
    :host([size="large"]) {
      height: 38px;
    }
    :host(:focus) {
      z-index: 10;
    }
    :host([mixed]) {
      color: rgba(0, 0, 0, 0.7);
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }

    #main {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
    }

    /**
     * Input
     */

    #input {
      width: 100%;
      padding: 0;
      box-sizing: border-box;
      color: inherit;
      background: none;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: inherit;
      font-weight: inherit;
      text-align: inherit;
    }

    /* Selection rect */
    ::selection {
      color: var(--selection-color);
      background-color: var(--selection-background-color);
    }
    :host(:not(:focus)) ::selection {
      color: inherit;
      background: transparent;
    }
    :host([error]) ::selection {
      color: white;
      background-color: #d50000;
    }

    /**
     * Arrow
     */

    #arrow {
      display: block;
      box-sizing: border-box;
      width: auto;
      min-width: fit-content;
      height: calc(100% - 4px);
      margin-left: 6px;
      padding: 5px 2px;
      color: currentColor;
      cursor: default;
      --text-color: 50%;
      --path-data: M 25 41 L 50 16 L 75 41 L 83 34 L 50 1 L 17 34 Z M 17 66 L 50 100 L 83 66 L 75 59 L 50 84 L 25 59 Z;
    }
    :host([size="small"]) #arrow {
      padding: 2px 2px;
    }
    :host([size="large"]) #arrow {
      padding: 6px 2px;
    }

    #arrow path {
      fill: currentColor;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute partial
  // @type string?
  // @default "#000000"
  get value() {
    return this.#value;
  }
  set value(value) {
    if (this.#value !== value) {
      this.#value = value;

      if (this.isConnected) {
        this.#updateInput();
        this.#updateEmptyAttribute();

        if (this.#error) {
          this.reportValidity();
        }
      }
    }
  }

  // @property
  // @attribute
  // @type "srgb" || "p3"
  // @default "srgb"
  get space() {
    return this.hasAttribute("space") ? this.getAttribute("space") : "srgb";
  }
  set space(space) {
    this.setAttribute("space", space);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get required() {
    return this.hasAttribute("required");
  }
  set required(required) {
    required ? this.setAttribute("required", "") : this.removeAttribute("required");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether this input has "mixed" state.
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
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

  // @property
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  get empty() {
    return this.hasAttribute("empty");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  get error() {
    return this.hasAttribute("error");
  }

  #value = "#000000";
  #format = "srgb";

  #shadowRoot = null;
  #lastTabIndex = 0;
  #error = null;
  #wasFocusedBeforeExpanding = false;

  #configChangeListener;
  #themeChangeListener;
  #resizeListener;
  #blurListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: false});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XColorInputElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XColorInputElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#format-menu"] = createElement("x-menu");
    this.append(this["#format-menu"]);

    this["#backdrop"] = createElement("x-backdrop");
    this["#backdrop"].style.opacity = "0";
    this["#backdrop"].ownerElement = this;
    this["#backdrop"].addEventListener("click", (event) => this.#onBackdropClick(event));

    this.addEventListener("click",  (event) => this.#onClick(event));
    this.addEventListener("pointerenter", () => this.#onPointerEnter());
    this.addEventListener("pointerleave", () => this.#onPointerLeave());
    this.addEventListener("focusin",  (event) => this.#onFocusIn(event));
    this.addEventListener("focusout", (event) => this.#onFocusOut(event));
    this.addEventListener("keydown",  (event) => this.#onKeyDown(event));

    this["#input"].addEventListener("change", (event) => this.#onInputChange(event));
    this["#input"].addEventListener("input",  (event) => this.#onInputInput(event));
    this["#input"].addEventListener("search", (event) => this.#onInputSearch(event));
    this["#arrow"].addEventListener("pointerdown", (event) => this.#onArrowPointerDown(event));
    this["#arrow"].addEventListener("click", (event) => this.#onArrowClick(event));
    this["#format-menu"].addEventListener("toggle", (event) => this.#onFormatMenuItemToggle(event));
    this["#format-menu"].addEventListener("click", (event) => this.#onFormatMenuClick(event));
  }

  connectedCallback() {
    this.#format = Xel.getConfig(`x-colorinput:${this.space}Format`, this.space === "srgb" ? "hex" : "color");

    this.#update();

    if (this.#error) {
      this.reportValidity();
    }

    Xel.addEventListener("configchange", this.#configChangeListener = (event) => this.#onConfigChange(event));
    Xel.addEventListener("themechange", this.#themeChangeListener = () => this.#updateArrowPathData());
  }

  disconnectedCallback() {
    Xel.removeEventListener("configchange", this.#configChangeListener);
    Xel.removeEventListener("themechange", this.#themeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "space") {
      this.#onSpaceAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type () => void
  selectAll() {
    this["#input"].select();
  }

  // @method
  // @type () => void
  clear() {
    this.value = "";
    this.#error = null;
    this.#updateValidityIndicators();
  }

  // @method
  // @type () => boolean
  reportValidity() {
    if (this.required && this.value.length === 0) {
      this.#error = {href: "#required-field"};
    }
    else if (isValidColorString(this["#input"].value) === false) {
      this.#error = {href: "#invalid-color"};
    }
    else {
      this.#error = null;
    }

    this.#updateValidityIndicators();
    return (this.#error === null);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #expand() {
    if (this.#canExpand() === false) {
      return;
    }

    let menu = this["#format-menu"];
    this["#backdrop"].show(false);

    window.addEventListener("resize", this.#resizeListener = () => this.#collapse());
    window.addEventListener("blur", this.#blurListener = () => this.#collapse());

    // Populate the menu
    {
      let color = parseColor(this.value);

      if (["srgb", "hwb", "hsl"].includes(color.spaceId)) {
        menu.innerHTML = `
          <x-menuitem value="hex">
            <x-label>${prettySerializeColor(color, "hex")}</x-label>
          </x-menuitem>

          <hr/>

          <x-menuitem value="color">
            <x-label>${prettySerializeColor(color, "color")}</x-label>
          </x-menuitem>

          <x-menuitem value="color-compact">
            <x-label>${prettySerializeColor(color, "color-compact")}</x-label>
          </x-menuitem>

          <hr/>

          <x-menuitem value="rgb">
            <x-label>${prettySerializeColor(color, "rgb")}</x-label>
          </x-menuitem>

          <x-menuitem value="rgb-compact">
            <x-label>${prettySerializeColor(color, "rgb-compact")}</x-label>
          </x-menuitem>

          <hr/>

          <x-menuitem value="hsl">
            <x-label>${prettySerializeColor(color, "hsl")}</x-label>
          </x-menuitem>

          <x-menuitem value="hsl-compact">
            <x-label>${prettySerializeColor(color, "hsl-compact")}</x-label>
          </x-menuitem>

          <hr/>

          <x-menuitem value="hwb">
            <x-label>${prettySerializeColor(color, "hwb")}</x-label>
          </x-menuitem>

          <x-menuitem value="hwb-compact">
            <x-label>${prettySerializeColor(color, "hwb-compact")}</x-label>
          </x-menuitem>
        `;
      }

      else if (color.spaceId === "p3" || color.spaceId === "rec2020") {
        menu.innerHTML = `
          <x-menuitem value="color">
            <x-label>${prettySerializeColor(color, "color")}</x-label>
          </x-menuitem>

          <x-menuitem value="color-compact">
            <x-label>${prettySerializeColor(color, "color-compact")}</x-label>
          </x-menuitem>
        `;
      }

      else if (color.spaceId === "oklch") {
        menu.innerHTML = `
          <x-menuitem value="oklch">
            <x-label>${prettySerializeColor(color, "oklch")}</x-label>
          </x-menuitem>

          <x-menuitem value="oklch-compact">
            <x-label>${prettySerializeColor(color, "oklch-compact")}</x-label>
          </x-menuitem>
        `;
      }
    }

    // Toggle menu item
    {
      let menuItem = menu.querySelector(`[value="${this.#format}"]`);

      if (menuItem) {
        menuItem.toggled = true;
      }
    }

    // Open the menu
    {
      let toggledItem = menu.querySelector(`x-menuitem[toggled]`);
      let firstItem = menu.querySelector("x-menuitem").firstElementChild;

      if (toggledItem) {
        // @todo
        menu.openOverElement(this["#input"],toggledItem.querySelector("x-label"));
      }
      else {
        menu.openOverElement(this["#input"], firstItem);
      }
    }

    // Increase menu width if it is narrower than the button
    {
      let menuBounds = menu.getBoundingClientRect();
      let buttonBounds = this.getBoundingClientRect();
      let hostPaddingRight = parseFloat(getComputedStyle(this).paddingRight);

      if (menuBounds.right - hostPaddingRight < buttonBounds.right) {
        menu.style.minWidth = (buttonBounds.right - menuBounds.left + hostPaddingRight) + "px";
        console.log("min width", menu.style.minWidth);
      }
    }

    // Reduce menu width if it overflows the right client bound
    {
      let menuBounds = this.getBoundingClientRect();

      if (menuBounds.right + WINDOW_PADDING > window.innerWidth) {
        this.style.maxWidth = (window.innerWidth - menuBounds.left - WINDOW_PADDING) + "px";
      }
    }
  }

  async #collapse(whenTriggerEnd = null) {
    if (this.#canCollapse() === false) {
      return;
    }

    let menu = this["#format-menu"];
    menu.setAttribute("closing", "");
    await whenTriggerEnd;
    this["#backdrop"].hide(false);

    if (this.#wasFocusedBeforeExpanding) {
      this.focus();
    }
    else {
      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    window.removeEventListener("resize", this.#resizeListener);
    window.removeEventListener("blur", this.#blurListener);

    await menu.close();
    menu.removeAttribute("closing");
  }

  #canExpand() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this["#format-menu"];
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === false && menu.hasAttribute("closing") === false/* && item !== null*/;
    }
  }

  #canCollapse() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this["#format-menu"];
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === true && menu.hasAttribute("closing") === false;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onConfigChange(event) {
    let {key, value, origin} = event.detail;

    if (key === `x-colorinput:${this.space}Format`) {
      this.#format = value;
      this.#updateInput();
    }
  }

  #onSpaceAttributeChange() {
    this.#format = Xel.getConfig(`x-colorinput:${this.space}Format`, this.space === "srgb" ? "hex" : "color");

    if (this.isConnected) {
      this.#updateInput();
    }
  }

  #onValueAttributeChange() {
    if (this.isConnected) {
      this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

      if (this.matches(":focus")) {
        this.selectAll();
      }
    }
  }

  #onDisabledAttributeChange() {
    this["#input"].disabled = this.disabled;
    this.#updateAccessabilityAttributes();
  }

  #onClick() {
    this.#updateValidityIndicators();
  }

  #onBackdropClick(event) {
    this.#collapse();
  }

  #onPointerEnter() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip && tooltip.disabled === false) {
      tooltip.open(this);
    }
  }

  #onPointerLeave() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip) {
      tooltip.close();
    }
  }

  #onFocusIn() {
    this.#updateValidityIndicators();
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  #onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this.reportValidity();
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      document.execCommand("selectAll");
      this.reportValidity();
    }
  }

  #onInputInput(event) {
    if (this.#error) {
      this.reportValidity();
    }

    event.stopPropagation();
    this.#updateEmptyAttribute();
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  #onInputChange() {
    this.value = this["#input"].value;
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
  }

  #onInputSearch() {
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
  }

  #onArrowPointerDown(event) {
    this.#wasFocusedBeforeExpanding = this.matches(":focus");
  }

  #onArrowClick(event) {
    this.#expand();
  }

  #onFormatMenuClick(event) {
    let clickedItem = event.target.closest("x-menuitem");

    if (clickedItem) {
      if (clickedItem.toggled === false) {
        for (let item of this["#format-menu"].querySelectorAll("x-menuitem")) {
          item.toggled = (item === clickedItem);
        }

        Xel.setConfig(`x-colorinput:${this.space}Format`, clickedItem.value);
      }

      this.#collapse(clickedItem.whenTriggerEnd);
    }
  }

  #onFormatMenuItemToggle(event) {
    // We will toggle the menu items manually
    event.preventDefault();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updateInput();
    this.#updateArrowPathData();
    this.#updateEmptyAttribute();
    this.#updateAccessabilityAttributes();
  }

  #updateInput() {
    let displayValue = prettySerializeColor(convertColor(parseColor(this.#value), this.space), this.#format);

    if (this.matches(":focus")) {
      // https://goo.gl/s1UnHh
      this["#input"].selectionStart = 0;
      this["#input"].selectionEnd = this["#input"].value.length;
      document.execCommand("insertText", false, displayValue);
    }
    else {
      this["#input"].value = displayValue;
    }
  }

  #updateArrowPathData() {
    let pathData = getComputedStyle(this["#arrow"]).getPropertyValue("--path-data");
    this["#arrow-path"].setAttribute("d", pathData);
  }

  #updateValidityIndicators() {
    let error = this.#error;

    // Update "error" attribute
    {
      if (error) {
        this.setAttribute("error", "");
      }
      else {
        this.removeAttribute("error");
      }
    }

    // Update <x-tooltip>
    {
      let tooltip = this.querySelector(`:scope > x-tooltip[type="error"]`);

      if (error && this.matches(":focus")) {
        if (!tooltip) {
          tooltip = createElement("x-tooltip");
          tooltip.setAttribute("type", "error");
          this.append(tooltip);
        }

        if (error.href) {
          let args = error.args ? Object.entries(error.args).map(([key, val]) => `${key}:${val}`).join(",") : "";
          tooltip.innerHTML = `<x-message href="${error.href}" args="${args}"></x-message>`;
        }
        else {
          tooltip.innerHTML = error;
        }

        sleep(10).then(() => {
          tooltip.open(this);
        });
      }
      else {
        if (tooltip) {
          tooltip.close().then(() => tooltip.remove());
        }
      }
    }
  }

  #updateEmptyAttribute() {
    if (this.value.length === 0) {
      this.setAttribute("empty", "");
    }
    else {
      this.removeAttribute("empty");
    }
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this.#lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this.#lastTabIndex > 0) ? this.#lastTabIndex : 0;
      }

      this.#lastTabIndex = 0;
    }
  }
}

customElements.define("x-colorinput", XColorInputElement);
