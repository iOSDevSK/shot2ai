# Third-party notices

Shot2AI includes, or is derived in part from, the following third-party work.

## better-shot

- Source: https://github.com/iOSDevSK/better-shot
- Licence: BSD 3-Clause
- Used for: the screenshot editor. Its tools (arrow, rectangle, text, highlight, blur), colour swatches, stroke sizes and arrow geometry were adapted from better-shot's SwiftUI code to a web canvas (`src/editor.js`).

```
BSD 3-Clause License

Copyright (c) 2026, Kartik Labhshetwar

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Nothing else

- No other third-party code, libraries or assets are bundled. Shot2AI uses no framework and has no runtime dependencies.
- The icons in `src/icons.js` and `src/toolbar.js`, and the extension icons in `icons/`, were drawn for Shot2AI (`scripts/icons.py`).
- Text uses the system's own fonts (`ui-sans-serif`, `ui-monospace`); no fonts are bundled.
- No code or text was taken from any other browser extension.
- The development tooling (`@playwright/test`, Apache-2.0) is used only to run the tests and is not part of the extension.

## Trademarks

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI or Anthropic. These names are used only to identify the web chats a user can choose to send screenshots to.
