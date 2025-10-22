
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

export default class StringScanner {
  text = "";
  cursor = 0;
  line = 1;
  column = 1;
  #storedPosition = {cursor: 0, line: 1, column: 1};

  /**
   * @param {string} text
   */
  constructor(text) {
    this.text = text;
  }

  /**
   * Read given number of chars.
   *
   * @type {(i?: number) => string | null}
   */
  read(i = 1) {
    let string = "";
    let initialCursor = this.cursor;

    for (let j = 0; j < i; j += 1) {
      let c = this.text[initialCursor + j];

      if (c === undefined) {
        break;
      }
      else {
        string += c;
        this.cursor += 1;

        if (c === "\n"){
          this.line += 1;
          this.column = 1;
        }
        else {
          this.column += 1;
        }
      }
    }

    return (string === "" ? null : string);
  }

  /**
   * Read given number of chars without advancing the cursor.
   *
   * @type {(i?: number) => string | null}
   */
  peek(i = 1) {
    let string = "";

    for (let j = 0; j < i; j += 1) {
      let c = this.text[this.cursor + j];

      if (c === undefined) {
        break;
      }
      else {
        string += c;
      }
    }

    return (string === "" ? null : string);
  }

  /**
   * Continue reading the chars as long as they are spaces.
   *
   * @type {() => string}
   */
  eatSpaces() {
    let spaces = "";

    while (this.peek() === " ") {
      spaces += this.read();
    }

    return spaces;
  }

  /**
   * Continue reading the chars as long as they are spaces or new line chars.
   *
   * @type {() => string}
   */
  eatWhitespace() {
    let whitespace = "";

    while (this.peek() === " " || this.peek() === "\n") {
      whitespace += this.read();
    }

    return whitespace;
  }

  /**
   * @type {() => void}
   */
  storePosition() {
    let {cursor, line, column} = this;
    this.#storedPosition = {cursor, line, column};
  }

  /**
   * @type {() => void}
   */
  restorePosition() {
    let {cursor, line, column} = this.#storedPosition;

    this.cursor = cursor;
    this.line = line;
    this.column = column;
  }
}
