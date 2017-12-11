
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {isValidColorString} from "../utils/color.js";

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

      this.validate();
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
  //   Whether the input value should be validated instantly on each key press rather than when user confirms
  //   the value by pressing the enter key or moving focus away from the input.
  // @default
  //   false
  // @attribute
  get instantValidation() {
    return this.hasAttribute("instantvalidation");
  }
  set instantValidation(value) {
    value === true ? this.setAttribute("instantvalidation", "") : this.removeAttribute("instantvalidation");
  }

  // @info
  //   Whether the input is in the "invalid" state
  // @type
  //   boolean
  // @attribute
  // @readOnly
  get invalid() {
    return this.hasAttribute("invalid");
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
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);

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
      this.removeAttribute("invalid");
    }
    else {
      this.setAttribute("invalid", hint);
    }

    return valid;
  }

  selectAll() {
    this["#input"].select();
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
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    this.setAttribute("aria-disabled", this.disabled);
    this["#input"].disabled = this.disabled;
  }

  _onFocusIn() {
    this.visited = true;
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this.validate();
  }

  _onKeyDown(event) {
    if (event.key === "Enter") {
      document.execCommand("selectAll");
      this.validate();
    }
  }

  _onInputInput(event) {
    if (this.instantValidation) {
      this.validate();
    }
    else if (this.hasAttribute("invalid")) {
      this.validate();
    }

    event.stopPropagation();
    this._updateEmptyState();
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  _onInputChange() {
    this.validate();
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
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
}

customElements.define("x-input", XInputElement);
