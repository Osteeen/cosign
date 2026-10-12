# Get the agent's allowance (/api/openapi/agent/getAllowance)

`GET /agent/me`

The agent's active permission slip: what is left this period, the
limits, the allowed categories, and the stores it can pay right now
(only stores whose PayPal budget hold the owner has approved). Call this
before planning a purchase. `slip` is `null` when the agent has no
active slip yet.


```yaml
openapi: 3.2.0
servers:
  - url: "{host}/api/v1"
    description: Cosign deployment (PayPal sandbox)
    variables:
      host:
        default: http://localhost:3001
        description: Where Cosign runs, without a trailing slash, for example
          https://cosign.example.com
paths:
  /agent/me:
    get:
      tags:
        - Agent
      operationId: getAllowance
      summary: Get the agent's allowance
      description: |
        The agent's active permission slip: what is left this period, the
        limits, the allowed categories, and the stores it can pay right now
        (only stores whose PayPal budget hold the owner has approved). Call this
        before planning a purchase. `slip` is `null` when the agent has no
        active slip yet.
      security:
        - agentToken: []
      responses:
        "200":
          description: The current allowance
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Allowance"
              example:
                agent_id: 4f2a7c1e-8b3d-4e6f-9a10-2b3c4d5e6f70
                status: ACTIVE
                slip:
                  slip_id: 0c9e1d2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f
                  period_days: 28
                  period_ends_at: 2026-11-07T00:00:00.000Z
                  remaining_this_period:
                    amount_cents: 14070
                    currency: USD
                  per_purchase_max:
                    amount_cents: 10000
                    currency: USD
                  approve_above:
                    amount_cents: 5000
                    currency: USD
                  categories:
                    - office_supplies
                    - groceries
                  expires_at: null
                  stores:
                    - store:
                        id: 7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d
                        name: Paper Co
                        categories:
                          - office_supplies
                        website: http://localhost:3001/shop/paper-co
                      remaining_in_hold:
                        amount_cents: 7720
                        currency: USD
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
                  var response = await client.Agent.GetAllowance();
                  // TODO: Handle 'response' of type Allowance
              }
              catch (ApiException<GetAllowanceError> ex)
              {
                  if (ex.Error.TryGetNoContent(out var error))
                  {
                      // TODO: Handle 'error' of type RawError
                  }
              }
        - lang: python
          label: Python
          sources:
            Example: |-
              try:
                  response = client.agent.get_allowance()
                  # TODO: Handle 'response' of type Allowance
              except ApiError as e:
                  # TODO: Handle 'e.error' of type GetAllowanceErrorBody
                  ...
        - lang: typescript
          label: TypeScript
          sources:
            Example: >-
              try {
                const response = await client.agent.getAllowance();
                // TODO: Handle 'response' of type Allowance
              } catch (err) {
                // TODO: Handle 'err' of type Agent.GetAllowanceError, discriminated with 'err.payload.kind'
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
    Allowance:
      type: object
      description: What the agent may spend right now.
      required:
        - agent_id
        - status
        - slip
      properties:
        agent_id:
          type: string
          format: uuid
          description: This agent's ID.
          example: 4f2a7c1e-8b3d-4e6f-9a10-2b3c4d5e6f70
        status:
          $ref: "#/components/schemas/AgentStatus"
        slip:
          description: The active permission slip, or null when the agent has none.
          oneOf:
            - $ref: "#/components/schemas/Slip"
            - type: "null"
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
    AgentStatus:
      type: string
      description: Whether the agent may spend. Paused agents are denied; revoked
        agents cannot authenticate.
      enum:
        - ACTIVE
        - PAUSED
        - REVOKED
      example: ACTIVE
    Slip:
      type: object
      description: The agent's active permission slip, as the agent sees it.
      required:
        - slip_id
        - period_days
        - period_ends_at
        - remaining_this_period
        - per_purchase_max
        - approve_above
        - categories
        - expires_at
        - stores
      properties:
        slip_id:
          type: string
          format: uuid
          description: The slip's ID.
          example: 0c9e1d2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f
        period_days:
          type: integer
          minimum: 1
          maximum: 28
          description: Length of one budget period. At most 28 days, so a period fits
            inside one 29-day PayPal hold.
          example: 28
        period_ends_at:
          type: string
          format: date-time
          description: When the current budget period ends.
          example: 2026-11-07T00:00:00.000Z
        remaining_this_period:
          $ref: "#/components/schemas/Money"
        per_purchase_max:
          $ref: "#/components/schemas/Money"
        approve_above:
          $ref: "#/components/schemas/Money"
        categories:
          type: array
          description: Categories the agent may buy.
          items:
            $ref: "#/components/schemas/Category"
          example:
            - office_supplies
            - groceries
        expires_at:
          type:
            - string
            - "null"
          format: date-time
          description: When the slip ends for good, or null if the owner set no end date.
          example: null
        stores:
          type: array
          description: Only stores with an approved budget hold for this period.
          items:
            $ref: "#/components/schemas/StoreAllowance"
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
    StoreAllowance:
      type: object
      description: A store the agent can pay right now, and what is left in its budget hold.
      required:
        - store
        - remaining_in_hold
      properties:
        store:
          $ref: "#/components/schemas/Store"
        remaining_in_hold:
          $ref: "#/components/schemas/Money"
    Store:
      type: object
      description: A store onboarded to Cosign through PayPal Partner Referrals.
        PayPal IDs are never exposed.
      required:
        - id
        - name
        - categories
        - website
      properties:
        id:
          type: string
          format: uuid
          description: Use as `store_id` when asking to pay.
          example: 7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d
        name:
          type: string
          description: The store's name.
          example: Paper Co
        categories:
          type: array
          description: What the store sells.
          items:
            $ref: "#/components/schemas/Category"
          example:
            - office_supplies
        website:
          type:
            - string
            - "null"
          format: uri
          description: The store's website, where an agent can browse products.
          example: https://cosign.example/shop/paper-co
    Currency:
      type: string
      description: ISO 4217 currency code. Only US dollars in this version.
      enum:
        - USD
      example: USD
  responses:
    Unauthorized:
      description: Missing, invalid or expired credential, or the agent is revoked
        (code `unauthorized`)
      content:
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