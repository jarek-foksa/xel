
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-buttons.css" data-vulcanize>
      <slot></slot>
    </template>
  `;

  // @events
  //   toggle
  class XButtonsElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      this.addEventListener("click", (event) => this._onClick(event), true);
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      for (let child of this.children) {
        if (child.localName === "x-button") {
          let boxShadow = getComputedStyle(child).boxShadow;

          if (boxShadow !== "none") {
            this.setAttribute("hasboxshadow", "");
          }
          else {
            this.removeAttribute("hasboxshadow");
          }

          break;
        }
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    get tracking() {
      return this.hasAttribute("tracking") ? parseInt(this.getAttribute("tracking")) : -1;
    }
    set tracking(tracking) {
      this.setAttribute("tracking", tracking);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      let clickedButton = event.target.closest("x-button");

      let canToggle = (
        event.button === 0 &&
        clickedButton &&
        clickedButton.disabled === false &&
        clickedButton.querySelector("x-menu, x-popover") === null
      );

      if (canToggle) {
        let otherButtons = [...this.children].filter(button => button !== clickedButton);

        if (this.tracking === 0) {
          clickedButton.removeAttribute("pressed");
          clickedButton.toggled = !clickedButton.toggled;

          for (let button of otherButtons) {
            button.toggled = false;
          }

          this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
        }
        else if (this.tracking === 1) {
          if (clickedButton.toggled === false || clickedButton.mixed === true) {
            clickedButton.removeAttribute("pressed");
            clickedButton.toggled = true;
            clickedButton.mixed = false;

            for (let button of otherButtons) {
              button.toggled = false;
            }

            this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
          }
        }
        else if (this.tracking === 2) {
          clickedButton.removeAttribute("pressed");
          clickedButton.toggled = !clickedButton.toggled;
          this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
        }
      }
    }

    _onKeyDown(event) {
      let {key} = event;

      if (key === "ArrowRight") {
        let element = [...this.children].find(child => child.matches(":focus"));

        if (element.nextElementSibling) {
          element.nextElementSibling.focus();
        }
        else if (element !== element.parentElement.firstElementChild) {
          element.parentElement.firstElementChild.focus();
        }
      }

      else if (key === "ArrowLeft") {
        let element = [...this.children].find(child => child.matches(":focus"));

        if (element.previousElementSibling) {
          element.previousElementSibling.focus();
        }
        else if (element !== element.parentElement.lastElementChild) {
          element.parentElement.lastElementChild.focus();
        }
      }
    }
  }

  customElements.define("x-buttons", XButtonsElement);
}
