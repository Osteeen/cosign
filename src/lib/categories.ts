// Purchase categories as people read them. One list for the slip form, the
// agent page and the rules engine's reasons (no imports, so the rules engine
// and its plain-node tests can use it).

export const CATEGORY_LABELS: Record<string, string> = {
  office_supplies: "Office supplies",
  groceries: "Groceries",
  food_and_drink: "Food and drink",
  travel: "Travel",
  software: "Software",
  electronics: "Electronics",
  household: "Household",
  other: "Other",
};

export const categoryLabel = (code: string) => CATEGORY_LABELS[code] ?? code.replace(/_/g, " ");

// Stored as a slip's "In your words" when the owner filled in the form without
// writing any; screens show nothing for it rather than quoting it.
export const SLIP_FORM_SOURCE = "Set by the owner on the slip form";
