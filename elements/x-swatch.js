
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-swatch
export default class XSwatchElement extends HTMLElement {
  static observedAttributes = ["value", "size"];

  static _shadowTemplate = html`
    <template>
      <div id="preview"></div>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: 18px;
      height: 18px;
      cursor: default;
      box-sizing: border-box;
      overflow: hidden;
    }

    #preview {
      width: 100%;
      height: 100%;
      position: relative;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default "white"
  //
  // Color value following the <a href="https://www.w3.org/TR/css-color-3/#colorunits">CSS syntax</a>.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "white";
  }
  set value(value) {
    this.setAttribute("value", value);
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

  _shadowRoot = null;
  _elements = {};
  _xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XSwatchElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XSwatchElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }
  }

  connectedCallback() {
    this._updatePreview();
    this._updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._updatePreview();
    }
    else if (name === "size") {
      this._updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updatePreview() {
    this._elements["preview"].style.background = this.value;
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
}

customElements.define("x-swatch", XSwatchElement);
