
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

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
  class XPopoverElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this.tabIndex = -1;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @type
    //   boolean
    // @readonly
    // @attribute
    get opened() {
      return this.hasAttribute("opened");
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Open the popover next to the given element.
    //   Returns a promise that is resolved when the popover finishes animating.
    // @type
    //   (XButtonElement, string) => Promise
    open(button) {
      return new Promise( async (resolve) => {
        let align = getComputedStyle(this).getPropertyValue("--align").trim();
        let whitespace = 5;
        let offset = 2;

        this.setAttribute("opened", "");
        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

        {
          this.style.width = null;
          this.style.height = null;

          let popoverBounds = this.getBoundingClientRect();
          let {backgroundColor, borderColor, borderWidth} = getComputedStyle(this);

          this["#arrow"].setAttribute("data-align", align);
          this["#arrow-path"].style.fill = backgroundColor;
          this["#arrow-path"].style.stroke = borderColor;
          this["#arrow-path"].style.strokeWidth = borderWidth + "px";

          this.style.width = popoverBounds.width + "px";
          this.style.height = popoverBounds.height + "px";
        }

        if (align === "bottom") {
          // Align the popover along the Y-axis
          {
            let borderWidth = parseFloat(getComputedStyle(this).borderWidth);
            let buttonBounds = button.getBoundingClientRect();
            let popoverBounds = this.getBoundingClientRect();
            let arrowBounds = this["#arrow"].getBoundingClientRect();

            // Place the popover below the button

            {
              this.style.top = `${buttonBounds.top + buttonBounds.height + arrowBounds.height + offset}px`;
              this["#arrow"].style.top = `${buttonBounds.bottom + offset + borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows bottom client bound, Place it above the button

            if (popoverBounds.top + popoverBounds.height + whitespace > window.innerHeight) {
              this.style.top = `${buttonBounds.top - arrowBounds.height - popoverBounds.height - offset}px`;
              this["#arrow"].style.top = `${buttonBounds.top - arrowBounds.height - offset - borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popoever overflows top client bound, place it back below the button

            if (popoverBounds.top - whitespace < 0) {
              this.style.top = `${buttonBounds.top + buttonBounds.height + arrowBounds.height + offset}px`;
              this["#arrow"].style.top = `${buttonBounds.bottom + offset + borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows bottom client bound, reduce its size

            if (popoverBounds.top + popoverBounds.height + whitespace > window.innerHeight) {
              this.style.height = (window.innerHeight - popoverBounds.top - whitespace) + "px";
            }
          }
        }

        else if (align === "top") {
          // Align the popover along the Y-axis
          {
            let borderWidth = parseFloat(getComputedStyle(this).borderWidth);
            let buttonBounds = button.getBoundingClientRect();
            let popoverBounds = this.getBoundingClientRect();
            let arrowBounds = this["#arrow"].getBoundingClientRect();

            // Place the popover above the button

            {
              this.style.top = `${buttonBounds.top - arrowBounds.height - popoverBounds.height - offset}px`;
              this["#arrow"].style.top = `${buttonBounds.top - arrowBounds.height - offset - borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popoever overflows top client bound, place it below the button

            if (popoverBounds.top - whitespace < 0) {
              this.style.top = `${buttonBounds.top + buttonBounds.height + arrowBounds.height + offset}px`;
              this["#arrow"].style.top = `${buttonBounds.bottom + offset + borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 100, L 50 0, L 100 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows bottom client bound, place it back above the button

            if (popoverBounds.top + popoverBounds.height + whitespace > window.innerHeight) {
              this.style.top = `${buttonBounds.top - arrowBounds.height - popoverBounds.height - offset}px`;
              this["#arrow"].style.top = `${buttonBounds.top - arrowBounds.height - offset - borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 0, L 50 100, L 100 0")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover still overflows top client bound, reduce its size

            if (popoverBounds.top < whitespace) {
              this.style.top = whitespace + "px";
              this.style.height = (buttonBounds.top - arrowBounds.height - whitespace - borderWidth - borderWidth) + "px";
            }
          }
        }

        else if (align === "left") {
          // Align the popover along the X-axis
          {
            let borderWidth = parseFloat(getComputedStyle(this).borderWidth);
            let buttonBounds = button.getBoundingClientRect();
            let popoverBounds = this.getBoundingClientRect();
            let arrowBounds = this["#arrow"].getBoundingClientRect();

            // Place the popover on the left side of the button

            {
              this.style.left = "0px";
              popoverBounds = this.getBoundingClientRect();

              this.style.left = `${buttonBounds.left - popoverBounds.width - arrowBounds.width - offset}px`;
              this["#arrow"].style.left = `${buttonBounds.left - arrowBounds.width - offset - borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 0, L 100 50, L 00 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows left client bound, place it on the right side of the button

            if (popoverBounds.left < whitespace) {
              this.style.left = `${buttonBounds.left + buttonBounds.width + arrowBounds.width + offset}px`;
              this["#arrow"].style.left = `${buttonBounds.left + buttonBounds.width + offset + borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 100 0, L 0 50, L 100 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows right client bound, place it on the left side of the button

            if (popoverBounds.right + whitespace > window.innerWidth) {
              this.style.left = "0px";
              popoverBounds = this.getBoundingClientRect();

              this.style.left = `${buttonBounds.left - popoverBounds.width - arrowBounds.width - offset}px`;
              this["#arrow"].style.left = `${buttonBounds.left - arrowBounds.width - offset - borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 0, L 100 50, L 00 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover still overflows left client bound, reduce its size

            if (popoverBounds.left < whitespace) {
              this.style.left = whitespace + "px";
              this.style.width = `${window.innerWidth - buttonBounds.left - arrowBounds.width - offset - whitespace}px`;
            }
          }
        }

        else if (align === "right") {
          // Align the popover along the X-axis
          {
            let borderWidth = parseFloat(getComputedStyle(this).borderWidth);
            let buttonBounds = button.getBoundingClientRect();
            let popoverBounds = this.getBoundingClientRect();
            let arrowBounds = this["#arrow"].getBoundingClientRect();

            // Place the popover on the right side of the button

            {
              this.style.left = `${buttonBounds.left + buttonBounds.width + arrowBounds.width + offset}px`;
              this["#arrow"].style.left = `${buttonBounds.left + buttonBounds.width + offset + borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 100 0, L 0 50, L 100 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows right client bound, place it on the left side of the button

            if (popoverBounds.right + whitespace > window.innerWidth) {
              this.style.left = "0px";
              popoverBounds = this.getBoundingClientRect();

              this.style.left = `${buttonBounds.left - popoverBounds.width - arrowBounds.width - offset}px`;
              this["#arrow"].style.left = `${buttonBounds.left - arrowBounds.width - offset - borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 0 0, L 100 50, L 00 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows left client bound, place it on the right button side

            if (popoverBounds.left < whitespace) {
              this.style.left = `${buttonBounds.left + buttonBounds.width + arrowBounds.width + offset}px`;
              this["#arrow"].style.left = `${buttonBounds.left + buttonBounds.width + offset + borderWidth}px`;
              this["#arrow-path"].style.d = `path("M 100 0, L 0 50, L 100 100")`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover still overflows right client bound, reduce its size

            if (popoverBounds.right + whitespace > window.innerWidth) {
              this.style.width = `${window.innerWidth - buttonBounds.right - arrowBounds.width - offset - whitespace}px`;
            }
          }
        }

        if (align === "bottom" || align === "top") {
          // Align the popover along the X-axis
          {
            let buttonBounds = button.getBoundingClientRect();
            let popoverBounds = this.getBoundingClientRect();

            // Place the popover along the same X-axis as the button

            {
              this.style.left = `${buttonBounds.left - popoverBounds.width/2 + buttonBounds.width/2}px`;
              this["#arrow"].style.left = `${buttonBounds.left + buttonBounds.width/2}px`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflow left client bound, move it right

            if (popoverBounds.left < whitespace) {
              this.style.left = `${whitespace}px`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows right client bound, move it left

            if (popoverBounds.left + popoverBounds.width + whitespace > window.innerWidth) {
              this.style.left = `${window.innerWidth - whitespace - popoverBounds.width}px`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover still overflows left client bound, reduce its with

            if (popoverBounds.left < whitespace) {
              this.style.left = `${whitespace}px`;
              this.style.width = `${window.innerWidth - whitespace - whitespace}px`;
            }
          }
        }

        else if (align === "left" || align === "right") {
          // Align the popover along Y-axis
          {
            let buttonBounds = button.getBoundingClientRect();
            let popoverBounds = this.getBoundingClientRect();

            // Place the popover along the same Y-axis as the button

            {
              this.style.top = `${buttonBounds.top + buttonBounds.height/2 - popoverBounds.height/2}px`;
              this["#arrow"].style.top = `${buttonBounds.top + buttonBounds.height/2 }px`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows top client bound, move it down

            if (popoverBounds.top < whitespace) {
              this.style.top = `${whitespace}px`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover overflows bottom client bound, move it up

            if (popoverBounds.top + popoverBounds.height + whitespace > window.innerHeight) {
              let overflowBottom = (popoverBounds.top + popoverBounds.height + whitespace) - window.innerHeight;
              this.style.top = `${popoverBounds.top - overflowBottom}px`;

              popoverBounds = this.getBoundingClientRect();
            }

            // If popover still overflows top client bound, reduce its size

            if (popoverBounds.top < whitespace) {
              this.style.top = `${whitespace}px`;
              this.style.height = `${window.innerHeight - whitespace - whitespace}px`;
            }
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
          this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

          this.setAttribute("animating", "");
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
}
