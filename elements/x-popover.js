
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement, getClosestScrollableAncestor} from "../utils/element.js";
import {roundRect} from "../utils/math.js";
import {parseTransistion} from "../utils/style.js";
import {html, css} from "../utils/template.js";
import {nextTick} from "../utils/time.js";

// @element x-popover
// @event ^open - User opened the popover.
// @event ^close - User closed the popover.
export default class XPopoverElement extends HTMLElement {
  static observedAttributes = ["modal"];

  static #shadowTemplate = html`
    <template>
      <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="arrow-path"></path>
      </svg>
      <slot id="slot"></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      position: fixed;
      display: none;
      top: 0;
      left: 0;
      min-height: 30px;
      z-index: 1001;
      box-sizing: border-box;
      background: white;
      overflow: auto;
      -webkit-app-region: no-drag;
      --align: bottom;
      --arrow-size: 20px;
      --open-transition: 900 transform cubic-bezier(0.4, 0, 0.2, 1);
      --close-transition: 200 opacity cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host(:focus) {
      outline: none;
    }
    :host([opened]),
    :host([animating]) {
      display: flex;
    }

    #arrow {
      position: fixed;
      box-sizing: border-box;
      content: "";
    }
    #arrow[data-align="top"],
    #arrow[data-align="bottom"] {
      width: var(--arrow-size);
      height: calc(var(--arrow-size) * 0.6);
      transform: translate(-50%, 0);
    }
    #arrow[data-align="left"],
    #arrow[data-align="right"] {
      width: calc(var(--arrow-size) * 0.6);
      height: var(--arrow-size);
      transform: translate(0, -50%);
    }

    #arrow-path {
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    #slot {
      border-radius: inherit;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property readOnly
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the popover is currently open.
  get opened() {
    return this.hasAttribute("opened");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the popover should close when user clicks an object outside it.
  get modal() {
    return this.hasAttribute("modal");
  }
  set modal(modal) {
    modal ? this.setAttribute("modal", "") : this.removeAttribute("modal");
  }

  #shadowRoot = null;
  #scrollableAncestor = null;
  #popoverResizeObserver = new ResizeObserver(() => this.#onResize());
  #context = null;

  #ancestorScrollListener;
  #windowResizeListener;
  #themeChangeListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XPopoverElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XPopoverElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#backdrop"] = createElement("x-backdrop");
    this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
    this["#backdrop"].ownerElement = this;

    this["#backdrop"].addEventListener("click", (event) => {
      // Don't close a <dialog> when user clicks <x-popover> backdrop inside it.
      event.preventDefault();
    });

    this["#backdrop"].addEventListener("pointerdown", (event) => {
      // Catch all pointer events while the popover is opening or closing
      if (this.hasAttribute("animating")) {
        event.stopPropagation();
      }
      else if (
        this.parentNode &&
        this.parentNode.localName !== "x-button" &&
        this.parentNode.localName !== "x-colorselect"
      ) {
        this.close();
      }
    });
  }

  connectedCallback() {
    this.tabIndex = -1;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "modal") {
      if (this.modal && this.opened) {
        this["#backdrop"].show();
      }
      else {
        this["#backdrop"].hide();
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onResize() {
    this.#updatePosition(this.#context);
  }

  // @method
  // @type (DOMPoint || DOMRect || Element) => Promise
  //
  // Open the popover next to the given point, rect or element.<br/>
  // Returns a promise that is resolved when the popover finishes animating.
  open(context, animate = true) {
    return new Promise( async (resolve) => {
      this.#context = context;

      if (this.opened === false) {
        if (this.modal) {
          this["#backdrop"].show(false);
        }

        this.setAttribute("opened", "");
        this.#popoverResizeObserver.observe(this);
        window.addEventListener("resize", this.#windowResizeListener = () => this.#onResize());
        Xel.addEventListener("themechange", this.#themeChangeListener = () => this.#updateArrowStyle());

        // Dispatch the "open" event before actually showing the popover as user might want to update its content
        // in the event listener.
        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
        await nextTick();

        this.#updateArrowStyle();
        this.#updatePosition(context);

        this.#scrollableAncestor = getClosestScrollableAncestor(this);

        if (this.#scrollableAncestor) {
          this.#scrollableAncestor.addEventListener("scroll", this.#ancestorScrollListener = () => {
            this.close();
          }, {once: true});
        }

        if (animate) {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = parseTransistion(transition);

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
      }

      resolve();
    });
  }

  // @method
  // @type (boolean) => Promise
  //
  // Close the popover.<br/>
  // Returns a promise that is resolved when the popover finishes animating.
  close(animate = true) {
    return new Promise(async (resolve) => {
      if (this.opened === true) {
        this.removeAttribute("opened");
        this.#popoverResizeObserver.disconnect();
        window.removeEventListener("resize", this.#windowResizeListener);
        Xel.removeEventListener("themechange", this.#themeChangeListener);
        this["#backdrop"].hide();
        this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));
        this.#scrollableAncestor.removeEventListener("scroll", this.#ancestorScrollListener);

        if (animate) {
          let transition = getComputedStyle(this).getPropertyValue("--close-transition");
          let [property, duration, easing] = parseTransistion(transition);

          this.setAttribute("animating", "");

          if (property === "opacity") {
            await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
          }

          this.removeAttribute("animating");
        }
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updatePosition(context) {
    let align = getComputedStyle(this).getPropertyValue("--align").trim();
    let borderWidth = parseInt(getComputedStyle(this).borderWidth);

    let windowWhitespace = 8; // Minimal whitespace between popover and window bounds
    let arrowWhitespace = 2;  // Minimal whitespace between popover and arrow

    let extraLeft = 0; // Extra offset needed when popover has fixed-positioned ancestor(s)
    let extraTop = 0;  // Extra offset needed when popover has fixed-positioned ancestor(s)
    let contextRect = null; // Rect relative to which the popover should be positioned

    this.style.maxWidth = null;
    this.style.maxHeight = null;
    this.style.left = "0px";
    this.style.top = "0px";

    // Determine extraLeft, extraTop and contextRect
    {
      let popoverRect = roundRect(this.getBoundingClientRect());

      if (popoverRect.top !== 0 || popoverRect.left !== 0) {
        extraLeft = -popoverRect.left;
        extraTop = -popoverRect.top;
      }

      if (context instanceof DOMPoint) {
        contextRect = new DOMRect(context.x, context.y, 0, 0);
      }
      else if (context instanceof DOMRect) {
        contextRect = context;
      }
      else if (context instanceof Element) {
        contextRect = context.getBoundingClientRect();
      }
      else {
        contextRect = new DOMRect();
      }
    }

    // Position the popover
    {
      if (align === "bottom" || align === "top") {
        let positionBottom = (reduceHeight = false) => {
          this.style.maxHeight = null;
          this["#arrow"].setAttribute("data-align", "bottom");
          this["#arrow-path"].setAttribute("d", "M 0 100, L 50 0, L 100 100");

          let popoverRect = roundRect(this.getBoundingClientRect());
          let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
          let bottomOverflow = 0;

          this["#arrow"].style.top = (extraTop + contextRect.bottom + arrowWhitespace + borderWidth) + "px";
          this.style.top = (extraTop + contextRect.bottom + arrowWhitespace + arrowRect.height) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          bottomOverflow = (popoverRect.bottom + windowWhitespace) - window.innerHeight;

          if (reduceHeight && bottomOverflow > 0) {
            let maxHeight = (popoverRect.height - bottomOverflow);
            bottomOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
          }

          return bottomOverflow;
        };

        let positionTop = (reduceHeight = false) => {
          this.style.maxHeight = null;
          this["#arrow"].setAttribute("data-align", "top");
          this["#arrow-path"].setAttribute("d", "M 0 0, L 50 100, L 100 0");

          let popoverRect = roundRect(this.getBoundingClientRect());
          let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
          let topOverflow = 0;

          this["#arrow"].style.top =
            Math.floor(extraTop + contextRect.top - arrowWhitespace - borderWidth - arrowRect.height) + "px";
          this.style.top = (extraTop + contextRect.top - arrowWhitespace - arrowRect.height - popoverRect.height) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          topOverflow = -(popoverRect.top - windowWhitespace);

          if (reduceHeight && topOverflow > 0) {
            let maxHeight = popoverRect.height - topOverflow;
            topOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
            this.style.top = (extraTop + contextRect.top - arrowWhitespace - arrowRect.height - maxHeight) + "px";
          }

          return topOverflow;
        }

        let floatCenter = () => {
          this.style.maxWidth = null;

          let popoverRect = roundRect(this.getBoundingClientRect());
          let leftOverflow = 0;
          let rightOverflow = 0;

          this["#arrow"].style.left = (extraLeft + contextRect.left + contextRect.width/2) + "px";
          this.style.left = (extraLeft + contextRect.left + contextRect.width/2 - popoverRect.width/2) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          leftOverflow = -(popoverRect.left - windowWhitespace);
          rightOverflow = popoverRect.right + windowWhitespace - window.innerWidth;

          return [leftOverflow, rightOverflow];
        };

        let floatRight = (reduceWidth = false) => {
          this.style.maxWidth = null;

          let popoverRect = roundRect(this.getBoundingClientRect());
          let leftOverflow = 0;

          this["#arrow"].style.left = (extraLeft + contextRect.left + contextRect.width/2) + "px";
          this.style.left = (extraLeft + window.innerWidth - windowWhitespace - popoverRect.width) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          leftOverflow = -(popoverRect.left - windowWhitespace);

          if (reduceWidth && leftOverflow > 0) {
            let maxWidth = popoverRect.width - leftOverflow;
            leftOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
            this.style.left = (extraLeft + window.innerWidth - windowWhitespace - maxWidth) + "px";
          }

          return leftOverflow;
        }

        let floatLeft = (reduceWidth = false) => {
          this.style.maxWidth = null;

          let popoverRect = roundRect(this.getBoundingClientRect());
          let rightOverflow = 0;

          this["#arrow"].style.left = (extraLeft + contextRect.left + contextRect.width/2) + "px";
          this.style.left = (extraLeft + windowWhitespace) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          rightOverflow = popoverRect.right + windowWhitespace - window.innerWidth;

          if (reduceWidth && rightOverflow > 0) {
            let maxWidth = popoverRect.width - rightOverflow;
            rightOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
          }

          return rightOverflow;
        }

        // Vertical position
        {
          if (align === "bottom") {
            let bottomOverflow = positionBottom();

            if (bottomOverflow > 0) {
              let topOverflow = positionTop();

              if (topOverflow > 0) {
                if (topOverflow > bottomOverflow) {
                  positionBottom(true);
                }
                else {
                  positionTop(true);
                }
              }
            }
          }
          else if (align === "top") {
            let topOverflow = positionTop();

            if (topOverflow > 0) {
              let bottomOverflow = positionBottom();

              if (bottomOverflow > 0) {
                if (bottomOverflow > topOverflow) {
                  positionTop(true);
                }
                else {
                  positionBottom(true);
                }
              }
            }
          }
        }

        // Horizontal position
        {
          let [leftOverflow, rightOverflow] = floatCenter();

          if (rightOverflow > 0) {
            leftOverflow = floatRight();

            if (leftOverflow > 0) {
              floatRight(true);
            }
          }
          else if (leftOverflow > 0) {
            rightOverflow = floatLeft();

            if (rightOverflow > 0) {
              floatLeft(true);
            }
          }
        }
      }

      else if (align === "right" || align === "left") {
        let positionRight = (reduceWidth = false) => {
          this.style.maxWidth = null;
          this["#arrow"].setAttribute("data-align", "right");
          this["#arrow-path"].setAttribute("d", "M 100 0, L 0 50, L 100 100");

          let popoverRect = roundRect(this.getBoundingClientRect());
          let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
          let rightOverflow = 0;

          this["#arrow"].style.left = (extraLeft + contextRect.right + arrowWhitespace + borderWidth) + "px";
          this.style.left = (extraLeft + contextRect.right + arrowWhitespace + arrowRect.width) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          rightOverflow = (popoverRect.right + windowWhitespace) - window.innerWidth;

          if (reduceWidth && rightOverflow > 0) {
            let maxWidth = (popoverRect.width - rightOverflow);
            rightOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
          }

          return rightOverflow;
        };

        let positionLeft = (reduceWidth = false) => {
          this.style.maxWidth = null;
          this["#arrow"].setAttribute("data-align", "left");
          this["#arrow-path"].setAttribute("d", "M 0 0, L 100 50, L 00 100");

          let popoverRect = roundRect(this.getBoundingClientRect());
          let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
          let leftOverflow = 0;

          this["#arrow"].style.left =
            (extraLeft + contextRect.left - arrowWhitespace - borderWidth - arrowRect.width) + "px";
          this.style.left = (extraLeft + contextRect.left - arrowWhitespace - arrowRect.width - popoverRect.width) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          leftOverflow = -(popoverRect.left - windowWhitespace);

          if (reduceWidth && leftOverflow > 0) {
            let maxWidth = popoverRect.width - leftOverflow;
            leftOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
            this.style.left = (extraLeft + contextRect.left - arrowWhitespace - arrowRect.width - maxWidth) + "px";
          }

          return leftOverflow;
        };

        let floatCenter = () => {
          this.style.maxHeight = null;

          let popoverRect = roundRect(this.getBoundingClientRect());
          let topOverflow = 0;
          let bottomOverflow = 0;

          this["#arrow"].style.top = (extraTop + contextRect.top + contextRect.height/2) + "px";
          this.style.top = (extraTop + contextRect.top + contextRect.height/2 - popoverRect.height/2) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          topOverflow = -(popoverRect.top - windowWhitespace);
          bottomOverflow = popoverRect.bottom + windowWhitespace - window.innerHeight;

          return [topOverflow, bottomOverflow];
        };

        let floatBottom = (reduceHeight = false) => {
          this.style.maxHeight = null;

          let popoverRect = roundRect(this.getBoundingClientRect());
          let topOverflow = 0;

          this["#arrow"].style.top = (extraTop + contextRect.top + contextRect.height/2) + "px";
          this.style.top = (extraTop + window.innerHeight - windowWhitespace - popoverRect.height) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          topOverflow = -(popoverRect.top - windowWhitespace);

          if (reduceHeight && topOverflow > 0) {
            let maxHeight = popoverRect.height - topOverflow;
            topOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
            this.style.top = (extraTop + window.innerHeight - windowWhitespace - maxHeight) + "px";
          }

          return topOverflow;
        };

        let floatTop = (reduceHeight = false) => {
          this.style.maxHeight = null;

          let popoverRect = roundRect(this.getBoundingClientRect());
          let bottomOverflow = 0;

          this["#arrow"].style.top = (extraTop + contextRect.top + contextRect.height/2) + "px";
          this.style.top = (extraTop + windowWhitespace) + "px";

          popoverRect = roundRect(this.getBoundingClientRect());
          bottomOverflow = popoverRect.bottom + windowWhitespace - window.innerHeight;

          if (reduceHeight && bottomOverflow > 0) {
            let maxHeight = popoverRect.height - bottomOverflow;
            bottomOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
          }

          return bottomOverflow;
        };

        // Horizontal position
        {
          if (align === "right") {
            let rightOverflow = positionRight();

            if (rightOverflow > 0) {
              let leftOverflow = positionLeft();

              if (leftOverflow > 0) {
                if (leftOverflow > rightOverflow) {
                  positionRight(true);
                }
                else {
                  positionLeft(true);
                }
              }
            }
          }
          else if (align === "left") {
            let leftOverflow = positionLeft();

            if (leftOverflow > 0) {
              let rightOverflow = positionRight();

              if (rightOverflow > 0) {
                if (rightOverflow > leftOverflow) {
                  positionLeft(true);
                }
                else {
                  positionRight(true);
                }
              }
            }
          }
        }

        // Vertical position
        {
          let [topOverflow, bottomOverflow] = floatCenter();

          if (bottomOverflow > 0) {
            topOverflow = floatBottom();

            if (topOverflow > 0) {
              floatBottom(true);
            }
          }
          else if (topOverflow > 0) {
            bottomOverflow = floatTop();

            if (bottomOverflow > 0) {
              floatTop(true);
            }
          }
        }
      }
    }
  }

  #updateArrowStyle() {
    // Make the arrow look consistently with the popover
    {
      let {backgroundColor, borderColor, borderWidth} = getComputedStyle(this);

      this["#arrow-path"].style.fill = backgroundColor;
      this["#arrow-path"].style.stroke = borderColor;
      this["#arrow-path"].style.strokeWidth = borderWidth;
    }
  }
}

customElements.define("x-popover", XPopoverElement);
