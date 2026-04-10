declare const process: {
  argv: string[]
  exitCode?: number
  stdout: {
    write(chunk: string): boolean
  }
  stderr: {
    write(chunk: string): boolean
  }
}

export const AGENT_PASSPORT_CLI_COMMANDS = [
  "agent_register",
  "agent_query",
  "agent_list",
  "agent_rate",
  "agent_interactions",
] as const

export type AgentPassportCliCommand =
  (typeof AGENT_PASSPORT_CLI_COMMANDS)[number]

function isAgentPassportCliCommand(
  value: string,
): value is AgentPassportCliCommand {
  return AGENT_PASSPORT_CLI_COMMANDS.includes(value as AgentPassportCliCommand)
}

function buildUsage(): string {
  return [
    "Usage: npm run cli -- <command>",
    "",
    "Available commands:",
    ...AGENT_PASSPORT_CLI_COMMANDS.map((command) => `  - ${command}`),
  ].join("\n")
}

function writeStdoutLine(message: string): void {
  process.stdout.write(`${message}\n`)
}

function writeStderrLine(message: string): void {
  process.stderr.write(`${message}\n`)
}

export function runCli(argv: string[]): number {
  const command = argv[0]

  if (command === undefined || command === "help" || command === "--help") {
    writeStdoutLine(buildUsage())
    return 0
  }

  if (!isAgentPassportCliCommand(command)) {
    writeStderrLine(`Unknown command: ${command}`)
    writeStderrLine("")
    writeStderrLine(buildUsage())
    return 1
  }

  writeStderrLine(`Command not implemented yet: ${command}`)
  return 1
}

if (process.argv[1]?.endsWith("src/cli/index.ts")) {
  process.exitCode = runCli(process.argv.slice(2))
}
