declare module "tesseract.js" {
  export function createWorker(options?: any): any;
}

declare module "mailparser" {
  export function simpleParser(input: any, options?: any): Promise<any>;
}
