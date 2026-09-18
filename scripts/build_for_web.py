import gzip
import json

import pandas

if __name__ == "__main__":
    data = pandas.read_csv("data/ct_ed_merged_ecs.csv.gz")
    ecs = pandas.read_csv("data/ecs_shells_merged.csv.gz")
    ecs["town_code"] = ecs["town_code"].astype(int).astype(str) + "0011"
    data = data.loc[
        ~data["district_code"].isna() & (data["fiscal_year"] > 2017),
        [
            col
            for col in data
            if not col.startswith("ecs__") and not col.startswith("ppe_ext__")
        ],
    ]
    data["district_code"] = data["district_code"].astype(int).astype(str)

    # merge in ecs
    names = data["district_name"].str.replace(
        " (?:School|Dist|City|Public).*$", "", regex=True
    )
    ecs_names = ecs["town_name"].unique()
    data["district_name"] = [
        col if col in ecs_names else data["district_name"].iloc[i]
        for i, col in enumerate(names)
    ]

    data = (
        ecs[[col for col in ecs if not col.startswith("param")]]
        .rename(columns={"town_name": "district_name"})
        .merge(
            data,
            how="left",
            on=["fiscal_year", "district_name"],
        )
        .sort_values(["fiscal_year", "district_name"])
    )
    data.loc[data["district_code"].isna(), "district_code"] = data.loc[
        data["district_code"].isna(), "town_code"
    ]

    # define variables
    with open("metadata.json", encoding="utf-8") as file:
        metadata = json.load(file)
    with gzip.open("public/metadata.json.gz", "wb") as file:
        file.write(json.dumps(metadata, separators=(",", ":")).encode())

    # standardize variable names
    data.drop(columns=["town_code", "sp__ppe_total", "district_name"], inplace=True)
    data.rename(
        columns={
            "enrollment_total": "enrollment__total",
            "ppe_ext__ppe_total": "sp__ppe_total",
        },
        inplace=True,
    )
    races = [
        "black",
        "hispanic",
        "white",
        "pacific_islander",
        "native_american",
        "asian",
        "two_or_more",
        "black_hispanic",
        "nonwhite",
    ]
    data.columns = [
        (
            f"enrollment__by_{'race' if col.split('_', maxsplit=1)[1] in races else 'program'}"
            f"_{col.replace('n_', '_').replace('pct_', 'pct__')}"
            if col.startswith("n_") or col.startswith("pct_")
            else col
        )
        for col in data.columns
    ]

    data.columns = [
        (parts[0] if len(parts) > 1 else "general")
        + "__"
        + parts[1 if len(parts) > 1 else 0]
        + ("_" + parts[2] if len(parts) > 3 else "")
        + ("__" + parts[2 if len(parts) == 3 else 3] if len(parts) > 2 else "")
        for parts in data.columns.str.replace("input__", "ecs__")
        .str.replace("computed__", "ecs__")
        .str.replace("__ecs_", "__")
        .str.replace("rev__pct_", "rev__pct__")
        .str.replace("sped__ammount", "sp__sped")
        .str.replace("^(.*)__(exp|ppe|pupils|rev)_", "\\1__\\2__", regex=True)
        .str.replace("_arch__(.*)(__|$)", "__\\1_arch\\2", regex=True)
        .str.replace("__([^_]+)_(.*)_real$", "__\\1_real_\\2", regex=True)
        .str.replace("(private|public)_school.*", "\\1", regex=True)
        .str.replace(
            "(count|percent)_(public|private)(.*)",
            "\\1__\\2\\3",
            regex=True,
        )
        .str.replace("___", "__")
        .str.split("__", n=3)
    ]

    # write web data
    with gzip.open(f"public/data.json.gz", "wb") as file:
        file.write(
            json.dumps(
                {
                    col: (
                        data[col].fillna(-9999).astype(int)
                        if data[col].dtype == "float64"
                        and (data[col].fillna(1) % 1 == 0).all()
                        else (
                            data[col].round(7)
                            if data[col].dtype == "float64"
                            else data[col]
                        )
                    ).to_list()
                    for col in data.columns
                    if "_real" not in col and not data[col].isna().all()
                },
                separators=(",", ":"),
            )
            .replace("-9999", "null")
            .replace("NaN", "null")
            .encode()
        )
