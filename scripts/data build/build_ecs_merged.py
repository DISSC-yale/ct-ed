"""
build_ecs_merged_full.py
========================
Extracts all inputs, policy parameters, and formula outputs from ECS shell
files spanning FY2018–FY2027 into a single flat CSV.

Structural eras
---------------
FY2018 (.xls)   : Statutory year — entitlement set by P.A. 16-2 MSS, not formula.
                  Formula components still present in sheet; final entitlement col
                  is labeled computed__ecs_entitlement_statutory (not formula output).
                  FRPL threshold: 75%. Phase-in: per-type K/L/M params.
                  ELL weight (Item H) = 0.15 in this year only.

FY2019–FY2021   : Formula era, FRPL threshold 75%. Phase-in uses per-district-type
                  rates (K/L/M params: non-alliance / alliance / reform). Items H/I
                  absent FY2019/20; return in FY2021 with different labeling.
                  FY2021 file is present but note: no FY2022 shell in this dataset.

FY2023          : Formula era, FRPL threshold switches to 60%. Column layout shifts
                  left vs FY2019–21. Closest to FY2024+ schema. No DRG col.
                  No change_from_prior_year col.

FY2024–FY2027   : Modern era. PIC decile added. Items H/I for phase-in.
                  FY2024 only has change_from_prior_year (col 51).

Missing years   : FY2022 — no shell available in this dataset.

Output columns use consistent names across all years; NaN where a column
genuinely did not exist in a given year's shell.
"""

import os
import pandas as pd
import xlrd
from openpyxl import load_workbook

OUT = "data/ecs_shells_merged.csv.gz"
DATA_DIR = "data/ecs_shells"

# ── Shell file registry ───────────────────────────────────────────────────────
SHELLS = {
    2018: (
        os.path.join(DATA_DIR, "ECS Shell 2017-18 Final Version.xls"),
        "Simulation1",
        "xls",
    ),
    2019: (os.path.join(DATA_DIR, "ecs shell 2018-19-only.xlsx"), "FY 2018-19", "xlsx"),
    2020: (os.path.join(DATA_DIR, "ecs shell 2019-2020.xlsx"), "FY 2019-20", "xlsx"),
    2021: (os.path.join(DATA_DIR, "ecs shell 2020-21.xlsx"), "FY 2020-21", "xlsx"),
    2022: (os.path.join(DATA_DIR, "ecs shell 2021-22.xlsx"), "Current Law", "xlsx"),
    2023: (os.path.join(DATA_DIR, "ecs shell 2022-23.xlsx"), "Current Law", "xlsx"),
    2024: (os.path.join(DATA_DIR, "FY 2023-2024 ECS shell.xlsx"), "FY 24", "xlsx"),
    2025: (os.path.join(DATA_DIR, "FY 2024-2025 ECS shell.xlsx"), "FY 25", "xlsx"),
    2026: (os.path.join(DATA_DIR, "FY 2025-2026 ECS shell.xlsx"), "FY 26", "xlsx"),
    2027: (
        os.path.join(DATA_DIR, "FY 2026-2027 ECS shell and out years.xlsx"),
        "FY 27",
        "xlsx",
    ),
}

# ── Per-era header parameter locations ───────────────────────────────────────
# Format: (excel_row_1indexed, col_0indexed, output_name)

PARAMS_FY2018 = [
    (2, 15, "param_A_need_weight_frpl"),
    (3, 15, "param_B_engl_mhi_threshold_factor"),
    (4, 15, "param_C_engl_per_capita_weight"),
    (5, 15, "param_D_mhi_weight"),
    (6, 15, "param_E_min_aid_ratio_nonalliance"),
    (7, 15, "param_F_min_aid_ratio_alliance"),
    (8, 15, "param_G_foundation"),
    (9, 15, "param_H_ell_weight"),  # ELL weight; different meaning than FY2024+ H
    (12, 15, "param_K_phasein_nonalliance"),
    (13, 15, "param_L_phasein_alliance"),
    (14, 15, "param_M_phasein_reform"),
    (20, 19, "param_eepc_median"),
    (21, 20, "param_eepc_threshold"),
    (20, 21, "param_mhi_median"),
    (21, 22, "param_mhi_threshold"),
]

# FY2019 and FY2020 share the same parameter column positions
PARAMS_FY2019 = [
    (2, 11, "param_A_need_weight_frpl"),
    (3, 11, "param_B_engl_mhi_threshold_factor"),
    (4, 11, "param_C_engl_per_capita_weight"),
    (5, 11, "param_D_mhi_weight"),
    (6, 11, "param_E_min_aid_ratio_nonalliance"),
    (7, 11, "param_F_min_aid_ratio_alliance"),
    (8, 11, "param_G_foundation"),
    (13, 19, "param_K_phasein_nonalliance"),
    (14, 19, "param_L_phasein_alliance"),
    (15, 19, "param_M_phasein_reform"),
    (20, 23, "param_eepc_median"),
    (21, 24, "param_eepc_threshold"),
    (20, 25, "param_mhi_median"),
    (21, 26, "param_mhi_threshold"),
]

PARAMS_FY2020 = PARAMS_FY2019  # same positions

PARAMS_FY2021 = [
    (2, 11, "param_A_need_weight_frpl"),
    (3, 11, "param_B_engl_mhi_threshold_factor"),
    (4, 11, "param_C_engl_per_capita_weight"),
    (5, 11, "param_D_mhi_weight"),
    (6, 11, "param_E_min_aid_ratio_nonalliance"),
    (7, 11, "param_F_min_aid_ratio_alliance"),
    (8, 11, "param_G_foundation"),
    (9, 11, "param_H_phasein_pct_underfunded"),
    (10, 11, "param_I_phasein_pct_overfunded"),
    (13, 19, "param_K_phasein_nonalliance"),
    (14, 19, "param_L_phasein_alliance"),
    (15, 19, "param_M_phasein_reform"),
    (20, 23, "param_eepc_median"),
    (21, 24, "param_eepc_threshold"),
    (20, 25, "param_mhi_median"),
    (21, 26, "param_mhi_threshold"),
]

PARAMS_FY2022 = [
    (2, 11, "param_A_need_weight_frpl"),
    (3, 11, "param_B_engl_mhi_threshold_factor"),
    (4, 11, "param_C_engl_per_capita_weight"),
    (5, 11, "param_D_mhi_weight"),
    (6, 11, "param_E_min_aid_ratio_nonalliance"),
    (7, 11, "param_F_min_aid_ratio_alliance"),
    (8, 11, "param_G_foundation"),
    (9, 11, "param_H_phasein_pct_underfunded"),
    (10, 11, "param_I_phasein_pct_overfunded"),
    (13, 23, "param_K_phasein_nonalliance"),
    (14, 23, "param_L_phasein_alliance"),
    (15, 23, "param_M_phasein_reform"),
    (20, 27, "param_eepc_median"),
    (21, 28, "param_eepc_threshold"),
    (20, 29, "param_mhi_median"),
    (21, 30, "param_mhi_threshold"),
]

PARAMS_FY2023 = [
    (2, 8, "param_A_need_weight_frpl"),
    (3, 8, "param_B_engl_mhi_threshold_factor"),
    (4, 8, "param_C_engl_per_capita_weight"),
    (5, 8, "param_D_mhi_weight"),
    (6, 8, "param_E_min_aid_ratio_nonalliance"),
    (7, 8, "param_F_min_aid_ratio_alliance"),
    (8, 8, "param_G_foundation"),
    (9, 8, "param_H_phasein_pct_underfunded"),
    (10, 8, "param_I_phasein_pct_overfunded"),
    (20, 24, "param_eepc_median"),
    (21, 25, "param_eepc_threshold"),
    (20, 26, "param_mhi_median"),
    (21, 27, "param_mhi_threshold"),
]

PARAMS_FY2024_PLUS = [
    (2, 11, "param_A_need_weight_frpl"),
    (3, 11, "param_B_engl_mhi_threshold_factor"),
    (4, 11, "param_C_engl_per_capita_weight"),
    (5, 11, "param_D_mhi_weight"),
    (6, 11, "param_E_min_aid_ratio_nonalliance"),
    (7, 11, "param_F_min_aid_ratio_alliance"),
    (8, 11, "param_G_foundation"),
    (9, 11, "param_H_phasein_pct_underfunded"),
    (10, 11, "param_I_phasein_pct_overfunded"),
    (20, 27, "param_eepc_median"),
    (21, 28, "param_eepc_threshold"),
    (20, 29, "param_mhi_median"),
    (21, 30, "param_mhi_threshold"),
]

# ── Per-era data column maps ──────────────────────────────────────────────────
# Format: (col_0indexed, output_name, "input"|"computed")
# NaN is used for columns absent in a given era.

COL_MAP_FY2018 = [
    (0, "input__drg", "input"),
    (1, "input__psd_flag", "input"),
    (2, "input__alliance_district_flag", "input"),
    (3, "input__alliance_non_reform_flag", "input"),
    (4, "input__reform_district_flag", "input"),
    (5, "input__wealth_decile", "input"),
    (6, "town_code", "input"),
    (7, "town_name", "input"),
    (8, "input__resident_students", "input"),
    (9, "computed__net_resident_students_60pct", "computed"),  # x0.75 in this year
    (10, "input__frpl_students", "input"),
    (11, "computed__excess_resident_students", "computed"),
    (12, "computed__excess_resident_students_portion", "computed"),
    (13, "input__ell_students", "input"),
    (14, "computed__ell_need_students_portion", "computed"),
    (15, "computed__frpl_weight", "computed"),
    (16, "computed__total_need_students", "computed"),
    (17, "input__engl_3yr_avg", "input"),
    (18, "input__total_population", "input"),
    (19, "computed__engl_per_capita", "computed"),
    (20, "computed__engl_adjustment_factor", "computed"),
    (21, "input__median_household_income", "input"),
    (22, "computed__mhi_adjustment_factor", "computed"),
    (25, "computed__wealth_adjustment_factor", "computed"),
    (26, "computed__base_aid_ratio", "computed"),
    (27, "computed__final_base_aid_ratio", "computed"),
    (28, "input__students_sent_to_regional_district", "input"),
    (29, "input__n_regional_district_grades", "input"),
    (30, "computed__regional_district_bonus", "computed"),
    (31, "computed__endowed_academy_bonus", "computed"),
    (32, "computed__base_formula_aid", "computed"),
    (33, "computed__fully_funded_grant", "computed"),
    (34, "input__ecs_actual_fy2017", "input"),
    (38, "input__prior_year_entitlement", "input"),
    # FY2018: final entitlement is statutory, not formula-derived
    (43, "computed__ecs_entitlement_with_alliance_hh", "computed"),
    (43, "computed__ecs_entitlement_without_alliance_hh", "computed"),
]

# FY2019: entitlement at col 40, prior year at col 36 (FY17 actual)
COL_MAP_FY2019 = [
    (0, "input__drg", "input"),
    (5, "input__wealth_decile", "input"),
    (7, "town_code", "input"),
    (8, "town_name", "input"),
    (10, "input__resident_students", "input"),
    (13, "input__frpl_students", "input"),
    (18, "input__ell_students", "input"),
    (19, "computed__ell_need_students_portion", "computed"),
    (20, "computed__total_need_students", "computed"),
    (21, "input__engl_3yr_avg", "input"),
    (22, "input__total_population", "input"),
    (23, "computed__engl_per_capita", "computed"),
    (24, "computed__engl_adjustment_factor", "computed"),
    (25, "input__median_household_income", "input"),
    (26, "computed__mhi_adjustment_factor", "computed"),
    (27, "computed__wealth_adjustment_factor", "computed"),
    (28, "computed__base_aid_ratio", "computed"),
    (29, "computed__final_base_aid_ratio", "computed"),
    (30, "input__students_sent_to_regional_district", "input"),
    (31, "input__n_regional_district_grades", "input"),
    (32, "computed__regional_district_bonus", "computed"),
    (33, "computed__base_formula_aid", "computed"),
    (34, "computed__fully_funded_grant", "computed"),
    (36, "input__ecs_actual_fy2017", "input"),
    (
        40,
        "computed__ecs_entitlement_with_alliance_hh",
        "computed",
    ),  # col 40 = final entitlement FY2019
    (
        40,
        "computed__ecs_entitlement_without_alliance_hh",
        "computed",
    ),
]

# FY2020: entitlement at col 41, prior year (FY19) at col 37
COL_MAP_FY2020 = [
    (0, "input__drg", "input"),
    (5, "input__wealth_decile", "input"),
    (7, "town_code", "input"),
    (8, "town_name", "input"),
    (10, "input__resident_students", "input"),
    (13, "input__frpl_students", "input"),
    (18, "input__ell_students", "input"),
    (19, "computed__ell_need_students_portion", "computed"),
    (20, "computed__total_need_students", "computed"),
    (21, "input__engl_3yr_avg", "input"),
    (22, "input__total_population", "input"),
    (23, "computed__engl_per_capita", "computed"),
    (24, "computed__engl_adjustment_factor", "computed"),
    (25, "input__median_household_income", "input"),
    (26, "computed__mhi_adjustment_factor", "computed"),
    (27, "computed__wealth_adjustment_factor", "computed"),
    (28, "computed__base_aid_ratio", "computed"),
    (29, "computed__final_base_aid_ratio", "computed"),
    (30, "input__students_sent_to_regional_district", "input"),
    (31, "input__n_regional_district_grades", "input"),
    (32, "computed__regional_district_bonus", "computed"),
    (33, "computed__base_formula_aid", "computed"),
    (34, "computed__fully_funded_grant", "computed"),
    (36, "input__ecs_actual_fy2017", "input"),
    (37, "input__prior_year_entitlement", "input"),  # FY19 entitlement
    (
        41,
        "computed__ecs_entitlement_with_alliance_hh",
        "computed",
    ),  # col 41 = final entitlement FY2020
    (
        41,
        "computed__ecs_entitlement_without_alliance_hh",
        "computed",
    ),
]

COL_MAP_FY2021 = [
    (0, "input__drg", "input"),
    (1, "input__psd_flag", "input"),
    (2, "input__alliance_district_flag", "input"),
    (3, "input__alliance_non_reform_flag", "input"),
    (4, "input__reform_district_flag", "input"),
    (5, "input__wealth_decile", "input"),
    (6, "input__pic_decile", "input"),
    (7, "town_code", "input"),
    (8, "town_name", "input"),
    (10, "input__resident_students", "input"),
    (13, "input__frpl_students", "input"),
    (18, "input__ell_students", "input"),
    (19, "computed__ell_need_students_portion", "computed"),
    (20, "computed__total_need_students", "computed"),
    (21, "input__engl_3yr_avg", "input"),
    (22, "input__total_population", "input"),
    (23, "computed__engl_per_capita", "computed"),
    (24, "computed__engl_adjustment_factor", "computed"),
    (25, "input__median_household_income", "input"),
    (26, "computed__mhi_adjustment_factor", "computed"),
    (27, "computed__wealth_adjustment_factor", "computed"),
    (28, "computed__base_aid_ratio", "computed"),
    (30, "computed__final_base_aid_ratio", "computed"),
    (31, "input__students_sent_to_regional_district", "input"),
    (32, "input__n_regional_district_grades", "input"),
    (33, "computed__regional_district_bonus", "computed"),
    (35, "computed__base_formula_aid", "computed"),
    (36, "computed__fully_funded_grant", "computed"),
    (37, "input__ecs_actual_fy2017", "input"),
    (38, "computed__grant_adjustment", "computed"),
    (39, "computed__fully_funded_gt_prior_year", "computed"),
    (40, "input__prior_year_entitlement", "input"),
    (41, "computed__phase_in_amount", "computed"),
    (42, "computed__ecs_entitlement_without_alliance_hh", "computed"),
    (43, "computed__ecs_entitlement_with_alliance_hh", "computed"),
]

COL_MAP_FY2022 = [
    (0, "input__drg", "input"),
    (1, "input__psd_flag", "input"),
    (2, "input__alliance_district_flag", "input"),
    (3, "input__alliance_non_reform_flag", "input"),
    (4, "input__reform_district_flag", "input"),
    (5, "input__wealth_decile", "input"),
    (6, "input__pic_decile", "input"),
    (7, "town_code", "input"),
    (8, "town_name", "input"),
    (10, "input__resident_students", "input"),
    (12, "input__frpl_students", "input"),
    (13, "computed__frpl_poverty_portion", "computed"),
    (14, "computed__net_resident_students_60pct", "computed"),
    (15, "computed__excess_resident_students", "computed"),
    (16, "computed__excess_resident_students_portion", "computed"),
    (19, "computed__concentrated_poverty_students", "computed"),
    (20, "computed__concentrated_poverty_portion", "computed"),
    (21, "input__ell_students", "input"),
    (22, "computed__ell_need_students_portion", "computed"),
    (23, "computed__frpl_weight", "computed"),
    (24, "computed__total_need_students", "computed"),
    (25, "input__engl_3yr_avg", "input"),
    (26, "input__total_population", "input"),
    (27, "computed__engl_per_capita", "computed"),
    (28, "computed__engl_adjustment_factor", "computed"),
    (29, "input__median_household_income", "input"),
    (30, "computed__mhi_adjustment_factor", "computed"),
    (31, "computed__wealth_adjustment_factor", "computed"),
    (32, "computed__base_aid_ratio", "computed"),
    (33, "computed__pic_add_base_aid_ratio_adjustment", "computed"),
    (34, "computed__final_base_aid_ratio", "computed"),
    (35, "input__students_sent_to_regional_district", "input"),
    (36, "input__n_regional_district_grades", "input"),
    (37, "computed__regional_district_bonus", "computed"),
    (38, "input__students_sent_to_endowed_academies", "input"),
    (39, "input__n_endowed_academy_grades", "input"),
    (40, "computed__endowed_academy_bonus", "computed"),
    (41, "computed__base_formula_aid", "computed"),
    (42, "computed__fully_funded_grant", "computed"),
    (43, "input__ecs_actual_fy2017", "input"),
    (44, "computed__grant_adjustment", "computed"),
    (45, "computed__fully_funded_gt_prior_year", "computed"),
    (46, "input__prior_year_entitlement", "input"),
    (47, "computed__phase_in_amount", "computed"),
    (48, "computed__ecs_entitlement_without_alliance_hh", "computed"),
    (49, "computed__ecs_entitlement_with_alliance_hh", "computed"),
]

COL_MAP_FY2023 = [
    (0, "input__psd_flag", "input"),
    (1, "input__alliance_district_flag", "input"),
    (2, "input__alliance_non_reform_flag", "input"),
    (3, "input__pic_decile", "input"),
    (4, "town_code", "input"),
    (5, "town_name", "input"),
    (7, "input__resident_students", "input"),
    (9, "input__frpl_students", "input"),
    (10, "computed__frpl_poverty_portion", "computed"),
    (11, "computed__net_resident_students_60pct", "computed"),
    (12, "computed__excess_resident_students", "computed"),
    (13, "computed__excess_resident_students_portion", "computed"),
    (16, "computed__concentrated_poverty_students", "computed"),
    (17, "computed__concentrated_poverty_portion", "computed"),
    (18, "input__ell_students", "input"),
    (19, "computed__ell_need_students_portion", "computed"),
    (20, "computed__frpl_weight", "computed"),
    (21, "computed__total_need_students", "computed"),
    (22, "input__engl_3yr_avg", "input"),
    (23, "input__total_population", "input"),
    (24, "computed__engl_per_capita", "computed"),
    (25, "computed__engl_adjustment_factor", "computed"),
    (26, "input__median_household_income", "input"),
    (27, "computed__mhi_adjustment_factor", "computed"),
    (28, "computed__wealth_adjustment_factor", "computed"),
    (29, "computed__base_aid_ratio", "computed"),
    (30, "computed__pic_add_base_aid_ratio_adjustment", "computed"),
    (31, "computed__final_base_aid_ratio", "computed"),
    (32, "input__students_sent_to_regional_district", "input"),
    (33, "input__n_regional_district_grades", "input"),
    (34, "computed__regional_district_bonus", "computed"),
    (35, "input__students_sent_to_endowed_academies", "input"),
    (36, "input__n_endowed_academy_grades", "input"),
    (37, "computed__endowed_academy_bonus", "computed"),
    (38, "computed__base_formula_aid", "computed"),
    (39, "computed__fully_funded_grant", "computed"),
    (40, "input__prior_year_entitlement", "input"),
    (41, "computed__grant_adjustment", "computed"),
    (42, "computed__fully_funded_gt_prior_year", "computed"),
    (43, "computed__phase_in_amount", "computed"),
    (44, "computed__ecs_entitlement_with_alliance_hh", "computed"),
    (44, "computed__ecs_entitlement_without_alliance_hh", "computed"),
]

COL_MAP_FY2024_PLUS = [
    (0, "input__drg", "input"),
    (1, "input__psd_flag", "input"),
    (2, "input__alliance_district_flag", "input"),
    (3, "input__alliance_non_reform_flag", "input"),
    (4, "input__reform_district_flag", "input"),
    (5, "input__wealth_decile", "input"),
    (6, "input__pic_decile", "input"),
    (7, "town_code", "input"),
    (8, "town_name", "input"),
    (10, "input__resident_students", "input"),
    (12, "input__frpl_students", "input"),
    (13, "computed__frpl_poverty_portion", "computed"),
    (14, "computed__net_resident_students_60pct", "computed"),
    (15, "computed__excess_resident_students", "computed"),
    (16, "computed__excess_resident_students_portion", "computed"),
    (17, "computed__frpl_pct", "computed"),
    (18, "computed__frpl_pct_above_60pct", "computed"),
    (19, "computed__concentrated_poverty_students", "computed"),
    (20, "computed__concentrated_poverty_portion", "computed"),
    (21, "input__ell_students", "input"),
    (22, "computed__ell_need_students_portion", "computed"),
    (23, "computed__frpl_weight", "computed"),
    (24, "computed__total_need_students", "computed"),
    (25, "input__engl_3yr_avg", "input"),
    (26, "input__total_population", "input"),
    (27, "computed__engl_per_capita", "computed"),
    (28, "computed__engl_adjustment_factor", "computed"),
    (29, "input__median_household_income", "input"),
    (30, "computed__mhi_adjustment_factor", "computed"),
    (31, "computed__wealth_adjustment_factor", "computed"),
    (32, "computed__base_aid_ratio", "computed"),
    (33, "computed__pic_add_base_aid_ratio_adjustment", "computed"),
    (34, "computed__final_base_aid_ratio", "computed"),
    (35, "input__students_sent_to_regional_district", "input"),
    (36, "input__n_regional_district_grades", "input"),
    (37, "computed__regional_district_bonus", "computed"),
    (38, "input__students_sent_to_endowed_academies", "input"),
    (39, "input__n_endowed_academy_grades", "input"),
    (40, "computed__endowed_academy_bonus", "computed"),
    (41, "computed__base_formula_aid", "computed"),
    (42, "computed__fully_funded_grant", "computed"),
    (43, "input__ecs_actual_fy2017", "input"),
    (44, "computed__fully_funded_grant_with_alliance_hh", "computed"),
    (45, "input__prior_year_entitlement", "input"),
    (46, "computed__grant_adjustment", "computed"),
    (47, "computed__fully_funded_gt_prior_year", "computed"),
    (48, "computed__phase_in_amount", "computed"),
    (49, "computed__ecs_entitlement_without_alliance_hh", "computed"),
    (50, "computed__ecs_entitlement_with_alliance_hh", "computed"),
    (51, "computed__change_from_prior_year", "computed"),
]

ERA_MAP = {
    2018: (PARAMS_FY2018, COL_MAP_FY2018, 27, "xls"),
    2019: (PARAMS_FY2019, COL_MAP_FY2019, 27, "xlsx"),
    2020: (PARAMS_FY2020, COL_MAP_FY2020, 27, "xlsx"),
    2021: (PARAMS_FY2021, COL_MAP_FY2021, 27, "xlsx"),
    2022: (PARAMS_FY2022, COL_MAP_FY2022, 27, "xlsx"),
    2023: (PARAMS_FY2023, COL_MAP_FY2023, 27, "xlsx"),
    2024: (PARAMS_FY2024_PLUS, COL_MAP_FY2024_PLUS, 27, "xlsx"),
    2025: (PARAMS_FY2024_PLUS, COL_MAP_FY2024_PLUS, 27, "xlsx"),
    2026: (PARAMS_FY2024_PLUS, COL_MAP_FY2024_PLUS, 27, "xlsx"),
    2027: (PARAMS_FY2024_PLUS, COL_MAP_FY2024_PLUS, 27, "xlsx"),
}

# ── Extraction helpers ────────────────────────────────────────────────────────


def get_row_xls(ws, row_idx):
    return [ws.cell_value(row_idx, c) for c in range(ws.ncols)]


def extract_params_xls(ws, param_spec):
    params = {}
    for row_1idx, col_idx, name in param_spec:
        val = ws.cell_value(row_1idx - 1, col_idx)
        params[name] = val if val != "" else None
    return params


def extract_params_xlsx(ws, param_spec):
    params = {}
    for row_1idx, col_idx, name in param_spec:
        for row in ws.iter_rows(min_row=row_1idx, max_row=row_1idx, values_only=True):
            val = row[col_idx] if len(row) > col_idx else None
            params[name] = val
    return params


def extract_data_xls(ws, col_map, data_start_row, fiscal_year, params):
    rows = []
    for r in range(data_start_row - 1, ws.nrows):
        raw = get_row_xls(ws, r)
        # Find town name — col 7 for FY2018
        town = raw[7] if len(raw) > 7 else None
        if (
            not isinstance(town, str)
            or not town.strip()
            or town.strip() in ("Totals", "Total")
        ):
            continue
        rec = {"fiscal_year": fiscal_year}
        rec.update(params)
        for col_idx, col_name, _ in col_map:
            val = raw[col_idx] if col_idx < len(raw) else None
            rec[col_name] = None if val == "" else val
        rows.append(rec)
    return rows


def extract_data_xlsx(ws, col_map, data_start_row, fiscal_year, params):
    # Find town name column from col_map
    town_col = next(ci for ci, cn, _ in col_map if cn == "town_name")
    rows = []
    for row in ws.iter_rows(min_row=data_start_row, max_row=220, values_only=True):
        town = row[town_col] if len(row) > town_col else None
        if not isinstance(town, str) or not town.strip():
            continue
        rec = {"fiscal_year": fiscal_year}
        rec.update(params)
        for col_idx, col_name, _ in col_map:
            val = row[col_idx] if len(row) > col_idx else None
            if isinstance(val, str) and val.startswith("="):
                val = None
            rec[col_name] = val
        rows.append(rec)
    return rows


# ── Main extraction ───────────────────────────────────────────────────────────

all_rows = []

for fy, (path, sheet, fmt) in SHELLS.items():
    param_spec, col_map, data_start, _ = ERA_MAP[fy]
    print(f"  FY{fy}: {path.split('/')[-1]}")

    if fmt == "xls":
        wb = xlrd.open_workbook(path)
        ws = wb.sheet_by_name(sheet)
        params = extract_params_xls(ws, param_spec)
        rows = extract_data_xls(ws, col_map, data_start, fy, params)
    else:
        wb = load_workbook(path, data_only=True)
        ws = wb[sheet]
        params = extract_params_xlsx(ws, param_spec)
        rows = extract_data_xlsx(ws, col_map, data_start, fy, params)
        wb.close()

    # Zero-fill binary flag columns (blank = 0 in Excel formula context)
    flag_cols = [
        "input__psd_flag",
        "input__alliance_district_flag",
        "input__alliance_non_reform_flag",
        "input__reform_district_flag",
    ]
    for rec in rows:
        for fc in flag_cols:
            if fc in rec and rec[fc] is None:
                rec[fc] = 0

    all_rows.extend(rows)
    print(f"    {len(rows)} towns")

# ── Build DataFrame ───────────────────────────────────────────────────────────

df = pd.DataFrame(all_rows)

# Canonical column order
id_cols = ["fiscal_year", "town_name", "town_code"]
all_param = sorted({c for r in df.columns for c in [r] if c.startswith("param_")})
all_input = sorted({c for c in df.columns if c.startswith("input__")})
all_computed = [
    # In dependency order (same as FY2024+ col sequence where present)
    "computed__frpl_poverty_portion",
    "computed__net_resident_students_60pct",
    "computed__excess_resident_students",
    "computed__excess_resident_students_portion",
    "computed__frpl_pct",
    "computed__frpl_pct_above_60pct",
    "computed__concentrated_poverty_students",
    "computed__concentrated_poverty_portion",
    "computed__ell_need_students_portion",
    "computed__frpl_weight",
    "computed__total_need_students",
    "computed__engl_per_capita",
    "computed__engl_adjustment_factor",
    "computed__mhi_adjustment_factor",
    "computed__wealth_adjustment_factor",
    "computed__base_aid_ratio",
    "computed__pic_add_base_aid_ratio_adjustment",
    "computed__final_base_aid_ratio",
    "computed__regional_district_bonus",
    "computed__endowed_academy_bonus",
    "computed__base_formula_aid",
    "computed__fully_funded_grant",
    "computed__fully_funded_grant_with_alliance_hh",
    "computed__grant_adjustment",
    "computed__fully_funded_gt_prior_year",
    "computed__phase_in_amount",
    "computed__ecs_entitlement_without_alliance_hh",
    "computed__ecs_entitlement_with_alliance_hh",
    "computed__change_from_prior_year",
]
# Keep only cols that actually exist
all_computed = [c for c in all_computed if c in df.columns]

col_order = id_cols + all_param + all_input + all_computed
col_order = [c for c in col_order if c in df.columns]
df = df[col_order].sort_values(["fiscal_year", "town_name"]).reset_index(drop=True)

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\nFinal shape: {df.shape}")
print(f"  Rows: {len(df)}")
print(f"  Columns: {len(df.columns)}")
print(f"\nRows per fiscal year:")
for fy, grp in df.groupby("fiscal_year"):
    print(f"  FY{fy}: {len(grp)} towns")

print(f"\nColumn groups:")
print(f"  Identifiers : {len(id_cols)}")
print(f"  param_*     : {len([c for c in df.columns if c.startswith('param_')])}")
print(f"  input__*    : {len([c for c in df.columns if c.startswith('input__')])}")
print(f"  computed__* : {len([c for c in df.columns if c.startswith('computed__')])}")

# ── Spot checks ───────────────────────────────────────────────────────────────

print("\n=== Spot checks ===")
for fy in [2018, 2019, 2021, 2023, 2024]:
    row = df[(df["fiscal_year"] == fy) & (df["town_name"] == "Andover")]
    if len(row):
        r = row.iloc[0]
        ent = r.get("computed__ecs_entitlement_with_alliance_hh", "N/A")
        res = r.get("input__resident_students", "N/A")
        print(f"  FY{fy} Andover: resident_students={res}, entitlement={ent}")

df.to_csv(OUT, index=False)
print(f"\nSaved → {OUT}")
