/** Generator metadata and compatibility expectations. */
export const GENERATOR_ARTIFACT_VERSION = "1";
export const STELLARMCP_GENERATOR_SEMVER = "0.1.7";
export const SPEC_FINGERPRINT = "8eb756002ea822fe";
/**
 * Compatibility: this layout (artifact v1) targets MCP SDK and Stellar SDK versions
 * pinned by the generating StellarMCP release (`0.1.7`). Re-run code generation after upgrading
 * the parent generator or changing the contract interface.
 */
export const COMPATIBILITY_NOTE =
  "Generated package must use the same major MCP protocol expectations as @modelcontextprotocol/sdk v1.x and @stellar/stellar-sdk v14.x family unless you regenerate with a newer stellarmcp-generate.";
