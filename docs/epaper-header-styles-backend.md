# ePaper Header Styles — Backend Reference

Source: `src/lib/epaper/headerStyleCatalog.ts`  
DB table: `EpaperHeaderStyle`  
Seed: `npx ts-node scripts/seed_epaper_header_styles.ts`

## API

- `GET /api/v1/epaper/smart-design/header-styles`
- `GET /api/v1/admin/epaper/header-styles` (SUPER_ADMIN)

## Smart Design fields (stored on `EpaperSmartDesign`)

See `docs/epaper-smart-design-react.md` for full CRUD.

Key style fields:

- `headerStyleNumber`, `subHeaderStyleNumber` (1–10)
- `headerStyleKey`, `subHeaderStyleKey` (canonical keys)

## Main headers

| # | Key | Slug |
|---|-----|------|
| 1 | main_style1 | classic_3_col_info_bar |
| 2 | main_style2 | prabha_3_col_meta_strip |
| 3 | main_style3 | minimal_white_left_align |
| 4 | main_style4 | red_crimson_banner |
| 5 | main_style5 | split_name_ad_panel |
| 6 | main_style6 | traditional_telugu_ornament |
| 7 | main_style7 | black_gold_premium |
| 8 | main_style8 | blue_gradient |
| 9 | main_style9 | heavy_rules_gothic |
| 10 | main_style10 | modern_color_stripe |

## Sub headers

| # | Key | Slug |
|---|-----|------|
| 1 | sub_header_style1 | page_logo_date |
| 2 | sub_header_style2 | full_color_bar |
| 3 | sub_header_style3 | slim_rule_line |
| 4 | sub_header_style4 | edition_name_strip |
| 5 | sub_header_style5 | gradient_band |
| 6 | sub_header_style6 | dual_logo_bar |
| 7 | sub_header_style7 | minimal_grey |
| 8 | sub_header_style8 | district_highlight |
| 9 | sub_header_style9 | ornament_border |
| 10 | sub_header_style10 | traditional_telugu |
