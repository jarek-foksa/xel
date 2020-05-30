
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        position: fixed;
        z-index: 1000;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        touch-action: none;
        will-change: opacity;
        cursor: default;
        background: rgba(0, 0, 0, 0.5);
      }
      :host([hidden]) {
        display: none;
      }
    </style>
  </template>
`;

export class XBackdropElement extends HTMLElement {
  // @info
  //   Element below which the backdrop should be placed.
  // @type
  //   HTMLElement
  get ownerElement() {
    return this._ownerElement ? this._ownerElement : document.body.firstElementChild;
  }
  set ownerElement(ownerElement) {
    this._ownerElement = ownerElement;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._ownerElement = null;
    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    this.addEventListener("wheel", (event) => event.preventDefault());
    this.addEventListener("pointerdown", (event) => event.preventDefault()); // Don't steal the focus
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  show(animate = true) {
    this.title = "";
    this.style.top = "0px";
    this.style.left = "0px";
    this.ownerElement.before(this);
    this.hidden = false;

    let bounds = this.getBoundingClientRect();
    let extraTop = 0;
    let extraLeft = 0;

    // Determine extraLeft and extraTop which represent the extra offset needed when the backdrop is inside another
    // fixed-positioned element such as a popover
    {
      if (bounds.top !== 0 || bounds.left !== 0) {
        extraTop = -bounds.top;
        extraLeft = -bounds.left;
      }
    }

    // Ensure the backdrop is stacked directly below the ref element
    {
      let zIndex = parseFloat(getComputedStyle(this.ownerElement).zIndex);
      this.style.zIndex = zIndex - 1;
    }

    this.style.top = (extraTop) + "px";
    this.style.left = (extraLeft) + "px";

    // Animate the backdrop
    if (animate) {
      let backdropAnimation = this.animate(
        {
          opacity: ["0", "1"]
        },
        {
          duration: 100,
          easing: "ease-out"
        }
      );

      return backdropAnimation.finished;
    }
  }

  hide(animate = true) {
    if (animate) {
      let backdropAnimation = this.animate(
        {
          opacity: ["1", "0"]
        },
        {
          duration: 100,
          easing: "ease-in"
        }
      );

      backdropAnimation.finished.then(() => {
        this.remove();
      });

      return backdropAnimation.finished;
    }
    else {
      this.remove();
    }
  }
}

customElements.define("x-backdrop", XBackdropElement);
