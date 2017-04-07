
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;
  let theme = document.querySelector('link[href*=".theme.css"]').getAttribute("href");

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="${theme}">
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-input.css" data-vulcanize>

      <main id="main">
        <slot></slot>
        <input id="input" type="text" spellcheck="false"></input>
        <div id="editor" spellcheck="false" contenteditable="plaintext-only" hidden></div>
      </main>
    </template>
  `;

  // @events
  //   input
  //   change
  class XInputElement extends HTMLElement {
    constructor() {
      super();

      this._prevEditorValue = null;

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("focusin", () => this._onFocusIn());
      this.addEventListener("focusout", () => this._onFocusOut());
      this["#input"].addEventListener("input", () => this._onInputInput());
      this["#input"].addEventListener("change", () => this._onInputChange());
      this["#editor"].addEventListener("click", (event) => this._onEditorClick(event));
      this["#editor"].addEventListener("input", () => this._onEditorInput());
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
      else if (name === "type") {
        this._onTypeAttributeChange();
      }
      else if (name === "spellcheck") {
        this._onSpellcheckAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["value", "type", "spellcheck", "disabled"];
    }

    // @type
    //   "text" || "multiline-text" || "email" || "password" || "url"
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
    get value() {
      if (this.type === "multiline-text") {
        return this["#editor"].textContent;
      }
      else {
        return this["#input"].value;
      }
    }
    set value(value) {
      if (this.type === "multiline-text") {
        this["#editor"].textContent = value;
      }
      else {
        this["#input"].value = value;
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Override this method to validate the input value manually.
    // @type
    //   {valid:boolean, hint:string}
    validate() {
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
      else if (this.required && this.value.length === 0 && this.visited === true) {
        valid = false;
        hint = "This field is required";
      }
      else if (this.type === "email" && this.value !== "" && this["#input"].validity.valid === false) {
        valid = false;
        hint = "Invalid e-mail address";
      }
      else if (this.type === "url" && this.value !== "" && this["#input"].validity.valid === false) {
        valid = false;
        hint = "Invalid URL";
      }

      return {valid, hint};
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";
    }

    _onTypeAttributeChange() {
      if (this.type === "text") {
        this["#editor"].hidden = true;
        this["#input"].hidden = false;
        this["#input"].type = "text";
      }
      else if (this.type === "multiline-text") {
        this["#editor"].hidden = false;
        this["#input"].hidden = true;
      }
      else if (this.type === "url") {
        this["#editor"].hidden = true;
        this["#input"].hidden = false;
        this["#input"].type = "url";
      }
      else if (this.type === "email") {
        this["#editor"].hidden = true;
        this["#input"].hidden = false;
        this["#input"].type = "email";
      }
      else if (this.type === "password") {
        this["#editor"].hidden = true;
        this["#input"].hidden = false;
        this["#input"].type = "password";
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

      if (this.value !== this._prevEditorValue) {
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }

      this._prevEditorValue = this.value;
      this._update();
    }

    _onInputInput(event) {
      this._update();
    }

    _onInputChange() {
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    }

    _onFocusIn() {
      this.visited = true;
    }

    _onFocusOut() {
      this._update();
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      let {valid, hint} = this.validate();

      if (valid) {
        this.removeAttribute("invalid");
        this.removeAttribute("invalid-hint");
      }
      else {
        this.setAttribute("invalid", "");
        this.setAttribute("invalid-hint", hint);
      }

      if (this.value.length === 0) {
        this.setAttribute("empty", "");
      }
      else {
        this.removeAttribute("empty");
      }
    }
  }

  customElements.define("x-input", XInputElement);
}
