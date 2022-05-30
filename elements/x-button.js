
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement, closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

// @element x-button
// @event toggle - User toggled the button on or off by clicking it.
// @part arrow - The arrow icon shown when the button contains <code>x-popover</code> or <code>x-menu</code>.
export default class XButtonElement extends HTMLElement {
  static observedAttributes = ["disabled", "size", "skin"];

  static #shadowTemplate = html`
    <template>
      <div id="ripples"></div>
      <slot></slot>

      <svg id="arrow" part="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="arrow-path"></path>
      </svg>
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
      --trigger-effect: none; /* ripple, unbounded-ripple, none */
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

    /**
     * Arrow
     */

    #arrow {
      color: currentColor;
      width: 8px;
      height: 8px;
      min-width: 8px;
      margin: 0 0 0 4px;
      d: path("M 11.7 19.9 L 49.8 57.9 L 87.9 19.9 L 99.7 31.6 L 49.8 81.4 L -0.0 31.6 Z");
    }

    #arrow path {
      fill: currentColor;
      d: inherit;
    }
    #arrow[hidden] {
      display: none;
    }

    /**
     * Ripples
     */

    #ripples {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      border-radius: inherit;
    }

    #ripples .ripple {
      position: absolute;
      top: 0;
      left: 0;
      width: 200px;
      height: 200px;
      background: currentColor;
      opacity: 0.2;
      border-radius: 999px;
      transform: none;
      transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: opacity, transform;
      pointer-events: none;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string?
  // @default null
  //
  // A unique value associated with this button.
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
  //
  // Whether this button is toggled.
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
  //
  // Whether this button can be toggled on/off by the user (e.g. by clicking the button).
  get togglable() {
    return this.hasAttribute("togglable");
  }
  set togglable(togglable) {
    togglable ? this.setAttribute("togglable", "") : this.removeAttribute("togglable");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the this button has "mixed" state.
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
  //
  // Whether this button is disabled.
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the button should take less horizontal space.
  get condensed() {
    return this.hasAttribute("condensed");
  }
  set condensed(condensed) {
    condensed ? this.setAttribute("condensed", "") : this.removeAttribute("condensed");
  }

  // @property
  // @attribute
  // @type "flat" || "recessed" || "nav" || "dock" || "circular" || null
  // @default null
  get skin() {
    return this.hasAttribute("skin") ? this.getAttribute("skin") : null;
  }
  set skin(skin) {
    skin === null ? this.removeAttribute("skin") : this.setAttribute("skin", skin);
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

  // @property readOnly
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  //
  // Whether the menu or popover associated with this button is opened.
  get expanded() {
    return this.hasAttribute("expanded");
  }

  // @property readOnly
  // @type boolean
  // @default false
  // @readOnly
  //
  // Whether clicking this button will cause a menu or popover to show up.
  get expandable() {
    return this.#canOpenMenu() || this.#canOpenPopover();
  }

  // @property readOnly
  // @type XButtonsElement?
  // @default null
  // @readOnly
  //
  // Direct ancestor <code>x-buttons</code> element.
  get ownerButtons() {
    if (this.parentElement) {
      if (this.parentElement.localName === "x-buttons") {
        return this.parentElement;
      }
      else if (this.parentElement.localName === "x-box" && this.parentElement.parentElement) {
        if (this.parentElement.parentElement.localName === "x-buttons") {
          return this.parentElement.parentElement;
        }
      }
    }

    return null;
  }

  #shadowRoot = null;
  #elements = {};
  #wasFocusedBeforeExpanding = false;
  #lastPointerDownEvent = null;
  #lastTabIndex = 0;
  #xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XButtonElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XButtonElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("pointerenter", () => this.#onPointerEnter());
    this.addEventListener("pointerleave", () => this.#onPointerLeave());
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));

    (async () => {
      await customElements.whenDefined("x-backdrop");
      this.#elements["backdrop"] = createElement("x-backdrop");
      this.#elements["backdrop"].style.background =  "rgba(0, 0, 0, 0)";
    })();
  }

  connectedCallback() {
    // Make the parent anchor element non-focusable (button should be focused instead)
    if (this.parentElement && this.parentElement.localName === "a" && this.parentElement.tabIndex !== -1) {
      this.parentElement.tabIndex = -1;
    }

    this.#updateArrowVisibility();
    this.#updateAccessabilityAttributes();
    this.#updateSkinAttribute();
    this.#updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => this.#updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
    else if (name === "skin") {
      this.#updateSkinAttribute();
    }
    else if (name === "size") {
      this.#updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type () => Promise
  //
  // Open the child menu or overlay.
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

  // @method
  // @type (Promise?) => Promise
  //
  // Close the child menu or overlay.
  collapse(delay = null) {
    return new Promise(async (resolve) => {
      let popup = null;

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

        this.#elements["backdrop"].ownerElement = menu;
        this.#elements["backdrop"].show(false);

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
        await menu.close();

        this.#elements["backdrop"].hide(false);
        this.removeAttribute("expanded");

        // @bugfix: Button gets stuck with :hover state after user clicks the backdrop.
        this.replaceWith(this);

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

      if (menu && menu.opened) {
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

        // @bugfix: Button gets stuck with :hover state after user clicks the backdrop of a modal popover.
        if (popover.modal) {
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

      if (popover && popover.opened) {
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

  #updateArrowVisibility() {
    let popup = this.querySelector(":scope > x-menu, :scope > x-popover");
    this.#elements["arrow"].style.display = (popup ? null : "none");
  }

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
      this.setAttribute("skin", "default");
    }
  }

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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onPointerDown(event) {
    let openedMenu = this.querySelector(":scope > x-menu[opened]");
    let openedPopover = this.querySelector(":scope > x-popover[opened]");
    let openedDialog = this.querySelector(":scope > dialog[open]");
    let openedNotification = this.querySelector(":scope > x-notification[opened]");

    this.#lastPointerDownEvent = event;

    if (event.target === this.#elements["backdrop"]) {
      this.#onBackdropPointerDown(event);
    }
    else if (openedMenu && openedMenu.contains(event.target)) {
      return;
    }
    else if (openedPopover && openedPopover.contains(event.target)) {
      return;
    }
    else if (openedDialog && openedDialog.contains(event.target)) {
      return;
    }
    else if (openedNotification && openedNotification.contains(event.target)) {
      return;
    }
    else {
      this.#onButtonPointerDown(event);
    }
  }

  #onPointerEnter() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip && tooltip.disabled === false) {
      if (this.parentElement.localName === "x-buttons") {
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
  }

  #onClick(event) {
    let openedMenu = this.querySelector(":scope > x-menu[opened]");
    let openedPopover = this.querySelector(":scope > x-popover[opened]");
    let openedDialog = this.querySelector(":scope > dialog[open]");
    let openedNotification = this.querySelector(":scope > x-notification[opened]");

    if (event.target === this.#elements["backdrop"]) {
      return;
    }
    else if (openedMenu && openedMenu.contains(event.target)) {
      if (openedMenu.hasAttribute("closing") === false && event.target.closest("x-menuitem")) {
        this.#onMenuItemClick(event);
      }
    }
    else if (openedPopover && openedPopover.contains(event.target)) {
      return;
    }
    else if (openedDialog && openedDialog.contains(event.target)) {
      return;
    }
    else if (openedNotification && openedNotification.contains(event.target)) {
      return;
    }
    else {
      this.#onButtonClick(event);
    }
  }

  #onBackdropPointerDown(pointerDownEvent) {
    this.collapse();
  }

  async #onButtonPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      pointerDownEvent.preventDefault();
      return;
    }

    if (this.querySelector(":scope > dialog[open]")) {
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

        this.addEventListener("pointerup", () => {
          if (ancestorFocusableElement) {
            ancestorFocusableElement.focus();
          }
          else {
            this.blur();
          }
        }, {once: true});
      }
    }

    // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
    // to last at least 150ms.
    if (this.#canOpenMenu() === false && this.#canOpenPopover() === false && this.#canClosePopover() === false) {
      let pointerDownTimeStamp = Date.now();
      let isDown = true;
      let minPressedTime = parseInt(getComputedStyle(this).getPropertyValue("--min-pressed-time") || "150ms");

      this.addEventListener("pointerup", async () => {
        isDown = false;
        let pressedTime = Date.now() - pointerDownTimeStamp;

        if (pressedTime < minPressedTime) {
          await sleep(minPressedTime - pressedTime);
        }

        this.removeAttribute("pressed");
      }, {once: true});

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

    // Ripple
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this.#elements["ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;
        let whenPointerUp = new Promise((r) => this.addEventListener("pointerup", r, {once: true}));
        let delay = true;

        if (this.expandable === false) {
          if (this.ownerButtons) {
            if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2) {
              delay = false;
            }
            else if (this.ownerButtons.tracking === 1 && this.toggled === false) {
              delay = false;
            }
            else if (this.ownerButtons.tracking === 3) {
              let buttons = [...this.ownerButtons.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
              let toggledButtons = buttons.filter(button => button.toggled);

              if (this.toggled === false || toggledButtons.length > 1 ) {
                delay = false;
              }
            }

          }
          else if (this.togglable) {
            delay = false;
          }
        }

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this.#elements["ripples"].append(ripple);
        this.#elements["ripples"].style.contain = "strict";

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await whenPointerUp;

        if (delay) {
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity || "0", "0"]},
            { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );

          await outAnimation.finished;
        }

        ripple.remove();
      }

      else if (triggerEffect === "unbounded-ripple") {
        let bounds = this.#elements["ripples"].getBoundingClientRect();
        let size = bounds.height * 1.25;
        let top  = (bounds.y + bounds.height/2) - bounds.y - size/2;
        let left = (bounds.x + bounds.width/2)  - bounds.x - size/2;
        let whenPointerUp = new Promise((r) => this.addEventListener("pointerup", r, {once: true}));

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this.#elements["ripples"].append(ripple);
        this.#elements["ripples"].style.contain = "none";

        // Workaround for buttons that change their color when toggled on/off.
        ripple.hidden = true;
        await sleep(20);
        ripple.hidden = false;

        let inAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(1)"] },
          { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await whenPointerUp;
        await inAnimation.finished;

        let outAnimation = ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
          { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await outAnimation.finished;
        ripple.remove();
      }
    }
  }

  async #onButtonClick(event) {
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

    // Ripple
    if (this.#elements["ripples"].querySelector(".pointer-down-ripple") === null) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this.#elements["ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = (rect.y + rect.height/2) - rect.y - size/2;
        let left = (rect.x + rect.width/2) - rect.x - size/2;
        let delay = true;

        if (this.ownerButtons) {
          if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2 || this.ownerButtons.tracking === 3) {
            delay = false;
          }
          else if (this.ownerButtons.tracking === 1 && this.toggled === true) {
            delay = false;
          }
        }
        else if (this.togglable) {
          delay = false;
        }

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
        ripple.setAttribute("class", "ripple click-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this.#elements["ripples"].append(ripple);
        this.#elements["ripples"].style.contain = "strict";

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        if (delay) {
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
            { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );

          await outAnimation.finished;
        }

        ripple.remove();
      }

      else if (triggerEffect === "unbounded-ripple") {
        let rect = this.#elements["ripples"].getBoundingClientRect();
        let size = rect.height * 1.35;
        let top  = (rect.y + rect.height/2) - rect.y - size/2;
        let left = (rect.x + rect.width/2) - rect.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
        ripple.setAttribute("class", "ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this.#elements["ripples"].append(ripple);
        this.#elements["ripples"].style.contain = "none";

        await ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"] },
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        ).finished;

        await ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        ).finished;

        ripple.remove();
      }
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
      if (event.code === "Enter" || event.code === "Space") {
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
          let menu = this.querySelector(":scope > x-menu");
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
