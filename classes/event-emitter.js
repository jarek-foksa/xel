
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

export default class EventEmitter {
  #events = {};

  // @type (string, Function) => void
  addEventListener(eventName, listener) {
    if (!this.#events) {
      this.#events = {};
    }

    let listeners = this.#events[eventName];

    if (!listeners) {
      this.#events[eventName] = listeners = [];
    }

    listeners.push(listener);

    if (listeners.length > 10000) {
      console.warn(`Potential EventEmitter memory leak: ${listeners.length} listeners ` +
                   `subscribed to event "${eventName}"`);
    }
  }

  // @type (string, Function) => void
  removeEventListener(eventName, listener) {
    if (!this.#events || !this.#events[eventName]) {
      return;
    }

    var temp = [];

    for (var i = 0; i < this.#events[eventName].length; i += 1) {
      if (this.#events[eventName][i] !== listener) {
        temp.push(this.#events[eventName][i]);
      }
    }

    this.#events[eventName] = temp;
  }

  // @type (CustomEvent) => void
  dispatchEvent(event) {
    if (!this.#events) {
      return;
    }

    let listeners = this.#events[event.type];

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
