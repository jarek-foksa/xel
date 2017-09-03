
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, closest, createElement} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let {max} = Math;
let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-tab.css" data-vulcanize>

    <div id="ripples"></div>
    <div id="selection-indicator"></div>

    <div id="content">
      <slot></slot>

      <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none" hidden>
        <path id="arrow-path"></path>
      </svg>
    </div>
  </template>
`;

export class XTabElement extends HTMLElement {
  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
  }

  connectedCallback() {
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
    this.setAttribute("role", "tab");
    this.setAttribute("aria-selected", this.selected);
    this.setAttribute("aria-disabled", this.disabled);

    this._updateArrowVisibility();
  }

  attributeChangedCallback(name) {
    if (name === "selected") {
      this._onSelectedAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  static get observedAttributes() {
    return ["selected", "disabled"];
  }

  // @info
  //   Value associated with this tab.
  // @type
  //   string
  // @default
  //   ""
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(selected) {
    selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
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

  _onSelectedAttributeChange() {
    this.setAttribute("aria-selected", this.selected);
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
  }

  _onDisabledAttributeChange() {
    this.setAttribute("aria-disabled", this.disabled);
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
  }

  async _onPointerDown(pointerDownEvent) {
    // Don't focus the tab with pointer
    if (this.matches(":focus") === false && !event.target.closest("x-menu, x-popup")) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    if (pointerDownEvent.button !== 0 || this.querySelector("x-menu")) {
      return;
    }

    // Provide "pressed" attribute for theming purposes
    {
      let pointerDownTimeStamp = Date.now();

      this.setAttribute("pressed", "");
      this.setPointerCapture(pointerDownEvent.pointerId);

      this.addEventListener("lostpointercapture", async (event) => {
        if (this.selected === true) {
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = 100;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }
        }

        this.removeAttribute("pressed");
      }, {once: true});
    }

    // Ripple
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let bounds = this["#ripples"].getBoundingClientRect();
        let size = max(bounds.width, bounds.height) * 1.5;
        let top  = pointerDownEvent.clientY - bounds.y - size/2;
        let left = pointerDownEvent.clientX - bounds.x - size/2;
        let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this["#ripples"].append(ripple);

        this.setPointerCapture(pointerDownEvent.pointerId);

        // Workaround for tabs that that change their color when selected
        ripple.hidden = true;
        await sleep(10);
        ripple.hidden = false;

        let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing });

        await whenLostPointerCapture;
        await inAnimation.finished;

        let fromOpacity = getComputedStyle(ripple).opacity;
        let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"]}, { duration: 300, easing });
        await outAnimation.finished;

        ripple.remove();
      }
    }
  }

  async _onClick(event) {
    // Ripple
    if (this["#ripples"].querySelector(".pointer-down-ripple") === null && !this.querySelector("x-menu")) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let bounds = this["#ripples"].getBoundingClientRect();
        let size = max(bounds.width, bounds.height) * 1.5;
        let top  = (bounds.y + bounds.height/2) - bounds.y - size/2;
        let left = (bounds.x + bounds.width/2) - bounds.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple click-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this["#ripples"].append(ripple);

        let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing });
        await inAnimation.finished;

        let fromOpacity = getComputedStyle(ripple).opacity;
        let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"] }, { duration: 300, easing });
        await outAnimation.finished;

        ripple.remove();
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateArrowVisibility() {
    let menu = this.querySelector("x-menu");
    let popover = this.querySelector("x-popover");
    this["#arrow"].style.display = (menu === null && popover === null) ? "none" : null;
  }
}

customElements.define("x-tab", XTabElement);
