# Flow: Product Architecture & Dependent Configuration Matrix

Verified against official Google Flow documentation and live `HTrJv` / `yBhWQ` RPC catalog + DOM inspection on 2026-11-06.

## 1. Core Workspace & Navigation
- **Projects Grid (`/`)**: Lists existing projects (`a[href^="/project/"]`) and the create button (`button[aria-label="addDự án mới"]`).
- **Project Workspace (`/project/<id>`)**:
  - Header: Home button (`flow-navigation-header nav > button`), inline editable project title (`flow-editable-text input` -> fires `RPC o8DA4` on `Enter`), search bar (`flow-search-bar`), and filter popover (`Các lựa chọn lọc và sắp xếp`).
  - Sidenav: All media, Characters, Scenes, Library/Collections, Tools, Trash.
  - Prompt Box (`flow-prompt-box`): Rich text editor (`flow-rich-text-editor [contenteditable="true"]`), Reference/Ingredient add menu (`flow-add-menu`), Agent mode chip (`flow-agent-mode-toggle-chip`), Settings trigger (`button[aria-label="Điều kiện kích hoạt cài đặt"]`), and Submit button (`flow-generate-icon-button button`).

## 2. Dependent Configuration Matrix (from `HTrJv` RPC & UI)

When configuring generation in UI (`flow:configure-generation`) or inspecting payloads, options depend strictly on the selected mode and model family:

### A. Image Mode (`imageHình ảnh`)
- **Models (`HTrJv` Section 5)**:
  - `🍌 Nano Banana Pro` -> family `nano_banana_pro`, RPC code `GEM_PIX_2` (0 credits).
  - `🍌 Nano Banana 2 Lite` -> family `harbor_seal`, RPC code `HARBOR_SEAL` (0 credits).
  - `🍌 Nano Banana 2.1` -> family `beluga_display`, RPC code `BELUGA` (0 credits).
  - Upsamplers: `2K` (`GEM_PIX_2_UPSAMPLE_2K`), `4k` (`GEM_PIX_2_UPSAMPLE_4K`).
- **Dependent Options**:
  - Aspect Ratio toggles: `16:9`, `4:3`, `1:1`, `3:4`, `9:16`.
  - Output Count toggles: `x1`, `x2`, `x3`, `x4` (maps to number of generation entries in `ogiZ0b` `args[1]`).

### B. Video Mode (`videocamVideo`)
- **Input Sub-modes**: `Khung hình` (Frames: start/end frame interpolation `i2v` / `fl`) vs `Thành phần` (Ingredients / reference-to-video `r2v`).
- **Models & Dependent Options (`HTrJv` Section 4)**:
  1. `Omni 1.1 Flash` (family `abra`):
     - Aspect Ratios: `16:9` (code `2`), `9:16` (code `1`).
     - Resolutions: `360p` (`*_360p` variants, 4–7 credits) and `720p` (default variants, 7–15 credits).
     - Durations: `4s`, `6s`, `8s`, `10s` (e.g., `abra_t2v_4s`, `abra_t2v_6s`, `abra_t2v_8s`, `abra_t2v_10s`).
     - Output Count: `x1`, `x2`, `x3`, `x4`.
  2. `Veo 3.1 - Lite` (family `veo_3_1_lite`) & `Veo 3.1 - Lite [Lower Priority]` (`veo_3_1_lite_low_priority`):
     - Aspect Ratios: `16:9` (`2`), `9:16` (`1`).
     - Durations: `4s`, `6s`, `8s` (`veo_3_1_t2v_lite_4s`, `veo_3_1_t2v_lite_6s`, `veo_3_1_t2v_lite`, 10 credits for 8s).
  3. `Veo 3.1 - Fast` (family `veo_3_1_fast`):
     - Aspect Ratios: `16:9` (landscape variants) and `9:16` (`*_portrait` variants).
     - Durations: `4s`, `6s`, `8s` (20 credits for 8s standard).
  4. `Veo 3.1 - Quality` (family `veo_3_1_quality`):
     - Aspect Ratios: `16:9` and `9:16` (`*_portrait`).
     - Durations: `4s`, `6s`, `8s` (100 credits for 8s standard).

## 3. UI Interaction Rules for Dynamic Controls
- Angular Material dynamically reassigns `#mat-button-toggle-*` and `#mat-mdc-checkbox-*` numeric IDs whenever the settings or filter popover opens or switches mode. Always call `studio_inspect` after opening a popover or switching tabs and match controls by `label` rather than hardcoded toggle IDs.
