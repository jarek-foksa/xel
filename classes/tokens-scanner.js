
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

export default class TokensScanner {
  constructor(tokens) {
    this._tokens = tokens;
    this.currentToken = null;
    this.position = 0;
  }

  read() {
    let token = this._tokens[this.position];
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
