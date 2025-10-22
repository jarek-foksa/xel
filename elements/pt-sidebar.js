
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../classes/xel.js";

import {normalize} from "../utils/math.js";
import {html, css} from "../utils/template.js";

class PTSidebarElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="resize-grippie"></div>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      width: 250px;
      height: 100%;
      position: relative;
      border-right: 1px solid transparent;
      display: block flex;
      flex-flow: column;
      min-width: 185px;
      max-width: 350px;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Resize grippie
     */

    #resize-grippie {
      position: absolute;
      width: 8px;
      height: 100%;
      background: transparent;
      top: 0;
      right: -8px;
      cursor: col-resize;
      z-index: 2;
      touch-action: pan-y;
    }
  `;

  #shadowRoot;
  #width = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#width = Xel.getConfig("pt-sidebar:width", null);

    this.#shadowRoot  = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTSidebarElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(PTSidebarElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#resize-grippie"].addEventListener("pointerdown", (event) => this.#onResizeGrippiePointerdown(event));
  }

  connectedCallback() {
    this.#update();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onResizeGrippiePointerdown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      return;
    }

    let initialWidth = this.clientWidth;
    let width = initialWidth;
    let pointerMoveListener, pointerUpOrCancelListener;

    this["#resize-grippie"].setPointerCapture(pointerDownEvent.pointerId);
    pointerDownEvent.preventDefault();

    let {minWidth, maxWidth} = getComputedStyle(this);
    minWidth = Number.parseInt(minWidth);
    maxWidth = Number.parseInt(maxWidth);

    this["#resize-grippie"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      width = initialWidth - (pointerDownEvent.clientX - pointerMoveEvent.clientX);
      width = normalize(width, minWidth, Math.min(maxWidth, window.innerWidth - 200));

      this.style.width = width + "px";
      this.dispatchEvent(new CustomEvent("resize"));
    });

    this["#resize-grippie"].addEventListener("pointerup", pointerUpOrCancelListener = () => {
      this["#resize-grippie"].removeEventListener("pointermove", pointerMoveListener);
      this["#resize-grippie"].removeEventListener("pointerup", pointerUpOrCancelListener);
      this["#resize-grippie"].removeEventListener("pointercancel", pointerUpOrCancelListener);

      this.#width = width;
      Xel.setConfig("pt-sidebar:width", width);

      this.#update();
    });

    this["#resize-grippie"].addEventListener("pointercancel", pointerUpOrCancelListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    if (this.#width === null) {
      this.style.width = null;
    }
    else {
      this.style.width = this.#width + "px";
    }
  }
}

customElements.define("pt-sidebar", PTSidebarElement);
