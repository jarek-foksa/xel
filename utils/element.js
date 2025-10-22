
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

/**
 * Same as document.createElement(), but you can also create SVG elements.
 *
 * @type {(name: string) => Element}
 */
export let createElement = (name, is = null) => {
  let parts = name.split(":");
  let element = null;

  if (parts.length === 1) {
    let [localName] = parts;

    if (is === null) {
      element = document.createElement(localName);
    }
    else {
      element = document.createElement(localName, is);
    }
  }
  else if (parts.length === 2) {
    let [namespace, localName] = parts;

    if (namespace === "svg") {
      element = document.createElementNS("http://www.w3.org/2000/svg", localName);
    }
  }

  return element;
};

/**
 * Same as standard document.elementFromPoint(), but can also walk shadow DOM.
 *
 * @type {(clientX: number, clientY: number, walkShadowDOM?: boolean) => Element | null}
 */
export let elementFromPoint = (clientX, clientY, walkShadowDOM = true) => {
  let element = document.elementFromPoint(clientX, clientY);

  if (walkShadowDOM && element) {
    while (true) {
      let shadowRoot = (element.shadowRoot || element._shadowRoot);

      if (shadowRoot) {
        let descendantElement = shadowRoot.elementFromPoint(clientX, clientY);

        // @bugfix: https://bugs.chromium.org/p/chromium/issues/detail?id=843215
        if (descendantElement.getRootNode() !== shadowRoot) {
          descendantElement = null;
        }

        if (descendantElement && descendantElement !== element) {
          element = descendantElement;
        }
        else {
          break;
        }
      }
      else {
        break;
      }
    }
  }

  return element;
};

/**
 * @type {(pointerEvent: PointerEvent, element: Element) => boolean}
 */
export let isPointerInsideElement = (pointerEvent, element) => {
  let bounds = element.getBoundingClientRect();

  return (
    pointerEvent.clientX >= bounds.x &&
    pointerEvent.clientX <= bounds.x + bounds.width &&
    pointerEvent.clientY >= bounds.y &&
    pointerEvent.clientY <= bounds.y + bounds.height
  );
};

/**
 * Same as standard element.closest() method but can also walk shadow DOM.
 *
 * @type {(element: Element, selector: string, walkShadowDOM?: boolean) => Element | null}
 */
export let closest = (element, selector, walkShadowDOM = true) => {
  let matched = element.closest(selector);

  if (walkShadowDOM && !matched && element.getRootNode().host) {
    return closest(element.getRootNode().host, selector);
  }
  else {
    return matched;
  }
};

/**
 * Get closest ancestor elements that can be scrolled horizontally or vertically.
 *
 * @type {(element: Element) => Element | null}
 */
export let getClosestScrollableAncestor = (element) => {
  let isScrollable = (currentElement) => {
    let computedStyle = getComputedStyle(currentElement, null);

    return /(auto|scroll)/.test(
      computedStyle.getPropertyValue("overflow") +
      computedStyle.getPropertyValue("overflow-y") +
      computedStyle.getPropertyValue("overflow-x")
    );
  }

  let walk = (currentElement) => {
    if (!currentElement || currentElement === document.body) {
      return document.body;
    }
    else if (isScrollable(currentElement) && currentElement.localName !== "x-texteditor") {
      return currentElement;
    }
    else {
      return walk(currentElement.parentElement || currentElement.parentNode.host);
    }
  };

  return walk(element.parentElement || element.parentNode.host);
};

/**
 * Get the gradients that are referenced with "href" attribute.
 *
 * @type {(gradient: SVGGradientElement) => Array<SVGGradientElement>}
 */
export let getAncestorGradients = (gradient) => {
  let svgElement = null;
  let ancestorGradients = [];
  let currentGradient = gradient;

  while (currentGradient && currentGradient.href.baseVal !== "") {
    if (svgElement === null) {
      svgElement = gradient.ownerSVGElement;
    }

    let target = svgElement.querySelector(currentGradient.href.baseVal);

    if (
      (target) &&
      (target.localName === "linearGradient" || target.localName === "radialGradient") &&
      (target !== gradient) &&
      (ancestorGradients.includes(target) === false)
    ) {
      ancestorGradients.push(target);
      currentGradient = target;
    }
    else {
      break;
    }
  }

  return ancestorGradients;
};
