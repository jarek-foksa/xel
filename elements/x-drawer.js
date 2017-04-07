
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;
  let {sleep} = Xel.utils.time;
  let {parseFloat} = Number;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-drawer.css" data-vulcanize>
      <slot></slot>
    </template>
  `;

  class XDrawerElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#overlay"] = html`<x-overlay id="overlay"></x-overlay>`;
      this["#overlay"].ownerElement = this;
      this["#overlay"].addEventListener("click", (event) => this._onOverlayClick(event));
    }

    connectedCallback() {
      if (this.hasAttribute("position") === false) {
        this.setAttribute("position", "left");
      }

      if (this.opened === false) {
        this.setAttribute("offscreen", "");
      }
    }

    attributeChangedCallback(name) {
      if (name === "opened") {
        this._onOpenedAttributeChange();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

    // @type
    //   string
    // @default
    //   "left"
    // @attribute
    get position() {
      return this.getAttribute("position") || "left";
    }
    set position(position) {
      this.setAttribute("position", position);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _open() {
      return new Promise( async (resolve) => {
        // Overlay
        {
          this["#overlay"].style.background = getComputedStyle(this).getPropertyValue("--backdrop-color");
          this["#overlay"].show(true)
        }

        // Drawer
        {
          this.removeAttribute("offscreen");

          let computedStyle = getComputedStyle(this);
          let {width, height, marginLeft} = computedStyle;
          let keyframes = null;

          if (marginLeft === "auto") {
            marginLeft = "0px";
          }

          if (this.position === "left") {
            keyframes = [
              { transform: `translateX(-${width})` },
              { transform: "translateX(0px)" },
            ];
          }
          else if (this.position === "right") {
            keyframes = [
              { transform: `translateX(${width})` },
              { transform: "translateX(0px)" },
            ];
          }
          else if (this.position === "top") {
            keyframes = [
              { transform: `translateY(-${height})` },
              { transform: "translateY(0px)" },
            ];
          }
          else if (this.position === "bottom") {
            keyframes = [
              { transform: `translateY(${height})` },
              { transform: "translateY(0px)" },
            ];
          }

          if (keyframes) {
            let {transitionTimingFunction, transitionDuration, transitionDelay} = computedStyle;

            let animation = this.animate(keyframes, {
              duration: parseFloat(transitionDuration) * 1000,
              delay: parseFloat(transitionDelay) * 1000,
              easing: transitionTimingFunction,
              iterations: 1
            });

            this._currentAnimation = animation;
            await animation.finished;
          }
        }

        resolve();
      });
    }

    _close() {
      return new Promise( async (resolve) => {
        // Overlay
        {
          this["#overlay"].hide(true)
        }

        // Drawer
        {
          let computedStyle = getComputedStyle(this);
          let {width, height, marginLeft} = computedStyle;
          let keyframes = null;

          if (this.position === "left") {
            keyframes = [
              { transform: "translateX(0px)" },
              { transform: `translateX(-${width})` },
            ];
          }
          else if (this.position === "right") {
            keyframes = [
              { transform: "translateX(0px)" },
              { transform: `translateX(${width})` },
            ];
          }
          else if (this.position === "top") {
            keyframes = [
              { transform: "translateY(0px)" },
              { transform: `translateY(-${height})` },
            ];
          }
          else if (this.position === "bottom") {
            keyframes = [
              { transform: "translateY(0px)" },
              { transform: `translateY(${height})` },
            ];
          }

          if (keyframes) {
            let {transitionTimingFunction, transitionDuration, transitionDelay} = computedStyle;

            let animation = this.animate(keyframes, {
              duration: parseFloat(transitionDuration) * 1000,
              delay: parseFloat(transitionDelay) * 1000,
              easing: transitionTimingFunction,
              iterations: 1
            });

            this._currentAnimation = animation;
            await animation.finished;

            if (this._currentAnimation === animation) {
              this.setAttribute("offscreen", "");
            }
          }
        }

        resolve();
      });
    }
  }

  customElements.define("x-drawer", XDrawerElement);
}
