# List the agent's spend requests (/api/openapi/spend-requests/listSpendRequests)

`GET /agent/spend-requests`

This agent's own requests, newest first. Not paginated yet; `next_cursor` is always `null` in this version.

```yaml
openapi: 3.2.0
servers:
  - url: https://cosign-rd24.onrender.com/api/v1
    description: |
      Hosted Cosign (PayPal sandbox). Running Cosign yourself? Point your SDK
      at it instead, e.g. `http://localhost:3001/api/v1`.
paths:
  /agent/spend-requests:
    get:
      tags:
        - Spend requests
      operationId: listSpendRequests
      summary: List the agent's spend requests
      description: This agent's own requests, newest first. Not paginated yet;
        `next_cursor` is always `null` in this version.
      security:
        - agentToken: []
      parameters:
        - name: limit
          in: query
          description: How many to return, newest first.
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 25
          example: 25
      responses:
        "200":
          description: The most recent spend requests
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SpendRequestList"
              example:
                data: []
                next_cursor: null
        "401":
          $ref: "#/components/responses/Unauthorized"
        "500":
          $ref: "#/components/responses/ServerError"
      x-apimatic-codeSamples:
        - lang: csharp
          label: C#
          sources:
            Example: |-
              try
              {
                  var response = await client.SpendRequests.ListSpendRequests(
                      new ListSpendRequestsRequest { Limit = 25 });
                  // TODO: Handle 'response' of type SpendRequestList
              }
              catch (ApiException<ListSpendRequestsError> ex)
              {
                  if (ex.Error.TryGetProblem(out var error))
                  {
                      // TODO: Handle 'error' of type Problem
                  }
              }
        - lang: python
          label: Python
          sources:
            Example: |-
              try:
                  response = client.spend_requests.list_spend_requests(
                      limit=25
                  )
                  # TODO: Handle 'response' of type SpendRequestList
              except ApiError as e:
                  # TODO: Handle 'e.error' of type
                  # ListSpendRequestsErrorBody
                  ...
        - lang: typescript
          label: TypeScript
          sources:
            Example: >-
              try {
                const response =
                  await client.spendRequests.listSpendRequests({
                    limit: 25,
                  });
                // TODO: Handle 'response' of type SpendRequestList
              } catch (err) {
                // TODO: Handle 'err' of type SpendRequests.ListSpendRequestsError, discriminated with 'err.payload.kind'
              }
components:
  securitySchemes:
    agentKey:
      type: http
      scheme: basic
      description: The agent's API key as HTTP Basic credentials (`key_...` as the
        username, `cs_...` as the password). Only for `POST /agent/token`.
    agentToken:
      type: http
      scheme: bearer
      description: The 15-minute token from `POST /agent/token`.
  schemas:
    SpendRequestList:
      type: object
      description: A page of spend requests, newest first.
      required:
        - data
        - next_cursor
      properties:
        data:
          type: array
          description: The requests.
          items:
            $ref: "#/components/schemas/SpendRequest"
        next_cursor:
          type:
            - string
            - "null"
          description: Always null in this version.
          example: null
    Problem:
      type: object
      description: An error (RFC 9457 problem details).
      required:
        - type
        - title
        - status
        - code
        - detail
      properties:
        type:
          type: string
          format: uri
          description: A URI that identifies the kind of problem.
          example: https://cosign.example/problems/invalid_request
        title:
          type: string
          description: A short, human-readable summary of the kind of problem.
          example: invalid request
        status:
          type: integer
          description: The HTTP status code.
          example: 400
        code:
          type: string
          description: Stable machine-readable error code.
          example: invalid_request
        detail:
          type: string
          description: A plain explanation.
          example: "items.0.quantity: Too small: expected number to be >=1"
    SpendRequest:
      type: object
      description: A request to pay, and what Cosign decided.
      required:
        - id
        - agent_id
        - store_id
        - items
        - total
        - purpose
        - status
        - decision
        - cart_hash
        - approval_expires_at
        - receipt
        - order
        - created_at
      properties:
        id:
          type: string
          format: uuid
          description: The spend request's ID.
          example: 91d68fb2-5c1a-4b7e-8f20-3a4b5c6d7e8f
        agent_id:
          type: string
          format: uuid
          description: The agent that asked.
          example: 4f2a7c1e-8b3d-4e6f-9a10-2b3c4d5e6f70
        store_id:
          type: string
          format: uuid
          description: The store to be paid.
          example: 7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d
        items:
          type: array
          description: The cart as sent.
          items:
            $ref: "#/components/schemas/LineItem"
        total:
          $ref: "#/components/schemas/Money"
        purpose:
          type: string
          description: The agent's reason, as sent.
          example: Restock printer paper for the office.
        status:
          $ref: "#/components/schemas/SpendRequestStatus"
        decision:
          $ref: "#/components/schemas/Decision"
        cart_hash:
          type: string
          description: SHA-256 of the canonical cart. The owner's approval is bound to it.
          example: 3f1c9a0b7e2d4c6f8a1b3d5e7f9a0c2e4b6d8f0a1c3e5a7b9d1f3a5c7e9b1d3f
        approval_expires_at:
          type:
            - string
            - "null"
          format: date-time
          description: When an owner approval would expire; null unless waiting for the
            owner.
          example: null
        receipt:
          description: Filled in when the request is COMPLETED.
          oneOf:
            - $ref: "#/components/schemas/Receipt"
            - type: "null"
        order:
          description: The order handed to the store once the request is paid; null before
            that.
          oneOf:
            - $ref: "#/components/schemas/OrderSummary"
            - type: "null"
        created_at:
          type: string
          format: date-time
          description: When the agent asked.
          example: 2026-10-10T09:15:01.000Z
    LineItem:
      type: object
      description: One line of the cart.
      required:
        - name
        - category
        - quantity
        - unit_amount_cents
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 120
          description: What is being bought, as the store names it.
          example: Copy paper, letter, 500 sheets
        category:
          $ref: "#/components/schemas/Category"
        quantity:
          type: integer
          minimum: 1
          maximum: 1000
          description: How many.
          example: 2
        unit_amount_cents:
          type: integer
          format: int64
          minimum: 1
          maximum: 10000000
          description: Price of one unit in integer cents.
          example: 649
        product_url:
          type: string
          format: uri
          maxLength: 2048
          description: The product page. Shown to the owner; Cosign never fetches it.
          example: https://cosign.example/shop/paper-co/copy-paper-ream
    Money:
      type: object
      description: An amount of money in integer cents.
      required:
        - amount_cents
        - currency
      properties:
        amount_cents:
          type: integer
          format: int64
          minimum: 0
          maximum: 10000000
          description: Integer cents. 1234 = $12.34.
          example: 1298
        currency:
          $ref: "#/components/schemas/Currency"
    SpendRequestStatus:
      type: string
      enum:
        - PROCESSING
        - COMPLETED
        - PENDING_APPROVAL
        - DENIED
        - APPROVAL_EXPIRED
        - PAYMENT_FAILED
      example: COMPLETED
      description: >
        - `PROCESSING` - allowed; the PayPal capture is not confirmed yet. Poll.
          PayPal's own notification (webhook) settles it if the first answer was lost.
        - `COMPLETED` - paid. In rare cases PayPal accepts a capture as pending
        and
          denies it later; the request then becomes `PAYMENT_FAILED`.
        - `PENDING_APPROVAL` - waiting for the owner.

        - `DENIED` - blocked by the rules, or declined by the owner.

        - `APPROVAL_EXPIRED` - the owner did not decide in time. Nothing was
        charged.

        - `PAYMENT_FAILED` - PayPal refused the capture. Nothing was charged.
    Decision:
      type: object
      description: The outcome and every reason behind it.
      required:
        - outcome
        - reasons
        - rule_version
        - intent_check
      properties:
        outcome:
          $ref: "#/components/schemas/DecisionOutcome"
        reasons:
          type: array
          description: Empty when the purchase was simply allowed.
          items:
            $ref: "#/components/schemas/Reason"
        rule_version:
          type:
            - integer
            - "null"
          description: Version of the slip's rules used. Null when there was no slip.
          example: 1
        intent_check:
          $ref: "#/components/schemas/IntentCheck"
    Receipt:
      type: object
      description: Proof of payment for a completed request.
      required:
        - receipt_id
        - paid
        - paid_at
      properties:
        receipt_id:
          type: string
          description: Cosign's receipt ID.
          example: rcpt_91d68fb2
        paid:
          $ref: "#/components/schemas/Money"
        paid_at:
          type: string
          format: date-time
          description: When PayPal paid the store.
          example: 2026-10-10T09:15:02.000Z
    OrderSummary:
      type: object
      description: |
        What the agent may know about the order a paid purchase created. The
        store gets the items and the owner's address; the agent only sees the
        address label and whether the store has seen or shipped it.
      required:
        - status
        - ships_to
      properties:
        status:
          $ref: "#/components/schemas/OrderStatus"
        ships_to:
          type:
            - string
            - "null"
          description: The label of the owner's address it ships to, or null when nothing
            ships.
          example: Office
    OrderStatus:
      type: string
      description: "`SENT` to the store, `SEEN` (the store confirmed it), `SHIPPED`,
        or `CANCELLED` (PayPal did not complete the payment, or it was fully
        refunded)."
      enum:
        - SENT
        - SEEN
        - SHIPPED
        - CANCELLED
      example: SENT
    DecisionOutcome:
      type: string
      description: What the rules (and the AI check) decided.
      enum:
        - ALLOW
        - NEEDS_APPROVAL
        - DENY
      example: ALLOW
    Reason:
      type: object
      description: One reason behind a decision.
      required:
        - code
        - message
      properties:
        code:
          $ref: "#/components/schemas/ReasonCode"
        message:
          type: string
          description: Plain words, safe to show a person.
          example: Over the $100.00 per-purchase limit.
    IntentCheck:
      type: object
      description: The AI purchase check. It runs only when the rules allow the
        purchase, and can only escalate it to the owner.
      required:
        - verdict
        - escalated
        - summary
      properties:
        verdict:
          $ref: "#/components/schemas/IntentVerdict"
        escalated:
          type: boolean
          description: True when the check turned ALLOW into NEEDS_APPROVAL.
          example: false
        summary:
          type:
            - string
            - "null"
          maxLength: 280
          description: Why the check flagged the purchase, in plain words; null when it
            did not.
          example: null
    IntentVerdict:
      type: string
      description: SKIPPED when the rules had already decided, or the check is not
        configured.
      enum:
        - CLEAR
        - FLAGGED
        - SKIPPED
      example: CLEAR
    ReasonCode:
      type: string
      description: Why a purchase was asked about or blocked.
      enum:
        - AGENT_PAUSED
        - AGENT_REVOKED
        - NO_ACTIVE_SLIP
        - SLIP_EXPIRED
        - CURRENCY_MISMATCH
        - TOTAL_MISMATCH
        - STORE_NOT_ALLOWED
        - NO_ACTIVE_HOLD
        - HOLD_INSUFFICIENT
        - CATEGORY_NOT_ALLOWED
        - OVER_PER_PURCHASE_MAX
        - OVER_PERIOD_BUDGET
        - ABOVE_APPROVAL_THRESHOLD
        - INTENT_FLAGGED
      example: OVER_PER_PURCHASE_MAX
    Currency:
      type: string
      description: ISO 4217 currency code. Only US dollars in this version.
      enum:
        - USD
      example: USD
    Category:
      type: string
      description: Purchase categories a slip can allow.
      enum:
        - office_supplies
        - groceries
        - food_and_drink
        - travel
        - software
        - electronics
        - household
        - other
      example: office_supplies
  responses:
    Unauthorized:
      description: Missing, invalid or expired credential, or the agent is revoked
        (code `unauthorized`)
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Problem"
        application/problem+json:
          schema:
            $ref: "#/components/schemas/Problem"
          example:
            type: https://cosign.example/problems/unauthorized
            title: unauthorized
            status: 401
            code: unauthorized
            detail: Missing, invalid or expired agent token.
    ServerError:
      description: Something went wrong on Cosign's side (code `internal_error`).
        Nothing was charged.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Problem"
        application/problem+json:
          schema:
            $ref: "#/components/schemas/Problem"
          example:
            type: https://cosign.example/problems/internal_error
            title: internal error
            status: 500
            code: internal_error
            detail: Something went wrong on our side. Nothing was charged.
info:
  title: Cosign Agent API
  version: 1.0.0
```