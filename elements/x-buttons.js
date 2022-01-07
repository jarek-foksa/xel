
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

let {isArray} = Array;

// @element x-buttons
// @event ^toggle - User toggled a button on or off.
export default class XButtonsElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
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
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type number
  // @default -1
  //
  // Specifies what should happen when user clicks a button:<br/>
  // <code>-1</code> - Do not toggle any buttons<br/>
  // <code>0</code> - Toggle the clicked button on/off and other buttons off<br/>
  // <code>1</code> - Toggle the clicked button on and other buttons off<br/>
  // <code>2</code> - Toggle the clicked button on/off<br/>
  // <code>3</code> - Toggle the clicked button on/off, but toggle off only if there is at least one other button
  // toggled on<br/>
  get tracking() {
    return this.hasAttribute("tracking") ? parseInt(this.getAttribute("tracking")) : -1;
  }
  set tracking(tracking) {
    this.setAttribute("tracking", tracking);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether to use vertical (rahter than horizontal) layout.
  get vertical() {
    return this.hasAttribute("vertical");
  }
  set vertical(vertical) {
    vertical === true ? this.setAttribute("vertical", "") : this.removeAttribute("vertical");
  }

  // @property
  // @type string || Array || null
  //
  // Get/set the buttons that should have toggled state.
  get value() {
    if (this.tracking === 2 || this.tracking === 3) {
      let buttons = this.#getButtons().filter(button => button.toggled);
      return buttons.map(button => button.value).filter(value => value != undefined);
    }
    else if (this.tracking === 1 || this.tracking === 0) {
      let button = this.#getButtons().find(button => button.toggled);
      return button && button.value !== undefined ? button.value : null;
    }
    else if (this.tracking === -1) {
      return null;
    }
  }
  set value(value) {
    if (this.tracking === 2 || this.tracking === 3) {
      let buttons = this.#getButtons();

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
      let buttons = this.#getButtons();
      let matchedButton = buttons.find(button => button.value === value);

      for (let button of buttons) {
        button.toggled = (button === matchedButton);
      }
    }
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XButtonsElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XButtonsElement.#shadowTemplate.content, true));

    this.addEventListener("click", (event) => this.#onClick(event), true);
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
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

  #getButtons() {
    return [...this.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onClick(event) {
    if (event.button !== 0) {
      return;
    }

    let clickedButton = event.target.closest("x-button");
    let canToggle = (clickedButton && clickedButton.disabled === false && clickedButton.expandable === false);

    if (canToggle) {
      let otherButtons = this.#getButtons().filter(button => button !== clickedButton);

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

  #onKeyDown(event) {
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
