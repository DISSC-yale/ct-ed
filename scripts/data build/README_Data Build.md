# ct-gov: Data from data build scripts for the CT Governor's Office Project

## Latest as of Sept 16, 2026

The working focus, and thus dataset, has shifted to the ECS shell data only (`/data/ecs_shells_merged.csv`), covering FY2018–FY2027 for all 169 CT municipalities.

*Note*: As noted by the state CDE, EdSight financial data (from the main merged panel) could be appended for historical context back to FY2018 reliably, but doing so should be approached carefully. Two main differences: 

1. ECS shells and EdSight use different denominators for per-pupil calculations: ECS counts resident students (including those tuitioned out to regional districts or endowed academies, weighted fractionally, etc.), while EdSight counts enrolled students. 

2. They also differ in how they define the unit of analysis: ECS operates at the municipality level, EdSight at the LEA level.

*These differences mean that per-pupil figures from the two sources are not directly comparable for the same town, and combining them without adjustment could produce misleading results. If EdSight data is used alongside ECS data in any capacity, users should be clearly warned to interpret any cross-source comparisons with care.*

### Main CT EdSight data for dashboard:

> `data/ct_ed_merged_ecs.csv`

### Script to reproduce the sample figures in `/ct_ed_samp_plots`:

> `scripts/ct_ed_sample_plots.py`

## Main Data File Merging + Details Overview

Two scripts build a single CT education panel from multiple sources. The goal was to separate the edsight data from the shell data for ease and flexibility of future use. To generate each, run them in order:

1. **`build_ct_merged.py`** (in `1 - base merge` subdir) reads the 14 processed CSVs from `public-CT-ed-data-master/data/` and produces `ct_education_merged.csv`; one row per district × fiscal year; 296 columns over FY2006-FY2026.

2. **`build_ct_ed_merged_ecs.py`** (in `2 - ecs merge - final`) takes that base CSV, merges in four years of ECS shell data, and writes the **final merged data: `ct_ed_merged_ecs.csv`**; 344 columns in total over FY2006-FY2027. All year values are fiscal year *ending* years, i.e., FY2025 = school year 2024–25. EdSight uses this convention throughout and so both scripts preserve it. The `fiscal_year` column is an integer.

*Note:* while the merged CT data is the primary data of interest for the dashboard, full US state-district level data from SEDA is also included in the repo, for use as needed/desired in the dashboard, per Seth Zimmerman discussion. See the `SEDA Data` section below for more, as well as the `data/seda_by_state` subdir containing all state-level data, and there's also a [quick reference guide](https://github.com/DISSC/ct-gov/blob/main/seda_reference.md) at the root with more details on SEDA. 

---

## Sources included

### Base panel (build_ct_merged.py)

The repo contains 15 distinct CSVs. 14 are merged and 1 is skipped (see below):

| # | Source key | Grain (before merge) | Covered Years | Notes |
|-|---|---|---|---|
| 1 | `district_year_enrollment` | district × year | FY2008–FY2026 | **Merge reference** |
| 2 | `district_year_spending` | district × year | FY2018–FY2025 | |
| 3 | `district_year_ppe_extended` | district × year | FY2007–FY2025 | |
| 4 | `district_year_ppe_archived` | district × year | FY2007–FY2017 | |
| 5 | `district_year_revenue` | district × year | FY2018–FY2025 | |
| 6 | `district_year_accountability` | district × year | FY2025 only | |
| 7 | `total_annual_expenditures_archived` | district × year | FY2006–FY2017 | |
| 8 | `graduation_4yr` | district × year × needs_group | FY2012–FY2025 | Pivoted wide |
| 9 | `graduation_5yr` | district × year × needs_group | FY2012–FY2023 | Pivoted wide |
| 10 | `sbac` | district × year × subject × needs_group | FY2015–FY2025 | Pivoted wide |
| 11 | `sat` | district × year × subject × needs_group | FY2016–FY2025 | Pivoted wide |
| 12 | `per_pupil_expenditures_by_object` | district × year × object | FY2018–FY2025 | Pivoted wide |
| 13 | `special_education_expenditures` | district × year × category | FY2007–FY2025 | Pivoted wide |
| 14 | `swd_outplacement` | district × year × placement_type | FY2018–FY2025 | Pivoted wide |
| — | `cpi_u_deflator` | calendar year | 2006–2025 | **Skipped**; CPI values already embedded in finance files |

*Grain components:*

- `district`: a CT school district; ~170 levels (some variance; see district universe section below for more)
- `year`: fiscal year as noted; up to 21 levels (FY2006–FY2026) in the base panel
- `needs_group`: student subgroup by socioeconomic/demographic need (All Students, High Needs, Non-High Needs); pivoted wide
- `subject`: tested subject area for assessments (ELA, Math); pivoted wide
- `object`: expenditure object code category (salaries, benefits, purchased services, etc.); pivoted wide
- `category`: special education spending category; pivoted wide
- `placement_type`: type of special education outplacement setting; pivoted wide

### ECS shells (build_ct_ed_merged_ecs.py)

Four additional Excel workbooks, one per fiscal year:

| File | Sheet used | Fiscal year | Notes |
|---|---|---|---|
| `FY_2023-2024_ECS_shell.xlsx` | `FY 24` | 2024 | |
| `FY_2024-2025_ECS_shell.xlsx` | `FY 25` | 2025 | |
| `FY_2025-2026_ECS_shell.xlsx` | `FY 26` | 2026 | |
| `FY_2026-2027_ECS_shell_and_out_years.xlsx` | `FY 27` | 2027 | 9-tab workbook; only `FY 27` used |

Each shell has 169 rows: one per CT municipality. There is an additional messy multi-row header spanning rows 1-26 in all shells, with district data beginning at row 27. All four files have the same column layout; only the year-specific text in header labels changes (e.g., from `(10/2022)` to `(10/2023)`), so the same column index map applies to all four shells.

---

## Merge approach

### Base panel join key

The merge key throughout `build_ct_merged.py` is `(district_code, fiscal_year)`. District code is the EdSight numeric ID (e.g., `640011` for Hartford), stored as nullable integer (`Int64`).

Most source files have a district code column; four do not: `graduation_4yr`, `graduation_5yr`, `sat`, and `swd_outplacement`. So those are resolved by matching district names against the enrollment file via a `normalize_name()` lookup. A few early archived district names that fail to match are dropped as orphan rows (see more below if interested).

### ECS shell join key

The ECS shells contain CT town names only (e.g., `Andover`, `Ansonia`), with no district code. The join resolves each town name by stripping common suffixes from the merged panel's `district_name` column and matching on the normalized form. Looks like this:

```python
def normalize_name(s):
    s = str(s).strip().upper()
    for suffix in (" SCHOOL DISTRICT", " SCHOOL DIST", " SCHOOL",
                   " DISTRICT", " DIST", " PUBLIC SCHOOLS", " CITY SCHOOLS"):
        if s.endswith(suffix):
            s = s[:-len(suffix)].strip()
    return s
```

This matches 149 of the 169 shell towns to existing district codes. The other 20 are member towns of "Regional School Districts" that have no standalone LEA in EdSight (see the district universe section below for more). Those 20 become new rows carrying ECS data only, with `district_code = NaN`. Yet, they still have complete information for `district_name`, so they could be used to filter, select, build plots or anything else att he district level downstream.

### Merge type

All merges in `build_ct_merged.py` are `how="outer"`; i.e., every district × year combination present in any source ends up in the final panel. The ECS merge is a left join onto the existing panel, followed by appends for the unmatched towns and the new FY2027 rows.

### Row structure of the extended panel

| Row type | Count | Description |
|---|---|---|
| Base panel rows (FY2006–FY2026) | 4,132 | From `build_ct_merged.py`; ECS columns filled for FY2024–26 where town matched |
| New unmatched town rows (×4 years) | 80 | 20 RSD member towns × FY2024-27; ECS data only, all other cols NaN |
| New FY2027 matched rows | 149 | 149 matched town districts; ECS data only (no enrollment/assessment data yet) |
| **Total** | **4,361** | |

### Column naming

Every value column in the output is prefixed with a short source tag and a double underscore separator: `{source}__{column}`. Enrollment columns are the only exception; they have no prefix and appear first.

| Prefix | Source |
|---|---|
| *(none)* | `district_year_enrollment` |
| `sp__` | `district_year_spending` |
| `ppe_ext__` | `district_year_ppe_extended` |
| `ppe_arch__` | `district_year_ppe_archived` |
| `rev__` | `district_year_revenue` |
| `acct__` | `district_year_accountability` |
| `tot_arch__` | `total_annual_expenditures_archived` |
| `grad4__` | `graduation_4yr` |
| `grad5__` | `graduation_5yr` |
| `sbac__` | `sbac` |
| `sat__` | `sat` |
| `ppo__` | `per_pupil_expenditures_by_object` |
| `sped__` | `special_education_expenditures` |
| `swd__` | `swd_outplacement` |
| `ecs__` | ECS shell files |

Column names within each source are "slugified", e.g., lowercased, punctuation stripped, spaces replaced with underscores via the `slugify()` helper in `build_ct_merged.py`. The full name for SBAC ELA proficiency for all students, e.g., would be `sbac__pct_prof__ela__all_students`.

### Pivoting multi-dimensional sources

Five sources in the base panel had more than two identifying dimensions and are reshaped from long to wide before merging. The pivot logic is the same for all:

```python
df.pivot_table(
    index=["district_code", "fiscal_year"],
    columns=<extra_dim(s)>,
    values=<value_cols>,
    aggfunc="first",   # no true duplicates; "first" picks the one value
)
```

After pivoting, column name tuples are flattened and slugified into strings.

---

## A quick note on nulls

The panel is structurally sparse. High null rates are correct behavior, rather than errors. Three things produce nulls:

**1. Year-range gaps.** Each source covers a different span; spending columns are null for FY2006–FY2017 because the spending file only starts in FY2018; accountability is null for every year except FY2025. ECS columns are null for all years before FY2024.

**2. District coverage gaps.** Not every district reports every metric every year. Small districts, charters, and regional districts are often absent from assessment files, from graduation files (no high school), or from SAT files (no participation).

**3. Suppressed cells.** EdSight suppresses cells when student counts are too small to protect privacy (typically n < 20). Those cells are NaN in the source CSVs and remain NaN here.

Filtering to a single recent year drops null rates substantially. For most finance columns in FY2025, null rates are well under 5%.

---

## District universe and the "169" question

Connecticut has 169 incorporated municipalities, each with its own board of education. The base panel covers 206 distinct LEAs, because EdSight tracks several additional entity types:

| Code suffix | Type | Count in panel |
|---|---|---|
| `11` | Municipal school districts (town LEAs) | 149 |
| `12` | Regional school districts (multi-town) | 18 |
| `13` | Charter schools | 24 |
| `14` | Regional Educational Service Centers (RESCs) | 6 |
| `16` | State-operated (CTECS) | 1 |
| `18` | Other (Goodwin University Educational Services) | 1 |

**Why there are 149 town districts, not 169:** 18 Connecticut towns send students to a Regional School District for some or all grades and do not operate their own PreK–12 district. Those towns appear in the base panel only through their regional district's rows.

**Why there are only 18 regional districts, not 20:** Regional School Districts 02 and 03 are absent from all EdSight exports. They seem to have dissolved or maybe reorganized and are not in the source data.

**Why the ECS panel has extra unmatched rows:** ECS grants flow to the *municipality*, not the LEA, so the shells include all 169 towns including the 20 that send students to RSDs without having their own district code. Those 20 towns listed below exist in the extended panel as ECS-only rows with no enrollment, spending, or assessment counterpart.

**The 20 unmatched RSD-member towns:**
Beacon Falls, Bethlehem, Bridgewater, Burlington, Durham, Goshen, Haddam, Harwinton, Killingworth, Lyme, Middlebury, Middlefield, Morris, Old Lyme, Prospect, Roxbury, Southbury, Warren, Washington, Woodbury

These are real, populated ECS rows with genuine entitlement values, not zeros or placeholders. Haddam, for example, had FY2024 resident students of 1,120 and a final ECS entitlement of ~$2.75M.

**Odd or notable districts:**
- `Connecticut Technical Education and Career System (CTECS)`: state-operated network of 17 tech high schools; appears as a single LEA (`9000016`)
- `Capitol Region Education Council`, `EASTCONN`, `EdAdvance`, `Learn`, `Cooperative Educational Services`, `Area Cooperative Educational Services`: RESCs (service agencies), not traditional districts, but they operate some schools and appear in enrollment and graduation data
- `Goodwin University Educational Services (GUES)`: appeared in SAT data starting FY2022; classified as a post-secondary partnership/alternative program
- `Department of Mental Health and Addiction Services`: appears sporadically in graduation data for students in state-run residential programs; very small cohort counts, heavily suppressed
- `Unified School District #1` and `#2`: state-operated programs for incarcerated youth; large cohort counts but graduation rates of 1–3%, reflecting the population served
- Several charters (`Jumoke Academy`, `Explorations District`, `Common Ground High School`) appear intermittently as they opened, closed, or changed enrollment status across years

---

## Some oddities and edge cases

### FY2026 enrollment is forward looking
The enrollment file extends to FY2026 (school year 2025–26), but no other EdSight source covers that year. All FY2026 rows from the base panel have enrollment data and NaN for everything else — except ECS columns, which are now populated from the FY2026 shell.

### FY2027 is only ECS
FY2027 exists in the extended panel for the 149 matched town districts and 20 unmatched towns, but only with ECS data. Enrollment, assessment, and finance columns are all NaN.

### SAT and graduation raw files have garbage rows
The `graduation_4yr`, `graduation_5yr`, and `sat` raw scrapers absorbed full HTML table headers from EdSight's export pages as literal CSV rows. The processed CSVs have cleaned most of these, but the script adds an extra filter on `needs_group` (keeping only `All Students`, `High Needs`, `Non-High Needs`) which discards any remaining artifacts.

### Cross Cultural Academy and Highville Mustard Seed Charter School
Two defunct charter schools appear in `ppe_archived` and `total_annual_expenditures_archived` for FY2006–FY2007 with no EdSight district code and no enrollment record. The name-lookup step cannot resolve them, so they produce orphan rows that are dropped. The later "Highville Charter School District" (`2860013`) is a distinct successor and is not affected.

### Hartford missing from finance data in FY2015–FY2016
Hartford School District is absent from CSDE's archived financial collections for FY2015 and FY2016. The `tot_arch__` columns are NaN for those years. This is a known source-data gap, not a processing error.

### SBAC/SAT FY2020 and FY2021 are structurally absent
No Smarter Balanced or SAT assessments were administered during COVID (2019–20 or 2020–21). There are no rows in those sources for FY2020 or FY2021; the NaNs in `sbac__` and `sat__` columns for those years are correct.

### Per-pupil object "Other — Includes Tuition"
A small number of districts reported a combined "Other — Includes Tuition" line rather than separate "Other" and "Tuition" lines. The script drops these combined rows rather than attempt to split them. Affected districts have NaN in `ppo__ppe__other` and `ppo__ppe__tuition` for those years. `sp__ppe_total` is unaffected.

### Special education: two non-overlapping category schemas
The archived (FY2007–FY2017) and current (FY2018–FY2025) special education expenditure files use different line-item categories with no official crosswalk. Both sets of columns are preserved. Only `Employee Benefits`, `Property Services`, and `Equipment` appear in both schemas by the same name. For a longitudinal series, use `sped__amount__total_expenditures` (archive era) and `sped__amount__total` (current era) as the overall totals.

### ECS shell: change_from_prior_year absent in FY2025–FY2027
Column 51 (`ecs__change_from_prior_year`) is populated only for FY2024. The FY2025, FY2026, and FY2027 shells have no data in that column position — it is NaN for those years. This is a source-data difference across shell versions, not a processing error.

### ECS shell: resident_students vs. enrollment_total
The ECS shell's `ecs__resident_students` and the enrollment file's `enrollment_total` measure similar but not identical things. ECS uses a weighted resident student count that includes fractional credits for students sent to regional districts, endowed academies, and other settings. Enrollment total is a straight headcount. Expect small discrepancies for districts that tuition students out.

### District name inconsistencies across sources
District names are not perfectly consistent across source files. The scripts join on district code where available and use name-to-code lookup only as a fallback.

---

## Suggested filters or pulls of data

```python
import pandas as pd

df = pd.read_csv("ct_education_merged_with_ecs.csv")

# All data for a single recent year
fy2025 = df[df["fiscal_year"] == 2025]

# Only traditional town + regional school districts (exclude charters, RESCs, etc.)
df["code_suffix"] = df["district_code"].astype(str).str[-2:]
regular = df[df["code_suffix"].isin(["11", "12"])]

# Only districts with high school (have graduation data)
has_hs = df[df["grad4__graduation_rate__all_students"].notna()]

# ECS entitlement time series for a single town district
hartford = df[df["district_code"] == 640011][
    ["fiscal_year", "enrollment_total", "ecs__ecs_entitlement_with_alliance_hh"]
]

# All 20 unmatched RSD-member towns (ECS data only)
rsd_towns = df[df["district_code"].isna() & df["ecs__town_name"].notna()]

# Finance columns only, recent era
finance_cols = (
    ["district_name", "district_code", "fiscal_year"]
    + [c for c in df.columns if c.startswith(("sp__", "rev__", "ppe_ext__"))]
)
finance = df[finance_cols]

# All ECS columns for FY2024-2027
ecs_cols = ["district_name", "district_code", "fiscal_year"] + [
    c for c in df.columns if c.startswith("ecs__")
]
ecs_panel = df[df["fiscal_year"] >= 2024][ecs_cols]
```

---

## Column count summary

### Base merged panel (ct_education_merged.csv)

| Source | Columns |
|---|---|
| Identifiers | 3 |
| Enrollment | 27 |
| Spending | 51 |
| PPE extended | 4 |
| PPE archived | 9 |
| Revenue | 9 |
| Accountability | 3 |
| Total exp archived | 10 |
| Graduation 4yr | 9 |
| Graduation 5yr | 9 |
| SBAC | 54 |
| SAT | 36 |
| PPE by object | 28 |
| Special ed expenditures | 40 |
| SWD outplacement | 4 |
| **Total** | **296** |

### Complete and final panel with ECS (`data/ct_ed_merged_ecs.csv`)

296 base columns + 48 ECS columns = **344 columns total**.

---

## SEDA Data (`data/seda_by_state/`)

As noted, we have also obtained and cleaned nationally standardized test score estimates for ~16,000 US school districts, 2009-2025, from the Stanford Education Data Archive (v2025.2), aka, SEDA. Derived from state accountability tests (grades 3–8) and mapped to a common scale, which is the only source enabling direct cross-state district comparisons.

Organization of the repo: SEDA data are large, so the merged data are split into one CSV per state (e.g. CT.csv, NY.csv) to stay under GitHub's file size limit. All files share the same 164-column structure: one row per district × year, allowing you to load only what you need, e.g.:

```python
ct = pd.read_csv("data/seda_by_state/CT.csv")
```

Potential key columns for the dashboard: `cs_mn_avg_eb__all` (overall achievement, in SD units relative to the national average), `cs_mn_avg_eb__gap_wbg` / `__gap_neg` / `__gap_mfg` (White–Black, income, and gender gaps), and `sesall` (composite SES index). See the [quick reference guide](https://github.com/DISSC/ct-gov/blob/main/seda_reference.md) for the full column inventory and some notes to consider for joining to the main EdSight CT panel.

---

## Appendix: Column inventory by source

### Enrollment (no prefix)

Demographics and enrollment counts from EdSight's enrollment export. Columns:

`enrollment_total`, `n_black`, `n_hispanic`, `n_white`, `n_native_american`, `n_asian`, `n_two_or_more`, `n_pacific_islander`, `n_ell`, `n_free_lunch`, `n_reduced_lunch`, `n_sped`, `n_frpl`, `n_black_hispanic`, `pct_white`, `pct_black`, `pct_hispanic`, `pct_asian`, `pct_native_american`, `pct_two_or_more`, `pct_pacific_islander`, `pct_black_hispanic`, `pct_ell`, `pct_free_lunch`, `pct_frpl`, `pct_sped`, `pct_nonwhite`

`n_frpl` = free + reduced-price lunch combined. `pct_nonwhite` = 100 − pct_white (not the same as summing individual group pcts, which can exceed 100 due to multi-race).

### Spending (`sp__`)

51 columns. Net current expenditures broken down by function (instruction, plant operations, student transportation, etc.), plus per-pupil versions and real-dollar (CPI-deflated) versions of each. Key columns:

- `sp__total_expenditures`: total net current expenditure
- `sp__ppe_total`: per-pupil total
- `sp__ppe_total_real`: per-pupil total, inflation-adjusted to 2025 dollars
- `sp__exp_instruction`: raw instruction expenditure
- `sp__ppe_instruction`: per-pupil instruction expenditure

The `_real` suffix on any column means it has been deflated using CPI-U (base year: 2025). The deflator values themselves (`cpi_u`, `deflator`) were dropped from this source since they are identical to the `ppe_ext__cpi_u` / `ppe_ext__deflator` columns.

### PPE extended (`ppe_ext__`)

4 columns: `ppe_total`, `cpi_u`, `deflator`, `ppe_total_real`. A spliced series unifying the archived (pre-FY2018) and modern (FY2018+) per-pupil expenditure totals into one consistent column spanning FY2007–FY2025. Use `ppe_ext__ppe_total_real` for any time-series analysis crossing the FY2017/2018 boundary.

### PPE archived (`ppe_arch__`)

9 columns: per-pupil breakdown by function for FY2007–FY2017. Categories: `instructional_staff`, `instructional_supplies`, `instruction_media`, `student_support`, `admin_support`, `plant`, `transportation`, `other`, `total`. These align roughly but not precisely with the modern spending-by-function categories.

### Revenue (`rev__`)

`rev_local`, `rev_state`, `rev_federal`, `rev_tuition_other`, `rev_total`, `pct_local`, `pct_state`, `pct_federal`, `pct_tuition_other`. FY2018–FY2025 only.

### Accountability (`acct__`)

3 columns: `ela_growth`, `math_growth`, `accountability_index`. FY2025 only. The accountability index combines multiple indicators (SBAC proficiency, growth, graduation rates, etc.) into a single 0–100 composite. Only ~199 districts have FY2025 data; the column is ~95% null across the full panel's year range.

### Total expenditures archived (`tot_arch__`)

FY2006–FY2017 predecessor to the modern spending file. Categories: `exp_instructional_staff`, `exp_instructional_supplies`, `exp_instruction_media`, `exp_student_support`, `exp_admin_support`, `exp_plant`, `exp_transportation`, `exp_tuitioned_out`, `exp_other`, `total_expenditures`. Total dollar amounts, not per-pupil. Not inflation-adjusted in this file (combine with `ppe_ext__deflator` if you need real dollars).

### Graduation 4-year (`grad4__`) and 5-year (`grad5__`)

9 columns each, structured as `{metric}__{needs_group}`. Metrics: `cohort_count`, `graduation_count`, `graduation_rate`. Needs groups: `all_students`, `high_needs`, `non_high_needs`. Example: `grad4__graduation_rate__all_students`. Not all districts report all three needs groups in every year.

### SBAC (`sbac__`)

54 columns structured as `{metric}__{subject}__{needs_group}`. Subjects: `ela`, `math`. Needs groups: `all_students`, `high_needs`, `non_high_needs`. Metrics: `total_students`, `total_tested`, `participation_rate`, `n_scored`, `level1_pct` through `level4_pct`, `pct_prof`.

`pct_prof` = percent at level 3 or 4 (meeting or exceeding standard). FY2020 and FY2021 are structurally absent (COVID); NaNs in those years are correct.

### SAT (`sat__`)

36 columns structured as `{metric}__{subject}__{needs_group}`. Subjects: `ela`, `math`. Metrics: `total_students`, `total_tested`, `participation_rate`, `n_scored`, `pct_prof`, `avg_score`. Same COVID gap as SBAC.

### Per-pupil expenditures by object (`ppo__`)

28 columns structured as `{metric}__{object}`. Objects: `employee_benefits`, `property`, `purchased_services`, `salaries`, `supplies`, `tuition`, `other`. Metrics: `expenditures`, `ppe`, `expenditures_real`, `ppe_real`. Two object labels were dropped: `Total` (redundant with `sp__ppe_total`) and `Other — Includes Tuition` (see edge cases section).

### Special education expenditures (`sped__`)

40 columns. Two non-overlapping category sets due to a reporting format change in FY2018:

**Archived (FY2007–FY2017):** `amount__certified_personnel`, `amount__noncertified_personnel`, `amount__employee_benefits`, `amount__purchased_services`, `amount__tuition_to_other_schools`, `amount__instructional_supplies`, `amount__property_services`, `amount__transportation`, `amount__equipment`, `amount__other_expenditures`, `amount__total_expenditures`

**Current (FY2018–FY2025):** `amount__teacher_salaries`, `amount__instructional_aide_salaries`, `amount__other_salaries`, `amount__employee_benefits`, `amount__purchased_services_other_than_transportation`, `amount__purchased_services_for_transportation`, `amount__special_education_tuition`, `amount__supplies`, `amount__property_services`, `amount__equipment`, `amount__all_other_expenditures`, `amount__total`

Both sets include `_real` versions. For a continuous series use `sped__amount__total_expenditures` (archive era) and `sped__amount__total` (current era).

### SWD outplacement (`swd__`)

4 columns: `count__private_schools_or_other_settings`, `percent__private_schools_or_other_settings`, `count__public_schools_in_other_districts`, `percent__public_schools_in_other_districts`. FY2018–FY2025.

### ECS shells (`ecs__`)

48 columns, populated for FY2024–FY2027 only. All intermediate formula-output columns from the shells are kept — so the intermediate steps in the ECS calculation (wealth adjustment factor, base aid ratio, need student counts, etc.) are all present and usable alongside the final grant figure.

The primary output column is `ecs__ecs_entitlement_with_alliance_hh` — the final ECS grant amount incorporating Alliance District hold-harmless provisions. For districts not subject to Alliance hold-harmless, `ecs__ecs_entitlement_without_alliance_hh` is identical.

| Column | Description |
|---|---|
| `ecs__town_name` | Bare town name from the shell (join key source) |
| `ecs__drg` | District Reference Group (A–H) |
| `ecs__psd_flag` | Priority School District flag |
| `ecs__alliance_district_flag` | Alliance District flag |
| `ecs__alliance_non_reform_flag` | Alliance Non-Reform flag |
| `ecs__reform_district_flag` | Reform District flag |
| `ecs__wealth_decile` | 17-town wealth decile |
| `ecs__pic_decile` | PIC (Property and Income Combined) decile |
| `ecs__town_code` | ECS sequential town number (1–169) |
| `ecs__resident_students` | Weighted resident student count (Oct enrollment, incl. fractional RSD/academy credits) |
| `ecs__frpl_students` | Free & reduced-price lunch students |
| `ecs__frpl_poverty_portion` | FRPL × 0.30 (need formula component) |
| `ecs__net_resident_students_60pct` | Resident students × 0.60 (60% threshold baseline) |
| `ecs__excess_resident_students` | FRPL above 60% threshold (max(FRPL − 60%×residents, 0)) |
| `ecs__excess_resident_students_portion` | Excess students × 0.15 |
| `ecs__frpl_pct_above_60pct` | FRPL % in excess of 60% |
| `ecs__concentrated_poverty_students` | Concentrated poverty student count |
| `ecs__ell_students` | English Language Learner students |
| `ecs__ell_need_students_portion` | ELL × 0.25 (need formula component) |
| `ecs__frpl_weight` | FRPL × need weighting factor (Item A) |
| `ecs__total_need_students` | Total weighted need students (sum of all need components) |
| `ecs__engl_3yr_avg` | 3-year average Equalized Net Grand List (town wealth measure) |
| `ecs__total_population` | Town total population |
| `ecs__engl_per_capita` | ENGL per capita (EEPC) |
| `ecs__engl_adjustment_factor` | EEPC / statewide median EEPC threshold |
| `ecs__median_household_income` | Median household income |
| `ecs__mhi_adjustment_factor` | MHI / statewide median MHI threshold |
| `ecs__wealth_adjustment_factor` | Combined wealth adjustment factor |
| `ecs__base_aid_ratio` | Base aid ratio (pre-PIC adjustment) |
| `ecs__pic_add_base_aid_ratio_adjustment` | PIC add-on to base aid ratio |
| `ecs__final_base_aid_ratio` | Final base aid ratio (base + PIC) |
| `ecs__students_sent_to_regional_district` | Students tuitioned to RSD |
| `ecs__n_regional_district_grades` | Number of grades in RSD |
| `ecs__regional_district_bonus` | Regional district bonus ($100 × students × grades) |
| `ecs__students_sent_to_endowed_academies` | Students at endowed academies |
| `ecs__n_endowed_academy_grades` | Number of grades at endowed academies |
| `ecs__endowed_academy_bonus` | Endowed academy bonus |
| `ecs__base_formula_aid` | Base formula aid (need students × final aid ratio × foundation) |
| `ecs__fully_funded_grant` | Fully funded grant (base + bonuses) |
| `ecs__ecs_actual_fy2017` | FY2017 actual ECS grant (hold-harmless baseline) |
| `ecs__fully_funded_grant_with_alliance_hh` | Fully funded grant with Alliance District hold-harmless |
| `ecs__prior_year_entitlement` | Prior fiscal year ECS entitlement |
| `ecs__grant_adjustment` | Grant adjustment (gap between fully funded and prior year) |
| `ecs__fully_funded_gt_prior_year` | Yes/No: is fully funded grant above prior year? |
| `ecs__phase_in_amount` | Phase-in amount (portion of gap applied this year) |
| `ecs__ecs_entitlement_without_alliance_hh` | **Final ECS grant, without Alliance hold-harmless** |
| `ecs__ecs_entitlement_with_alliance_hh` | **Final ECS grant, with Alliance hold-harmless** ← primary output |
| `ecs__change_from_prior_year` | Change from prior year entitlement (FY2024 only; NaN in FY2025–27) |
