
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

let {isFinite, isNaN, parseFloat} = Number;

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
  let number = parseFloat(value);
  return isNaN(number) === false && isFinite(number);
};
