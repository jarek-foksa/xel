
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

export default class TokensScanner {
  currentToken = null;
  position = 0;
  #tokens = null;

  constructor(tokens) {
    this.#tokens = tokens;
  }

  read() {
    let token = this.#tokens[this.position];
    this.currentToken = token;

    if (token.type === "EOF") {
      return token;
    }
    else {
      this.position += 1;
      return token;
    }
  }

  reset(position){
    this.position = position;
  }
}
