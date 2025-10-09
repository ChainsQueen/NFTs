import "abitype";
import "~~/node_modules/viem/node_modules/abitype";

declare module "abitype" {
  export interface Register {
    AddressType: string;
  }
}

declare module "~~/node_modules/viem/node_modules/abitype" {
  export interface Register {
    AddressType: string;
  }
}
