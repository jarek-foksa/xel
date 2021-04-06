
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";
import ColorParser from "../classes/color-parser.js";

import {formatColorString, serializeColor} from "../utils/color.js";
import {closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {debounce} from "../utils/time.js";

// @element x-colorselect
// @event change
// @event changestart
// @event changeend
export default class XColorSelectElement extends HTMLElement {
  static observedAttributes = ["value", "disabled", "size"];

  static _shadowTemplate = html`
    <template>
      <input tabindex="-1" id="input" type="color" value="#ffffff">
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: 32px;
      height: 32px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      /* Checkerboard pattern */
      background-color: white;
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      background-image: linear-gradient(45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(-45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #d6d6d6 75%),
                        linear-gradient(-45deg, transparent 75%, #d6d6d6 75%);
    }
    :host([hidden]) {
      display: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.4;
    }

    ::slotted(x-popover) {
      width: 190px;
      height: auto;
      padding: 12px 12px;
    }

    #input {
      display: flex;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      border: none;
      background: none;
      padding: 0;
      opacity: 0;
      -webkit-appearance: none;
    }
    #input::-webkit-color-swatch-wrapper {
      padding: 0;
    }
    #input::-webkit-color-swatch {
      border: none;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default "#000000"
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "#ffffff";
  }
  set value(value) {
    this.setAttribute("value", value);
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
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property readOnly
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  _shadowRoot = null;
  _elements = {};
  _inputChangeStarted = false;
  _wasFocusedBeforeExpanding = false;
  _xelSizeChangeListener = null;
  _lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XColorSelectElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XColorSelectElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("change", (event) => this._onChange(event));
    this._elements["input"].addEventListener("change", (event) => this._onInputChange(event));
  }

  connectedCallback() {
    let picker = this.querySelector("x-wheelcolorpicker, x-rectcolorpicker, x-barscolorpicker");

    if (picker) {
      picker.setAttribute("value", formatColorString(this.value, "rgba"));
    }

    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();
    this._updateInput();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
    else if (name === "size") {
      this._onSizeAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _expand() {
    if (this.hasAttribute("expanded") === false) {
      let popover = this.querySelector("x-popover");

      if (popover) {
        this._wasFocusedBeforeExpanding = this.matches(":focus");
        this.setAttribute("expanded", "");
        await popover.open(this);
        popover.focus();
      }
    }
  }

  async _collapse(delay = null) {
    if (this.hasAttribute("expanded")) {
      let popover = this.querySelector("x-popover");

      if (popover) {
        popover.setAttribute("closing", "");

        await popover.close();
        this.removeAttribute("expanded");

        if (this._wasFocusedBeforeExpanding) {
          this.focus();
        }
        else {
          let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

          if (ancestorFocusableElement) {
            ancestorFocusableElement.focus();
          }
        }

        popover.removeAttribute("closing");
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateInput() {
    let [r, g, b, a] = new ColorParser().parse(this.value, "rgba");
    this._elements["input"].value = serializeColor([r, g, b, a], "rgba", "hex");
    this._elements["input"].style.opacity = a;
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this._lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this._lastTabIndex > 0) ? this._lastTabIndex : 0;
      }

      this._lastTabIndex = 0;
    }
  }

  _updateComputedSizeAttriubte() {
    let defaultSize = Xel.size;
    let customSize = this.size;
    let computedSize = "medium";

    if (customSize === null) {
      computedSize = defaultSize;
    }
    else if (customSize === "smaller") {
      computedSize = (defaultSize === "large") ? "medium" : "small";
    }
    else if (customSize === "larger") {
      computedSize = (defaultSize === "small") ? "medium" : "large";
    }
    else {
      computedSize = customSize;
    }

    if (computedSize === "medium") {
      this.removeAttribute("computedsize");
    }
    else {
      this.setAttribute("computedsize", computedSize);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    if (!this._inputChangeStarted) {
      this._updateInput();
    }

    let picker = [...this.querySelectorAll("*")].find(element => element.localName.endsWith("colorpicker"));

    if (picker && picker.getAttribute("value") !== this.getAttribute("value")) {
      picker.setAttribute("value", this.getAttribute("value"));
    }
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onSizeAttributeChange() {
    this._updateComputedSizeAttriubte();
  }

  _onChange(event) {
    if (event.target !== this) {
      this.value = formatColorString(event.target.value, "rgba");
      this._updateInput();
    }
  }

  _onInputChange() {
    if (this._inputChangeStarted === false) {
      this._inputChangeStarted = true;
      this.dispatchEvent(new CustomEvent("changestart"))
    }

    this.value = this._elements["input"].value;
    this.dispatchEvent(new CustomEvent("change"))
    this._onInputChangeDebounced();
  }

  _onInputChangeDebounced = debounce(() => {
    if (this._inputChangeStarted) {
      this._inputChangeStarted = false;

      this.value = this._elements["input"].value;
      this.dispatchEvent(new CustomEvent("changeend"))
    }
  }, 400);

  _onPointerDown(event) {
    if (event.target === this) {
      event.preventDefault();
    }
  }

  _onClick(event) {
    let popover = this.querySelector(":scope > x-popover");

    if (popover) {
      if (popover.opened) {
        if (popover.modal === false && event.target === this) {
          event.preventDefault();
          this._collapse();
        }
        else if (popover.modal === true && event.target.localName === "x-backdrop") {
          event.preventDefault();
          this._collapse();
        }
      }
      else {
        event.preventDefault();
        this._expand();
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      let popover = this.querySelector("x-popover");

      event.preventDefault();
      event.stopPropagation();

      if (popover) {
        if (this.hasAttribute("expanded")) {
          this._collapse();
        }
        else {
          this._expand();
        }
      }
      else {
        this._elements["input"].click();
      }
    }

    else if (event.code === "Escape") {
      let popover = this.querySelector("x-popover");

      if (popover) {
        if (this.hasAttribute("expanded")) {
          event.preventDefault();
          this._collapse();
        }
      }
    }

    else if (event.code === "Tab") {
      if (this.hasAttribute("expanded")) {
        event.preventDefault();
      }
    }
  }
}

customElements.define("x-colorselect", XColorSelectElement);
