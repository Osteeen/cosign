"""The seams every endpoint crosses: build a request, send it, shape a result.

One pipeline, two flavors, one seam. :class:`BaseRawClient` holds the half that does not depend
on concurrency -- resolving the API-wide, endpoint and caller parameter layers into a URL and
headers -- and each concrete client adds only the transport-touching ``execute``. Both flavors spell
it identically, so which flavor is in play is carried by the client a caller holds rather than by a
suffix on the method.

There is no ``_build_result`` beside ``_build_request`` any more. Shaping a result now needs the
response *and* its lifetime in the same place -- the 2xx return has to escape without closing, while
every other path closes -- and a static helper that could be handed a connection is one that can
leak it. The decoder owns the body it is given (ADR-0063), so what is left here is one status
branch, written out in each flavor because the two await differently.

The retry loop is each concrete client's private static ``_attempt_send``, spelled identically on
both, as ``execute`` is: it sends and, where every gate agrees, waits and sends again. It reads no
client state: ``execute`` hands it an ``on_send`` callable -- an inline lambda on sync, a local
``async def`` on async, since resolving auth there is awaited -- that builds the request, resolving
auth per attempt so a retry re-resolves it, and sends it through the client's own transport.
``execute`` then shapes whichever attempt it kept.

Pagination does not live here. ``pagination.paginate`` and ``async_paginate`` run that loop, calling the
endpoint's ``execute`` once per page.

The two live in one module, with no ``async_raw_client.py`` beside it, because they are a peer pair:
the handful of ``await``s they differ by are visible on one screen, which is what keeps the sync and
async paths from drifting apart."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from ._internal.headers import resolve_headers
from ._internal.urls import build_url, resolve_params
from .auth import AsyncAuthScheme, AuthParams, AuthScheme, invalidate, no_auth, resolve_auth
from .bodies import RequestBody
from .decoding import AsyncResponseDecoder, ErrorMapper, ResponseDecoder
from .exceptions import TransportError
from .params import Param, UrlTemplate
from .request_options import RequestOptions, RequestOptionsOrDict, apply_retry_overrides
from .results import ApiResult, Failure, Success
from .retries import RetryOptions, backoff_seconds, is_retryable_body, retry_after_seconds
from .transport import (
    AsyncHttpClient,
    AsyncHttpResponse,
    HttpClient,
    HttpMethod,
    HttpRequest,
    HttpResponse,
)

T = TypeVar("T")
E = TypeVar("E")
TransportT = TypeVar("TransportT", bound=HttpClient | AsyncHttpClient)


@dataclass(frozen=True, slots=True)
class BaseRawClient(Generic[TransportT]):
    """Shared request-building and result-shaping for the raw clients.

    Holds the one transport its concurrency flavor can actually use -- the type
    parameter is what makes :class:`RawClient` provably sync and
    :class:`AsyncRawClient` provably async, so neither can be handed the other's
    transport. Subclasses add only the ``execute`` seam, which each writes out in its
    own flavor because the two await differently; the pipeline below is not duplicated
    and the sync/async boundary is never crossed.

    The three ``global_*`` fields carry the parameters the API applies to *every*
    request. They are derived from the API description, not from a caller: whoever
    generates this SDK writes them here, and an API that declares none leaves them
    empty. Each is combined with a single call's own parameters by the matching
    ``resolve_*`` function, so this class decides nothing about precedence -- it only
    says which two sides go in. All three are the same shape -- a sequence of
    parameters, each naming the type it was declared as -- which is what lets one
    ``param`` factory serve every location a request parameter can occupy, and what
    makes a wrongly-typed API-wide header a build failure rather than a wire bug.

    A single call's ``request_options`` is the third source: not what the API
    prescribes and not what the endpoint declares, but what the caller asked for this
    once. It is validated here, at the one place a request is built, so no emitted
    endpoint ever inspects an option.

    Authentication is a fourth source, and the full order for both headers and query parameters is::

        global_*  ->  the endpoint's own  ->  auth  ->  the caller's extra_headers

    Auth outranks the endpoint's own parameters because an operation parameter must not be able to
    clobber a credential, and loses to ``extra_headers`` because that is how a caller deliberately
    overrides one -- or blanks it, for a call meant to go out anonymous. Note that ``_build_request``
    takes already-resolved :class:`~.auth.AuthParams`, not a scheme: resolving a scheme may require
    I/O, so it happens in the ``on_send`` callable ``execute`` hands to ``_attempt_send``, once per
    attempt, which is the one place the two flavors already differ.

    A **401 invalidates whatever the scheme cached**, so a credential the server revoked ahead of its
    own expiry is re-obtained on the next call rather than resent until it times out. For every scheme
    that holds a constant this is one ``isinstance`` and nothing more. The failing request is
    deliberately **not** retried: a caller sees one 401 and then recovery, which keeps this seam free
    of the retry policy ADR-0001 rules out. Like scheme resolution it lives in the retry loop, beside
    the resolution it corrects rather than one module away from it; ``_build_request`` never sees the
    scheme, only the params it already resolved to."""

    http_client: TransportT

    retry_options: RetryOptions

    global_headers: Sequence[Param[Any]] = ()
    global_query_params: Sequence[Param[Any]] = ()
    global_path_params: Sequence[Param[Any]] = ()

    def _build_request(
        self,
        *,
        http_method: HttpMethod,
        url_template: UrlTemplate,
        path_params: Sequence[Param[Any]] | None,
        query_params: Sequence[Param[Any]] | None,
        headers: Sequence[Param[Any]] | None,
        body: RequestBody | None,
        auth: AuthParams,
        options: RequestOptions,
    ) -> HttpRequest:
        """Resolve the API-wide, endpoint, auth and caller layers into one request."""
        return HttpRequest(
            method=http_method,
            url=build_url(
                url_template,
                path_params=resolve_params(self.global_path_params, path_params),
                query_params=resolve_params(self.global_query_params, (*(query_params or ()), *auth.query_params)),
            ),
            headers=resolve_headers(
                self.global_headers,
                (*(headers or ()), *auth.request_headers()),
                extra_headers=options.extra_headers,
            ),
            body=body,
            timeout=options.timeout,
        )


@dataclass(frozen=True, slots=True)
class RawClient(BaseRawClient[HttpClient]):
    """Synchronous raw client: builds the request, sends it, shapes the result."""

    def execute(
        self,
        *,
        http_method: HttpMethod,
        url_template: UrlTemplate,
        path_params: Sequence[Param[Any]] | None = None,
        query_params: Sequence[Param[Any]] | None = None,
        headers: Sequence[Param[Any]] | None = None,
        body: RequestBody | None = None,
        auth_scheme: AuthScheme = no_auth,
        decoder: ResponseDecoder[T],
        error_mapper: ErrorMapper[E],
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[T, E]:
        """Send a request and shape the response into a result.

        Returns once the response head has arrived. What happens to the body from there is the
        ``decoder``'s decision, not this method's: a buffered one reads it, releases the connection
        and parses what it read; ``file_decoder`` hands the open connection to the
        :class:`FileResponse` it builds. Either way ``T`` is solved from that argument rather than
        from the declared return type, and this method owns no connection on the success path.

        Every operation names a decoder -- an empty 2xx body is ``empty_response``, not an omitted
        argument -- so there is no "was one supplied?" branch and no empty-body special case. An
        operation that declares a payload and receives no body raises out of its decoder rather than
        quietly succeeding with ``None``, which is the rule every other response-deserialization
        failure already follows.

        A non-2xx body is read in full and the connection released *before* the mapper runs, so a
        :class:`Failure` never carries a lifetime obligation -- even when the mapper itself raises.

        Args:
            http_method: The HTTP verb to send.
            url_template: The unresolved URL for the configured environment.
            path_params: The endpoint's path parameters, if any.
            query_params: The endpoint's query parameters, if any.
            headers: The endpoint's header parameters, if any.
            body: The request body, already wire-ready, or ``None``.
            auth_scheme: The scheme the operation declares; ``no_auth`` when it declares none.
            decoder: The operation's 2xx decoder; ``empty_response`` when it declares no body,
                ``file_decoder`` when the body is a file.
            error_mapper: The operation's error mapper; ``raw_error_response`` when it declares
                no error schemas.
            request_options: The caller's per-call overrides, if any.

        Returns:
            A :class:`Success` carrying the decoded payload for a 2xx status, otherwise a
            :class:`Failure` carrying the decoded error body.

        Raises:
            ValueError: If the body does not deserialize. A deserialization failure is not an API
                error, so it propagates in both response modes rather than becoming a failure."""
        options = RequestOptions.coerce(request_options)
        retry_options = apply_retry_overrides(options, self.retry_options)

        response = self._attempt_send(
            auth_scheme=auth_scheme,
            retry_options=retry_options,
            is_retryable=is_retryable_body(body) and http_method in retry_options.http_methods_to_retry,
            on_send=lambda: self.http_client.send(
                self._build_request(
                    http_method=http_method,
                    url_template=url_template,
                    path_params=path_params,
                    query_params=query_params,
                    headers=headers,
                    body=body,
                    auth=auth_scheme.apply(),
                    options=options,
                )
            ),
        )

        try:
            status_code, response_headers = response.status_code, dict(response.headers)
            if 200 <= status_code < 300:
                # The 2xx return leaves before the read below: the body now belongs to the decoder,
                # which either reads and releases it or hands it to the payload it builds. A decoder
                # that raises instead is caught below, which is why nothing on this line has to be
                # total. The handler below must never become a finally -- it would close the
                # connection a FileResponse was just handed, on every download and silently.
                return Success(
                    payload=decoder.decode(response),
                    status_code=status_code,
                    headers=response_headers,
                )

            # Read once: re-reading a consumed stream raises, and read is what both releases
            # the connection and preserves the bytes.
            content = response.read()
            response.close()
            # Mapped AFTER the close, so a mapper raise cannot leak -- a Failure never holds a
            # connection. Such a raise re-enters the handler below and closes a second time, which
            # is a no-op: HttpResponse.close is required to be idempotent, and the 2xx decoder-raise
            # path already relies on that.
            return Failure(
                error=error_mapper.map(status_code, content),
                status_code=status_code,
                headers=response_headers,
            )
        except BaseException:
            response.close()
            raise

    @staticmethod
    def _attempt_send(
        *,
        auth_scheme: AuthScheme,
        retry_options: RetryOptions,
        is_retryable: bool,
        on_send: Callable[[], HttpResponse],
    ) -> HttpResponse:
        """Send, and send again while every gate agrees; hand back the attempt that was kept.

        ``on_send`` builds and sends **per attempt** rather than building once, which is what lets a
        retry re-resolve the auth scheme: a credential a 401 invalidated is re-obtained
        rather than resent. ``on_send`` takes no attempt number -- nothing in a request depends on
        which attempt it is. The
        ``Idempotency-Key`` is unaffected either way: the endpoint minted it into its own headers before
        this call, so every attempt carries the same one and a retried write is not a duplicate.

        A **401 invalidates whatever the scheme cached**, and it does so per attempt rather than once at
        the end: under a policy that names 401 in ``status_codes_to_retry`` the invalidation and the
        re-resolution that corrects it have to stay paired. The failing request is still not retried
        under the shipped defaults -- 401 is not in the default set -- so a caller sees one 401 and then
        recovery.

        A response the policy discards is **closed before the wait**, so a backoff never holds a
        connection. The one handed back is still open and still unread: whose body it is from there is
        the caller's question, not this one's.

        Args:
            auth_scheme: The scheme this operation declares -- invalidated where the server answers 401,
                so the next attempt resolves it afresh.
            retry_options: The policy in force for this call, the caller's per-call terms already merged
                onto the client's.
            is_retryable: Whether this request may be repeated at all -- the method gate and the body's
                replayability, folded together by the caller **once per call**, because answering the
                second walks a multipart body's parts and neither half can change between attempts.
            on_send: Builds this attempt's request, resolving auth afresh, and sends it through the
                transport; called once per attempt.

        Returns:
            The kept attempt's response -- the first the policy did not retry, or the last it was
            allowed to make. It is open and its body unread; its status and head are the caller's to
            read.

        Raises:
            Exception: Whatever the transport itself raised, where the last attempt produced no
                response. The :class:`TransportError` wrapper is unwrapped and its ``inner_exception``
                re-raised in its place, so the wrapper stays this loop's vocabulary and never the
                caller's."""
        for retries_taken in range(retry_options.max_retries + 1):
            try:
                response = on_send()
                status_code, response_headers = response.status_code, dict(response.headers)

                if status_code == 401:
                    invalidate(auth_scheme)

                if not (
                    is_retryable
                    and status_code in retry_options.status_codes_to_retry
                    and retries_taken < retry_options.max_retries
                ):
                    return response

                retry_after_header = retry_after_seconds(response_headers, datetime.now(timezone.utc))
                wait_seconds = (
                    backoff_seconds(retries_taken, retry_options)
                    if retry_after_header is None
                    else min(retry_after_header, retry_options.max_delay)
                )

                response.close()
                time.sleep(wait_seconds)

            except TransportError as error:
                # No response, so nothing to close and no ``Retry-After`` to read.
                if retries_taken >= retry_options.max_retries or not is_retryable:
                    inner = error.inner_exception
                    raise inner from inner.__cause__

                time.sleep(backoff_seconds(retries_taken, retry_options))

        raise AssertionError("the retry loop ended without a response to shape")


@dataclass(frozen=True, slots=True)
class AsyncRawClient(BaseRawClient[AsyncHttpClient]):
    """Asynchronous raw client.

    The method is named ``execute``, not ``execute_async``: sync and async peers
    carry identical names throughout this SDK, and the transport already makes the
    flavor unambiguous."""

    async def execute(
        self,
        *,
        http_method: HttpMethod,
        url_template: UrlTemplate,
        path_params: Sequence[Param[Any]] | None = None,
        query_params: Sequence[Param[Any]] | None = None,
        headers: Sequence[Param[Any]] | None = None,
        body: RequestBody | None = None,
        auth_scheme: AsyncAuthScheme = no_auth,
        decoder: AsyncResponseDecoder[T],
        error_mapper: ErrorMapper[E],
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[T, E]:
        """Send a request and shape the response into a result.

        Returns once the response head has arrived. What happens to the body from there is the
        ``decoder``'s decision, not this method's: a buffered one reads it, releases the connection
        and parses what it read; ``file_decoder`` hands the open connection to the
        :class:`FileResponse` it builds. Either way ``T`` is solved from that argument rather than
        from the declared return type, and this method owns no connection on the success path.

        Every operation names a decoder -- an empty 2xx body is ``empty_response``, not an omitted
        argument -- so there is no "was one supplied?" branch and no empty-body special case. An
        operation that declares a payload and receives no body raises out of its decoder rather than
        quietly succeeding with ``None``, which is the rule every other response-deserialization
        failure already follows.

        A non-2xx body is read in full and the connection released *before* the mapper runs, so a
        :class:`Failure` never carries a lifetime obligation -- even when the mapper itself raises.

        Args:
            http_method: The HTTP verb to send.
            url_template: The unresolved URL for the configured environment.
            path_params: The endpoint's path parameters, if any.
            query_params: The endpoint's query parameters, if any.
            headers: The endpoint's header parameters, if any.
            body: The request body, already wire-ready, or ``None``.
            auth_scheme: The scheme the operation declares; ``no_auth`` when it declares none.
            decoder: The operation's 2xx decoder; ``empty_response`` when it declares no body,
                ``file_decoder`` when the body is a file.
            error_mapper: The operation's error mapper; ``raw_error_response`` when it declares
                no error schemas.
            request_options: The caller's per-call overrides, if any.

        Returns:
            A :class:`Success` carrying the decoded payload for a 2xx status, otherwise a
            :class:`Failure` carrying the decoded error body.

        Raises:
            ValueError: If the body does not deserialize. A deserialization failure is not an API
                error, so it propagates in both response modes rather than becoming a failure."""
        options = RequestOptions.coerce(request_options)
        retry_options = apply_retry_overrides(options, self.retry_options)

        async def on_send() -> AsyncHttpResponse:
            request = self._build_request(
                http_method=http_method,
                url_template=url_template,
                path_params=path_params,
                query_params=query_params,
                headers=headers,
                body=body,
                auth=await resolve_auth(auth_scheme),
                options=options,
            )
            return await self.http_client.send(request)

        response = await self._attempt_send(
            auth_scheme=auth_scheme,
            retry_options=retry_options,
            is_retryable=is_retryable_body(body) and http_method in retry_options.http_methods_to_retry,
            on_send=on_send,
        )

        try:
            status_code, response_headers = response.status_code, dict(response.headers)
            if 200 <= status_code < 300:
                # The 2xx return leaves before the read below: the body now belongs to the decoder,
                # which either reads and releases it or hands it to the payload it builds. A decoder
                # that raises instead is caught below, which is why nothing on this line has to be
                # total. The handler below must never become a finally -- it would close the
                # connection an AsyncFileResponse was just handed, on every download and silently.
                return Success(
                    payload=await decoder.decode(response),
                    status_code=status_code,
                    headers=response_headers,
                )

            # Read once: re-reading a consumed stream raises, and aread is what both releases
            # the connection and preserves the bytes.
            content = await response.aread()
            await response.aclose()
            # Mapped AFTER the close, so a mapper raise cannot leak -- a Failure never holds a
            # connection. Such a raise re-enters the handler below and closes a second time, which
            # is a no-op: AsyncHttpResponse.aclose is required to be idempotent, and the 2xx
            # decoder-raise path already relies on that.
            return Failure(
                error=error_mapper.map(status_code, content),
                status_code=status_code,
                headers=response_headers,
            )
        except BaseException:
            await response.aclose()
            raise

    @staticmethod
    async def _attempt_send(
        *,
        auth_scheme: AsyncAuthScheme,
        retry_options: RetryOptions,
        is_retryable: bool,
        on_send: Callable[[], Awaitable[AsyncHttpResponse]],
    ) -> AsyncHttpResponse:
        """The awaited twin of :meth:`RawClient._attempt_send`, with that contract exactly.

        Three tokens differ: ``on_send`` is awaited (resolving a scheme may require I/O, and so does
        the transport), the close is ``aclose``, and the wait is ``asyncio.sleep``
        rather than ``time.sleep`` so it yields the event loop instead of blocking it.

        Args:
            auth_scheme: The scheme this operation declares -- invalidated where the server answers 401.
            retry_options: The policy in force for this call, the caller's per-call terms already merged
                onto the client's.
            is_retryable: Whether this request may be repeated at all.
            on_send: Builds this attempt's request, resolving auth afresh, and sends it through the
                transport; awaited once per attempt.

        Returns:
            The kept attempt's response, open and its body unread.

        Raises:
            Exception: Whatever the transport itself raised, where the last attempt produced no
                response."""
        for retries_taken in range(retry_options.max_retries + 1):
            try:
                response = await on_send()
                status_code, response_headers = response.status_code, dict(response.headers)

                if status_code == 401:
                    invalidate(auth_scheme)

                if not (
                    is_retryable
                    and status_code in retry_options.status_codes_to_retry
                    and retries_taken < retry_options.max_retries
                ):
                    return response

                retry_after_header = retry_after_seconds(response_headers, datetime.now(timezone.utc))
                wait_seconds = (
                    backoff_seconds(retries_taken, retry_options)
                    if retry_after_header is None
                    else min(retry_after_header, retry_options.max_delay)
                )

                await response.aclose()
                await asyncio.sleep(wait_seconds)

            except TransportError as error:
                # No response, so nothing to close and no ``Retry-After`` to read.
                if retries_taken >= retry_options.max_retries or not is_retryable:
                    inner = error.inner_exception
                    raise inner from inner.__cause__

                await asyncio.sleep(backoff_seconds(retries_taken, retry_options))

        raise AssertionError("the retry loop ended without a response to shape")


RawClientT = TypeVar("RawClientT", bound=RawClient | AsyncRawClient)
"""Fixes which raw client a generic holder carries -- ``RawClient`` or ``AsyncRawClient``.

Bounded by the two concrete clients rather than by ``BaseRawClient[Any]``: the base defines only
the request/result pipeline, not ``execute``, so the looser bound could not prove that a holder's
``self._client.execute(...)`` exists -- it type-checked only because each subclass substitutes a
concrete argument. This bound also removes the ``Any``."""
