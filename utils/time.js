
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

/**
 * Sleep for given period of time (in milliseconds).
 *
 * @type {(time: number) => Promise<void>}
 */
export let sleep = (time) => {
  return new Promise( (resolve) => {
    setTimeout(() => resolve(), time);
  });
};

/**
 * Sleep until the main thread becomes idle.
 *
 * @type {() => Promise<void>}
 */
export let nextTick = () => {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
};

/**
 * Get timestamp in Unix format, e.g. 1348271383119.
 *
 * @see http://en.wikipedia.org/wiki/Unix_time
 * @type {() => number}
 */
export let getTimeStamp = () => {
  return Date.now();
};

/**
 * Takes two dates and returns a human readable duration such as "in 2 minutes" or "4 days ago".
 *
 * @type {(date: Date, refDate?: Date, locales?: Array<string>) => string}
 */
export let getRelDisplayDate = (date, refDate = new Date(), locales = ["en"]) => {
  let seconds = 60;
  let minutes = seconds * 60;
  let hours = minutes * 24;
  let days = hours * 7;
  let weeks = days * 7;

  let time = date.getTime();
  let refTime = refDate.getTime();

  let formatter = new Intl.RelativeTimeFormat(locales, {numeric: "always"});
  let diff = Math.round((refTime - time) / 1000);
  let sign;

  // Past
  if (diff < 0) {
    sign = 1;
    diff = -diff;
  }
  // Future
  else {
    sign = -1;
  }

  if (diff < seconds) {
    return formatter.format((diff * sign), "seconds");
  }
  else if (diff < minutes) {
    return formatter.format(Math.round((diff * sign) / seconds), "minutes");
  }
  else if (diff < hours) {
    return formatter.format(Math.round((diff * sign) / minutes), "hours");
  }
  else if (diff < days) {
    return formatter.format(Math.round((diff * sign) / hours), "days");
  }
  else if (diff < weeks) {
    return formatter.format(Math.round((diff * sign) / days), "weeks");
  }
  else {
    let months = (date.getFullYear() - refDate.getFullYear()) * 12;
    months -= refDate.getMonth();
    months += date.getMonth();

    if (Math.abs(months) > 12) {
      if (months < 0) {
        return formatter.format(Math.ceil(months/12), "years");
      }
      else {
        return formatter.format(Math.floor(months/12), "years");
      }
    }
    else {
      return formatter.format(months, "months");
    }
  }
};

/**
 * Returns a function, that, when invoked, will only be triggered at most once during a given window of time.
 *
 * @license https://github.com/documentcloud/underscore/blob/master/LICENSE (MIT License)
 * @see https://github.com/documentcloud/underscore/blob/master/underscore.js#L627
 * @see http://drupalmotion.com/article/debounce-and-throttle-visual-explanation
 * @type {(func: Function, wait?: number, context?: any) => Function}
 */
export let throttle = (func, wait = 500, context = null) => {
  let args = null;
  let timeout = null;
  let result = null;
  let previous = 0;

  let later = () => {
    previous = new Date();
    timeout = null;
    result = func.apply(context, args);
  };

  let wrapper = (..._args) => {
    let now = new Date();
    let remaining = wait - (now - previous);
    args = _args;

    if (remaining <= 0) {
      clearTimeout(timeout);
      timeout = null;
      previous = now;
      result = func.apply(context, args);
    }

    else if (!timeout) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };

  return wrapper;
};

/**
 * Returns a function, that, as long as it continues to be invoked, will not be triggered. The function will be
 * called after it stops being called for N milliseconds. If "immediate" is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @license https://github.com/documentcloud/underscore/blob/master/LICENSE (MIT License)
 * @see https://github.com/documentcloud/underscore/blob/master/underscore.js#L656
 * @see http://drupalmotion.com/article/debounce-and-throttle-visual-explanation
 * @type {(func: Function, wait: number, context?: any, immediate?: boolean) => Function}
 */
export let debounce = (func, wait, context, immediate = false) => {
  let timeout = null;
  let result = null;

  let wrapper = (...args) => {
    let later = () => {
      timeout = null;

      if (!immediate) {
        result = func.apply(context, args);
      }
    };

    let callNow = (immediate && !timeout);
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      result = func.apply(context, args);
    }

    return result;
  };

  return wrapper;
};
