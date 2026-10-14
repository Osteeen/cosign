# Get an access token (/api/openapi/authentication/createToken)

`POST /agent/token`

Send the agent's API key with HTTP Basic auth. The key looks like
`key_<24 hex>:cs_<secret>`: the part before the colon is the username,
the part after is the password. The owner sees the key once, when the
agent is added.

Tokens last 15 minutes (`expires_in: 900`). Get a new one when a call
returns `401`. A paused or revoked agent cannot get a token.


```yaml
openapi: 3.2.0
servers:
  - url: https://cosign-rd24.onrender.com/api/v1
    description: |
      Hosted Cosign (PayPal sandbox). Running Cosign yourself? Point your SDK
      at it instead, e.g. `http://localhost:3001/api/v1`.
paths:
  /agent/token:
    post:
      tags:
        - Authentication
      operationId: createToken
      summary: Get an access token
      description: |
        Send the agent's API key with HTTP Basic auth. The key looks like
        `key_<24 hex>:cs_<secret>`: the part before the colon is the username,
        the part after is the password. The owner sees the key once, when the
        agent is added.

        Tokens last 15 minutes (`expires_in: 900`). Get a new one when a call
        returns `401`. A paused or revoked agent cannot get a token.
      security:
        - agentKey: []
      responses:
        "200":
          description: Token issued
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AgentToken"
              example:
                access_token: cst_eyJhIjoiOWQ...
                token_type: Bearer
                expires_in: 900
        "401":
          $ref: "#/components/responses/Unauthorized"
        "429":
          $ref: "#/components/responses/RateLimited"
        "500":
          $ref: "#/components/responses/ServerError"
      x-apimatic-codeSamples:
        - lang: csharp
          label: C#
          sources:
            Example: |-
              try
              {
                  var response = await client.AuthenticationApi.CreateToken();
                  // TODO: Handle 'response' of type AgentToken
              }
              catch (ApiException<CreateTokenError> ex)
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
                  response = client.authentication.create_token()
                  # TODO: Handle 'response' of type AgentToken
              except ApiError as e:
                  # TODO: Handle 'e.error' of type CreateTokenErrorBody
                  ...
        - lang: typescript
          label: TypeScript
          sources:
            Example: >-
              try {
                const response =
                  await client.authentication.createToken();
                // TODO: Handle 'response' of type AgentToken
              } catch (err) {
                // TODO: Handle 'err' of type Authentication.CreateTokenError, discriminated with 'err.payload.kind'
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
    AgentToken:
      type: object
      description: A short-lived token for the agent API.
      required:
        - access_token
        - token_type
        - expires_in
      properties:
        access_token:
          type: string
          description: "Send it as `Authorization: Bearer <access_token>`."
          example: cst_eyJhIjoiOWQ...
        token_type:
          $ref: "#/components/schemas/TokenType"
        expires_in:
          type: integer
          description: Seconds until it expires. 900 in this version.
          example: 900
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
    TokenType:
      type: string
      description: How to send the token.
      enum:
        - Bearer
      example: Bearer
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
    RateLimited:
      description: Too many requests (code `rate_limited`)
      headers:
        Retry-After:
          description: Seconds to wait before retrying.
          schema:
            type: integer
          example: 30
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Problem"
        application/problem+json:
          schema:
            $ref: "#/components/schemas/Problem"
          example:
            type: https://cosign.example/problems/rate_limited
            title: rate limited
            status: 429
            code: rate_limited
            detail: Too many requests. Try again shortly.
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