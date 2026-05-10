export const ParseErrors = {
  missingField: (field: string) => `Missing required field: '${field}'.`,

  invalidMode: () => "Invalid 'mode' value. Expected 'code' or 'diff'.",

  invalidContext: () =>
    "Invalid 'context' value. Expected a non-negative number.",

  invalidLinesFormat: () => "Invalid 'lines' format. Expected 'start-end'.",

  invalidLineRange: () =>
    "Invalid 'lines' range. Start line must be less than or equal to end line.",
};
