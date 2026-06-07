/**
 * Opens resources in the OS-default handler (browser, etc.). Concrete impl
 * wraps Electron's `shell`; kept behind a port so services stay free of
 * `electron` imports (hexagonal rule).
 */
export interface ShellPort {
  /** Opens a URL in the user's default browser. */
  openExternal(url: string): Promise<void>;
}
