
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import StringScanner from "./string-scanner.js";
import TokensScanner from "./tokens-scanner.js";

import {replaceAll} from "../utils/string.js";

export default class ApiParser {
  #source = null;
  #stringScanner = null;
  #tokensScanner = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  parse(source) {
    this.#source = source;
    this.#stringScanner = new StringScanner(this.#source);

    let tokens = [];

    // Tokenize the source code
    {
      while (true) {
        this.#stringScanner.eatWhitespace();

        if (this.#stringScanner.peek() === null) {
          break;
        }
        else if (this.#stringScanner.peek(4) === "// @") {
          tokens.push(this.#readAtToken());
        }
        else if (this.#stringScanner.peek(3) === "// ") {
          tokens.push(this.#readCommentToken());
        }
        else {
          tokens.push(this.#readCodeToken());
        }
      }

      tokens.push({type: "EOF"});
    }

    // Parse the tokens
    {
      this.#tokensScanner = new TokensScanner(tokens);

      let elementMeta = {};
      let properties = [];
      let methods = [];

      while (true) {
        this.#tokensScanner.read();

        if (this.#tokensScanner.currentToken.type === "AT") {
          if (this.#tokensScanner.currentToken.name === "element") {
            elementMeta = this.#parseElementMeta();
          }
          else if (this.#tokensScanner.currentToken.name === "property") {
            let propertyMeta = this.#parsePropertyMeta();
            properties.push(propertyMeta);
          }
          else if (this.#tokensScanner.currentToken.name === "method") {
            let methodMeta = this.#parseMethodMeta();
            methods.push(methodMeta);
          }
        }
        else if (this.#tokensScanner.currentToken.type === "EOF") {
          break;
        }
      }

      elementMeta.properties = properties;
      elementMeta.methods = methods;

      return elementMeta;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #readAtToken() {
    let token = {type: "AT", name: "", value: ""};
    let currentLine = 0;

    // Read first line
    {
      this.#stringScanner.read("// @".length);

      while (this.#stringScanner.peek(1) !== " " && this.#stringScanner.peek(1) !== "\n") {
        token.name += this.#stringScanner.read();
      }

      this.#stringScanner.eatSpaces();

      while (this.#stringScanner.peek(1) !== "\n") {
        token.value += this.#stringScanner.read();
      }

      this.#stringScanner.read();
      currentLine += 1;
    }

    // Read subsequent lines
    {
      while (true) {
        this.#stringScanner.storePosition();
        this.#stringScanner.eatSpaces();

        if (this.#stringScanner.peek(2) === "//") {
          this.#stringScanner.read(2);

          let whitespace = this.#stringScanner.eatSpaces();

          if (whitespace.length !== 3 && whitespace.length !== 0) {
            this.#stringScanner.restorePosition();
            break;
          }

          if (this.#stringScanner.peek(1) !== "@") {
            if (currentLine > 1) {
              token.value += "\n";
            }

            while (this.#stringScanner.peek(1) !== "\n") {
              token.value += this.#stringScanner.read();
            }

            this.#stringScanner.read();
            currentLine += 1;
          }
          else {
            this.#stringScanner.restorePosition();
            break;
          }
        }
        else {
          this.#stringScanner.restorePosition();
          break;
        }
      }
    }

    return token;
  }

  #readCommentToken() {
    let token = {type: "COMMENT", value: ""};
    let currentLine = 0;

    // Read first line
    {
      this.#stringScanner.read("// ".length);

      while (this.#stringScanner.peek(1) !== "\n") {
        token.value += this.#stringScanner.read();
      }

      this.#stringScanner.read();
      currentLine += 1;
    }

    // Read subsequent lines
    {
      while (true) {
        this.#stringScanner.storePosition();
        this.#stringScanner.eatSpaces();

        if (this.#stringScanner.peek(2) === "//") {
          this.#stringScanner.read(2);

          let whitespace = this.#stringScanner.eatSpaces();

          if (whitespace.length !== 1 && whitespace.length !== 0) {
            this.#stringScanner.restorePosition();
            break;
          }
          else if (this.#stringScanner.peek(1) === "@") {
            this.#stringScanner.restorePosition();
            break;
          }
          else {
            if (currentLine >= 1) {
              token.value += "\n";
            }

            while (this.#stringScanner.peek(1) !== "\n") {
              token.value += this.#stringScanner.read();
            }

            this.#stringScanner.read();
            currentLine += 1;
          }
        }
        else {
          this.#stringScanner.restorePosition();
          break;
        }
      }
    }

    return token;
  }

  #readCodeToken() {
    let token = {type: "CODE", value: ""};

    while (this.#stringScanner.peek(3) !== "// " && this.#stringScanner.peek(3) !== null) {
      token.value += this.#stringScanner.read();
    }

    return token;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #parseElementMeta() {
    let meta = {
      elementName: this.#tokensScanner.currentToken.value,
      className: "",
      events: [],
      parts: []
    };

    while (true) {
      this.#tokensScanner.read();

      if (this.#tokensScanner.currentToken.type === "AT") {
        if (this.#tokensScanner.currentToken.name === "event") {
          let [name, description] = this.#tokensScanner.currentToken.value.split(" - ");
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
        else if (this.#tokensScanner.currentToken.name === "part") {
          let [name, description] = this.#tokensScanner.currentToken.value.split(" - ");

          meta.parts.push({
            name: name,
            description: description || ""
          });
        }
      }
      else if (this.#tokensScanner.currentToken.type === "CODE") {
        if (meta.elementName === "dialog") {
          meta.className = "HTMLDialogElement";
          break;
        }
        else {
          let value = this.#tokensScanner.currentToken.value;
          let startIndex = value.indexOf("class ") + 6;
          let endIndex = value.indexOf(" ", startIndex);
          meta.className = value.substring(startIndex, endIndex);
          break;
        }
      }
      else if (this.#tokensScanner.currentToken.type === "EOF") {
        break;
      }
    }

    return meta;
  }

  #parsePropertyMeta() {
    let meta = {
      propertyName: "",
      attributeName: null,
      type: undefined,
      default: undefined,
      readOnly: false,
      description: ""
    };

    while (true) {
      this.#tokensScanner.read();

      if (this.#tokensScanner.currentToken.type === "AT") {
        if (this.#tokensScanner.currentToken.name === "attribute") {
          if (this.#tokensScanner.currentToken.value === "") {
            meta.attributeName = "";
          }
          else {
            meta.attributeName = this.#tokensScanner.currentToken.value;
          }
        }
        else if (this.#tokensScanner.currentToken.name === "type") {
          let value = this.#tokensScanner.currentToken.value;
          value = replaceAll(value, "\n", " ");

          if (value.includes(" || ")) {
            meta.type = value.split(" || ");
          }
          else {
            meta.type = value;
          }
        }
        else if (this.#tokensScanner.currentToken.name === "default") {
          meta.default = this.#tokensScanner.currentToken.value;
        }
        else if (this.#tokensScanner.currentToken.name === "readOnly") {
          meta.readOnly = true;
        }
      }
      else if (this.#tokensScanner.currentToken.type === "COMMENT") {
        meta.description = this.#tokensScanner.currentToken.value;
      }
      else if (this.#tokensScanner.currentToken.type === "CODE") {
        let value = this.#tokensScanner.currentToken.value;
        let startIndex = value.indexOf("get ") + 4;
        let endIndex = value.indexOf("(", startIndex);
        meta.propertyName = value.substring(startIndex, endIndex);
        break;
      }
      else if (this.#tokensScanner.currentToken.type === "EOF") {
        break;
      }
    }

    if (meta.attributeName === "") {
      meta.attributeName = meta.propertyName.toLowerCase();
    }

    return meta;
  }

  #parseMethodMeta() {
    let meta = {
      name: "",
      type: undefined,
      description: ""
    };

    while (true) {
      this.#tokensScanner.read();

      if (this.#tokensScanner.currentToken.type === "AT") {
        if (this.#tokensScanner.currentToken.name === "type") {
          meta.type = this.#tokensScanner.currentToken.value;
        }
      }
      else if (this.#tokensScanner.currentToken.type === "COMMENT") {
        meta.description = this.#tokensScanner.currentToken.value;
      }
      else if (this.#tokensScanner.currentToken.type === "CODE") {
        let value = this.#tokensScanner.currentToken.value;
        let startIndex = 0;
        let endIndex = value.indexOf(") {\n", startIndex) + 1;

        meta.name = value.substring(startIndex, endIndex);
        break;
      }
      else if (this.#tokensScanner.currentToken.type === "EOF") {
        break;
      }
    }

    return meta;
  }
}
