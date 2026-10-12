from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Category(str, Enum):
    """Purchase categories a slip can allow."""

    OFFICE_SUPPLIES = "office_supplies"
    GROCERIES = "groceries"
    FOOD_AND_DRINK = "food_and_drink"
    TRAVEL = "travel"
    SOFTWARE = "software"
    ELECTRONICS = "electronics"
    HOUSEHOLD = "household"
    OTHER = "other"

    __str__ = str.__str__


CategoryOrStr: TypeAlias = Annotated[Category | str, open_enum_validator(Category)]
