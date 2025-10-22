
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

/**
 * Parse the value of CSS transition property.
 *
 * @type {(string: string) => [string, number, string]}
 */
export let parseTransistion = (string) => {
  let [rawDuration, property, ...rest] = string.trim().split(" ");
  let duration = Number.parseFloat(rawDuration);
  let easing = rest.join(" ");
  return [property, duration, easing];
};
