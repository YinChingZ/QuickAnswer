# QuickAnswer – AI-Powered Webpage Solver

A Chrome extension that extracts content from any webpage and uses OpenAI to solve problems, answer questions, and provide explanations — all in one click.

---

## Features

- **One-Click AI Solving** – Extract the current page's content and send it to OpenAI with a single button press.
- **Smart Content Extraction** – Automatically identifies and extracts the main content while filtering out navigation bars, ads, footers, and other noise.
- **Visible-Only Filtering** – Dynamically skips hidden elements (SPA route history, hidden tabs, etc.) so only what the user sees is captured.
- **Iframe Support** – Extracts and includes content from embedded iframes when accessible.
- **HTML → Markdown Conversion** – Converts extracted HTML to clean Markdown before sending it to the AI for better results.
- **Streaming Responses** – Displays AI answers in real time as they are generated (configurable).
- **Copy to Clipboard** – One-click copy of the AI response.
- **Download as Markdown** – Save any AI response as a timestamped `.md` file.
- **Debug Mode** – Inspect the raw extracted HTML for troubleshooting.
- **Dark / Light Theme** – Toggle between themes; respects your OS preference by default.
- **Persistent Settings** – API key, base URL, model, and streaming preference are saved in browser storage.

---

## Installation

> **Requirements:** Chrome 88+ (or any Chromium-based browser with Manifest V3 support) and an [OpenAI API key](https://platform.openai.com/api-keys).

1. **Download** or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the extension source folder (e.g. `1.0.2_0`).
5. The QuickAnswer icon will appear in your Chrome toolbar.

---

## Usage

1. Navigate to any webpage containing a problem or question you want answered.
2. Click the **QuickAnswer** icon in the toolbar to open the popup.
3. (First time) Click the ⚙️ **Settings** icon and enter your OpenAI API key. Optionally configure the base URL, model, and streaming preference, then save.
4. Click **Solve with AI**.
5. The extension extracts the page content, converts it to Markdown, and streams the AI's response directly into the popup.
6. Use **Copy** to copy the response or **Download** to save it as a `.md` file.

---

## Configuration

All settings are accessed via the ⚙️ icon inside the popup and are stored locally in your browser.

| Setting | Default | Description |
|---------|---------|-------------|
| API Key | *(required)* | Your OpenAI API key |
| Base URL | `https://api.openai.com/v1` | API endpoint — supports Azure OpenAI, local proxies, and compatible providers |
| Model | `gpt-4o` | Any OpenAI chat model (e.g. `gpt-4`, `gpt-3.5-turbo`) |
| Stream | `true` | Enable real-time streaming of responses |

---

## How It Works

1. When you click **Solve with AI**, the extension injects a content-extraction script into the active tab using the [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/).
2. The script identifies the main content area, strips non-content elements (scripts, styles, ads, hidden nodes), and collects any accessible iframe content.
3. The raw HTML is converted to Markdown using [Turndown.js](https://github.com/mixmark-io/turndown).
4. The Markdown is sent to the configured OpenAI endpoint along with a system prompt asking the model to solve or answer the content.
5. The response is streamed back and rendered in the popup in real time.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Platform | Chrome Extensions (Manifest V3) |
| UI | HTML5, CSS3 (CSS variables for theming), Vanilla JavaScript (ES6+) |
| AI Backend | [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat) |
| HTML → MD | [Turndown.js](https://github.com/mixmark-io/turndown) |
| Storage | Chrome `storage` API |

---

## Permissions

| Permission | Reason |
|-----------|--------|
| `activeTab` | Read the content of the current webpage |
| `scripting` | Inject the content-extraction script into the page |
| `storage` | Save user settings and the last AI response |
| `host_permissions` (`https://*/*`) | Allow the extension to run on all HTTPS websites |

The extension **cannot** run on `chrome://`, `chrome-extension://`, `edge://`, `about:*`, or the Chrome Web Store.

---

## Browser Support

- **Chrome** (Manifest V3, v88+)
- **Microsoft Edge**, **Brave**, and other Chromium-based browsers

---

## License

This project is open source and available under the [MIT License](LICENSE).