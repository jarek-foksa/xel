
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-tags
// @event toggle
export default class XTagsElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
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

  _shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XTagsElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XTagsElement._shadowTemplate.content, true));

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      pointerDownEvent.preventDefault();
      return;
    }

    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element as soon as
    // the button is released.
    {
      pointerDownEvent.preventDefault();

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
    }
  }

  _onClick(event) {
    let tag = event.target.closest("x-tag");

    if (tag && event.defaultPrevented === false) {
      tag.toggled = !tag.toggled;
      this.dispatchEvent(new CustomEvent("toggle", {detail: tag}));
    }
  }

  _onKeyDown(event) {
    if (event.defaultPrevented === false) {
      if (event.code === "Enter" || event.code === "Space") {
        let focusedTag = this.querySelector("x-tag:focus");

        if (focusedTag) {
          event.preventDefault();
          focusedTag.click();
        }
      }

      else if (event.key === "ArrowRight") {
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

      else if (event.key === "ArrowLeft") {
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
