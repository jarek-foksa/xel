
// @info
//   Tabs make it easy to explore and switch between different views.
// @doc
//   http://w3c.github.io/aria-practices/#tabpanel
//   http://accessibility.athena-ict.com/aria/examples/tabpanel2.shtml
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, closest, createElement} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-tabs.css" data-vulcanize>
    <slot></slot>
    <div id="selection-indicator" hidden></div>
  </template>
`;

// @events
//   change
export class XTabsElement extends HTMLElement {
  // @type
  //   string?
  // @default
  //   null
  get value() {
    let selectedTab = this.querySelector("x-tab[selected]");
    return selectedTab ? selectedTab.value : null;
  }
  set value(value) {
    let tabs = [...this.querySelectorAll("x-tab")];
    let selectedTab = (value === null) ? null : tabs.find(tab => tab.value === value);

    for (let tab of tabs) {
      tab.selected = (tab === selectedTab);
    }
  }

  // @property
  //   reflected
  // @type
  //   boolean
  // @default
  //   false
  get centered() {
    return this.hasAttribute("centered");
  }
  set centered(centered) {
    centered === true ? this.setAttribute("centered", "") : this.removeAttribute("centered");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._wasFocusedBeforeExpanding = false;

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#backdrop"] = createElement("x-backdrop");
    this["#backdrop"].style.background = "rgba(0, 0, 0, 0)";

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "tablist");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Expands given tab by opening its menu.
  _expand(tab) {
    return new Promise( async (resolve) => {
      let menu = tab.querySelector(":scope > x-menu");
      let label = tab.querySelector("x-label");

      if (menu) {
        this._wasFocusedBeforeExpanding = this.querySelector("*:focus") !== null;

        let over = getComputedStyle(tab).getPropertyValue("--menu-position").trim() === "over";
        let whenOpened = over ? menu.openOverLabel(label) :  menu.openNextToElement(tab, "vertical", 3);

        tab.setAttribute("expanded", "");

        // When menu closes, focus the tab
        menu.addEventListener("close", () => {
          let tabs = this.querySelectorAll("x-tab");
          let closedTab = tab;

          if (this._wasFocusedBeforeExpanding) {
            for (let tab of tabs) {
              tab.tabIndex = (tab === closedTab ? 0 : -1);
            }

            closedTab.focus();
          }
          else {
            for (let tab of tabs) {
              tab.tabIndex = (tab.selected ? 0 : -1);
            }

            let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

            if (ancestorFocusableElement) {
              ancestorFocusableElement.focus();
            }
          }
        }, {once: true});

        await whenOpened;

        if (!tab.querySelector("*:focus")) {
          menu.focus();
        }

        this["#backdrop"].ownerElement = menu;
        this["#backdrop"].show(false);
      }

      resolve();
    });
  }

  // @info
  //   Collapses currently expanded tab by closing its menu.
  _collapse(delay) {
    return new Promise( async (resolve) => {
      let menu = this.querySelector("x-menu[opened]");

      if (menu && !menu.hasAttribute("closing")) {
        let tabs = this.querySelectorAll("x-tab");
        let closedTab = menu.closest("x-tab");
        menu.setAttribute("closing", "");

        await delay;
        await menu.close();

        this["#backdrop"].hide(false);

        menu.removeAttribute("closing");
        closedTab.removeAttribute("expanded");
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _animateSelectionIndicator(startTab, endTab) {
    return new Promise( async (resolve) => {
      let mainBBox = this.getBoundingClientRect();
      let startBBox = startTab ? startTab.getBoundingClientRect() : null;
      let endBBox = endTab.getBoundingClientRect();
      let computedStyle = getComputedStyle(endTab);

      if (startBBox === null) {
        startBBox = DOMRect.fromRect(endBBox);
        startBBox.x += startBBox.width / 2;
        startBBox.width = 0;
      }

      this["#selection-indicator"].style.height = computedStyle.getPropertyValue("--selection-indicator-height");

      if (this["#selection-indicator"].style.height !== "0px") {
        this["#selection-indicator"].style.background = computedStyle.getPropertyValue("--selection-indicator-background");
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
            duration: 100,
            iterations: 1,
            delay: 0,
            easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
          }
        );

        await animation.finished;

        this["#selection-indicator"].hidden = true;
        this.removeAttribute("animatingindicator");
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onClick(event) {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest("x-backdrop")) {
      this._collapse();
    }

    else if (event.target.closest("x-menu")) {
      let clickedMenuItem = event.target.closest("x-menuitem");

      if (clickedMenuItem && clickedMenuItem.disabled === false) {
        let submenu = clickedMenuItem.querySelector("x-menu");

        if (submenu) {
          if (submenu.opened) {
            submenu.close();
          }
          else {
            submenu.openNextToElement(clickedMenuItem, "horizontal");
          }
        }
        else {
          this._collapse(clickedMenuItem.whenTriggerEnd);
        }
      }
    }

    else if (event.target.closest("x-tab")) {
      let tabs = this.querySelectorAll("x-tab");
      let clickedTab = event.target.closest("x-tab");
      let selectedTab = this.querySelector("x-tab[selected]");
      let submenu = clickedTab.querySelector(":scope > x-menu");

      if (clickedTab !== selectedTab) {
        // Open a popup menu
        if (submenu) {
          this._expand(clickedTab);
        }

        // Select the tab
        else {
          for (let tab of tabs) {
            tab.selected = (tab === clickedTab);
          }

          this._animateSelectionIndicator(selectedTab, clickedTab);
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      let tab = event.target;
      let menu = tab.querySelector("x-menu");
      let label = tab.querySelector("x-label");

      if (menu) {
        if (menu.opened) {
          this._collapse();
          event.preventDefault();
        }
        else {
          this._expand(tab);
          event.preventDefault();
        }
      }
      else {
        event.preventDefault();
        tab.click();
      }
    }

    else if (event.code === "Escape") {
      let tab = event.target.closest("x-tab");
      let menu = tab.querySelector("x-menu");

      if (menu) {
        this._collapse();
      }
    }

    else if (event.code === "ArrowLeft") {
      let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
      let currentTab = this.querySelector(`x-tab[tabindex="0"]`);
      let clickedTab = event.target;
      let openedTabMenu = this.querySelector("x-menu[opened]");

      event.preventDefault();

      if (openedTabMenu) {
      }
      else if (currentTab && tabs.length > 0) {
        let currentTabIndex = tabs.indexOf(currentTab);
        let previousTab = tabs[currentTabIndex - 1] || tabs[tabs.length - 1];

        currentTab.tabIndex = -1;
        previousTab.tabIndex = 0;
        previousTab.focus();
      }
    }

    else if (event.code === "ArrowRight") {
      let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
      let currentTab = this.querySelector(`x-tab[tabindex="0"]`);
      let clickedTab = event.target;
      let openedTabMenu = this.querySelector("x-menu[opened]");

      event.preventDefault();

      if (openedTabMenu) {
      }
      else if (currentTab && tabs.length > 0) {
        let currentTabIndex = tabs.indexOf(currentTab);
        let nextTab = tabs[currentTabIndex + 1] || tabs[0];

        currentTab.tabIndex = -1;
        nextTab.tabIndex = 0;
        nextTab.focus();
      }
    }

    else if (event.code === "ArrowUp") {
      let tab = event.target.closest("x-tab");
      let menu = tab.querySelector("x-menu");

      if (menu) {
        event.preventDefault();

        if (menu.opened) {
          let lastMenuItem = menu.querySelector(":scope > x-menuitem:last-of-type:not([disabled])");

          if (lastMenuItem) {
            lastMenuItem.focus();
          }
        }
        else {
          this._expand(tab);
        }
      }
    }

    else if (event.code === "ArrowDown") {
      let tab = event.target.closest("x-tab");
      let menu = tab.querySelector("x-menu");

      if (menu) {
        event.preventDefault();

        if (menu.opened) {
          let firstMenuItem = menu.querySelector(":scope > x-menuitem:not([disabled])");

          if (firstMenuItem) {
            firstMenuItem.focus();
          }
        }
        else {
          this._expand(tab);
        }
      }
    }
  }
}

customElements.define("x-tabs", XTabsElement);
