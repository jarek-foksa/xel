
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-textarea.css" data-vulcanize>

    <main id="main">
      <slot></slot>
      <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
    </main>
  </template>
`;

// @events
//   input
//   change
//   textinputmodestart
//   textinputmodeend
export class XTextareaElement extends HTMLElement {
  static get observedAttributes() {
    return ["value", "spellcheck", "disabled"];
  }

  // @type
  //   string
  // @default
  //   ""
  // @attribute
  get value() {
    return this["#editor"].textContent;
  }
  set value(value) {
    this["#editor"].textContent = value;

    this.validate();
    this._updateEmptyState();
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
  //   Whether the current value is valid.
  // @type
  //   boolean
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

    this["#editor"].addEventListener("click", (event) => this._onEditorClick(event));
    this["#editor"].addEventListener("input", () => this._onEditorInput());
  }

  connectedCallback() {
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);

    this._updateEmptyState();
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "spellcheck") {
      this._onSpellcheckAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Override this method to validate the input value manually.
  // @type
  //   () => boolean
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

    return {valid, hint};
  }

  // @info
  //   Override this method to validate the input value manually.
  // @type
  //   {valid:boolean, hint:string}
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

    if (this.matches(":focus")) {
      document.execCommand("selectAll");
    }
  }

  _onSpellcheckAttributeChange() {
    this["#editor"].spellcheck = this.spellcheck;
  }

  _onDisabledAttributeChange() {
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    this.setAttribute("aria-disabled", this.disabled);
    this["#editor"].disabled = this.disabled;
  }

  _onEditorClick(event) {
    if (event.detail >= 4) {
      document.execCommand("selectAll");
    }
  }

  _onEditorInput(event) {
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
    this._updateEmptyState();

    if (this.invalid) {
      this.validate();
    }
  }

  _onFocusIn() {
    this.visited = true;
    this._focusInValue = this.value;
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this._shadowRoot.getSelection().collapse(this["#main"]);

    this.validate();

    if (this.invalid === false && this.value !== this._focusInValue) {
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    }
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

customElements.define("x-textarea", XTextareaElement);
