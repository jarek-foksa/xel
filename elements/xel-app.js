
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;
  let {sleep} = Xel.utils.time;
  let theme = document.querySelector('link[href*=".theme.css"]').getAttribute("href");

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="${theme}">
      <link rel="stylesheet" href="node_modules/xel/stylesheets/xel-app.css" data-vulcanize>

      <main id="main">
        <x-button id="show-sidebar-button" icon="menu" skin="textured">
          <x-icon name="menu"></x-icon>
        </x-button>

        <sidebar id="sidebar">
          <h1 id="logo">Xel</h1>

          <x-button id="hide-sidebar-button" skin="textured">
            <x-icon name="chevron-left"></x-icon>
          </x-button>

          <hr/>

          <nav id="nav">
            <section>
              <a href="/">
                <x-button skin="sidenav">
                  <x-icon name="info"></x-icon>
                  <x-label>About</x-label>
                </x-button>
              </a>

              <a href="/setup">
                <x-button skin="sidenav">
                  <x-icon name="build"></x-icon>
                  <x-label>Setup</x-label>
                </x-button>
              </a>

              <a href="/faq">
                <x-button skin="sidenav">
                  <x-icon name="question-answer"></x-icon>
                  <x-label>FAQ</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <a href="https://github.com/jarek-foksa/xel" target="_blank">
                <x-button skin="sidenav">
                  <x-icon name="code"></x-icon>
                  <x-label>Source Code ⧉</x-label>
                </x-button>
              </a>

              <a href="https://github.com/jarek-foksa/xel/issues" target="_blank">
                <x-button skin="sidenav">
                  <x-icon name="bug-report"></x-icon>
                  <x-label>Bugs ⧉</x-label>
                </x-button>
              </a>

              <a href="https://github.com/jarek-foksa/xel/commits" target="_blank">
                <x-button skin="sidenav">
                  <x-icon name="event"></x-icon>
                  <x-label>Changelog ⧉</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section id="theme-section">
              <h3>Theme</h3>

              <x-select id="theme-select">
                <x-menu>
                  <x-menuitem value="/node_modules/xel/stylesheets/material.theme.css" selected="true">
                    <x-label>Material</x-label>
                  </x-menuitem>

                  <x-menuitem value="/node_modules/xel/stylesheets/macos.theme.css" selected="true">
                    <x-label>macOS</x-label>
                  </x-menuitem>
                </x-menu>
              </x-select>
            </section>

            <hr/>

            <section>
              <h3>Primitives</h3>

              <a href="/elements/x-hbox">
                <x-button skin="sidenav">
                  <x-label>x-hbox</x-label>
                </x-button>
              </a>

              <a href="/elements/x-vbox">
                <x-button skin="sidenav">
                  <x-label>x-vbox</x-label>
                </x-button>
              </a>

              <a href="/elements/x-icon">
                <x-button skin="sidenav">
                  <x-label>x-icon</x-label>
                </x-button>
              </a>

              <a href="/elements/x-label">
                <x-button skin="sidenav">
                  <x-label>x-label</x-label>
                </x-button>
              </a>

              <a href="/elements/x-stepper">
                <x-button skin="sidenav">
                  <x-label>x-stepper</x-label>
                </x-button>
              </a>

              <a href="/elements/x-card">
                <x-button skin="sidenav">
                  <x-label>x-card</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <h3>Buttons</h3>

              <a href="/elements/x-button">
                <x-button skin="sidenav">
                  <x-label>x-button</x-label>
                </x-button>
              </a>

              <a href="/elements/x-buttongroup">
                <x-button skin="sidenav">
                  <x-label>x-buttongroup</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <h3>Tabs</h3>

              <a href="/elements/x-tabs">
                <x-button skin="sidenav">
                  <x-label>x-tabs</x-label>
                </x-button>
              </a>

              <a href="/elements/x-doctabs">
                <x-button skin="sidenav">
                  <x-label>x-doctabs</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <h3>Menus</h3>

              <a href="/elements/x-menu">
                <x-button skin="sidenav">
                  <x-label>x-menu</x-label>
                </x-button>
              </a>

              <a href="/elements/x-menuitem">
                <x-button skin="sidenav">
                  <x-label>x-menuitem</x-label>
                </x-button>
              </a>

              <a href="/elements/x-menubar">
                <x-button skin="sidenav">
                  <x-label>x-menubar</x-label>
                </x-button>
              </a>

              <a href="/elements/x-contextmenu">
                <x-button skin="sidenav">
                  <x-label>x-contextmenu</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <h3>Modals</h3>

              <a href="/elements/x-dialog">
                <x-button skin="sidenav">
                  <x-label>x-dialog</x-label>
                </x-button>
              </a>

              <a href="/elements/x-drawer">
                <x-button skin="sidenav">
                  <x-label>x-drawer</x-label>
                </x-button>
              </a>

              <a href="/elements/x-popover">
                <x-button skin="sidenav">
                  <x-label>x-popover</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <h3>Forms</h3>

              <a href="/elements/x-checkbox">
                <x-button skin="sidenav">
                  <x-label>x-checkbox</x-label>
                </x-button>
              </a>

              <a href="/elements/x-radio">
                <x-button skin="sidenav">
                  <x-label>x-radio</x-label>
                </x-button>
              </a>

              <a href="/elements/x-switch">
                <x-button skin="sidenav">
                  <x-label>x-switch</x-label>
                </x-button>
              </a>

              <a href="/elements/x-select">
                <x-button skin="sidenav">
                  <x-label>x-select</x-label>
                </x-button>
              </a>

              <a href="/elements/x-colorselect">
                <x-button skin="sidenav">
                  <x-label>x-colorselect</x-label>
                </x-button>
              </a>

              <a href="/elements/x-input">
                <x-button skin="sidenav">
                  <x-label>x-input</x-label>
                </x-button>
              </a>

              <a href="/elements/x-numberinput">
                <x-button skin="sidenav">
                  <x-label>x-numberinput</x-label>
                </x-button>
              </a>

              <a href="/elements/x-slider">
                <x-button skin="sidenav">
                  <x-label>x-slider</x-label>
                </x-button>
              </a>
            </section>

            <hr/>

            <section>
              <h3>Progress</h3>

              <a href="/elements/x-progressbar">
                <x-button skin="sidenav">
                  <x-label>x-progressbar</x-label>
                </x-button>
              </a>

              <a href="/elements/x-throbber">
                <x-button skin="sidenav">
                  <x-label>x-throbber</x-label>
                </x-button>
              </a>
            </section>
          </nav>
        </sidebar>

        <div id="views"></div>
      </main>
    </template>
  `;

  class XelAppElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      window.addEventListener("load", () => this._onWindowLoad());
      window.addEventListener("popstate", (event) => this._onPopState(event));
      window.addEventListener("beforeunload", (event) => this._onWindowUnload(event));
      this["#theme-select"].addEventListener("change", () => this._onThemeSelectChange());
      this["#hide-sidebar-button"].addEventListener("click", (event) => this._onHideNavButtonClick(event));
      this["#show-sidebar-button"].addEventListener("click", (event) => this._onShowNavButtonClick(event));
      this._shadowRoot.addEventListener("click", (event) => this._onShadowRootClick(event));
    }

    connectedCallback() {
      this._update();

      history.scrollRestoration = "manual";

      if (history.state === null) {
        history.replaceState(null, null, window.location.href);
      }

      let theme = document.querySelector('link[href*=".theme.css"]').getAttribute('href');

      for (let item of this["#theme-select"].querySelectorAll("x-menuitem")) {
        item.setAttribute("selected", (item.getAttribute("value") === theme) ? "true" : "false");
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onThemeSelectChange() {
      sessionStorage.setItem("theme", this["#theme-select"].value);
      location.reload();
    }

    _onWindowLoad() {
      let scrollTop = parseInt(sessionStorage.getItem("selectedViewScrollTop") || "0");
      let selectedView = this["#views"].querySelector(".view[selected]");

      if (selectedView) {
        selectedView.scrollTop = scrollTop;
      }
      else {
        sleep(100).then(() => {
          selectedView = this["#views"].querySelector(".view[selected]");
          selectedView.scrollTop = scrollTop
        });
      }
    }

    _onWindowUnload(event) {
      let selectedView = this["#views"].querySelector(".view[selected]");
      sessionStorage.setItem("selectedViewScrollTop", selectedView.scrollTop);
    }

    _onPopState(event) {
      this._update()
    }

    _onShadowRootClick(event) {
      let {ctrlKey, shiftKey, metaKey, target} = event;

      if (ctrlKey === false && shiftKey === false && metaKey === false) {
        let anchor = target.closest("a");

        if (anchor) {
          let url = new URL(anchor.href);

          if (location.origin === url.origin) {
            event.preventDefault();

            if (location.pathname !== url.pathname) {
              history.pushState(null, null, anchor.href);
              this._update();
            }
          }
        }
      }
    }

    _onHideNavButtonClick(event) {
      if (event.button === 0) {
        this._hideSidebar();
      }
    }

    _onShowNavButtonClick(event) {
      if (event.button === 0) {
        this._showSidebar();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      return new Promise( async (resolve) => {
        // Update selected nav button to match current location
        {
          for (let button of this["#nav"].querySelectorAll("x-button")) {
            let anchor = button.closest("a");

            if (anchor) {
              let url = new URL(anchor);

              if (url.origin === location.origin && url.pathname === location.pathname) {
                button.setAttribute("toggled", "");
              }
              else {
                button.removeAttribute("toggled");
              }
            }
          }
        }

        // Update displayed view to match current location
        {
          let selectedView = this["#views"].querySelector(".view[selected]");

          if (!selectedView || selectedView.dataset.pathname !== location.pathname) {
            let view = this["#views"].querySelector(`[data-pathname="${location.pathname}"]`);

            // If the view does not exist, try to create it
            if (!view) {
              let $0 = (location.pathname === "/") ? "/about" : location.pathname;
              let url = `/node_modules/xel/views` + $0 + `.html`;
              let result = await fetch(url);
              let viewHTML = await result.text();

              view = html`${viewHTML}`;
              view.setAttribute("data-pathname", location.pathname);
              this["#views"].append(view);
            }

            if (location.pathname === "/") {
              document.querySelector("title").textContent = "Xel";
            }
            else {
              document.querySelector("title").textContent = "Xel - " + view.querySelector("h2").textContent;
            }

            // Toggle view
            {
              let view = this["#views"].querySelector(`[data-pathname="${location.pathname}"]`);
              let otherView = this["#views"].querySelector(`.view[selected]`);

              if (otherView) {
                if (otherView === view) {
                  return;
                }
                else {
                  otherView.removeAttribute("selected");
                }
              }

              view.setAttribute("selected", "");
            }

            // Hide theme-specific sections that don't match the current theme
            {
              let theme = document.querySelector('link[href*=".theme.css"]').getAttribute('href');
              let themeName = theme.substring(theme.lastIndexOf("/") + 1, theme.length - 10);

              for (let section of view.querySelectorAll("section")) {
                if (section.hasAttribute("data-themes")) {
                  if (section.getAttribute("data-themes").includes(themeName) === false) {
                    section.hidden = true;
                  }
                }
              }
            }

            // Remove offscreen views
            {
              for (let view of [...this["#views"].children]) {
                if (view.hasAttribute("animating") === false && view.hasAttribute("selected") === false) {
                  view.remove();
                }
              }
            }
          }
        }

        resolve();
      });
    }

    _showSidebar() {
      return new Promise(async (resolve) => {
        this["#sidebar"].hidden = false;

        let {width, height, marginLeft} = getComputedStyle(this["#sidebar"]);
        let fromMarginLeft = (marginLeft === "0px" && width !== "auto" ? `-${width}` : marginLeft);
        let toMarginLeft = "0px";

        let animation = this["#sidebar"].animate(
          {
            marginLeft: [fromMarginLeft, toMarginLeft]
          },
          {
            duration: 250,
            easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
          }
        );

        this["#sidebar"].style.marginLeft = "0";
        this._currentAnimation = animation;
      });
    }

    _hideSidebar() {
      return new Promise(async (resolve) => {
        this["#sidebar"].hidden = false;

        let {width, height, marginLeft} = getComputedStyle(this["#sidebar"]);
        let fromMarginLeft = (marginLeft === "0px" && width !== "auto" ? "0px" : marginLeft);
        let toMarginLeft = `-${width}`;

        let animation = this["#sidebar"].animate(
          {
            marginLeft: [fromMarginLeft, toMarginLeft]
          },
          {
            duration: 250,
            easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
          }
        );

        this["#sidebar"].style.marginLeft = toMarginLeft;
        this._currentAnimation = animation;

        await animation.finished;

        if (this._currentAnimation === animation) {
          this["#sidebar"].hidden = true;
        }
      });
    }
  }

  customElements.define("xel-app", XelAppElement);
}
