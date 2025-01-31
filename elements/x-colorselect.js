
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-colorselect
// @event ^change
// @event ^changestart
// @event ^changeend
// @event collapse
// @part popover
export default class XColorSelectElement extends HTMLElement {
  static observedAttributes = ["value", "alpha", "spaces", "disabled", "size"];

  static #shadowTemplate = html`
    <template>
      <div id="preview"></div>

      <x-popover id="popover" part="popover" modal>
        <main>
          <x-colorpicker id="color-picker"></x-colorpicker>
        </main>
      </x-popover>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 32px;
      height: 32px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      background: var(--checkboard-background);
    }
    :host([hidden]) {
      display: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.4;
    }

    #preview {
      width: 100%;
      height: 100%;
    }

    #popover {
      --align: left;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default "#000000"
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "#000000";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether to allow manipulation of the alpha channel.
  get alpha() {
    return this.hasAttribute("alpha");
  }
  set alpha(alpha) {
    alpha ? this.setAttribute("alpha", "") : this.removeAttribute("alpha");
  }

  // @property
  // @attribute
  // @type Array<string>
  // @default ["srgb", "p3"]
  //
  // Allowed color spaces. Value that does not match any of the provided spaces will be converted to the last space.
  get spaces() {
    if (this.hasAttribute("spaces")) {
      return this.getAttribute("spaces").replace(/\s+/g, " ").split(" ");
    }
    else {
      return ["srgb", "p3"];
    }
  }
  set spaces(spaces) {
    this.setAttribute("spaces", spaces.join(" "));
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
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  #shadowRoot = null;
  #wasFocusedBeforeExpanding = false;
  #isChangingColorPicker = false;
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XColorSelectElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XColorSelectElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this["#preview"].addEventListener("click", (event) => this.#onClick(event));
    this["#popover"].addEventListener("close", () => this.#onPopoverClose());
    this["#color-picker"].addEventListener("changestart", () => this.#onColorPickerChangeStart());
    this["#color-picker"].addEventListener("change", (event) => this.#onColorPickerChange(event));
    this["#color-picker"].addEventListener("changeend", () => this.#onColorPickerChangeEnd());
  }

  connectedCallback() {
    this["#color-picker"].setAttribute("value", this.value);

    this.#updateAccessabilityAttributes();
    this.#updatePreview();
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "alpha") {
      this.#onAlphaAttributeChange();
    }
    else if (name === "spaces") {
      this.#onSpacesAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
    else if (name === "size") {
      this.#onSizeAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #expand() {
    if (this.hasAttribute("expanded") === false) {
      this.#wasFocusedBeforeExpanding = this.matches(":focus");
      this.setAttribute("expanded", "");
      await this["#popover"].open(this);
      this["#popover"].focus();
    }
  }

  async #collapse(delay = null) {
    if (this.hasAttribute("expanded")) {
      this["#popover"].setAttribute("closing", "");

      await this["#popover"].close();
      this.removeAttribute("expanded");

      if (this.#wasFocusedBeforeExpanding) {
        this.focus();
      }
      else {
        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      this["#popover"].removeAttribute("closing");
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updatePreview() {
    this["#preview"].style.background = this.value;
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("aria-disabled", this.disabled);

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

  #onValueAttributeChange() {
    if (this.#isChangingColorPicker === false) {
      this.#updatePreview();

      if (this["#color-picker"].getAttribute("value") !== this.getAttribute("value")) {
        this["#color-picker"].setAttribute("value", this.getAttribute("value"));
      }
    }
  }

  #onAlphaAttributeChange() {
    this["#color-picker"].alpha = this.alpha;
  }

  #onSpacesAttributeChange() {
    this["#color-picker"].spaces = this.spaces;
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  #onSizeAttributeChange() {
    this["#color-picker"].size = this.size;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onColorPickerChangeStart() {
    this.#isChangingColorPicker = true;
    this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}))
  }

  #onColorPickerChange(event) {
    this.value = this["#color-picker"].value;
    this.dispatchEvent(new CustomEvent("change", {bubbles: true}))
    this.#updatePreview();
  }

  #onColorPickerChangeEnd() {
    this.#isChangingColorPicker = false;
    this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}))
  }

  #onPointerDown(event) {
    // Don't focus the widget with pointer
    if (event.target === this && this.matches(":focus") === false) {
      event.preventDefault();
    }
  }

  #onClick(event) {
    if (this["#popover"].opened === false) {
      event.preventDefault();
      this.#expand();
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      event.preventDefault();
      event.stopPropagation();

      if (this.hasAttribute("expanded")) {
        this.#collapse();
      }
      else {
        this.#expand();
      }
    }

    else if (event.code === "Escape") {
      if (this.hasAttribute("expanded")) {
        event.preventDefault();
        this.#collapse();
      }
    }

    else if (event.code === "Tab") {
      if (this.hasAttribute("expanded")) {
        event.preventDefault();
      }
    }
  }

  #onPopoverClose() {
    this.dispatchEvent(new CustomEvent("collapse"));
    this.#collapse();
  }
}

customElements.define("x-colorselect", XColorSelectElement);
