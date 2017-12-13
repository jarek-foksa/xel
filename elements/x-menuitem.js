
// @doc
//   http://w3c.github.io/aria/aria/aria.html#menuitem
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, createElement} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let {max} = Math;
let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-menuitem.css" data-vulcanize>

    <div id="ripples"></div>

    <svg id="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path></path>
    </svg>

    <slot></slot>
    <x-icon id="arrow-icon" name="play-arrow" hidden></x-icon>
  </template>
`;

export class XMenuItemElement extends HTMLElement {
  constructor() {
    super();

    this._observer = new MutationObserver(() => this._update());

    this._blinking = false;
    this._triggerEndCallbacks = [];

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this._observer.observe(this, {childList: true, attributes: false, characterData: false, subtree: false});

    this._updateAccessabilityAttributes();

    this._update();
  }

  disconnectedCallback() {
    this._observer.disconnect();
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
  //   Value associated with this menu item (usually the command name).
  // @type
  //   string?
  // @default
  //   null
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    if (this.value !== value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }
  }

  // @type
  //   boolean?
  // @default
  //   null
  get selected() {
    if (this.hasAttribute("selected") === false) {
      return null;
    }
    else if (this.getAttribute("selected") === "false") {
      return false;
    }
    else {
      return true;
    }
  }
  set selected(selected) {
    if (this.selected !== selected) {
      if (selected === null) {
        this.removeAttribute("selected");
      }
      else if (selected === false) {
        this.setAttribute("selected", "false");
      }
      else {
        this.setAttribute("selected", "true");
      }
    }
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

  // @info
  //   Promise that is resolved when any trigger effects (such ripples or blinking) are finished.
  // @type
  //   Promise
  get whenTriggerEnd() {
    return new Promise((resolve) => {
      if (this["#ripples"].childElementCount === 0 && this._blinking === false) {
        resolve();
      }
      else {
        this._triggerEndCallbacks.push(resolve);
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  async _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button !== 0) {
      return false;
    }
    if (this.matches("[closing] x-menuitem")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.stopPropagation();

    // Trigger effect
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;
        let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this["#ripples"].append(ripple);

        this.setPointerCapture(pointerDownEvent.pointerId);

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing }
        );

        await whenLostPointerCapture;
        await inAnimation.finished;

        let outAnimation = ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity, "0"]},
          { duration: 300, easing }
        );

        await outAnimation.finished;
        ripple.remove();

        if (this["#ripples"].childElementCount === 0) {
          for (let callback of this._triggerEndCallbacks) {
            callback();
          }
        }
      }
    }
  }

  async _onClick(event) {
    if (
      event.button > 0 ||
      event.target.closest("x-menuitem") !== this ||
      event.target.closest("x-menu") !== this.closest("x-menu") ||
      this.matches("[closing] x-menuitem")
    ) {
      return;
    }

    // Trigger effect
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max(rect.width, rect.height) * 1.5;
          let top  = (rect.y + rect.height/2) - rect.y - size/2;
          let left = (rect.x + rect.width/2) - rect.x - size/2;

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple click-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this["#ripples"].append(ripple);

          let inAnimation = ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"]},
            { duration: 300, easing }
          );

          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
            { duration: 300, easing }
          );

          await outAnimation.finished;

          ripple.remove();

          if (this["#ripples"].childElementCount === 0) {
            for (let callback of this._triggerEndCallbacks) {
              callback();
            }
          }
        }
      }

      else if (triggerEffect === "blink") {
        this._blinking = true;

        this.parentElement.focus();
        await sleep(150);
        this.focus();
        await sleep(150);

        this._blinking = true;

        for (let callback of this._triggerEndCallbacks) {
          callback();
        }
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();

      if (!this.querySelector("x-menu")) {
        event.stopPropagation();
        this.click();
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    // Update arrow icon visibility
    {
      if (this.parentElement.localName === "x-menubar") {
        this["#arrow-icon"].hidden = true;
      }
      else {
        let menu = this.querySelector("x-menu");
        this["#arrow-icon"].hidden = menu ? false : true;
      }
    }
  }

  _updateAccessabilityAttributes() {
    let tabIndex  = this.getAttribute('tabindex');

    if (this.disabled) {
      if (tabIndex >= 0) {
        // Save the existing 'tabindex' as 'data-tabindex'
        this.setAttribute('data-tabindex', tabIndex);
      }

      tabIndex = '-1';

    } else if (this.hasAttribute('data-tabindex')) {
      // Restore the saved 'tabindex' from 'data-tabindex'
      tabIndex = this.getAttribute('data-tabindex');
      this.removeAttribute('data-tabindex');

    } else if (tabIndex == null) {
      tabIndex = '0';
    }

    this.setAttribute('tabindex', tabIndex);
    this.setAttribute("role", "menuitem");
    this.setAttribute("aria-disabled", this.disabled);
  }
}

customElements.define("x-menuitem", XMenuItemElement);
