
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

// @element x-radios
export default class XRadiosElement extends HTMLElement {
  // @property
  // @attribute
  // @type string?
  // @default null
  get value() {
    let radio = this.querySelector(`x-radio[toggled]`);
    return radio ? radio.value : null;
  }
  set value(value) {
    for (let radio of this.querySelectorAll("x-radio")) {
      radio.toggled = (radio.value === value && value !== null);
    }
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.innerHTML = `<slot></slot>`;

    this.addEventListener("click", (event) => this.#onClick(event), true);
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "radiogroup");

    let radios = [...this.querySelectorAll("x-radio")].filter(radio => radio.closest("x-radios") === this);
    let defaultRadio = radios.find($0 => $0.toggled && !$0.disabled) || radios.find($0 => !$0.disabled);

    for (let radio of radios) {
      radio.setAttribute("tabindex", radio === defaultRadio ? "0 ": "-1");
      radio.setAttribute("aria-checked", radio === defaultRadio);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onClick(event) {
    let clickedRadio = event.target.closest("x-radio");

    if (clickedRadio && !clickedRadio.toggled && !clickedRadio.disabled && event.button === 0) {
      let radios = [...this.querySelectorAll("x-radio")];
      let otherRadios = radios.filter(radio => radio.closest("x-radios") === this && radio !== clickedRadio);

      if (clickedRadio.toggled === false || clickedRadio.mixed === true) {
        clickedRadio.toggled = true;
        clickedRadio.mixed = false;
        clickedRadio.tabIndex = 0;

        for (let radio of otherRadios) {
          radio.toggled = false;
          radio.tabIndex = -1;
        }

        this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedRadio}));
      }
    }
  }

  #onKeyDown(event) {
    let {key} = event;

    if (key === "ArrowDown" || key === "ArrowRight") {
      let radios = [...this.querySelectorAll("x-radio")];
      let contextRadios = radios.filter($0 => $0.disabled === false && $0.closest("x-radios") === this);
      let focusedRadio = radios.find(radio => radio.matches(":focus"));

      if (focusedRadio) {
        let focusedRadioIndex = contextRadios.indexOf(focusedRadio);
        let nextRadio = contextRadios.length > 1 ? contextRadios[focusedRadioIndex+1] || contextRadios[0] : null;

        if (nextRadio) {
          event.preventDefault();

          nextRadio.focus();
          nextRadio.tabIndex = 0;
          focusedRadio.tabIndex = -1;
        }
      }
    }

    else if (key === "ArrowUp" || key === "ArrowLeft") {
      let radios = [...this.querySelectorAll("x-radio")];
      let contextRadios = radios.filter($0 => $0.disabled === false && $0.closest("x-radios") === this);
      let focusedRadio = radios.find(radio => radio.matches(":focus"));

      if (focusedRadio) {
        let focusedRadioIndex = contextRadios.indexOf(focusedRadio);
        let lastRadio = contextRadios[contextRadios.length-1];
        let prevRadio = contextRadios.length > 1 ? contextRadios[focusedRadioIndex-1] || lastRadio : null;

        if (prevRadio) {
          event.preventDefault();

          prevRadio.focus();
          prevRadio.tabIndex = 0;
          focusedRadio.tabIndex = -1;
        }
      }
    }
  }
}

customElements.define("x-radios", XRadiosElement);
