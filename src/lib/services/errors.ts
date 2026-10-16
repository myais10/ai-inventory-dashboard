/** An error whose message is safe and useful to show the user. Anything else is logged and genericised. */
export class UserError extends Error {}

export function userMessage(e: unknown) {
  if (e instanceof UserError) return e.message;
  if (e instanceof Error && e.name === "ZodError") return "Invalid input";
  console.error(e);
  return "Something went wrong — please try again";
}
