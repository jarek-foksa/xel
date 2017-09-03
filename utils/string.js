
// @copyright
//   © 2016-2017 Jarosław Foksa

let {isFinite, isNaN, parseFloat} = Number;

// @info
//   Convert the first letter in the given string from lowercase to uppercase.
// @type
//   (string) => void
export let capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.substr(1);
};

// @info
//   Replace every occurance of string A with string B.
// @type
//   (string, string, string) => string
export let replaceAll = (text, a, b) => {
  return text.split(a).join(b);
}

// @info
//   Check if given string is a whitespace string as defined by DOM spec.
// @type
//   (string) => boolean
// @src
//   https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Whitespace_in_the_DOM
export let isDOMWhitespace = (string) => {
  return !(/[^\t\n\r ]/.test(string));
};

// @info
//   Returns true if the passed argument is either a number or a string that represents a number.
// @type
//   (any) => boolean
export let isNumeric = (value) => {
  let number = parseFloat(value);
  return isNaN(number) === false && isFinite(number);
};
