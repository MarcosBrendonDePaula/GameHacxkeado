declare module "bn.js" {
  export default class BN {
    constructor(value?: number | string | number[] | Uint8Array, base?: number, endian?: "le" | "be");
    toString(base?: number): string;
  }
}
