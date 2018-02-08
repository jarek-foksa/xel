
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, createElement} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-popover.css" data-vulcanize>

    <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="arrow-path"></path>
    </svg>

    <slot></slot>
  </template>
`;

// @events
//   open
//   close
export class XPopoverElement extends HTMLElement {
  static get observedAttributes() {
    return ["modal"];
  }

  // @type
  //   boolean
  // @readonly
  // @attribute
  get opened() {
    return this.hasAttribute("opened");
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get modal() {
    return this.hasAttribute("modal");
  }
  set modal(modal) {
    modal ? this.setAttribute("modal", "") : this.removeAttribute("modal");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#backdrop"] = createElement("x-backdrop");
    this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
    this["#backdrop"].ownerElement = this;
  }

  connectedCallback() {
    this.tabIndex = -1;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "modal") {
      this._onModalAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Open the popover next to the given element.
  //   Returns a promise that is resolved when the popover finishes animating.
  // @type
  //   (XButtonElement, string) => Promise
  open(button) {
    return new Promise( async (resolve) => {
      let computedStyle = getComputedStyle(this);

      let align = computedStyle.getPropertyValue("--align").trim();
      let marginTop = parseFloat(computedStyle.marginTop);
      let marginBottom = parseFloat(computedStyle.marginBottom);
      let marginLeft = parseFloat(computedStyle.marginLeft);
      let marginRight = parseFloat(computedStyle.marginRight);

      let extraLeft = 0;         // Extra offset needed when popover has fixed-positioned ancestor(s)
      let extraTop = 0;          // Extra offset needed when popover has fixed-positioned ancestor(s)
      let windowWhitespace = 8; // Minimal whitespace between popover and window bounds
      let arrowWhitespace = 2;   // Minimal whitespace between popover and arrow

      this.style.left = "0px";
      this.style.top = "0px";
      this.style.width = null;
      this.style.height = null;

      this.setAttribute("opened", "");

      if (this.modal) {
        this["#backdrop"].show(false);
      }

      // Determine extraLeft and extraTop which represent the extra offset when the popover is inside another
      // fixed-positioned element.
      {
        let popoverBounds = this.getBoundingClientRect();

        if (popoverBounds.top !== 0 || popoverBounds.left !== 0) {
          extraLeft = -popoverBounds.left;
          extraTop = -popoverBounds.top;
        }
      }

      // Make the arrow look consistentaly with the popover
      {
        let {backgroundColor, borderColor, borderWidth} = getComputedStyle(this);

        this["#arrow"].setAttribute("data-align", align);
        this["#arrow-path"].style.fill = backgroundColor;
        this["#arrow-path"].style.stroke = borderColor;
        this["#arrow-path"].style.strokeWidth = borderWidth + "px";
      }

      if (align === "bottom") {
        let buttonBounds = button.getBoundingClientRect();
        let popoverBounds = this.getBoundingClientRect();
        let arrowBounds = this["#arrow"].getBoundingClientRect();
        let borderWidth = parseFloat(getComputedStyle(this).borderWidth);

        // Place the popover below the button
        {
          this.style.top = (buttonBounds.bottom + arrowBounds.height + arrowWhitespace + extraTop) + "px";
          this["#arrow"].style.top = (buttonBounds.bottom + arrowWhitespace + borderWidth + extraTop) + "px";
          this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows bottom client bound, reduce its height (respecting min-height)
        if (popoverBounds.bottom + windowWhitespace > window.innerHeight) {
          let reducedHeight = window.innerHeight - popoverBounds.top - windowWhitespace;
          let minHeight = parseFloat(getComputedStyle(this).minHeight);

          if (reducedHeight >= minHeight) {
            this.style.height = reducedHeight + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popover still overflows bottom client bound, place it above the button
        if (popoverBounds.bottom + windowWhitespace > window.innerHeight) {
          this.style.top = (
            buttonBounds.top - arrowWhitespace - arrowBounds.height - popoverBounds.height + extraTop
          ) + "px";

          this["#arrow"].style.top = (
            buttonBounds.top - arrowWhitespace - arrowBounds.height - borderWidth + extraTop
          ) + "px";

          this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows top client bound, reduce its height (respecting min-height)
        if (popoverBounds.top - windowWhitespace < 0) {
          let reducedHeight = buttonBounds.top - arrowWhitespace - arrowBounds.height - windowWhitespace;
          let minHeight = parseFloat(getComputedStyle(this).minHeight);

          if (reducedHeight >= minHeight) {
            this.style.top = (windowWhitespace + extraTop) + "px";
            this.style.height = reducedHeight + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popoever still overflows top client bound, place it back below the button
        if (popoverBounds.top - windowWhitespace < 0) {
          this.style.top = (buttonBounds.bottom + arrowBounds.height + arrowWhitespace + extraTop) + "px";
          this["#arrow"].style.top = (buttonBounds.bottom + arrowWhitespace + borderWidth + extraTop) + "px";
          this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;
        }
      }

      else if (align === "top") {
        let buttonBounds = button.getBoundingClientRect();
        let popoverBounds = this.getBoundingClientRect();
        let arrowBounds = this["#arrow"].getBoundingClientRect();
        let borderWidth = parseFloat(getComputedStyle(this).borderWidth);

        // Place the popover above the button
        {
          this.style.top = (
            buttonBounds.top - arrowWhitespace - arrowBounds.height - popoverBounds.height + extraTop
          ) + "px";

          this["#arrow"].style.top = (
            buttonBounds.top - arrowWhitespace - arrowBounds.height - borderWidth + extraTop
          ) + "px";

          this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows top client bound, reduce its height (respecting min-height)
        if (popoverBounds.top - windowWhitespace < 0) {
          let reducedHeight = buttonBounds.top - arrowWhitespace - arrowBounds.height - windowWhitespace;
          let minHeight = parseFloat(getComputedStyle(this).minHeight);

          if (reducedHeight >= minHeight) {
            this.style.top = (windowWhitespace + extraTop) + "px";
            this.style.height = reducedHeight + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popoever still overflows top client bound, place it below the button
        if (popoverBounds.top - windowWhitespace < 0) {
          this.style.top = (buttonBounds.bottom + arrowBounds.height + arrowWhitespace + extraTop) + "px";
          this["#arrow"].style.top = (buttonBounds.bottom + arrowWhitespace + borderWidth + extraTop) + "px";
          this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows bottom client bound, reduce its height (respecting min-height)
        if (popoverBounds.bottom + windowWhitespace > window.innerHeight) {
          let reducedHeight = window.innerHeight - popoverBounds.top - windowWhitespace;
          let minHeight = parseFloat(getComputedStyle(this).minHeight);

          if (reducedHeight >= minHeight) {
            this.style.height = reducedHeight + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popover still overflows bottom client bound, move it back above the button
        if (popoverBounds.bottom + windowWhitespace > window.innerHeight) {
          this.style.top = (
            buttonBounds.top - arrowWhitespace - arrowBounds.height - popoverBounds.height + extraTop
          ) + "px";

          this["#arrow"].style.top = (
            buttonBounds.top - arrowWhitespace - arrowBounds.height - borderWidth + extraTop
          ) + "px";

          this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;
          popoverBounds = this.getBoundingClientRect();
        }
      }

      else if (align === "left") {
        let buttonBounds = button.getBoundingClientRect();
        let popoverBounds = this.getBoundingClientRect();
        let arrowBounds = this["#arrow"].getBoundingClientRect();
        let borderWidth = parseFloat(getComputedStyle(this).borderWidth);

        // Place the popover on the left side of the button
        {
          this.style.left = (
            buttonBounds.left - arrowWhitespace - arrowBounds.width - popoverBounds.width + extraLeft
          ) + "px";

          this["#arrow"].style.left = (
            buttonBounds.left - arrowBounds.width - arrowWhitespace - borderWidth + extraLeft
          ) + "px";

          this["#arrow-path"].style.d = `path("M 0 0, L 100 50, L 00 100")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows left client bound, reduce its width (respecting min-width)
        if (popoverBounds.left - windowWhitespace < 0) {
          let reducedWidth = buttonBounds.left - arrowWhitespace - arrowBounds.height - windowWhitespace;
          let minWidth = parseFloat(getComputedStyle(this).minWidth);

          if (reducedWidth >= minWidth) {
            this.style.left = (windowWhitespace + extraLeft) + "px";
            this.style.width = reducedWidth + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popoever still overflows left client bound, place it on the right side of the button
        if (popoverBounds.left - windowWhitespace < 0) {
          this.style.left = (buttonBounds.right + arrowBounds.height + arrowWhitespace + extraLeft) + "px";
          this["#arrow"].style.top = (buttonBounds.right + arrowWhitespace + borderWidth + extraLeft) + "px";
          this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows right client bound, reduce its width (respecting min-width)
        if (popoverBounds.right + windowWhitespace > window.innerWidth) {
          let reducedWidth = window.innerWidth - popoverBounds.left - windowWhitespace;
          let minWidth = parseFloat(getComputedStyle(this).minWidth);

          if (reducedWidth >= minWidth) {
            this.style.width = reducedWidth + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popover still overflows right client bound, move it back to the left side of the button
        if (popoverBounds.right + windowWhitespace > window.innerWidth) {
          this.style.left = (
            buttonBounds.left - arrowWhitespace - arrowBounds.width - popoverBounds.width + extraLeft
          ) + "px";

          this["#arrow"].style.elft = (
            buttonBounds.left - arrowWhitespace - arrowBounds.width - borderWidth + extraLeft
          ) + "px";

          this["#arrow-path"].style.d = `path("M 0 0, L 100 50, L 00 100")`;
          popoverBounds = this.getBoundingClientRect();
        }
      }

      else if (align === "right") {
        let buttonBounds = button.getBoundingClientRect();
        let popoverBounds = this.getBoundingClientRect();
        let arrowBounds = this["#arrow"].getBoundingClientRect();
        let borderWidth = parseFloat(getComputedStyle(this).borderWidth);

        // Place the popover on the right side of the button
        {
          this.style.left = (buttonBounds.right + arrowBounds.width + arrowWhitespace + extraLeft) + "px";
          this["#arrow"].style.left = (buttonBounds.right + arrowWhitespace + borderWidth + extraLeft) + "px";
          this["#arrow-path"].style.d = `path("M 100 0, L 0 50, L 100 100")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows right client bound, reduce its width (respecting min-width)
        if (popoverBounds.right + windowWhitespace > window.innerWidth) {
          let reducedWidth = window.innerWidth - popoverBounds.left - windowWhitespace;
          let minWidth = parseFloat(getComputedStyle(this).minWidth);

          if (reducedWidth >= minWidth) {
            this.style.width = reducedWidth + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popover still overflows right client bound, place it on the left side of the button
        if (popoverBounds.right + windowWhitespace > window.innerWidth) {
          this.style.left = (
            buttonBounds.left - arrowWhitespace - arrowBounds.width - popoverBounds.width + extraLeft
          ) + "px";

          this["#arrow"].style.left = (
            buttonBounds.left - arrowWhitespace - arrowBounds.width - borderWidth + extraLeft
          ) + "px";

          this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows left client bound, reduce its width (respecting min-width)
        if (popoverBounds.left - windowWhitespace < 0) {
          let reducedWidth = buttonBounds.left - arrowWhitespace - arrowBounds.width - windowWhitespace;
          let minWidth = parseFloat(getComputedStyle(this).minWidth);

          if (reducedWidth >= minWidth) {
            this.style.left = (windowWhitespace + extraLeft) + "px";
            this.style.width = reducedWidth + "px";
            popoverBounds = this.getBoundingClientRect();
          }
        }

        // If popoever still overflows left client bound, place it back on the right side of the button
        if (popoverBounds.left - windowWhitespace < 0) {
          this.style.left = (buttonBounds.right + arrowBounds.width + arrowWhitespace + extraLeft) + "px";
          this["#arrow"].style.left = (buttonBounds.right + arrowWhitespace + borderWidth + extraLeft) + "px";
          this["#arrow-path"].style.d = `path("M 100 0, L 0 50, L 100 100")`;
        }
      }

      if (align === "bottom" || align === "top") {
        let buttonBounds = button.getBoundingClientRect();
        let popoverBounds = this.getBoundingClientRect();
        let arrowBounds = this["#arrow"].getBoundingClientRect();

        // Place the popover along the same X-axis as the button
        {
          this.style.left = (buttonBounds.left + buttonBounds.width/2 - popoverBounds.width/2 + extraLeft) + "px";
          this["#arrow"].style.left = (buttonBounds.left + buttonBounds.width/2 + extraLeft) + "px";

          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows left client bound, move it right
        if (popoverBounds.left - windowWhitespace < 0) {
          this.style.left = (windowWhitespace + extraLeft) + "px";
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows right client bound, move it left
        if (popoverBounds.right + windowWhitespace > window.innerWidth) {
          this.style.left = (window.innerWidth - windowWhitespace - popoverBounds.width + extraLeft) + "px";
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover still overflows left client bound, reduce its width
        if (popoverBounds.left < windowWhitespace) {
          this.style.left = (windowWhitespace + extraLeft) + "px";
          this.style.width = (window.innerWidth - windowWhitespace - windowWhitespace) + "px";
        }
      }

      else if (align === "left" || align === "right") {
        let buttonBounds = button.getBoundingClientRect();
        let popoverBounds = this.getBoundingClientRect();

        // Place the popover along the same Y-axis as the button
        {
          this.style.top = (buttonBounds.top + buttonBounds.height/2 - popoverBounds.height/2 + extraTop) + "px";
          this["#arrow"].style.top = (buttonBounds.top + buttonBounds.height/2 + extraTop + marginTop) + "px";
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows top client bound, move it down
        if (popoverBounds.top - windowWhitespace < 0) {
          this.style.top = (windowWhitespace + extraTop + marginTop) + "px";
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover overflows bottom client bound, move it up
        if (popoverBounds.bottom + windowWhitespace > window.innerHeight) {
          let overflowBottom = popoverBounds.bottom + windowWhitespace - window.innerHeight;
          this.style.top = (popoverBounds.top - overflowBottom + extraTop) + "px";
          popoverBounds = this.getBoundingClientRect();
        }

        // If popover still overflows top client bound, reduce its size
        if (popoverBounds.top < windowWhitespace) {
          this.style.top = (windowWhitespace + extraTop) + "px";
          this.style.height = (window.innerHeight - windowWhitespace - windowWhitespace) + "px";
        }
      }

      // Animate the popover
      {
        let transition = getComputedStyle(this).getPropertyValue("--open-transition");
        let [property, duration, easing] = this._parseTransistion(transition);

        if (property === "transform") {
          await this.animate(
            {
              transform: ["scale(1, 0)", "scale(1, 1)"],
              transformOrigin: ["0 0", "0 0"]
            },
            { duration, easing }
          ).finished;
        }
      }

      this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
      resolve();
    });
  }

  // @info
  //   Close the popover.
  //   Returns a promise that is resolved when the popover finishes animating.
  // @type
  //   (boolean) => Promise
  close() {
    return new Promise(async (resolve) => {
      if (this.opened) {
        this.removeAttribute("opened");
        this.setAttribute("animating", "");
        this["#backdrop"].hide();
        this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

        let transition = getComputedStyle(this).getPropertyValue("--close-transition");
        let [property, duration, easing] = this._parseTransistion(transition);

        if (property === "opacity") {
          await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
        }

        this.removeAttribute("animating");
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onModalAttributeChange() {
    if (this.modal && this.opened) {
      this["#backdrop"].show();
    }
    else {
      this["#backdrop"].hide();
    }
  }

  // @info
  //   Parse the value of CSS transition property.
  // @type
  //   (string) => [string, number, string]
  _parseTransistion(string) {
    let [rawDuration, property, ...rest] = string.trim().split(" ");
    let duration = parseFloat(rawDuration);
    let easing = rest.join(" ");
    return [property, duration, easing];
  }
}

customElements.define("x-popover", XPopoverElement);
