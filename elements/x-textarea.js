
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let $oldTabIndex = Symbol()

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        width: 100%;
        min-height: 100px;
        box-sizing: border-box;
        background: white;
        color: #000000;
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --inner-padding: 0;
      }
      :host(:hover) {
        cursor: text;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
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

      ::selection {
        color: var(--selection-color);
        background: var(--selection-background);
      }

      ::-webkit-scrollbar {
        max-width: 6px;
        max-height: 6px;
        background: none;
      }
      ::-webkit-scrollbar-track {
        border-radius: 25px;
      }
      ::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 25px;
      }
      ::-webkit-scrollbar-corner {
        display: none
      }

      #main {
        display: flex;
        flex-flow: column;
        height: 100%;
        min-height: inherit;
        max-height: inherit;
        overflow-y: auto;
      }

      #editor {
        flex: 1;
        padding: var(--inner-padding);
        box-sizing: border-box;
        color: inherit;
        background: none;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        overflow: auto;
      }

      /* Error text */
      :host([error])::before {
        position: absolute;
        left: 0;
        bottom: -20px;
        box-sizing: border-box;
        color: #d50000;
        font-family: inherit;
        font-size: 11px;
        line-height: 1.2;
        white-space: pre;
        content: attr(error) " ";
      }
    </style>

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
    return ["value", "spellcheck", "disabled", "validation"];
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
  //   Whether this textarea has "mixed" state.
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
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

    this["#editor"].addEventListener("click", (event) => this._onEditorClick(event));
    this["#editor"].addEventListener("input", (event) => this._onEditorInput(event));
  }

  connectedCallback() {
    this._updateEmptyState();
    this._updateAccessabilityAttributes();

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
    else if (name === "spellcheck") {
      this._onSpellcheckAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
    else if (name === "validation") {
      this._onValidationAttributeChnage();
    }
  }

  // @info
  //   Override this method to validate the textarea value manually.
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
    else {
      this.error = null;
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
      document.execCommand("selectAll");
    }
  }

  _onSpellcheckAttributeChange() {
    this["#editor"].spellcheck = this.spellcheck;
  }

  _onDisabledAttributeChange() {
    this["#editor"].disabled = this.disabled;
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
    this._focusInValue = this.value;
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this._shadowRoot.getSelection().collapse(this["#main"]);

    if (this.validation === "auto") {
      this.validate();
    }

    if (this.error === null && (this.value !== this._focusInValue || this.mixed)) {
      this.mixed = false;
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    }
  }

  _onEditorClick(event) {
    if (event.detail >= 4) {
      document.execCommand("selectAll");
    }
  }

  _onEditorInput(event) {
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
    this._updateEmptyState();

    if (this.validation === "instant") {
      this.validate();
    }
    else if (this.validation === "auto") {
      if (this.error !== null) {
        this.validate();
      }
    }
  }
}

customElements.define("x-textarea", XTextareaElement);
