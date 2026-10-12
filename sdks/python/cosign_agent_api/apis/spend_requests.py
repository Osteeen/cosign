from __future__ import annotations

from uuid import UUID

from ..auth import AsyncAuthSchemes, AuthSchemes
from ..core import (
    ApiResult,
    AsyncRawClient,
    RawClient,
    RequestOptionsOrDict,
    SecuredRawResponse,
    async_json_decoder,
    json_body,
    json_decoder,
    param,
    unwrap,
)
from ..errors.create_spend_request_error import CreateSpendRequestErrorBody, create_spend_request_error_mapper
from ..errors.get_spend_request_error import GetSpendRequestErrorBody, get_spend_request_error_mapper
from ..errors.list_spend_requests_error import ListSpendRequestsErrorBody, list_spend_requests_error_mapper
from ..models.spend_request import SpendRequest
from ..models.spend_request_create import SpendRequestCreate, SpendRequestCreateDict
from ..models.spend_request_list import SpendRequestList
from ..server.server import Server


class SpendRequests:
    def __init__(self, client: RawClient, server: Server, auth: AuthSchemes) -> None:
        self._with_raw_response = SpendRequestsWithRawResponse(client, server, auth)

    def create_spend_request(
        self,
        idempotency_key: str,
        body: SpendRequestCreate | SpendRequestCreateDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> SpendRequest:
        """Cosign checks the purchase against the slip and answers inside this request:

        - **Paid** (``status: COMPLETED``) - the rules allowed it and the AI check
          raised nothing. PayPal captured the total from the store's budget
          hold; ``receipt`` is filled in.
        - **Waiting for the owner** (``status: PENDING_APPROVAL``) - over the
          owner's approval amount, or flagged by the AI check. The owner is
          emailed. Poll ``GET /agent/spend-requests/{spendRequestId}``; the owner
          approves the exact cart (then it is paid), declines it, or lets it
          expire after 24 hours.
        - **Blocked** (``status: DENIED``) - see ``decision.reasons``. Nothing is charged.

        If PayPal does not answer in time the request stays ``PROCESSING``; poll it, and Cosign finishes the capture
        with the same PayPal request ID, so it is never charged twice.

        Args:
            idempotency_key: Unique per purchase. Reuse it only to retry the same request. A UUID works.
            body: The store, the cart, its total and the agent's reason for buying.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            A retry with an Idempotency-Key already used for this exact request. Returns the original result unchanged.

        Raises:
            ApiError: Malformed or invalid request (codes ``invalid_json``, ``invalid_request``,
                ``idempotency_key_required``, ``invalid_idempotency_key``) Missing, invalid or expired credential, or
                the agent is revoked (code ``unauthorized``) This Idempotency-Key was already used with a different
                request body Too many requests (code ``rate_limited``) Something went wrong on Cosign's side (code
                ``internal_error``). Nothing was charged. ``error`` is ``RawError``."""
        return unwrap(
            self._with_raw_response.create_spend_request(idempotency_key, body, request_options=request_options)
        )

    def get_spend_request(
        self, spend_request_id: UUID, *, request_options: RequestOptionsOrDict | None = None
    ) -> SpendRequest:
        """One of this agent's requests. Poll it while it is ``PENDING_APPROVAL`` or ``PROCESSING`` (every few seconds
        is fine).

        Args:
            spend_request_id: The ``id`` of a spend request this agent created.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The spend request

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Not found,
                or not this agent's (the two look the same on purpose) Something went wrong on Cosign's side (code
                ``internal_error``). Nothing was charged. ``error`` is ``RawError``."""
        return unwrap(self._with_raw_response.get_spend_request(spend_request_id, request_options=request_options))

    def list_spend_requests(
        self, *, limit: int | None = 25, request_options: RequestOptionsOrDict | None = None
    ) -> SpendRequestList:
        """This agent's own requests, newest first. Not paginated yet; ``next_cursor`` is always ``null`` in this
        version.

        Args:
            limit: How many to return, newest first.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The most recent spend requests

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Something
                went wrong on Cosign's side (code ``internal_error``). Nothing was charged. ``error`` is
                ``RawError``."""
        return unwrap(self._with_raw_response.list_spend_requests(limit=limit, request_options=request_options))

    @property
    def with_raw_response(self) -> SpendRequestsWithRawResponse:
        return self._with_raw_response


class AsyncSpendRequests:
    def __init__(self, client: AsyncRawClient, server: Server, auth: AsyncAuthSchemes) -> None:
        self._with_raw_response = AsyncSpendRequestsWithRawResponse(client, server, auth)

    async def create_spend_request(
        self,
        idempotency_key: str,
        body: SpendRequestCreate | SpendRequestCreateDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> SpendRequest:
        """Cosign checks the purchase against the slip and answers inside this request:

        - **Paid** (``status: COMPLETED``) - the rules allowed it and the AI check
          raised nothing. PayPal captured the total from the store's budget
          hold; ``receipt`` is filled in.
        - **Waiting for the owner** (``status: PENDING_APPROVAL``) - over the
          owner's approval amount, or flagged by the AI check. The owner is
          emailed. Poll ``GET /agent/spend-requests/{spendRequestId}``; the owner
          approves the exact cart (then it is paid), declines it, or lets it
          expire after 24 hours.
        - **Blocked** (``status: DENIED``) - see ``decision.reasons``. Nothing is charged.

        If PayPal does not answer in time the request stays ``PROCESSING``; poll it, and Cosign finishes the capture
        with the same PayPal request ID, so it is never charged twice.

        Args:
            idempotency_key: Unique per purchase. Reuse it only to retry the same request. A UUID works.
            body: The store, the cart, its total and the agent's reason for buying.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            A retry with an Idempotency-Key already used for this exact request. Returns the original result unchanged.

        Raises:
            ApiError: Malformed or invalid request (codes ``invalid_json``, ``invalid_request``,
                ``idempotency_key_required``, ``invalid_idempotency_key``) Missing, invalid or expired credential, or
                the agent is revoked (code ``unauthorized``) This Idempotency-Key was already used with a different
                request body Too many requests (code ``rate_limited``) Something went wrong on Cosign's side (code
                ``internal_error``). Nothing was charged. ``error`` is ``RawError``."""
        return unwrap(
            await self._with_raw_response.create_spend_request(idempotency_key, body, request_options=request_options)
        )

    async def get_spend_request(
        self, spend_request_id: UUID, *, request_options: RequestOptionsOrDict | None = None
    ) -> SpendRequest:
        """One of this agent's requests. Poll it while it is ``PENDING_APPROVAL`` or ``PROCESSING`` (every few seconds
        is fine).

        Args:
            spend_request_id: The ``id`` of a spend request this agent created.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The spend request

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Not found,
                or not this agent's (the two look the same on purpose) Something went wrong on Cosign's side (code
                ``internal_error``). Nothing was charged. ``error`` is ``RawError``."""
        return unwrap(
            await self._with_raw_response.get_spend_request(spend_request_id, request_options=request_options)
        )

    async def list_spend_requests(
        self, *, limit: int | None = 25, request_options: RequestOptionsOrDict | None = None
    ) -> SpendRequestList:
        """This agent's own requests, newest first. Not paginated yet; ``next_cursor`` is always ``null`` in this
        version.

        Args:
            limit: How many to return, newest first.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The most recent spend requests

        Raises:
            ApiError: Missing, invalid or expired credential, or the agent is revoked (code ``unauthorized``) Something
                went wrong on Cosign's side (code ``internal_error``). Nothing was charged. ``error`` is
                ``RawError``."""
        return unwrap(await self._with_raw_response.list_spend_requests(limit=limit, request_options=request_options))

    @property
    def with_raw_response(self) -> AsyncSpendRequestsWithRawResponse:
        return self._with_raw_response


class SpendRequestsWithRawResponse(SecuredRawResponse[RawClient, Server, AuthSchemes]):
    def create_spend_request(
        self,
        idempotency_key: str,
        body: SpendRequestCreate | SpendRequestCreateDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[SpendRequest, CreateSpendRequestErrorBody]:
        """Cosign checks the purchase against the slip and answers inside this request:

        - **Paid** (``status: COMPLETED``) - the rules allowed it and the AI check
          raised nothing. PayPal captured the total from the store's budget
          hold; ``receipt`` is filled in.
        - **Waiting for the owner** (``status: PENDING_APPROVAL``) - over the
          owner's approval amount, or flagged by the AI check. The owner is
          emailed. Poll ``GET /agent/spend-requests/{spendRequestId}``; the owner
          approves the exact cart (then it is paid), declines it, or lets it
          expire after 24 hours.
        - **Blocked** (``status: DENIED``) - see ``decision.reasons``. Nothing is charged.

        If PayPal does not answer in time the request stays ``PROCESSING``; poll it, and Cosign finishes the capture
        with the same PayPal request ID, so it is never charged twice.

        Args:
            idempotency_key: Unique per purchase. Reuse it only to retry the same request. A UUID works.
            body: The store, the cart, its total and the agent's reason for buying.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/agent/spend-requests"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[SpendRequestCreate | SpendRequestCreateDict](body),
            auth_scheme=self._auth.agent_token,
            decoder=json_decoder[SpendRequest],
            error_mapper=create_spend_request_error_mapper,
            request_options=request_options,
        )

    def get_spend_request(
        self, spend_request_id: UUID, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[SpendRequest, GetSpendRequestErrorBody]:
        """One of this agent's requests. Poll it while it is ``PENDING_APPROVAL`` or ``PROCESSING`` (every few seconds
        is fine).

        Args:
            spend_request_id: The ``id`` of a spend request this agent created.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/agent/spend-requests/{spendRequestId}"),
            path_params=[param[UUID]("spendRequestId", spend_request_id)],
            auth_scheme=self._auth.agent_token,
            decoder=json_decoder[SpendRequest],
            error_mapper=get_spend_request_error_mapper,
            request_options=request_options,
        )

    def list_spend_requests(
        self, *, limit: int | None = 25, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[SpendRequestList, ListSpendRequestsErrorBody]:
        """This agent's own requests, newest first. Not paginated yet; ``next_cursor`` is always ``null`` in this
        version.

        Args:
            limit: How many to return, newest first.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/agent/spend-requests"),
            query_params=[param[int | None]("limit", limit)],
            auth_scheme=self._auth.agent_token,
            decoder=json_decoder[SpendRequestList],
            error_mapper=list_spend_requests_error_mapper,
            request_options=request_options,
        )


class AsyncSpendRequestsWithRawResponse(SecuredRawResponse[AsyncRawClient, Server, AsyncAuthSchemes]):
    async def create_spend_request(
        self,
        idempotency_key: str,
        body: SpendRequestCreate | SpendRequestCreateDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[SpendRequest, CreateSpendRequestErrorBody]:
        """Cosign checks the purchase against the slip and answers inside this request:

        - **Paid** (``status: COMPLETED``) - the rules allowed it and the AI check
          raised nothing. PayPal captured the total from the store's budget
          hold; ``receipt`` is filled in.
        - **Waiting for the owner** (``status: PENDING_APPROVAL``) - over the
          owner's approval amount, or flagged by the AI check. The owner is
          emailed. Poll ``GET /agent/spend-requests/{spendRequestId}``; the owner
          approves the exact cart (then it is paid), declines it, or lets it
          expire after 24 hours.
        - **Blocked** (``status: DENIED``) - see ``decision.reasons``. Nothing is charged.

        If PayPal does not answer in time the request stays ``PROCESSING``; poll it, and Cosign finishes the capture
        with the same PayPal request ID, so it is never charged twice.

        Args:
            idempotency_key: Unique per purchase. Reuse it only to retry the same request. A UUID works.
            body: The store, the cart, its total and the agent's reason for buying.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/agent/spend-requests"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[SpendRequestCreate | SpendRequestCreateDict](body),
            auth_scheme=self._auth.agent_token,
            decoder=async_json_decoder[SpendRequest],
            error_mapper=create_spend_request_error_mapper,
            request_options=request_options,
        )

    async def get_spend_request(
        self, spend_request_id: UUID, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[SpendRequest, GetSpendRequestErrorBody]:
        """One of this agent's requests. Poll it while it is ``PENDING_APPROVAL`` or ``PROCESSING`` (every few seconds
        is fine).

        Args:
            spend_request_id: The ``id`` of a spend request this agent created.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/agent/spend-requests/{spendRequestId}"),
            path_params=[param[UUID]("spendRequestId", spend_request_id)],
            auth_scheme=self._auth.agent_token,
            decoder=async_json_decoder[SpendRequest],
            error_mapper=get_spend_request_error_mapper,
            request_options=request_options,
        )

    async def list_spend_requests(
        self, *, limit: int | None = 25, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[SpendRequestList, ListSpendRequestsErrorBody]:
        """This agent's own requests, newest first. Not paginated yet; ``next_cursor`` is always ``null`` in this
        version.

        Args:
            limit: How many to return, newest first.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/agent/spend-requests"),
            query_params=[param[int | None]("limit", limit)],
            auth_scheme=self._auth.agent_token,
            decoder=async_json_decoder[SpendRequestList],
            error_mapper=list_spend_requests_error_mapper,
            request_options=request_options,
        )
