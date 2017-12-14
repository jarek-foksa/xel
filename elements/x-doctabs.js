
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {sleep} from "../utils/time.js";
import {getDistanceBetweenPoints} from "../utils/math.js";

let {abs} = Math;
let {parseInt} = Number;

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-doctabs.css" data-vulcanize>

    <slot></slot>

    <div id="selection-indicator-container">
      <div id="selection-indicator" hidden></div>
    </div>

    <svg id="open-button" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="open-button-path"></path>
    </svg>
  </template>
`;

// @events
//   open
//   close
//   select
//   rearrange
export class XDocTabsElement extends HTMLElement {
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled === true ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @info
  //   Maximal number of tambs that can be opened
  // @type
  //   number
  // @default
  //   20
  // @attribute
  get maxTabs() {
    return this.hasAttribute("maxtabs") ? parseInt(this.getAttribute("maxtabs")) : 20;
  }
  set maxTabs(maxTabs) {
    this.setAttribute("maxtabs", maxTabs);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._waitingForTabToClose = false;
    this._waitingForPointerMoveAfterClosingTab = false;

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this["#open-button"].addEventListener("click", (event) => this._onOpenButtonClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
          tab.focus();
          resolve(tab);
        }
        else if (animate === true) {
          tab.style.transition = null;
          tab.style.maxWidth = "0px";
          tab.style.padding = "0px";

          tab.setAttribute("opening", "");
          this.append(tab);
          await sleep(30);

          tab.addEventListener("transitionend", (event) => {
            tab.removeAttribute("opening");
            resolve(tab);
          }, {once: true});

          tab.style.maxWidth = null;
          tab.style.padding = null;
          tab.focus();
        }
      }
    });
  }

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

  selectPreviousTab() {
    let tabs = this.getTabsByScreenIndex();
    let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab");
    let previousTab = this._getPreviousTabOnScreen(currentTab);

    if (currentTab && previousTab) {
      currentTab.tabIndex = -1;
      currentTab.selected = false;

      previousTab.tabIndex = 0;
      previousTab.selected = true;

      return previousTab;
    }

    return null;
  }

  selectNextTab() {
    let tabs = this.getTabsByScreenIndex();
    let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab:last-of-type");
    let nextTab = this._getNextTabOnScreen(currentTab);

    if (currentTab && nextTab) {
      currentTab.tabIndex = -1;
      currentTab.selected = false;

      nextTab.tabIndex = 0;
      nextTab.selected = true;

      return nextTab;
    }

    return null;
  }

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

  // @info
  //   Returns a promise that is resolved when the pointer is moved by at least the given distance.
  // @type
  //   (number) => Promise
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

  _animateSelectionIndicator(fromTab, toTab) {
    let mainBBox = this.getBoundingClientRect();
    let startBBox = fromTab ? fromTab.getBoundingClientRect() : null;
    let endBBox = toTab.getBoundingClientRect();
    let computedStyle = getComputedStyle(toTab);

    if (startBBox === null) {
      startBBox = DOMRect.fromRect(endBBox);
      startBBox.x += startBBox.width / 2;
      startBBox.width = 0;
    }

    this["#selection-indicator"].style.height = computedStyle.getPropertyValue("--selection-indicator-height");
    this["#selection-indicator"].style.background = computedStyle.getPropertyValue("--selection-indicator-color");
    this["#selection-indicator"].hidden = false;

    this.setAttribute("animatingindicator", "");

    let animation = this["#selection-indicator"].animate(
      [
        {
          bottom: (startBBox.bottom - mainBBox.bottom) + "px",
          left: (startBBox.left - mainBBox.left) + "px",
          width: startBBox.width + "px",
        },
        {
          bottom: (endBBox.bottom - mainBBox.bottom) + "px",
          left: (endBBox.left - mainBBox.left) + "px",
          width: endBBox.width + "px",
        }
      ],
      {
        duration: 200,
        iterations: 1,
        delay: 0,
        easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
      }
    );

    animation.finished.then(() => {
      this["#selection-indicator"].hidden = true;
      this.removeAttribute("animatingindicator");
    });

    return animation;
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

  // @info
  //   Get previous tab on screen.
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
    if (event.button === 0 && !this._waitingForTabToClose && event.target.closest("x-doctab")) {
      this._onTabPointerDown(event);
    }
  }

  _onTabPointerDown(pointerDownEvent) {
    if (pointerDownEvent.isPrimary === false) {
      return;
    }

    let pointerMoveListener, lostPointerCaptureListener;
    let pointerDownTab = pointerDownEvent.target.closest("x-doctab");
    let selectedTab = this.querySelector("x-doctab[selected]");

    for (let tab of this.querySelectorAll("x-doctab")) {
      if (tab === pointerDownTab) {
        if (tab.selected === false) {
          tab.selected = true;
          this.dispatchEvent(new CustomEvent("select"));
        }
      }
      else {
        tab.selected = false;
      }

      tab.tabIndex = (tab === pointerDownTab) ? 0 : -1;
    }

    let selectionIndicatorAnimation = this._animateSelectionIndicator(selectedTab, pointerDownTab);
    this.setPointerCapture(pointerDownEvent.pointerId);

    this.addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
      if (pointerMoveEvent.isPrimary && abs(pointerMoveEvent.clientX - pointerDownEvent.clientX) > 1) {
        this.removeEventListener("pointermove", pointerMoveListener);
        this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

        selectionIndicatorAnimation.finish();
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
    this["#open-button"].style.opacity = "0";

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
      this["#open-button"].style.opacity = null;

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

        for (let tab of this.children) {
          tab.selected = (tab === openedTab);
        }
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
        selectedTab.selected = false;
        currentTab.selected = true;
        this._animateSelectionIndicator(selectedTab, currentTab);
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
