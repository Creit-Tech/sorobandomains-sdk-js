export class Domain404Error extends Error {
  constructor() {
    super("Domain doesn't exist");
    this.name = Domain404Error.name;
  }
}
