// Minimal structural types over playwright-chromium so live-browser.ts has
// type safety without taking a hard dep on the package (which is dynamically
// loaded from cacheDir at runtime). If Playwright's surface shifts, only this
// file needs updating.

export interface PwConsoleMessageLocation {
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

export interface PwConsoleMessage {
  type(): string;
  text(): string;
  location(): PwConsoleMessageLocation;
}

export interface PwRequest {
  url(): string;
  method(): string;
  resourceType(): string;
  failure(): { readonly errorText: string } | null;
}

export interface PwResponseLike {
  url(): string;
  status(): number;
  headers(): Record<string, string>;
}

export interface PwPage {
  goto(url: string, opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<PwResponseLike | null>;
  evaluate<T>(fn: string | (() => T | Promise<T>)): Promise<T>;
  addScriptTag(opts: { path?: string; content?: string; url?: string }): Promise<unknown>;
  screenshot(opts?: { path?: string; fullPage?: boolean; type?: 'png' | 'jpeg' }): Promise<Buffer>;
  on(event: 'console', handler: (msg: PwConsoleMessage) => void): void;
  on(event: 'pageerror', handler: (err: Error) => void): void;
  on(event: 'requestfailed', handler: (req: PwRequest) => void): void;
  on(event: 'response', handler: (res: PwResponseLike) => void): void;
  url(): string;
  close(): Promise<void>;
}

export interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}

export interface PwBrowser {
  newContext(opts?: {
    viewport?: { width: number; height: number };
    userAgent?: string;
    deviceScaleFactor?: number;
  }): Promise<PwContext>;
  close(): Promise<void>;
}

export interface PwChromiumModule {
  chromium: {
    launch(opts?: { headless?: boolean; timeout?: number }): Promise<PwBrowser>;
  };
}
