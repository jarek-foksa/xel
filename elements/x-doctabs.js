
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {getDistanceBetweenPoints} from "../utils/math.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {abs} = Math;
let {parseInt} = Number;

// @element x-doctabs
// @part open-button
// @event open
// @event close
// @event select
// @event rearrange
export default class XDocTabsElement extends HTMLElement {
  static observedAttributes = ["size"];

  static _shadowTemplate = html`
    <template>
      <slot></slot>

      <svg id="open-button" part="open-button" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="open-button-path"></path>
      </svg>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: flex;
      align-items: center;
      width: 100%;
      height: 32px;
      position: relative;
    }
    :host(:focus) {
      outline: none;
    }
    :host([disabled]) {
      opacity: 0.5;
      pointer-events: none;
    }

    #open-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin: 0 4px;
      order: 9999;
      color: inherit;
      d: path("M 79 54 L 54 54 L 54 79 L 46 79 L 46 54 L 21 54 L 21 46 L 46 46 L 46 21 L 54 21 L 54 46 L 79 46 L 79 54 Z");
      -webkit-app-region: no-drag;
    }

    #open-button-path {
      d: inherit;
      fill: currentColor;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled === true ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @property
  // @attribute
  // @type number
  // @default 20
  //
  // Maximal number of tambs that can be opened.
  get maxTabs() {
    return this.hasAttribute("maxtabs") ? parseInt(this.getAttribute("maxtabs")) : 20;
  }
  set maxTabs(maxTabs) {
    this.setAttribute("maxtabs", maxTabs);
  }

  // @property
  // @attribute
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property readOnly
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  _shadowRoot = null;
  _elements = {};
  _xelSizeChangeListener = null;

  _waitingForTabToClose = false;
  _waitingForPointerMoveAfterClosingTab = false;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: false});
    this._shadowRoot.adoptedStyleSheets = [XDocTabsElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XDocTabsElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
    this._elements["open-button"].addEventListener("click", (event) => this._onOpenButtonClick(event));
  }

  connectedCallback() {
    this._updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "size") {
      this._updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateComputedSizeAttriubte() {
    let defaultSize = Xel.size;
    let customSize = this.size;
    let computedSize = "medium";

    if (customSize === null) {
      computedSize = defaultSize;
    }
    else if (customSize === "smaller") {
      computedSize = (defaultSize === "large") ? "medium" : "small";
    }
    else if (customSize === "larger") {
      computedSize = (defaultSize === "small") ? "medium" : "large";
    }
    else {
      computedSize = customSize;
    }

    if (computedSize === "medium") {
      this.removeAttribute("computedsize");
    }
    else {
      this.setAttribute("computedsize", computedSize);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type (XDocTabElement, boolean) => Promise
  openTab(tab, animate = true) {
    return new Promise( async (resolve, reject) => {
      let tabs = this.querySelectorAll("x-doctab");

      if (tabs.length >= this.maxTabs) {
        reject(`Can't open more than ${this.maxTabs} tabs.`);
      }
      else {
        let maxOrder = 0;

        for (let tab of this.children) {
          let order = parseInt(tab.style.order);

          if (!Number.isNaN(order) && order > maxOrder) {
            maxOrder = order;
          }
        }
        tab.style.order = maxOrder;

        if (animate === false) {
          tab.style.transition = "none";
          tab.style.maxWidth = null;
          tab.style.padding = null;

          this.append(tab);
          resolve(tab);
        }
        else if (animate === true) {
          tab.style.transition = null;
          tab.style.maxWidth = "0px";
          tab.style.padding = "0px";

          tab.setAttribute("opening", "");
          this.append(tab);
          await sleep(30);

          tab.addEventListener("transitionend", () => {
            tab.removeAttribute("opening");
            resolve(tab);
          }, {once: true});

          tab.style.maxWidth = null;
          tab.style.padding = null;
        }
      }
    });
  }

  // @method
  // @type (XDocTabElement, boolean) => Promise
  closeTab(tab, animate = true) {
    return new Promise( async (resolve) => {
      let tabs = this.getTabsByScreenIndex().filter(tab => tab.hasAttribute("closing") === false);
      let tabWidth = tab.getBoundingClientRect().width;
      let tabScreenIndex = this._getTabScreenIndex(tab)

      tab.setAttribute("closing", "");

      if (tabScreenIndex < tabs.length - 1) {
        for (let tab of this.children) {
          if (tab.hasAttribute("closing") === false) {
            tab.style.transition = "none";
            tab.style.maxWidth = tabWidth + "px";
          }
        }
      }

      if (animate) {
        tab.style.transition = null;
      }
      else {
        tab.style.transition = "none";
      }

      tab.style.maxWidth = "0px";
      tab.style.pointerEvents = "none";

      this._waitingForTabToClose = true;

      if (tab.selected) {
        let previousTab = tabs[tabs.indexOf(tab) - 1];
        let nextTab = tabs[tabs.indexOf(tab) + 1];

        tab.selected = false;

        if (nextTab) {
          nextTab.selected = true;
        }
        else if (previousTab) {
          previousTab.selected = true;
        }
      }

      if (tab.matches(":focus")) {
        let selectedTab = this.querySelector("x-doctab[selected]");

        if (selectedTab) {
          selectedTab.focus();
        }
        else {
          this.focus();
        }
      }

      tab.style.maxWidth = "0px";
      tab.style.padding = "0px";

      if (animate) {
        await sleep(150);
      }

      tab.remove();
      this._waitingForTabToClose = false;
      tab.removeAttribute("closing");

      resolve();

      if (!this._waitingForPointerMoveAfterClosingTab) {
        this._waitingForPointerMoveAfterClosingTab = true;
        await this._whenPointerMoved(3);
        this._waitingForPointerMoveAfterClosingTab = false;

        for (let tab of this.children) {
          tab.style.transition = null;
          tab.style.maxWidth = null;
          tab.style.order = this._getTabScreenIndex(tab);
        }
      }
    });
  }

  // @method
  // @type () => void
  selectPreviousTab() {
    let tabs = this.getTabsByScreenIndex();
    let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab");
    let previousTab = this._getPreviousTabOnScreen(currentTab);

    if (currentTab && previousTab) {
      this.selectTab(previousTab);

      return previousTab;
    }

    return null;
  }

  // @method
  // @type () => void
  selectNextTab() {
    let tabs = this.getTabsByScreenIndex();
    let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab:last-of-type");
    let nextTab = this._getNextTabOnScreen(currentTab);

    if (currentTab && nextTab) {
      this.selectTab(nextTab);

      return nextTab;
    }

    return null;
  }

  // @method
  // @type (XDocTabElement) => void
  selectTab(nextTab) {
    let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab:last-of-type");

    if (currentTab) {
      currentTab.tabIndex = -1;
      currentTab.selected = false;
    }

    nextTab.tabIndex = 0;
    nextTab.selected = true;
  }

  // @method
  // @type () => void
  moveSelectedTabLeft() {
    let selectedTab = this.querySelector("x-doctab[selected]");
    let selectedTabScreenIndex = this._getTabScreenIndex(selectedTab);

    for (let tab of this.children) {
      tab.style.order = this._getTabScreenIndex(tab);
    }

    if (parseInt(selectedTab.style.order) === 0) {
      for (let tab of this.children) {
        if (tab === selectedTab) {
          tab.style.order = this.childElementCount - 1;
        }
        else {
          tab.style.order = parseInt(tab.style.order) - 1;
        }
      }
    }
    else {
      let otherTab = this._getTabWithScreenIndex(selectedTabScreenIndex - 1);
      otherTab.style.order = parseInt(otherTab.style.order) + 1;
      selectedTab.style.order = parseInt(selectedTab.style.order) - 1;
    }
  }

  // @method
  // @type () => void
  moveSelectedTabRight() {
    let selectedTab = this.querySelector("x-doctab[selected]");
    let selectedTabScreenIndex = this._getTabScreenIndex(selectedTab);

    for (let tab of this.children) {
      tab.style.order = this._getTabScreenIndex(tab);
    }

    if (parseInt(selectedTab.style.order) === this.childElementCount - 1) {
      for (let tab of this.children) {
        if (tab === selectedTab) {
          tab.style.order = 0;
        }
        else {
          tab.style.order = parseInt(tab.style.order) + 1;
        }
      }
    }
    else {
      let otherTab = this._getTabWithScreenIndex(selectedTabScreenIndex + 1);
      otherTab.style.order = parseInt(otherTab.style.order) - 1;
      selectedTab.style.order = parseInt(selectedTab.style.order) + 1;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type (number) => Promise
  //
  // Returns a promise that is resolved when the pointer is moved by at least the given distance.
  _whenPointerMoved(distance = 3) {
    return new Promise((resolve) => {
      let pointerMoveListener, pointerOutListener, blurListener;
      let fromPoint = null;

      let removeListeners = () => {
        window.removeEventListener("pointermove", pointerMoveListener);
        window.removeEventListener("pointerout", pointerOutListener);
        window.removeEventListener("blur", blurListener);
      };

      window.addEventListener("pointermove", pointerMoveListener = (event) => {
        if (fromPoint === null) {
          fromPoint = {x: event.clientX, y: event.clientY};
        }
        else {
          let toPoint = {x: event.clientX, y: event.clientY};

          if (getDistanceBetweenPoints(fromPoint, toPoint) >= distance) {
            removeListeners();
            resolve();
          }
        }
      });

      window.addEventListener("pointerout", pointerOutListener = (event) => {
        if (event.toElement === null) {
          removeListeners();
          resolve();
        }
      });

      window.addEventListener("blur", blurListener = () => {
        removeListeners();
        resolve();
      });
    });
  }

  getTabsByScreenIndex() {
    let $screenIndex = Symbol();

    for (let tab of this.children) {
      tab[$screenIndex] = this._getTabScreenIndex(tab);
    }

    return [...this.children].sort((tab1, tab2) => tab1[$screenIndex] > tab2[$screenIndex]);
  }

  _getTabScreenIndex(tab) {
    let tabBounds = tab.getBoundingClientRect();
    let tabsBounds = this.getBoundingClientRect();

    if (tabBounds.left - tabsBounds.left < tabBounds.width / 2) {
      return 0;
    }
    else {
      let offset = (tabBounds.width / 2);

      for (let i = 1; i < this.maxTabs; i += 1) {
        if (tabBounds.left - tabsBounds.left >= offset &&
            tabBounds.left - tabsBounds.left < offset + tabBounds.width) {
          if (i > this.childElementCount - 1) {
            return this.childElementCount - 1;
          }
          else {
            return i;
          }
        }
        else {
          offset += tabBounds.width;
        }
      }
    }
  }

  _getTabWithScreenIndex(screenIndex) {
    for (let tab of this.children) {
      if (this._getTabScreenIndex(tab) === screenIndex) {
        return tab;
      }
    }

    return null;
  }

  _getPreviousTabOnScreen(tab, skipDisabled = true, wrapAround = true) {
    let tabs = this.getTabsByScreenIndex();
    let tabScreenIndex = tabs.indexOf(tab);
    let previousTab = null;

    for (let i = tabScreenIndex - 1; i >= 0; i -= 1) {
      let tab = tabs[i];

      if (skipDisabled && tab.disabled) {
        continue;
      }
      else {
        previousTab = tab;
        break;
      }
    }

    if (wrapAround) {
      if (previousTab === null) {
        for (let i = tabs.length - 1; i > tabScreenIndex; i -= 1) {
          let tab = tabs[i];

          if (skipDisabled && tab.disabled) {
            continue;
          }
          else {
            previousTab = tab;
            break;
          }
        }
      }
    }

    return previousTab;
  }

  _getNextTabOnScreen(tab, skipDisabled = true, wrapAround = true) {
    let tabs = this.getTabsByScreenIndex();
    let tabScreenIndex = tabs.indexOf(tab);
    let nextTab = null;

    for (let i = tabScreenIndex + 1; i < tabs.length; i += 1) {
      let tab = tabs[i];

      if (skipDisabled && tab.disabled) {
        continue;
      }
      else {
        nextTab = tab;
        break;
      }
    }

    if (wrapAround) {
      if (nextTab === null) {
        for (let i = 0; i < tabScreenIndex; i += 1) {
          let tab = tabs[i];

          if (skipDisabled && tab.disabled) {
            continue;
          }
          else {
            nextTab = tab;
            break;
          }
        }
      }
    }

    return nextTab;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onPointerDown(event) {
    if (event.buttons === 1 && !this._waitingForTabToClose && event.target.closest("x-doctab")) {
      this._onTabPointerDown(event);
    }
  }

  async _onTabPointerDown(pointerDownEvent) {
    if (pointerDownEvent.isPrimary === false) {
      return;
    }

    let pointerMoveListener, lostPointerCaptureListener;
    let pointerDownTab = pointerDownEvent.target.closest("x-doctab");
    let selectedTab = this.querySelector("x-doctab[selected]");

    if (selectedTab !== pointerDownTab) {
      if (selectedTab) {
        selectedTab.animateSelectionIndicator(pointerDownTab).then(() => {
          this.selectTab(pointerDownTab);
          this.dispatchEvent(new CustomEvent("select", {detail: pointerDownTab}));
        });
      }
      else {
        this.selectTab(pointerDownTab);
        this.dispatchEvent(new CustomEvent("select", {detail: pointerDownTab}));
      }
    }

    this.setPointerCapture(pointerDownEvent.pointerId);

    let pointerDownPoint = new DOMPoint(pointerDownEvent.clientX, pointerDownEvent.clientY);
    let prevPointerMovePoint = pointerDownPoint;

    this.addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      let pointerMovePoint = new DOMPoint(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
      let deltaTime = pointerMoveEvent.timeStamp - pointerDownEvent.timeStamp;
      let isIntentional = (getDistanceBetweenPoints(pointerDownPoint, pointerMovePoint) > 3 || deltaTime > 80);

      if (pointerMoveEvent.isPrimary && isIntentional) {
        this.removeEventListener("pointermove", pointerMoveListener);
        this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

        this._onTabDragStart(pointerDownEvent, pointerDownTab);
      }
    });

    this.addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
      this.removeEventListener("pointermove", pointerMoveListener);
      this.removeEventListener("lostpointercapture", lostPointerCaptureListener);
    });
  }

  _onTabDragStart(firstPointerMoveEvent, draggedTab) {
    let tabBounds = draggedTab.getBoundingClientRect();
    let tabsBounds = this.getBoundingClientRect();

    let $initialScreenIndex = Symbol();
    let $screenIndex = Symbol();
    let $flexOffset = Symbol();

    draggedTab.style.zIndex = 999;
    this._elements["open-button"].style.setProperty("opacity", "0", "important");

    for (let tab of this.children) {
      let screenIndex = this._getTabScreenIndex(tab);
      tab[$screenIndex] = screenIndex;
      tab[$initialScreenIndex] = screenIndex;
      tab[$flexOffset] = tab.getBoundingClientRect().left - tabsBounds.left;

      if (tab !== draggedTab) {
        tab.style.transition = "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)";
      }
    }

    let onDraggedTabScreenIndexChange = (fromScreenIndex, toScreenIndex) => {
      if (toScreenIndex > fromScreenIndex + 1) {
        for (let i = fromScreenIndex; i < toScreenIndex; i += 1) {
          onDraggedTabScreenIndexChange(i, i + 1);
        }
      }
      else if (toScreenIndex < fromScreenIndex - 1) {
        for (let i = fromScreenIndex; i > toScreenIndex; i -= 1) {
          onDraggedTabScreenIndexChange(i, i - 1);
        }
      }
      else {
        for (let tab of this.children) {
          if (tab !== draggedTab) {
            if (tab[$screenIndex] === toScreenIndex) {
              tab[$screenIndex] = fromScreenIndex;
            }

            let translateX = -tab[$flexOffset];

            for (let i = 0; i < tab[$screenIndex]; i += 1) {
              translateX += tabBounds.width;
            }

            if (translateX === 0) {
              tab.style.transform = null;
            }
            else {
              tab.style.transform = "translate(" + translateX + "px)";
            }
          }
        }
      }
    };

    let pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.isPrimary) {
        let dragOffset = pointerMoveEvent.clientX - firstPointerMoveEvent.clientX;

        if (dragOffset + draggedTab[$flexOffset] <= 0) {
          dragOffset = -draggedTab[$flexOffset];
        }
        else if (dragOffset + draggedTab[$flexOffset] + tabBounds.width > tabsBounds.width) {
          dragOffset = tabsBounds.width - draggedTab[$flexOffset] - tabBounds.width;
        }

        draggedTab.style.transform = "translate(" + dragOffset + "px)";
        let screenIndex = this._getTabScreenIndex(draggedTab);

        if (screenIndex !== draggedTab[$screenIndex]) {
          let previousTabScreenIndex = draggedTab[$screenIndex];
          draggedTab[$screenIndex] = screenIndex;
          onDraggedTabScreenIndexChange(previousTabScreenIndex, draggedTab[$screenIndex]);
        }
      }
    };

    let lostPointerCaptureListener = async (dragEndEvent) => {
      this.removeEventListener("pointermove", pointerMoveListener);
      this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

      let translateX = -draggedTab[$flexOffset];

      for (let i = 0; i < draggedTab[$screenIndex]; i += 1) {
        translateX += tabBounds.width;
      }

      draggedTab.style.transition = "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)";
      draggedTab.style.transform = "translate(" + translateX + "px)";

      if (draggedTab[$initialScreenIndex] !== draggedTab[$screenIndex]) {
        this.dispatchEvent(
          new CustomEvent("rearrange")
        );
      }

      await sleep(150);

      draggedTab.style.zIndex = null;
      this._elements["open-button"].style.opacity = null;

      for (let tab of this.children) {
        tab.style.transition = "none";
        tab.style.transform = "translate(0px, 0px)";
        tab.style.order = tab[$screenIndex];
      }
    };

    this.addEventListener("pointermove", pointerMoveListener);
    this.addEventListener("lostpointercapture", lostPointerCaptureListener);
  }

  _onOpenButtonClick(clickEvent) {
    if (clickEvent.button === 0) {
      let customEvent = new CustomEvent("open", {cancelable: true});
      this.dispatchEvent(customEvent);

      if (customEvent.defaultPrevented === false) {
        let openedTab = html`<x-doctab><x-label>Untitled</x-label></x-doctab>`;
        openedTab.style.order = this.childElementCount;
        this.openTab(openedTab);

        this.selectTab(openedTab);
      }
    }
  }

  _onKeyDown(event) {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    else if (event.code === "Enter" || event.code === "Space") {
      let currentTab = this.querySelector(`x-doctab[tabindex="0"]`);
      let selectedTab = this.querySelector(`x-doctab[selected]`);

      event.preventDefault();
      currentTab.click();

      if (currentTab !== selectedTab) {

        if (selectedTab) {
          selectedTab.animateSelectionIndicator(currentTab).then(() => {
            this.selectTab(currentTab);
            this.dispatchEvent(new CustomEvent("select", {detail: currentTab}));
          });
        }
        else {
          this.selectTab(currentTab);
          this.dispatchEvent(new CustomEvent("select", {detail: currentTab}));
        }
      }
    }

    else if (event.code === "ArrowLeft") {
      let tabs = this.getTabsByScreenIndex();
      let currentTab = this.querySelector(`x-doctab[tabindex="0"]`);
      let previousTab = this._getPreviousTabOnScreen(currentTab);

      if (previousTab) {
        event.preventDefault();

        currentTab.tabIndex = -1;
        previousTab.tabIndex = 0;
        previousTab.focus();
      }
    }

    else if (event.code === "ArrowRight") {
      let tabs = this.getTabsByScreenIndex();
      let currentTab = this.querySelector(`x-doctab[tabindex="0"]`);
      let nextTab = this._getNextTabOnScreen(currentTab);

      if (nextTab) {
        event.preventDefault();

        currentTab.tabIndex = -1;
        nextTab.tabIndex = 0;
        nextTab.focus();
      }
    }
  }
};

customElements.define("x-doctabs", XDocTabsElement);
