
// @copyright
//   © 2016-2017 Jarosław Foksa

import {createElement, closest, html} from "../utils/element.js";
import {formatColorString, parseColor, serializeColor} from "../utils/color.js";
import {debounce} from "../utils/time.js";

let $oldTabIndex = Symbol();

let shadowHTML = `
  <link rel="stylesheet" href="node_modules/xel/stylesheets/x-colorselect.css" data-vulcanize>
  <style>:host { background: url(node_modules/xel/images/checkboard.png) repeat 0 0; }</style>
  <input tabindex="-1" id="input" type="color" value="#ffffff">
  <slot></slot>
`;

// @events
//   change
//   changestart
//   changeend
export class XColorSelectElement extends HTMLElement {
  static get observedAttributes() {
    return ["value", "disabled"];
  }

  // @type
  //   string
  // @default
  //   #000000
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "#ffffff";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._inputChangeStarted = false;
    this._onInputChangeDebouonced = debounce(this._onInputChangeDebouonced, 400, this);

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.innerHTML = shadowHTML;

    this["#overlay"] = createElement("x-overlay");
    this["#overlay"].style.background =  "rgba(0, 0, 0, 0)";

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("change", (event) => this._onChange(event));
    this["#input"].addEventListener("change", (event) => this._onInputChange(event));
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  connectedCallback() {
    let picker = this.querySelector("x-wheelcolorpicker, x-rectcolorpicker");

    if (picker) {
      picker.setAttribute("value", formatColorString(this.value, "rgba"));
    }

    this._updateAccessabilityAttributes();
    this._updateInput();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _expand() {
    let popover = this.querySelector("x-popover");

    if (popover) {
      this._wasFocusedBeforeExpanding = this.matches(":focus");
      this.setAttribute("expanded", "");

      this["#overlay"].ownerElement = popover;
      this["#overlay"].show(false);

      await popover.open(this);
      popover.focus();
    }
  }

  async _collapse(delay = null) {
    let popover = this.querySelector("x-popover");

    if (popover) {
      popover.setAttribute("closing", "");

      await popover.close();

      this["#overlay"].hide(false);
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateInput() {
    let [r, g, b, a] = parseColor(this.value, "rgba");
    this["#input"].value = serializeColor([r, g, b, a], "rgba", "hex");
    this["#input"].style.opacity = a;
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this[$oldTabIndex] = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this[$oldTabIndex] > 0) ? this[$oldTabIndex] : 0;
      }

      delete this[$oldTabIndex];
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    if (!this._inputChangeStarted) {
      this._updateInput();
    }

    let picker = this.querySelector("x-wheelcolorpicker, x-rectcolorpicker");

    if (picker && picker.getAttribute("value") !== this.getAttribute("value")) {
      picker.setAttribute("value", this.getAttribute("value"));
    }
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
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

    this.dispatchEvent(new CustomEvent("change"))
    this._onInputChangeDebouonced();
  }

  _onInputChangeDebouonced() {
    if (this._inputChangeStarted) {
      this.value = this["#input"].value;
      this._inputChangeStarted = false;
      this.dispatchEvent(new CustomEvent("changeend"))
    }
  }

  _onPointerDown(event) {
    event.preventDefault();
  }

  _onClick(event) {
    if (event.target === this["#overlay"]) {
      this._collapse();
    }
    else {
      let popover = this.querySelector("x-popover");

      if (popover) {
        event.preventDefault();
      }

      if (popover && popover.hasAttribute("opened") === false) {
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
        this["#input"].click();
      }
    }

    else if (event.code === "Escape") {
      let popover = this.querySelector("x-popover");

      if (popover) {
        if (this.hasAttribute("expanded")) {
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
