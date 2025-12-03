# AI Chat Studio

一個功能完整的 OpenAI Chatbot PWA 應用程式，支援自訂 API Key、Prompt 管理、串流輸出等功能。

## 功能特色

- **自訂 API Key**: 使用您自己的 OpenAI API Key，資料僅儲存於本地瀏覽器
- **多模型支援**: 支援 GPT-4o、GPT-4 Turbo、GPT-3.5、o1 系列等多種模型
- **串流輸出**: 即時顯示 AI 回應，無需等待完整回應
- **參數調整**: 自訂 Temperature、Top P、Max Tokens 等參數
- **常用 Prompt 管理**: 儲存並快速使用常用的 Prompt
- **系統提示**: 設定系統提示來定義 AI 的角色和行為
- **對話歷史**: 自動儲存對話記錄，支援多對話管理
- **PWA 支援**: 可安裝至桌面或手機，支援離線存取
- **響應式設計**: 完美適配桌面和行動裝置

## 快速開始

### 方法一：直接開啟

雙擊 `index.html` 檔案在瀏覽器中開啟即可使用。

> 注意：部分功能（如 Service Worker）需要透過 HTTP 伺服器才能正常運作。

### 方法二：使用本地伺服器

使用 Python:
```bash
python -m http.server 8080
```

使用 Node.js:
```bash
npx serve .
```

使用 VS Code Live Server 擴充套件直接啟動。

然後在瀏覽器中開啟 `http://localhost:8080`

## 使用說明

### 1. 設定 API Key

首次使用時，點擊左下角的「設定」按鈕，輸入您的 OpenAI API Key。

您可以在 [OpenAI Platform](https://platform.openai.com/api-keys) 取得 API Key。

### 2. 開始對話

在輸入框中輸入訊息，按 Enter 或點擊發送按鈕即可開始對話。

快捷鍵：
- `Enter`: 發送訊息
- `Shift + Enter`: 換行
- `Ctrl/Cmd + N`: 新對話
- `Esc`: 關閉彈窗

### 3. 調整參數

點擊頂部的滑桿圖示可以調整 AI 回應參數：

#### 通用參數

| 參數 | 說明 | 建議值 |
|------|------|--------|
| Temperature | 控制回應的隨機性，越高越有創意 | 0.7 (GPT-5.1 建議 0.3-0.7) |
| Top P | 核取樣機率閾值 | 1 |
| Max Tokens | 最大輸出長度 | 4096 (GPT-5.1 Pro 支援最高 128K) |
| Presence Penalty | 降低重複已出現主題的機率 | 0 |
| Frequency Penalty | 根據出現頻率降低重複的機率 | 0 |

#### GPT-5.1 專屬參數

| 參數 | 說明 | 選項 |
|------|------|------|
| Reasoning Effort | 控制推理深度，越高思考越深入 | none, low, medium, high |
| Verbosity | 控制輸出詳細程度 | low, medium, high |
| Tone (語氣風格) | 選擇 AI 回應的語氣風格 | 8 種風格可選 |

**Reasoning Effort 選項**：
- **None** - 不進行額外推理，最快回應
- **Low** - 輕度推理
- **Medium** - 中度推理 (預設)
- **High** - 深度推理，最慢但最精確

**語氣風格選項**：
- 通用 (Default) - 標準回應風格
- 親切 (Friendly) - 溫暖友善的語氣
- 簡潔 (Efficient) - 精簡扼要的回應
- 熱情求知 (Nerdy) - 充滿好奇心的探索風格
- 冷嘲熱諷 (Cynical) - 帶有諷刺意味的回應
- 專業 (Professional) - 正式商務風格
- 直率 (Candid) - 坦誠直接的表達
- 創意 (Quirky) - 獨特有趣的風格

### 4. 管理常用 Prompt

1. 點擊側邊欄「常用 Prompt」旁的 + 按鈕
2. 輸入名稱和 Prompt 內容
3. 可選擇設為「系統提示」讓它影響 AI 的整體行為

### 5. 安裝為 PWA

在支援的瀏覽器中，可以將應用程式安裝到桌面或手機：

- **Chrome/Edge**: 點擊網址列右側的安裝圖示
- **Safari (iOS)**: 點擊分享按鈕 → 加入主畫面

## 自訂 API 端點

如果您使用的是自訂的 API 端點或代理服務，可以在設定中修改 API Base URL。

預設值：`https://api.openai.com/v1`

## 圖示設定

專案包含一個 SVG 圖示檔案 (`icons/icon.svg`)。如需生成 PNG 圖示，您可以：

1. 使用線上工具如 [CloudConvert](https://cloudconvert.com/svg-to-png) 轉換 SVG
2. 生成以下尺寸的 PNG 檔案並放入 `icons/` 資料夾：
   - icon-72.png (72x72)
   - icon-96.png (96x96)
   - icon-128.png (128x128)
   - icon-144.png (144x144)
   - icon-152.png (152x152)
   - icon-192.png (192x192)
   - icon-384.png (384x384)
   - icon-512.png (512x512)

## 技術架構

- 純 HTML/CSS/JavaScript，無需建構工具
- 使用 CSS 變數實現主題系統
- 使用 localStorage 進行本地資料儲存
- 使用 Fetch API 和 ReadableStream 處理串流回應
- 使用 Service Worker 實現 PWA 離線功能

## 瀏覽器支援

- Chrome 89+
- Firefox 89+
- Safari 15+
- Edge 89+

## 隱私說明

- 所有資料（API Key、對話記錄、設定）均儲存在您的瀏覽器本地 (localStorage)
- API 請求直接發送至 OpenAI（或您設定的端點），不經過任何第三方伺服器
- 清除瀏覽器資料會刪除所有儲存的內容

## 授權條款

MIT License

