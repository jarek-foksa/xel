
// @copyright
//   © 2016-2017 Jarosław Foksa
// @doc
//   http://w3c.github.io/aria-practices/#dialog_modal
//   https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_dialog_role
//   https://www.marcozehe.de/2015/02/05/advanced-aria-tip-2-accessible-modal-dialogs/

import {createElement, html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-dialog.css" data-vulcanize>
    <slot></slot>
  </template>
`;

// @events
//   beforeclose
//   close
export class XDialogElement extends HTMLElement {
  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#overlay"] = createElement("x-overlay");
    this["#overlay"].ownerElement = this;

    this["#overlay"].addEventListener("click", (event) => this._onOverlayClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "dialog");
    this.setAttribute("tabindex", "-1");

    if (this.opened === false) {
      this.setAttribute("offscreen", "");
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "opened") {
      this._onOpenedAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  static get observedAttributes() {
    return ["opened"];
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get opened() {
    return this.hasAttribute("opened");
  }
  set opened(opened) {
    opened ? this.setAttribute("opened", "") : this.removeAttribute("opened");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onOpenedAttributeChange() {
    if (this.opened) {
      this._open();
    }
    else {
      this._close();
    }
  }

  _onOverlayClick() {
    this.opened = false;
  }

  _onKeyDown(event) {
    if (event.key === "Escape") {
      this.opened = false;
    }
    else if (event.key === "Tab") {
      // Prevent user from moving focus outside the dialog

      let focusableElements = [...this.querySelectorAll("*")].filter($0 => $0.tabIndex >= 0);

      if (focusableElements.length > 0) {
        let firstFocusableElement = focusableElements[0];
        let lastFocusableElement = focusableElements[focusableElements.length-1];

        if (event.shiftKey === false) {
          if (event.target === lastFocusableElement) {
            event.preventDefault();
            firstFocusableElement.focus();
          }
        }
        else if (event.shiftKey === true) {
          if (event.target === firstFocusableElement) {
            event.preventDefault();
            lastFocusableElement.focus();
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _open() {
    this._initiallyFocusedElement = this.getRootNode().querySelector(":focus");

    let computedStyle = getComputedStyle(this);
    let origin = computedStyle.getPropertyValue("--origin").trim();
    let backdropColor = computedStyle.getPropertyValue("--backdrop-color");

    if (origin === "center") {
      /* http://zerosixthree.se/vertical-align-anything-with-just-3-lines-of-css/ */
      this.style.transform = "perspective(1px) translate(-50%, -50%)";
      this.style.top = "50%";
    }
    else if (origin === "top") {
      this.style.transform = "perspective(1px) translate(-50%, -0%)";
    }

    this["#overlay"].style.background = backdropColor;
    this.setAttribute("opened", "");
    this.removeAttribute("offscreen");
    this["#overlay"].show(true)

    let bbox = this.getBoundingClientRect();

    let animation = this.animate(
      {
        top: [`-${bbox.height}px`, computedStyle.top],
      },
      {
        duration: 300,
        easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
      }
    );

    await animation.finished;

    let descendants = [...this.querySelectorAll("*")];
    let lastFocusableDescendant = descendants.reverse().find($0 => $0.tabIndex >= 0);

    if (lastFocusableDescendant) {
      lastFocusableDescendant.focus();
    }
  }

  async _close() {
    let beforeCloseEvent = new CustomEvent("beforeclose", {cancelable: true});
    this.dispatchEvent(beforeCloseEvent);

    if (beforeCloseEvent.defaultPrevented) {
      return;
    }

    let computedStyle = getComputedStyle(this);
    let origin = computedStyle.getPropertyValue("--origin").trim();
    let bbox = this.getBoundingClientRect();

    this.removeAttribute("opened");

    let animation = this.animate(
      {
        top: [computedStyle.top, `-${bbox.height + 20}px`],
      },
      {
        duration: 300,
        easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
      }
    );

    await animation.finished;
    this.setAttribute("offscreen", "");

    this["#overlay"].hide(true);

    // Resotre focus to the element that was focused before we opened the dialog
    if (this._initiallyFocusedElement) {
      this._initiallyFocusedElement.focus();
    }

    this.dispatchEvent(new CustomEvent("close"));
  }
}

customElements.define("x-dialog", XDialogElement);
