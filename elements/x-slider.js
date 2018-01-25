
// @copyright
//   © 2016-2017 Jarosław Foksa
// @doc
//   Material Design - https://material.google.com/components/sliders.html
//   MacOS - https://goo.gl/KBmOG3
//   Windows - https://metroui.org.ua/sliders.html
//   HTML - http://thenewcode.com/757/Playing-With-The-HTML5-range-Slider-Input
//   ARIA - http://w3c.github.io/aria-practices/#slider, http://w3c.github.io/aria-practices/#slidertwothumb

import {html, closest} from "../utils/element.js";
import {normalize, round, getPrecision} from "../utils/math.js";
import {throttle} from "../utils/time.js";

let getClosestMultiple = (number, step) => round(round(number / step) * step, getPrecision(step));
let $oldTabIndex = Symbol()

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-slider.css" data-vulcanize>

    <div id="tracks">
      <div id="normal-track"></div>
      <div id="tint-track"></div>
    </div>

    <div id="thumbs">
      <svg id="start-thumb" class="thumb" viewBox="0 0 100 100" preserveAspectRatio="none" style="left: 0%;">
        <path class="focus-ring"></path>
        <path class="shape"></path>
      </svg>
    </div>

    <div id="ticks"></div>

    <div id="labels">
      <slot></slot>
    </div>
  </template>
`;

// @events
//   change
//   changestart
//   changeend
export class XSliderElement extends HTMLElement {
  static get observedAttributes() {
    return ["value"];
  }

  // @type
  //   number
  // @default
  //   0
  // @attribute
  get min() {
    return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : 0;
  }
  set min(min) {
    this.setAttribute("min", min);
  }

  // @type
  //   number
  // @default
  //   100
  // @attribute
  get max() {
    return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 100;
  }
  set max(max) {
    this.setAttribute("max", max);
  }

  // @type
  //   number
  // @attribute
  get value() {
    if (this.hasAttribute("value")) {
      return parseFloat(this.getAttribute("value"));
    }
    else {
      return this.max >= this.min ? this.min + (this.max - this.min) / 2 : this.min;
    }
  }
  set value(value) {
    value = normalize(value, this.min, this.max);
    this.setAttribute("value", value);
  }

  // @type
  //   number
  // @default
  //   1
  // @attribute
  get step() {
    return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
  }
  set step(step) {
    this.setAttribute("step", step);
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    this._observer = new MutationObserver((args) => this._onMutation(args));
    this._updateTicks500ms = throttle(this._updateTicks, 500, this);

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this._onValueAttributeChange();
    }
  }

  connectedCallback() {
    this.setAttribute("value", this.value);

    this._observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value"],
      characterData: false
    });

    this._updateTracks();
    this._updateThumbs();
    this._updateTicks();
    this._updateAccessabilityAttributes();
  }

  disconnectedCallback() {
    this._observer.disconnect();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateTracks() {
    let left = (((this.value - this.min) / (this.max - this.min)) * 100);
    let originLeft = (((this.min > 0 ? this.min : 0) - this.min) / (this.max - this.min)) * 100;

    if (left >= originLeft) {
      this["#tint-track"].style.left = `${originLeft}%`;
      this["#tint-track"].style.width = (left - originLeft) + "%";
    }
    else {
      this["#tint-track"].style.left = `${left}%`;
      this["#tint-track"].style.width = `${originLeft - left}%`;
    }
  }

  _updateThumbs(animate) {
    this["#start-thumb"].style.left = (((this.value - this.min) / (this.max - this.min)) * 100) + "%";
  }

  async _updateTicks() {
    await customElements.whenDefined("x-label");

    this["#ticks"].innerHTML = "";

    for (let label of this.querySelectorAll(":scope > x-label")) {
      label.style.left = (((label.value - this.min) / (this.max - this.min)) * 100) + "%";
      this["#ticks"].insertAdjacentHTML("beforeend", `<div class="tick" style="left: ${label.style.left}"></div>`);
    }
  }

  _updateAccessabilityAttributes() {
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

  _onValueAttributeChange() {
    this._updateTracks();
    this._updateThumbs();
  }

  _onMutation(records) {
    for (let record of records) {
      if (record.type === "attributes" && record.target === this) {
        return;
      }
      else {
        this._updateTicks500ms();
      }
    }
  }

  _onPointerDown(event) {
    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }
  }

  _onShadowRootPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button !== 0 || pointerDownEvent.isPrimary === false) {
      return;
    }

    let containerBounds = this["#thumbs"].getBoundingClientRect();
    let thumb = this["#start-thumb"];
    let thumbBounds = thumb.getBoundingClientRect();
    let pointerMoveListener, lostPointerCaptureListener;
    let changeStarted = false;

    this.setPointerCapture(pointerDownEvent.pointerId);

    let updateValue = (clientX, animate) => {
      let x = clientX - containerBounds.x - thumbBounds.width/2;
      x = normalize(x, 0, containerBounds.width);

      let value = (x / containerBounds.width) * (this.max - this.min) + this.min;
      value = getClosestMultiple(value, this.step);

      if (this.value !== value) {
        this.value = value;

        if (changeStarted === false) {
          changeStarted = true;
          this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
        }

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    };

    if (pointerDownEvent.target.closest(".thumb") !== thumb) {
      updateValue(pointerDownEvent.clientX, true);
    }

    this.addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.isPrimary) {
        updateValue(pointerMoveEvent.clientX, false);
      }
    });

    this.addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this.removeEventListener("pointermove", pointerMoveListener);
      this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

      if (changeStarted) {
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    });
  }

  _onKeyDown(event) {
    if (event.code === "ArrowLeft" || event.code === "ArrowDown") {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let oldValue = this.value

      if (event.shiftKey) {
        this.value -= this.step * 10;
      }
      else {
        this.value -= this.step;
      }

      if (oldValue !== this.value) {
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
    else if (event.code === "ArrowRight" || event.code === "ArrowUp") {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let oldValue = this.value

      if (event.shiftKey) {
        this.value += this.step * 10;
      }
      else {
        this.value += this.step;
      }

      if (oldValue !== this.value) {
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
  }
}

customElements.define("x-slider", XSliderElement);
