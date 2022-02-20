
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-tag
// @part main scope remove-button
// @event ^remove - User clicked the remove button of a removable tag.
export default class XTagElement extends HTMLElement {
  static observedAttributes = ["disabled", "size"];

  static #shadowTemplate = html`
    <template>
      <div id="container">
        <div id="scope" part="scope">
          <slot id="scope-slot" name="scope"></slot>
        </div>

        <main id="main" part="main">
          <slot></slot>

          <svg id="remove-button" part="remove-button" viewBox="0 0 100 100">
            <path id="remove-button-path"></path>
          </svg>
        </main>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: inline-block;;
      height: 25px;
      box-sizing: border-box;
      overflow: hidden;
      color: var(--text-color);
      border-width: 1px;
      border-style: solid;
    }
    :host([toggled]) {
      background: gray;
      color: white;
      outline: none;
    }
    :host([disabled]) {
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:focus) {
      outline: none;
    }

    #container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #scope {
      height: 100%;
      padding: 0 6px;
      display: none;
      align-items: center;
      justify-content: center;
      border-right-width: 1px;
      border-right-style: solid;
    }
    :host([scoped]) #scope {
      display: flex;
    }

    #main {
      height: 100%;
      padding: 0 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #remove-button {
      display: none;
      opacity: 0.8;
      width: 12px;
      height: 12px;
      vertical-align: middle;
      margin-left: 4px;
      d: path("M 25 16 L 50 41 L 75 16 L 84 25 L 59 50 L 84 75 L 75 84 L 50 59 L 25 84 L 16 75 L 41 50 L 16 25 Z");
      fill: currentColor;
      color: inherit;
    }
    :host([removable]) #remove-button {
      display: block;
    }
    #remove-button:hover {
      background: rgba(0, 0, 0, 0.1);
      opacity: 1;
    }

    #remove-button path {
      d: inherit;
      fill: inherit;
      pointer-events: none;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string?
  // @default null
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get removable() {
    return this.hasAttribute("removable");
  }
  set removable(removable) {
    removable ? this.setAttribute("removable", "") : this.removeAttribute("removable");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
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
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  //
  // Custom widget size.
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  //
  // Resolved widget size, used for theming purposes.
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  #shadowRoot = null;
  #elements = {};
  #xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XTagElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTagElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.#elements["scope-slot"].addEventListener("slotchange", () => this.#updateScopedAttribute());
    this.#elements["remove-button"].addEventListener("click", (event) => this.#onRemoveButtonClick(event));
  }

  connectedCallback() {
    this.#updateComputedSizeAttriubte();
    this.#updateScopedAttribute();

    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => this.#updateComputedSizeAttriubte());

    if (this.closest("x-tags")) {
      this.tabIndex = 0;
      this.removable = false;
    }
    else if (this.closest("x-tagsinput")) {
      this.toggled = false;
      this.tabIndex = 0;
      this.removable = true;
    }
    else {
      this.removable = false;
    }
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "size") {
      this.#updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onRemoveButtonClick(event) {
    if (event.buttons <= 1) {
      this.dispatchEvent(new CustomEvent("remove", {bubbles: true}));
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateComputedSizeAttriubte() {
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

  #updateScopedAttribute() {
    if (this.#elements["scope-slot"].assignedElements().length === 0) {
      this.removeAttribute("scoped");
    }
    else {
      this.setAttribute("scoped", "");
    }
  }
}

customElements.define("x-tag", XTagElement);
