
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest, createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {throttle} from "../utils/time.js";

const DEBUG = false;
const WINDOW_PADDING = 7;

let $itemChild = Symbol();

// @element x-select
// @part arrow
// @event ^change {oldValue:string?, newValue:string?}
export default class XSelectElement extends HTMLElement {
  static observedAttributes = ["disabled", "size"];

  static _shadowTemplate = html`
    <template>
      <div id="button">
        <div id="arrow-container">
          <svg id="arrow" part="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path></path>
          </svg>
        </div>
      </div>

      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: fit-content;
      height: 32px;
      padding: 0 0 0 9px;
      max-width: 100%;
      box-sizing: border-box;
      position: relative;
      outline: none;
      font-size: 14px;
      user-select: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:hover) {
      cursor: default;
    }

    #button {
      display: flex;
      flex-flow: row;
      align-items: center;
      justify-content: flex-start;
      flex: 1;
      width: 100%;
      height: 100%;
    }

    :host([mixed]) #button > * {
      opacity: 0.7;
    }

    #button > x-label {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    #button > #arrow-container {
      margin: 0 0 0 auto;
      z-index: 999;
    }

    #button > #arrow-container #arrow {
      display: flex;
      width: 13px;
      height: 13px;
      min-width: 13px;
      margin: 0 2px 0 11px;
      color: currentColor;
      d: path("M 25 41 L 50 16 L 75 41 L 83 34 L 50 1 L 17 34 Z M 17 66 L 50 100 L 83 66 L 75 59 L 50 84 L 25 59 Z");
    }

    #button > #arrow-container #arrow path {
      fill: currentColor;
      d: inherit;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @type string?
  // @default null
  get value() {
    let item = this.querySelector(`x-menuitem[toggled]`);
    return item ? item.value : null;
  }
  set value(value) {
    for (let item of this.querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === value && value !== null);
    }
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether this select has "mixed" state.
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
  _wasFocusedBeforeExpanding = false;

  _resizeListener = null;
  _blurListener = null;
  _xelSizeChangeListener = null;

  _mutationObserver = new MutationObserver((args) => this._onMutation(args));
  _resizeObserver = new ResizeObserver(() => this._onResize());

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XSelectElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XSelectElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this._elements["backdrop"] = createElement("x-backdrop");
    this._elements["backdrop"].style.opacity = "0";
    this._elements["backdrop"].ownerElement = this;
    this._elements["backdrop"].addEventListener("click", (event) => this._onBackdropClick(event));

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("toggle", (event) => this._onMenuItemToggle(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    this._mutationObserver.observe(this, {childList: true, attributes: true, characterData: true, subtree: true});
    this._resizeObserver.observe(this);

    this._updateButton();
    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();

    if (DEBUG) {
      this.setAttribute("debug", "");
    }

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    this._mutationObserver.disconnect();
    this._resizeObserver.disconnect();

    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._updateAccessabilityAttributes();
    }
    else if (name === "size") {
      this._updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _expand() {
    if (this._canExpand() === false) {
      return;
    }

    this._wasFocusedBeforeExpanding = this.matches(":focus");
    this._elements["backdrop"].show(false);

    window.addEventListener("resize", this._resizeListener = () => {
      this._collapse();
    });

    window.addEventListener("blur", this._blurListener = () => {
      if (DEBUG === false) {
        this._collapse()
      }
    });

    let menu = this.querySelector(":scope > x-menu");

    // Ensure all items are togglable, there is at most one toggled menu item and all other items are not toggled
    {
      let toggledItem = null;

      for (let item of menu.querySelectorAll("x-menuitem")) {
        item.togglable = true;

        if (item.toggled) {
          if (toggledItem === null) {
            toggledItem = item;
          }
          else {
            item.toggled = false;
          }
        }
      }
    }

    // Open the menu
    {
      let toggledItem = menu.querySelector(`x-menuitem[toggled]`);

      if (toggledItem) {
        let buttonChild = this._elements["button"].querySelector("x-label") ||
                          this._elements["button"].firstElementChild;
        let itemChild = buttonChild[$itemChild];

        menu.openOverElement(buttonChild, itemChild);
      }
      else {
        let item = menu.querySelector("x-menuitem").firstElementChild;
        menu.openOverElement(this._elements["button"], item);
      }
    }

    // Increase menu width if it is narrower than the button
    {
      let menuBounds = menu.getBoundingClientRect();
      let buttonBounds = this._elements["button"].getBoundingClientRect();
      let hostPaddingRight = parseFloat(getComputedStyle(this).paddingRight);

      if (menuBounds.right - hostPaddingRight < buttonBounds.right) {
        menu.style.minWidth = (buttonBounds.right - menuBounds.left + hostPaddingRight) + "px";
      }
    }

    // Reduce menu width if it oveflows the right client bound
    {
      let menuBounds = this.getBoundingClientRect();

      if (menuBounds.right + WINDOW_PADDING > window.innerWidth) {
        this.style.maxWidth = (window.innerWidth - menuBounds.left - WINDOW_PADDING) + "px";
      }
    }
  }

  async _collapse(whenTriggerEnd = null) {
    if (this._canCollapse() === false) {
      return;
    }

    let menu = this.querySelector(":scope > x-menu");
    menu.setAttribute("closing", "");
    await whenTriggerEnd;
    this._elements["backdrop"].hide(false);

    if (this._wasFocusedBeforeExpanding) {
      this.focus();
    }
    else {
      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    window.removeEventListener("resize", this._resizeListener);
    window.removeEventListener("blur", this._blurListener);

    await menu.close();
    menu.removeAttribute("closing");
  }

  _canExpand() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === false && menu.hasAttribute("closing") === false && item !== null;
    }
  }

  _canCollapse() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === true && menu.hasAttribute("closing") === false;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateButton() {
    let toggledItem = this.querySelector(`:scope > x-menu x-menuitem[toggled]`);
    this._elements["button"].innerHTML = "";

    if (toggledItem) {
      for (let itemChild of toggledItem.children) {
        let buttonChild = itemChild.cloneNode(true);
        buttonChild[$itemChild] = itemChild;
        buttonChild.removeAttribute("id");
        buttonChild.removeAttribute("style");
        this._elements["button"].append(buttonChild);
      }

      this._updateButtonChildrenSize();
    }

    this._elements["button"].append(this._elements["arrow-container"]);
  }

  _updateButtonThrottled = throttle(this._updateButton, 300, this);

  _updateButtonChildrenSize() {
    for (let buttonChild of this._elements["button"].children) {
      if (buttonChild !== this._elements["arrow-container"]) {
        let {width, height, margin, padding, border, borderRadius} = getComputedStyle(buttonChild[$itemChild]);

        if (["x-icon", "x-swatch", "img", "svg"].includes(buttonChild[$itemChild].localName)) {
          buttonChild.style.width = width;
          buttonChild.style.height = height;
          buttonChild.style.minWidth = width;
          buttonChild.style.borderRadius = borderRadius;
        }

        buttonChild.style.margin = margin;
        buttonChild.style.padding = padding;
        buttonChild.style.border = border;
      }
    }
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("aria-disabled", this.disabled);

    // Update "tabindex" attribute
    {
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

    // Update "role" attributes
    {
      this.setAttribute("role", "button");
      let menu = this.querySelector(":scope > x-menu");

      if (menu) {
        menu.setAttribute("role", "listbox");

        for (let item of menu.querySelectorAll("x-menuitem")) {
          item.setAttribute("role", "option");
        }
      }
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

  _onMutation(records) {
    for (let record of records) {
      if (
        record.type === "attributes" &&
        record.target.localName === "x-menuitem" &&
        record.attributeName === "toggled"
      ) {
        this._updateButtonThrottled();
      }
    }
  }

  _onResize() {
    this._updateButtonChildrenSize();
  }

  _onPointerDown(event) {
    // Don't focus the widget with pointer
    if (!event.target.closest("x-menu") && this.matches(":focus") === false) {
      event.preventDefault();
    }
  }

  async _onClick(event) {
    if (event.button !== 0) {
      return;
    }

    if (this._canExpand()) {
      this._expand();
    }
    else if (this._canCollapse()) {
      let clickedItem = event.target.closest("x-menuitem");

      if (clickedItem) {
        let oldValue = this.value;
        let newValue = clickedItem.value;

        for (let item of this.querySelectorAll("x-menuitem")) {
          item.toggled = (item === clickedItem);
        }

        await this._collapse(clickedItem.whenTriggerEnd);

        if (oldValue !== newValue || this.mixed) {
          this.mixed = false;
          this.dispatchEvent(new CustomEvent("change", {bubbles: true, detail: {oldValue, newValue}}));
        }
      }
    }
  }

  _onMenuItemToggle(event) {
    // We will toggle the menu items manually
    event.preventDefault();
  }

  _onBackdropClick(event) {
    this._collapse();
  }

  _onKeyDown(event) {
    if (event.defaultPrevented === false) {
      let menu = this.querySelector(":scope > x-menu");

      if (event.key === "Enter" || event.key === "Space" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (this._canExpand()) {
          event.preventDefault();
          this._expand();
        }
      }

      else if (event.key === "Escape") {
        if (this._canCollapse()) {
          event.preventDefault();
          this._collapse();
        }
      }
    }
  }
}

customElements.define("x-select", XSelectElement);
