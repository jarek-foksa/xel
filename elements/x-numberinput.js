
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {isNumeric} from "../utils/string.js";
import {html, css} from "../utils/template.js";
import {debounce, sleep} from "../utils/time.js";
import {normalize, getPrecision, getDistanceBetweenPoints} from "../utils/math.js";

let {isFinite} = Number;

const NUMERIC_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "+", ",", "."];

// @element x-numberinput
// @event ^change
// @event ^changestart
// @event ^changeend
// @event ^textinputmodestart
// @event ^textinputmodeend
export default class XNumberInputElement extends HTMLElement {
  static observedAttributes = ["value", "min", "max", "prefix", "suffix", "disabled", "size"];

  static _shadowTemplate = html`
    <template>
      <main id="main">
        <div id="editor-container">
          <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
        </div>
        <slot></slot>
      </main>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      position: relative;
      max-width: 160px;
      height: 32px;
      box-sizing: border-box;
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

    #main {
      display: flex;
      align-items: center;
      height: 100%;
    }

    #editor-container {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 0 6px;
      box-sizing: border-box;
      overflow: hidden;
    }

    #editor {
      width: 100%;
      overflow: auto;
      color: inherit;
      background: none;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: inherit;
      line-height: 10;
      white-space: nowrap;
    }
    #editor::-webkit-scrollbar {
      display: none;
    }
    #editor::before {
      content: attr(data-prefix);
      pointer-events: none;
    }
    #editor::after {
      content: attr(data-suffix);
      pointer-events: none;
    }
    :host([empty]) #editor::before,
    :host([empty]) #editor::after,
    :host(:focus) #editor::before,
    :host(:focus) #editor::after {
      content: "";
    }

    /* Error message */
    :host([error])::before {
      position: absolute;
      left: 0;
      top: 35px;
      white-space: pre;
      content: attr(error);
      font-size: 11px;
      line-height: 1.2;
      pointer-events: none;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type number?
  // @default null
  get value() {
    return this.hasAttribute("value") ? parseFloat(this.getAttribute("value")) : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type number
  // @default Infinity
  get min() {
    return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : -Infinity;
  }
  set min(min) {
    isFinite(min) ? this.setAttribute("min", min) : this.removeAttribute("min");
  }

  // @property
  // @attribute
  // @type number
  // @default Infinity
  get max() {
    return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : Infinity;
  }
  set max(max) {
    isFinite(max) ? this.setAttribute("max", max) : this.removeAttribute("max");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
  }

  // @property
  // @attribute
  // @type number
  // @default 20
  //
  // Maximal number of digits to be shown after the dot. This setting affects only the display value.
  get precision() {
    return this.hasAttribute("precision") ? parseFloat(this.getAttribute("precision")) : 20;
  }
  set precision(value) {
    this.setAttribute("precision", value);
  }

  // @property
  // @attribute
  // @type number
  // @default 1
  //
  // Number by which value should be incremented or decremented when up or down arrow key is pressed.
  get step() {
    return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
  }
  set step(step) {
    this.setAttribute("step", step);
  }

  // @property
  // @attribute
  // @type string
  // @default ""
  get prefix() {
    return this.hasAttribute("prefix") ? this.getAttribute("prefix") : "";
  }
  set prefix(prefix) {
    this.setAttribute("prefix", prefix);
  }

  // @property
  // @attribute
  // @type string
  // @default ""
  get suffix() {
    return this.hasAttribute("suffix") ? this.getAttribute("suffix") : "";
  }
  set suffix(suffix) {
    this.setAttribute("suffix", suffix);
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
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the input should take less horizontal space.
  get condensed() {
    return this.hasAttribute("condensed");
  }
  set condensed(condensed) {
    condensed ? this.setAttribute("condensed", "") : this.removeAttribute("condensed");
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

  _isDragging = false;
  _isChangeStart = false;
  _isArrowKeyDown = false;
  _isBackspaceKeyDown = false;
  _isStepperButtonDown = false;
  _visited = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this._shadowRoot.adoptedStyleSheets = [XNumberInputElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XNumberInputElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
    this._shadowRoot.addEventListener("wheel", (event) => this._onWheel(event));
    this._elements["editor"].addEventListener("paste", (event) => this._onPaste(event));
    this._elements["editor"].addEventListener("input", (event) => this._onEditorInput(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
    this.addEventListener("keyup", (event) => this._onKeyUp(event));
    this.addEventListener("keypress", (event) => this._onKeyPress(event));
    this.addEventListener("incrementstart", (event) => this._onStepperIncrementStart(event));
    this.addEventListener("decrementstart", (event) => this._onStepperDecrementStart(event));
    this.addEventListener("focusin", (event) => this._onFocusIn(event));
    this.addEventListener("focusout", (event) => this._onFocusOut(event));
  }

  connectedCallback() {
    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();
    this._update();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
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
    else if (name === "prefix") {
      this._onPrefixAttributeChange();
    }
    else if (name === "suffix") {
      this._onSuffixAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
    else if (name === "size") {
      this._onSizeAttributeChange();
    }
  }

  // @method
  // @type () => void
  //
  // Override this method to validate the input value manually.
  validate() {
    if (this.value < this.min) {
      this.error = "Value is too low";
    }
    else if (this.value > this.max) {
      this.error = "Value is too high";
    }
    else if (this.required && this.value === null) {
      this.error = "This field is required";
    }
    else {
      this.error = null;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _increment(large = false) {
    let oldValue = this.value
    let newValue = this.value;

    if (large) {
      newValue += this.step * 10;
    }
    else {
      newValue += this.step;
    }

    newValue = normalize(newValue, this.min, this.max, getPrecision(this.step));

    if (oldValue !== newValue) {
      this.value = newValue;
    }

    if (this.matches(":focus")) {
      document.execCommand("selectAll");
    }

    this.validate();
    this._updateEmptyState();
  }

  _decrement(large = false) {
    let oldValue = this.value
    let newValue = this.value;

    if (large) {
      newValue -= this.step * 10;
    }
    else {
      newValue -= this.step;
    }

    newValue = normalize(newValue, this.min, this.max, getPrecision(this.step));

    if (oldValue !== newValue) {
      this.value = newValue;
    }

    if (this.matches(":focus")) {
      document.execCommand("selectAll");
    }

    this.validate();
    this._updateEmptyState();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _maybeDispatchChangeStartEvent() {
    if (!this._isChangeStart) {
      this._isChangeStart = true;
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
    }
  }

  _maybeDispatchChangeEndEvent = debounce(() => {
    if (this._isChangeStart && !this._isArrowKeyDown && !this._isBackspaceKeyDown && !this._isStepperButtonDown) {
      this._isChangeStart = false;
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
  }, 500);

  _commitEditorChanges() {
    let editorTextContent = this._elements["editor"].textContent;
    let editorValue = editorTextContent.trim() === "" ? null : parseFloat(editorTextContent);
    let normalizedEditorValue = normalize(editorValue, this.min, this.max);

    if (normalizedEditorValue !== this.value) {
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
      this.value = normalizedEditorValue;
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
    else if (editorValue !== this.value) {
      this.value = normalizedEditorValue;
    }

    this.validate();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    if (this._visited) {
      this.validate();
    }

    this._updateEditorTextContent();
    this._updateEmptyState();
    this._updateStepper();
  }

  _updateEditorTextContent() {
    if (this.hasAttribute("value")) {
      this._elements["editor"].textContent = this.getAttribute("value").trim();
    }
    else {
      this._elements["editor"].textContent = "";
    }
  }

  _updateEmptyState() {
    let value = null;

    if (this.matches(":focus")) {
      let textContent = this._elements["editor"].textContent;
      value = textContent.trim() === "" ? null : parseFloat(textContent);
    }
    else {
      value = this.value;
    }

    if (value === null) {
      this.setAttribute("empty", "");
    }
    else {
      this.removeAttribute("empty");
    }
  }

  _updateStepper() {
    let stepper = this.querySelector("x-stepper");

    if (stepper) {
      let canDecrement = (this.value > this.min);
      let canIncrement = (this.value < this.max);

      if (canIncrement === true && canDecrement === true) {
        stepper.removeAttribute("disabled");
      }
      else if (canIncrement === false && canDecrement === false) {
        stepper.setAttribute("disabled", "");
      }
      else if (canIncrement === false) {
        stepper.setAttribute("disabled", "increment");
      }
      else if (canDecrement === false) {
        stepper.setAttribute("disabled", "decrement");
      }
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
    this._update();
  }

  _onMinAttributeChange() {
    this._updateStepper();
  }

  _onMaxAttributeChange() {
    this._updateStepper();
  }

  _onPrefixAttributeChange() {
    this._elements["editor"].setAttribute("data-prefix", this.prefix);
  }

  _onSuffixAttributeChange() {
    this._elements["editor"].setAttribute("data-suffix", this.suffix);
  }

  _onDisabledAttributeChange() {
    this._elements["editor"].disabled = this.disabled;
    this._updateAccessabilityAttributes();
  }

  _onSizeAttributeChange() {
    this._updateComputedSizeAttriubte();
  }

  _onFocusIn() {
    this._visited = true;
    document.execCommand("selectAll");
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this._shadowRoot.getSelection().collapse(this._elements["main"]);
    this._elements["editor"].scrollLeft = 0;

    this._commitEditorChanges();
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
  }

  _onEditorInput() {
    this.error = null;
    this._updateEmptyState();
    this._updateStepper();
  }

  _onWheel(event) {
    if (this.matches(":focus")) {
      event.preventDefault();
      this._maybeDispatchChangeStartEvent();

      if (event.wheelDeltaX > 0 || event.wheelDeltaY > 0) {
        this._increment(event.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
      else {
        this._decrement(event.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }

      this._maybeDispatchChangeEndEvent();
    }
  }

  _onClick(event) {
    event.preventDefault();
  }

  _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.target.localName === "x-stepper") {
      // Don't focus the input when user clicks stepper
      pointerDownEvent.preventDefault();
    }
  }

  _onShadowRootPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1 || pointerDownEvent.isPrimary === false) {
      pointerDownEvent.preventDefault();
      return;
    }

    if (pointerDownEvent.target === this._elements["editor"]) {
      if (this._elements["editor"].matches(":focus") === false) {
        pointerDownEvent.preventDefault();

        let initialValue = this.value;
        let cachedClientX = pointerDownEvent.clientX;
        let pointerDownPoint = new DOMPoint(pointerDownEvent.clientX, pointerDownEvent.clientY);
        let pointerMoveListener, lostPointerCaptureListener;

        this.style.cursor = "col-resize";
        this._elements["editor"].setPointerCapture(pointerDownEvent.pointerId);

        this._elements["editor"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
          let pointerMovePoint = new DOMPoint(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
          let deltaTime = pointerMoveEvent.timeStamp - pointerDownEvent.timeStamp;
          let isDistinct = pointerMoveEvent.clientX !== cachedClientX;
          let isIntentional = (getDistanceBetweenPoints(pointerDownPoint, pointerMovePoint) > 3 || deltaTime > 80);
          cachedClientX = pointerMoveEvent.clientX;

          if (isDistinct && isIntentional && pointerMoveEvent.isPrimary) {
            if (this._isDragging === false) {
              this._isDragging = true;
              this._isChangeStart = true;
              this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
            }


            let dragOffset = pointerMoveEvent.clientX - pointerDownEvent.clientX;
            let value = initialValue + (dragOffset * this.step);

            value = normalize(value, this.min, this.max, getPrecision(this.step));
            this.value = value;
            this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
          }
        });

        this._elements["editor"].addEventListener("lostpointercapture",  lostPointerCaptureListener = () => {
          this._elements["editor"].removeEventListener("pointermove", pointerMoveListener);
          this._elements["editor"].removeEventListener("lostpointercapture", lostPointerCaptureListener);

          this.style.cursor = null;

          if (this._isDragging === true) {
            this._isDragging = false;
            this._isChangeStart = false;
            this.dispatchEvent(new CustomEvent("changeend", {detail: this.value !== initialValue, bubbles: true}));
          }
          else {
            this._elements["editor"].focus();
            document.execCommand("selectAll");
          }
        });
      }
    }
  }

  _onStepperIncrementStart(event) {
    let incrementListener, incrementEndListener;

    if (this.matches(":focus")) {
      this._commitEditorChanges();
    }

    this._isStepperButtonDown = true;

    this.addEventListener("increment", incrementListener = (event) => {
      this._maybeDispatchChangeStartEvent();
      this._increment(event.detail.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();
      this._update();
    });

    this.addEventListener("incrementend", incrementEndListener = (event) => {
      this._isStepperButtonDown = false;
      this.removeEventListener("increment", incrementListener);
      this.removeEventListener("incrementend", incrementEndListener);
    });
  }

  _onStepperDecrementStart(event) {
    let decrementListener, decrementEndListener;

    if (this.matches(":focus")) {
      this._commitEditorChanges();
    }

    this._isStepperButtonDown = true;

    this.addEventListener("decrement", decrementListener = (event) => {
      this._maybeDispatchChangeStartEvent();
      this._decrement(event.detail.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();

      this._update();
    });

    this.addEventListener("decrementend", decrementEndListener = (event) => {
      this._isStepperButtonDown = false;
      this.removeEventListener("decrement", decrementListener);
      this.removeEventListener("decrementend", decrementEndListener);
    });
  }

  _onKeyDown(event) {
    if (event.code === "ArrowDown") {
      event.preventDefault();

      this._isArrowKeyDown = true;
      this._maybeDispatchChangeStartEvent();
      this._decrement(event.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();

      this._update();
    }

    else if (event.code === "ArrowUp") {
      event.preventDefault();

      this._isArrowKeyDown = true;
      this._maybeDispatchChangeStartEvent();
      this._increment(event.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();

      this._update();
    }

    else if (event.code === "Backspace") {
      this._isBackspaceKeyDown = true;
    }

    else if (event.code === "Enter") {
      this._commitEditorChanges();
      document.execCommand("selectAll");
    }
  }

  _onKeyUp(event) {
    if (event.code === "ArrowDown") {
      this._isArrowKeyDown = false;
      this._maybeDispatchChangeEndEvent();
    }

    else if (event.code === "ArrowUp") {
      this._isArrowKeyDown = false;
      this._maybeDispatchChangeEndEvent();
    }

    else if (event.code === "Backspace") {
      this._isBackspaceKeyDown = false;
    }
  }

  _onKeyPress(event) {
    if (NUMERIC_KEYS.includes(event.key) === false) {
      event.preventDefault();
    }
  }

  async _onPaste(event) {
    // Allow only for pasting numeric text
    event.preventDefault();
    let content = event.clipboardData.getData("text/plain").trim();

    if (isNumeric(content)) {
      // @bugfix: https://github.com/nwjs/nw.js/issues/3403
      await sleep(1);

      document.execCommand("insertText", false, content);
    }
  }
}

customElements.define("x-numberinput", XNumberInputElement);
