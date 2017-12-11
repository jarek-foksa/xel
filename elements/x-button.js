
// @doc
//   http://w3c.github.io/aria-practices/#button
// @copyright
//   © 2016-2017 Jarosław Foksa

import {createElement, html, closest} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let {max} = Math;
let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-button.css" data-vulcanize>
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
      await customElements.whenDefined("x-overlay");
      this["#overlay"] = createElement("x-overlay");
      this["#overlay"].style.background =  "rgba(0, 0, 0, 0)";
    })();

  }

  async connectedCallback() {
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    this.setAttribute("role", "button");
    this.setAttribute("aria-disabled", this.disabled);

    if (this.parentElement && this.parentElement.localName === "a" && this.parentElement.tabIndex !== -1) {
      this.parentElement.tabIndex = -1;
    }

    this._updateArrowVisibility();
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  static get observedAttributes() {
    return ["disabled"];
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
      else if (this.parentElement.localName === "x-box") {
        if (this.parentElement.parentElement.localName === "x-buttons") {
          return this.parentElement.parentElement;
        }
      }
    }

    return null;
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
  //   Whether the menu or popup associated with this button is opened.
  // @type
  //   boolean
  // @attribute
  //   read-only
  get expanded() {
    return this.hasAttribute("expanded");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onDisabledAttributeChange() {
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    this.setAttribute("aria-disabled", this.disabled);
  }

  _onPointerDown(event) {
    let popup = this.querySelector(":scope > x-menu, :scope > x-popover");

    if (popup && (popup.hasAttribute("closing") || popup.contains(event.target))) {
      return;
    }
    else if (event.target === this["#overlay"]) {
      this._onOverlayPointerDown(event);
    }
    else {
      this._onButtonPointerDown(event);
    }
  }

  _onClick(event) {
    let childPopup = this.querySelector(":scope > x-menu, :scope > x-popover");
    let closestMenu = event.target.closest("x-menu");
    let closestMenuItem = event.target.closest("x-menuitem");
    let closestPopover = event.target.closest("x-popover");

    if (childPopup && childPopup.hasAttribute("closing")) {
      return;
    }
    else if (event.target === this["#overlay"]) {
      return;
    }
    else if (closestMenu) {
      if (closestMenuItem) {
        this._onMenuItemClick(event);
      }
    }
    else if (closestPopover && this.contains(closestPopover)) {
      return;
    }
    else {
      this._onButtonClick(event);
    }
  }

  _onOverlayPointerDown(pointerDownEvent) {
    this.collapse();
  }

  async _onButtonPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button !== 0) {
      pointerDownEvent.preventDefault();
      return;
    }

    if (this.querySelector(":scope > dialog[open]")) {
      event.preventDefault();
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

    if (this.isExpandable()) {
      this.expand();
    }
    else {
      // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
      // to last at least 150ms.

      let pointerDownTimeStamp = Date.now();
      let isDown = true;

      this.addEventListener("lostpointercapture", async () => {
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

        if (this.isExpandable() === false) {
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
            { opacity: [getComputedStyle(ripple).opacity, "0"]},
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
          { opacity: [getComputedStyle(ripple).opacity, "0"] },
          { duration: 200, easing }
        );

        await outAnimation.finished;
        ripple.remove();
      }
    }
  }

  async _onButtonClick(event) {
    let popup = this.querySelector(":scope > x-menu, :scope > x-popover");

    if (popup && popup.hasAttribute("closing")) {
      return;
    }

    // Toggle the button
    if (this.togglable) {
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
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
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
          { opacity: [getComputedStyle(ripple).opacity, "0"] },
          { duration: 300, easing }
        ).finished;

        ripple.remove();
      }
    }
  }

  async _onMenuItemClick(event) {
    let item = event.target.closest("x-menuitem");
    let menu = this.querySelector(":scope > x-menu");

    if (!menu.hasAttribute("closing")) {
      this.collapse(item.whenTriggerEnd);
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space" || event.code === "ArrowDown") {
      let menu = this.querySelector("x-menu");
      let popover = this.querySelector("x-popover");

      if (menu) {
        if (menu.opened === false) {
          event.preventDefault();
          this.expand().then(() => menu.focusFirstMenuItem());
        }
      }
      else if (popover) {
        if (popover.opened === false) {
          event.preventDefault();
          this.expand();
        }
      }
      else {
        event.preventDefault();
        this.click();
      }
    }

    else if (event.code === "Escape") {
      let menu = this.querySelector("x-menu");
      let popover = this.querySelector("x-popover");

      if (menu) {
        if (menu.opened) {
          event.preventDefault();
          this.collapse();
        }
      }
      else if (popover) {
        if (popover.opened) {
          event.preventDefault();
          this.collapse();
        }
      }
    }

    else if (event.code === "ArrowUp") {
      let menu = this.querySelector("x-menu");
      let popover = this.querySelector("x-popover");

      if (menu) {
        event.preventDefault();
        this.expand().then(() => menu.focusLastMenuItem());
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Show the menu or popover associated with this button.
  expand() {
    return new Promise( async (resolve) => {
      if (this._canExpandMenu()) {
        let menu = this.querySelector("x-menu");

        if (menu) {
          this._wasFocusedBeforeExpanding = this.matches(":focus");
          this.setAttribute("expanded", "");

          this["#overlay"].ownerElement = menu;
          this["#overlay"].show(false);

          await menu.openNextToElement(this, "vertical", 3);
          menu.focus();
        }
      }
      else if (this._canExpandPopover()) {
        let popover = this.querySelector("x-popover");

        if (popover) {
          this._wasFocusedBeforeExpanding = this.matches(":focus");
          this.setAttribute("expanded", "");

          this["#overlay"].ownerElement = popover;
          this["#overlay"].show(false);

          await popover.open(this);
          popover.focus();
        }
      }
      else if (this._canExpandDialog()) {
        let dialog = this.querySelector("dialog");
        dialog.showModal();
      }

      resolve();
    });
  }

  // @info
  //   Hide the menu or popover associated with this button.
  collapse(delay = null) {
    return new Promise(async (resolve) => {
      let popup = null;

      if (this._canCollapseMenu()) {
        popup = this.querySelector("x-menu");
      }
      else if (this._canCollapsePopover()) {
        popup = this.querySelector("x-popover");
      }

      if (popup) {
        popup.setAttribute("closing", "");

        await delay;
        await popup.close();

        this["#overlay"].hide(false);
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

        popup.removeAttribute("closing");
      }

      resolve();
    });
  }

  isExpandable() {
    return this.querySelector(":scope > x-menu x-menuitem, :scope > x-popover, :scope > dialog") !== null;
  }

  _canExpandMenu() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      let item = this.querySelector(":scope > x-menu x-menuitem");
      return menu !== null && item !== null && !menu.hasAttribute("opened") && !menu.hasAttribute("closing");
    }
  }

  _canExpandPopover() {
    if (this.disabled) {
      return false;
    }
    else {
      let popover = this.querySelector("x-popover");
      return popover !== null && !popover.hasAttribute("opened") && !popover.hasAttribute("closing");
    }
  }

  _canExpandDialog() {
    if (this.disabled) {
      return false;
    }
    else {
      let dialog = this.querySelector("dialog");
      return dialog !== null && !dialog.hasAttribute("open") && !dialog.hasAttribute("closing");
    }
  }

  _canCollapseMenu() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      return menu !== null && menu.opened; /* && menu.hasAttribute("closing") === false; */
    }
  }

  _canCollapsePopover() {
    if (this.disabled) {
      return false;
    }
    else {
      let popover = this.querySelector("x-popover");
      return popover !== null && popover.opened === true; /* && popover.hasAttribute("closing") === false; */
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateArrowVisibility() {
    let menu = this.querySelector("x-menu");
    let popover = this.querySelector("x-popover");
    this["#arrow"].style.display = (menu === null && popover === null) ? "none" : null;
  }
}

customElements.define("x-button", XButtonElement);
