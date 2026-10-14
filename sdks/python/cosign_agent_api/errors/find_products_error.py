from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

FindProductsErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _FindProductsError:
    def map(self, status_code: int, content: bytes) -> FindProductsErrorBody:
        match status_code:
            case 400 | 401 | 429 | 500:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


find_products_error_mapper: Final[ErrorMapper[FindProductsErrorBody]] = _FindProductsError()
