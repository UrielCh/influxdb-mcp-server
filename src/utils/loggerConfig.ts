/**
 * Configures the logger to redirect console.log and console.error to process.stderr.
 * This ensures that logs do not interfere with the MCP protocol on stdout.
 */
export function configureLogger(): void {
  // Capture original console methods before overriding
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  // Global override to stderr for all logging
  console.log = function(...args: unknown[]): void {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    process.stderr.write("[INFO] " + message + "\n");
  };

  console.error = function(...args: unknown[]): void {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    process.stderr.write("[ERROR] " + message + "\n");
  };

  console.warn = function(...args: unknown[]): void {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    process.stderr.write("[WARN] " + message + "\n");
  };

  console.info = function(...args: unknown[]): void {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    process.stderr.write("[INFO] " + message + "\n");
  };
}
