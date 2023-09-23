
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-tags
// @event toggle
export default class XTagsElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: flex-start;
    }
    :host([hidden]) {
      display: none;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @type Array<string>
  // @default []
  get value() {
    let tags = [...this.children].filter(child => child.localName === "x-tag");
    return tags.filter(tag => tag.toggled).map(tag => tag.value).filter(value => value !== null);
  }
  set value(value) {
    let tags = [...this.children].filter(child => child.localName === "x-tag");

    for (let tag of tags) {
      tag.toggled = value.includes(tag.value);
    }
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XTagsElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTagsElement.#shadowTemplate.content, true));

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons > 1) {
      pointerDownEvent.preventDefault();
      return;
    }

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
  }

  #onClick(event) {
    let tag = event.target.closest("x-tag");

    if (tag && event.defaultPrevented === false) {
      tag.toggled = !tag.toggled;
      this.dispatchEvent(new CustomEvent("toggle", {detail: tag}));
    }
  }

  #onKeyDown(event) {
    if (event.defaultPrevented === false) {
      if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
        let focusedTag = this.querySelector("x-tag:focus");

        if (focusedTag) {
          event.preventDefault();
          focusedTag.click();
        }
      }

      else if (event.code === "ArrowRight") {
        let focusedTag = this.querySelector("x-tag:focus");

        if (focusedTag) {
          if (focusedTag.nextElementSibling) {
            focusedTag.nextElementSibling.focus();
          }
          else if (focusedTag !== focusedTag.parentElement.firstElementChild) {
            focusedTag.parentElement.firstElementChild.focus();
          }
        }
      }

      else if (event.code === "ArrowLeft") {
        let focusedTag = this.querySelector("x-tag:focus");

        if (focusedTag) {
          if (focusedTag.previousElementSibling) {
            focusedTag.previousElementSibling.focus();
          }
          else if (focusedTag !== focusedTag.parentElement.lastElementChild) {
            focusedTag.parentElement.lastElementChild.focus();
          }
        }
      }
    }
  }
}

customElements.define("x-tags", XTagsElement);
