
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {isValidColorString} from "../utils/color.js";

let $oldTabIndex = Symbol();

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-input.css" data-vulcanize>

    <main id="main">
      <slot></slot>
      <input id="input" spellcheck="false"></input>
    </main>
  </template>
`;

// @events
//   input
//   change
//   textinputmodestart
//   textinputmodeend
export class XInputElement extends HTMLElement {
  static get observedAttributes() {
    return ["type", "value", "spellcheck", "maxlength", "readonly", "disabled", "validation"];
  }

  // @type
  //   "text" || "email" || "password" || "url" || "color"
  // @default
  //   "text"
  // @attribute
  get type() {
    return this.hasAttribute("type") ? this.getAttribute("type") : "text";
  }
  set type(type) {
    this.setAttribute("type", type);
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
      if (this.matches(":focus")) {
        // https://goo.gl/s1UnHh
        this["#input"].selectionStart = 0;
        this["#input"].selectionEnd = this["#input"].value.length;
        document.execCommand("insertText", false, value);
      }
      else {
        this["#input"].value = value;
      }

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
  //   boolean
  // @default
  //   false
  // @attribute
  get spellcheck() {
    return this.hasAttribute("spellcheck");
  }
  set spellcheck(spellcheck) {
    spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
  }

  // @type
  //   number
  // @default
  //   0
  // @attribute
  get minLength() {
    return this.hasAttribute("minlength") ? parseInt(this.getAttribute("minlength")) : 0;
  }
  set minLength(minLength) {
    this.setAttribute("minlength", minLength);
  }

  // @type
  //   number || Infinity
  // @default
  //   0
  // @attribute
  get maxLength() {
    return this.hasAttribute("maxlength") ? parseInt(this.getAttribute("maxlength")) : Infinity;
  }
  set maxLength(maxLength) {
    this.setAttribute("maxlength", maxLength);
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
  // @atrribute
  get readOnly() {
    return this.hasAttribute("readonly");
  }
  set readOnly(readOnly) {
    readOnly === true ? this.setAttribute("readonly", readOnly) : this.removeAttribute("readonly");
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

    this.addEventListener("focusin", (event) => this._onFocusIn(event));
    this.addEventListener("focusout", (event) => this._onFocusOut(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));

    this["#input"].addEventListener("change", (event) => this._onInputChange(event));
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
    if (name === "type") {
      this._onTypeAttributeChange();
    }
    else if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "spellcheck") {
      this._onSpellcheckAttributeChange();
    }
    else if (name === "maxlength") {
      this._onMaxLengthAttributeChange();
    }
    else if (name === "readonly") {
      this._onReadOnlyAttributeChnage();
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
    if (this.value.length < this.minLength) {
      this.error = "Entered text is too short";
    }
    else if (this.value.length > this.maxLength) {
      this.error = "Entered text is too long";
    }
    else if (this.required && this.value.length === 0) {
      this.error = "This field is required";
    }
    else if (this.type === "email" && this["#input"].validity.valid === false) {
      this.error = "Invalid e-mail address";
    }
    else if (this.type === "url" && this["#input"].validity.valid === false) {
      this.error = "Invalid URL";
    }
    else if (this.type === "color" && isValidColorString(this["#input"].value) === false) {
      this.error = "Invalid color";
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
    this.setAttribute("aria-readonly", this.readOnly);

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

  _onTypeAttributeChange() {
    if (this.type === "color") {
      this["#input"].type = "text";
    }
    else {
      this["#input"].type = this.type;
    }
  }

  _onValueAttributeChange() {
    this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

    if (this.matches(":focus")) {
      this.selectAll();
    }
  }

  _onSpellcheckAttributeChange() {
    this["#input"].spellcheck = this.spellcheck;
  }

  _onMaxLengthAttributeChange() {
    this["#input"].maxLength = this.maxLength;
  }

  _onReadOnlyAttributeChnage() {
    this["#input"].readOnly = this.readOnly;
    this._updateAccessabilityAttributes();
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
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
  }
}

customElements.define("x-input", XInputElement);
