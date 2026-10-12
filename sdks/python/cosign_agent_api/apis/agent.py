from __future__ import annotations

from ..auth import AsyncAuthSchemes, AuthSchemes
from ..core import (
    ApiResult,
    AsyncRawClient,
    RawClient,
    RequestOptionsOrDict,
    SecuredRawResponse,
    async_json_decoder,
    json_decoder,
    unwrap,
)
from ..errors.get_allowance_error import GetAllowanceErrorBody, get_allowance_error_mapper
from ..models.allowance import Allowance
from ..server.server import Server


class Agent:
    def __init__(self, client: RawClient, server: Server, auth: AuthSchemes) -> None:
        self._with_raw_response = AgentWithRawResponse(client, server, auth)

    def get_allowance(self, *, request_options: RequestOptionsOrDict | None = None) -> Allowance:
        """The agent's active permission slip: what is left this period, the limits, the allowed categories, and the
        stores it can pay right now (only stores whose PayPal budget hold the owner has approved). Call this before
        planning a purchase. ``slip`` is ``null`` when the agent has no active slip yet.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The current allowance

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Something
                went wrong on Cosign's side (code ``internal_error``). Nothing was charged. ``error`` is
                ``RawError``."""
        return unwrap(self._with_raw_response.get_allowance(request_options=request_options))

    @property
    def with_raw_response(self) -> AgentWithRawResponse:
        return self._with_raw_response


class AsyncAgent:
    def __init__(self, client: AsyncRawClient, server: Server, auth: AsyncAuthSchemes) -> None:
        self._with_raw_response = AsyncAgentWithRawResponse(client, server, auth)

    async def get_allowance(self, *, request_options: RequestOptionsOrDict | None = None) -> Allowance:
        """The agent's active permission slip: what is left this period, the limits, the allowed categories, and the
        stores it can pay right now (only stores whose PayPal budget hold the owner has approved). Call this before
        planning a purchase. ``slip`` is ``null`` when the agent has no active slip yet.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The current allowance

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Something
                went wrong on Cosign's side (code ``internal_error``). Nothing was charged. ``error`` is
                ``RawError``."""
        return unwrap(await self._with_raw_response.get_allowance(request_options=request_options))

    @property
    def with_raw_response(self) -> AsyncAgentWithRawResponse:
        return self._with_raw_response


class AgentWithRawResponse(SecuredRawResponse[RawClient, Server, AuthSchemes]):
    def get_allowance(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Allowance, GetAllowanceErrorBody]:
        """The agent's active permission slip: what is left this period, the limits, the allowed categories, and the
        stores it can pay right now (only stores whose PayPal budget hold the owner has approved). Call this before
        planning a purchase. ``slip`` is ``null`` when the agent has no active slip yet.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/agent/me"),
            auth_scheme=self._auth.agent_token,
            decoder=json_decoder[Allowance],
            error_mapper=get_allowance_error_mapper,
            request_options=request_options,
        )


class AsyncAgentWithRawResponse(SecuredRawResponse[AsyncRawClient, Server, AsyncAuthSchemes]):
    async def get_allowance(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Allowance, GetAllowanceErrorBody]:
        """The agent's active permission slip: what is left this period, the limits, the allowed categories, and the
        stores it can pay right now (only stores whose PayPal budget hold the owner has approved). Call this before
        planning a purchase. ``slip`` is ``null`` when the agent has no active slip yet.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/agent/me"),
            auth_scheme=self._auth.agent_token,
            decoder=async_json_decoder[Allowance],
            error_mapper=get_allowance_error_mapper,
            request_options=request_options,
        )
