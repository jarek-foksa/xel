
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let $oldTabIndex = Symbol();

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-dateselect.css" data-vulcanize>

    <main id="main">
      <slot></slot>
      <x-icon id="expand-icon" name="date-range"></x-icon>
      <input id="input" type="date"></input>
    </main>
  </template>
`;

// @events
//   input
//   change
//   textinputmodestart
//   textinputmodeend
export class XDateSelectElement extends HTMLElement {
  static get observedAttributes() {
    return ["value", "min", "max", "disabled", "validation"];
  }

  // @type
  //   string
  // @default
  //   ""
  // @attribute
  //   partial
  get value() {
    return this["#input"].value;
  }
  set value(value) {
    if (this["#input"].value !== value) {
      this["#input"].value = value;

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }

      this._updateEmptyState();
    }
  }

  // @type
  //   string
  // @default
  //   null
  // @attribute
  get min() {
    return this.hasAttribute("min") ? this.getAttribute("min") : null;
  }
  set min(date) {
    this.setAttribute("min", date);
  }

  // @type
  //   string
  // @default
  //   null
  // @attribute
  get max() {
    return this.hasAttribute("max") ? this.getAttribute("max") : null;
  }
  set max(date) {
    this.setAttribute("max", date);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get required() {
    return this.hasAttribute("required");
  }
  set required(required) {
    required ? this.setAttribute("required", "") : this.removeAttribute("required");
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

  // @info
  //   "auto"    - validate() is called when input loses focus and when user presses "Enter"
  //   "instant" - validate() is called on each key press
  //   "manual"  - you will call validate() manually when user submits the form
  // @type
  //   "auto" || "instant" || "manual"
  // @default
  //   "auto"
  get validation() {
    return this.hasAttribute("validation") ? this.getAttribute("validation") : "auto";
  }
  set validation(validation) {
    this.setAttribute("validation", validation);
  }

  // @type
  //   string?
  // @default
  //   null
  // @attribute
  get error() {
    return this.getAttribute("error");
  }
  set error(error) {
    error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("focusin", () => this._onFocusIn());
    this.addEventListener("focusout", () => this._onFocusOut());
    this.addEventListener("keydown", (event) => this._onKeyDown(event));

    this["#input"].addEventListener("change", () => this._onInputChange());
    this["#input"].addEventListener("input", (event) => this._onInputInput(event));
  }

  connectedCallback() {
    this._updateAccessabilityAttributes();
    this._updateEmptyState();

    if (this.validation === "instant") {
      this.validate();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.error !== null) {
        this.validate();
      }
    }
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "min") {
      this._onMinAttributeChange();
    }
    else if (name === "max") {
      this._onMaxAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
    else if (name === "validation") {
      this._onValidationAttributeChnage();
    }
  }

  // @info
  //   Override this method to validate the input value manually.
  // @type
  //   () => void
  validate() {
    if (this.value && this.min && this.value < this.min) {
      this.error = "Entered date is before the minimum date";
    }
    else if (this.value && this.max && this.value > this.max) {
      this.error = "Entered date is after the maximum date";
    }
    else if (this.required && this.value.length === 0) {
      this.error = "This field is required";
    }
    else {
      this.error = null;
    }
  }

  selectAll() {
    this["#input"].select();
  }

  clear() {
    this.value = "";
    this.error = null;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateEmptyState() {
    if (this.value.length === 0) {
      this.setAttribute("empty", "");
    }
    else {
      this.removeAttribute("empty");
    }
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "input");
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
    this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

    if (this.matches(":focus")) {
      this.selectAll();
    }
  }

  _onMinAttributeChange() {
    this["#input"].min = this.min;
  }

  _onMaxAttributeChange() {
    this["#input"].max = this.max;
  }

  _onDisabledAttributeChange() {
    this["#input"].disabled = this.disabled;
    this._updateAccessabilityAttributes();
  }

  _onValidationAttributeChnage() {
    if (this.validation === "instant") {
      this.validate();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.error !== null) {
        this.validate();
      }
    }
  }

  _onFocusIn() {
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

    if (this.validation === "auto") {
      this.validate();
    }
  }

  _onKeyDown(event) {
    if (event.key === "Enter") {
      document.execCommand("selectAll");

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }
  }

  _onInputInput(event) {
    if (this.validation === "instant") {
      this.validate();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.error !== null) {
        this.validate();
      }
    }

    event.stopPropagation();
    this._updateEmptyState();
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  _onInputChange() {
    this.validate();
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
  }
}

customElements.define("x-dateselect", XDateSelectElement);
