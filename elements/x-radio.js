
// @info
//   Radio widget.
// @doc
//   http://w3c.github.io/aria/aria/aria.html#radio
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-radio.css" data-vulcanize>

      <main id="main">
        <div id="dot"></div>
      </main>
    </template>
  `;

  // @events
  //   change
  class XRadioElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      if (!this.closest("x-radios")) {
        this.setAttribute("tabindex", this.disabled ? "-1" : "0");
      }

      this.setAttribute("role", "radio");
      this.setAttribute("aria-checked", this.toggled);
      this.setAttribute("aria-disabled", this.disabled);
    }

    attributeChangedCallback(name) {
      if (name === "toggled") {
        this._onToggledAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["toggled", "disabled"];
    }

    // @info
    //   Values associated with this widget.
    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get toggled() {
      return this.hasAttribute("toggled");
    }
    set toggled(toggled) {
      toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
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

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onToggledAttributeChange() {
      this.setAttribute("aria-checked", this.toggled);
    }

    _onDisabledAttributeChange() {
      this.setAttribute("tabindex", this.disabled ? "-1" : "0");
      this.setAttribute("aria-disabled", this.disabled);
    }

    _onClick(event) {
      if (!this.closest("x-radios")) {
        if (this.toggled && this.mixed) {
          this.mixed = false;
        }
        else {
          this.mixed = false;
          this.toggled = !this.toggled;
        }

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    }

    _onPointerDown(event) {
      // Don't focus the checkbox with pointer
      event.preventDefault();
      this.focus();
      this.blur();
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.click();
      }
    }
  };

  customElements.define("x-radio", XRadioElement);
}
