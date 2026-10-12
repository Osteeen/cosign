from __future__ import annotations

from functools import cached_property
from types import TracebackType

from typing_extensions import Self

from .apis.agent import AsyncAgent
from .apis.authentication import AsyncAuthentication
from .apis.spend_requests import AsyncSpendRequests
from .auth import AsyncAuthSchemes
from .base_client import DEFAULT_TIMEOUT, BaseCosignAgentApiClient
from .core import (
    OPERATING_SYSTEM,
    PYTHON_RUNTIME,
    AsyncHttpClient,
    AsyncHttpx2Client,
    AsyncRawClient,
    BasicAuthCredentials,
    BasicAuthCredentialsOrDict,
    BasicAuthScheme,
    BearerAuthScheme,
    RetryOptionsOrDict,
    no_auth,
    param,
)


class AsyncCosignAgentApiClient(BaseCosignAgentApiClient[AsyncRawClient]):
    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        retry_options: int | RetryOptionsOrDict | None = None,
        custom_async_http_client: AsyncHttpClient | None = None,
        agent_key: BasicAuthCredentialsOrDict | None = None,
        agent_token: str | None = None,
    ) -> None:
        super().__init__(base_url=base_url, timeout=timeout, retry_options=retry_options)
        self._raw_client = AsyncRawClient(
            http_client=(
                custom_async_http_client if custom_async_http_client is not None else AsyncHttpx2Client(timeout=timeout)
            ),
            retry_options=self._retry_options,
            global_headers=[
                param[str]("User-Agent", "CosignAgentApiClient/1.0.0 Python"),
                param[str]("X-APIMatic-Lang", "Python"),
                param[str]("X-APIMatic-Package-Version", "1.0.0"),
                param[str]("X-APIMatic-Gen-Version", "4.0.0"),
                param[str]("X-APIMatic-OS", OPERATING_SYSTEM),
                param[str]("X-APIMatic-Runtime", PYTHON_RUNTIME),
            ],
        )
        self._auth = AsyncAuthSchemes(
            agent_key=BasicAuthScheme(BasicAuthCredentials.coerce(agent_key)) if agent_key is not None else no_auth,
            agent_token=BearerAuthScheme(agent_token) if agent_token is not None else no_auth,
        )

    @cached_property
    def agent(self) -> AsyncAgent:
        return AsyncAgent(self._raw_client, self._server, self._auth)

    @cached_property
    def authentication(self) -> AsyncAuthentication:
        return AsyncAuthentication(self._raw_client, self._server, self._auth)

    @cached_property
    def spend_requests(self) -> AsyncSpendRequests:
        return AsyncSpendRequests(self._raw_client, self._server, self._auth)

    async def aclose(self) -> None:
        await self._raw_client.http_client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, exc_tb: TracebackType | None
    ) -> None:
        await self.aclose()


AsyncClient = AsyncCosignAgentApiClient
