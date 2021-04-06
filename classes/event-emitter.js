
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

export default class EventEmitter {
  _events = {};

  // @type (string, Function) => void
  addEventListener(eventName, listener) {
    if (!this._events) {
      this._events = {};
    }

    let listeners = this._events[eventName];

    if (!listeners) {
      this._events[eventName] = listeners = [];
    }

    listeners.push(listener);

    if (listeners.length > 10000) {
      console.warn(`Potential EventEmitter memory leak: ${listeners.length} listeners ` +
                   `subscribed to event "${eventName}"`);
    }
  }

  // @type (string, Function) => void
  removeEventListener(eventName, listener) {
    if (!this._events || !this._events[eventName]) {
      return;
    }

    var temp = [];

    for (var i = 0; i < this._events[eventName].length; i += 1) {
      if (this._events[eventName][i] !== listener) {
        temp.push(this._events[eventName][i]);
      }
    }

    this._events[eventName] = temp;
  }

  // @type (CustomEvent) => void
  dispatchEvent(event) {
    if (!this._events) {
      return;
    }

    let listeners = this._events[event.type];

    if (!listeners) {
      return;
    }

    // If there is an error in any of the listeners then it will be thrown only after all listeners were fired,
    // this is necesarry to prevent error in one listener from stopping all subsequent listeners

    let catchedError = null;

    for (let i = listeners.length-1; i >= 0; i -= 1) {
      let listener = listeners[i];
      let result;

      try {
        result = listener.call(window, event);
      }
      catch (error) {
        if (catchedError === null) {
          catchedError = error;
        }
      }

      // Stop event propagation if listener returns false
      if (result === false) {
        break;
      }
    }

    if (catchedError) {
      throw catchedError;
    }
  }
}
