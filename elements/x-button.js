
// @doc
//   http://w3c.github.io/aria-practices/#button
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {max} = Math;
  let {createElement, html} = Xel.utils.element;
  let {sleep} = Xel.utils.time;

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
  class XButtonElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      this["#overlay"] = createElement("x-overlay");
      this["#overlay"].style.background =  "rgba(0, 0, 0, 0)";

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["disabled"];
    }

    // @info
    //   Values associated with this button.
    // @type
    //   string
    // @default
    //   ""
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
      let popup = this.querySelector(":scope > x-menu, :scope > x-popover");

      if (popup && popup.hasAttribute("closing")) {
        return;
      }
      else if (event.target === this["#overlay"]) {
        return;
      }
      else if (event.target.closest("x-popover")) {
        return;
      }
      else if (event.target.closest("x-menu")) {
        if (event.target.closest("x-menuitem")) {
          this._onMenuItemClick(event);
        }
      }
      else {
        this._onButtonClick(event);
      }
    }

    _onOverlayPointerDown(pointerDownEvent) {
      this._collapse();
    }

    async _onButtonPointerDown(pointerDownEvent) {
      // Don't focus the widget with pointer
      if (this.matches(":focus") === false) {
        pointerDownEvent.preventDefault();
        this.focus();
        this.blur();
      }

      if (pointerDownEvent.button !== 0) {
        return;
      }

      // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
      // to last at least 100ms.
      if (this._canExpandMenu() === false && this._canExpandPopover() === false) {
        let pointerDownTimeStamp = Date.now();
        this.setAttribute("pressed", "");

        this.addEventListener("lostpointercapture", async (event) => {
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = 100;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }

          this.removeAttribute("pressed");
        }, {once: true});
      }

      this.setPointerCapture(pointerDownEvent.pointerId);
      this._expand();

      // Ripple
      {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max(rect.width, rect.height) * 1.5;
          let top  = pointerDownEvent.clientY - rect.y - size/2;
          let left = pointerDownEvent.clientX - rect.x - size/2;
          let group = this.closest("x-buttongroup");
          let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));
          let isExpandable = this.querySelector("x-menu, x-popover") !== null;
          let delay = true;

          if (isExpandable === false) {
            if (group) {
              if (group.tracking === 0 || group.tracking === 2) {
                delay = false;
              }
              else if (group.tracking === 1 && this.toggled === false) {
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
          let group = this.closest("x-buttongroup");
          let delay = true;

          if (group) {
            if (group.tracking === 0 || group.tracking === 2) {
              delay = false;
            }
            else if (group.tracking === 1 && this.toggled === true) {
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
        this._collapse(item.whenTriggerEnd);
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space" || event.code === "ArrowDown") {
        let menu = this.querySelector("x-menu");
        let popover = this.querySelector("x-popover");

        if (menu) {
          if (menu.opened === false) {
            event.preventDefault();
            this._expand().then(() => menu.focusFirstMenuItem());
          }
        }
        else if (popover) {
          if (popover.opened === false) {
            event.preventDefault();
            this._expand();
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
            this._collapse();
          }
        }
        else if (popover) {
          if (popover.opened) {
            event.preventDefault();
            this._collapse();
          }
        }
      }

      else if (event.code === "ArrowUp") {
        let menu = this.querySelector("x-menu");
        let popover = this.querySelector("x-popover");

        if (menu) {
          event.preventDefault();
          this._expand().then(() => menu.focusLastMenuItem());
        }
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Show the menu or popover associated with this button.
    _expand() {
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

        resolve();
      });
    }

    // @info
    //   Hide the menu or popover associated with this button.
    _collapse(delay = null) {
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
            this.focus();
            this.blur();
          }

          popup.removeAttribute("closing");
        }

        resolve();
      });
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateArrowVisibility() {
      let menu = this.querySelector("x-menu");
      let popover = this.querySelector("x-popover");
      this["#arrow"].style.display = (menu === null && popover === null) ? "none" : null;
    }
  }

  customElements.define("x-button", XButtonElement);
}
