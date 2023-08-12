
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest, createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep, throttle} from "../utils/time.js";

const DEBUG = false;
const WINDOW_PADDING = 7;

let $itemChild = Symbol();

// @element x-select
// @part arrow
// @event ^change {oldValue:string?, newValue:string?}
export default class XSelectElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <div id="button">
        <div id="arrow-container">
          <svg id="arrow" part="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path id="arrow-path"></path>
          </svg>
        </div>
      </div>

      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
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
      -webkit-user-select: none;
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
      display: flex;
      align-content: center;
      justify-content: center;
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
      --text-color: 50%;
      --path-data: M 25 41 L 50 16 L 75 41 L 83 34 L 50 1 L 17 34 Z M 17 66 L 50 100 L 83 66 L 75 59 L 50 84 L 25 59 Z;
    }

    #button > #arrow-container #arrow path {
      fill: currentColor;
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
  #elements = {};
  #lastTabIndex = 0;
  #wasFocusedBeforeExpanding = false;

  #resizeListener = null;
  #blurListener = null;
  #xelThemeChangeListener = null;

  #mutationObserver = new MutationObserver((args) => this.#onMutation(args));
  #resizeObserver = new ResizeObserver(() => this.#onResize());

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XSelectElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XSelectElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.#elements["backdrop"] = createElement("x-backdrop");
    this.#elements["backdrop"].style.opacity = "0";
    this.#elements["backdrop"].ownerElement = this;
    this.#elements["backdrop"].addEventListener("click", (event) => this.#onBackdropClick(event));

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("toggle", (event) => this.#onMenuItemToggle(event));
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  connectedCallback() {
    this.#mutationObserver.observe(this, {childList: true, attributes: true, characterData: true, subtree: true});
    this.#resizeObserver.observe(this);

    this.#updateButton();
    this.#updateArrowPathData();
    this.#updateAccessabilityAttributes();

    if (DEBUG) {
      this.setAttribute("debug", "");
    }

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#updateArrowPathData());
  }

  disconnectedCallback() {
    this.#mutationObserver.disconnect();
    this.#resizeObserver.disconnect();

    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #expand() {
    if (this.#canExpand() === false) {
      return;
    }

    this.#wasFocusedBeforeExpanding = this.matches(":focus");
    this.#elements["backdrop"].show(false);

    window.addEventListener("resize", this.#resizeListener = () => {
      this.#collapse();
    });

    window.addEventListener("blur", this.#blurListener = () => {
      if (DEBUG === false) {
        this.#collapse()
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
        let buttonChild = this.#elements["button"].querySelector("x-label") ||
                          this.#elements["button"].firstElementChild;
        let itemChild = buttonChild[$itemChild];

        menu.openOverElement(buttonChild, itemChild);
      }
      else {
        let item = menu.querySelector("x-menuitem").firstElementChild;
        menu.openOverElement(this.#elements["button"], item);
      }
    }

    // Increase menu width if it is narrower than the button
    {
      let menuBounds = menu.getBoundingClientRect();
      let buttonBounds = this.#elements["button"].getBoundingClientRect();
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

  async #collapse(whenTriggerEnd = null) {
    if (this.#canCollapse() === false) {
      return;
    }

    let menu = this.querySelector(":scope > x-menu");
    menu.setAttribute("closing", "");
    await whenTriggerEnd;
    this.#elements["backdrop"].hide(false);

    if (this.#wasFocusedBeforeExpanding) {
      this.focus();
    }
    else {
      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    window.removeEventListener("resize", this.#resizeListener);
    window.removeEventListener("blur", this.#blurListener);

    await menu.close();
    menu.removeAttribute("closing");
  }

  #canExpand() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === false && menu.hasAttribute("closing") === false && item !== null;
    }
  }

  #canCollapse() {
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

  #updateButton() {
    let toggledItem = this.querySelector(`:scope > x-menu x-menuitem[toggled]`);
    this.#elements["button"].innerHTML = "";

    if (toggledItem) {
      for (let itemChild of toggledItem.children) {
        let buttonChild = itemChild.cloneNode(true);
        buttonChild[$itemChild] = itemChild;
        buttonChild.removeAttribute("id");
        buttonChild.removeAttribute("style");
        this.#elements["button"].append(buttonChild);
      }

      this.#updateButtonChildrenSize();
    }

    this.#elements["button"].append(this.#elements["arrow-container"]);
  }

  #updateButtonThrottled = throttle(this.#updateButton, 300, this);

  #updateButtonChildrenSize() {
    for (let buttonChild of this.#elements["button"].children) {
      if (buttonChild !== this.#elements["arrow-container"]) {
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

  #updateArrowPathData() {
    let pathData = getComputedStyle(this.#elements["arrow"]).getPropertyValue("--path-data");
    this.#elements["arrow-path"].setAttribute("d", pathData);
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("aria-disabled", this.disabled);

    // Update "tabindex" attribute
    {
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #onMutation(records) {
    for (let record of records) {
      if (
        record.type === "attributes" &&
        record.target.localName === "x-menuitem" &&
        record.attributeName === "toggled"
      ) {
        await sleep(10);
        this.#updateButtonThrottled();
        break;
      }
    }
  }

  #onResize() {
    this.#updateButtonChildrenSize();
  }

  #onPointerDown(event) {
    // Don't focus the widget with pointer
    if (!event.target.closest("x-menu") && this.matches(":focus") === false) {
      event.preventDefault();
    }
  }

  async #onClick(event) {
    if (event.buttons > 1) {
      return;
    }

    if (this.#canExpand()) {
      this.#expand();
    }
    else if (this.#canCollapse()) {
      let clickedItem = event.target.closest("x-menuitem");

      if (clickedItem) {
        let oldValue = this.value;
        let newValue = clickedItem.value;

        for (let item of this.querySelectorAll("x-menuitem")) {
          item.toggled = (item === clickedItem);
        }

        await this.#collapse(clickedItem.whenTriggerEnd);

        if (oldValue !== newValue || this.mixed) {
          this.mixed = false;
          this.dispatchEvent(new CustomEvent("change", {bubbles: true, detail: {oldValue, newValue}}));
        }
      }
    }
  }

  #onMenuItemToggle(event) {
    // We will toggle the menu items manually
    event.preventDefault();
  }

  #onBackdropClick(event) {
    this.#collapse();
  }

  #onKeyDown(event) {
    if (event.defaultPrevented === false) {
      let menu = this.querySelector(":scope > x-menu");

      if (event.key === "Enter" || event.key === "Space" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (this.#canExpand()) {
          event.preventDefault();
          this.#expand();
        }
      }

      else if (event.key === "Escape") {
        if (this.#canCollapse()) {
          event.preventDefault();
          this.#collapse();
        }
      }
    }
  }
}

customElements.define("x-select", XSelectElement);
