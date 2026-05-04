// Redirect console.log and console.error to stderr to avoid interfering with MCP protocol messages
// MCP uses stdout for protocol communication

export function configureLogger() {
  console.log = function(...args: any[]) {
    process.stderr.write("[INFO] " + args.join(" ") + "\n");
  };

  console.error = function(...args: any[]) {
    process.stderr.write("[ERROR] " + args.join(" ") + "\n");
  };
}
