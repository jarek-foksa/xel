
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import StringScanner from "./string-scanner.js";
import TokensScanner from "./tokens-scanner.js";

export default class ChangelogParser {
  #source = null;
  #stringScanner = null;
  #tokensScanner = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  parse(source) {
    this.#source = source;
    this.#stringScanner = new StringScanner(this.#source);

    let tokens = [];
    let releases = [];

    // Tokenize the markdown source
    {
      while (true) {
        if (this.#stringScanner.peek() === null) {
          break;
        }
        if (this.#stringScanner.peek(13) === "\n# ") {
          tokens.push(this.#readTitleToken());
        }
        else if (this.#stringScanner.peek(4) === "\n## ") {
          tokens.push(this.#readSubtitleToken());
        }
        else if (this.#stringScanner.peek(3) === "\n- ") {
          tokens.push(this.#readItemToken());
        }
        else {
          this.#stringScanner.read();
        }
      }

      tokens.push({type: "EOF"});
    }

    // Parse the tokens
    {
      this.#tokensScanner = new TokensScanner(tokens);

      let release = null;

      while (true) {
        this.#tokensScanner.read();

        if (this.#tokensScanner.currentToken.type === "SUBTITLE") {
          release = {
            version: this.#tokensScanner.currentToken.version,
            date: this.#tokensScanner.currentToken.date,
            items: []
          };

          releases.push(release);
        }
        else if (this.#tokensScanner.currentToken.type === "ITEM") {
          release.items.push({
            tags: this.#tokensScanner.currentToken.tags,
            text: this.#tokensScanner.currentToken.text
          });
        }
        else if (this.#tokensScanner.currentToken.type === "EOF") {
          break;
        }
      }
    }

    return releases;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #readTitleToken() {
    let title = "";

    this.#stringScanner.read(3);
    this.#stringScanner.eatSpaces();

    while (this.#stringScanner.peek(1) !== "\n") {
      title += this.#stringScanner.read();
    }

    this.#stringScanner.eatSpaces();

    return {type: "TITLE", text};
  }

  #readSubtitleToken() {
    let version = "";
    let date = "";

    this.#stringScanner.read(4);
    this.#stringScanner.eatSpaces();

    while (
      this.#stringScanner.peek(1) !== "\n" &&
      this.#stringScanner.peek(1) !== "(" &&
      this.#stringScanner.peek(1) !== " "
    ) {
      version += this.#stringScanner.read();
    }

    this.#stringScanner.eatSpaces();

    if (this.#stringScanner.peek(1) === "(") {
      this.#stringScanner.read(1);
      this.#stringScanner.eatSpaces();

      while (
        this.#stringScanner.peek(1) !== "\n" &&
        this.#stringScanner.peek(1) !== ")" &&
        this.#stringScanner.peek(1) !== " "
      ) {
        date += this.#stringScanner.read();
      }
    }

    this.#stringScanner.eatSpaces();
    return {type: "SUBTITLE", version, date};
  }

  #readItemToken() {
    let text = "";
    let tags = [];

    this.#stringScanner.read(3);
    this.#stringScanner.eatSpaces();

    // Read tags
    while (this.#stringScanner.peek(1) === "[") {
      let tag = "";

      this.#stringScanner.read(1);
      this.#stringScanner.eatSpaces();

      while (
        this.#stringScanner.peek(1) !== "\n" &&
        this.#stringScanner.peek(1) !== "]"
      ) {
        tag += this.#stringScanner.read(1);
      }

      this.#stringScanner.eatSpaces();

      if (this.#stringScanner.peek(1) === "]") {
        this.#stringScanner.read(1);
      }

      this.#stringScanner.eatSpaces();
      tags.push(tag);
    }

    this.#stringScanner.eatSpaces();

    // Read text
    while (true) {
      if (this.#stringScanner.peek(1) === null) {
        break;
      }
      else if (this.#stringScanner.peek(1) === "\n") {
        if (this.#stringScanner.peek(3) === "\n  ") {
          this.#stringScanner.read(3);

          if (this.#stringScanner.peek(1) === null || this.#stringScanner.peek(1) === "\n") {
            break;
          }
          else {
            text += " ";
            text += this.#stringScanner.read(1);
          }
        }
        else {
          break;
        }
      }
      else {
        text += this.#stringScanner.read(1);
      }
    }

    return {type: "ITEM", text, tags};
  }
}
