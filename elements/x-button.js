
// @doc
//   http://w3c.github.io/aria-practices/#button
// @copyright
//   © 2016-2017 Jarosław Foksa

import {createElement, html, closest} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let {max} = Math;
let easing = "cubic-bezier(0.4, 0, 0.2, 1)";
let $oldTabIndex = Symbol();

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        height: fit-content;
        box-sizing: border-box;
        opacity: 1;
        position: relative;
        --trigger-effect: none; /* ripple, unbounded-ripple, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --arrow-width: 8px;
        --arrow-height: 8px;
        --arrow-margin: 0 0 0 3px;
        --arrow-d: path("M 11.7 19.9 L 49.8 57.9 L 87.9 19.9 L 99.7 31.6 L 49.8 81.4 L -0.0 31.6 Z");
      }
      :host(:focus) {
        outline: none;
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
        width: var(--arrow-width);
        height: var(--arrow-height);
        min-width: var(--arrow-width);
        margin: var(--arrow-margin);
        color: currentColor;
        d: var(--arrow-d);
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
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        transform: none;
        transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
        pointer-events: none;
      }
    </style>

    <div id="ripples"></div>
    <slot></slot>

    <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="arrow-path"></path>
    </svg>
  </template>
`;

// @events
//   toggle
export class XButtonElement extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  // @info
  //   Values associated with this button.
  // @type
  //   string
  // @default
  //   null
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @info
  //   Whether this button is toggled.
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
  }

  // @info
  //   Whether this button can be toggled on/off by the user (e.g. by clicking the button).
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get togglable() {
    return this.hasAttribute("togglable");
  }
  set togglable(togglable) {
    togglable ? this.setAttribute("togglable", "") : this.removeAttribute("togglable");
  }

  // @info
  //   CSS skin to be used by this button.
  // @type
  //   string
  // @default
  //   ""
  // @attribute
  get skin() {
    return this.getAttribute("skin");
  }
  set skin(skin) {
    skin === null ? this.removeAttribute("skin") : this.setAttribute("skin", skin);
  }

  // @info
  //   Whether the this button has "mixed" state.
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
  }

  // @info
  //   Whether this button is disabled.
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

  // @info
  //   Whether the menu or popover associated with this button is opened.
  // @type
  //   boolean
  // @attribute
  //   read-only
  get expanded() {
    return this.hasAttribute("expanded");
  }

  // @info
  //   Whether clicking this button will cause a menu or popover to show up.
  // @type
  //   boolean
  get expandable() {
    return this._canOpenMenu() || this._canOpenPopover();
  }

  // @info
  //   Direct ancestor <x-buttons> element.
  // @type
  //   XButtonsElement?
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));

    (async () => {
      await customElements.whenDefined("x-backdrop");
      this["#backdrop"] = createElement("x-backdrop");
      this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
    })();

  }

  async connectedCallback() {
    // Make the parent anchor element non-focusable (button should be focused instead)
    if (this.parentElement && this.parentElement.localName === "a" && this.parentElement.tabIndex !== -1) {
      this.parentElement.tabIndex = -1;
    }

    this._updateAccessabilityAttributes();
    this._updateArrowVisibility();
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Open the child menu or overlay.
  expand() {
    return new Promise( async (resolve) => {
      if (this._canOpenMenu()) {
        await this._openMenu();
      }

      else if (this._canOpenPopover()) {
        await this._openPopover();
      }

      resolve();
    });
  }

  // @info
  //   Close the child menu or overlay.
  collapse(delay = null) {
    return new Promise(async (resolve) => {
      let popup = null;

      if (this._canCloseMenu()) {
        await this._closeMenu(delay);
      }
      else if (this._canClosePopover()) {
        await this._closePopover(delay);
      }

      resolve();
    });
  }

  _openMenu() {
    return new Promise( async (resolve) => {
      if (this._canOpenMenu()) {
        let menu = this.querySelector(":scope > x-menu");

        this._wasFocusedBeforeExpanding = this.matches(":focus");
        this.setAttribute("expanded", "");

        this["#backdrop"].ownerElement = menu;
        this["#backdrop"].show(false);

        await menu.openNextToElement(this, "vertical", 3);
        menu.focus();
      }

      resolve();
    });
  }

  _closeMenu(delay = null) {
    return new Promise( async (resolve) => {
      if (this._canCloseMenu()) {
        let menu = this.querySelector(":scope > x-menu");
        menu.setAttribute("closing", "");

        await delay;
        await menu.close();

        this["#backdrop"].hide(false);
        this.removeAttribute("expanded");

        if (this._wasFocusedBeforeExpanding) {
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

  _canOpenMenu() {
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

  _canCloseMenu() {
    let result = false;

    if (this.disabled === false) {
      let menu = this.querySelector(":scope > x-menu");

      if (menu && menu.opened) {
        result = true;
      }
    }

    return result;
  }

  _openPopover() {
    return new Promise( async (resolve) => {
      if (this._canOpenPopover()) {
        let popover = this.querySelector(":scope > x-popover");

        this._wasFocusedBeforeExpanding = this.matches(":focus");
        this.setAttribute("expanded", "");

        await popover.open(this);
      }

      resolve();
    });
  }

  _closePopover(delay = null) {
    return new Promise( async (resolve) => {
      if (this._canClosePopover()) {
        let popover = this.querySelector(":scope > x-popover");
        popover.setAttribute("closing", "");

        await delay;
        await popover.close();

        this.removeAttribute("expanded");

        if (this._wasFocusedBeforeExpanding) {
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

  _canOpenPopover() {
    let result = false;

    if (this.disabled === false) {
      let popover = this.querySelector(":scope > x-popover");

      if (popover && popover.hasAttribute("opened") === false ) {
        result = true;
      }
    }

    return result;
  }

  _canClosePopover() {
    let result = false;

    if (this.disabled === false) {
      let popover = this.querySelector(":scope > x-popover");

      if (popover && popover.opened) {
        result = true;
      }
    }

    return result;
  }

  _openDialog() {
    return new Promise((resolve) => {
      if (this._canOpenDialog()) {
        let dialog = this.querySelector(":scope > dialog");
        dialog.showModal();
      }

      resolve();
    });
  }

  _canOpenDialog() {
    let result = false;

    if (this.disabled === false) {
      let dialog = this.querySelector(":scope > dialog");

      if (dialog && dialog.hasAttribute("open") === false && dialog.hasAttribute("closing") === false) {
        result = true;
      }
    }

    return result;
  }

  _openNotification() {
    return new Promise((resolve) => {
      if (this._canOpenNotification()) {
        let notification = this.querySelector(":scope > x-notification");
        notification.opened = true;
      }

      resolve();
    });
  }

  _canOpenNotification() {
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

  _updateArrowVisibility() {
    let popup = this.querySelector(":scope > x-menu, :scope > x-popover");
    this["#arrow"].style.display = (popup ? null : "none");
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "button");
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this[$oldTabIndex] = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this[$oldTabIndex] > 0) ? this[$oldTabIndex] : 0;
      }

      delete this[$oldTabIndex];
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onPointerDown(event) {
    let openedMenu = this.querySelector(":scope > x-menu[opened]");
    let openedPopover = this.querySelector(":scope > x-popover[opened]");
    let openedDialog = this.querySelector(":scope > dialog[open]");
    let openedNotification = this.querySelector(":scope > x-notification[opened]");

    if (event.target === this["#backdrop"]) {
      this._onBackdropPointerDown(event);
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
      this._onButtonPointerDown(event);
    }
  }

  _onClick(event) {
    let openedMenu = this.querySelector(":scope > x-menu[opened]");
    let openedPopover = this.querySelector(":scope > x-popover[opened]");
    let openedDialog = this.querySelector(":scope > dialog[open]");
    let openedNotification = this.querySelector(":scope > x-notification[opened]");

    if (event.target === this["#backdrop"]) {
      return;
    }
    else if (openedMenu && openedMenu.contains(event.target)) {
      if (openedMenu.hasAttribute("closing") === false && event.target.closest("x-menuitem")) {
        this._onMenuItemClick(event);
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
      this._onButtonClick(event);
    }
  }

  _onBackdropPointerDown(pointerDownEvent) {
    this.collapse();
  }

  async _onButtonPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      pointerDownEvent.preventDefault();
      return;
    }

    if (this.querySelector(":scope > dialog[open]")) {
      pointerDownEvent.preventDefault();
      return;
    }

    this.setPointerCapture(pointerDownEvent.pointerId);

    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element as soon as
    // the button is released.
    if (this.matches(":focus") === false) {
      let ancestorFocusableElement = closest(this.parentNode, "*[tabindex]:not(a)");

      this.addEventListener("lostpointercapture", () => {
        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
        else {
          this.blur();
        }
      }, {once: true});
    }

    // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
    // to last at least 150ms.
    if (this._canOpenMenu() === false && this._canOpenPopover() === false && this._canClosePopover() === false) {
      let pointerDownTimeStamp = Date.now();
      let isDown = true;

      window.addEventListener("pointerup", async () => {
        isDown = false;
        let pressedTime = Date.now() - pointerDownTimeStamp;
        let minPressedTime = 150;

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
        }
        else if (this.togglable) {
          await sleep(10);
        }

        if (isDown) {
          this.setAttribute("pressed", "");
        }
      })();
    }

    if (this._canOpenMenu()) {
      this._openMenu();
    }
    else if (this._canOpenPopover()) {
      this._openPopover();
    }
    else if (this._canClosePopover()) {
      this._closePopover();
    }

    // Ripple
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;
        let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));
        let delay = true;

        if (this.expandable === false) {
          if (this.ownerButtons) {
            if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2) {
              delay = false;
            }
            else if (this.ownerButtons.tracking === 1 && this.toggled === false) {
              delay = false;
            }
          }
          else if (this.togglable) {
            delay = false;
          }
        }

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this["#ripples"].append(ripple);
        this["#ripples"].style.contain = "strict";

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing }
        );

        await whenLostPointerCapture;

        if (delay) {
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity || "0", "0"]},
            { duration: 300, easing }
          );

          await outAnimation.finished;
        }

        ripple.remove();
      }

      else if (triggerEffect === "unbounded-ripple") {
        let bounds = this["#ripples"].getBoundingClientRect();
        let size = bounds.height * 1.25;
        let top  = (bounds.y + bounds.height/2) - bounds.y - size/2;
        let left = (bounds.x + bounds.width/2)  - bounds.x - size/2;
        let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this["#ripples"].append(ripple);
        this["#ripples"].style.contain = "none";

        // Workaround for buttons that change their color when toggled on/off.
        ripple.hidden = true;
        await sleep(20);
        ripple.hidden = false;

        let inAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(1)"] },
          { duration: 200, easing }
        );

        await whenLostPointerCapture;
        await inAnimation.finished;

        let outAnimation = ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
          { duration: 200, easing }
        );

        await outAnimation.finished;
        ripple.remove();
      }
    }
  }

  async _onButtonClick(event) {
    let popup = this.querySelector(":scope > x-menu, :scope > x-popover");

    if (popup) {
      if (popup.hasAttribute("closing")) {
        return;
      }
      else {
        popup.focus();
      }
    }

    if (this._canClosePopover() === false) {
      if (this._canOpenDialog()) {
        this._openDialog();
      }
      else if (this._canOpenNotification()) {
        this._openNotification();
      }
    }

    // Toggle the button
    if (this.togglable && event.defaultPrevented === false) {
      this.removeAttribute("pressed");
      this.toggled = !this.toggled;
      this.dispatchEvent(new CustomEvent("toggle"));
    }

    // Ripple
    if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = (rect.y + rect.height/2) - rect.y - size/2;
        let left = (rect.x + rect.width/2) - rect.x - size/2;
        let delay = true;

        if (this.ownerButtons) {
          if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2) {
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
        ripple.setAttribute("class", "ripple click-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this["#ripples"].append(ripple);
        this["#ripples"].style.contain = "strict";

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing }
        );

        if (delay) {
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
            { duration: 300, easing }
          );

          await outAnimation.finished;
        }

        ripple.remove();
      }

      else if (triggerEffect === "unbounded-ripple") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = rect.height * 1.35;
        let top  = (rect.y + rect.height/2) - rect.y - size/2;
        let left = (rect.x + rect.width/2) - rect.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this["#ripples"].append(ripple);
        this["#ripples"].style.contain = "none";

        await ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"] },
          { duration: 300, easing }
        ).finished;

        await ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
          { duration: 300, easing }
        ).finished;

        ripple.remove();
      }
    }
  }

  _onMenuItemClick(event) {
    let item = event.target.closest("x-menuitem");
    let menu = this.querySelector(":scope > x-menu");

    if (!menu.hasAttribute("closing")) {
      this.collapse(item.whenTriggerEnd);
    }
  }

  _onKeyDown(event) {
    if (event.defaultPrevented === false) {
      if (event.code === "Enter" || event.code === "Space") {
        if (this._canOpenMenu()) {
          event.preventDefault();
          this._openMenu().then(() => this.querySelector(":scope > x-menu").focusFirstMenuItem());
        }
        else if (this._canOpenPopover()) {
          event.preventDefault();
          this._openPopover();
        }
        else if (this._canOpenDialog()) {
          event.preventDefault();
          this._openDialog();
        }
        else if (this._canOpenNotification()) {
          event.preventDefault();
          this._openNotification();
        }
        else {
          if (this.matches(":focus")) {
            if (this._canClosePopover()) {
              this._closePopover();
            }
            else if (this._canCloseMenu()) {
              this._closeMenu();
            }
            else {
              event.preventDefault();
              this.click();
            }
          }
        }
      }

      else if (event.code === "ArrowDown") {
        if (this._canOpenMenu()) {
          let menu = this.querySelector(":scope > x-menu");
          event.preventDefault();
          this._openMenu().then(() => this.querySelector(":scope > x-menu").focusFirstMenuItem());
        }
        else if (this._canOpenPopover()) {
          event.preventDefault();
          this._openPopover();
        }
        else {
          event.preventDefault();
          this.click();
        }
      }

      else if (event.code === "ArrowUp") {
        if (this._canOpenMenu()) {
          event.preventDefault();
          this._openMenu().then(() => this.querySelector(":scope > x-menu").focusLastMenuItem());
        }
        else if (this._canOpenPopover()) {
          event.preventDefault();
          this._openPopover();
        }
        else {
          event.preventDefault();
          this.click();
        }
      }

      else if (event.code === "Escape") {
        if (this._canCloseMenu()) {
          event.preventDefault();
          this.collapse();
        }
        else if (this._canClosePopover()) {
          event.preventDefault();
          this.collapse();
        }
      }
    }
  }
}

customElements.define("x-button", XButtonElement);
