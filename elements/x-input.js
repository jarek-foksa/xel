
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
    return ["type", "value", "spellcheck", "maxlength", "disabled"];
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

      if (this.validation === "instant" || this.validation === "auto") {
        this.validate();
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

  // @info
  //   Validation hints are not shown unless user focuses the element for the first time. Set this attribute to
  //   true to show the hints immediately.
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get visited() {
    return this.hasAttribute("visited");
  }
  set visited(visited) {
    visited ? this.setAttribute("visited", "") : this.removeAttribute("visited");
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
  //   "manual"  - validate() is never called automatically, you are responsible for calling it manually
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
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  // @info
  //   Override this method to validate the input value manually.
  // @type
  //   () => {valid: boolean, hint: string}
  validator() {
    let valid = true;
    let hint = "";

    if (this.value.length < this.minLength) {
      valid = false;
      hint = "Entered text is too short";
    }
    else if (this.value.length > this.maxLength) {
      valid = false;
      hint = "Entered text is too long";
    }
    else if (this.required && this.value.length === 0) {
      valid = false;
      hint = "This field is required";
    }
    else if (this.type === "email" && this["#input"].validity.valid === false) {
      valid = false;
      hint = "Invalid e-mail address";
    }
    else if (this.type === "url" && this["#input"].validity.valid === false) {
      valid = false;
      hint = "Invalid URL";
    }
    else if (this.type === "color" && isValidColorString(this["#input"].value) === false) {
      valid = false;
      hint = "Invalid color";
    }

    return {valid, hint};
  }

  // @type
  //   () => boolean
  validate() {
    let {valid, hint} = this.validator();

    if (valid) {
      this.error = null;
    }
    else {
      this.error = hint;
    }

    return valid;
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

  _onDisabledAttributeChange() {
    this["#input"].disabled = this.disabled;
    this._updateAccessabilityAttributes();
  }

  _onFocusIn() {
    this.visited = true;
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

      if (this.validation === "auto") {
        this.validate();
      }
    }
  }

  _onInputInput(event) {
    if (this.validation === "instant") {
      this.validate();
    }
    else if (this.validation === "auto") {
      if (this.error !== null) {
        this.validate();
      }
    }

    event.stopPropagation();
    this._updateEmptyState();
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  _onInputChange() {
    if (this.validation === "auto" || this.validation === "instant") {
      this.validate();
    }

    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
  }
}

customElements.define("x-input", XInputElement);
