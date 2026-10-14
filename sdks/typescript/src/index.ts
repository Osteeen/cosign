export { CosignAgentApiClient } from "./client.js";
export type { ClientOptions } from "./client-options.js";

export type { BasicAuthCredentials, TokenProvider } from "./core/auth/credentials.js";

export { Authentication } from "./resources/authentication.js";
export { Agent } from "./resources/agent.js";
export { Products } from "./resources/products.js";
export { SpendRequests } from "./resources/spend-requests.js";

export { AgentStatus, agentStatusSchema } from "./models/agent-status.js";
export { agentTokenSchema, type AgentToken } from "./models/agent-token.js";
export { allowanceSchema, type Allowance } from "./models/allowance.js";
export { Category, categorySchema } from "./models/category.js";
export { Currency, currencySchema } from "./models/currency.js";
export { decisionSchema, type Decision } from "./models/decision.js";
export { DecisionOutcome, decisionOutcomeSchema } from "./models/decision-outcome.js";
export { intentCheckSchema, type IntentCheck } from "./models/intent-check.js";
export { IntentVerdict, intentVerdictSchema } from "./models/intent-verdict.js";
export { lineItemSchema, type LineItem } from "./models/line-item.js";
export { marketComparisonSchema, type MarketComparison } from "./models/market-comparison.js";
export { marketOfferSchema, type MarketOffer } from "./models/market-offer.js";
export { marketPricesSchema, type MarketPrices } from "./models/market-prices.js";
export { MarketVerdict, marketVerdictSchema } from "./models/market-verdict.js";
export { moneySchema, type Money } from "./models/money.js";
export { OrderStatus, orderStatusSchema } from "./models/order-status.js";
export { orderSummarySchema, type OrderSummary } from "./models/order-summary.js";
export { problemSchema, type Problem } from "./models/problem.js";
export { problemErrorSchema, type ProblemError } from "./models/problem-error.js";
export { productSearchSchema, type ProductSearch } from "./models/product-search.js";
export { reasonSchema, type Reason } from "./models/reason.js";
export { ReasonCode, reasonCodeSchema } from "./models/reason-code.js";
export { receiptSchema, type Receipt } from "./models/receipt.js";
export { rulesPreviewSchema, type RulesPreview } from "./models/rules-preview.js";
export { slipSchema, type Slip } from "./models/slip.js";
export { spendRequestSchema, type SpendRequest } from "./models/spend-request.js";
export { spendRequestCreateSchema, type SpendRequestCreate } from "./models/spend-request-create.js";
export { spendRequestListSchema, type SpendRequestList } from "./models/spend-request-list.js";
export { SpendRequestStatus, spendRequestStatusSchema } from "./models/spend-request-status.js";
export { storeSchema, type Store } from "./models/store.js";
export { storeAllowanceSchema, type StoreAllowance } from "./models/store-allowance.js";
export { storeProductSchema, type StoreProduct } from "./models/store-product.js";
export { storeRefSchema, type StoreRef } from "./models/store-ref.js";
export { storeSummarySchema, type StoreSummary } from "./models/store-summary.js";
export { TokenType, tokenTypeSchema } from "./models/token-type.js";

export {
  CoreError as CosignAgentApiError,
  ResponseError,
  DecodeError,
  EncodeError,
  ConnectionError,
  TimeoutError,
  AuthError,
  ConfigurationError,
} from "./core/errors.js";
export { ApiError } from "./core/api-error.js";
export { SchemaError } from "./core/validation/schema-error.js";
export {
  defaultLoggingOptions,
  type LoggingOptions,
  type RequestLoggingOptions,
  type Logger,
  type LogDetails,
  type HttpRequestDetails,
  type RequestHeadersDetails,
  type RequestBodyDetails,
  type HttpResponseDetails,
  type ResponseHeadersDetails,
  type HttpRetryingDetails,
  type HttpFailedDetails,
  type LogLevel,
} from "./core/logging.js";
export type { ApiPromise, ApiResult } from "./core/api-promise.js";
export type { HttpMethod, RequestOptions } from "./core/api-request.js";
export type { RetryOptions, RequestRetryOptions, RetryAttempt, RetryReason } from "./core/retry.js";
export type { BinaryContent, BinaryData, BinaryErrorContent, FileData, FileInput } from "./core/binary.js";
export type { ErrorKind } from "./core/errors.js";
export type { ErrorPayload, Declared, Undeclared } from "./core/api-error.js";
export type { Schema, EnumSchema, Encoded } from "./core/validation/schema.js";
