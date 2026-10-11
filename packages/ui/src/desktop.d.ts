export {};
declare global {
  interface Window {
    office?: {
      readonly desktop: true;
      readonly platform: string;
      waitForFullscreen(): Promise<void>;
    };
  }
}
