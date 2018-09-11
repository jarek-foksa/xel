
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let debug = false;

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        width: 100%;
        height: fit-content;
        box-sizing: border-box;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.6;
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
    </style>

    <svg id="backdrop" hidden>
      <path id="backdrop-path"></path>
    </svg>

    <slot></slot>
  </template>
`;

export class XMenuBarElement extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
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

  constructor() {
    super();

    this._expanded = false;

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("focusout", (event) => this._onFocusOut(event));
    this._shadowRoot.addEventListener("pointerover", (event) => this._onShadowRootPointerOver(event));
    this._shadowRoot.addEventListener("click", (event) => this._onShadowRootClick(event));
    this._shadowRoot.addEventListener("wheel", (event) => this._onShadowRootWheel(event));
    this._shadowRoot.addEventListener("keydown", (event) => this._onShadowRootKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "menubar");
    this.setAttribute("aria-disabled", this.disabled);

    window.addEventListener("orientationchange", this._orientationChangeListener = () => {
      this._onOrientationChange();
    });
  }

  disconnectedCallback() {
    window.removeEventListener("orientationchange", this._orientationChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _expandMenubarItem(item) {
    let menu = item.querySelector(":scope > x-menu");

    if (menu && menu.opened === false) {
      item.focus();
      this._expanded = true;
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

  _collapseMenubarItems() {
    return new Promise( async (resolve) => {
      this._expanded = false;
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

  _expandPreviousMenubarItem() {
    let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
    let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

    if (items.length > 1 && focusedItem) {
      let i = items.indexOf(focusedItem);
      let previousItem = items[i - 1] || items[items.length-1];
      this._expandMenubarItem(previousItem);
    }
  }

  _expandNextMenubarItem() {
    let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
    let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

    if (focusedItem && items.length > 1) {
      let i = items.indexOf(focusedItem);
      let nextItem = items[i + 1] || items[0];
      this._expandMenubarItem(nextItem);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onDisabledAttributeChange() {
    this.setAttribute("aria-disabled", this.disabled);
  }

  _onFocusOut(event) {
    if ((event.relatedTarget === null || this.contains(event.relatedTarget) === false) && debug === false) {
      this._collapseMenubarItems();
    }
  }

  _onOrientationChange() {
    this._collapseMenubarItems();
  }

  _onShadowRootWheel(event) {
    let openedMenu = this.querySelector("x-menu[opened]");

    if (openedMenu && openedMenu.contains(event.target) === false) {
      event.preventDefault();
    }
  }

  async _onShadowRootClick(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");
    let ownerMenu = event.target.closest("x-menu");

    if (item && item.disabled === false && (!ownerMenu || ownerMenu.contains(item))) {
      let menu = item.querySelector("x-menu");

      if (item.parentElement === this) {
        if (menu) {
          menu.opened ? this._collapseMenubarItems() : this._expandMenubarItem(item);
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
          await this._collapseMenubarItems();

          this.removeAttribute("closing");
        }
      }
    }

    else if (event.target === this["#backdrop-path"]) {
      this._collapseMenubarItems();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _onShadowRootPointerOver(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");

    if (event.target.closest("x-menu") === null && item && item.parentElement === this) {
      if (this._expanded && event.pointerType === "mouse") {
        if (item.hasAttribute("expanded") === false) {
          this._expandMenubarItem(item);
        }
        else {
          item.focus();
        }
      }
    }
  }

  _onShadowRootKeyDown(event) {
    if (this.hasAttribute("closing")) {
      event.stopPropagation();
      event.preventDefault();
    }

    else if (event.code === "Enter" || event.code === "Space") {
      let focusedMenubarItem = this.querySelector(":scope > x-menuitem:focus");

      if (focusedMenubarItem) {
        event.preventDefault();
        focusedMenubarItem.click();
      }
    }

    else if (event.code === "Escape") {
      if (this._expanded) {
        event.preventDefault();
        this._collapseMenubarItems();
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
      this._expandNextMenubarItem();
    }

    else if (event.code === "ArrowLeft") {
      this._expandPreviousMenubarItem();
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
