
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {isFinite} = Number;
  let {html} = Xel.utils.element;
  let {isNumeric} = Xel.utils.string;
  let {debounce} = Xel.utils.time;
  let {normalize, getPrecision} = Xel.utils.math;

  let numericKeys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "+", ",", "."];

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-numberinput.css" data-vulcanize>

      <main id="main">
        <div id="editor-container">
          <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
        </div>

        <slot></slot>
      </main>
    </template>
  `;

  // @events
  //   change
  //   changestart
  //   changeend
  //   textinputmodestart
  //   textinputmodeend
  class XNumberInputElement extends HTMLElement {
    constructor() {
      super();

      this._isDragging = false;
      this._isChangeStart = false;
      this._isArrowKeyDown = false;
      this._isBackspaceKeyDown = false;
      this._isStepperButtonDown = false;

      this._maybeDispatchChangeEndEvent = debounce(this._maybeDispatchChangeEndEvent, 500, this);

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
      this._shadowRoot.addEventListener("wheel", (event) => this._onWheel(event));
      this["#editor"].addEventListener("paste", (event) => this._onPaste(event));
      this["#editor"].addEventListener("input", (event) => this._onEditorInput(event));
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
      this.setAttribute("tabindex", this.disabled ? "-1" : "0");
      this.setAttribute("role", "input");
      this.setAttribute("aria-disabled", this.disabled);

      this._update();
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
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["value", "min", "max", "prefix", "suffix", "disabled"];
    }

    // @type
    //   number?
    // @default
    //   null
    // @attribute
    get value() {
      return this.hasAttribute("value") ? parseFloat(this.getAttribute("value")) : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @type
    //   number
    // @default
    //   -Infinity
    // @attribute
    get min() {
      return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : -Infinity;
    }
    set min(min) {
      isFinite(min) ? this.setAttribute("min", min) : this.removeAttribute("min");
    }

    // @type
    //   number
    // @default
    //   Infinity
    // @attribute
    get max() {
      return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : Infinity;
    }
    set max(max) {
      isFinite(max) ? this.setAttribute("max", max) : this.removeAttribute("max");
    }

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

    // @info
    //   Maximal number of digits to be shown after the dot. This setting affects only the display value.
    // @type
    //   number
    // @default
    //   20
    // @attribute
    get precision() {
      return this.hasAttribute("precision") ? parseFloat(this.getAttribute("precision")) : 20;
    }
    set precision(value) {
      this.setAttribute("precision", value);
    }

    // @info
    //   Number by which value should be incremented or decremented when up or down arrow key is pressed.
    // @type
    //   number
    // @default
    //   1
    // @attribute
    get step() {
      return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
    }
    set step(value) {
      this.setAttribute("step", step);
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get prefix() {
      return this.hasAttribute("prefix") ? this.getAttribute("prefix") : "";
    }
    set prefix(prefix) {
      this.setAttribute("prefix", prefix);
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get suffix() {
      return this.hasAttribute("suffix") ? this.getAttribute("suffix") : "";
    }
    set suffix(suffix) {
      this.setAttribute("suffix", suffix);
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
      this["#editor"].setAttribute("data-prefix", this.prefix);
    }

    _onSuffixAttributeChange() {
      this["#editor"].setAttribute("data-suffix", this.suffix);
    }

    _onDisabledAttributeChange() {
      this.setAttribute("tabindex", this.disabled ? "-1" : "0");
      this.setAttribute("aria-disabled", this.disabled);
      this["#editor"].disabled = this.disabled;
    }

    _onFocusIn() {
      document.execCommand("selectAll");
      this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
      this.visited = true;
    }

    _onFocusOut() {
      this._shadowRoot.getSelection().collapse(this["#main"]);
      this._commitEditorChanges();
      this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    }

    _onEditorInput() {
      this._updateState();
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
      if (pointerDownEvent.button !== 0 || pointerDownEvent.isPrimary === false) {
        pointerDownEvent.preventDefault();
        return;
      }

      if (pointerDownEvent.target === this["#editor"]) {
        if (this["#editor"].matches(":focus") === false) {
          pointerDownEvent.preventDefault();

          let initialValue = this.value;
          let cachedClientX = null;
          let pointerMoveListener, lostPointerCaptureListener;

          this.style.cursor = "col-resize";
          this["#editor"].setPointerCapture(pointerDownEvent.pointerId);

          this["#editor"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
            if (pointerMoveEvent.clientX === cachedClientX || pointerMoveEvent.isPrimary === false) {
              return;
            }

            if (this._isDragging === false) {
              this._isDragging = true;
              this._isChangeStart = true;
              this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
            }

            cachedClientX = pointerMoveEvent.clientX;

            let dragOffset = pointerMoveEvent.clientX - pointerDownEvent.clientX;

            let value = initialValue + (dragOffset * this.step);
            value = normalize(value, this.min, this.max, getPrecision(this.step));
            this.value = value;
            this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
          });

          this["#editor"].addEventListener("lostpointercapture",  lostPointerCaptureListener = () => {
            this["#editor"].removeEventListener("pointermove", pointerMoveListener);
            this["#editor"].removeEventListener("lostpointercapture", lostPointerCaptureListener);

            this.style.cursor = null;

            if (this._isDragging === true) {
              this._isDragging = false;
              this._isChangeStart = false;
              this.dispatchEvent(new CustomEvent("changeend", {detail: this.value !== initialValue, bubbles: true}));
            }
            else {
              this["#editor"].focus();
              document.execCommand("selectAll");
            }
          });
        }
      }
    }

    _onStepperIncrementStart(event) {
      let incrementListener, incrementEndListener;

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
      if (numericKeys.includes(event.key) === false) {
        event.preventDefault();
      }
    }

    _onPaste(event) {
      // Allow only for pasting numeric text

      event.preventDefault();
      let content = event.clipboardData.getData("text/plain").trim();

      if (isNumeric(content)) {
        document.execCommand("insertText", false, content);
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Override this method to validate the input value manually.
    // @type
    //   {valid:boolean, hint:string}
    validate() {
      let valid = true;

      if (this.value < this.min) {
        valid = false;
      }
      else if (this.value > this.max) {
        valid = false;
      }
      else if (this.required && this.value === null && this.visited === true) {
        valid = false;
      }

      return valid;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _maybeDispatchChangeStartEvent() {
      if (!this._isChangeStart) {
        this._isChangeStart = true;
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
      }
    }

    _maybeDispatchChangeEndEvent() {
      if (this._isChangeStart && !this._isArrowKeyDown && !this._isBackspaceKeyDown && !this._isStepperButtonDown) {
        this._isChangeStart = false;
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    }

    _commitEditorChanges() {
      let editorValue = this["#editor"].textContent.trim() === "" ? null : parseFloat(this["#editor"].textContent);

      if (editorValue !== this.value) {
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
        this.value = editorValue;
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

      this._updateState();
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

      this._updateState();
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this._updateEditorTextContent();
      this._updateState();
      this._updateStepper();
    }

    _updateEditorTextContent() {
      if (this.hasAttribute("value")) {
        this["#editor"].textContent = this.getAttribute("value").trim();
      }
      else {
        this["#editor"].textContent = "";
      }
    }

    _updateState() {
      let isValid = this.validate();

      if (isValid) {
        this.removeAttribute("invalid");
      }
      else {
        this.setAttribute("invalid", "");
      }

      if (this.value === null) {
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
  }

  customElements.define("x-numberinput", XNumberInputElement);
}
