
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {isValidColorString} from "../utils/color.js";
import {createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

// @element x-input
// @event ^input
// @event ^change
// @event ^textinputmodestart
// @event ^textinputmodeend
// @event beforevalidate
// @part input
export default class XInputElement extends HTMLElement {
  static observedAttributes = ["type", "value", "spellcheck", "maxlength", "readonly", "disabled", "validation"];

  static #shadowTemplate = html`
    <template>
      <main id="main">
        <slot></slot>
        <input id="input" spellcheck="false" part="input"></input>
      </main>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      position: relative;
      max-width: 160px;
      height: 32px;
      box-sizing: border-box;
      background: white;
      font-size: 12.5px;
    }
    :host(:focus) {
      z-index: 10;
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

    #main {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
    }

    #input {
      width: 100%;
      height: 100%;
      padding: 0 6px;
      box-sizing: border-box;
      color: inherit;
      background: none;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: inherit;
      font-weight: inherit;
      text-align: inherit;
      cursor: inherit;
    }
    #input:-webkit-autofill {
      /* Hide the placeholder text when the input is autofilled */
      z-index: 1;
    }
    #input:-internal-autofill-previewed,
    #input:-internal-autofill-selected {
      -webkit-box-shadow: var(--autofill-background-color) 0px 0px 0px 30px inset;
    }

    /* Selection rect */
    :host(:not(:focus)) ::selection {
      color: inherit;
      background: transparent;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type "text" || "email" || "password" || "url" || "color"
  // @default "text"
  get type() {
    return this.hasAttribute("type") ? this.getAttribute("type") : "text";
  }
  set type(type) {
    this.setAttribute("type", type);
  }

  // @property
  // @attribute partial
  // @type string
  // @default ""
  get value() {
    return this.#elements["input"].value;
  }
  set value(value) {
    if (this.#elements["input"].value !== value) {
      if (this.matches(":focus")) {
        // https://goo.gl/s1UnHh
        this.#elements["input"].selectionStart = 0;
        this.#elements["input"].selectionEnd = this.#elements["input"].value.length;
        document.execCommand("insertText", false, value);
      }
      else {
        this.#elements["input"].value = value;
      }

      if (this.validation === "instant") {
        this.reportValidity();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.#error || this.#customError) {
          this.reportValidity();
        }
      }

      this.#updateEmptyAttribute();
    }
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
  // @atrribute
  // @type boolean
  // @default false
  get readOnly() {
    return this.hasAttribute("readonly");
  }
  set readOnly(readOnly) {
    readOnly === true ? this.setAttribute("readonly", readOnly) : this.removeAttribute("readonly");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether this input has "mixed" state.
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
  // @type "auto" || "instant" || "manual"
  // @default "auto"
  //
  // - <em>"auto"</em> - validation is performed when input loses focus and when user presses "Enter"<br/>
  // - <em>"instant"</em> - validation is performed on each key press<br/>
  // - <em>"manual"</em>  - you will call reportValidity() manually when user submits the form<br/>
  get validation() {
    return this.hasAttribute("validation") ? this.getAttribute("validation") : "auto";
  }
  set validation(validation) {
    this.setAttribute("validation", validation);
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

  // @property
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  get empty() {
    return this.hasAttribute("empty");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  get error() {
    return this.hasAttribute("error");
  }

  #shadowRoot = null;
  #elements = {};
  #lastTabIndex = 0;
  #error = null;
  #customError = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this.#shadowRoot.adoptedStyleSheets = [XInputElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XInputElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.addEventListener("click",  (event) => this.#onClick(event));
    this.addEventListener("pointerenter", () => this.#onPointerEnter());
    this.addEventListener("pointerleave", () => this.#onPointerLeave());
    this.addEventListener("focusin",  (event) => this.#onFocusIn(event));
    this.addEventListener("focusout", (event) => this.#onFocusOut(event));
    this.addEventListener("keydown",  (event) => this.#onKeyDown(event));

    this.#elements["input"].addEventListener("change", (event) => this.#onInputChange(event));
    this.#elements["input"].addEventListener("input",  (event) => this.#onInputInput(event));
    this.#elements["input"].addEventListener("search", (event) => this.#onInputSearch(event));
  }

  connectedCallback() {
    this.#updateAccessabilityAttributes();
    this.#updateEmptyAttribute();

    if (this.validation === "instant") {
      this.reportValidity();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.#error || this.#customError) {
        this.reportValidity();
      }
    }
  }

  attributeChangedCallback(name) {
    if (name === "type") {
      this.#onTypeAttributeChange();
    }
    else if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "spellcheck") {
      this.#onSpellcheckAttributeChange();
    }
    else if (name === "maxlength") {
      this.#onMaxLengthAttributeChange();
    }
    else if (name === "readonly") {
      this.#onReadOnlyAttributeChnage();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
    else if (name === "validation") {
      this.#onValidationAttributeChnage();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type () => void
  selectAll() {
    this.#elements["input"].select();
  }

  // @method
  // @type () => void
  clear() {
    this.value = "";
    this.#error = null;
    this.#customError = null;
    this.#updateValidityIndicators();
  }

  // @method
  // @type () => boolean
  reportValidity() {
    let beforeValidateEvent = new CustomEvent("beforevalidate", {bubbles: false, cancelable: true});
    this.dispatchEvent(beforeValidateEvent);

    if (beforeValidateEvent.defaultPrevented === false) {
      if (this.value.length < this.minLength) {
        this.#error = {href: "#entered-text-is-too-short"};
      }
      else if (this.value.length > this.maxLength) {
        this.#error = {href: "#entered-text-is-too-long"};
      }
      else if (this.required && this.value.length === 0) {
        this.#error = {href: "#required-field"};
      }
      else if (this.type === "email" && this.#elements["input"].validity.valid === false) {
        this.#error = {href: "#invalid-email"};
      }
      else if (this.type === "url" && this.#elements["input"].validity.valid === false) {
        this.#error = {href: "#invalid-url"};
      }
      else if (this.type === "color" && isValidColorString(this.#elements["input"].value) === false) {
        this.#error = {href: "#invalid-color"};
      }
      else {
        this.#error = null;
      }

      this.#updateValidityIndicators();
    }

    return (this.#error === null && this.#customError === null);
  }

  // @method
  // @type (string || {href:string, args:Object}) => void
  setCustomValidity(arg) {
    if (arg === "") {
      this.#customError = null;
    }
    else {
      this.#customError = arg;
    }

    this.#updateValidityIndicators();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateValidityIndicators() {
    let error = this.#customError || this.#error;

    // Update "error" attribute
    {
      if (error) {
        this.setAttribute("error", "");
      }
      else {
        this.removeAttribute("error");
      }
    }

    // Update <x-tooltip>
    {
      let tooltip = this.querySelector(`:scope > x-tooltip[type="error"]`);

      if (error && this.matches(":focus")) {
        if (!tooltip) {
          tooltip = createElement("x-tooltip");
          tooltip.setAttribute("type", "error");
          this.append(tooltip);
        }

        if (error.href) {
          let args = error.args ? Object.entries(error.args).map(([key, val]) => `${key}:${val}`).join(",") : "";
          tooltip.innerHTML = `<x-message href="${error.href}" args="${args}"></x-message>`;
        }
        else {
          tooltip.innerHTML = error;
        }

        sleep(10).then(() => {
          tooltip.open(this);
        });
      }
      else {
        if (tooltip) {
          tooltip.close().then(() => tooltip.remove());
        }
      }
    }
  }

  #updateEmptyAttribute() {
    if (this.value.length === 0) {
      this.setAttribute("empty", "");
    }
    else {
      this.removeAttribute("empty");
    }
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);
    this.setAttribute("aria-readonly", this.readOnly);

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

  #onTypeAttributeChange() {
    if (this.type === "color") {
      this.#elements["input"].type = "text";
    }
    else {
      this.#elements["input"].type = this.type;
    }
  }

  #onValueAttributeChange() {
    this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

    if (this.matches(":focus")) {
      this.selectAll();
    }
  }

  #onSpellcheckAttributeChange() {
    this.#elements["input"].spellcheck = this.spellcheck;
  }

  #onMaxLengthAttributeChange() {
    this.#elements["input"].maxLength = this.maxLength;
  }

  #onReadOnlyAttributeChnage() {
    this.#elements["input"].readOnly = this.readOnly;
    this.#updateAccessabilityAttributes();
  }

  #onDisabledAttributeChange() {
    this.#elements["input"].disabled = this.disabled;
    this.#updateAccessabilityAttributes();
  }

  #onValidationAttributeChnage() {
    if (this.validation === "instant") {
      this.reportValidity();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.#error || this.#customError) {
        this.reportValidity();
      }
    }
  }

  #onClick() {
    this.#updateValidityIndicators();
  }

  #onPointerEnter() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip && tooltip.disabled === false) {
      tooltip.open(this);
    }
  }

  #onPointerLeave() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip) {
      tooltip.close();
    }
  }

  #onFocusIn() {
    this.#updateValidityIndicators();
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  #onFocusOut() {
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

    if (this.validation === "auto" || this.validation === "instant") {
      this.reportValidity();
    }
    else if (this.validation === "manual") {
      this.#updateValidityIndicators();
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      document.execCommand("selectAll");

      if (this.validation === "instant") {
        this.reportValidity();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        this.reportValidity();
      }
    }
  }

  #onInputInput(event) {
    if (this.validation === "instant") {
      this.reportValidity();
    }
    else if (this.validation === "auto" || this.validation === "manual") {
      if (this.#error || this.#customError) {
        this.reportValidity();
      }
    }

    event.stopPropagation();
    this.#updateEmptyAttribute();
    this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  #onInputChange() {
    if (this.type !== "search") {
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    }
  }

  #onInputSearch() {
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
  }
}

customElements.define("x-input", XInputElement);
