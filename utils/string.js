
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

/**
 * @type {(arg: any) => boolean}
 */
export let isString = (arg) => {
  return typeof arg === "string";
};

/**
 * Convert the first letter of each word from lowercase to uppercase.
 *
 * @type {(string: string) => string}
 */
export let capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.substr(1);
};

/**
 * @see https://github.com/gouch/to-title-case
 * @type {(string: string) => string}
 */
export let toTitleCase = (string) => {
  let smallWords = /^(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|v.?|vs.?|via)$/i;
  let alphanumericPattern = /([A-Za-z0-9\u00C0-\u00FF])/;
  let wordSeparators = /([ :–—-])/;

  return string.split(wordSeparators).map((current, index, array) => {
    if (
      // Check for small words
      current.search(smallWords) > -1 &&
      // Skip first and last word
      index !== 0 &&
      index !== array.length - 1 &&
      // Ignore title end and subtitle start
      array[index - 3] !== ":" &&
      array[index + 1] !== ":" &&
      // Ignore small words that start a hyphenated phrase
      (array[index + 1] !== "-" ||
        (array[index - 1] === "-" && array[index + 1] === "-"))
    ) {
      return current.toLowerCase();
    }

    // Ignore intentional capitalization
    if (current.substr(1).search(/[A-Z]|\../) > -1) {
      return current;
    }

    // Ignore URLs
    if (array[index + 1] === ":" && array[index + 2] !== "") {
      return current;
    }

    // Capitalize the first letter
    return current.replace(alphanumericPattern, (match) => match.toUpperCase());
  }).join("");
};

/**
 * Replace every occurrence of string A with string B.
 *
 * @type {(string: string, a: string, b: string) => string}
 */
export let replaceAll = (text, a, b) => {
  return text.split(a).join(b);
}

/**
 * Check if given string is a whitespace string as defined by DOM spec.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Whitespace_in_the_DOM
 * @type {(string: string) => boolean}
 */
export let isDOMWhitespace = (string) => {
  return !(/[^\t\n\r ]/.test(string));
};

/**
 * Returns true if the passed argument is either a number or a string that represents a number.
 *
 * @type {(arg: any) => boolean}
 */
export let isNumeric = (value) => {
  let number = Number.parseFloat(value);
  return Number.isNaN(number) === false && Number.isFinite(number);
};

/**
 * Normalize the string by escaping any HTML tags.
 *
 * @type {(html: string) => string}
 */
export let escapeHTML = (html) => {
  let div = document.createElement("div");
  div.appendChild(document.createTextNode(html));
  return div.innerHTML;
};
