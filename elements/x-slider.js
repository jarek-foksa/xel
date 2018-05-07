
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
    <style>
      :host {
        display: block;
        width: 100%;
        position: relative;
        box-sizing: border-box;
        touch-action: pan-y;
        --focus-ring-color: currentColor;
        --focus-ring-opacity: 1;
        --focus-ring-width: 10px;
        --focus-ring-transition-duration: 0.15s;
        --thumb-width: 20px;
        --thumb-height: 20px;
        --thumb-d: path("M 50 50 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0");
        --thumb-transform: none;
        --thumb-color: gray;
        --thumb-border-width: 1px;
        --thumb-border-color: rgba(0, 0, 0, 0.2);
        --tick-color: rgba(0, 0, 0, 0.4);
        --track-height: 2px;
        --track-color: gray;
        --track-tint-color: black;
      }
      :host(:focus) {
        outline: none;
      }
      :host(:hover) {
        cursor: default;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.4;
      }

      /**
       * Tracks
       */

      #tracks {
        position: absolute;
        width: 100%;
        height: var(--track-height);
        top: calc((var(--thumb-height) / 2) - var(--track-height)/2);
      }

      #tracks #normal-track {
        position: absolute;
        width: 100%;
        height: 100%;
        background: var(--track-color);
        border-radius: 10px;
      }

      #tracks #tint-track {
        position: absolute;
        width: 0%;
        height: 100%;
        background: var(--track-tint-color);
      }

      /**
       * Thumbs
       */

      #thumbs {
        position: relative;
        width: calc(100% - var(--thumb-width));
        height: 100%;
      }

      #thumbs .thumb {
        position: relative;
        left: 0;
        width: var(--thumb-width);
        height: var(--thumb-height);
        display: block;
        box-sizing: border-box;
        overflow: visible;
        transform: var(--thumb-transform);
        transition: transform 0.2s ease-in-out;
        will-change: transform;
        d: var(--thumb-d);
      }

      #thumbs .thumb .shape {
        d: inherit;
        fill: var(--thumb-color);
        stroke: var(--thumb-border-color);
        stroke-width: var(--thumb-border-width);
        vector-effect: non-scaling-stroke;
      }

      #thumbs .thumb .focus-ring {
        d: inherit;
        fill: none;
        stroke: var(--focus-ring-color);
        stroke-width: 0;
        opacity: var(--focus-ring-opacity);
        vector-effect: non-scaling-stroke;
        transition: stroke-width var(--focus-ring-transition-duration) cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host(:focus) #thumbs .thumb .focus-ring {
        stroke-width: var(--focus-ring-width);
      }

      /**
       * Ticks
       */

      #ticks {
        width: calc(100% - var(--thumb-width));
        height: 5px;
        margin: 0 0 3px 0;
        position: relative;
        margin-left: calc(var(--thumb-width) / 2);
      }
      #ticks:empty {
        display: none;
      }

      #ticks .tick {
        position: absolute;
        width: 1px;
        height: 100%;
        background: var(--tick-color);
      }

      /**
       * Labels
       */

      #labels {
        position: relative;
        width: calc(100% - var(--thumb-width));
        height: 14px;
        margin-left: calc(var(--thumb-width) / 2);
        font-size: 12px;
      }
      :host(:empty) #labels {
        display: none;
      }

      ::slotted(x-label) {
        position: absolute;
        transform: translateX(-50%);
      }
    </style>

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
    return ["value", "min", "max"];
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
    else if (name === "min") {
      this._onMinAttributeChange();
    }
    else if (name === "max") {
      this._onMaxAttributeChange();
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

  _onMinAttributeChange() {
    this._updateTracks();
    this._updateThumbs();
    this._updateTicks();
  }

  _onMaxAttributeChange() {
    this._updateTracks();
    this._updateThumbs();
    this._updateTicks();
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
    if (pointerDownEvent.buttons !== 1 || pointerDownEvent.isPrimary === false) {
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
