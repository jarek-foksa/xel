
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import StringScanner from "./string-scanner.js";
import TokensScanner from "./tokens-scanner.js";

import {replaceAll} from "../utils/string.js";

export default class ApiParser {
  _source = null;
  _stringScanner = null;
  _tokensScanner = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  parse(source) {
    this._source = source;
    this._stringScanner = new StringScanner(this._source);

    let tokens = [];

    // Tokenize the source code
    {
      while (true) {
        this._stringScanner.eatWhitespace();

        if (this._stringScanner.peek() === null) {
          break;
        }
        else if (this._stringScanner.peek(4) === "// @") {
          tokens.push(this._readAtToken());
        }
        else if (this._stringScanner.peek(3) === "// ") {
          tokens.push(this._readCommentToken());
        }
        else {
          tokens.push(this._readCodeToken());
        }
      }

      tokens.push({type: "EOF"});
    }

    // Parse the tokens
    {
      this._tokensScanner = new TokensScanner(tokens);

      let elementMeta = {};
      let properties = [];
      let methods = [];

      while (true) {
        this._tokensScanner.read();

        if (this._tokensScanner.currentToken.type === "AT") {
          if (this._tokensScanner.currentToken.name === "element") {
            elementMeta = this._parseElementMeta();
          }
          else if (this._tokensScanner.currentToken.name === "property") {
            let propertyMeta = this._parsePropertyMeta();
            properties.push(propertyMeta);
          }
          else if (this._tokensScanner.currentToken.name === "method") {
            let methodMeta = this._parseMethodMeta();
            methods.push(methodMeta);
          }
        }
        else if (this._tokensScanner.currentToken.type === "EOF") {
          break;
        }
      }

      elementMeta.properties = properties;
      elementMeta.methods = methods;

      return elementMeta;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _readAtToken() {
    let token = {type: "AT", name: "", value: ""};
    let currentLine = 0;

    // Read first line
    {
      this._stringScanner.read("// @".length);

      while (this._stringScanner.peek(1) !== " " && this._stringScanner.peek(1) !== "\n") {
        token.name += this._stringScanner.read();
      }

      this._stringScanner.eatSpaces();

      while (this._stringScanner.peek(1) !== "\n") {
        token.value += this._stringScanner.read();
      }

      this._stringScanner.read();
      currentLine += 1;
    }

    // Read subsequent lines
    {
      while (true) {
        this._stringScanner.storePosition();
        this._stringScanner.eatSpaces();

        if (this._stringScanner.peek(2) === "//") {
          this._stringScanner.read(2);

          let whitespace = this._stringScanner.eatSpaces();

          if (whitespace.length !== 3 && whitespace.length !== 0) {
            this._stringScanner.restorePosition();
            break;
          }

          if (this._stringScanner.peek(1) !== "@") {
            if (currentLine > 1) {
              token.value += "\n";
            }

            while (this._stringScanner.peek(1) !== "\n") {
              token.value += this._stringScanner.read();
            }

            this._stringScanner.read();
            currentLine += 1;
          }
          else {
            this._stringScanner.restorePosition();
            break;
          }
        }
        else {
          this._stringScanner.restorePosition();
          break;
        }
      }
    }

    return token;
  }

  _readCommentToken() {
    let token = {type: "COMMENT", value: ""};
    let currentLine = 0;

    // Read first line
    {
      this._stringScanner.read("// ".length);

      while (this._stringScanner.peek(1) !== "\n") {
        token.value += this._stringScanner.read();
      }

      this._stringScanner.read();
      currentLine += 1;
    }

    // Read subsequent lines
    {
      while (true) {
        this._stringScanner.storePosition();
        this._stringScanner.eatSpaces();

        if (this._stringScanner.peek(2) === "//") {
          this._stringScanner.read(2);

          let whitespace = this._stringScanner.eatSpaces();

          if (whitespace.length !== 1 && whitespace.length !== 0) {
            this._stringScanner.restorePosition();
            break;
          }
          else if (this._stringScanner.peek(1) === "@") {
            this._stringScanner.restorePosition();
            break;
          }
          else {
            if (currentLine >= 1) {
              token.value += "\n";
            }

            while (this._stringScanner.peek(1) !== "\n") {
              token.value += this._stringScanner.read();
            }

            this._stringScanner.read();
            currentLine += 1;
          }
        }
        else {
          this._stringScanner.restorePosition();
          break;
        }
      }
    }

    return token;
  }

  _readCodeToken() {
    let token = {type: "CODE", value: ""};

    while (this._stringScanner.peek(3) !== "// " && this._stringScanner.peek(3) !== null) {
      token.value += this._stringScanner.read();
    }

    return token;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _parseElementMeta() {
    let meta = {
      elementName: this._tokensScanner.currentToken.value,
      className: "",
      events: [],
      parts: []
    };

    while (true) {
      this._tokensScanner.read();

      if (this._tokensScanner.currentToken.type === "AT") {
        if (this._tokensScanner.currentToken.name === "event") {
          let [name, description] = this._tokensScanner.currentToken.value.split(" - ");
          let bubbles = false;

          if (name.startsWith("^")) {
            name = name.substring(1);
            bubbles = true;
          }

          meta.events.push({
            name: name,
            description: description || "",
            bubbles: bubbles
          });
        }
        else if (this._tokensScanner.currentToken.name === "part") {
          let [name, description] = this._tokensScanner.currentToken.value.split(" - ");

          meta.parts.push({
            name: name,
            description: description || ""
          });
        }
      }
      else if (this._tokensScanner.currentToken.type === "CODE") {
        if (meta.elementName === "dialog") {
          meta.className = "HTMLDialogElement";
          break;
        }
        else {
          let value = this._tokensScanner.currentToken.value;
          let startIndex = value.indexOf("class ") + 6;
          let endIndex = value.indexOf(" ", startIndex);
          meta.className = value.substring(startIndex, endIndex);
          break;
        }
      }
      else if (this._tokensScanner.currentToken.type === "EOF") {
        break;
      }
    }

    return meta;
  }

  _parsePropertyMeta() {
    let meta = {
      propertyName: "",
      attributeName: null,
      type: undefined,
      default: undefined,
      readOnly: false,
      description: ""
    };

    while (true) {
      this._tokensScanner.read();

      if (this._tokensScanner.currentToken.type === "AT") {
        if (this._tokensScanner.currentToken.name === "attribute") {
          if (this._tokensScanner.currentToken.value === "") {
            meta.attributeName = "";
          }
          else {
            meta.attributeName = this._tokensScanner.currentToken.value;
          }
        }
        else if (this._tokensScanner.currentToken.name === "type") {
          let value = this._tokensScanner.currentToken.value;
          value = replaceAll(value, "\n", " ");

          if (value.includes(" || ")) {
            meta.type = value.split(" || ");
          }
          else {
            meta.type = value;
          }
        }
        else if (this._tokensScanner.currentToken.name === "default") {
          meta.default = this._tokensScanner.currentToken.value;
        }
        else if (this._tokensScanner.currentToken.name === "readOnly") {
          meta.readOnly = true;
        }
      }
      else if (this._tokensScanner.currentToken.type === "COMMENT") {
        meta.description = this._tokensScanner.currentToken.value;
      }
      else if (this._tokensScanner.currentToken.type === "CODE") {
        let value = this._tokensScanner.currentToken.value;
        let startIndex = value.indexOf("get ") + 4;
        let endIndex = value.indexOf("(", startIndex);
        meta.propertyName = value.substring(startIndex, endIndex);
        break;
      }
      else if (this._tokensScanner.currentToken.type === "EOF") {
        break;
      }
    }

    if (meta.attributeName === "") {
      meta.attributeName = meta.propertyName.toLowerCase();
    }

    return meta;
  }

  _parseMethodMeta() {
    let meta = {
      name: "",
      type: undefined,
      description: ""
    };

    while (true) {
      this._tokensScanner.read();

      if (this._tokensScanner.currentToken.type === "AT") {
        if (this._tokensScanner.currentToken.name === "type") {
          meta.type = this._tokensScanner.currentToken.value;
        }
      }
      else if (this._tokensScanner.currentToken.type === "COMMENT") {
        meta.description = this._tokensScanner.currentToken.value;
      }
      else if (this._tokensScanner.currentToken.type === "CODE") {
        let value = this._tokensScanner.currentToken.value;
        let startIndex = 0;
        let endIndex = value.indexOf(") {\n", startIndex) + 1;

        meta.name = value.substring(startIndex, endIndex);
        break;
      }
      else if (this._tokensScanner.currentToken.type === "EOF") {
        break;
      }
    }

    return meta;
  }
}
