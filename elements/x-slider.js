
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {compareArrays} from "../utils/array.js";
import {closest} from "../utils/element.js";
import {normalize, round, getDistanceBetweenPoints, getPrecision} from "../utils/math.js";
import {html, css} from "../utils/template.js";

let getClosestMultiple = (number, step) => round(round(number / step) * step, getPrecision(step));

// @element x-slider
// @event ^change
// @event ^changestart
// @event ^changeend
// @part thumbs
// @part thumb
// @part start-thumb
// @part end-thumb
// @part track
// @part groove-track
// @part range-track
// @part stop
// @part first-stop
// @part last-stop
// @part range-stop
export default class XSliderElement extends HTMLElement {
  static observedAttributes = ["value", "min", "max", "disabled"];

  static #shadowTemplate = html`
    <template>
      <main id="main">
        <div id="groove-track" part="track groove-track"></div>
        <div id="range-track" part="track range-track"></div>
        <div id="thumbs" part="thumbs">
          <div id="stops"></div>
          <div id="start-thumb" class="thumb" part="thumb start-thumb" data-value="start" tabindex="0"></div>
          <div id="end-thumb" class="thumb" part="thumb end-thumb" data-value="end" tabindex="0"></div>
        </div>
      </main>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      height: 20px;
      position: relative;
      box-sizing: border-box;
      touch-action: pan-y;
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
    :host([size="small"]) {
      height: 17px;
    }
    :host([size="large"]) {
      height: 23px;
    }

    #main {
      display: flex;
      flex-flow: column;
      width: 100%;
      height: 100%;
      position: relative;
    }

    /**
     * Tracks
     */

    #range-track {
      position: absolute;
      width: 0%;
      height: 4px;
      background: black;
      top: 50%;
      transform: translateY(-50%);
    }

    #groove-track {
      position: absolute;
      width: 100%;
      height: 4px;
      background: gray;
      top: 50%;
      transform: translateY(-50%);
    }

    /**
     * Thumbs
     */

    #thumbs {
      position: relative;
      width: calc(100% - var(--computed-thumb-width));
      height: 100%;
      margin: 0 auto;
    }

    #thumbs .thumb {
      position: absolute;
      top: 0;
      left: 0%;
      width: auto;
      height: 100%;
      aspect-ratio: 1;
      margin-left: calc(var(--computed-thumb-width) / -2);
      box-sizing: border-box;
      background: gray;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }
    #thumbs .thumb:focus {
      outline: none;
      z-index: 2;
    }

    /**
     * Stops
     */

    #stops {
      position: absolute;
      left: 0px;
      bottom: 0px;
      width: 100%;
      height: 100%;
    }
    #stops:empty {
      display: none;
    }

    #stops .stop {
      position: absolute;
      left: 0%;
      bottom: -5px;
      width: 1px;
      height: 5px;
      background: rgba(0, 0, 0, 0.4);
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type number
  // @default 0
  get min() {
    return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : 0;
  }
  set min(min) {
    this.setAttribute("min", min);
  }

  // @property
  // @attribute
  // @type number
  // @default 100
  get max() {
    return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 100;
  }
  set max(max) {
    this.setAttribute("max", max);
  }

  // @property
  // @attribute
  // @type number || Array<number, number>
  // @default 0
  get value() {
    if (this.hasAttribute("value")) {
      let parts = this.getAttribute("value").split(/[ ,]+/)

      if (parts.length >= 2) {
        return parts.map(part => parseFloat(part)).slice(0, 2);
      }
      else {
        return parseFloat(parts[0]);
      }
    }
    else {
      return this.max >= this.min ? this.min + (this.max - this.min) / 2 : this.min;
    }
  }
  set value(value) {
    if (Array.isArray(value)) {
      value = value.map($0 => normalize($0, this.min, this.max));
      value.length = 2;
      this.setAttribute("value", value.join(" "));
    }
    else {
      value = normalize(value, this.min, this.max);
      this.setAttribute("value", value);
    }
  }

  // @property
  // @attribute
  // @type number
  // @default 1
  get step() {
    return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
  }
  set step(step) {
    this.setAttribute("step", step);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @property
  // @attribute
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  // @property readOnly
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  //
  // Whether the slider is showing a range value.
  get range() {
    return this.hasAttribute("range");
  }

  // @property readOnly
  // @attribute
  // @type "start" || "end" || null
  // @default null
  // @readOnly
  //
  // Whether the start or end grippie is being dragged by the user.
  get dragging() {
    return this.getAttribute("dragging");
  }

  #shadowRoot = null;
  #lastTabIndex = 0;
  #computedThumbWidth = null;

  #thumbResizeObserver = new ResizeObserver(() => this.#onThumbResize());

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this.#shadowRoot.adoptedStyleSheets = [XSliderElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XSliderElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onShadowRootPointerDown(event));
    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("value", this.value);

    this.#thumbResizeObserver.observe(this["#start-thumb"]);

    this.#update();
    this.#updateAccessabilityAttributes();
  }

  disconnectedCallback() {
    this.#thumbResizeObserver.unobserve(this["#start-thumb"]);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this.isConnected === false) {
      return;
    }
    else if (name === "value") {
      this.#onValueAttributeChange();
    }
    else if (name === "min") {
      this.#onMinAttributeChange();
    }
    else if (name === "max") {
      this.#onMaxAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onValueAttributeChange() {
    this.#update();
  }

  #onMinAttributeChange() {
    this.#update();
  }

  #onMaxAttributeChange() {
    this.#update();
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  #onThumbResize() {
    let thumbRect = this["#start-thumb"].getBoundingClientRect();

    if (thumbRect.width !== this.#computedThumbWidth) {
      this.#computedThumbWidth = thumbRect.width;
      this["#main"].style.setProperty("--computed-thumb-width", thumbRect.width + "px");
    }
  }

  #onPointerDown(event) {
    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }
  }

  #onShadowRootPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1 || pointerDownEvent.isPrimary === false) {
      return;
    }

    let draggedThumb = null;
    let {width: thumbWidth, height: thumbHeight} = this["#start-thumb"].getBoundingClientRect();
    let containerBounds = this["#main"].getBoundingClientRect();
    let pointerMoveListener, pointerUpOrCancelListener;
    let changeStarted = false;

    // Determine the thumb to be dragged
    {
      if (pointerDownEvent.target.matches(".thumb")) {
        draggedThumb = pointerDownEvent.target;
      }
      else {
        if (this["#end-thumb"].hidden === true) {
          draggedThumb = this["#start-thumb"];
        }
        else {
          let startBounds = this["#start-thumb"].getBoundingClientRect();
          let endBounds = this["#end-thumb"].getBoundingClientRect();

          let startPoint = new DOMPoint(startBounds.x + startBounds.width / 2, startBounds.y + startBounds.height / 2);
          let endPoint = new DOMPoint(endBounds.x + endBounds.width / 2, endBounds.y + endBounds.height / 2);
          let pointerPoint = new DOMPoint(pointerDownEvent.clientX, pointerDownEvent.clientY);

          let startDistance = getDistanceBetweenPoints(pointerPoint, startPoint);
          let endDistance = getDistanceBetweenPoints(pointerPoint, endPoint);

          if (startDistance <= endDistance) {
            draggedThumb = this["#start-thumb"];
          }
          else {
            draggedThumb = this["#end-thumb"];
          }
        }
      }
    }

    let updateValue = (clientX, clientY) => {
      let x = clientX - (containerBounds.x + thumbWidth/2);
      x = normalize(x, 0, containerBounds.width - thumbWidth);

      let value = (x / (containerBounds.width - thumbWidth)) * (this.max - this.min) + this.min;
      value = getClosestMultiple(value, this.step);

      if (Array.isArray(this.value)) {
        let [startValue, endValue] = this.value;

        if (draggedThumb === this["#start-thumb"]) {
          if (value >= endValue) {
            value = endValue;
          }

          if (value !== startValue) {
            this.value = [value, endValue];

            if (changeStarted === false) {
              changeStarted = true;
              this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
            }

            this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
          }
        }
        else if (draggedThumb === this["#end-thumb"]) {
          if (value <= startValue) {
            value = startValue;
          }

          if (value !== endValue) {
            this.value = [startValue, value];

            if (changeStarted === false) {
              changeStarted = true;
              this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
            }

            this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
          }
        }
      }
      else {
        if (this.value !== value) {
          this.value = value;

          if (changeStarted === false) {
            changeStarted = true;
            this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
          }

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      }
    };

    draggedThumb.setPointerCapture(pointerDownEvent.pointerId);
    this.setAttribute("dragging", draggedThumb.dataset.value);

    updateValue(pointerDownEvent.clientX, pointerDownEvent.clientY);

    for (let thumb of this["#thumbs"].children) {
      thumb.style.zIndex = (thumb === draggedThumb) ? "1" : "0";
    }

    draggedThumb.addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.isPrimary) {
        updateValue(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
      }
    });

    draggedThumb.addEventListener("pointerup", pointerUpOrCancelListener = () => {
      draggedThumb.removeEventListener("pointermove", pointerMoveListener);
      draggedThumb.removeEventListener("pointerup", pointerUpOrCancelListener);
      draggedThumb.removeEventListener("pointercancel", pointerUpOrCancelListener);
      this.removeAttribute("dragging");

      if (changeStarted) {
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    });

    draggedThumb.addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  #onKeyDown(event) {
    if (event.code === "ArrowLeft" || event.code === "ArrowDown") {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let oldValue = this.value

      if (Array.isArray(this.value)) {
        let [startValue, endValue] = this.value;

        if (this.#shadowRoot.activeElement === this["#start-thumb"]) {
          if (event.shiftKey) {
            startValue -= this.step * 10;
          }
          else {
            startValue -= this.step;
          }
        }
        else if (this.#shadowRoot.activeElement === this["#end-thumb"]) {
          if (event.shiftKey) {
            endValue -= this.step * 10;
          }
          else {
            endValue -= this.step;
          }

          if (endValue <= startValue) {
            endValue = startValue;
          }
        }

        this.value = [startValue, endValue];

        if (compareArrays(oldValue, this.value) === false) {
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      }
      else {
        if (event.shiftKey) {
          this.value -= this.step * 10;
        }
        else {
          this.value -= this.step;
        }

        if (oldValue !== this.value) {
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      }

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }

    else if (event.code === "ArrowRight" || event.code === "ArrowUp") {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let oldValue = this.value

      if (Array.isArray(this.value)) {
        let [startValue, endValue] = this.value;

        if (this.#shadowRoot.activeElement === this["#start-thumb"]) {
          if (event.shiftKey) {
            startValue += this.step * 10;
          }
          else {
            startValue += this.step;
          }

          if (startValue>= endValue) {
            startValue = endValue;
          }
        }
        else if (this.#shadowRoot.activeElement === this["#end-thumb"]) {
          if (event.shiftKey) {
            endValue += this.step * 10;
          }
          else {
            endValue += this.step;
          }
        }

        this.value = [startValue, endValue];

        if (compareArrays(oldValue, this.value) === false) {
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      }
      else {
        if (event.shiftKey) {
          this.value += this.step * 10;
        }
        else {
          this.value += this.step;
        }

        if (oldValue !== this.value) {
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      }

      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    // Range
    if (Array.isArray(this.value)) {
      let [startValue, endValue] = this.value;
      let startOffset = (((startValue - this.min) / (this.max - this.min)) * 100);
      let endOffset = (((endValue - this.min) / (this.max - this.min)) * 100);

      this.setAttribute("range", "");

      // Start thumb
      {
        this["#start-thumb"].style.left = `${startOffset}%`;
        this["#start-thumb"].hidden = false;
      }

      // End thumb
      {
        this["#end-thumb"].style.left = `${endOffset}%`;
        this["#end-thumb"].hidden = false;
      }

      // Range track
      {
        this["#range-track"].style.left = `${startOffset}%`;
        this["#range-track"].style.width = (endOffset - startOffset) + "%";
      }
    }
    // Normal
    else {
      let offset = (((this.value - this.min) / (this.max - this.min)) * 100);

      this.removeAttribute("range");

      // Start thumb
      {
        this["#start-thumb"].style.left = `${offset}%`;
        this["#start-thumb"].hidden = false;
      }

      // End thumb
      {
        this["#end-thumb"].hidden = true;
      }

      // Range track
      {
        let originOffset = (((this.min > 0 ? this.min : 0) - this.min) / (this.max - this.min)) * 100;

        if (offset >= originOffset) {
          this["#range-track"].style.left = `${originOffset}%`;
          this["#range-track"].style.width = (offset - originOffset) + "%";
        }
        else {
          this["#range-track"].style.left = `${offset}%`;
          this["#range-track"].style.width = `${originOffset - offset}%`;
        }
      }
    }

    // Stops
    {
      this["#stops"].innerHTML = "";

      let stopsCount = (this.max - this.min) / this.step;

      if (stopsCount <= 20) {
        for (let value = this.min, n = 0; value <= this.max; value += this.step, n += 1) {
          let left = (((value - this.min) / (this.max - this.min)) * 100);
          let parts = ["stop"];

          if (n === 0) {
            parts.push("first-stop");
          }
          else if (n === stopsCount) {
            parts.push("last-stop");
          }

          // Range
          if (Array.isArray(this.value)) {
            let [startValue, endValue] = this.value;

            if (value >= startValue && value <= endValue) {
              parts.push("range-stop");
            }
          }
          // Normal
          else {
            if (value <= this.value) {
              parts.push("range-stop");
            }
          }

          this["#stops"].insertAdjacentHTML(
            "beforeend",
            `<div class="stop" part="${parts.join(" ")}" data-value="${value}" style="left: ${left}%"></div>`
          );
        }
      }
    }
  }

  #updateAccessabilityAttributes() {
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

    this["#start-thumb"].tabIndex = this.tabIndex;
    this["#end-thumb"].tabIndex = this.tabIndex;
  }
}

customElements.define("x-slider", XSliderElement);
