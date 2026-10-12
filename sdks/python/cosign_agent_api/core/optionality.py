"""The unset sentinel and the states it enables: omitted vs ``null`` vs a value.

:data:`UNSET` marks a field the caller never touched and :func:`strip_unset` is where "omitted" is
recovered at dump time, by dropping any key whose live value is still the sentinel. Two annotations
admit it, one per spelling a spec can declare: :data:`Optional` for a property that may be omitted,
:data:`OptionalNullable` for one that may be omitted *or* explicitly ``null``. See
``docs/designs/optional-nullable-fields.md``.

:data:`Optional` is deliberately **not** ``typing.Optional``. Here it means ``T | UnsetType`` --
present or absent, with no ``None`` arm -- where ``typing.Optional[T]`` means ``T | None``. They
differ by exactly the arm that matters: a property the spec does not declare nullable must not be
able to reach the wire as ``null``, so passing ``None`` to one of these fields is a type error
rather than a value that serializes. Nothing in a generated SDK imports ``typing.Optional`` -- unions
are spelled with PEP 604 ``|`` -- so the two never appear in the same module."""

from __future__ import annotations

from typing import Any, ClassVar, Final, Literal, TypeVar, cast, final

from pydantic import BaseModel, GetCoreSchemaHandler
from pydantic_core import core_schema
from typing_extensions import TypeAliasType


@final
class UnsetType:
    """Marks a field the caller never touched, distinct from one set to ``None``.

    Only ever seen as a field's default -- never constructed or passed by a caller. Dumps
    as plain ``None`` through pydantic's normal fast path (see :func:`strip_unset` for
    where the tri-state is actually recovered). See
    ``docs/designs/optional-nullable-fields.md``.

    A singleton, and identity-stable through every channel that could duplicate it: ``UnsetType()``
    returns the existing instance, ``copy`` and ``deepcopy`` return it unchanged, and unpickling
    reduces back through the constructor. Without that, ``model_copy(deep=True)`` would deep-copy
    the sentinel into a *second* object, and ``field is UNSET`` -- the natural way to test for
    it -- would start returning ``False`` on the copy. :func:`strip_unset` uses ``isinstance`` and
    so is immune either way, but callers should not have to know that. ``final`` is the same
    guarantee stated statically: a subclass would inherit ``_instance`` already set, so its
    constructor would hand back a ``UnsetType`` rather than an instance of itself."""

    _instance: ClassVar[UnsetType | None] = None

    def __new__(cls) -> UnsetType:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __bool__(self) -> Literal[False]:
        return False

    def __repr__(self) -> str:
        return "UNSET"

    def __copy__(self) -> UnsetType:
        return self

    def __deepcopy__(self, memo: dict[int, Any]) -> UnsetType:
        return self

    def __reduce__(self) -> tuple[type[UnsetType], tuple[()]]:
        # Protocols >= 2 reduce via ``cls.__new__(cls)`` and reach the guard above by luck of
        # protocol; 0 and 1 reconstruct through ``copyreg._reconstructor``, which calls
        # ``object.__new__`` and bypasses ``__new__`` entirely -- measured, ``restored is UNSET``
        # was ``False`` at both. Reducing to a plain call makes every protocol uniform.
        return (UnsetType, ())

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        return core_schema.is_instance_schema(
            cls, serialization=core_schema.plain_serializer_function_ser_schema(lambda _: None)
        )


UNSET: Final = UnsetType()

T = TypeVar("T")
Optional = TypeAliasType("Optional", T | UnsetType, type_params=(T,))
OptionalNullable = TypeAliasType("OptionalNullable", T | None | UnsetType, type_params=(T,))

DumpedT = TypeVar("DumpedT")


def strip_unset(value: object, dumped: DumpedT) -> DumpedT:
    """Recursively drop any dumped key whose live field value is :class:`UnsetType`.

    Walks ``value`` (the validated model, list or dict, pre-dump) alongside ``dumped`` (its
    ``mode="json"`` dump) so a field that dumped as ``None`` only because it defaulted to
    ``UNSET`` is omitted, while one explicitly set to ``None`` stays ``null``.

    The mapping branch pairs the two by *key* rather than by position, because ``mode="json"``
    renders a non-``str`` key as text (``{1: "x"}`` dumps as ``{"1": "x"}``): an entry the dump
    renamed keeps its dumped form instead of misaligning the walk. ``list`` and ``dict`` are the
    whole container set on purpose -- an array and a map are what a spec can express, so they are
    the only shapes an emitted declared type nests, and they are the same two ``adapters.py``
    descends. A ``tuple`` or ``set`` passes through like any other value.

    Shape-preserving: a dict in, a dict out; a list in, a list out. The three ``cast`` calls
    are that invariant, which mypy cannot verify through the rebuild -- they keep the
    imprecision here rather than returning ``Any`` to every caller.

    Args:
        value: The validated model, list or dict, before dumping -- the side that still
            holds the sentinel.
        dumped: That same value's ``mode="json"`` dump, walked alongside it.

    Returns:
        ``dumped`` with every never-touched key removed, in the shape it arrived in."""
    if isinstance(value, BaseModel):
        result = dict(cast(Any, dumped))
        for name, field in type(value).model_fields.items():
            # ``dumped`` may be keyed by wire alias (the default) or by Python name
            # (``to_dict(by_alias=False)``); prefer whichever spelling is actually there.
            key = field.alias if field.alias is not None and field.alias in result else name
            if key not in result:
                continue
            attr = getattr(value, name)
            if isinstance(attr, UnsetType):
                del result[key]
            else:
                result[key] = strip_unset(attr, result[key])
        return cast(DumpedT, result)
    if isinstance(value, list) and isinstance(dumped, list):
        stripped = [strip_unset(item, d) for item, d in zip(value, dumped, strict=True)]
        return cast(DumpedT, stripped)
    if isinstance(value, dict) and isinstance(dumped, dict):
        stripped_values = {key: strip_unset(value[key], item) if key in value else item for key, item in dumped.items()}
        return cast(DumpedT, stripped_values)
    return dumped
