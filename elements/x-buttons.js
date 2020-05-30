
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let {isArray} = Array;

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: flex;
        flex-flow: row;
        align-items: center;
        justify-content: flex-start;
        box-sizing: border-box;
        width: fit-content;
      }
      :host([hidden]) {
        display: none;
      }
    </style>
    <slot></slot>
  </template>
`;

// @events
//   toggle
export class XButtonsElement extends HTMLElement {
  // @info
  //  Specifies what should happen when user clicks a button:
  //  -1 - Do not toggle any buttons
  //   0 - Toggle the clicked button on/off and other buttons off
  //   1 - Toggle the clicked button on and other buttons off
  //   2 - Toggle the clicked button on/off
  //   3 - Toggle the clicked button on/off, but toggle off only if there is at least one other button toggled on
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
    if (this.tracking === 2 || this.tracking === 3) {
      let buttons = this._getButtons().filter(button => button.toggled);
      return buttons.map(button => button.value).filter(value => value != undefined);
    }
    else if (this.tracking === 1 || this.tracking === 0) {
      let button = this._getButtons().find(button => button.toggled);
      return button && button.value !== undefined ? button.value : null;
    }
    else if (this.tracking === -1) {
      return null;
    }
  }
  set value(value) {
    if (this.tracking === 2 || this.tracking === 3) {
      let buttons = this._getButtons();

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
      let buttons = this._getButtons();
      let matchedButton = buttons.find(button => button.value === value);

      for (let button of buttons) {
        button.toggled = (button === matchedButton);
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "open"});
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _getButtons() {
    return [...this.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onClick(event) {
    if (event.button !== 0) {
      return;
    }

    let clickedButton = event.target.closest("x-button");
    let canToggle = (clickedButton && clickedButton.disabled === false && clickedButton.expandable === false);

    if (canToggle) {
      let otherButtons = this._getButtons().filter(button => button !== clickedButton);

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
      else if (this.tracking === 3) {
        let otherToggledButtons = otherButtons.filter(button => button.toggled === true);

        if (clickedButton.toggled === false || otherToggledButtons.length > 0) {
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
  }

  _onKeyDown(event) {
    let {key} = event;

    if (key === "ArrowRight") {
      let element = [...this.children].find(child => child.matches(":focus"));

      if (element) {
        if (element.nextElementSibling) {
          element.nextElementSibling.focus();
        }
        else if (element !== element.parentElement.firstElementChild) {
          element.parentElement.firstElementChild.focus();
        }
      }
    }

    else if (key === "ArrowLeft") {
      let element = [...this.children].find(child => child.matches(":focus"));

      if (element) {
        if (element.previousElementSibling) {
          element.previousElementSibling.focus();
        }
        else if (element !== element.parentElement.lastElementChild) {
          element.parentElement.lastElementChild.focus();
        }
      }
    }
  }
}

customElements.define("x-buttons", XButtonsElement);
