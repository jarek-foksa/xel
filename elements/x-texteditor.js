
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-texteditor
// @event input
// @event change
// @event ^textinputmodestart
// @event ^textinputmodeend
export default class XTextEditorElement extends HTMLElement {
  static observedAttributes = ["value", "spellcheck", "disabled", "validation", "size"];

  static _shadowTemplate = html`
    <template>
      <main id="main">
        <slot></slot>
        <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
      </main>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      min-height: 100px;
      box-sizing: border-box;
      background: white;
      font-size: 12.5px;
    }
    :host(:hover) {
      cursor: text;
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
      background-color: var(--selection-background-color);
    }
    :host([error]) ::selection {
      color: white;
      background-color: #d50000;
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
      padding: 2px 6px;
      box-sizing: border-box;
      color: inherit;
      background: none;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: inherit;
      overflow: auto;
    }

    /* Error message */
    :host([error])::before {
      position: absolute;
      left: 0;
      bottom: -20px;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 11px;
      line-height: 1.2;
      white-space: pre;
      content: attr(error) " ";
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
  get value() {
    return this._elements["editor"].textContent;
  }
  set value(value) {
    this._elements["editor"].textContent = value;

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

  // @property
  // @attribute
  // @type boolean
  // @default false
  get spellcheck() {
    return this.hasAttribute("spellcheck");
  }
  set spellcheck(spellcheck) {
    spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
  }

  // @property
  // @attribute
  // @type number
  // @default 0
  get minLength() {
    return this.hasAttribute("minlength") ? parseInt(this.getAttribute("minlength")) : 0;
  }
  set minLength(minLength) {
    this.setAttribute("minlength", minLength);
  }

  // @property
  // @attribute
  // @type number || Infinity
  // @default 0
  get maxLength() {
    return this.hasAttribute("maxlength") ? parseInt(this.getAttribute("maxlength")) : Infinity;
  }
  set maxLength(maxLength) {
    this.setAttribute("maxlength", maxLength);
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
  // Whether this text editor has "mixed" state.
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
  // @type "auto" || "instant" || "manual"
  // @default "auto"
  //
  // - <em>"auto"</em> - validate() is called when input loses focus and when user presses "Enter"</br>
  // - <em>"instant"</em> - validate() is called on each key press<br/>
  // - <em>"manual"</em> - you will call validate() manually when user submits the form<br/>
  get validation() {
    return this.hasAttribute("validation") ? this.getAttribute("validation") : "auto";
  }
  set validation(validation) {
    this.setAttribute("validation", validation);
  }

  // @property
  // @attribute
  // @type string?
  // @default null
  get error() {
    return this.getAttribute("error");
  }
  set error(error) {
    error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
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
  _lastTabIndex = 0;
  _xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this._shadowRoot.adoptedStyleSheets = [XTextEditorElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XTextEditorElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this.addEventListener("focusin", (event) => this._onFocusIn(event));
    this.addEventListener("focusout", (event) => this._onFocusOut(event));

    this._elements["editor"].addEventListener("click", (event) => this._onEditorClick(event));
    this._elements["editor"].addEventListener("input", (event) => this._onEditorInput(event));
  }

  connectedCallback() {
    this._updateEmptyState();
    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();

    if (this.validation === "instant") {
      this.validate();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.error !== null) {
        this.validate();
      }
    }

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
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
    else if (name === "size") {
      this._onSizeAttributeChange();
    }
  }

  // @method
  // @type () => void
  //
  // Override this method to validate the text editor value manually.
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
    this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

    if (this.matches(":focus")) {
      document.execCommand("selectAll");
    }
  }

  _onSpellcheckAttributeChange() {
    this._elements["editor"].spellcheck = this.spellcheck;
  }

  _onDisabledAttributeChange() {
    this._elements["editor"].disabled = this.disabled;
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

  _onSizeAttributeChange() {
    this._updateComputedSizeAttriubte();
  }

  _onFocusIn() {
    this._focusInValue = this.value;
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this._shadowRoot.getSelection().collapse(this._elements["main"]);

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

customElements.define("x-texteditor", XTextEditorElement);
