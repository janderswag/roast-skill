declare module 'qrcode-terminal' {
  interface GenerateOptions {
    small?: boolean;
  }
  export function generate(input: string, opts?: GenerateOptions, cb?: (qr: string) => void): void;
  export function generate(input: string, cb?: (qr: string) => void): void;
  export function setErrorLevel(level: 'L' | 'M' | 'Q' | 'H'): void;
  const _default: { generate: typeof generate; setErrorLevel: typeof setErrorLevel };
  export default _default;
}
