
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

// @type (number) => Promise
//
// Sleep for given period of time (in miliseconds).
export let sleep = (time) => {
  return new Promise( (resolve, reject) => {
    setTimeout(() => resolve(), time);
  });
};

// @type (() => void) => void
export let nextTick = () => {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
};

// @type () => number
//
// Get timestamp in Unix format, e.g. 1348271383119 [http://en.wikipedia.org/wiki/Unix_time]
export let getTimeStamp = () => {
  return Date.now();
};

// @type (Date, Date, Array<string>) => string
//
// Takes two dates and returns a human readable duration such as "in 2 minutes" or "4 days ago".
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
    diff = diff;
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

// @type (Function, number, Object) => Function
// @src [https://github.com/documentcloud/underscore/blob/master/underscore.js#L627]
// @license MIT License [https://github.com/documentcloud/underscore/blob/master/LICENSE]
//
// Returns a function, that, when invoked, will only be triggered at most once during a given window of time.
export let throttle = (func, wait = 500, context) => {
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

// @type (Function, number, Object, boolean) => Function
// @src [https://github.com/documentcloud/underscore/blob/master/underscore.js#L656]
// @license MIT License [https://github.com/documentcloud/underscore/blob/master/LICENSE]
//
// Returns a function, that, as long as it continues to be invoked, will not be triggered. The function will be
// called after it stops being called for N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing. Check
// [http://drupalmotion.com/article/debounce-and-throttle-visual-explanation] for a nice explanation of how this is
// different from throttle.
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
