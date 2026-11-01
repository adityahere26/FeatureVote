// Turns database errors into messages that are safe and useful to show.
export function describeDatabaseError(error) {
  if (error.hint === "last_owner") {
    return "A workspace must keep at least one owner. Make someone else an owner first.";
  }
  switch (error.code) {
    case "23505":
      return "That URL is already taken.";
    case "23514":
    case "22023":
      return "Please check what you entered.";
    case "42501":
      return "You don't have permission to do that.";
    case "P0002":
      return "That no longer exists.";
    default:
      return "Something went wrong. Please try again.";
  }
}
