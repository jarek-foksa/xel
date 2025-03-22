
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {closest} from "../utils/element.js";
import {parseTransistion} from "../utils/style.js";
import {html, css} from "../utils/template.js";
import {sleep, getTimeStamp} from "../utils/time.js";

let {abs} = Math;

const WINDOW_PADDING = 7;

// @element x-menu
// @event ^open - The menu was opened by the suer
// @event ^close - The menu was closed by the user
export default class XMenuElement extends HTMLElement {
  static observedAttributes = ["opened"];

  static #shadowTemplate = html`
    <template>
      <slot id="slot"></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: none;
      top: 0;
      left: 0;
      width: fit-content;
      padding: 4px 0;
      z-index: 1001;
      box-sizing: border-box;
      background: white;
      cursor: default;
      overflow: auto;
      flex-direction: column;
      -webkit-app-region: no-drag;
      --align: start;
      --scrollbar-background: rgba(0, 0, 0, 0.2);
      --scrollbar-width: 6px;
      --open-transition: none;
      --close-transition: none;
    }
    :host([opened]),
    :host([animating]) {
      display: flex;
    }
    :host(:focus) {
      outline: none;
    }
    :host-context([debug]):host(:focus) {
      outline: 2px solid red;
    }

    ::-webkit-scrollbar {
      max-width: var(--scrollbar-width);
      background: none;
    }
    ::-webkit-scrollbar-thumb {
      background-color: var(--scrollbar-background);
    }
    ::-webkit-scrollbar-corner {
      display: none
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @readOnly
  //
  // Whether the menu is shown on screen.
  get opened() {
    return this.hasAttribute("opened");
  }

  #shadowRoot = null;
  #delayPoints = [];
  #delayTimeoutID = null;
  #lastDelayPoint = null;
  #lastScrollTop = 0;
  #extraTop = 0;
  #expandWhenScrolled = false;
  #isPointerOverMenuBlock = false;
  #openedTimestamp = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XMenuElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XMenuElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("pointerover", (event) => this.#onPointerOver(event));
    this.addEventListener("pointerout", (event) => this.#onPointerOut(event));
    this.addEventListener("pointermove", (event) => this.#onPointerMove(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.addEventListener("wheel", (event) => this.#onWheel(event), {passive: false});
    this.addEventListener("scroll", (event) => this.#onScroll(event), {passive: true});
  }

  connectedCallback() {
    this.setAttribute("role", "menu");
    this.setAttribute("aria-hidden", !this.opened);
    this.setAttribute("tabindex", "0");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "opened") {
      this.#onOpenedAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type (HTMLElement, HTMLElement) => Promise
  //
  // Open the menu so that <em>overElement</em> (belonging to the menu) is positioned directly over
  // <em>underElement</em>.<br/>
  // Returns a promise that is resolved when the menu finishes animating.
  openOverElement(underElement, overElement) {
    return new Promise( async (resolve) => {
      let items = this.querySelectorAll(":scope > x-menuitem");

      if (items.length > 0) {
        this.#expandWhenScrolled = true;
        this.#openedTimestamp = getTimeStamp();
        this.#resetInlineStyles();
        this.setAttribute("opened", "");

        let menuItem = [...items].find((item) => item.contains(overElement)) || items[0];
        let menuBounds = this.getBoundingClientRect();
        let underElementBounds = underElement.getBoundingClientRect();
        let overElementBounds = overElement.getBoundingClientRect();

        let extraLeft = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)
        let extraTop = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)

        menuItem.focus();

        // Determine extraLeft and extraTop which represent the extra offset when the menu is inside another
        // fixed-positioned element such as a popover.
        {
          if (menuBounds.top !== 0 || menuBounds.left !== 0) {
            extraLeft = -menuBounds.left;
            extraTop = -menuBounds.top;
          }
        }

        // Position the menu so that the underElement is directly above the overLabel
        {
          this.style.left = (underElementBounds.x - (overElementBounds.x - menuBounds.x) + extraLeft) + "px";
          this.style.top = (underElementBounds.y - (overElementBounds.y - menuBounds.y) + extraTop) + "px";
          menuBounds = this.getBoundingClientRect();
        }

        // Move the menu right if it overflows the left client bound
        {
          if (menuBounds.left < WINDOW_PADDING) {
            this.style.left = (WINDOW_PADDING + extraLeft) + "px";
            menuBounds = this.getBoundingClientRect();
          }
        }

        // Reduce the menu height if it overflows the top client bound
        {
          let overflowTop = WINDOW_PADDING - menuBounds.top;

          if (overflowTop > 0) {
            this.style.height = (menuBounds.bottom - WINDOW_PADDING) + "px";
            this.style.top = (WINDOW_PADDING + extraTop) + "px";
            this.scrollTop = 9999;
            menuBounds = this.getBoundingClientRect();
          }
        }

        // Reduce menu height if it overflows the bottom client bound
        // Reduce menu width if it overflows the right client bound
        {
          if (menuBounds.bottom + WINDOW_PADDING > window.innerHeight) {
            let overflow = menuBounds.bottom - window.innerHeight;
            let height = menuBounds.height - overflow - WINDOW_PADDING;
            this.style.height = height + "px";
          }

          if (menuBounds.right + WINDOW_PADDING > window.innerWidth) {
            let overflow = menuBounds.right - window.innerWidth;
            let width = menuBounds.width - overflow - WINDOW_PADDING;
            this.style.width = `${width}px`;
          }
        }

        // Animate the menu block
        {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = parseTransistion(transition);

          if (property === "transform") {
            let blockBounds = this.getBoundingClientRect();
            let originY = underElementBounds.y + underElementBounds.height/2 - blockBounds.top;

            await this.animate(
              {
                transform: ["scaleY(0)", "scaleY(1)"],
                transformOrigin: [`0 ${originY}px`, `0 ${originY}px`]
              },
              { duration, easing }
            ).finished;
          }
        }

        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
        this.#extraTop = extraTop;
      }

      resolve();
    });
  }

  // @method
  // @type (XLabelElement) => Promise
  //
  // Open the menu over the given <em>underLabel</em> element.<br/>
  // Returns a promise that is resolved when the menu finishes animating.
  openOverLabel(underLabel) {
    return new Promise( async (resolve) => {
      let items = this.querySelectorAll(":scope > x-menuitem");

      if (items.length > 0) {
        this.#resetInlineStyles();
        this.setAttribute("opened", "");
        this.#expandWhenScrolled = true;
        this.#openedTimestamp = getTimeStamp();

        let item = [...items].find((item) => {
          let itemLabel = item.querySelector("x-label");
          return (itemLabel && itemLabel.textContent === underLabel.textContent) ? true : false;
        });

        if (!item) {
          item = items[0];
        }

        let overLabel = item.querySelector("x-label");
        await this.openOverElement(underLabel, overLabel);
      }

      resolve();
    });
  }

  // @method
  // @type (HTMLElement, "horizontal" || "vertical", number) => Promise
  //
  // Open the menu next the given element.<br/>
  // Returns a promise that is resolved when the menu finishes animating.
  openNextToElement(element, direction = "horizontal", elementWhitespace = 0) {
    return new Promise(async (resolve) => {
      this.#expandWhenScrolled = false;
      this.#openedTimestamp = getTimeStamp();

      this.#resetInlineStyles();
      this.setAttribute("opened", "");
      this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

      if (element.localName === "x-menuitem") {
        element.setAttribute("expanded", "");
      }

      let align = getComputedStyle(this).getPropertyValue("--align").trim();
      let elementBounds = element.getBoundingClientRect();
      let menuBounds = this.getBoundingClientRect();
      let extraLeft = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)
      let extraTop = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)

      // Determine extraLeft and extraTop which represent the extra offset when the menu is inside another
      // fixed-positioned element such as a popover.
      {
        if (menuBounds.top !== 0 || menuBounds.left !== 0) {
          extraLeft = -menuBounds.left;
          extraTop = -menuBounds.top;
        }
      }

      if (direction === "horizontal") {
        this.style.top = (elementBounds.top + extraTop) + "px";
        this.style.left = (elementBounds.left + elementBounds.width + elementWhitespace + extraLeft) + "px";

        let side = "right";

        // Reduce menu size if it does not fit on screen
        {
          let menuBounds = this.getBoundingClientRect();

          if (menuBounds.width > window.innerWidth - 10) {
            this.style.width = (window.innerWidth - 10) + "px";
          }

          if (menuBounds.height > window.innerHeight - 10) {
            this.style.height = (window.innerHeight - 10) + "px";
          }
        }

        // Move the menu horizontally if it overflows the right screen edge
        {
          let menuBounds = this.getBoundingClientRect();

          if (menuBounds.left + menuBounds.width + WINDOW_PADDING > window.innerWidth) {
            // Move menu to the left side of the element if there is enough space to fit it in
            if (elementBounds.left > menuBounds.width + WINDOW_PADDING) {
              this.style.left = (elementBounds.left - menuBounds.width + extraLeft) + "px";
              side = "left";
            }
            // ... otherwise move menu to the screen edge
            else {
              // Move menu to the left screen edge
              if (elementBounds.left > window.innerWidth - (elementBounds.left + elementBounds.width)) {
                this.style.left = (WINDOW_PADDING + extraLeft) + "px";
                side = "left";
              }
              // Move menu to the right screen edge
              else {
                this.style.left = (window.innerWidth - menuBounds.width - WINDOW_PADDING + extraLeft) + "px";
                side = "right";
              }
            }
          }
        }

        // Move the menu vertically it overflows the bottom screen edge
        {
          let menuBounds = this.getBoundingClientRect();

          if (menuBounds.top + menuBounds.height + WINDOW_PADDING > window.innerHeight) {
            let bottomOverflow = (menuBounds.top + menuBounds.height + WINDOW_PADDING) - window.innerHeight;
            this.style.top = (menuBounds.top - bottomOverflow + extraTop) + "px";
          }
        }

        // Animate the menu
        {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = parseTransistion(transition);

          if (property === "transform") {
            await this.animate(
              {
                transform: ["scale(0, 0)", "scale(1, 1)"],
                transformOrigin: [side === "left" ? "100% 0" : "0 0", side === "left" ? "100% 0" : "0 0"]
              },
              { duration, easing }
            ).finished;
          }
        }
      }

      else if (direction === "vertical") {
        this.style.top = (elementBounds.top + elementBounds.height + elementWhitespace + extraTop) + "px";
        this.style.left = "0px";

        let side = "bottom";

        // Reduce menu size if it does not fit on screen
        {
          let menuBounds = this.getBoundingClientRect();

          if (menuBounds.width > window.innerWidth - 10) {
            this.style.width = (window.innerWidth - 10) + "px";
          }

          if (menuBounds.height > window.innerHeight - 10) {
            this.style.height = (window.innerHeight - 10) + "px";
          }
        }

        if (element.parentElement && element.parentElement.localName === "x-menubar") {
          let menuBounds = this.getBoundingClientRect();

          // Reduce menu height if it overflows bottom screen edge
          if (menuBounds.top + menuBounds.height + WINDOW_PADDING > window.innerHeight) {
            this.style.height = (window.innerHeight - (elementBounds.top + elementBounds.height) - 10) + "px";
          }
        }
        else {
          // Move the menu vertically if it overflows the bottom screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top + menuBounds.height + WINDOW_PADDING > window.innerHeight) {
              // Move menu to the top side of the element if there is enough space to fit it in
              if (elementBounds.top > menuBounds.height + WINDOW_PADDING) {
                this.style.top = (elementBounds.top - menuBounds.height - elementWhitespace + extraTop) + "px";
                side = "top";
              }
              // ... otherwise move menu to the screen edge
              else {
                // Move menu to the top screen edge
                if (elementBounds.top > window.innerHeight - (elementBounds.top + elementBounds.height)) {
                  this.style.top = (WINDOW_PADDING + extraTop) + "px";
                  side = "top";
                }
                // Move menu to the bottom screen edge
                else {
                  this.style.top = (window.innerHeight - menuBounds.height - WINDOW_PADDING + extraTop) + "px";
                  side = "bottom";
                }
              }
            }
          }
        }

        if (align === "start") {
          this.style.left = (elementBounds.left + extraLeft) + "px";

          // Float the menu to the right element edge if the menu overflows right screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left + menuBounds.width + WINDOW_PADDING > window.innerWidth) {
              this.style.left = (elementBounds.left + elementBounds.width - menuBounds.width + extraLeft) + "px";
            }
          }

          // Float the menu to the left screen edge if it overflows the left screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left < WINDOW_PADDING) {
              this.style.left = (WINDOW_PADDING + extraLeft) + "px";
            }
          }
        }
        else if (align === "end") {
          this.style.left = (elementBounds.left + elementBounds.width - menuBounds.width + extraLeft) + "px";

          // Float the menu to the left element edge if the menu overflows left screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left < WINDOW_PADDING) {
              this.style.left = (elementBounds.left + extraLeft) + "px";
            }
          }

          // Float the menu to the right screen edge if it overflows the right screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left + menuBounds.width + WINDOW_PADDING > window.innerWidth) {
              this.style.left = (window.innerWidth - WINDOW_PADDING + extraLeft) + "px";
            }
          }
        }

        // Animate the menu
        {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = parseTransistion(transition);

          if (property === "transform") {
            await this.animate(
              {
                transform: ["scale(1, 0)", "scale(1, 1)"],
                transformOrigin: [side === "top" ? "0 100%" : "0 0", side === "top" ? "0 100%" : "0 0"]
              },
              { duration, easing }
            ).finished;
          }
        }
      }

      this.#extraTop = extraTop;
      resolve();
    });
  }

  // @method
  // @type (number, number) => Promise
  //
  // Open the menu at given client point.<br/>
  // Returns a promise that is resolved when the menu finishes animating.
  openAtPoint(left, top) {
    return new Promise( async (resolve) => {
      this.#expandWhenScrolled = false;
      this.#openedTimestamp = getTimeStamp();

      this.#resetInlineStyles();
      this.setAttribute("opened", "");
      this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

      let extraLeft = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)
      let extraTop = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)

      // Menu might contain translatable messages which are fetched asynchronously. In order to get the correct
      // menu bounds we have to wait until the messages are ready.
      let messageElements = [...this.querySelectorAll(":scope > x-menuitem > x-label > x-message")];
      await Promise.all(messageElements.map($0 => $0.whenReady));

      let menuBounds = this.getBoundingClientRect();

      // Determine extraLeft and extraTop which represent the extra offset when the menu is inside another
      // fixed-positioned element such as a popover.
      {
        if (menuBounds.top !== 0 || menuBounds.left !== 0) {
          extraLeft = -menuBounds.left;
          extraTop = -menuBounds.top;
        }
      }

      // Position the menu at given point
      {
        this.style.left = (left + extraLeft) + "px";
        this.style.top = (top + extraTop) + "px";
        menuBounds = this.getBoundingClientRect();
      }

      // If menu overflows right screen border then move it to the opposite side
      if (menuBounds.right + WINDOW_PADDING > window.innerWidth) {
        left = left - menuBounds.width;
        this.style.left = (left + extraLeft) + "px";
        menuBounds = this.getBoundingClientRect();
      }

      // If menu overflows bottom screen border then move it up
      if (menuBounds.bottom + WINDOW_PADDING > window.innerHeight) {
        top = top + window.innerHeight - (menuBounds.top + menuBounds.height) - WINDOW_PADDING;
        this.style.top = (top + extraTop) + "px";
        menuBounds = this.getBoundingClientRect();

        // If menu now overflows top screen border then make it stretch to the whole available vertical space

        if (menuBounds.top < WINDOW_PADDING) {
          top = WINDOW_PADDING;
          this.style.top = (top + extraTop) + "px";
          this.style.height = (window.innerHeight - WINDOW_PADDING - WINDOW_PADDING) + "px";
        }
      }

      // Animate the menu
      {
        let transition = getComputedStyle(this).getPropertyValue("--open-transition");
        let [property, duration, easing] = parseTransistion(transition);

        if (property === "transform") {
          await this.animate(
            {
              transform: ["scale(0)", "scale(1)"],
              transformOrigin: ["0 0", "0 0"]
            },
            {
              duration: 80,
              easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
            }
          ).finished;
        }
      }

      this.#extraTop = extraTop;
      resolve();
    });
  }

  // @method
  // @type (boolean) => Promise
  //
  // Close the menu.<br/>
  // Returns a promise that is resolved when the menu finishes animating.
  close(animate = true) {
    return new Promise(async (resolve) => {
      if (this.opened) {
        this.removeAttribute("opened");
        this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

        let item = this.closest("x-menuitem");

        if (item) {
          item.removeAttribute("expanded");
        }

        if (animate) {
          this.setAttribute("animating", "");

          let transition = getComputedStyle(this).getPropertyValue("--close-transition");
          let [property, duration, easing] = parseTransistion(transition);

          if (property === "opacity") {
            await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
          }

          this.removeAttribute("animating");
        }

        for (let item of this.querySelectorAll(":scope > x-menuitem")) {
          let submenu = item.querySelector("x-menu[opened]");

          if (submenu) {
            submenu.close();
          }
        }
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type () => void
  focusNextMenuItem() {
    let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

    if (refItem) {
      let nextItem = null;

      for (let item = refItem.nextElementSibling; item; item = item.nextElementSibling) {
        if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
          nextItem = item;
          break;
        }
      }

      if (nextItem === null && refItem.parentElement != null) {
        for (let item of refItem.parentElement.children) {
          if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
            nextItem = item;
            break;
          }
        }
      }

      if (nextItem) {
        nextItem.focus();

        let menu = refItem.querySelector("x-menu");

        if (menu) {
          menu.close();
        }
      }
    }
    else {
      this.focusFirstMenuItem();
    }
  }

  // @method
  // @type () => void
  focusPreviousMenuItem() {
    let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

    if (refItem) {
      let previousItem = null;

      for (let item = refItem.previousElementSibling; item; item = item.previousElementSibling) {
        if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
          previousItem = item;
          break;
        }
      }

      if (previousItem === null && refItem.parentElement != null) {
        for (let item of [...refItem.parentElement.children].reverse()) {
          if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
            previousItem = item;
            break;
          }
        }
      }

      if (previousItem) {
        previousItem.focus();

        let menu = refItem.querySelector("x-menu");

        if (menu) {
          menu.close();
        }
      }
    }
    else {
      this.focusLastMenuItem();
    }
  }

  // @method
  // @type () => void
  focusFirstMenuItem() {
    let items = this.querySelectorAll("x-menuitem:not([disabled]):not([hidden])");
    let firstItem = items[0] || null;

    if (firstItem) {
      firstItem.focus();
    }
  }

  // @method
  // @type () => void
  focusLastMenuItem() {
    let items = this.querySelectorAll("x-menuitem:not([disabled]):not([hidden])");
    let lastItem = (items.length > 0) ? items[items.length-1] : null;

    if (lastItem) {
      lastItem.focus();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @doc
  //   http://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown
  #delay(callback) {
    let tolerance = 75;
    let fullDelay = 300;
    let delay = 0;
    let direction = "right";

    {
      let point = this.#delayPoints[this.#delayPoints.length - 1];
      let prevPoint = this.#delayPoints[0];
      let openedSubmenu = this.querySelector("x-menu[opened]");

      if (openedSubmenu && point) {
        if (!prevPoint) {
          prevPoint = point;
        }

        let bounds = this.getBoundingClientRect();

        let upperLeftPoint  = {x: bounds.left, y: bounds.top - tolerance };
        let upperRightPoint = {x: bounds.left + bounds.width, y: upperLeftPoint.y };
        let lowerLeftPoint  = {x: bounds.left, y: bounds.top + bounds.height + tolerance};
        let lowerRightPoint = {x: bounds.left + bounds.width, y: lowerLeftPoint.y };

        let proceed = true;

        if (
          prevPoint.x < bounds.left || prevPoint.x > lowerRightPoint.x ||
          prevPoint.y < bounds.top  || prevPoint.y > lowerRightPoint.y
        ) {
          proceed = false;
        }

        if (
          this.#lastDelayPoint &&
          point.x === this.#lastDelayPoint.x &&
          point.y === this.#lastDelayPoint.y
        ) {
          proceed = false;
        }

        if (proceed) {
          let decreasingCorner;
          let increasingCorner;

          if (direction === "right") {
            decreasingCorner = upperRightPoint;
            increasingCorner = lowerRightPoint;
          }
          else if (direction === "left") {
            decreasingCorner = lowerLeftPoint;
            increasingCorner = upperLeftPoint;
          }
          else if (direction === "below") {
            decreasingCorner = lowerRightPoint;
            increasingCorner = lowerLeftPoint;
          }
          else if (direction === "above") {
            decreasingCorner = upperLeftPoint;
            increasingCorner = upperRightPoint;
          }

          let getSlope = (a, b) => (b.y - a.y) / (b.x - a.x);
          let decreasingSlope = getSlope(point, decreasingCorner);
          let increasingSlope = getSlope(point, increasingCorner);
          let prevDecreasingSlope = getSlope(prevPoint, decreasingCorner);
          let prevIncreasingSlope = getSlope(prevPoint, increasingCorner);

          if (decreasingSlope < prevDecreasingSlope && increasingSlope > prevIncreasingSlope) {
            this.#lastDelayPoint = point;
            delay = fullDelay;
          }
          else {
            this.#lastDelayPoint = null;
          }
        }
      }
    }

    if (delay > 0) {
      this.#delayTimeoutID = setTimeout(() => {
        this.#delay(callback);
      }, delay);
    }
    else {
      callback();
    }
  }

  #clearDelay() {
    if (this.#delayTimeoutID) {
      clearTimeout(this.#delayTimeoutID);
      this.#delayTimeoutID = null;
    }
  }

  #resetInlineStyles() {
    this.style.position = "fixed";
    this.style.top = "0px";
    this.style.left = "0px";
    this.style.width = null;
    this.style.height = null;
    this.style.minWidth = null;
    this.style.maxWidth = null;
  }

  // @type () => boolean
  //
  // Whether this or any ancestor menu is closing
  #isClosing() {
    return this.matches("*[closing], *[closing] x-menu");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onOpenedAttributeChange() {
    this.setAttribute("aria-hidden", !this.opened);
  }

  #onPointerDown(event) {
    if (event.target === this || event.target.localName === "hr") {
      event.stopPropagation();
    }

    if (event.pointerType === "touch" && event.target.closest("x-menu") === this) {
      if (this.#isPointerOverMenuBlock === false) {
        this.#onMenuBlockPointerEnter();
      }

      // Focus and expand the menu item under pointer and collapse other items
      {
        let item = event.target.closest("x-menuitem");

        if (item && item.disabled === false && item.closest("x-menu") === this) {
          if (item.matches(":focus") === false) {
            this.#delay( async () => {
              let otherItem = this.querySelector(":scope > x-menuitem:focus");

              if (otherItem) {
                let otherSubmenu = otherItem.querySelector("x-menu");

                if (otherSubmenu) {
                  otherSubmenu.close();
                }
              }


              let menu = item.closest("x-menu");
              let submenu = item.querySelector("x-menu");
              let otherItems = [...this.querySelectorAll(":scope > x-menuitem")].filter($0 => $0 !== item);

              if (submenu) {
                if (submenu.opened === false) {
                  submenu.openNextToElement(item, "horizontal");
                }
              }

              for (let otherItem of otherItems) {
                let otherSubmenu = otherItem.querySelector("x-menu");

                if (otherSubmenu) {
                  otherSubmenu.close();
                }
              }
            })
          }
        }
        else {
          this.#delay(() => {
            this.focus();
          });
        }
      }
    }
  }

  #onPointerOver(event) {
    if (this.#isClosing() || event.pointerType === "touch") {
      return;
    }

    if (event.target.closest("x-menu") === this) {
      if (this.#isPointerOverMenuBlock === false) {
        this.#onMenuBlockPointerEnter();
      }

      // Focus and expand the menu item under pointer and collapse other items
      {
        let item = event.target.closest("x-menuitem");

        if (item && item.disabled === false && item.closest("x-menu") === this) {
          if (item.matches(":focus") === false) {
            this.#delay( async () => {
              let otherItem = this.querySelector(":scope > x-menuitem:focus");

              if (otherItem) {
                let otherSubmenu = otherItem.querySelector("x-menu");

                if (otherSubmenu) {
                  otherSubmenu.close();
                }
              }

              item.focus();

              let menu = item.closest("x-menu");
              let submenu = item.querySelector("x-menu");
              let otherItems = [...this.querySelectorAll(":scope > x-menuitem")].filter($0 => $0 !== item);

              if (submenu) {
                await sleep(60);

                if (item.matches(":focus") && submenu.opened === false) {
                  submenu.openNextToElement(item, "horizontal");
                }
              }

              for (let otherItem of otherItems) {
                let otherSubmenu = otherItem.querySelector("x-menu");

                if (otherSubmenu) {
                  otherSubmenu.close();
                }
              }
            })
          }
        }
        else {
          this.#delay(() => {
            this.focus();
          });
        }
      }
    }
  }

  #onPointerOut(event) {
    // @bug: event.relatedTarget leaks shadowDOM, so we have to use closest() utility function
    if (!event.relatedTarget || closest(event.relatedTarget, "x-menu") !== this) {
      if (this.#isPointerOverMenuBlock === true) {
        this.#onMenuBlockPointerLeave();
      }
    }
  }

  #onMenuBlockPointerEnter() {
    if (this.#isClosing()) {
      return;
    }

    this.#isPointerOverMenuBlock = true;
    this.#clearDelay();
  }

  #onMenuBlockPointerLeave() {
    if (this.#isClosing()) {
      return;
    }

    this.#isPointerOverMenuBlock = false;
    this.#clearDelay();
    this.focus();
  }

  #onPointerMove(event) {
    this.#delayPoints.push({
      x: event.clientX,
      y: event.clientY
    });

    if (this.#delayPoints.length > 3) {
      this.#delayPoints.shift();
    }
  }

  #onWheel(event) {
    if (event.target.closest("x-menu") === this) {
      // @bugfix: Can't rely on the default wheel event behavior as it messes up the #onScroll handler on Windows.
      // For details check https://github.com/jarek-foksa/xel/issues/75
      {
        event.preventDefault();
        this.scrollTop = this.scrollTop + event.deltaY;
      }

      this.#isPointerOverMenuBlock = true;
    }
    else {
      this.#isPointerOverMenuBlock = false;
    }
  }

  #onScroll() {
    if (this.#expandWhenScrolled) {
      let delta = this.scrollTop - this.#lastScrollTop;
      this.#lastScrollTop = this.scrollTop;

      if (getTimeStamp() - this.#openedTimestamp > 100) {
        let menuRect = this.getBoundingClientRect();

        if (delta < 0) {
          if (menuRect.bottom + abs(delta) <= window.innerHeight - WINDOW_PADDING) {
            this.style.height = (menuRect.height + abs(delta)) + "px";
          }
          else {
            this.style.height = (window.innerHeight - (WINDOW_PADDING*2)) + "px";
          }
        }
        else if (delta > 0) {
          if (menuRect.top - delta >= WINDOW_PADDING) {
            this.style.top = (this.#extraTop + menuRect.top - delta) + "px";
            this.style.height = (menuRect.height + delta) + "px";

            this.scrollTop = 0;
            this.#lastScrollTop = 0;
          }
          else {
            this.style.top = (WINDOW_PADDING + this.#extraTop) + "px";
            this.style.height = (window.innerHeight - (WINDOW_PADDING*2)) + "px";
          }
        }
      }
    }
  }

  #onKeyDown(event) {
    if (this.#isClosing()) {
      event.preventDefault();
      event.stopPropagation();
    }

    else if (event.code === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      this.focusPreviousMenuItem();
    }

    else if (event.code === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      this.focusNextMenuItem();
    }

    else if (
      event.code === "ArrowRight" ||
      event.code === "Enter" ||
      event.code === "NumpadEnter" ||
      event.code === "Space"
    ) {
      let focusedItem = this.querySelector("x-menuitem:focus");

      if (focusedItem) {
        let submenu = focusedItem.querySelector("x-menu");

        if (submenu) {
          event.preventDefault();
          event.stopPropagation();

          if (submenu.opened === false) {
            submenu.openNextToElement(focusedItem, "horizontal");
          }

          let submenuFirstItem = submenu.querySelector("x-menuitem:not([disabled]):not([hidden])");

          if (submenuFirstItem) {
            submenuFirstItem.focus();
          }
        }
      }
    }

    else if (event.code === "ArrowLeft") {
      let focusedItem = this.querySelector("x-menuitem:focus");

      if (focusedItem) {
        let parentMenu = focusedItem.closest("x-menu");
        let parentItem = parentMenu.closest("x-menuitem");

        if (parentItem && parentItem.closest("x-menu")) {
          event.preventDefault();
          event.stopPropagation();

          parentItem.focus();
          this.close();
        }
      }
    }
  }
}

customElements.define("x-menu", XMenuElement);
