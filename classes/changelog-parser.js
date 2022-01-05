
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import StringScanner from "./string-scanner.js";
import TokensScanner from "./tokens-scanner.js";

export default class ChangelogParser {
  _source = null;
  _stringScanner = null;
  _tokensScanner = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  parse(source) {
    this._source = source;
    this._stringScanner = new StringScanner(this._source);

    let tokens = [];
    let releases = [];

    // Tokenize the markdown source
    {
      while (true) {
        if (this._stringScanner.peek() === null) {
          break;
        }
        if (this._stringScanner.peek(13) === "\n# ") {
          tokens.push(this._readTitleToken());
        }
        else if (this._stringScanner.peek(4) === "\n## ") {
          tokens.push(this._readSubtitleToken());
        }
        else if (this._stringScanner.peek(3) === "\n- ") {
          tokens.push(this._readItemToken());
        }
        else {
          this._stringScanner.read();
        }
      }

      tokens.push({type: "EOF"});
    }

    // Parse the tokens
    {
      this._tokensScanner = new TokensScanner(tokens);

      let release = null;

      while (true) {
        this._tokensScanner.read();

        if (this._tokensScanner.currentToken.type === "SUBTITLE") {
          release = {
            version: this._tokensScanner.currentToken.version,
            date: this._tokensScanner.currentToken.date,
            items: []
          };

          releases.push(release);
        }
        else if (this._tokensScanner.currentToken.type === "ITEM") {
          release.items.push({
            tags: this._tokensScanner.currentToken.tags,
            text: this._tokensScanner.currentToken.text
          });
        }
        else if (this._tokensScanner.currentToken.type === "EOF") {
          break;
        }
      }
    }

    return releases;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _readTitleToken() {
    let title = "";

    this._stringScanner.read(3);
    this._stringScanner.eatSpaces();

    while (this._stringScanner.peek(1) !== "\n") {
      title += this._stringScanner.read();
    }

    this._stringScanner.eatSpaces();

    return {type: "TITLE", text};
  }

  _readSubtitleToken() {
    let version = "";
    let date = "";

    this._stringScanner.read(4);
    this._stringScanner.eatSpaces();

    while (
      this._stringScanner.peek(1) !== "\n" &&
      this._stringScanner.peek(1) !== "(" &&
      this._stringScanner.peek(1) !== " "
    ) {
      version += this._stringScanner.read();
    }

    this._stringScanner.eatSpaces();

    if (this._stringScanner.peek(1) === "(") {
      this._stringScanner.read(1);
      this._stringScanner.eatSpaces();

      while (
        this._stringScanner.peek(1) !== "\n" &&
        this._stringScanner.peek(1) !== ")" &&
        this._stringScanner.peek(1) !== " "
      ) {
        date += this._stringScanner.read();
      }
    }

    this._stringScanner.eatSpaces();
    return {type: "SUBTITLE", version, date};
  }

  _readItemToken() {
    let text = "";
    let tags = [];

    this._stringScanner.read(3);
    this._stringScanner.eatSpaces();

    // Read tags
    while (this._stringScanner.peek(1) === "[") {
      let tag = "";

      this._stringScanner.read(1);
      this._stringScanner.eatSpaces();

      while (
        this._stringScanner.peek(1) !== "\n" &&
        this._stringScanner.peek(1) !== "]"
      ) {
        tag += this._stringScanner.read(1);
      }

      this._stringScanner.eatSpaces();

      if (this._stringScanner.peek(1) === "]") {
        this._stringScanner.read(1);
      }

      this._stringScanner.eatSpaces();
      tags.push(tag);
    }

    this._stringScanner.eatSpaces();

    // Read text
    while (true) {
      if (this._stringScanner.peek(1) === null) {
        break;
      }
      else if (this._stringScanner.peek(1) === "\n") {
        if (this._stringScanner.peek(3) === "\n  ") {
          this._stringScanner.read(3);

          if (this._stringScanner.peek(1) === null || this._stringScanner.peek(1) === "\n") {
            break;
          }
          else {
            text += " ";
            text += this._stringScanner.read(1);
          }
        }
        else {
          break;
        }
      }
      else {
        text += this._stringScanner.read(1);
      }
    }

    return {type: "ITEM", text, tags};
  }
}
