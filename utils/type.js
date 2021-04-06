
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

// @type (any) => boolean
//
// Returns true if the passed argument is either a number or a string that represents a number.
export let isNumeric = (arg) => {
  return !Array.isArray(arg) && (arg - parseFloat(arg) + 1) >= 0;
};
