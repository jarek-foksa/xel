
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import {createElement, closest, isPointerInsideElement} from "../utils/element.js";
import {getBrowserEngine} from "../utils/system.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

/**
 * @element x-button
 * @fires toggle - User toggled the button on or off by clicking it.
 */
export default class XButtonElement extends HTMLElement {
  static observedAttributes = ["disabled", "skin"];

  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      height: fit-content;
      min-height: 32px;
      padding: 2px 14px;
      box-sizing: border-box;
      opacity: 1;
      position: relative;
    }
    :host(:focus) {
      outline: none;
    }
    :host(:focus:not(:active)) {
      z-index: 1;
    }
    :host([mixed]) {
      opacity: 0.75;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * A unique value associated with this widget.
   *
   * @property
   * @attribute
   * @type {string | null}
   * @default null
   */
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  /**
   * Whether the widget is toggled.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
  }

  /**
   * Whether the widget can be toggled on/off by the user.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get togglable() {
    return this.hasAttribute("togglable");
  }
  set togglable(togglable) {
    togglable ? this.setAttribute("togglable", "") : this.removeAttribute("togglable");
  }

  /**
   * Whether the widget in in "mixed" state.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
  }

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
   * Whether the widget should take less horizontal space.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get condensed() {
    return this.hasAttribute("condensed");
  }
  set condensed(condensed) {
    condensed ? this.setAttribute("condensed", "") : this.removeAttribute("condensed");
  }

  /**
   * @property
   * @attribute
   * @type {"normal" | "flat" | "recessed" | "dock"}
   * @default "normal"
   */
  get skin() {
    return this.hasAttribute("skin") ? this.getAttribute("skin") : "normal";
  }
  set skin(skin) {
    this.setAttribute("skin", skin);
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

  /**
   * Whether the menu or popover associated with this button is opened.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get expanded() {
    return this.hasAttribute("expanded");
  }

  /**
   * Whether clicking this button will cause a menu or popover to show up.
   *
   * @property
   * @type {boolean}
   * @default false
   * @readonly
   */
  get expandable() {
    return this.#canOpenMenu() || this.#canOpenPopover();
  }

  /**
   * Direct ancestor <code>x-buttons</code> element.
   *
   * @property
   * @type {XButtonsElement | null}
   * @default null
   * @readonly
   */
  get ownerButtons() {
    if (this.parentElement) {
      if (this.parentElement?.localName === "x-buttons") {
        return this.parentElement;
      }
      else if (["a", "x-box"].includes(this.parentElement.localName) && this.parentElement.parentElement) {
        if (this.parentElement.parentElement.localName === "x-buttons") {
          return this.parentElement.parentElement;
        }
      }
    }

    return null;
  }

  #shadowRoot = null;
  #wasFocusedBeforeExpanding = false;
  #dismissTooltip = false;
  #lastPointerDownEvent = null;
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XButtonElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XButtonElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("pointerenter", () => this.#onPointerEnter());
    this.addEventListener("pointerleave", () => this.#onPointerLeave());
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.addEventListener("close", (event) => this.#onClose(event));

    (async () => {
      await customElements.whenDefined("x-backdrop");
      this["#backdrop"] = createElement("x-backdrop");
      this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
    })();
  }

  connectedCallback() {
    // Make the parent anchor element non-focusable (button should be focused instead)
    if (this.parentElement && this.parentElement.localName === "a" && this.parentElement.tabIndex !== -1) {
      this.parentElement.tabIndex = -1;
    }

    this.#updateAccessabilityAttributes();
    this.#updateSkinAttribute();
  }

  disconnectedCallback() {
    this.#dismissTooltip = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this.isConnected === false) {
      return;
    }
    else if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
    else if (name === "skin") {
      this.#updateSkinAttribute();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Open the child menu or overlay.
   *
   * @method
   * @type {() => Promise<void>}
   */
  expand() {
    return new Promise( async (resolve) => {
      if (this.#canOpenMenu()) {
        await this.#openMenu();
      }

      else if (this.#canOpenPopover()) {
        await this.#openPopover();
      }

      resolve();
    });
  }

  /**
   * Close the child menu or overlay.
   *
   * @method
   * @type {(delay?: number | null) => Promise<void>}
   */
  collapse(delay = null) {
    return new Promise(async (resolve) => {
      if (this.#canCloseMenu()) {
        await this.#closeMenu(delay);
      }
      else if (this.#canClosePopover()) {
        await this.#closePopover(delay);
      }

      resolve();
    });
  }

  #openMenu() {
    return new Promise( async (resolve) => {
      if (this.#canOpenMenu()) {
        let menu = this.querySelector(":scope > x-menu");
        let tooltip = this.querySelector(":scope > x-tooltip");

        if (tooltip) {
          tooltip.close(false);
        }

        this.#wasFocusedBeforeExpanding = this.matches(":focus");
        this.setAttribute("expanded", "");

        this["#backdrop"].ownerElement = menu;
        this["#backdrop"].show(false);

        await menu.openNextToElement(this, "vertical", 3);
        menu.focus();
      }

      resolve();
    });
  }

  #closeMenu(delay = null) {
    return new Promise( async (resolve) => {
      if (this.#canCloseMenu()) {
        let menu = this.querySelector(":scope > x-menu");
        menu.setAttribute("closing", "");

        await delay;
        menu.close();

        this["#backdrop"].hide(false);
        this.removeAttribute("expanded");

        // @bugfix: Button gets stuck with :hover state after user clicks the backdrop.
        if (getBrowserEngine() === "chromium") {
          this.replaceWith(this);
        }

        if (this.#wasFocusedBeforeExpanding) {
          this.focus();
        }
        else {
          let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

          if (ancestorFocusableElement) {
            ancestorFocusableElement.focus();
          }
        }

        menu.removeAttribute("closing");
      }

      resolve();
    });
  }

  #canOpenMenu() {
    let result = false;

    if (this.disabled === false) {
      let menu = this.querySelector(":scope > x-menu");

      if (menu && menu.hasAttribute("opened") === false && menu.hasAttribute("closing") === false) {
        let item = menu.querySelector("x-menuitem");

        if (item !== null) {
          result = true;
        }
      }
    }

    return result;
  }

  #canCloseMenu() {
    let result = false;

    if (this.disabled === false) {
      let menu = this.querySelector(":scope > x-menu");

      if (menu?.opened) {
        result = true;
      }
    }

    return result;
  }

  #openPopover() {
    return new Promise( async (resolve) => {
      if (this.#canOpenPopover()) {
        let popover = this.querySelector(":scope > x-popover");
        let tooltip = this.querySelector(":scope > x-tooltip");

        if (tooltip) {
          tooltip.close(false);
        }

        this.#wasFocusedBeforeExpanding = this.matches(":focus");
        this.setAttribute("expanded", "");

        await popover.open(this);
      }

      resolve();
    });
  }

  #closePopover(delay = null) {
    return new Promise( async (resolve) => {
      if (this.#canClosePopover()) {
        let popover = this.querySelector(":scope > x-popover");
        popover.setAttribute("closing", "");

        await delay;
        await popover.close();

        this.removeAttribute("expanded");

        // @bugfix: Button gets stuck with :hover state after user clicks the backdrop.
        if (popover.modal && getBrowserEngine() === "chromium") {
          this.replaceWith(this);
        }

        if (this.#wasFocusedBeforeExpanding) {
          this.focus();
        }
        else {
          let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

          if (ancestorFocusableElement) {
            ancestorFocusableElement.focus();
          }
        }

        popover.removeAttribute("closing");
      }

      resolve();
    });
  }

  #canOpenPopover() {
    let result = false;

    if (this.disabled === false) {
      let popover = this.querySelector(":scope > x-popover");

      if (popover && popover.hasAttribute("opened") === false ) {
        result = true;
      }
    }

    return result;
  }

  #canClosePopover() {
    let result = false;

    if (this.disabled === false) {
      let popover = this.querySelector(":scope > x-popover");

      if (popover?.opened) {
        result = true;
      }
    }

    return result;
  }

  #openDialog() {
    return new Promise((resolve) => {
      if (this.#canOpenDialog()) {
        let dialog = this.querySelector(":scope > dialog");
        dialog.showModal();
      }

      resolve();
    });
  }

  #canOpenDialog() {
    let result = false;

    if (this.disabled === false) {
      let dialog = this.querySelector(":scope > dialog");

      if (dialog && dialog.hasAttribute("open") === false && dialog.hasAttribute("closing") === false) {
        result = true;
      }
    }

    return result;
  }

  #openDrawer() {
    return new Promise((resolve) => {
      if (this.#canOpenDrawer()) {
        let drawer = this.querySelector(":scope > x-drawer");
        drawer.open();
      }

      resolve();
    });
  }

  #canOpenDrawer() {
    let result = false;

    if (this.disabled === false) {
      let drawer = this.querySelector(":scope > x-drawer");

      if (drawer && drawer.matches(":popover-open") === false && drawer.hasAttribute("closing") === false) {
        result = true;
      }
    }

    return result;
  }

  #openNotification() {
    return new Promise((resolve) => {
      if (this.#canOpenNotification()) {
        let notification = this.querySelector(":scope > x-notification");
        notification.opened = true;
      }

      resolve();
    });
  }

  #canOpenNotification() {
    let result = false;

    if (this.disabled === false) {
      let notification = this.querySelector(":scope > x-notification");

      if (notification && !notification.hasAttribute("opened") && !notification.hasAttribute("closing")) {
        result = true;
      }
    }

    return result;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "button");
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

  #updateSkinAttribute() {
    if (this.hasAttribute("skin") === false) {
      this.setAttribute("skin", "normal");
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onPointerDown(event) {
    let openedMenu = this.querySelector(":scope > x-menu[opened]");
    let openedPopover = this.querySelector(":scope > x-popover[opened]");
    let openedDialog = this.querySelector(":scope > dialog[open]");
    let openedDrawer = this.querySelector(":scope > x-drawer[open]");
    let openedNotification = this.querySelector(":scope > x-notification[opened]");

    this.#lastPointerDownEvent = event;

    if (event.target === this["#backdrop"]) {
      this.#onBackdropPointerDown(event);
    }
    else if (openedMenu?.contains(event.target)) {
      return;
    }
    else if (openedPopover?.contains(event.target)) {
      return;
    }
    else if (openedDialog?.contains(event.target)) {
      return;
    }
    else if (openedDrawer?.contains(event.target)) {
      return;
    }
    else if (openedNotification?.contains(event.target)) {
      return;
    }
    else {
      this.#onButtonPointerDown(event);
    }
  }

  #onClose(event) {
    if (
      event.target.parentElement === this &&
      ["x-menu", "x-popover"].includes(event.target.localName) &&
      this.#lastPointerDownEvent &&
      isPointerInsideElement(this.#lastPointerDownEvent, this) === false
    ) {
      this.#dismissTooltip = false;
    }
  }

  #onPointerEnter() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip && tooltip.disabled === false && this.expanded === false && this.#dismissTooltip === false) {
      if (this.parentElement && this.parentElement.localName === "x-buttons") {
        for (let sibling of this.parentElement.children) {
          if (sibling !== this && sibling.localName === "x-button") {
            let siblingTooltip = sibling.querySelector(":scope > x-tooltip");

            if (siblingTooltip) {
              siblingTooltip.close(false);
            }
          }
        }
      }

      tooltip.open(this);
    }
  }

  #onPointerLeave() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip) {
      tooltip.close();
    }

    this.#dismissTooltip = false;
  }

  #onClick(event) {
    let openedMenu = this.querySelector(":scope > x-menu[opened]");
    let openedPopover = this.querySelector(":scope > x-popover[opened]");
    let openedDialog = this.querySelector(":scope > dialog[open]");
    let openedDrawer = this.querySelector(":scope > x-drawer[open]");
    let openedNotification = this.querySelector(":scope > x-notification[opened]");

    if (event.target === this["#backdrop"]) {
      return;
    }
    else if (openedMenu?.contains(event.target)) {
      if (openedMenu.hasAttribute("closing") === false && event.target.closest("x-menuitem")) {
        this.#onMenuItemClick(event);
      }
    }
    else if (openedPopover?.contains(event.target)) {
      return;
    }
    else if (openedDialog?.contains(event.target)) {
      return;
    }
    else if (openedDrawer?.contains(event.target)) {
      return;
    }
    else if (openedNotification?.contains(event.target)) {
      return;
    }
    else {
      this.#dismissTooltip = true;
      this.#onButtonClick(event);
    }
  }

  #onBackdropPointerDown() {
    this.collapse();
  }

  #onButtonPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      pointerDownEvent.preventDefault();
      return;
    }

    if (this.querySelector(":scope > dialog[open], :scope > x-drawer[open]")) {
      pointerDownEvent.preventDefault();
      return;
    }

    // This check is needed in case a slotted element was hit
    if (this.contains(pointerDownEvent.target) === false) {
      return;
    }

    this.setPointerCapture(pointerDownEvent.pointerId);

    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element as soon as
    // the button is released.
    {
      pointerDownEvent.preventDefault();

      if (this.matches(":focus") === false) {
        let ancestorFocusableElement = closest(this.parentNode, "*[tabindex]:not(a)");
        let pointerUpOrCancelListener;

        this.addEventListener("pointerup", pointerUpOrCancelListener = () => {
          this.removeEventListener("pointerup", pointerUpOrCancelListener);
          this.removeEventListener("pointercancel", pointerUpOrCancelListener);

          if (ancestorFocusableElement) {
            ancestorFocusableElement.focus();
          }
          else {
            this.focus(); // Need when e.g. a color input widget was focused
            this.blur();
          }
        });

        this.addEventListener("pointercancel", pointerUpOrCancelListener);
      }
    }

    // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
    // to last at least 150ms.
    if (this.#canOpenMenu() === false && this.#canOpenPopover() === false && this.#canClosePopover() === false) {
      let pointerDownTimeStamp = Date.now();
      let isDown = true;
      let minPressedTime = Number.parseInt(getComputedStyle(this).getPropertyValue("--min-pressed-time") || "150ms");
      let pointerUpOrCancelListener;

      this.addEventListener("pointerup", pointerUpOrCancelListener = async () => {
        this.removeEventListener("pointerup", pointerUpOrCancelListener);
        this.removeEventListener("pointercancel", pointerUpOrCancelListener);

        isDown = false;
        let pressedTime = Date.now() - pointerDownTimeStamp;

        if (pressedTime < minPressedTime) {
          await sleep(minPressedTime - pressedTime);
        }

        this.removeAttribute("pressed");
      });

      this.addEventListener("pointercancel", pointerUpOrCancelListener);

      (async () => {
        if (this.ownerButtons) {
          if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2) {
            await sleep(10);
          }
          else if (this.ownerButtons.tracking === 1 && (this.toggled === false || this.mixed)) {
            await sleep(10);
          }
          else if (this.ownerButtons.tracking === 3) {
            let buttons = [...this.ownerButtons.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
            let toggledButtons = buttons.filter(button => button.toggled);

            if (this.toggled === false || toggledButtons.length > 1 ) {
              await sleep(10);
            }
          }
        }
        else if (this.togglable) {
          await sleep(10);
        }

        if (isDown) {
          this.setAttribute("pressed", "");
        }
      })();
    }

    if (this.#canOpenMenu()) {
      if (pointerDownEvent.pointerType !== "touch") {
        this.#openMenu();
      }
    }
    else if (this.#canOpenPopover()) {
      if (pointerDownEvent.pointerType !== "touch") {
        this.#openPopover();
      }
    }
    else if (this.#canClosePopover()) {
      this.#closePopover();
    }
  }

  #onButtonClick(event) {
    let popup = this.querySelector(":scope > x-menu, :scope > x-popover");

    if (popup) {
      if (popup.hasAttribute("closing")) {
        return;
      }
      else {
        popup.focus();
      }
    }

    if (this.#canClosePopover() === false) {
      if (this.#canOpenDialog()) {
        this.#openDialog();
      }
      else if (this.#canOpenDrawer()) {
        this.#openDrawer();
      }
      else if (this.#canOpenNotification()) {
        this.#openNotification();
      }
    }

    if (this.#lastPointerDownEvent && this.#lastPointerDownEvent.pointerType === "touch") {
      if (this.#canOpenMenu()) {
        this.#openMenu();
      }
      else if (this.#canOpenPopover()) {
        this.#openPopover();
      }
    }

    // Toggle the button
    if (this.togglable && event.defaultPrevented === false) {
      this.removeAttribute("pressed");
      this.toggled = !this.toggled;
      this.dispatchEvent(new CustomEvent("toggle"));
    }
  }

  #onMenuItemClick(event) {
    let item = event.target.closest("x-menuitem");
    let menu = this.querySelector(":scope > x-menu");

    if (!menu.hasAttribute("closing")) {
      this.collapse(item.whenTriggerEnd);
    }
  }

  #onKeyDown(event) {
    if (event.defaultPrevented === false) {
      if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
        if (this.#canOpenMenu()) {
          event.preventDefault();
          this.#openMenu().then(() => this.querySelector(":scope > x-menu").focusFirstMenuItem());
        }
        else if (this.#canOpenPopover()) {
          event.preventDefault();
          this.#openPopover();
        }
        else if (this.#canOpenDialog()) {
          event.preventDefault();
          this.#openDialog();
        }
        else if (this.#canOpenDrawer()) {
          event.preventDefault();
          this.#openDrawer();
        }
        else if (this.#canOpenNotification()) {
          event.preventDefault();
          this.#openNotification();
        }
        else {
          if (this.matches(":focus")) {
            if (this.#canClosePopover()) {
              this.#closePopover();
            }
            else if (this.#canCloseMenu()) {
              this.#closeMenu();
            }
            else {
              event.preventDefault();
              this.click();
            }
          }
        }
      }

      else if (event.code === "ArrowDown") {
        if (this.#canOpenMenu()) {
          event.preventDefault();
          this.#openMenu().then(() => this.querySelector(":scope > x-menu").focusFirstMenuItem());
        }
        else if (this.#canOpenPopover()) {
          event.preventDefault();
          this.#openPopover();
        }
        else {
          event.preventDefault();
          this.click();
        }
      }

      else if (event.code === "ArrowUp") {
        if (this.#canOpenMenu()) {
          event.preventDefault();
          this.#openMenu().then(() => this.querySelector(":scope > x-menu").focusLastMenuItem());
        }
        else if (this.#canOpenPopover()) {
          event.preventDefault();
          this.#openPopover();
        }
        else {
          event.preventDefault();
          this.click();
        }
      }

      else if (event.code === "Escape") {
        if (this.#canCloseMenu()) {
          event.preventDefault();
          this.collapse();
        }
        else if (this.#canClosePopover()) {
          event.preventDefault();
          this.collapse();
        }
      }
    }
  }
}

customElements.define("x-button", XButtonElement);
