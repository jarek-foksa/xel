
// @copyright
//   © 2016-2023 Jarosław Foksa

"use strict";

(function() {
  var isSupportedBrowser = (
    window.customElements                        !== undefined &&
    window.customElements.define                 !== undefined &&
    window.Animation                             !== undefined &&
    window.CSSStyleSheet                         !== undefined &&
    window.CSSStyleSheet.prototype.replaceSync   !== undefined &&
    window.DOMPoint                              !== undefined &&
    window.DOMRect                               !== undefined &&
    window.HTMLDialogElement                     !== undefined &&
    window.HTMLDialogElement.prototype.showModal !== undefined &&
    window.MutationObserver                      !== undefined &&
    window.PointerEvent                          !== undefined &&
    window.ResizeObserver                        !== undefined &&
    window.ShadowRoot                            !== undefined &&
    window.CSS                                   !== undefined &&
    window.CSS.supports("color", "var(--test)")
  );

  window.addEventListener("load", function(event) {
    if (isSupportedBrowser === true) {
      document.body.innerHTML = `<pt-app id="app"></pt-app>`;
    }
    else {
      fallbackPortal.init();
    }
  });

  var fallbackPortal = {
    init: function() {
      this._renderHomePage();
    },

    _renderHomePage: function() {
      fetch("/docs/fallback.html").then(function(response) {
        response.text().then(function(text) {
          document.body.innerHTML = text;
        });
      });
    }
  };
})();
