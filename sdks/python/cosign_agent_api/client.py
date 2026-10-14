from __future__ import annotations

from functools import cached_property
from types import TracebackType

from typing_extensions import Self

from .apis.agent import Agent
from .apis.authentication import Authentication
from .apis.products import Products
from .apis.spend_requests import SpendRequests
from .auth import AuthSchemes
from .base_client import DEFAULT_TIMEOUT, BaseCosignAgentApiClient
from .core import (
    OPERATING_SYSTEM,
    PYTHON_RUNTIME,
    BasicAuthCredentials,
    BasicAuthCredentialsOrDict,
    BasicAuthScheme,
    BearerAuthScheme,
    HttpClient,
    Httpx2Client,
    RawClient,
    RetryOptionsOrDict,
    no_auth,
    param,
)


class CosignAgentApiClient(BaseCosignAgentApiClient[RawClient]):
    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        retry_options: int | RetryOptionsOrDict | None = None,
        custom_http_client: HttpClient | None = None,
        agent_key: BasicAuthCredentialsOrDict | None = None,
        agent_token: str | None = None,
    ) -> None:
        super().__init__(base_url=base_url, timeout=timeout, retry_options=retry_options)
        self._raw_client = RawClient(
            http_client=custom_http_client if custom_http_client is not None else Httpx2Client(timeout=timeout),
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
        self._auth = AuthSchemes(
            agent_key=BasicAuthScheme(BasicAuthCredentials.coerce(agent_key)) if agent_key is not None else no_auth,
            agent_token=BearerAuthScheme(agent_token) if agent_token is not None else no_auth,
        )

    @cached_property
    def agent(self) -> Agent:
        return Agent(self._raw_client, self._server, self._auth)

    @cached_property
    def authentication(self) -> Authentication:
        return Authentication(self._raw_client, self._server, self._auth)

    @cached_property
    def products(self) -> Products:
        return Products(self._raw_client, self._server, self._auth)

    @cached_property
    def spend_requests(self) -> SpendRequests:
        return SpendRequests(self._raw_client, self._server, self._auth)

    def close(self) -> None:
        self._raw_client.http_client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, exc_tb: TracebackType | None
    ) -> None:
        self.close()


Client = CosignAgentApiClient
