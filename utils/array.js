
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

/**
 * Remove duplicate values from array.
 *
 * @type {(array: Array<any>) => Array<any>}
 */
export let removeDuplicates = (array) => {
  return [...new Set(array)];
};

/**
 * Check whether two arrays consist from the same items.
 *
 * @type {(array: Array<any>, otherArray: Array<any>, compareIndexes?: boolean) => boolean}
 */
export let compareArrays = (array, otherArray, compareIndexes = false) => {
  if (array.length !== otherArray.length) {
    return false;
  }

  if (compareIndexes) {
    for (let i = 0; i < array.length; i += 1) {
      let item = array[i];

      if (item !== otherArray[i]) {
        return false ;
      }
    }
  }
  else {
    for (let i = 0; i < array.length; i += 1) {
      if (!otherArray.includes(array[i])) {
        return false;
      }
    }

    for (let i = 0; i < otherArray.length; i += 1) {
      if (!array.includes(otherArray[i])) {
        return false;
      }
    }
  }

  return true;
};
