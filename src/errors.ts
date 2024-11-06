export class Domain404Error extends Error {
  constructor() {
    super("Domain doesn't exist");
    this.name = Domain404Error.name;
  }
}

export class DomainData404Error extends Error {
  constructor() {
    super("Domain data doesn't exist");
    this.name = DomainData404Error.name;
  }
}

export class ReverseDomain404Error extends Error {
  constructor() {
    super("Reverse domain doesn't exist");
    this.name = ReverseDomain404Error.name;
  }
}

export class DomainDataUnsupportedValueType extends Error {
  constructor() {
    super(`Supported data types are: Bytes, Number and String`);
    this.name = DomainDataUnsupportedValueType.name;
  }
}
