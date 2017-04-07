
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-overlay.css" data-vulcanize>
      <div id="inner"></div>
    </template>
  `;

  class XOverlayElement extends HTMLElement {
    constructor() {
      super();

      this._ownerElement = null;
      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      this.addEventListener("wheel", (event) => event.preventDefault());
      this.addEventListener("pointerdown", (event) => event.preventDefault()); // Don't steal the focus
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Element below which the overlay should be placed.
    // @type
    //   HTMLElement
    get ownerElement() {
      return this._ownerElement ? this._ownerElement : document.body.firstElementChild;
    }
    set ownerElement(ownerElement) {
      this._ownerElement = ownerElement;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    show(animate = true) {
      this.style.top = null;
      this.style.left = null;
      this.ownerElement.before(this);
      this.hidden = false;

      // Prevent the document body from being scrolled
      {
        if (document.body.scrollHeight > document.body.clientHeight) {
          document.body.style.overflow = "hidden";
        }

        document.body.addEventListener("scroll", this._scrollListener = (event) => {
          event.preventDefault();
        });
      }

      // Ensure the overlay is stacked directly below the ref element
      {
        let zIndex = parseFloat(getComputedStyle(this.ownerElement).zIndex);
        this.style.zIndex = zIndex - 1;
      }

      // Adjust the "top" and "left" values in case the overlay is not positioned in the client space
      // (this could be the case when e.g. it is inside another fixed positioned element such as a drawer).
      {
        let top = parseFloat(getComputedStyle(this).top);
        let left = parseFloat(getComputedStyle(this).left);
        let rect = this.getBoundingClientRect();

        if (rect.top !== top || rect.left !== left) {
          top -= (rect.top - top);
          left -= (rect.left - left);

          this.style.top = `${top}px`;
          this.style.left = `${left}px`;
        }
      }

      // Animate the overlay
      if (animate) {
        let overlayAnimation = this.animate(
          {
            opacity: ["0", "1"]
          },
          {
            duration: 100,
            easing: "ease-out"
          }
        );

        return overlayAnimation.finished;
      }
    }

    hide(animate = true) {
      document.body.removeEventListener("scroll", this._scrollListener);

      if (animate) {
        let overlayAnimation = this.animate(
          {
            opacity: ["1", "0"]
          },
          {
            duration: 100,
            easing: "ease-in"
          }
        );

        overlayAnimation.finished.then(() => {
          document.body.style.overflow = null;
          this.remove();
        });

        return overlayAnimation.finished;
      }
      else {
        document.body.style.overflow = null;
        this.remove();
      }
    }
  }

  customElements.define("x-overlay", XOverlayElement);
}
