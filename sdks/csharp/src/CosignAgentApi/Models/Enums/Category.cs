using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// Purchase categories a slip can allow.
/// </summary>
[JsonConverter(typeof(StringEnumConverter<Category>))]
public sealed record Category : OpenStringEnum<Category>
{
    private Category(string value) : base(value)
    {
    }

    public static readonly Category OfficeSupplies = new("office_supplies");

    public static readonly Category Groceries = new("groceries");

    public static readonly Category FoodAndDrink = new("food_and_drink");

    public static readonly Category Travel = new("travel");

    public static readonly Category Software = new("software");

    public static readonly Category Electronics = new("electronics");

    public static readonly Category Household = new("household");

    public static readonly Category Other = new("other");

    public TResult Match<TResult>(Func<TResult> onOfficeSupplies,
        Func<TResult> onGroceries,
        Func<TResult> onFoodAndDrink,
        Func<TResult> onTravel,
        Func<TResult> onSoftware,
        Func<TResult> onElectronics,
        Func<TResult> onHousehold,
        Func<TResult> onOther,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == OfficeSupplies => onOfficeSupplies(),
            _ when this == Groceries => onGroceries(),
            _ when this == FoodAndDrink => onFoodAndDrink(),
            _ when this == Travel => onTravel(),
            _ when this == Software => onSoftware(),
            _ when this == Electronics => onElectronics(),
            _ when this == Household => onHousehold(),
            _ when this == Other => onOther(),
            _ => otherwise(Value)
        };

    public void Match(Action onOfficeSupplies,
        Action onGroceries,
        Action onFoodAndDrink,
        Action onTravel,
        Action onSoftware,
        Action onElectronics,
        Action onHousehold,
        Action onOther,
        Action<string> otherwise)
    {
        if (this == OfficeSupplies) onOfficeSupplies();
        else if (this == Groceries) onGroceries();
        else if (this == FoodAndDrink) onFoodAndDrink();
        else if (this == Travel) onTravel();
        else if (this == Software) onSoftware();
        else if (this == Electronics) onElectronics();
        else if (this == Household) onHousehold();
        else if (this == Other) onOther();
        else otherwise(Value);
    }
}
