
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";
import {html, css} from "../utils/template.js";

const DEBUG = false;

// @element x-menubar
export default class XMenuBarElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <svg id="backdrop" hidden>
        <path id="backdrop-path"></path>
      </svg>

      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      align-items: center;
      width: 100%;
      height: 36px;
      font-size: 14px;
      box-sizing: border-box;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.6;
    }
    :host([hidden]) {
      display: none;
    }

    #backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      pointer-events: none;
      touch-action: none;
    }
    #backdrop[hidden] {
      display: none;
    }

    #backdrop path {
      fill: red;
      fill-rule: evenodd;
      opacity: 0;
      pointer-events: all;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
  #expanded = false;
  #orientationChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XMenuBarElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XMenuBarElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("focusout", (event) => this.#onFocusOut(event));
    this.#shadowRoot.addEventListener("pointerover", (event) => this.#onShadowRootPointerOver(event));
    this.#shadowRoot.addEventListener("click", (event) => this.#onShadowRootClick(event));
    this.#shadowRoot.addEventListener("wheel", (event) => this.#onShadowRootWheel(event));
    this.#shadowRoot.addEventListener("keydown", (event) => this.#onShadowRootKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "menubar");
    this.setAttribute("aria-disabled", this.disabled);

    window.addEventListener("orientationchange", this.#orientationChangeListener = () => {
      this.#onOrientationChange();
    });
  }

  disconnectedCallback() {
    window.removeEventListener("orientationchange", this.#orientationChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #expandMenubarItem(item) {
    let menu = item.querySelector(":scope > x-menu");

    if (menu && menu.opened === false) {
      item.focus();
      this.#expanded = true;
      this.style.touchAction = "none";

      // Open item's menu and close other menus
      {
        menu.openNextToElement(item, "vertical");

        let menus = this.querySelectorAll(":scope > x-menuitem > x-menu");
        let otherMenus = [...menus].filter($0 => $0 !== menu);

        for (let otherMenu of otherMenus) {
          if (otherMenu) {
            otherMenu.close(false);
          }
        }
      }

      // Show the backdrop
      {
        let {x, y, width, height} = this.getBoundingClientRect();

        this["#backdrop-path"].setAttribute("d", `
          M 0 0
          L ${window.innerWidth} 0
          L ${window.innerWidth} ${window.innerHeight}
          L 0 ${window.innerHeight}
          L 0 0
          M ${x} ${y}
          L ${x + width} ${y}
          L ${x + width} ${y + height}
          L ${x} ${y + height}
        `);

        this["#backdrop"].removeAttribute("hidden");
      }
    }
  }

  #collapseMenubarItems() {
    return new Promise( async (resolve) => {
      this.#expanded = false;
      this.style.touchAction = null;

      // Hide the backdrop
      {
        this["#backdrop"].setAttribute("hidden", "");
        this["#backdrop-path"].setAttribute("d", "");
      }

      // Close all opened menus
      {
        let menus = this.querySelectorAll(":scope > x-menuitem > x-menu[opened]");

        for (let menu of menus) {
          await menu.close(true);
        }
      }

      let focusedMenuItem = this.querySelector("x-menuitem:focus");

      if (focusedMenuItem) {
        focusedMenuItem.blur();
      }

      resolve();
    });
  }

  #expandPreviousMenubarItem() {
    let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
    let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

    if (items.length > 1 && focusedItem) {
      let i = items.indexOf(focusedItem);
      let previousItem = items[i - 1] || items[items.length-1];
      this.#expandMenubarItem(previousItem);
    }
  }

  #expandNextMenubarItem() {
    let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
    let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

    if (focusedItem && items.length > 1) {
      let i = items.indexOf(focusedItem);
      let nextItem = items[i + 1] || items[0];
      this.#expandMenubarItem(nextItem);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onDisabledAttributeChange() {
    this.setAttribute("aria-disabled", this.disabled);
  }

  #onFocusOut(event) {
    if ((event.relatedTarget === null || this.contains(event.relatedTarget) === false) && DEBUG === false) {
      this.#collapseMenubarItems();
    }
  }

  #onOrientationChange() {
    this.#collapseMenubarItems();
  }

  #onShadowRootWheel(event) {
    let openedMenu = this.querySelector("x-menu[opened]");

    if (openedMenu && openedMenu.contains(event.target) === false) {
      event.preventDefault();
    }
  }

  async #onShadowRootClick(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");
    let ownerMenu = event.target.closest("x-menu");

    if (item && item.disabled === false && (!ownerMenu || ownerMenu.contains(item))) {
      let menu = item.querySelector("x-menu");

      if (item.parentElement === this) {
        if (menu) {
          menu.opened ? this.#collapseMenubarItems() : this.#expandMenubarItem(item);
        }
      }
      else {
        if (menu) {
          if (menu.opened && menu.opened === false) {
            menu.openNextToElement(item, "horizontal");
          }
        }
        else {
          this.setAttribute("closing", "");

          await item.whenTriggerEnd;
          await this.#collapseMenubarItems();

          this.removeAttribute("closing");
        }
      }
    }

    else if (event.target === this["#backdrop-path"]) {
      this.#collapseMenubarItems();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  #onShadowRootPointerOver(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");

    if (event.target.closest("x-menu") === null && item && item.parentElement === this) {
      if (this.#expanded && event.pointerType !== "touch") {
        if (item.hasAttribute("expanded") === false) {
          this.#expandMenubarItem(item);
        }
        else {
          item.focus();
        }
      }
    }
  }

  #onShadowRootKeyDown(event) {
    if (this.hasAttribute("closing")) {
      event.stopPropagation();
      event.preventDefault();
    }

    else if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      let focusedMenubarItem = this.querySelector(":scope > x-menuitem:focus");

      if (focusedMenubarItem) {
        event.preventDefault();
        focusedMenubarItem.click();
      }
    }

    else if (event.code === "Escape") {
      if (this.#expanded) {
        event.preventDefault();
        this.#collapseMenubarItems();
      }
    }

    else if (event.code === "Tab") {
      let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

      if (refItem) {
        refItem.focus();

        let menu = refItem.querySelector(":scope > x-menu");

        if (menu) {
          menu.tabIndex = -1;

          menu.close().then(() => {
            menu.tabIndex = -1;
          });
        }
      }
    }

    else if (event.code === "ArrowRight") {
      this.#expandNextMenubarItem();
    }

    else if (event.code === "ArrowLeft") {
      this.#expandPreviousMenubarItem();
    }

    else if (event.code === "ArrowDown") {
      let menu = this.querySelector("x-menuitem:focus > x-menu");

      if (menu) {
        event.preventDefault();
        menu.focusFirstMenuItem();
      }
    }

    else if (event.code === "ArrowUp") {
      let menu = this.querySelector("x-menuitem:focus > x-menu");

      if (menu) {
        event.preventDefault();
        menu.focusLastMenuItem();
      }
    }
  }
}

customElements.define("x-menubar", XMenuBarElement);
