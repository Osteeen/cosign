import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type StoreRef = {
  id: string;
  name: string;
  website: string | null;
};

export const storeRefSchema: Schema<StoreRef> = s.object<StoreRef>({
  id: s.string(),
  name: s.string(),
  website: s.nullable(s.string()),
});
