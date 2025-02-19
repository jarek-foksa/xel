
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {getClosestScrollableAncestor} from "../utils/element.js";
import {roundRect} from "../utils/math.js";
import {parseTransistion} from "../utils/style.js";
import {html, css} from "../utils/template.js";

// @element x-tooltip
export default class XTooltipElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: none;
      bottom: -30px;
      position: fixed;
      padding: 3px 10px;
      width: fit-content;
      height: fit-content;
      max-width: 300px;
      box-sizing: border-box;
      pointer-events: none;
      border-width: 1px;
      border-style: solid;
      font-size: 12px;
      z-index: 99999;
      --align: bottom;
      --whitespace: 8px;
      --open-transition: 0 opacity cubic-bezier(0.4, 0, 0.2, 1);
      --close-transition: 0 opacity cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host([opened]),
    :host([animating]) {
      display: block;
    }
  `;

  // @property
  // @attribute
  // @type "hint" || "error"
  // @default "hint"
  get type() {
    return this.hasAttribute("type") ? this.getAttribute("type") : "hint";
  }
  set type(type) {
    this.setAttribute("type", type);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @property readOnly
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the tooltip is currently open.
  get opened() {
    return this.hasAttribute("opened");
  }

  #shadowRoot = null;
  #scrollableAncestor = null;
  #ancestorScrollListener;
  #resizeObserver;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XTooltipElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTooltipElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "disabled") {
      if (this.disabled && this.opened) {
        this.close();
      }
    }
  }

  disconnectedCallback() {
    this.close(false);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type (DOMPoint || DOMRect || Element) => Promise
  //
  // Open the tooltip next to the given point, rect or element.<br/>
  // Returns a promise that is resolved when the tooltip finishes animating.
  open(context, animate = true) {
    return new Promise( async (resolve) => {
      if (this.opened === false && this.isConnected) {
        this.setAttribute("opened", "");
        this.#updatePosition(context);
        this.#scrollableAncestor = getClosestScrollableAncestor(this);

        if (context instanceof Element) {
          this.#resizeObserver = new ResizeObserver(() => this.#updatePosition(context));
          this.#resizeObserver.observe(this);
        }

        if (this.#scrollableAncestor) {
          this.#scrollableAncestor.addEventListener("scroll", this.#ancestorScrollListener = () => {
            this.close();
          }, {once: true});
        }

        if (animate) {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = parseTransistion(transition);

          if (property === "opacity") {
            await this.animate({ opacity: ["0", "1"] }, { duration, easing }).finished;
          }
        }

        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
      }

      resolve();
    });
  }

  // @method
  // @type (boolean) => Promise
  //
  // Close the tooltip.<br/>
  // Returns a promise that is resolved when the tooltip finishes animating.
  close(animate = true) {
    return new Promise(async (resolve) => {
      if (this.opened === true) {
        this.removeAttribute("opened");
        this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

        if (this.#scrollableAncestor) {
          this.#scrollableAncestor.removeEventListener("scroll", this.#ancestorScrollListener);
        }

        if (this.#resizeObserver) {
          this.#resizeObserver.unobserve(this);
          this.#resizeObserver = null;
        }

        if (animate) {
          let transition = getComputedStyle(this).getPropertyValue("--close-transition");
          let [property, duration, easing] = parseTransistion(transition);

          this.setAttribute("animating", "");

          if (property === "opacity") {
            await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
          }
        }

        this.removeAttribute("animating");
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updatePosition(context) {
    let align = getComputedStyle(this).getPropertyValue("--align").trim();
    let borderWidth = parseInt(getComputedStyle(this).borderWidth);
    // Minimal whitespace between tooltip and window bounds
    let windowWhitespace = 8;
    // Minimal whitespace between tooltip and button
    let buttonWhitespace = parseInt(getComputedStyle(this).getPropertyValue("--whitespace"));
    // Extra offset needed when tooltip has fixed-positioned ancestor(s)
    let extraLeft = 0;
    // Extra offset needed when tooltip has fixed-positioned ancestor(s)
    let extraTop = 0;
    // Rect relative to which the tooltip should be positioned
    let contextRect = null;

    this.style.maxWidth = null;
    this.style.maxHeight = null;
    this.style.left = "0px";
    this.style.top = "0px";

    // Determine extraLeft, extraTop and contextRect
    {
      let tooltipRect = roundRect(this.getBoundingClientRect());

      if (tooltipRect.top !== 0 || tooltipRect.left !== 0) {
        extraLeft = -tooltipRect.left;
        extraTop = -tooltipRect.top;
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

    // Position the tooltip
    {
      if (align === "bottom" || align === "top") {
        let positionBottom = (reduceHeight = false) => {
          this.style.maxHeight = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let bottomOverflow = 0;

          this.style.top = (extraTop + contextRect.bottom + buttonWhitespace) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          bottomOverflow = (tooltipRect.bottom + windowWhitespace) - window.innerHeight;

          if (reduceHeight && bottomOverflow > 0) {
            let maxHeight = (tooltipRect.height - bottomOverflow);
            bottomOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
          }

          return bottomOverflow;
        };

        let positionTop = (reduceHeight = false) => {
          this.style.maxHeight = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let topOverflow = 0;

          this.style.top = (extraTop + contextRect.top - buttonWhitespace - tooltipRect.height) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          topOverflow = -(tooltipRect.top - windowWhitespace);

          if (reduceHeight && topOverflow > 0) {
            let maxHeight = tooltipRect.height - topOverflow;
            topOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
            this.style.top = (extraTop + contextRect.top - buttonWhitespace - maxHeight) + "px";
          }

          return topOverflow;
        }

        let floatCenter = () => {
          this.style.maxWidth = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let leftOverflow = 0;
          let rightOverflow = 0;

          this.style.left = (extraLeft + contextRect.left + contextRect.width/2 - tooltipRect.width/2) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          leftOverflow = -(tooltipRect.left - windowWhitespace);
          rightOverflow = tooltipRect.right + windowWhitespace - window.innerWidth;

          return [leftOverflow, rightOverflow];
        };

        let floatRight = (reduceWidth = false) => {
          this.style.maxWidth = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let leftOverflow = 0;

          this.style.left = (extraLeft + window.innerWidth - windowWhitespace - tooltipRect.width) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          leftOverflow = -(tooltipRect.left - windowWhitespace);

          if (reduceWidth && leftOverflow > 0) {
            let maxWidth = tooltipRect.width - leftOverflow;
            leftOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
            this.style.left = (extraLeft + window.innerWidth - windowWhitespace - maxWidth) + "px";
          }

          return leftOverflow;
        }

        let floatLeft = (reduceWidth = false) => {
          this.style.maxWidth = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let rightOverflow = 0;

          this.style.left = (extraLeft + windowWhitespace) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          rightOverflow = tooltipRect.right + windowWhitespace - window.innerWidth;

          if (reduceWidth && rightOverflow > 0) {
            let maxWidth = tooltipRect.width - rightOverflow;
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

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let rightOverflow = 0;

          this.style.left = (extraLeft + contextRect.right + buttonWhitespace) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          rightOverflow = (tooltipRect.right + windowWhitespace) - window.innerWidth;

          if (reduceWidth && rightOverflow > 0) {
            let maxWidth = (tooltipRect.width - rightOverflow);
            rightOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
          }

          return rightOverflow;
        };

        let positionLeft = (reduceWidth = false) => {
          this.style.maxWidth = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let leftOverflow = 0;

          this.style.left = (extraLeft + contextRect.left - buttonWhitespace - tooltipRect.width) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          leftOverflow = -(tooltipRect.left - windowWhitespace);

          if (reduceWidth && leftOverflow > 0) {
            let maxWidth = tooltipRect.width - leftOverflow;
            leftOverflow = 0;

            this.style.maxWidth = maxWidth + "px";
            this.style.left = (extraLeft + contextRect.left - buttonWhitespace - maxWidth) + "px";
          }

          return leftOverflow;
        };

        let floatCenter = () => {
          this.style.maxHeight = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let topOverflow = 0;
          let bottomOverflow = 0;

          this.style.top = (extraTop + contextRect.top + contextRect.height/2 - tooltipRect.height/2) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          topOverflow = -(tooltipRect.top - windowWhitespace);
          bottomOverflow = tooltipRect.bottom + windowWhitespace - window.innerHeight;

          return [topOverflow, bottomOverflow];
        };

        let floatBottom = (reduceHeight = false) => {
          this.style.maxHeight = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let topOverflow = 0;

          this.style.top = (extraTop + window.innerHeight - windowWhitespace - tooltipRect.height) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          topOverflow = -(tooltipRect.top - windowWhitespace);

          if (reduceHeight && topOverflow > 0) {
            let maxHeight = tooltipRect.height - topOverflow;
            topOverflow = 0;

            this.style.maxHeight = maxHeight + "px";
            this.style.top = (extraTop + window.innerHeight - windowWhitespace - maxHeight) + "px";
          }

          return topOverflow;
        };

        let floatTop = (reduceHeight = false) => {
          this.style.maxHeight = null;

          let tooltipRect = roundRect(this.getBoundingClientRect());
          let bottomOverflow = 0;

          this.style.top = (extraTop + windowWhitespace) + "px";

          tooltipRect = roundRect(this.getBoundingClientRect());
          bottomOverflow = tooltipRect.bottom + windowWhitespace - window.innerHeight;

          if (reduceHeight && bottomOverflow > 0) {
            let maxHeight = tooltipRect.height - bottomOverflow;
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
}

customElements.define("x-tooltip", XTooltipElement);
