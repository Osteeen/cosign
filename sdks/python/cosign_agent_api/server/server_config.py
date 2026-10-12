from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from ..core import UrlTemplate, param


class ServerConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    base_url: str = "{host}/api/v1"
    host: str = "http://localhost:3001"

    def resolve(self, path: str) -> UrlTemplate:
        return UrlTemplate(base_url=self.base_url, path=path, variables=[param[str]("host", self.host)])
