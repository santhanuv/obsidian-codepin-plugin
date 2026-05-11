export const ParseErrors = {
  invalidFieldFormat: (line: string) =>
    `Invalid field format. Expected 'key: value': '${line}'`,

  missingField: (field: string) => `Missing required field: '${field}'.`,

  missingValue: (field: string) =>
    `Field '${field}' requires a non-empty value.`,

  duplicateField: (field: string) => `Duplicate field: '${field}'.`,

  unknownField: (field: string) => `Unknown field: '${field}'.`,

  invalidMode: () => "Invalid 'mode' value. Expected 'code' or 'diff'.",

  invalidContext: () =>
    "Invalid 'context' value. Expected a non-negative number.",

  invalidLinesFormat: () => "Invalid 'lines' format. Expected 'start-end'.",

  invalidLineRange: () =>
    "Invalid 'lines' range. Start line must be less than or equal to end line.",

  conflictingRef: () => "Cannot specify both 'branch' and 'commit'.",
};
