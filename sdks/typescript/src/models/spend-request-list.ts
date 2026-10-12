import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { spendRequestSchema, type SpendRequest } from "./spend-request.js";

/** A page of spend requests, newest first. */
export type SpendRequestList = {
  /** The requests. */
  data: SpendRequest[];
  /** Always null in this version. */
  nextCursor: string | null;
};

export const spendRequestListSchema: Schema<SpendRequestList> = s.object<SpendRequestList>({
  data: s.array(s.lazy(() => spendRequestSchema)),
  nextCursor: s.nullable(s.string()),
  _keysMap: {
    nextCursor: "next_cursor",
  },
});
