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

## 3. Reference Images / Ingredients Workflow (1–5 Reference Images)

Verified live on 2026-11-06 by attaching reference images and generating combined outputs (`RPC ogiZ0b`).

### A. Attaching 1–5 Reference Images in Browser UI
1. **Clear Previous Ingredients & Failed Tiles (if any)**:
   - Check if `button[aria-label="Xoá câu lệnh"]` exists in `flow-base-prompt-box`; click it to reset the prompt text and clear all attached reference chips.
   - If any failed generation cards (`flow-error-tile`) exist in the grid, click `flow-error-tile button:nth-of-type(3)` (`label="Xoá"`, triggers `RPC cz8Z4b`) to remove them.
2. **Open Add-Ingredient Menu (`flow-add-menu`)**:
   - Click `button[aria-label="Thêm thành phần vào ô nhập câu lệnh"]` (`flow-add-menu button`).
   - Overlay `flow-add-menu-popover-content` opens with:
     - Upload button: `flow-add-menu-side-nav button` (`uploadTải nội dung nghe nhìn lên`).
     - Search input: `input[aria-label="Tìm kiếm thành phần"]`.
     - Project asset list: `flow-add-menu-asset-list cdk-virtual-scroll-viewport button` (each button's `label` is `<Asset Title>Hình ảnh`). Renaming assets beforehand (`flow:rename-asset`) makes selecting specific reference images by title deterministic.
3. **Select 1 to 5 Reference Images (Max 5)**:
   - Clicking an asset button in `flow-add-menu-asset-list` **immediately attaches** that image as a chip inside `flow-ingredient-bar` (`flow-ingredient-chip > flow-image-ingredient-chip > button`, `label="Thành phần"`) and closes the popover.
   - Already-attached images are automatically filtered out of `flow-add-menu-asset-list` on subsequent openings.
   - Repeat up to **5 times** (maximum 5 reference images per prompt). Verify attached count via `studio_extract({ selector: "flow-ingredient-chip" })` (`length` 1..5).
   - To remove a single reference image, click its `flow-image-ingredient-chip button` (`cancel`); to remove all, click `button[aria-label="Xoá câu lệnh"]`.

### B. How `ogiZ0b` Encodes 1–5 Reference Images in Request Payload
In `POST /_/AiSandboxAngularFrontend/data/batchexecute?rpcids=ogiZ0b`, for each generation item `item = args[1][i]`:
- `item[2]` holds the **reference images array** (`null` when no reference images are used, or 1–5 tuples):
  ```json
  [
    ["<assetUuid_1>", null, null, null, 1],
    ["<assetUuid_2>", null, null, null, 1],
    ["<assetUuid_3>", null, null, null, 1]
  ]
  ```
  where `1` denotes an image ingredient.
- `item[3]` = random 32-bit seed.
- `item[4]` = aspect ratio code (`5` = `4:3`, `2` = `16:9`, `1` = `9:16`, `3` = `1:1`).
- `item[5]` = model code (`"HARBOR_SEAL"`, `"GEM_PIX_2"`, `"BELUGA"`).
- `item[7][5]` = `projectId`, `item[7][10][0]` = browser-minted reCAPTCHA Enterprise token.
- `item[8][0][0][0]` = prompt text string.

### C. Prompt Construction Rules for Combining 1–5 Reference Images
When 1–5 reference chips are attached in `flow-ingredient-bar`, the prompt is plain text in `flow-rich-text-editor` (no raw UUIDs needed in text; the model receives the visual embeddings of `item[2]` alongside `item[8][0][0][0]`):
- **1 Reference Image (Character / Style / Subject consistency)**:
  - Explicitly state what to preserve from the reference image and what new action/setting to apply.
  - *Template*: `"Giữ nguyên [nhân vật/đối tượng/phong cách] từ ảnh tham chiếu, đặt trong bối cảnh [mô tả cảnh mới, hành động, ánh sáng, góc máy]."`
- **2 Reference Images (Subject + Prop/Outfit OR Subject + Environment/Style)**:
  - Assign a clear role to each reference image by its visual subject (e.g., character from the cat image + accessory/background from the second image) and describe their spatial interaction.
  - *Template*: `"Kết hợp 2 ảnh tham chiếu: giữ nguyên [nhân vật chính từ ảnh 1] và kết hợp với [đạo cụ/trang phục/bối cảnh từ ảnh 2], sao cho [mô tả tương tác cụ thể và phong cách thống nhất]."`
- **3–5 Reference Images (Character + Multiple Props/Accessories + Environment/Style)**:
  - Clearly specify the role of each visual element (Subject + Object/Prop 1..N + Lighting/Environment/Style) so the model fuses them coherently without ambiguity.
  - *Verified Example*: `"Từ các ảnh tham chiếu đã chọn: giữ nguyên chú mèo máy đang đọc sách bên cửa sổ, cho chú mèo đội chiếc mũ phù thủy màu xanh ngọc phát sáng và đặt quả cầu pha lê lên mặt bàn gỗ cạnh cuốn sách, phong cách hoạt hình 3D chi tiết"` (verified live -> generated image `4cc750da-e29c-438a-86f5-eaa1d7d99b71`).

## 4. Asset Management: Renaming, Trashing & Downloading (`1K`, `2K`, `4K`)

Verified live in browser and via standalone `api-client.mjs` on 2026-11-06:

### A. Asset Detail / Editor Page (`/project/<projectId>/edit/<workflowId>`)
- Clicking an image tile (`flow-grid-tile-container flow-image-tile img`) opens `flow-editor-page`.
- **Header Controls (`flow-editor-header`)**:
  - Editable asset title: `flow-editor-header flow-editable-text input` (pressing `Enter` fires `RPC mYWVGd`).
  - Favorite toggle: `button[aria-label="Yêu thích"]` (`RPC mYWVGd` with `[["metadata.favorited"]]`).
  - Download menu trigger: `button[aria-label="Tải nội dung nghe nhìn xuống"]` (`downloadTải xuống`).
  - Reuse prompt button: `button[aria-label="Sử dụng lại câu lệnh"]`.
  - More actions menu (`more_vert`): contains `"Xoá"` (`RPC mYWVGd` with `[["metadata.archived"]]`).
  - Done / Return to grid: `button[aria-label="Đã chỉnh sửa xong"]` (`Xong`).

### B. Renaming & Trashing Assets via API (`mYWVGd` + `as29s`)
- **Get Asset Metadata (`RPC as29s`)**:
  - Request args: `["<assetId>"]`.
  - Decoded response `data`: `data[0]` = `assetId`, `data[1]` = `projectId`, `data[2]` = `workflowId`, `data[6][2]` = `[width, height]`, `data[5][10]` = signed `1K` download URL.
- **Update Workflow Metadata (`RPC mYWVGd`)**:
  - Rename args: `[[workflowId, null, null, [newName], projectId], [["metadata.display_name"]]]`.
  - Trash/archive args: `[[workflowId, null, null, [null, null, 1], projectId], [["metadata.archived"]]]`.
  - Decoded response `data`: `data[0]` = `workflowId`, `data[3][0]` = updated `displayName`, `data[3][4]` = `assetId`.

### C. Downloading Images at `1K`, `2K`, and `4K`
- **`1K` (Original Size — No CAPTCHA)**:
  - **API**: `node .agents/skills/flow-project/references/api-client.mjs download-asset --id <assetId> --out <path>` fetches a fresh signed `https://flow-content.google/image/<assetId>?...` URL via `as29s` and downloads the original image directly.
  - **Browser**: In `flow-editor-header`, click `button[aria-label="Tải nội dung nghe nhìn xuống"]` -> click `flow-menu-item:nth-of-type(1) > button` (`1K Kích thước gốc`).
- **`2K` and `4K` (Server-Side Upsampling — Requires Browser reCAPTCHA Enterprise)**:
  - **Browser**: In the download menu, click `flow-menu-item:nth-of-type(2) > button` (`2K Đã tăng độ phân giải` -> model `GEM_PIX_2_UPSAMPLE_2K`, enum `26`) or `flow-menu-item:nth-of-type(3) > button` (`4K Đã tăng độ phân giải` -> model `GEM_PIX_2_UPSAMPLE_4K`, enum `27`). Flow displays `"Đang tăng độ phân giải cho hình ảnh của bạn, quá trình tải xuống sẽ tự động bắt đầu."` and automatically downloads the upsampled file when finished.

## 5. UI Interaction Rules for Dynamic Controls
- Angular Material dynamically reassigns `#mat-button-toggle-*` and `#mat-mdc-checkbox-*` numeric IDs whenever the settings or filter popover opens or switches mode. Always call `studio_inspect` after opening a popover or switching tabs and match controls by `label` rather than hardcoded toggle IDs.
- Before calling `studio_fill` on `flow-rich-text-editor`, always call `studio_click` on the editor selector first so focus and reCAPTCHA Enterprise behavioral signals are registered naturally.
