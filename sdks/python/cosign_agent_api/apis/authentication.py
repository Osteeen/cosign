from __future__ import annotations

from uuid import UUID, uuid4

from ..auth import AsyncAuthSchemes, AuthSchemes
from ..core import (
    ApiResult,
    AsyncRawClient,
    RawClient,
    RequestOptionsOrDict,
    SecuredRawResponse,
    async_json_decoder,
    json_decoder,
    param,
    unwrap,
)
from ..errors.create_token_error import CreateTokenErrorBody, create_token_error_mapper
from ..models.agent_token import AgentToken
from ..server.server import Server


class Authentication:
    def __init__(self, client: RawClient, server: Server, auth: AuthSchemes) -> None:
        self._with_raw_response = AuthenticationWithRawResponse(client, server, auth)

    def create_token(self, *, request_options: RequestOptionsOrDict | None = None) -> AgentToken:
        """Send the agent's API key with HTTP Basic auth. The key looks like ``key_<24 hex>:cs_<secret>``: the part
        before the colon is the username, the part after is the password. The owner sees the key once, when the agent is
        added.

        Tokens last 15 minutes (``expires_in: 900``). Get a new one when a call returns ``401``. A paused or revoked
        agent cannot get a token.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Token issued

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Too many
                requests (code ``rate_limited``) Something went wrong on Cosign's side (code ``internal_error``).
                Nothing was charged. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.create_token(request_options=request_options))

    @property
    def with_raw_response(self) -> AuthenticationWithRawResponse:
        return self._with_raw_response


class AsyncAuthentication:
    def __init__(self, client: AsyncRawClient, server: Server, auth: AsyncAuthSchemes) -> None:
        self._with_raw_response = AsyncAuthenticationWithRawResponse(client, server, auth)

    async def create_token(self, *, request_options: RequestOptionsOrDict | None = None) -> AgentToken:
        """Send the agent's API key with HTTP Basic auth. The key looks like ``key_<24 hex>:cs_<secret>``: the part
        before the colon is the username, the part after is the password. The owner sees the key once, when the agent is
        added.

        Tokens last 15 minutes (``expires_in: 900``). Get a new one when a call returns ``401``. A paused or revoked
        agent cannot get a token.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Token issued

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Too many
                requests (code ``rate_limited``) Something went wrong on Cosign's side (code ``internal_error``).
                Nothing was charged. ``error`` is ``Problem | RawError``."""
        return unwrap(await self._with_raw_response.create_token(request_options=request_options))

    @property
    def with_raw_response(self) -> AsyncAuthenticationWithRawResponse:
        return self._with_raw_response


class AuthenticationWithRawResponse(SecuredRawResponse[RawClient, Server, AuthSchemes]):
    def create_token(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AgentToken, CreateTokenErrorBody]:
        """Send the agent's API key with HTTP Basic auth. The key looks like ``key_<24 hex>:cs_<secret>``: the part
        before the colon is the username, the part after is the password. The owner sees the key once, when the agent is
        added.

        Tokens last 15 minutes (``expires_in: 900``). Get a new one when a call returns ``401``. A paused or revoked
        agent cannot get a token.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/agent/token"),
            headers=[param[UUID]("Idempotency-Key", uuid4())],
            auth_scheme=self._auth.agent_key,
            decoder=json_decoder[AgentToken],
            error_mapper=create_token_error_mapper,
            request_options=request_options,
        )


class AsyncAuthenticationWithRawResponse(SecuredRawResponse[AsyncRawClient, Server, AsyncAuthSchemes]):
    async def create_token(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AgentToken, CreateTokenErrorBody]:
        """Send the agent's API key with HTTP Basic auth. The key looks like ``key_<24 hex>:cs_<secret>``: the part
        before the colon is the username, the part after is the password. The owner sees the key once, when the agent is
        added.

        Tokens last 15 minutes (``expires_in: 900``). Get a new one when a call returns ``401``. A paused or revoked
        agent cannot get a token.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/agent/token"),
            headers=[param[UUID]("Idempotency-Key", uuid4())],
            auth_scheme=self._auth.agent_key,
            decoder=async_json_decoder[AgentToken],
            error_mapper=create_token_error_mapper,
            request_options=request_options,
        )
