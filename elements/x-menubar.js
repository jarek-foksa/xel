
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import {compareArrays} from "../utils/array.js";
import {html, css} from "../utils/template.js";
import {throttle, sleep} from "../utils/time.js";

const DEBUG = false;
const $menu = Symbol();

/**
 * @element x-menubar
 * @fires expand
 * @fires collapse
 */
export default class XMenuBarElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <svg id="backdrop" hidden>
        <path id="backdrop-path"></path>
      </svg>

      <x-box id="container">
        <div id="main">
          <slot></slot>
        </div>

        <div id="aside">
          <slot name="aside"></slot>
        </div>
      </x-box>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      align-items: center;
      width: 100%;
      height: 36px;
      font-size: 0.875rem;
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

    #container {
      flex: 1;
      width: 100%;
      height: 100%;
    }

    #main {
      display: flex;
      align-items: center;
      width: fit-content;
      height: 100%;
    }

    #aside {
      margin-left: auto;
      display: flex;
      align-items: center;
      height: 100%;
    }

    ::slotted(x-menuitem[ellipsis]) {
      order: 9999;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Whether the widget is disabled.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  /**
   * @property
   * @attribute
   * @type {"small" | "large" | null}
   * @default null
   */
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
  #childListMutationObserver = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XMenuBarElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XMenuBarElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    new ResizeObserver(() => this.#onContainerResize()).observe(this["#container"], {box : "border-box"});
    new ResizeObserver(() => this.#onMainResize()).observe(this["#main"], {box : "border-box"});

    this.#childListMutationObserver = new MutationObserver(() => this.#onChildListchange());
    this.#childListMutationObserver.observe(this, {childList: true});

    this.addEventListener("focusout", (event) => this.#onFocusOut(event));
    this.addEventListener("click", (event) => this.#onClick(event));
    this.#shadowRoot.addEventListener("click", (event) => this.#onShadowRootClick(event));
    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onShadowRootPointerDown(event));
    this.#shadowRoot.addEventListener("pointerover", (event) => this.#onShadowRootPointerOver(event));
    this.#shadowRoot.addEventListener("wheel", (event) => this.#onShadowRootWheel(event));
    this.#shadowRoot.addEventListener("keydown", (event) => this.#onShadowRootKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "menubar");
    this.setAttribute("aria-disabled", this.disabled);

    this.#updateMenubarLayout();

    window.addEventListener("orientationchange", this.#orientationChangeListener = () => {
      this.#onOrientationChange();
    });
  }

  disconnectedCallback() {
    window.removeEventListener("orientationchange", this.#orientationChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateMenubarLayout() {
    // Ensure that ellipsis item exists and it is assigned to the default slot
    {
      let ellipsisItem = this.querySelector(":scope > x-menuitem[ellipsis]");

      if (!ellipsisItem) {
        ellipsisItem = html`
          <x-menuitem ellipsis>
            <x-label><strong>⋯</strong></x-label>
            <x-menu id="ellipsis-menu"></x-menu>
          </x-menuitem>
        `;

        this.append(ellipsisItem);
      }
      else if (ellipsisItem.hasAttribute("slot")) {
        ellipsisItem.removeAttribute("slot");
      }
    }

    let mainItems = [...this.children].filter($0 => $0.localName === "x-menuitem" && $0.slot === "");
    let ellipsisItem = mainItems.find(item => item.hasAttribute("ellipsis"));
    let oldAutohiddenItems = [];

    // Unhide all items
    {
      for (let item of mainItems) {
        if (item.hasAttribute("autohidden")) {
          oldAutohiddenItems.push(item);
          item.removeAttribute("autohidden");
        }
      }
    }

    let menubarBBox = this.getBoundingClientRect();
    let asideBBox = this["#aside"].getBoundingClientRect();
    let overflowingItems = [];

    // Determine overflowing items
    {
      for (let i = 0; i < mainItems.length; i += 1) {
        let item = mainItems[i];
        let itemBBox = item.getBoundingClientRect();

        if (itemBBox.right > menubarBBox.right - asideBBox.width) {
          overflowingItems.push(item);
        }
      }
    }

    // If there are no overflowing items, hide only the ellipsis item
    if (overflowingItems.length <= 1) {
      ellipsisItem.setAttribute("autohidden", "");
    }
    // Otherwise keep hiding non-ellipsis items until the ellipsis item no longer overflows
    else {
      for (let item of [...mainItems].reverse()) {
        if (item !== ellipsisItem) {
          item.setAttribute("autohidden", "");

          let ellipsisItemBBox = ellipsisItem.getBoundingClientRect();

          if (ellipsisItemBBox.right <= menubarBBox.right - asideBBox.width) {
            break;
          }
        }
      }
    }

    // Update ellipsis menu
    {
      let autohiddenItems = [...this.querySelectorAll(":scope > x-menuitem[autohidden]")];

      if (compareArrays(autohiddenItems, oldAutohiddenItems, true) === false) {
        let ellipsisMenu = ellipsisItem.querySelector("x-menu");
        ellipsisMenu.innerHTML = "";

        for (let item of mainItems) {
          if (item !== ellipsisItem) {
            if (!item[$menu]) {
              item[$menu] = item.querySelector(":scope > x-menu");
            }

            if (autohiddenItems.includes(item)) {
              let clonedItem = item.cloneNode(false);

              for (let child of item.children) {
                if (child.localName !== "x-menu") {
                  clonedItem.append(child.cloneNode(true));
                }
              }

              if (item[$menu]) {
                clonedItem.append(item[$menu]);
              }

              ellipsisMenu.append(clonedItem);
            }
            else {
              if (item[$menu] && item[$menu].parentElement !== item) {
                item.append(item[$menu]);
              }
            }
          }
        }
      }
    }
  }

  #updateMenubarLayoutThrottled = throttle(this.#updateMenubarLayout, 100, this);

  #expandMenubarItem(item) {
    let menu = item.querySelector(":scope > x-menu");

    if (menu && menu.opened === false) {
      let wasExpanded = this.#expanded;

      item.focus();
      this.#expanded = true;

      this.style.touchAction = "none";

      if (item.slot !== "aside") {
        this["#aside"].style.pointerEvents = "none";
      }

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

      if (wasExpanded === false) {
        this.dispatchEvent(new CustomEvent("expand"));
      }
    }
  }

  #collapseMenubarItems() {
    return new Promise( async (resolve) => {
      let wasExpanded = this.#expanded;

      this.#expanded = false;

      this.style.touchAction = null;
      this["#aside"].style.pointerEvents = null;

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

      if (wasExpanded === true) {
        this.dispatchEvent(new CustomEvent("collapse"));
      }

      resolve();
    });
  }

  #expandPreviousMenubarItem() {
    let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
    let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

    if (items.length > 1 && focusedItem) {
      let i = items.indexOf(focusedItem);
      let previousItem = items[i - 1] || items.at(-1);
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

  #onContainerResize() {
    if (this.isConnected) {
      this.#updateMenubarLayoutThrottled();
    }
  }

  #onMainResize() {
    if (this.isConnected) {
      this.#updateMenubarLayoutThrottled();
    }
  }

  #onChildListchange() {
    if (this.isConnected) {
      this.#updateMenubarLayoutThrottled();
    }
  }

  #onShadowRootWheel(event) {
    let openedMenu = this.querySelector("x-menu[opened]");

    if (openedMenu && openedMenu.contains(event.target) === false) {
      event.preventDefault();
    }
  }

  async #onClick(event) {
    let item = event.target.closest("x-menuitem");

    // Click triggered by calling element.click()
    if (item && event.isTrusted === false) {
      if (event.isTrusted === false) {
        if (!item.closest("[expanded]")) {
          let outermostItem = null;

          for (let element = item; element !== this; element = element.parentElement) {
            if (element.localName === "x-menuitem") {
              outermostItem = element;
            }
          }

          // Blink menubar item
          {
            outermostItem.setAttribute("highlighted", "");
            await sleep(150);
            outermostItem.removeAttribute("highlighted");
          }
        }
      }
    }
  }

  async #onShadowRootClick(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");
    let ownerMenu = event.target.closest("x-menu");

    if (item && item.disabled === false && ownerMenu) {
      let submenu = item.querySelector(":scope > x-menu");

      if (item.parentElement !== this) {
        if (submenu) {
          if (submenu.opened && submenu.opened === false) {
            submenu.openNextToElement(item, "horizontal");
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

  #onShadowRootPointerDown(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");

    if (item && item.disabled === false && item.parentElement === this) {
      let submenu = item.querySelector(":scope > x-menu");

      if (submenu) {
        submenu.opened ? this.#collapseMenubarItems() : this.#expandMenubarItem(item);
      }
      else {
        event.preventDefault();
      }
    }
  }

  #onShadowRootPointerOver(event) {
    if (this.hasAttribute("closing")) {
      return;
    }

    let item = event.target.closest("x-menuitem");
    let ownerMenu = event.target.closest("x-menu");

    if (item && item.disabled === false && item.parentElement === this && !ownerMenu) {
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

        let submenu = refItem.querySelector(":scope > x-menu");

        if (submenu) {
          submenu.tabIndex = -1;

          submenu.close().then(() => {
            submenu.tabIndex = -1;
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
