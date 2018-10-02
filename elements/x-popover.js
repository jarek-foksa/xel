
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, createElement} from "../utils/element.js";
import {roundRect} from "../utils/math.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        position: fixed;
        display: none;
        top: 0;
        left: 0;
        min-height: 30px;
        z-index: 1001;
        box-sizing: border-box;
        background: white;
        -webkit-app-region: no-drag;
        --orientation: vertical; /* horizontal, vertical */
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

      #arrow path {
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      #arrow[data-align="bottom"] path {
        d: path("M 0 100, L 50 0, L 100 100");
      }
      #arrow[data-align="top"] path {
        d: path("M 0 0, L 50 100, L 100 0");
      }
      #arrow[data-align="left"] path {
        d: path("M 0 0, L 100 50, L 00 100");
      }
      #arrow[data-align="right"] path {
        d: path("M 100 0, L 0 50, L 100 100");
      }
    </style>

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
  //   Open the popover next to the given point, rect or element.
  //   Returns a promise that is resolved when the popover finishes animating.
  // @type
  //  (DOMPoint || DOMRect || Element) => void
  open(context, animate = true) {
    return new Promise( async (resolve) => {
      let contextRect;
      let extraLeft = 0;        // Extra offset needed when popover has fixed-positioned ancestor(s)
      let extraTop = 0;         // Extra offset needed when popover has fixed-positioned ancestor(s)
      let windowWhitespace = 8; // Minimal whitespace between popover and window bounds
      let arrowWhitespace = 2;  // Minimal whitespace between popover and arrow

      this.style.left = "0px";
      this.style.top = "0px";
      this.setAttribute("opened", "");

      if (this.modal) {
        this["#backdrop"].show(false);
      }

      let align = getComputedStyle(this).getPropertyValue("--align").trim();
      let resolvedAlign = align;

      // Make the arrow look consistentaly with the popover
      {
        let {backgroundColor, borderColor, borderWidth} = getComputedStyle(this);

        this["#arrow"].setAttribute("data-align", align);
        this["#arrow-path"].style.fill = backgroundColor;
        this["#arrow-path"].style.stroke = borderColor;
        this["#arrow-path"].style.strokeWidth = borderWidth;
      }

      let {width:popoverWidth, height:popoverHeight} = roundRect(this.getBoundingClientRect());
      let {width:arrowWidth, height:arrowHeight} = roundRect(this["#arrow"].getBoundingClientRect());

      // Determine the rect relative to which the x-popover should be positioned
      {
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

      // Determine extraLeft and extraTop which represent the extra offset when the popover is inside another
      // fixed-positioned element.
      {
        let popoverBounds = roundRect(this.getBoundingClientRect());

        if (popoverBounds.top !== 0 || popoverBounds.left !== 0) {
          extraLeft = -popoverBounds.left;
          extraTop = -popoverBounds.top;
        }
      }

      // Position the popover
      {
        let positionBottom = () => {
          this.style.top = (contextRect.top + contextRect.height + extraTop + arrowWhitespace + arrowHeight) + "px";
          this.style.left = (contextRect.left + contextRect.width/2 + extraLeft - popoverWidth/2) + "px";
          resolvedAlign = "bottom";
        };

        let positionTop = () => {
          this.style.top = (contextRect.top + extraTop - arrowWhitespace - arrowHeight - popoverHeight) + "px";
          this.style.left = (contextRect.left + contextRect.width/2 + extraLeft - popoverWidth/2) + "px";
          resolvedAlign = "top";
        }

        let positionLeft = () => {
          this.style.top = (contextRect.top + contextRect.height/2 - popoverHeight/2 + extraTop) + "px";
          this.style.left = (contextRect.left - arrowWhitespace - arrowWidth - popoverWidth + extraLeft) + "px";
          resolvedAlign = "left";
        };

        let positionRight = () => {
          this.style.top = (contextRect.top + contextRect.height/2 - popoverHeight/2 + extraTop) + "px";
          this.style.left = (contextRect.right + arrowWhitespace + arrowWidth + extraLeft) + "px";
          resolvedAlign = "right";
        };

        let moveLeft = () => {
          this.style.left = (window.innerWidth - windowWhitespace - popoverWidth + extraLeft) + "px";
        };

        let moveRight = () => {
          this.style.left = (windowWhitespace + extraLeft) + "px";
        };

        let moveDown = () => {
          this.style.top = (windowWhitespace + extraLeft) + "px";
        };

        let moveUp = () => {
          this.style.top = (window.innerHeight - windowWhitespace - popoverHeight + extraLeft) + "px";
        };

        let isOverflowingViewportEdge = (edge = "bottom") => {
          let popoverBounds = roundRect(this.getBoundingClientRect());

          if (edge === "bottom") {
            return popoverBounds.bottom + windowWhitespace > window.innerHeight;
          }
          else if (edge === "top") {
            return popoverBounds.top < windowWhitespace;
          }
          else if (edge === "right") {
            return popoverBounds.right + windowWhitespace > window.innerWidth;
          }
          else if (edge === "left") {
            return popoverBounds.left < windowWhitespace;
          }
        };

        if (align === "bottom") {
          positionBottom();

          if (isOverflowingViewportEdge("bottom")) {
            positionTop();
          }
          if (isOverflowingViewportEdge("top")) {
            positionBottom();
          }
          if (isOverflowingViewportEdge("right")) {
            moveLeft();
          }
          if (isOverflowingViewportEdge("left")) {
            moveRight();
          }
        }

        else if (align === "top") {
          positionTop();

          if (isOverflowingViewportEdge("top")) {
            positionBottom();
          }
          if (isOverflowingViewportEdge("bottom")) {
            positionTop();
          }
          if (isOverflowingViewportEdge("right")) {
            moveLeft();
          }
          if (isOverflowingViewportEdge("left")) {
            moveRight();
          }
        }

        else if (align === "left") {
          positionLeft();

          if (isOverflowingViewportEdge("left")) {
            positionRight();
          }
          if (isOverflowingViewportEdge("right")) {
            positionLeft();
          }
          if (isOverflowingViewportEdge("top")) {
            moveDown();
          }
          if (isOverflowingViewportEdge("bottom")) {
            moveUp();
          }
        }

        else if (align === "right") {
          positionRight();

          if (isOverflowingViewportEdge("right")) {
            positionLeft();
          }
          if (isOverflowingViewportEdge("left")) {
            positionRight();
          }
          if (isOverflowingViewportEdge("bottom")) {
            moveUp();
          }
          if (isOverflowingViewportEdge("top")) {
            moveDown();
          }
        }
      }

      // Position the arrow
      {
        let borderWidth = parseInt(getComputedStyle(this).borderWidth);

        this["#arrow"].setAttribute("data-align", resolvedAlign);

        if (resolvedAlign === "bottom") {
          this["#arrow"].style.top = (contextRect.top + contextRect.height + extraTop + arrowWhitespace + borderWidth) + "px";
          this["#arrow"].style.left = (contextRect.left + contextRect.width/2 + extraLeft) + "px";
        }

        else if (resolvedAlign === "top") {
          this["#arrow"].style.top = (contextRect.top +  extraTop - arrowWhitespace - borderWidth - arrowHeight) + "px";
          this["#arrow"].style.left = (contextRect.left + contextRect.width/2 + extraLeft) + "px";
        }

        else if (resolvedAlign === "left") {
          this["#arrow"].style.top = (contextRect.top + contextRect.height/2 + extraTop) + "px";
          this["#arrow"].style.left = (contextRect.left - arrowWidth - arrowWhitespace - borderWidth + extraLeft) + "px";
        }

        else if (resolvedAlign === "right") {
          this["#arrow"].style.top = (contextRect.top + contextRect.height/2 + extraTop) + "px";
          this["#arrow"].style.left = (contextRect.right + arrowWhitespace + borderWidth + extraLeft) + "px";
        }
      }

      // Animate the popover
      if (animate) {
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
  close(animate = true) {
    return new Promise(async (resolve) => {
      if (this.opened) {
        this.removeAttribute("opened");
        this["#backdrop"].hide();
        this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

        if (animate) {
          let transition = getComputedStyle(this).getPropertyValue("--close-transition");
          let [property, duration, easing] = this._parseTransistion(transition);

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
