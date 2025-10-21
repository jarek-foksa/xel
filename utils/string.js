
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

// @type (any) => boolean
//
// Check whether given argument is a string
export let isString = (arg) => {
  return typeof arg === "string";
};

// @type (string) => void
//
// Convert the first letter in the given string from lowercase to uppercase.
export let capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.substr(1);
};

// @src https://github.com/gouch/to-title-case
// @copyright © 2008–2018 David Gouch
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

// @type (string, string, string) => string
//
// Replace every occurance of string A with string B.
export let replaceAll = (text, a, b) => {
  return text.split(a).join(b);
}

// @type (string) => boolean
// @src https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Whitespace_in_the_DOM
//
// Check if given string is a whitespace string as defined by DOM spec.
export let isDOMWhitespace = (string) => {
  return !(/[^\t\n\r ]/.test(string));
};

// @type (any) => boolean
//
// Returns true if the passed argument is either a number or a string that represents a number.
export let isNumeric = (value) => {
  let number = Number.parseFloat(value);
  return Number.isNaN(number) === false && Number.isFinite(number);
};

// @type (string) => string
//
// Normalize the string by escaping any HTML tags.
export let escapeHTML = (html) => {
  let div = document.createElement("div");
  div.appendChild(document.createTextNode(html));
  return div.innerHTML;
};
