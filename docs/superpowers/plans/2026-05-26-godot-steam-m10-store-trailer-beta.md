# M10 — 店面物料 + 宣传片 + Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 产出 Steam 商店所需全部物料：7 张 capsule 图（精确像素尺寸 + 安全区合规）、8-10 张 in-game 截图（1920×1080）、30-60 秒宣传片（含字幕 + 音乐）、并开放 Steam Playtest 邀请 5-10 个测试玩家收反馈。

**Architecture:** Capsule 走 HTML/SVG 模板 → 浏览器 / puppeteer 截图到精确像素。截图走 Godot 内置 `capture_screenshot.gd` 工具脚本，加载特定 puzzle 状态后从 viewport 抓帧。宣传片用 OBS Studio 录原始素材 + DaVinci Resolve 剪辑。Steam Playtest 通过 Steamworks portal 配置 + 发 key 给邀请名单。

**Tech Stack:** HTML5 + SVG + Inter/JetBrains Mono web font、Chromium headless (或浏览器手动 + Cmd+Shift+4)、Godot 4 `get_viewport().get_texture()`、OBS Studio (任意平台 native)、DaVinci Resolve free、Steamworks portal Playtest 功能。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Steam 店面物料清单 / § Milestones M10 / § Risk R7 (美术质量)

**Acceptance gates (从 spec 抄):**
- 7 张 capsule 全部按精确尺寸渲染到 PNG (462×174 / 616×353 / 460×215 / 600×900 / 3840×1240 / 1280×720 + Library Hero 安全区)
- 8-10 张 1920×1080 in-game 截图覆盖：clean state / mid-game / hint highlight / win state / settings panel / calendar selector / skin picker / tutorial
- 30-60 秒宣传片 mp4 1920×1080 H.264 在 `marketing/trailer/calendar-puzzle-trailer.mp4`
- Steam Playtest 开起来；5-10 个测试 key 发出
- `tests/test_capture_screenshots.gd` 校验脚本能产出 8 张 1920×1080 PNG

---

## File Structure

本 milestone 创建 / 修改的文件（全部在 `~/mygit/calendar-puzzle-godot/` 下）：

```
calendar-puzzle-godot/
├── marketing/
│   ├── capsules/                            # HTML/SVG 模板 + PNG 输出
│   │   ├── small_capsule.html               # 462×174
│   │   ├── main_capsule.html                # 616×353
│   │   ├── header_capsule.html              # 460×215
│   │   ├── library_capsule.html             # 600×900
│   │   ├── library_hero.html                # 3840×1240
│   │   ├── library_logo.html                # 1280×720
│   │   ├── community_icon.html              # 184×184
│   │   ├── shared/
│   │   │   ├── styles.css                   # 共享视觉
│   │   │   └── logo.svg                     # 主 logo 矢量
│   │   └── png/                             # 渲染输出
│   │       ├── small_capsule.png
│   │       ├── main_capsule.png
│   │       ├── ...
│   ├── screenshots/                         # in-game 截图
│   │   ├── 01_clean_state.png               # 1920×1080
│   │   ├── 02_mid_game.png
│   │   ├── 03_hint_highlight.png
│   │   ├── 04_win_state.png
│   │   ├── 05_settings.png
│   │   ├── 06_calendar.png
│   │   ├── 07_skin_picker.png
│   │   ├── 08_tutorial.png
│   │   └── (可选 09, 10)
│   ├── trailer/
│   │   ├── trailer_script.md                # 30-60s 镜头脚本
│   │   ├── raw_clips/                       # OBS 录制原片 (gitignored, 大文件)
│   │   ├── davinci_project/                 # DaVinci 工程 (gitignored)
│   │   └── calendar-puzzle-trailer.mp4      # 最终成片 (打入 git LFS 或单独存)
│   ├── beta_feedback_form.md                # 给 Playtest 玩家的反馈模板
│   └── PLAYTEST_INVITES.md                  # 邀请名单 + key 状态
├── tools/
│   ├── render_capsules.sh                   # 浏览器渲染 HTML 到 PNG
│   └── capture_screenshots.gd               # Godot 工具脚本
├── tests/
│   └── test_capture_screenshots.gd          # 校验截图工具产出
└── .gitignore                               # 新增 marketing/trailer/raw_clips/ 等
```

---

## Task 1 — 设计共享视觉模板 (logo + styles.css)

**Files:**
- Create: `marketing/capsules/shared/logo.svg`
- Create: `marketing/capsules/shared/styles.css`
- Create: `marketing/capsules/shared/Inter-Bold.ttf`（M9 已下载，复制到此）

- [ ] **Step 1: 设计主 logo SVG**

`marketing/capsules/shared/logo.svg`（简洁扁平：日历 + 拼图块意象）：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#EC4899"/>
    </linearGradient>
  </defs>
  <!-- 4 个小色块象征 puzzle -->
  <rect x="0" y="10" width="16" height="16" rx="3" fill="#EF4444"/>
  <rect x="18" y="10" width="16" height="16" rx="3" fill="#F97316"/>
  <rect x="0" y="28" width="16" height="16" rx="3" fill="#22C55E"/>
  <rect x="18" y="28" width="16" height="16" rx="3" fill="#3B82F6"/>
  <!-- 标题文字 -->
  <text x="44" y="32" font-family="Inter, sans-serif" font-weight="800"
        font-size="28" fill="url(#grad1)">Calendar</text>
  <text x="44" y="62" font-family="Inter, sans-serif" font-weight="800"
        font-size="28" fill="#1A1A1F">Puzzle</text>
</svg>
```

- [ ] **Step 2: 写共享 CSS**

`marketing/capsules/shared/styles.css`:

```css
@font-face {
    font-family: 'Inter';
    src: url('Inter-Bold.ttf');
    font-weight: 800;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: 'Inter', -apple-system, sans-serif;
}

.capsule {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #FAFAFA 0%, #F0F1F5 100%);
    position: relative;
    overflow: hidden;
}

.capsule.dark {
    background: linear-gradient(135deg, #0F0F12 0%, #1B1B20 100%);
    color: #F2F2F4;
}

.bg-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.06;
    background-image: repeating-linear-gradient(
        45deg,
        #4F46E5 0,
        #4F46E5 1px,
        transparent 1px,
        transparent 12px
    );
}

.title {
    font-weight: 800;
    background: linear-gradient(90deg, #4F46E5 0%, #EC4899 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.subtitle {
    color: #6B6B73;
    font-weight: 600;
}

.dark .subtitle {
    color: #9B9BA3;
}

.blocks {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 4px;
}

.block {
    border-radius: 4px;
}

.block.i { background: #EF4444; }
.block.l { background: #F97316; }
.block.j { background: #FACC15; }
.block.s { background: #84CC16; }
.block.z { background: #22C55E; }
.block.p { background: #14B8A6; }
.block.y { background: #06B6D4; }
.block.n { background: #3B82F6; }
.block.t { background: #8B5CF6; }
.block.u { background: #EC4899; }
```

- [ ] **Step 3: 复制字体**

```bash
cp games/calendar_puzzle/assets/fonts/Inter-Bold.ttf marketing/capsules/shared/Inter-Bold.ttf
```

- [ ] **Step 4: Commit**

```bash
git add marketing/capsules/shared/
git commit -m "feat(marketing): shared logo SVG + CSS template + Inter font"
```

---

## Task 2 — 写 7 个 capsule HTML 模板

**Files:**
- Create: `marketing/capsules/{small,main,header,library,library_hero,library_logo,community_icon}_capsule.html`

每个尺寸必须精确（capsule 在 Steam 上以原尺寸显示，缩放会糊）。

- [ ] **Step 1: small_capsule.html (462×174)**

`marketing/capsules/small_capsule.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 462px; height: 174px; }
    .capsule { padding: 16px 20px; display: flex; align-items: center; }
    .title { font-size: 28px; line-height: 1; }
    .subtitle { font-size: 12px; margin-top: 4px; }
    .blocks-mini { width: 64px; height: 64px; margin-right: 16px; }
    .blocks-mini .block { width: 12px; height: 12px; }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="bg-pattern"></div>
    <div class="blocks blocks-mini">
      <div class="block i"></div><div class="block l"></div><div class="block j"></div><div class="block s"></div><div class="block z"></div>
      <div class="block p"></div><div class="block y"></div><div class="block n"></div><div class="block t"></div><div class="block u"></div>
    </div>
    <div>
      <div class="title">Calendar Puzzle</div>
      <div class="subtitle">Cozy daily pentomino</div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: main_capsule.html (616×353)**

`marketing/capsules/main_capsule.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 616px; height: 353px; }
    .capsule { padding: 32px 40px; display: flex; align-items: center; justify-content: space-between; }
    .title { font-size: 56px; line-height: 1; }
    .subtitle { font-size: 18px; margin-top: 12px; }
    .blocks-large { width: 140px; height: 140px; }
    .blocks-large .block { width: 26px; height: 26px; }
    .tagline { font-size: 14px; color: #6B6B73; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="bg-pattern"></div>
    <div>
      <div class="title">Calendar<br>Puzzle</div>
      <div class="subtitle">Drop 10 pentominoes. Leave today.</div>
      <div class="tagline">5 difficulties · Daily puzzles · 3 skins · Steam Cloud</div>
    </div>
    <div class="blocks blocks-large">
      <div class="block i"></div><div class="block l"></div><div class="block j"></div><div class="block s"></div><div class="block z"></div>
      <div class="block p"></div><div class="block y"></div><div class="block n"></div><div class="block t"></div><div class="block u"></div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: header_capsule.html (460×215)**

`marketing/capsules/header_capsule.html`：与 small 类似但稍大，调整 px：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 460px; height: 215px; }
    .capsule { padding: 24px 28px; display: flex; align-items: center; gap: 20px; }
    .title { font-size: 36px; line-height: 1; }
    .subtitle { font-size: 14px; margin-top: 8px; }
    .blocks-mid { width: 100px; height: 100px; }
    .blocks-mid .block { width: 18px; height: 18px; }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="bg-pattern"></div>
    <div class="blocks blocks-mid">
      <div class="block i"></div><div class="block l"></div><div class="block j"></div><div class="block s"></div><div class="block z"></div>
      <div class="block p"></div><div class="block y"></div><div class="block n"></div><div class="block t"></div><div class="block u"></div>
    </div>
    <div>
      <div class="title">Calendar Puzzle</div>
      <div class="subtitle">Cozy pentomino daily challenge</div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 4: library_capsule.html (600×900 竖版)**

`marketing/capsules/library_capsule.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 600px; height: 900px; }
    .capsule {
        padding: 60px 40px;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 32px;
    }
    .title { font-size: 80px; line-height: 0.95; text-align: center; }
    .subtitle { font-size: 22px; text-align: center; }
    .blocks-huge { width: 320px; height: 320px; gap: 6px; }
    .blocks-huge .block { width: 60px; height: 60px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="bg-pattern"></div>
    <div class="blocks blocks-huge">
      <div class="block i"></div><div class="block l"></div><div class="block j"></div><div class="block s"></div><div class="block z"></div>
      <div class="block p"></div><div class="block y"></div><div class="block n"></div><div class="block t"></div><div class="block u"></div>
    </div>
    <div>
      <div class="title">Calendar<br>Puzzle</div>
    </div>
    <div class="subtitle">Drop the blocks.<br>Leave today.</div>
  </div>
</body>
</html>
```

- [ ] **Step 5: library_hero.html (3840×1240，含安全区)**

Steam Library Hero 关键约束：
- 真实显示区域 1840×620（中央居中）
- 两侧 1000px 是裁切区，**不能放重要内容**
- 上下各 310px 同样裁切区

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 3840px; height: 1240px; }
    .capsule {
        background: linear-gradient(135deg, #0F0F12 0%, #1B1B20 100%);
        color: #F2F2F4;
        display: flex; align-items: center; justify-content: center;
        position: relative;
    }
    .safe-area {
        width: 1840px;  /* 真实可视区 */
        height: 620px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 60px;
    }
    .title { font-size: 140px; line-height: 0.95; }
    .subtitle { font-size: 36px; margin-top: 24px; color: #9B9BA3; }
    .blocks-mega { width: 480px; height: 480px; gap: 8px; }
    .blocks-mega .block { width: 92px; height: 92px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="bg-pattern"></div>
    <div class="safe-area">
      <div>
        <div class="title">Calendar<br>Puzzle</div>
        <div class="subtitle">A daily cozy pentomino challenge.</div>
      </div>
      <div class="blocks blocks-mega">
        <div class="block i"></div><div class="block l"></div><div class="block j"></div><div class="block s"></div><div class="block z"></div>
        <div class="block p"></div><div class="block y"></div><div class="block n"></div><div class="block t"></div><div class="block u"></div>
      </div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 6: library_logo.html (1280×720, 透明 PNG，仅 logo)**

Steam Library Logo 是放在 hero 上面叠加的 logo PNG，需要**透明背景**。CSS 用 `background: transparent`，渲染时 puppeteer 加 `--omit-background`：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 1280px; height: 720px; background: transparent; }
    .capsule { background: transparent !important; display: flex; align-items: center; justify-content: center; }
    .title { font-size: 180px; line-height: 0.9; color: #F2F2F4; text-shadow: 0 4px 16px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="title" style="text-align: center;">Calendar<br>Puzzle</div>
  </div>
</body>
</html>
```

- [ ] **Step 7: community_icon.html (184×184，社区图标小方块)**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="shared/styles.css">
  <style>
    html, body { width: 184px; height: 184px; }
    .capsule { display: flex; align-items: center; justify-content: center; }
    .blocks-icon { width: 140px; height: 140px; gap: 4px; }
    .blocks-icon .block { width: 26px; height: 26px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="capsule">
    <div class="blocks blocks-icon">
      <div class="block i"></div><div class="block l"></div><div class="block j"></div><div class="block s"></div><div class="block z"></div>
      <div class="block p"></div><div class="block y"></div><div class="block n"></div><div class="block t"></div><div class="block u"></div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 8: 浏览器肉眼校对**

```bash
# 每个 HTML 用 file:// 打开
open marketing/capsules/small_capsule.html
open marketing/capsules/main_capsule.html
# ... 全部 7 个
```

肉眼检查：颜色、字体、布局是否符合预期；如果觉得设计不行，调 CSS 重看。

- [ ] **Step 9: Commit**

```bash
git add marketing/capsules/*.html
git commit -m "feat(marketing): 7 capsule HTML templates (exact pixel sizes)"
```

---

## Task 3 — render_capsules.sh 浏览器渲染脚本

**Files:**
- Create: `tools/render_capsules.sh`

走 **路径 A：puppeteer (chromium headless)** + **路径 B：手动浏览器截图** 两套方案，用户挑一个。

- [ ] **Step 1: 写 render_capsules.sh**

`tools/render_capsules.sh`:

```bash
#!/usr/bin/env bash
# tools/render_capsules.sh — 渲染 7 个 capsule HTML 到精确像素的 PNG
# 依赖: puppeteer (npm install -g puppeteer) 或本机 Chrome
# 输出: marketing/capsules/png/<name>.png

set -euo pipefail

CAPSULES_DIR="$(cd "$(dirname "$0")/../marketing/capsules" && pwd)"
OUTPUT_DIR="$CAPSULES_DIR/png"
mkdir -p "$OUTPUT_DIR"

# capsule 列表: name|width|height|omit_background(0/1)
TARGETS=(
  "small_capsule|462|174|0"
  "main_capsule|616|353|0"
  "header_capsule|460|215|0"
  "library_capsule|600|900|0"
  "library_hero|3840|1240|0"
  "library_logo|1280|720|1"     # 透明背景
  "community_icon|184|184|0"
)

# 选择渲染方式
RENDERER="${RENDERER:-auto}"

# 找 chromium / chrome 路径
find_chrome() {
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)" \
    "$(command -v chromium-browser 2>/dev/null || true)"
  do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

CHROME="$(find_chrome || true)"
if [ -z "$CHROME" ]; then
  echo "ERROR: 找不到 Chrome / Chromium。手工方案: 双击各 capsule HTML，浏览器 dev tools 设 device 模式到精确尺寸 → 整页截图 → 保存到 $OUTPUT_DIR/<name>.png" >&2
  exit 1
fi

echo "Using browser: $CHROME"
echo "Output dir: $OUTPUT_DIR"
echo ""

for target in "${TARGETS[@]}"; do
  IFS='|' read -r name width height omit_bg <<< "$target"
  html_path="$CAPSULES_DIR/$name.html"
  png_path="$OUTPUT_DIR/$name.png"

  if [ ! -f "$html_path" ]; then
    echo "SKIP $name — HTML 缺失: $html_path"
    continue
  fi

  echo "==> $name (${width}x${height})"

  EXTRA_FLAGS=""
  if [ "$omit_bg" = "1" ]; then
    EXTRA_FLAGS="--default-background-color=00000000"
  fi

  "$CHROME" --headless --no-sandbox \
    --window-size="$width","$height" \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    $EXTRA_FLAGS \
    --screenshot="$png_path" \
    "file://$html_path" \
    2>/dev/null

  # 校验输出
  if [ ! -f "$png_path" ]; then
    echo "  ✗ 渲染失败"
    exit 1
  fi
  actual_dim=$(file "$png_path" | grep -oE '[0-9]+ x [0-9]+' || echo "unknown")
  echo "  ✓ → $png_path (actual: $actual_dim)"
done

echo ""
echo "Done. Check actual dimensions match expected:"
echo "  small: 462x174 / main: 616x353 / header: 460x215 / library: 600x900"
echo "  library_hero: 3840x1240 / library_logo: 1280x720 / community_icon: 184x184"
```

- [ ] **Step 2: 加可执行权限**

```bash
chmod +x tools/render_capsules.sh
```

- [ ] **Step 3: 跑一次**

```bash
./tools/render_capsules.sh
```

Expected: 7 个 PNG 出现在 `marketing/capsules/png/`，每个尺寸正确。

校验：

```bash
for f in marketing/capsules/png/*.png; do
  file "$f"
done
```

Expected: 每行像 `small_capsule.png: PNG image data, 462 x 174, 8-bit/color RGBA, non-interlaced`。

如果尺寸不对（headless Chrome 在某些版本有 1px 偏移），增加 `--window-size=$((width+1)),$((height+1))` 或改用 puppeteer Node 脚本（备选方案）。

- [ ] **Step 4: 备选 — 手动浏览器路径**

如果 headless 出图质量不行（字体糊 / antialias 怪），手动方案：

1. 在 Chrome / Firefox 用 Cmd+Option+I 开 DevTools
2. Toggle device toolbar (Cmd+Shift+M) → 设 width / height 到精确像素
3. DevTools Cmd+Shift+P → "Capture full size screenshot" → 保存到 `marketing/capsules/png/<name>.png`

文档此路径到 `marketing/capsules/README.md`（下一步生成）。

- [ ] **Step 5: 渲染质量 review**

把 7 张 PNG 在 Preview / Photos 里看：

- 字体清晰无糊
- 色彩与预期一致（用 Digital Color Meter 拾色比对 #4F46E5）
- library_logo 是透明背景
- library_hero 主视觉在 1840×620 安全区内

如果不行，回 Task 2 改 HTML/CSS，重跑 Step 3。

- [ ] **Step 6: Commit**

```bash
git add tools/render_capsules.sh marketing/capsules/png/
git commit -m "feat(marketing): render_capsules.sh + 7 PNG capsules at exact sizes"
```

---

## Task 4 — 写 tools/capture_screenshots.gd (Godot 截图工具)

**Files:**
- Create: `tools/capture_screenshots.gd`
- Create: `tools/screenshot_states.gd`（puzzle 状态预设）

- [ ] **Step 1: 写 screenshot_states.gd（描述每个截图要的游戏状态）**

`tools/screenshot_states.gd`:

```gdscript
# tools/screenshot_states.gd
# 截图状态预设：name → 描述 + 加载哪个 scene + 如何 setup
class_name ScreenshotStates extends RefCounted

# 状态列表，每个返回 Dictionary { name, scene_path, setup_fn }
static func all() -> Array:
    return [
        {
            "name": "01_clean_state",
            "scene": "res://games/calendar_puzzle/scenes/play_scene.tscn",
            "setup": "setup_clean_easy",
            "desc": "Easy 难度，棋盘干净，今天日期标记可见",
        },
        {
            "name": "02_mid_game",
            "scene": "res://games/calendar_puzzle/scenes/play_scene.tscn",
            "setup": "setup_mid_game",
            "desc": "Medium 难度，棋盘上放了 5 个块，4 个还在 tray",
        },
        {
            "name": "03_hint_highlight",
            "scene": "res://games/calendar_puzzle/scenes/play_scene.tscn",
            "setup": "setup_with_hint",
            "desc": "Hard 难度，弱提示已激活，一个空格高亮",
        },
        {
            "name": "04_win_state",
            "scene": "res://games/calendar_puzzle/scenes/win_scene.tscn",
            "setup": "setup_win",
            "desc": "胜利总结画面，含用时 / 难度 / 'Next puzzle' 按钮",
        },
        {
            "name": "05_settings",
            "scene": "res://boot/settings/settings_panel.tscn",
            "setup": "setup_settings_default",
            "desc": "设置面板，音量 + 主题 + 语言三栏可见",
        },
        {
            "name": "06_calendar",
            "scene": "res://games/calendar_puzzle/scenes/select_scene.tscn",
            "setup": "setup_calendar_2026_05",
            "desc": "日历选题界面，5 月份视图，今天高亮",
        },
        {
            "name": "07_skin_picker",
            "scene": "res://boot/settings/settings_panel.tscn",
            "setup": "setup_skin_tab",
            "desc": "设置面板的皮肤选择标签，3 个皮肤缩略图横排",
        },
        {
            "name": "08_tutorial",
            "scene": "res://games/calendar_puzzle/scenes/play_scene.tscn",
            "setup": "setup_tutorial_step_2",
            "desc": "教程第 2 步（学习放置），高亮和说明文字",
        },
    ]
```

- [ ] **Step 2: 写 capture_screenshots.gd 主脚本**

`tools/capture_screenshots.gd`:

```gdscript
# tools/capture_screenshots.gd
# 离线截图工具：逐个加载 ScreenshotStates 中的 state，渲染到 1920×1080 viewport,
# 保存到 marketing/screenshots/。
# 跑法: godot --script tools/capture_screenshots.gd
extends SceneTree

const ScreenshotStates = preload("res://tools/screenshot_states.gd")
const OUTPUT_DIR = "res://marketing/screenshots/"
const VIEW_SIZE := Vector2i(1920, 1080)

func _init() -> void:
    # 切到正确分辨率
    DisplayServer.window_set_size(VIEW_SIZE)
    var root_vp := root.get_viewport()
    root_vp.size = VIEW_SIZE

    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))

    var states = ScreenshotStates.all()
    print("[capture] %d states to render" % states.size())

    for state in states:
        await _capture_state(state)

    print("[capture] all done")
    quit(0)

func _capture_state(state: Dictionary) -> void:
    var name = state.name
    var scene_path = state.scene
    var setup_name = state.setup

    print("==> %s (%s)" % [name, scene_path])

    var scene = load(scene_path)
    if scene == null:
        push_error("[capture] scene 加载失败: " + scene_path)
        return

    var instance = scene.instantiate()
    root.add_child(instance)

    # 给 scene 一个 frame 初始化
    await process_frame
    await process_frame

    # 调用对应 setup function
    if instance.has_method(setup_name):
        instance.call(setup_name)
        # 多等几帧让状态稳定
        for _i in range(5):
            await process_frame

    # 抓帧
    var img := root.get_viewport().get_texture().get_image()
    img.flip_y()
    var out_path = OUTPUT_DIR + name + ".png"
    var err = img.save_png(ProjectSettings.globalize_path(out_path))
    if err == OK:
        print("  ✓ → %s" % out_path)
    else:
        push_error("save_png failed: %s" % err)

    # 清理
    instance.queue_free()
    await process_frame
```

- [ ] **Step 3: 在 play_scene / settings_panel / select_scene 中实现 setup_* 方法**

每个 setup 方法准备一个特定可视化状态。例如：

`games/calendar_puzzle/scenes/play_scene.gd` 加：

```gdscript
# --- 截图工具用 setup methods ---

func setup_clean_easy() -> void:
    # 加载预设干净 easy puzzle
    _load_puzzle({ "difficulty": "easy", "seed": 12345, "combo_index": 0 })

func setup_mid_game() -> void:
    setup_clean_easy()
    # 放 5 个块在固定位置（hardcoded 状态用于截图）
    _place_block_at("I", Vector2i(0, 0), 0, false)
    _place_block_at("L", Vector2i(2, 1), 1, false)
    _place_block_at("Y", Vector2i(4, 0), 0, false)
    _place_block_at("T", Vector2i(0, 4), 2, false)
    _place_block_at("U", Vector2i(5, 4), 0, false)

func setup_with_hint() -> void:
    _load_puzzle({ "difficulty": "hard", "seed": 67890, "combo_index": 0 })
    _activate_weak_hint()

func setup_tutorial_step_2() -> void:
    _start_tutorial()
    _advance_tutorial_to(2)
```

`boot/settings/settings_panel.gd` 加：

```gdscript
func setup_settings_default() -> void:
    _open_tab("audio")  # 默认音量栏

func setup_skin_tab() -> void:
    _open_tab("skin")
```

具体方法名按现有 implementation 调；本 plan 给出意图，executor 按实际 scene 实现。

- [ ] **Step 4: 跑截图工具**

```bash
godot --script tools/capture_screenshots.gd
```

> 注意：不能加 `--headless`，截图需要真实渲染。脚本会临时开窗。

Expected:
```
[capture] 8 states to render
==> 01_clean_state (res://games/calendar_puzzle/scenes/play_scene.tscn)
  ✓ → res://marketing/screenshots/01_clean_state.png
==> 02_mid_game ...
[capture] all done
```

校验：

```bash
ls -lh marketing/screenshots/*.png
identify marketing/screenshots/01_clean_state.png 2>/dev/null || file marketing/screenshots/01_clean_state.png
```

Expected: 8 个 PNG，每个 1920×1080。

- [ ] **Step 5: 肉眼 review 8 张图**

打开 `marketing/screenshots/` 全部 8 张：

- [ ] 主体内容居中
- [ ] 文字 readable（玩家在 Steam 商店缩略图看也能辨认核心元素）
- [ ] 颜色饱和度足（spec § 视觉设计系统 默认色，不是 pastel 灰）
- [ ] 无 debug overlay / FPS 显示 / 红色 assert 文字
- [ ] 没有空白 padding 大块（如果有，调 setup_* 加内容）

不满意的图：调对应 setup_* 方法，重跑 Step 4。

- [ ] **Step 6: Commit**

```bash
git add tools/capture_screenshots.gd tools/screenshot_states.gd \
        marketing/screenshots/ \
        games/calendar_puzzle/scenes/play_scene.gd \
        boot/settings/settings_panel.gd \
        games/calendar_puzzle/scenes/select_scene.gd
git commit -m "feat(marketing): capture_screenshots.gd produces 8 in-game 1920x1080 PNGs"
```

---

## Task 5 — 写 test_capture_screenshots.gd 校验

**Files:**
- Create: `tests/test_capture_screenshots.gd`

- [ ] **Step 1: 写测试**

`tests/test_capture_screenshots.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const ScreenshotStates = preload("res://tools/screenshot_states.gd")
const OUTPUT_DIR = "res://marketing/screenshots/"

func test_states_definition_has_8_entries():
    var states = ScreenshotStates.all()
    assert_gte(states.size(), 8, "至少应该 8 个截图 state")

func test_each_state_has_required_fields():
    for state in ScreenshotStates.all():
        assert_true(state.has("name"), "state 缺 name")
        assert_true(state.has("scene"), "state 缺 scene")
        assert_true(state.has("setup"), "state 缺 setup")
        assert_true(state.has("desc"), "state 缺 desc")

func test_each_scene_path_exists():
    for state in ScreenshotStates.all():
        assert_true(ResourceLoader.exists(state.scene), \
            "scene 不存在: %s" % state.scene)

func test_screenshot_files_generated():
    # 前提：用户已跑过 tools/capture_screenshots.gd
    var dir = DirAccess.open(OUTPUT_DIR)
    if dir == null:
        # 还没跑工具，skip
        pending("先跑 godot --script tools/capture_screenshots.gd 生成截图")
        return

    var pngs = []
    dir.list_dir_begin()
    var name = dir.get_next()
    while name != "":
        if name.ends_with(".png"):
            pngs.append(name)
        name = dir.get_next()

    assert_gte(pngs.size(), 8, "marketing/screenshots/ 应至少 8 张 PNG")

func test_screenshot_dimensions_are_1920x1080():
    var dir = DirAccess.open(OUTPUT_DIR)
    if dir == null:
        pending("先跑截图工具")
        return

    dir.list_dir_begin()
    var name = dir.get_next()
    while name != "":
        if name.ends_with(".png"):
            var img = Image.new()
            img.load(OUTPUT_DIR + name)
            assert_eq(img.get_width(), 1920, "%s width != 1920" % name)
            assert_eq(img.get_height(), 1080, "%s height != 1080" % name)
        name = dir.get_next()
```

- [ ] **Step 2: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep test_capture
```

Expected: 5 个测试 PASS（其中 2 个在没截图时会 pending）。

- [ ] **Step 3: Commit**

```bash
git add tests/test_capture_screenshots.gd
git commit -m "test(marketing): validate capture_screenshots.gd outputs 8 1920x1080 PNGs"
```

---

## Task 6 — 写宣传片脚本 + OBS 录制清单

**Files:**
- Create: `marketing/trailer/trailer_script.md`
- Create: `marketing/trailer/obs_recording_checklist.md`
- Modify: `.gitignore`（排掉 raw_clips/ + davinci_project/）

- [ ] **Step 1: 写宣传片脚本**

`marketing/trailer/trailer_script.md`:

```markdown
# Calendar Puzzle Trailer Script (45s 目标版)

> 镜头脚本，每段 5-10 秒；总时长 30-60s（目标 45s）。

## 整体调性

- BGM: lofi_loop.ogg (M9 已有)
- 调色：偏亮、暖、低对比；Steam 缩略图列表里要"舒服"
- 字体覆盖：Inter Bold 白色 + 微阴影
- 节奏：前 10s 慢、勾住观众；中段加速；最末 10s 留 CTA 呼吸

## 镜头 (shot list)

### 0:00 - 0:03 (3s) Logo + Tagline
- 全屏淡入 logo（Calendar Puzzle）
- 副标题淡入 "A daily cozy pentomino challenge"
- BGM 渐入 30% 音量

### 0:03 - 0:08 (5s) 首块放置高光
- play scene 视角，玩家拾起一块 I，旋转，缓慢落下
- 落下时小粒子 + place.ogg 清脆音
- 字幕 (淡入淡出)："Drop the blocks."

### 0:08 - 0:15 (7s) 难度展示
- 2×2 网格 split-screen：easy / medium / hard / expert 各占一格
- 每格 1.5s 快速时光倒流式快速完成一局
- 字幕："5 difficulties from easy to insomnia"

### 0:15 - 0:22 (7s) 日历模式
- 镜头切到 select_scene 的 calendar 视图
- 玩家鼠标 / 触屏点切月，从 2026-5 切到 2026-10
- 字幕："Play any day. 2020 to 2035 covered."

### 0:22 - 0:28 (6s) 皮肤切换
- play scene，正在玩
- 设置弹出 → 切换 default → pastel → mono_focus
- 棋盘配色实时变化（无 reload）
- 字幕："3 visual themes. Light & Dark."

### 0:28 - 0:35 (7s) 胜利时刻 + 成就
- play scene 最后一块落下
- 胜利动画（屏幕缓动 + 粒子 + win.ogg）
- Steam achievement popup 滑入
- 字幕："Unlock 20 achievements. Track your best."

### 0:35 - 0:42 (7s) 治愈氛围镜头
- play scene 长镜头静止显示已完成棋盘 + BGM 淡入
- 文案："Take your time."
- 切到 settings 的 audio panel 强调 BGM/SFX 独立调节

### 0:42 - 0:45 (3s) CTA
- 黑底白字："Wishlist on Steam"
- Calendar Puzzle logo + Steam 图标
- BGM 收尾

## 字幕本地化

录中文版需要：
- 0:03 "Drop the blocks." → "放下方块"
- 0:08 "5 difficulties from easy to insomnia" → "5 个难度，从入门到失眠"
- 0:15 "Play any day. 2020 to 2035 covered." → "任意日期可玩，覆盖 2020-2035"
- 0:22 "3 visual themes. Light & Dark." → "3 套视觉皮肤，亮色暗色任选"
- 0:28 "Unlock 20 achievements. Track your best." → "解锁 20 个成就，记录你的最佳"
- 0:35 "Take your time." → "慢慢来"
- 0:42 "Wishlist on Steam" → "在 Steam 加入愿望单"

英文版上传 default 商店；中文版给 zh-CN / zh-TW 商店页备选（Steamworks 允许多语言 trailer）。

## R7 缓解：质量底线

如果剪完自评低于"打开钱包"水准，按 spec 预留预算：

- $200-500 找 Fiverr / Upwork 上 Indie Game Trailer 类目的 freelancer 重剪（提供 raw_clips + script + 1 版自剪做参考）
- 上传 freelancer 的版本，自剪版做备用
```

- [ ] **Step 2: 写 OBS 录制清单**

`marketing/trailer/obs_recording_checklist.md`:

```markdown
# OBS Studio 录制 checklist

## 一次性 OBS 配置

- Output → Streaming: 不用
- Output → Recording:
  - Format: mp4 (兼容 DaVinci Resolve)
  - Encoder: x264 (软编，质量稳；如有 NVIDIA 用 NVENC)
  - Rate Control: CRF
  - CRF: 18 (近无损)
  - Keyframe Interval: 2
  - Preset: medium
  - Profile: high
- Video:
  - Base (Canvas) Resolution: 1920×1080
  - Output (Scaled) Resolution: 1920×1080
  - FPS: 60
- Audio:
  - Sample Rate: 48 kHz
  - Channels: Stereo

## 单一 Scene 配置

只要一个 OBS Scene，含两个 Source：

1. Window Capture (macOS: Screen Capture) → 选 Godot 游戏窗口
   - Crop 到游戏 viewport（去窗口标题栏）
2. Audio Output Capture → 选系统输出（捕获游戏 BGM + SFX）

## 每条片段录制流程

按 trailer_script.md 的 7 个 shot 逐个录：

1. 准备游戏到该 shot 起始状态（参考 ScreenshotStates 的 setup_* 方法手动做）
2. OBS 点 "Start Recording"
3. 在游戏内执行该 shot 的操作（拾块 / 旋转 / 切月 / 等）
4. 多录 5 秒缓冲（剪辑时砍头尾）
5. OBS 点 "Stop Recording"
6. 文件自动存到 OBS 默认目录（macOS: ~/Movies/）
7. 重命名为 `shot_0X_<desc>.mp4`，移到 `marketing/trailer/raw_clips/`

## 单 shot 录制 tips

- 鼠标动作 slow & deliberate（观众跟得上）
- 操作前后留 0.5s 静态空帧（方便剪入剪出过渡）
- 同一 shot 录 2-3 版，挑最佳

## checklist：录制前再确认

- [ ] 游戏关闭 dev overlay (F1 / 任何 debug HUD)
- [ ] 主题设为 light (大多数场景)
- [ ] 皮肤设为 default 除非 shot 要求 pastel/mono
- [ ] 关 macOS 通知（防止 notif popup 出现在录制里）
- [ ] 关 Slack/Discord
- [ ] 录前 quit 不必要的进程节省 CPU
```

- [ ] **Step 3: 更新 .gitignore**

`.gitignore` 追加：

```
# Marketing 大文件 (raw video / DaVinci project)
marketing/trailer/raw_clips/
marketing/trailer/davinci_project/
marketing/trailer/*.tmp
```

- [ ] **Step 4: Commit**

```bash
git add marketing/trailer/trailer_script.md marketing/trailer/obs_recording_checklist.md .gitignore
git commit -m "docs(trailer): 45s shot script + OBS recording checklist"
```

---

## Task 7 — 录制原片 (异步任务)

**Files:**
- Create: `marketing/trailer/raw_clips/shot_0X_*.mp4`（gitignored）

> 这是**人工拍摄**任务，需要在多个游戏状态下走操作并 OBS 录屏。按 obs_recording_checklist.md 流程跑。

- [ ] **Step 1: 装 OBS Studio**

macOS: `brew install --cask obs`
Win: 官网 https://obsproject.com/
Linux: `sudo apt install obs-studio`

按 obs_recording_checklist.md 一次性配好。

- [ ] **Step 2: 逐个 shot 录制**

按 `marketing/trailer/trailer_script.md` 7 个 shot 录：

- [ ] shot_01_logo_tagline.mp4
- [ ] shot_02_first_block.mp4
- [ ] shot_03_difficulties.mp4 (录 4 段：easy / medium / hard / expert，剪辑时拼)
- [ ] shot_04_calendar.mp4
- [ ] shot_05_skin_switch.mp4
- [ ] shot_06_win_achievement.mp4
- [ ] shot_07_cta.mp4

每个 shot 多录 2-3 take 挑最佳。

文件全部放 `marketing/trailer/raw_clips/`（gitignored）。

- [ ] **Step 3: 自审 raw_clips 质量**

挨个看每个 mp4：

- 操作清晰
- 无误操作 / 卡顿
- 音频跟画面同步
- 60fps 流畅

不达标的 shot 重录。

> Step 3 完成后不 commit（raw_clips gitignored），但要在 PROGRESS 文档里标记 "raw clips done"。

---

## Task 8 — DaVinci Resolve 剪辑 + 导出成片

**Files:**
- Create: `marketing/trailer/calendar-puzzle-trailer.mp4`（最终成片）

> DaVinci 工程文件 `marketing/trailer/davinci_project/` gitignored；只 commit 最终 mp4。

- [ ] **Step 1: 装 DaVinci Resolve (free 版)**

下载：https://www.blackmagicdesign.com/products/davinciresolve

Mac / Win / Linux 都有 free 版（够用）。

- [ ] **Step 2: 新建项目 + 导入 raw_clips**

DaVinci 操作：

1. File → New Project → "Calendar Puzzle Trailer"
2. Media tab → 右下 Media Pool → 右键 "Import Media" → 选 raw_clips/*.mp4
3. File → Save → 保存到 `marketing/trailer/davinci_project/`
4. Project Settings → Resolution 1920×1080, FPS 60, Codec H.264

- [ ] **Step 3: 按 trailer_script.md 时间线剪辑**

Edit page：

1. 拖 shot_01 到 timeline 0:00
2. 用 trim 工具切到 3 秒
3. 拖 shot_02 接到 0:03
4. ...依 script 时间线接所有 shot
5. 在 shot 之间加 cross dissolve transitions 0.3s
6. 末尾留 0:42-0:45 CTA 黑底文字（在 DaVinci 加 Text+ → "Wishlist on Steam"）

- [ ] **Step 4: 加 BGM + 调音**

1. 导入 `games/calendar_puzzle/assets/bgm/lofi_loop.ogg` 到 Media Pool
2. 拖到 Audio Track 1
3. 起始位置 0:00，cross fade in 1s
4. 末尾 0:43 开始 fade out 2s
5. 整体音量 -8dB（不盖原 SFX）

- [ ] **Step 5: 字幕**

按 trailer_script.md 时间码加字幕：

1. 每个字幕用 Text+ Title
2. Font: Inter Bold 36pt 白色 + 1px 黑色边
3. 位置：屏幕底部 1/4 高度
4. 入场动画：fade in 0.3s
5. 持续 2.5s
6. 出场：fade out 0.3s

- [ ] **Step 6: 色彩校正 (轻度)**

Color page：

- 各 shot 调到统一色温（Temp ~5500K）
- Lift / Gamma / Gain 微调到一致明暗
- 不过度 LUT，保游戏原貌

- [ ] **Step 7: 导出 mp4**

Deliver page：

- Render Settings → Custom Export
- Format: MP4
- Codec: H.264
- Resolution: 1920×1080
- FPS: 60
- Quality: Restrict to 20000 kbps (~10MB / 45s)
- Audio: AAC 192 kbps
- 文件名: `calendar-puzzle-trailer.mp4`
- 输出目录: `marketing/trailer/`
- Add to Render Queue → Start Render

- [ ] **Step 8: 校验成片**

```bash
file marketing/trailer/calendar-puzzle-trailer.mp4
ffprobe marketing/trailer/calendar-puzzle-trailer.mp4 2>&1 | grep -E "Duration|Stream"
```

Expected:
- 时长 30-60 秒（理想 45s±5）
- 1920×1080
- H.264 + AAC
- 文件大小 < 50MB

- [ ] **Step 9: 自审**

播放成片几遍。问自己：

- 前 5s 抓不抓人？(Steam 商店自动播放，前 5s 决定 80% 转化)
- 操作易懂吗？没接触 puzzle 类玩家能看出在干什么吗？
- BGM 不打架（不盖字幕 / 不盖 SFX）
- 字幕看得清吗（在小屏播放是否糊）

如果不满意，按 R7 缓解上 Fiverr 找 freelancer ($200-500)。提供 raw_clips + script + 当前自剪做参考。

- [ ] **Step 10: Commit 成片**

```bash
git lfs install  # 如果还没装
git lfs track "marketing/trailer/*.mp4"
git add .gitattributes marketing/trailer/calendar-puzzle-trailer.mp4
git commit -m "feat(marketing): 45s gameplay trailer for Steam store"
```

> 注意 mp4 通过 git LFS 管理避免仓库膨胀。如果不想用 LFS，把成片直接上传 Steamworks，仓库不存。

---

## Task 9 — Steam Playtest 开启 + 邀请 5-10 个测试玩家

**Files:**
- Create: `marketing/PLAYTEST_INVITES.md`
- Create: `marketing/beta_feedback_form.md`

- [ ] **Step 1: 在 Steamworks portal 开启 Playtest**

浏览器操作（https://partner.steamgames.com/apps/landing/<APP_ID>）：

1. App → "Playtest" tab
2. "Enable Playtest" → 同意 Steam 条款
3. Steam 会自动创建一个 child app (App ID + 1 通常)
4. 配置 Playtest 商店页（最小：1 张截图 + 简短描述）
5. Set initial state: "Limited Access" (只 key 持有人能玩)
6. 关联 Playtest build = 当前 beta branch build（M8 已上传）

- [ ] **Step 2: 在 Steamworks 生成 5-10 个 Playtest key**

1. App → Keys & Demos → "Request CD Keys"
2. Reason: "Playtest invitations"
3. Quantity: 10
4. Submit → Valve 通常立即批准（个位数量级）
5. 下载 keys.txt

- [ ] **Step 3: 写邀请列表**

`marketing/PLAYTEST_INVITES.md`:

```markdown
# Playtest Invitations Tracker

## 邀请池

把 keys.txt 里 10 个 key 分到下表，每个 key 给一个邀请人。

| Index | Key (前4-后4) | 邀请来源 | 邀请人名 / 联系方式 | 发出日期 | 接受 | 完成反馈 |
|---|---|---|---|---|---|---|
| 1 | XXXX-...-YYYY | 朋友 (本地拼图爱好者) | <名字 / Discord> | <date> | ☐ | ☐ |
| 2 | ... | r/IndieDev | <Reddit user> | | ☐ | ☐ |
| 3 | ... | r/godot | | | ☐ | ☐ |
| 4 | ... | Discord (Godot CN) | | | ☐ | ☐ |
| 5 | ... | Discord (Indie 中国) | | | ☐ | ☐ |
| 6 | ... | 同事 (产品经理友人) | | | ☐ | ☐ |
| 7 | ... | 同事 (设计师友人) | | | ☐ | ☐ |
| 8 | ... | Twitter (gamedev 关注者) | | | ☐ | ☐ |
| 9 | ... | 拼图玩家家人 | | | ☐ | ☐ |
| 10 | ... | (备用 / 滚动招募) | | | ☐ | ☐ |

## 邀请来源策略

- 朋友 (2-3 个)：偏见但完成率高
- Reddit r/IndieDev、r/godot、r/incrementalgame (3-4 个)：陌生玩家，反馈最有用
- Discord (Godot 中文社区 / Indie 中文社区) (2 个)：中文玩家视角
- Twitter game dev tag (1-2 个)：可能带来曝光

## 邀请文案模板

```
Hey [Name],

I'm working on Calendar Puzzle, a cozy daily pentomino puzzle game for Steam (release Q1 2027).

Would you spare ~30 minutes to playtest the current build and share feedback?

Steam key: XXXX-XXXX-XXXX
Activation: Steam → Games → Activate a Product → paste key
Feedback form (5 mins): <link to marketing/beta_feedback_form.md>

Thanks!
```
```

- [ ] **Step 4: 写反馈表单**

`marketing/beta_feedback_form.md`:

```markdown
# Calendar Puzzle Playtest Feedback

> Played [date]: __________
> Platform: ☐ Windows / ☐ macOS / ☐ Linux / ☐ Steam Deck
> Playtime: __________ minutes
> Difficulty tried: ☐ Easy ☐ Medium ☐ Hard ☐ Expert ☐ Insomnia

## 1. First impression (前 5 分钟)

> 主菜单 / 教程 / 第一局期间感觉如何？

- 主菜单清晰度 (1-5):
- 教程易懂度 (1-5):
- 视觉吸引力 (1-5):

## 2. 玩法

- 拖放手感 (1-5):
- 旋转 / 镜像 是否直觉:
- 提示按钮触发位置好找吗:
- 5 难度区分明显吗:

## 3. 视觉 / 音频

- 默认皮肤好看吗 (1-5):
- 试过其他皮肤吗? 哪个最喜欢?
- BGM 满意度 (1-5):
- SFX 满意度 (1-5):
- 暗主题用了吗? 感受?

## 4. 设置 / 自定义

- 设置面板找得到吗:
- 键位重映射用过吗:
- 缺什么设置选项:

## 5. 性能 / bug

- FPS 稳吗:
- 遇到过 crash 吗 (描述):
- UI 错位 / 文字溢出 (描述 + 截图):
- 存档丢失或损坏:

## 6. 总体

- 会不会上架后买 (1-5):
- 觉得合理价位 ($1-10):
- 推荐给朋友的可能性 (1-5):

## 7. 自由意见

> 最喜欢什么:
> 最不喜欢什么:
> 想加什么 feature:
> 其他:
```

- [ ] **Step 5: 异步发送 + 跟踪**

实际操作：

1. 按 PLAYTEST_INVITES.md 表格逐个发邀请文案 + key
2. 一周后没接受的 key 收回，再发给备选
3. 完成反馈的玩家在表格打 ✓
4. 反馈集中归档到 `marketing/feedback/<player-id>.md`

- [ ] **Step 6: 汇总反馈 + 排优先级**

收到 ≥ 5 份反馈后：

1. 在 `marketing/PLAYTEST_SUMMARY.md` 汇总（自动生成或手写）
2. 按"出现频次"排序问题
3. P0 (5/5 玩家都吐槽 + 阻塞玩) → 入 M11 fix list
4. P1 (3+ 玩家提) → 入 backlog 看上架前能不能塞
5. P2 (单人意见 / 个人偏好) → archive 留作 Phase 2 参考

- [ ] **Step 7: Commit 反馈材料**

```bash
git add marketing/PLAYTEST_INVITES.md marketing/beta_feedback_form.md
git commit -m "ops(beta): playtest invite tracker + feedback form template"
```

发出 + 收集 + 汇总后再 commit `marketing/feedback/` + `PLAYTEST_SUMMARY.md`:

```bash
git add marketing/feedback/ marketing/PLAYTEST_SUMMARY.md marketing/PLAYTEST_INVITES.md
git commit -m "ops(beta): playtest feedback collected (N responses)"
```

---

## Task 10 — 上传所有物料到 Steamworks 商店页

**Files:**
- 无新文件（纯浏览器操作）

- [ ] **Step 1: 上传 capsule 图**

浏览器操作 (https://partner.steamgames.com/apps/landing/<APP_ID> → Edit Store Page → Images & Graphics)：

1. Small Capsule → 上 `marketing/capsules/png/small_capsule.png`
2. Main Capsule → 上 `main_capsule.png`
3. Header Capsule → 上 `header_capsule.png`
4. Library Capsule → 上 `library_capsule.png` (600×900)
5. Library Hero → 上 `library_hero.png` (3840×1240)
6. Library Logo → 上 `library_logo.png` (1280×720, 透明)
7. Community Icon → 上 `community_icon.png` (184×184)

每个上传后 Steamworks 显示预览，肉眼校对。

- [ ] **Step 2: 上传 8 张游戏截图**

Edit Store Page → Screenshots → "Upload Screenshot" × 8

按 `marketing/screenshots/01_clean_state.png ... 08_tutorial.png` 顺序上传（顺序决定商店页展示顺序）。

第 1 张要最吸引人（默认 hero shot），推荐用 `02_mid_game.png`（看得出玩法）。

- [ ] **Step 3: 上传宣传片**

Edit Store Page → Trailers → "Upload Video"

- 上传 `marketing/trailer/calendar-puzzle-trailer.mp4`
- 类型: Highlights (会自动在 store page 顶部播放)
- 字幕（中文版可单独上传一版作为 zh-CN 默认）

- [ ] **Step 4: Steamworks portal 预览检查**

点 "Preview your Store Page"（页面顶部按钮）:

- [ ] 7 张 capsule 在不同位置正确显示
- [ ] 8 张截图依次排列且大图清晰
- [ ] 宣传片自动播放
- [ ] 没有 placeholder / "TBD" 残留

发现问题回上面 step 修。

- [ ] **Step 5: Commit (无文件，只在 PROGRESS 标记)**

```bash
# 无文件 commit。在 docs/STEAM_SETUP.md 标更新：
cat >> docs/STEAM_SETUP.md <<'EOF'

## M10 物料上传记录

- [x] 7 capsules uploaded (date: <YYYY-MM-DD>)
- [x] 8 screenshots uploaded
- [x] Trailer uploaded
- [ ] Store page reviewed and approved by self
EOF
git add docs/STEAM_SETUP.md
git commit -m "ops(steam): all M10 marketing assets uploaded to store page"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M10 spec 验收门槛 4 项全覆盖：
- ✅ 7 张 capsule (精确尺寸) → Task 1-3
- ✅ 8-10 张游戏截图 (1920×1080, 8 场景) → Task 4
- ✅ 30-60s 宣传片 → Task 6-8
- ✅ Steam Playtest + 5-10 测试 → Task 9
- ✅ test_capture_screenshots.gd → Task 5

**2. Placeholder scan**: `<APP_ID>` 仍是 Steam App ID 实际值占位（M0 流程拿到）；PLAYTEST_INVITES.md 玩家名字 / Reddit user 是用户实际填表位（不能 plan 阶段决定具体哪 10 人）。

**3. Type consistency**: 截图状态 name `01_clean_state` 等在 ScreenshotStates / capture_screenshots.gd / test_capture_screenshots 一致；capsule 尺寸 (462×174 等) 在 Task 2 HTML + Task 3 render_capsules.sh + spec § Steam 店面物料清单 一致；trailer 时长 30-60s 在 trailer_script.md + Task 8 Step 8 校验一致。

**4. Ambiguity**: 宣传片质量主观、自审还是外包是事先承认的风险（R7）；plan 给了"如果自评不行则上 Fiverr"的兜底（Task 8 Step 9）。Playtest 玩家招募成功率不可控（陌生人可能不回邮）；plan 设计了 10 个 key + 备用名单做对冲（Task 9）。

无发现要修。M10 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven）。

并行化建议：

- **Week 1**：
  - Task 1 + Task 2（capsule 设计）— 1 个 agent，约 4-6 小时（含设计迭代）
  - Task 4 + Task 5（in-game 截图）— 另一个 agent，约 4-6 小时
  - Task 6（trailer 脚本 + OBS 配置）— 第三个 agent，约 2 小时
- **Week 1-2**：
  - Task 3（capsule 渲染）— 串在 Task 2 之后
  - Task 7（录制原片）— 串在 Task 6 之后，人工 4-6 小时
  - Task 9 Step 1-4（Playtest 配置 + 邀请文案）— 可与录制并行
- **Week 2**：
  - Task 8（DaVinci 剪辑）— 人工 4-8 小时（学习 DaVinci + 剪片）
  - Task 9 Step 5-6（异步等反馈，1 周窗口）
  - Task 10（上传到 Steamworks）— 任何阶段最末做，1 小时

R7 缓解兜底：若 Task 8 自剪不行，第 2 周外包 $200-500 给 Fiverr freelancer（提供 raw_clips + script + 自剪做参考），交付 3-5 天，仍能赶上 M11 上架窗口。
