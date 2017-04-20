
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;
  let {sleep} = Xel.utils.time;
  let {isArray} = Array;

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

    // @info
    //  Specifies what should happen when user clicks a button:
    //  -1 - Do not toggle any buttons
    //   0 - Toggle the clicked button on/off and other buttons off
    //   1 - Toggle the clicked button on and other buttons off
    //   2 - Toggle the clicked button on/off
    // @type
    //   number
    // @default
    //   -1
    // @attribute
    get tracking() {
      return this.hasAttribute("tracking") ? parseInt(this.getAttribute("tracking")) : -1;
    }
    set tracking(tracking) {
      this.setAttribute("tracking", tracking);
    }

    // @info
    //   Get/set the buttons that should have toggled state.
    // @type
    //   string || Array || null
    get value() {
      if (this.tracking === 2) {
        let buttons = [...this.querySelectorAll(":scope > x-button[toggled]")];
        return buttons.map(button => button.value).filter(value => value != undefined);
      }
      else if (this.tracking === 1 || this.tracking === 0) {
        let button = this.querySelector(":scope > x-button[toggled]");
        return button && button.value !== undefined ? button.value : null;
      }
      else if (this.tracking === -1) {
        return null;
      }
    }
    set value(value) {
      if (this.tracking === 2) {
        let buttons = [...this.querySelectorAll(":scope > x-button")];

        if (isArray(value)) {
          for (let button of buttons) {
            button.toggled = (value.includes(button.value));
          }
        }
        else {
          for (let button of buttons) {
            button.toggled = button.value === value;
          }
        }
      }
      else if (this.tracking === 1 || this.tracking === 0) {
        let buttons = [...this.querySelectorAll(":scope > x-button")];
        let matchedButton = buttons.find(button => button.value === value);

        for (let button of buttons) {
          button.toggled = (button === matchedButton);
        }
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      if (event.button !== 0) {
        return;
      }

      let clickedButton = event.target.closest("x-button");
      let canToggle = (clickedButton && clickedButton.disabled === false && clickedButton.isExpandable() === false);

      if (canToggle) {
        let otherButtons = [...this.children].filter(button => button !== clickedButton);

        if (this.tracking === 0) {
          if (clickedButton.mixed) {
            clickedButton.mixed = false;
          }
          else {
            clickedButton.toggled = !clickedButton.toggled;
            clickedButton.mixed = false;
          }

          for (let button of otherButtons) {
            button.toggled = false;
            button.mixed = false;
          }

          this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
        }
        else if (this.tracking === 1) {
          if (clickedButton.toggled === false || clickedButton.mixed === true) {
            clickedButton.toggled = true;
            clickedButton.mixed = false;

            for (let button of otherButtons) {
              button.toggled = false;
              button.mixed = false;
            }

            this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
          }
        }
        else if (this.tracking === 2) {
          if (clickedButton.mixed) {
            clickedButton.mixed = false;
          }
          else {
            clickedButton.toggled = !clickedButton.toggled;
          }

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
