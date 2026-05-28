/**
 * Executable Tool Contracts
 *
 * Schema for defining tool behavior.
 * Contracts are used to generate deterministic system prompts.
 */

export interface PathRules {
  absolute: boolean;
  relative: boolean;
  tildeExpansion: boolean;
  whitespace: "quoted" | "escaped" | "none";
  normalization: "standard" | "none";
  invalidExamples: string[];
}

export interface OutputContract {
  success: string;
  failure: string;
  empty: string;
  partial?: string;
}

export interface FailureContract {
  retriable: string[];
  nonRetriable: string[];
  retryLimit: number;
  permissionBehavior: string;
  malformedInputBehavior: string;
}

export interface ToolContract {
  name: string;
  description: string;
  schema: string;
  types: Record<string, string>;
  requiredArgs: string[];
  optionalArgs: string[];
  validFormats: string[];
  invalidFormats: string[];
  escapingRules: string;
  quotingRules: string;
  pathRules?: PathRules;
  output: OutputContract;
  failure: FailureContract;
  formatAnchors?: string[];
}

export const TOOL_CONTRACTS: ToolContract[] = [
  {
    name: "app",
    description: "Launch GUI application by alias.",
    schema: "app <alias>",
    types: { alias: "string" },
    requiredArgs: ["alias"],
    optionalArgs: [],
    validFormats: ["app firefox", "app code"],
    invalidFormats: ["app 'firefox'", 'app "code"', "app /usr/bin/firefox"],
    escapingRules: "None. Raw string only.",
    quotingRules:
      "Quotes strictly forbidden. Command parser fails if quotes detected.",
    output: {
      success: "Confirmation string: '[alias] launched'",
      failure: "Error string: 'Unknown application alias: [alias]'",
      empty: "N/A",
    },
    failure: {
      retriable: [],
      nonRetriable: ["Unknown alias", "Spawn failure"],
      retryLimit: 0,
      permissionBehavior: "N/A",
      malformedInputBehavior: "Returns exit code 2 and usage error.",
    },
    formatAnchors: ['{"tool":"app","args":"firefox"}'],
  },
  {
    name: "terminal",
    description: "Execute bash command.",
    schema: "terminal <command>",
    types: { command: "string" },
    requiredArgs: ["command"],
    optionalArgs: [],
    validFormats: [
      "terminal ls -la",
      "terminal pactl get-sink-volume @DEFAULT_SINK@",
    ],
    invalidFormats: ['terminal "ls -la"', "terminal `ls -la`"],
    escapingRules:
      "Standard bash escaping for internal characters. Tool arg itself is raw.",
    quotingRules:
      "Do not quote the whole command. Internal quotes must be escaped for bash.",
    output: {
      success: "Combined stdout/stderr string. Exit code 0.",
      failure: "Error message and stderr. Exit code non-zero.",
      empty: "Empty string if command produced no output.",
    },
    failure: {
      retriable: ["Timeout", "Syntax error (AI-correctable)"],
      nonRetriable: ["Permission denied", "Binary not found"],
      retryLimit: 2,
      permissionBehavior:
        "Triggers interactive Rofi confirmation if dangerous.",
      malformedInputBehavior: "Bash returns syntax error in stderr.",
    },
    formatAnchors: ['{"tool":"terminal","args":"ls -la"}'],
  },
  {
    name: "music",
    description: "Control media playback.",
    schema:
      'music {"action": "play"|"resume"|"pause"|"stop"|"next"|"prev"|"volume_up"|"volume_down"}',
    types: { action: "enum" },
    requiredArgs: ["action"],
    optionalArgs: [],
    validFormats: ['music {"action": "play"}', 'music {"action": "volume_up"}'],
    invalidFormats: ["music play", 'music "play"', "music volume_up"],
    escapingRules: "JSON-standard backslash escaping for quotes in payload.",
    quotingRules:
      "Arguments MUST be a valid JSON object string. Double quotes for keys and values.",
    output: {
      success: "Status message: 'Done' or track info.",
      failure: "Error string: 'No available media players found'.",
      empty: "N/A",
    },
    failure: {
      retriable: ["Backend timeout"],
      nonRetriable: ["Invalid action", "No active players"],
      retryLimit: 1,
      permissionBehavior: "N/A",
      malformedInputBehavior:
        "Falls back to string mapping or returns error if ambiguous.",
    },
    formatAnchors: ['{"tool":"music","args":"{\\"action\\":\\"play\\"}"}'],
  },
  {
    name: "clipboard",
    description: "Manage clipboard history.",
    schema: "clipboard get <ID> | list | clear | set <text>",
    types: { action: "enum", text: "string" },
    requiredArgs: ["action"],
    optionalArgs: ["text"],
    validFormats: [
      "clipboard get c12345b234c5a1b",
      "clipboard set Data to save",
    ],
    invalidFormats: [
      'clipboard "get"',
      "clipboard get blank",
      'clipboard set "Data to save"',
    ],
    escapingRules:
      "None for commands. 'set' captures all trailing text verbatim.",
    quotingRules:
      "Quotes strictly forbidden for command names. 'set' content should not be quoted.",
    output: {
      success:
        "Clipboard content (get), clipboard list with ID (list), or 'Done'.",
      failure: "Error string: 'clipcatctl exited with code [N]'.",
      empty: "Message: 'Clipboard history is empty'.",
    },
    failure: {
      retriable: ["Connection error to clipcatd"],
      nonRetriable: ["Content too large (>1MB)", "Invalid action"],
      retryLimit: 1,
      permissionBehavior: "Requires clipcatd access.",
      malformedInputBehavior:
        "Returns exit code 2 and 'Unknown clipboard action'.",
    },
    formatAnchors: ['{"tool":"clipboard","args":"list"}'],
  },
  {
    name: "notify",
    description: "Desktop notification.",
    schema: "notify <title>|<body>|<urgency>",
    types: { title: "string", body: "string", urgency: "low|normal|critical" },
    requiredArgs: ["title", "body"],
    optionalArgs: ["urgency"],
    validFormats: [
      "notify Title|Message|normal",
      "notify Alert|System offline|critical",
    ],
    invalidFormats: ["notify Title Message", 'notify "Title"|"Body"'],
    escapingRules: "None. Pipe (|) is the literal delimiter.",
    quotingRules:
      "Quotes forbidden. Quotes in title/body are treated as literal characters.",
    output: {
      success: "Status: 'Notification sent'.",
      failure: "Error string from dunstify.",
      empty: "N/A",
    },
    failure: {
      retriable: [],
      nonRetriable: ["Invalid urgency", "Dunstify not found"],
      retryLimit: 0,
      permissionBehavior: "N/A",
      malformedInputBehavior:
        "Returns error code 2 for invalid urgency or missing title/body.",
    },
    formatAnchors: ['{"tool":"notify","args":"Title|Message|normal"}'],
  },
  {
    name: "file",
    description: "Filesystem operations and search.",
    schema: "file <op> <args>",
    types: { op: "enum", args: "string" },
    requiredArgs: ["op"],
    optionalArgs: ["args"],
    validFormats: [
      "file read ~/file.txt",
      'file write /tmp/log.txt "Line 1\nLine 2"',
      'file search_name "config" base=~ limit=5 select=true',
    ],
    invalidFormats: ['file "read" file.txt', "file search_name config"],
    escapingRules:
      "Standard backslash escaping for quotes in paths/content. \\n supported in write.",
    quotingRules:
      "Paths or content with spaces MUST be enclosed in double quotes. Single quotes not supported.",
    pathRules: {
      absolute: true,
      relative: true,
      tildeExpansion: true,
      whitespace: "quoted",
      normalization: "standard",
      invalidExamples: ["/../../etc/passwd (traversal)", "'' (empty)"],
    },
    output: {
      success: "File content, listing, or '[count] matches found'.",
      failure:
        "Error: 'File not found', 'Permission denied', or 'Dangerous operation cancelled'.",
      empty: "Message: 'No matches found' or empty directory listing.",
      partial:
        "Truncated content/listing with '...' suffix if limits exceeded.",
    },
    failure: {
      retriable: ["File locked", "Temporary FS error"],
      nonRetriable: ["Path not found", "Access denied", "Dangerous path"],
      retryLimit: 1,
      permissionBehavior:
        "Triggers Rofi confirmation for critical paths (/, /etc, /root, etc.).",
      malformedInputBehavior:
        "Returns exit code 2 with specific missing argument label.",
    },
    formatAnchors: [
      '{"tool":"file","args":"search_name \\"budget.xlsx\\" base=~ limit=1"}',
      '{"tool":"file","args":"write \\"~/test.txt\\" \\"Line 1\\\\nLine 2\\""}',
    ],
  },
  {
    name: "math",
    description: "Evaluate a mathematical expression, equation, formula, or computation. Use this tool for ALL arithmetic, algebraic, scientific, statistical, unit conversion, and multi-step mathematical operations.",
    schema: "math <expression>",
    types: { expression: "string" },
    requiredArgs: ["expression"],
    optionalArgs: [],
    validFormats: [
      "math 2 + 2",
      "math sqrt(144)",
      "math sin(pi / 4)",
      "math 15% of 340",
      "math (3^4 - 12) / 7",
      "math log(1000, 10)",
      "math mean([4, 8, 15, 16, 23, 42])",
      "math factor(360)",
      "math 100 km to miles",
    ],
    invalidFormats: [
      "math '2 + 2'",
      "math \"sqrt(144)\"",
      "math $(echo 5+3)",
      "math factor(3.5)",
    ],
    escapingRules:
      "No quoting or shell escaping. Pass the expression as a plain string.",
    quotingRules:
      "Quotes forbidden. Do not wrap the expression in single or double quotes.",
    output: {
      success: "✓ {result}",
      failure: "❌ Math error: {reason}",
      empty: "N/A",
    },
    failure: {
      retriable: [],
      nonRetriable: [
        "ParseError",
        "DivisionByZero",
        "Overflow",
        "UnsupportedOperation",
      ],
      retryLimit: 0,
      permissionBehavior: "N/A - no filesystem or system access required",
      malformedInputBehavior:
        "Returns error code 2 with a ParseError message",
    },
    formatAnchors: [
      '{"tool":"math","args":"2 + 2"}',
      '{"tool":"math","args":"sqrt(2^10 + 144) / 3"}',
    ],
  },
];
