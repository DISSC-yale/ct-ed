"""
build_ct_merged.py
==================
Merges all CT public education district-level CSVs into a single wide panel.

Input:  public-CT-ed-data-master/data/  (the repo's processed CSVs, not the raw files)
Output: ct_education_merged.csv

Usage
-----
Place this script in the same directory that contains the
public-CT-ed-data-master/ folder, then run:

    python build_ct_merged.py

Or just point DATA_ROOT at the repo explicitly:

    DATA_ROOT = "/path/to/public-CT-ed-data-master"

Dependencies
------------
    pandas numpy
"""

import os
import re
import pandas as pd
import numpy as np

# config

# Root of the cloned/unzipped repo. Adjust if needed.
DATA_ROOT = os.path.join(os.path.dirname(__file__), "public-CT-ed-data-master")
DATA      = os.path.join(DATA_ROOT, "data")
OUT       = os.path.join(os.path.dirname(__file__), "ct_education_merged.csv")


# helpers

def slugify(s):
    """Convert any string to a clean snake_case identifier."""
    s = str(s).lower().strip()
    s = re.sub(r"[^\w\s]", "", s)         # strip punctuation
    s = re.sub(r"\s+", "_", s)            # spaces --> underscores
    s = re.sub(r"_+", "_", s).strip("_")  # collapse runs
    return s


def read(fname):
    """Read a processed CSV from the data directory."""
    return pd.read_csv(os.path.join(DATA, fname))


def normalize_cols(df):
    """Lowercase + snake_case every column name in-place."""
    df.columns = [slugify(c) for c in df.columns]
    return df


def merge_into(panel, df, prefix):
    """
    Outer-merge df into the running panel on (district_code, fiscal_year).

    Value columns in df are prefixed with `prefix__` to prevent collisions.
    district_code is coerced to nullable Int64 before merging.
    Any column named 'district' or 'district_name' in df is dropped first
    (the panel already carries the canonical district_name from enrollment).
    """
    df = df.copy()
    df["district_code"] = df["district_code"].astype("Int64")

    for drop_col in ("district", "district_name"):
        if drop_col in df.columns:
            df = df.drop(columns=[drop_col])

    join_keys = {"district_code", "fiscal_year"}
    rename_map = {c: f"{prefix}__{c}" for c in df.columns if c not in join_keys}
    df = df.rename(columns=rename_map)

    return panel.merge(df, on=["district_code", "fiscal_year"], how="outer")


# name --> code lookup
# Several source files (graduation, SAT, SWD outplacement, total_archived) do
# not carry a district_code column. We resolve codes by matching district names
# against the enrollment file, which has the most complete code coverage.

_enroll_raw = normalize_cols(read("district_year_enrollment/district_year_enrollment.csv"))
_name_to_code = (
    _enroll_raw[["district", "district_code"]]
    .drop_duplicates("district")
    .set_index("district")["district_code"]
    .to_dict()
)


def add_code(df, name_col="district"):
    """Attach district_code via name lookup if the column is absent."""
    if "district_code" not in df.columns:
        df = df.copy()
        df["district_code"] = df[name_col].map(_name_to_code)
    return df


# valid needs group labels (shared across grad / SBAC / SAT)

NEEDS_GROUPS = ["All Students", "High Needs", "Non-High Needs"]


# STEP 1: Build the spine from enrollment
# Enrollment is the most complete district × year panel (FY2008–FY2026, 206
# districts). Every other file is outer-merged onto it, so districts or years
# not present in enrollment still appear if another source covers them.
print("1/14  enrollment (spine)...")
panel = _enroll_raw.copy()
panel = panel.rename(columns={"district": "district_name"})
panel["district_code"] = panel["district_code"].astype("Int64")


# STEP 2: Spending by function  (FY2018–FY2025)
print("2/14  spending...")
sp = normalize_cols(read("district_year_spending/district_year_spending.csv"))
sp = sp.drop(columns=["district", "cpi_u", "deflator"], errors="ignore")
# cpi_u and deflator are identical to ppe_extended; drop here to avoid
# redundant columns. Real-dollar columns are kept (suffixed _real).
panel = merge_into(panel, sp, "sp")


# STEP 3: Per-pupil expenditures, extended series  (FY2007–FY2025)
# Bridges the archived (FY2007–FY2017) and modern (FY2018–FY2025) per-pupil
# series into one consistent ppe_total column, plus the real-dollar version.
print("3/14  ppe_extended...")
ppe_ext = normalize_cols(read("district_year_ppe_extended/district_year_ppe_extended.csv"))
ppe_ext = ppe_ext.drop(columns=["district"], errors="ignore")
panel = merge_into(panel, ppe_ext, "ppe_ext")


# STEP 4: PPE archived by function  (FY2007–FY2017)
# Older per-pupil breakdown by spending function (instruction, plant, transport,
# etc.). Superseded by the spending-by-function file for FY2018 onward.
print("4/14  ppe_archived...")
ppe_arch = normalize_cols(read("district_year_ppe_archived/district_year_ppe_archived.csv"))
ppe_arch = ppe_arch.drop(columns=["district"], errors="ignore")
panel = merge_into(panel, ppe_arch, "ppe_arch")

# STEP 5: Revenue by source  (FY2018–FY2025)
print("5/14  revenue...")
rev = normalize_cols(read("district_year_revenue/district_year_revenue.csv"))
rev = rev.drop(columns=["district"], errors="ignore")
panel = merge_into(panel, rev, "rev")


# STEP 6: Accountability & growth  (FY2025 only)
print("6/14  accountability...")
acct = normalize_cols(read("district_year_accountability/district_year_accountability.csv"))
acct = acct.drop(columns=["district"], errors="ignore")
panel = merge_into(panel, acct, "acct")


# STEP 7: Total annual expenditures, archived  (FY2006–FY2017)
# Pre-EFS (Education Finance System) total expenditure breakdown. Covers the
# years before the modern spending-by-function file begins. Two districts in
# this file (Cross Cultural Academy, Highville Mustard Seed) have no matching
# enrollment record; they produce orphan rows that are cleaned up at the end.

print("7/14  total_annual_expenditures_archived...")
tot = normalize_cols(read("total_annual_expenditures_archived/total_annual_expenditures_archived.csv"))
tot = add_code(tot, name_col="district")
tot = tot.drop(columns=["district"], errors="ignore")
panel = merge_into(panel, tot, "tot_arch")


# STEP 8: Four-year graduation rates  (FY2012–FY2025)
# Source is long (district × year × needs_group). Pivot needs_group into
# columns so each district-year row carries All Students / High Needs /
# Non-High Needs side by side. Garbage rows absorbed from raw HTML headers
# during scraping are filtered by the NEEDS_GROUPS whitelist.

print("8/14  graduation_4yr...")
grad4 = normalize_cols(read("graduation_4yr/graduation_4yr.csv"))
grad4 = add_code(grad4)
grad4 = grad4[grad4["needs_group"].isin(NEEDS_GROUPS)].copy()

grad4_piv = grad4.pivot_table(
    index=["district_code", "fiscal_year"],
    columns="needs_group",
    values=["cohort_count", "graduation_count", "graduation_rate"],
    aggfunc="first",
)
grad4_piv.columns = [f"{slugify(v)}__{slugify(ng)}" for v, ng in grad4_piv.columns]
grad4_piv = grad4_piv.reset_index()
panel = merge_into(panel, grad4_piv, "grad4")


# STEP 9: Five-year graduation rates  (FY2012–FY2023)
print("9/14  graduation_5yr...")
grad5 = normalize_cols(read("graduation_5yr/graduation_5yr.csv"))
grad5 = add_code(grad5)
grad5 = grad5[grad5["needs_group"].isin(NEEDS_GROUPS)].copy()

grad5_piv = grad5.pivot_table(
    index=["district_code", "fiscal_year"],
    columns="needs_group",
    values=["cohort_count", "graduation_count", "graduation_rate"],
    aggfunc="first",
)
grad5_piv.columns = [f"{slugify(v)}__{slugify(ng)}" for v, ng in grad5_piv.columns]
grad5_piv = grad5_piv.reset_index()
panel = merge_into(panel, grad5_piv, "grad5")


# STEP 10: Smarter Balanced (SBAC) assessment  (FY2015–FY2025)
# Long on district × year × subject × needs_group. Pivot subject and
# needs_group together into columns. No assessments were administered in
# FY2020 or FY2021 (COVID); those years are structurally absent, not missing.

print("10/14  sbac...")
sbac = normalize_cols(read("sbac/sbac.csv"))
sbac = sbac[sbac["needs_group"].isin(NEEDS_GROUPS)].copy()

SBAC_VALS = [
    "total_students", "total_tested", "participation_rate", "n_scored",
    "level1_pct", "level2_pct", "level3_pct", "level4_pct", "pct_prof",
]
sbac_piv = sbac[["district_code", "fiscal_year", "subject", "needs_group"] + SBAC_VALS].pivot_table(
    index=["district_code", "fiscal_year"],
    columns=["subject", "needs_group"],
    values=SBAC_VALS,
    aggfunc="first",
)
sbac_piv.columns = [f"{slugify(v)}__{slugify(s)}__{slugify(ng)}" for v, s, ng in sbac_piv.columns]
sbac_piv = sbac_piv.reset_index()
panel = merge_into(panel, sbac_piv, "sbac")


# STEP 11: CT School Day SAT  (FY2016–FY2025)
# Same pivot logic as SBAC. No code column in source; resolved via name lookup.
# FY2020 and FY2021 are structurally absent (COVID, no test administered).

print("11/14  sat...")
sat = normalize_cols(read("sat/sat.csv"))
sat = add_code(sat)
sat = sat[sat["needs_group"].isin(NEEDS_GROUPS)].copy()

SAT_VALS = ["total_students", "total_tested", "participation_rate", "n_scored", "pct_prof", "avg_score"]
sat_piv = sat[["district_code", "fiscal_year", "subject", "needs_group"] + SAT_VALS].pivot_table(
    index=["district_code", "fiscal_year"],
    columns=["subject", "needs_group"],
    values=SAT_VALS,
    aggfunc="first",
)
sat_piv.columns = [f"{slugify(v)}__{slugify(s)}__{slugify(ng)}" for v, s, ng in sat_piv.columns]
sat_piv = sat_piv.reset_index()
panel = merge_into(panel, sat_piv, "sat")


# STEP 12: Per-pupil expenditures by object  (FY2018–FY2025)
# Long on district × year × object. The "Total" row is dropped (redundant with
# sp__ppe_total). "Other — Includes Tuition" is a legacy label used by a small
# number of districts in some years; those rows are also dropped, leaving their
# "Other" and "Tuition" cells as NaN rather than risk double-counting.

print("12/14  per_pupil_expenditures_by_object...")
ppo = normalize_cols(read("per_pupil_expenditures_by_object/per_pupil_expenditures_by_object.csv"))

DROP_OBJECTS = {"Total", "Other \ufffd Includes Tuition"}   # \ufffd = replacement char for em-dash
ppo = ppo[~ppo["object"].isin(DROP_OBJECTS)].copy()

PPO_VALS = ["expenditures", "ppe", "expenditures_real", "ppe_real"]
ppo_piv = ppo[["district_code", "fiscal_year", "object"] + PPO_VALS].pivot_table(
    index=["district_code", "fiscal_year"],
    columns="object",
    values=PPO_VALS,
    aggfunc="first",
)
ppo_piv.columns = [f"{slugify(v)}__{slugify(obj)}" for v, obj in ppo_piv.columns]
ppo_piv = ppo_piv.reset_index()
panel = merge_into(panel, ppo_piv, "ppo")


# STEP 13: Special education expenditures  (FY2007–FY2025)
# Long on district × year × expenditure_category, with two distinct source
# formats: "archived_wide" (FY2007–FY2017, 11 categories) and "current_long"
# (FY2018–FY2025, 11 different categories). There is no crosswalk between the
# two formats; both sets of category columns are preserved. The "Total
# Expenditures" (archived) and "Total" (current) category rows give the
# overall sped spend for each era respectively.

print("13/14  special_education_expenditures...")
sped = normalize_cols(read("special_education_expenditures/special_education_expenditures.csv"))

SPED_VALS = ["amount", "amount_real"]
sped_piv = sped[["district_code", "fiscal_year", "expenditure_category"] + SPED_VALS].pivot_table(
    index=["district_code", "fiscal_year"],
    columns="expenditure_category",
    values=SPED_VALS,
    aggfunc="first",
)
sped_piv.columns = [f"{slugify(v)}__{slugify(cat)}" for v, cat in sped_piv.columns]
sped_piv = sped_piv.reset_index()
panel = merge_into(panel, sped_piv, "sped")


# STEP 14: Students with disabilities, out-of-district placement  (FY2018–FY2025)
# Long on district × year × placement_type (two types). Pivoted wide.
# A "State Total" row in the source is dropped. No district_code column;
# resolved via name lookup.

print("14/14  swd_outplacement...")
swd = normalize_cols(read("swd_outplacement/swd_outplacement.csv"))
swd = swd[swd["district"] != "State Total"].copy()
swd = add_code(swd)

SWD_VALS = ["count", "percent"]
swd_piv = swd[["district_code", "fiscal_year", "placement_type"] + SWD_VALS].pivot_table(
    index=["district_code", "fiscal_year"],
    columns="placement_type",
    values=SWD_VALS,
    aggfunc="first",
)
swd_piv.columns = [f"{slugify(v)}__{slugify(pt)}" for v, pt in swd_piv.columns]
swd_piv = swd_piv.reset_index()
panel = merge_into(panel, swd_piv, "swd")


# FINALIZE
print("\nCleaning up...")

# drop orphan rows: a handful of district_code=NaN rows arise from two defunct
# early-2000s charter schools (Cross Cultural Academy, Highville Mustard Seed
# Charter School) that appear in ppe_archived and total_archived but have no
# enrollment record and no EdSight district code. They carry no usable data.
panel = panel[panel["district_code"].notna()].copy()
panel["district_code"] = panel["district_code"].astype("Int64")

# sort and reorder columns: identifiers first, then all value columns.
panel = panel.sort_values(["district_code", "fiscal_year"]).reset_index(drop=True)
id_cols   = ["district_name", "district_code", "fiscal_year"]
val_cols  = [c for c in panel.columns if c not in id_cols]
panel     = panel[id_cols + val_cols]

# checks
assert panel.duplicated(["district_code", "fiscal_year"]).sum() == 0, \
    "ERROR: duplicate (district_code, fiscal_year) pairs found; investigate before using."

print(f"\nDone.")
print(f"  Rows    : {len(panel):,}")
print(f"  Columns : {len(panel.columns):,}")
print(f"  Districts: {panel['district_code'].nunique():,}")
print(f"  Years   : {panel['fiscal_year'].min()}–{panel['fiscal_year'].max()}")
print(f"\nWriting {OUT}")

panel.to_csv(OUT, index=False)
