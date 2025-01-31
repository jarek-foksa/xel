
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

// @type (string) => [string, number, string]
//
// Parse the value of CSS transition property.
export let parseTransistion = (string) => {
  let [rawDuration, property, ...rest] = string.trim().split(" ");
  let duration = parseFloat(rawDuration);
  let easing = rest.join(" ");
  return [property, duration, easing];
};
