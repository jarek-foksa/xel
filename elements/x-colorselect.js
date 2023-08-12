
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

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
  static observedAttributes = ["value", "disabled"];

  static #shadowTemplate = html`
    <template>
      <input tabindex="-1" id="input" type="color" value="#ffffff">
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
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
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  #shadowRoot = null;
  #elements = {};
  #inputChangeStarted = false;
  #wasFocusedBeforeExpanding = false;
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XColorSelectElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XColorSelectElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("change", (event) => this.#onChange(event));
    this.#elements["input"].addEventListener("change", (event) => this.#onInputChange(event));
  }

  connectedCallback() {
    let picker = this.querySelector("x-wheelcolorpicker, x-rectcolorpicker, x-barscolorpicker");

    if (picker) {
      picker.setAttribute("value", formatColorString(this.value, "rgba"));
    }

    this.#updateAccessabilityAttributes();
    this.#updateInput();
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #expand() {
    if (this.hasAttribute("expanded") === false) {
      let popover = this.querySelector("x-popover");

      if (popover) {
        this.#wasFocusedBeforeExpanding = this.matches(":focus");
        this.setAttribute("expanded", "");
        await popover.open(this);
        popover.focus();
      }
    }
  }

  async #collapse(delay = null) {
    if (this.hasAttribute("expanded")) {
      let popover = this.querySelector("x-popover");

      if (popover) {
        popover.setAttribute("closing", "");

        await popover.close();
        this.removeAttribute("expanded");

        if (this.#wasFocusedBeforeExpanding) {
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

  #updateInput() {
    let [r, g, b, a] = new ColorParser().parse(this.value, "rgba");
    this.#elements["input"].value = serializeColor([r, g, b, a], "rgba", "hex");
    this.#elements["input"].style.opacity = a;
  }

  #updateAccessabilityAttributes() {
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onValueAttributeChange() {
    if (!this.#inputChangeStarted) {
      this.#updateInput();
    }

    let picker = [...this.querySelectorAll("*")].find(element => element.localName.endsWith("colorpicker"));

    if (picker && picker.getAttribute("value") !== this.getAttribute("value")) {
      picker.setAttribute("value", this.getAttribute("value"));
    }
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  #onChange(event) {
    if (event.target !== this) {
      this.value = formatColorString(event.target.value, "rgba");
      this.#updateInput();
    }
  }

  #onInputChange() {
    if (this.#inputChangeStarted === false) {
      this.#inputChangeStarted = true;
      this.dispatchEvent(new CustomEvent("changestart"))
    }

    this.value = this.#elements["input"].value;
    this.dispatchEvent(new CustomEvent("change"))
    this.#onInputChangeDebounced();
  }

  #onInputChangeDebounced = debounce(() => {
    if (this.#inputChangeStarted) {
      this.#inputChangeStarted = false;

      this.value = this.#elements["input"].value;
      this.dispatchEvent(new CustomEvent("changeend"))
    }
  }, 400);

  #onPointerDown(event) {
    if (event.target === this) {
      event.preventDefault();
    }
  }

  #onClick(event) {
    let popover = this.querySelector(":scope > x-popover");

    if (popover) {
      if (popover.opened) {
        if (popover.modal === false && event.target === this) {
          event.preventDefault();
          this.#collapse();
        }
        else if (popover.modal === true && event.target.localName === "x-backdrop") {
          event.preventDefault();
          this.#collapse();
        }
      }
      else {
        event.preventDefault();
        this.#expand();
      }
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      let popover = this.querySelector("x-popover");

      event.preventDefault();
      event.stopPropagation();

      if (popover) {
        if (this.hasAttribute("expanded")) {
          this.#collapse();
        }
        else {
          this.#expand();
        }
      }
      else {
        this.#elements["input"].click();
      }
    }

    else if (event.code === "Escape") {
      let popover = this.querySelector("x-popover");

      if (popover) {
        if (this.hasAttribute("expanded")) {
          event.preventDefault();
          this.#collapse();
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
