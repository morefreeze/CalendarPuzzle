# M8 — 多平台构建 + Mac 公证 + Steam Deck 验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Calendar Puzzle 能在 Win / Mac / Linux / Steam Deck 四平台 native 跑起来；Mac 通过 Apple 公证；Deck 满足 Steam Deck Verified 标准；Steamworks 按平台拆 depot 上传。

**Architecture:** 一次性配 `export_presets.cfg` 4 个 target（macOS 用 universal、Linux 一份配置同时供桌面 Linux 与 Deck），`tools/build_all.sh` 串起来。Mac 公证脚本 `tools/mac_notarize.sh` 单独跑，依赖 Apple Developer ID + notarytool。Deck 验收靠手测 checklist + 在真机 / `steamos-devkit` 上跑一遍关键路径。

**Tech Stack:** Godot 4.3+ export templates、Apple Developer ID Application + notarytool (xcrun)、SteamCMD + content_builder/app_build.vdf、Steamworks portal、real Win/Mac/Linux/Deck 设备或 VM。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Build & release pipeline / § Multi-platform build matrix / § Milestones M8 / § Risk R2 (Steam Deck Verified) / § Risk R3 (Mac 公证踩坑)

**Acceptance gates (从 spec 抄):**
- Win / Mac / Linux native build 都能从 `tools/build_all.sh` 一键产出
- Mac build 通过 `codesign --options runtime` + `xcrun notarytool submit --wait` + `xcrun stapler staple`，下载后 macOS Gatekeeper 不报"未公证"
- Steam Deck 实机或 `steamos-devkit` 跑一轮：手柄唯一输入完成 launch → tutorial skip → play easy → win → save manual slot → reload → quit；文字最小 ≥ 9pt @ 1280×800；suspend/resume 不丢档
- Steamworks Win / Mac / Linux 三个 depot 各自上传成功；玩家只下自己平台二进制
- `tests/test_export_presets.gd` 校验 `export_presets.cfg` 含 4 target + main scene = `res://boot/boot.tscn`

---

## File Structure

本 milestone 创建 / 修改的文件（全部在 `~/mygit/calendar-puzzle-godot/` 下）：

```
calendar-puzzle-godot/
├── export_presets.cfg                            # 4 个 export target 配置（Godot 写）
├── tools/
│   ├── build_all.sh                              # 一键构建 4 平台
│   ├── mac_notarize.sh                           # macOS codesign + notarize + staple
│   └── deck_smoke_test.md                        # Steam Deck 手测 checklist (markdown)
├── content_builder/
│   ├── app_build.vdf                             # Steamworks 应用 build 描述
│   ├── depot_build_win.vdf                       # Win depot
│   ├── depot_build_mac.vdf                       # Mac depot
│   └── depot_build_linux.vdf                     # Linux/Deck depot
├── build/                                        # gitignored；构建输出
│   ├── win/CalendarPuzzle.exe + .pck
│   ├── mac/CalendarPuzzle.app
│   ├── linux/CalendarPuzzle.x86_64 + .pck
│   └── (Steam Deck 同 linux/，直接复用)
├── tests/
│   └── test_export_presets.gd                    # 解析 export_presets.cfg 校验
└── docs/
    ├── STEAM_DECK_VERIFIED.md                    # Deck Verified 申请 checklist
    ├── MAC_NOTARIZE.md                           # 公证流程 + 排错手册
    └── MULTIPLATFORM_TEST_REPORT.md              # 4 平台手测记录（M8 收尾填）
```

---

## Task 1 — 配置 export_presets.cfg（4 个 export target）

**Files:**
- Create: `export_presets.cfg`

- [ ] **Step 1: 在 Godot Editor 安装 export templates**

UI 操作（必须先做，否则下面所有 export 都 fail）：

1. 打开 Godot Editor → Editor → Manage Export Templates
2. 点 "Download and Install"，挑当前 Godot 版本对应的 templates（约 1GB）
3. 等装完，看到 status "Currently Installed: 4.3.x.stable"

校验：

```bash
ls ~/Library/Application\ Support/Godot/export_templates/4.3.stable/  # macOS
# 或 Linux: ~/.local/share/godot/export_templates/4.3.stable/
# 或 Win: %APPDATA%\Godot\export_templates\4.3.stable\
```

Expected: 看到 `windows_release_x86_64.exe`, `macos.zip`, `linux_release.x86_64` 等文件。

- [ ] **Step 2: 在 Godot Editor 新建 4 个 export preset**

UI 操作：Project → Export → Add...

依次添加 4 个 preset，每个都设 `Export Path` 指向 `build/<platform>/...`，主场景默认 `res://boot/boot.tscn`：

1. **Windows Desktop**
   - Architecture: `x86_64`
   - Export Path: `build/win/CalendarPuzzle.exe`
   - Embed PCK: false（拆开方便差分更新）
2. **macOS**
   - Architecture: `Universal` (Intel + Apple Silicon)
   - Export Path: `build/mac/CalendarPuzzle.zip`（导出会自动包成 .app 在 zip 里）
   - Application → Bundle Identifier: `com.<your-handle>.calendarpuzzle`
   - Application → Bundle Short Version: `1.0.0`
   - Codesign → Enable: **false**（M8 用 codesign CLI 手动做，避免 Editor 卡密码弹窗）
   - Notarization → Enable: **false**（同上原因）
3. **Linux/X11**
   - Architecture: `x86_64`
   - Export Path: `build/linux/CalendarPuzzle.x86_64`
   - Embed PCK: false
4. **Linux/X11 (Steam Deck)**
   - 复制 #3 上面那条，rename 为 "Steam Deck"
   - Export Path: `build/deck/CalendarPuzzle.x86_64`
   - 备注：实际二进制与 Linux 完全相同；拆开只是为了让 `build_all.sh` 输出到独立目录便于 deck depot 上传
   - 也可不复制，直接复用 Linux preset，仅在 Steamworks depot 里同一 binary 投两个 depot

> **决策**：本 plan 走"独立 preset, 同输出"，理由是 Steamworks depot 里两 depot 各自指向 `build/linux/` 与 `build/deck/` 更清晰；但实际产物字节级相同。

- [ ] **Step 3: 校验 export_presets.cfg 内容**

Editor 操作完后退出，打开 `export_presets.cfg`（在仓库根），确认包含以下 4 段 `[preset.N]`：

```ini
[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
runnable=true
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/win/CalendarPuzzle.exe"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.0.options]
custom_template/debug=""
custom_template/release=""
debug/export_console_wrapper=1
binary_format/embed_pck=false
texture_format/bptc=true
texture_format/s3tc=true
texture_format/etc=false
texture_format/etc2=false
binary_format/architecture="x86_64"
codesign/enable=false
application/modify_resources=true
application/icon=""
application/console_wrapper_icon=""
application/icon_interpolation=4
application/file_version=""
application/product_version=""
application/company_name="Calendar Puzzle"
application/product_name="Calendar Puzzle"
application/file_description=""
application/copyright=""
application/trademarks=""
application/export_angle=0
ssh_remote_deploy/enabled=false

[preset.1]
name="macOS"
platform="macOS"
runnable=true
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/mac/CalendarPuzzle.zip"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.1.options]
export/distribution_type=1
binary_format/architecture="universal"
custom_template/debug=""
custom_template/release=""
debug/export_console_wrapper=1
application/icon=""
application/icon_interpolation=4
application/bundle_identifier="com.calendarpuzzle.app"
application/signature=""
application/app_category="Games"
application/short_version="1.0.0"
application/version="1.0.0"
application/copyright=""
application/copyright_localized={}
application/min_macos_version="10.12"
application/export_angle=0
display/high_res=true
xcode/platform_build="14C18"
xcode/sdk_version="13.1"
xcode/sdk_build="22C55"
xcode/sdk_name="macosx13.1"
xcode/xcode_version="1420"
xcode/xcode_build="14C18"
codesign/codesign=0
codesign/installer_identity=""
codesign/apple_team_id=""
codesign/identity=""
codesign/entitlements/custom_file=""
codesign/entitlements/allow_jit_code_execution=false
codesign/entitlements/allow_unsigned_executable_memory=false
codesign/entitlements/allow_dyld_environment_variables=false
codesign/entitlements/disable_library_validation=false
codesign/entitlements/audio_input=false
codesign/entitlements/camera=false
codesign/entitlements/location=false
codesign/entitlements/address_book=false
codesign/entitlements/calendars=false
codesign/entitlements/photos_library=false
codesign/entitlements/apple_events=false
codesign/entitlements/debugging=false
codesign/entitlements/app_sandbox/enabled=false
codesign/entitlements/app_sandbox/network_server=false
codesign/entitlements/app_sandbox/network_client=false
codesign/entitlements/app_sandbox/device_camera=false
codesign/entitlements/app_sandbox/device_microphone=false
codesign/entitlements/app_sandbox/device_usb=false
codesign/entitlements/app_sandbox/device_bluetooth=false
codesign/entitlements/app_sandbox/files_downloads=0
codesign/entitlements/app_sandbox/files_pictures=0
codesign/entitlements/app_sandbox/files_music=0
codesign/entitlements/app_sandbox/files_movies=0
codesign/entitlements/app_sandbox/files_user_selected=0
codesign/entitlements/app_sandbox/helper_executables=[]
codesign/custom_options=PackedStringArray()
notarization/notarization=0
notarization/apple_id_name=""
notarization/apple_id_password=""
notarization/apple_team_id=""
notarization/api_uuid=""
notarization/api_key=""
notarization/api_key_id=""
privacy/microphone_usage_description=""
privacy/microphone_usage_description_localized={}
privacy/camera_usage_description=""
privacy/camera_usage_description_localized={}
privacy/location_usage_description=""
privacy/location_usage_description_localized={}
privacy/address_book_usage_description=""
privacy/address_book_usage_description_localized={}
privacy/calendar_usage_description=""
privacy/calendar_usage_description_localized={}
privacy/photos_library_usage_description=""
privacy/photos_library_usage_description_localized={}
privacy/desktop_folder_usage_description=""
privacy/desktop_folder_usage_description_localized={}
privacy/documents_folder_usage_description=""
privacy/documents_folder_usage_description_localized={}
privacy/downloads_folder_usage_description=""
privacy/downloads_folder_usage_description_localized={}
privacy/network_volumes_usage_description=""
privacy/network_volumes_usage_description_localized={}
privacy/removable_volumes_usage_description=""
privacy/removable_volumes_usage_description_localized={}
privacy/tracking_enabled=false
privacy/tracking_domains=PackedStringArray()
privacy/collected_data=[]
ssh_remote_deploy/enabled=false

[preset.2]
name="Linux/X11"
platform="Linux/X11"
runnable=true
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/linux/CalendarPuzzle.x86_64"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.2.options]
custom_template/debug=""
custom_template/release=""
debug/export_console_wrapper=1
binary_format/embed_pck=false
texture_format/bptc=true
texture_format/s3tc=true
texture_format/etc=false
texture_format/etc2=false
binary_format/architecture="x86_64"
ssh_remote_deploy/enabled=false

[preset.3]
name="Steam Deck"
platform="Linux/X11"
runnable=true
dedicated_server=false
custom_features="steam_deck"
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/deck/CalendarPuzzle.x86_64"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.3.options]
custom_template/debug=""
custom_template/release=""
debug/export_console_wrapper=1
binary_format/embed_pck=false
texture_format/bptc=true
texture_format/s3tc=true
texture_format/etc=false
texture_format/etc2=false
binary_format/architecture="x86_64"
ssh_remote_deploy/enabled=false
```

> **关于 `export_presets.cfg` 是否进 git**：M0 .gitignore 把它排掉了（因含密码字段），但 Mac 不公证（codesign=0、notarization=0），所有 apple_id_password 字段都为空——本 plan **从 .gitignore 移除 export_presets.cfg**，让 4 个 preset 配置进 git，便于团队 / CI 复现。Mac 公证密码改成走脚本环境变量。

- [ ] **Step 4: 从 .gitignore 移除 export_presets.cfg**

```bash
sed -i.bak '/^export_presets\.cfg$/d' .gitignore && rm .gitignore.bak
```

校验：

```bash
git check-ignore -v export_presets.cfg && echo "still ignored — bad" || echo "tracked — good"
```

Expected: `tracked — good`。

- [ ] **Step 5: Commit**

```bash
git add export_presets.cfg .gitignore
git commit -m "build(export): configure 4 export presets (Win/Mac/Linux/SteamDeck)"
```

---

## Task 2 — 写 tools/build_all.sh

**Files:**
- Create: `tools/build_all.sh`

- [ ] **Step 1: 写脚本**

`tools/build_all.sh`:

```bash
#!/usr/bin/env bash
# tools/build_all.sh — 一键构建 4 平台 release 包
# Usage: ./tools/build_all.sh [win|mac|linux|deck|all]
# 输出: build/<platform>/...

set -euo pipefail

PLATFORM="${1:-all}"
GODOT="${GODOT:-godot}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT"

# 清理旧产物
clean_output() {
  local target="$1"
  rm -rf "build/$target"
  mkdir -p "build/$target"
}

# 单个 export
export_target() {
  local preset_name="$1"
  local target_dir="$2"
  local output_path="$3"

  echo "==> exporting $preset_name → $output_path"
  clean_output "$target_dir"

  "$GODOT" --headless --export-release "$preset_name" "$output_path"

  if [ ! -f "$output_path" ] && [ ! -d "$output_path" ]; then
    echo "ERROR: export failed for $preset_name (no output at $output_path)" >&2
    exit 1
  fi
  echo "✓ $preset_name done"
}

# 平台分派
build_win()   { export_target "Windows Desktop" "win"   "build/win/CalendarPuzzle.exe"; }
build_mac()   { export_target "macOS"           "mac"   "build/mac/CalendarPuzzle.zip"; }
build_linux() { export_target "Linux/X11"       "linux" "build/linux/CalendarPuzzle.x86_64"; }
build_deck()  { export_target "Steam Deck"      "deck"  "build/deck/CalendarPuzzle.x86_64"; }

case "$PLATFORM" in
  win)   build_win   ;;
  mac)   build_mac   ;;
  linux) build_linux ;;
  deck)  build_deck  ;;
  all)
    build_win
    build_mac
    build_linux
    build_deck
    ;;
  *)
    echo "Usage: $0 [win|mac|linux|deck|all]" >&2
    exit 2
    ;;
esac

echo ""
echo "===================="
echo "Build complete. Outputs:"
find build -maxdepth 3 -type f \( -name "CalendarPuzzle*" -o -name "*.pck" \) | sort
```

- [ ] **Step 2: 加可执行权限**

```bash
chmod +x tools/build_all.sh
```

- [ ] **Step 3: 本机跑一次（macOS 优先，因为下一步 Task 3 公证依赖它）**

```bash
./tools/build_all.sh mac
```

Expected: 输出含 `✓ macOS done`，`build/mac/CalendarPuzzle.zip` 存在。
注意：第一次跑可能因 `editor 未关` 导致 lock；编辑器关掉再跑。

- [ ] **Step 4: 跑 Linux + Steam Deck（同二进制结构）**

```bash
./tools/build_all.sh linux
./tools/build_all.sh deck
```

Expected: `build/linux/CalendarPuzzle.x86_64` 和 `build/deck/CalendarPuzzle.x86_64` 都存在；大小应基本相同（差异 < 1KB，仅 custom_features 标志）。

- [ ] **Step 5: Win 在 macOS 上 cross-export**

```bash
./tools/build_all.sh win
```

Expected: `build/win/CalendarPuzzle.exe` + `build/win/CalendarPuzzle.pck` 存在。
注意：macOS 上不能签 Win 二进制；玩家在 Win 上首次运行会被 SmartScreen 警告。生产可选加 Authenticode 签名（非本 plan 范围）。

- [ ] **Step 6: Commit**

```bash
git add tools/build_all.sh
git commit -m "build(tools): one-shot build_all.sh for 4 platforms"
```

---

## Task 3 — Apple Developer Program 准备 + 凭证落本机 Keychain

**Files:**
- Create: `docs/MAC_NOTARIZE.md`

> 这一步**有真实金钱成本**（Apple Developer Program $99/年）+ Apple 审核延迟（通常 1-2 天，偶尔卡 1 周）。**M8 第 1 天就开始**，否则 Task 4 公证脚本没法跑。

- [ ] **Step 1: 注册 Apple Developer Program（异步任务）**

浏览器操作：

1. 打开 https://developer.apple.com/programs/enroll/
2. 用 Apple ID 登录（个人开发者就够；不需要 Organization）
3. 付 $99 USD 年费
4. 等 Apple 审核（个人通常 1-2 天，要求身份信息真实）

- [ ] **Step 2: 创建 "Developer ID Application" 证书**

完成注册后：

1. 打开 https://developer.apple.com/account/resources/certificates/list
2. 点 `+` → "Developer ID Application"（**不是** "Apple Development"，那是测试用）
3. 按指引在本机 Keychain Access 生成 CSR 并上传
4. 下载证书 `developerID_application.cer`，双击导入 Keychain Access (login keychain)

校验：

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Expected: 输出形如 `1) <40-char-hash> "Developer ID Application: Your Name (TEAM_ID)"`。

记下 Team ID（括号内 10 位字符串）。

- [ ] **Step 3: 创建 App-Specific Password（用于 notarytool）**

1. 打开 https://appleid.apple.com/account/manage → Sign-In and Security → App-Specific Passwords
2. 点 "Generate Password"，标签填 `calendar-puzzle-notarize`
3. 复制生成的 19 字符密码（形如 `xxxx-xxxx-xxxx-xxxx`）

- [ ] **Step 4: 把凭证存到 Keychain（避免明文进脚本）**

```bash
xcrun notarytool store-credentials "calendar-puzzle-profile" \
  --apple-id "<你的 Apple ID 邮箱>" \
  --team-id "<10 位 Team ID>" \
  --password "<上一步的 App-Specific Password>"
```

Expected: `Profile "calendar-puzzle-profile" stored to keychain.`

之后 notarytool 用 `--keychain-profile calendar-puzzle-profile` 调用，不再需要明文密码。

- [ ] **Step 5: 写 MAC_NOTARIZE.md**

`docs/MAC_NOTARIZE.md`:

```markdown
# macOS 公证流程与排错

## 一次性准备（M8 第 1 天做完）

1. Apple Developer Program — $99/年（https://developer.apple.com/programs/enroll/）
2. 创建 Developer ID Application 证书并导入 Keychain
3. 生成 App-Specific Password（https://appleid.apple.com/）
4. `xcrun notarytool store-credentials calendar-puzzle-profile ...`（凭证存 Keychain，避免明文）
5. 记录 Team ID 到本文档 "凭证信息" 节

## 凭证信息

- Apple ID: <填入>
- Team ID: <10 位 ID，填入>
- Notarization profile name: `calendar-puzzle-profile`
- Signing identity: `Developer ID Application: <Your Name> (<Team ID>)`

## 公证流程（每次发版）

```bash
# 1. 构建未签 Mac build
./tools/build_all.sh mac

# 2. 公证（codesign + submit + staple，一脚本搞定）
./tools/mac_notarize.sh build/mac/CalendarPuzzle.zip
```

## 排错 checklist

| 报错 | 原因 | 解决 |
|---|---|---|
| `Could not find any code object` | zip 里没有 .app | 检查 Godot export 是否成功；解开 zip 看 |
| `The signature of the binary is invalid` | codesign 漏了 --options runtime | 重新 codesign 加 hardened runtime |
| `errSecInternalComponent` | 证书过期 / 已撤销 | Apple Developer 后台重新申请 |
| `Status: Invalid` from notarytool | log 看具体原因 | `xcrun notarytool log <id> --keychain-profile calendar-puzzle-profile` |
| `unable to validate your application` | bundle_identifier 与证书不匹配 | 改 `export_presets.cfg` 的 application/bundle_identifier |
| `not properly signed (deep)` | 内部库 / 资源文件未签 | codesign 用 `--deep --force` |
| stapler `Could not validate ticket` | 公证未真正完成 | notarytool submit 用 `--wait` 等到 Accepted 再 staple |

## 验证已公证 build

```bash
# Gatekeeper 检查
spctl --assess --type execute --verbose build/mac/CalendarPuzzle.app

# 期望输出:
#   build/mac/CalendarPuzzle.app: accepted
#   source=Notarized Developer ID
```

如果输出 `source=Unsigned`，公证失败。

## R3 缓解策略（公证踩坑）

如果 M8 第 1 周公证一直失败，按以下顺序退路：

1. 检查 entitlements 是否冲突（默认空 plist 最简单）
2. 检查 hardened runtime + jit 是否兼容 Godot ScriptServer（jit_allow=true 必须）
3. 实在不通过，**首发砍 macOS**（R3 砍范围预案 #4），Win + Linux + Deck 先上，Mac 1-2 月后 patch 补
```

- [ ] **Step 6: Commit**

```bash
git add docs/MAC_NOTARIZE.md
git commit -m "docs(mac): notarization prep + troubleshooting checklist"
```

---

## Task 4 — 写 tools/mac_notarize.sh

**Files:**
- Create: `tools/mac_notarize.sh`

- [ ] **Step 1: 写脚本**

`tools/mac_notarize.sh`:

```bash
#!/usr/bin/env bash
# tools/mac_notarize.sh — 给 build/mac/CalendarPuzzle.app codesign + notarize + staple
# Usage: ./tools/mac_notarize.sh <path-to-zip-or-app>
# 前置: docs/MAC_NOTARIZE.md 一次性准备已完成

set -euo pipefail

INPUT="${1:-build/mac/CalendarPuzzle.zip}"
PROFILE="${NOTARIZE_PROFILE:-calendar-puzzle-profile}"
IDENTITY="${SIGN_IDENTITY:-}"

if [ -z "$IDENTITY" ]; then
  # 自动找第一个 Developer ID Application 证书
  IDENTITY=$(security find-identity -v -p codesigning | \
             grep "Developer ID Application" | head -1 | \
             sed -E 's/.*"(Developer ID Application: [^"]+)".*/\1/')
  if [ -z "$IDENTITY" ]; then
    echo "ERROR: 找不到 Developer ID Application 证书，先按 docs/MAC_NOTARIZE.md 装" >&2
    exit 1
  fi
fi

echo "Using signing identity: $IDENTITY"
echo "Using notarization profile: $PROFILE"

# 解压 zip 拿 .app
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

if [[ "$INPUT" == *.zip ]]; then
  unzip -q "$INPUT" -d "$WORK_DIR"
  APP_PATH=$(find "$WORK_DIR" -maxdepth 2 -name "*.app" -type d | head -1)
elif [[ "$INPUT" == *.app ]]; then
  cp -R "$INPUT" "$WORK_DIR/"
  APP_PATH="$WORK_DIR/$(basename "$INPUT")"
else
  echo "ERROR: input must be .zip or .app" >&2
  exit 2
fi

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "ERROR: 在 $INPUT 里找不到 .app bundle" >&2
  exit 3
fi

echo "Working on: $APP_PATH"

# 1. codesign with hardened runtime
echo ""
echo "==> Step 1/4: codesign --deep"
codesign --deep --force --verify --verbose \
  --options runtime \
  --sign "$IDENTITY" \
  "$APP_PATH"

# 2. verify codesign
echo ""
echo "==> Step 2/4: verify codesign"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

# 3. 重新打包成 zip 提交公证（notarytool 只接受 zip / dmg / pkg）
SUBMIT_ZIP="$WORK_DIR/CalendarPuzzle.signed.zip"
echo ""
echo "==> Step 3/4: zip for notarization"
( cd "$WORK_DIR" && zip -qr "$SUBMIT_ZIP" "$(basename "$APP_PATH")" )

# 4. submit + wait
echo ""
echo "==> Step 4/4: xcrun notarytool submit --wait"
xcrun notarytool submit "$SUBMIT_ZIP" \
  --keychain-profile "$PROFILE" \
  --wait

# 5. staple ticket
echo ""
echo "==> Stapling ticket"
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"

# 6. 最终 verify
echo ""
echo "==> Gatekeeper assessment"
spctl --assess --type execute --verbose "$APP_PATH"

# 7. 把签好的 .app 拷回输出
FINAL_DIR=$(dirname "$INPUT")
rm -rf "$FINAL_DIR/CalendarPuzzle.app"
cp -R "$APP_PATH" "$FINAL_DIR/"

# 重新生成对外分发 zip（含已 staple 的 .app）
FINAL_ZIP="$FINAL_DIR/CalendarPuzzle.notarized.zip"
( cd "$FINAL_DIR" && zip -qr "$FINAL_ZIP" CalendarPuzzle.app )

echo ""
echo "===================="
echo "✓ Notarization complete"
echo "  .app:  $FINAL_DIR/CalendarPuzzle.app"
echo "  .zip:  $FINAL_ZIP"
```

- [ ] **Step 2: 加可执行权限**

```bash
chmod +x tools/mac_notarize.sh
```

- [ ] **Step 3: 跑一次完整公证流程**

前置：Task 2 已产出 `build/mac/CalendarPuzzle.zip`，Task 3 凭证已就绪。

```bash
./tools/mac_notarize.sh build/mac/CalendarPuzzle.zip
```

Expected:
- 7 个 step 全部 `✓`
- 最末 `spctl` 输出 `source=Notarized Developer ID`
- `build/mac/CalendarPuzzle.app` 和 `build/mac/CalendarPuzzle.notarized.zip` 存在

整个流程时间：codesign < 30s + notarize 提交后 Apple 服务器审核 1-15 分钟 + staple < 10s。**总耗时通常 2-20 分钟**。失败按 docs/MAC_NOTARIZE.md 排错。

- [ ] **Step 4: 在干净 Mac 上验证已公证 build 能正常打开**

把 `CalendarPuzzle.notarized.zip` 传到一台**没装 Developer Tools** 的 Mac（或新建一个 macOS 用户），双击 .app：

Expected: 直接打开游戏，无"未公证" / "open anyway" 弹窗。

如果弹窗，说明公证失败，回 docs/MAC_NOTARIZE.md 排错。

- [ ] **Step 5: Commit**

```bash
git add tools/mac_notarize.sh
git commit -m "build(mac): codesign + notarize + staple in one script"
```

---

## Task 5 — Steam Deck Verified checklist + 实测准备

**Files:**
- Create: `docs/STEAM_DECK_VERIFIED.md`
- Create: `tools/deck_smoke_test.md`

- [ ] **Step 1: 写 STEAM_DECK_VERIFIED.md（申请流程 + Valve 标准 checklist）**

`docs/STEAM_DECK_VERIFIED.md`:

```markdown
# Steam Deck Verified 申请与适配

## 为什么要拿 Verified

- Steam Deck 用户看到 "Verified" 徽章会更愿意买（vs "Playable" / "Unsupported"）
- Deck 商店首页有 Verified 推荐位（流量大）
- 失去 Verified 损失 R2 风险中的主要影响

## Valve Verified 标准（2025 版）

四大类（每类必须全通过）：

### 1. 输入

- [ ] **手柄唯一输入完成所有 UI 操作**：不需要鼠标键盘也能玩完整一局（含设置面板、键位重映射 UI）
- [ ] **不强制弹"请连接控制器"对话框**：Deck 自带手柄
- [ ] **默认手柄映射合理**：摇杆移动、A 确认、B 取消、Start/Select 菜单（Steam Input 已抽象这些 action，本游戏只声明 5 个 abstract action）
- [ ] **键盘弹窗用 Steam 虚拟键盘**：玩家命名存档槽位时调 `Steam.activateGameOverlayInviteDialog()` 的输入版本

### 2. 显示

- [ ] **支持 1280×800 默认分辨率**：Deck 原生分辨率
- [ ] **所有 UI 元素在 1280×800 下不溢出**
- [ ] **文字最小 ≥ 9pt @ 1280×800**：玩家从 ~30cm 距离看 7" 屏要清晰
- [ ] **不强制全屏**：window mode 切换可用
- [ ] **图标 / 按钮 hitbox ≥ 32×32 dp**：手指触屏好按（Deck 触屏可用）

### 3. 系统集成

- [ ] **suspend / resume 不丢档**：Deck 按电源键 sleep → wake 后游戏继续，存档无损
- [ ] **Steam Cloud 同步工作**：M6 已验证
- [ ] **Steam Overlay 可调出**：M0 用 borderless windowed 不阻 overlay
- [ ] **默认音量合理**：BGM 30% / SFX 70%（M9 已设）

### 4. Seamless install

- [ ] **首次安装无 prerequisite 弹窗**（如 .NET / VC++ Redist；Godot 不需要）
- [ ] **二进制大小 < 2GB**（本游戏估 < 100MB）
- [ ] **不需要 root / sudo**

## 实测路径

### 路径 A（首选）：真机

需要自有 Steam Deck 或借一台。手测脚本见 `tools/deck_smoke_test.md`。

### 路径 B（备选）：steamos-devkit + Linux PC

如果没真机，至少能用 Steamos 镜像 + dev kit 跑：

1. 装 SteamOS Linux 虚拟机（Holo 镜像 https://store.steampowered.com/steamos/）
2. 装 `steamos-devkit-client` 推 build 上去测
3. 缺点：缺真触屏 + 真手柄输入；只能测显示与启动

### 路径 C（兜底）：Steam Deck Verified review 提交后看 Valve 反馈

把 build 上传 → Steamworks → Steam Deck Compatibility Review → 提交。Valve QA 团队会在真机上跑 3-7 天给 verdict。

> 即使本地路径 A/B 不可行，路径 C 至少能给到 Valve 反馈，再回头修。**M8 必须至少跑路径 C 一次**。

## 申请流程

1. 上传一个 build 到 Steamworks（M11 可走 beta branch 不影响商店）
2. Steamworks → Deck Compatibility → "Request Deck Verified Review"
3. 填写表单：默认控制器布局、推荐分辨率、已知问题
4. Valve QA 团队跑测，3-7 天给 4 选 1 结果：
   - Verified（✓ 完美）
   - Playable（有些小问题，仍可玩）
   - Unsupported（不能玩）
   - Unknown（未测试）

如果 Playable，看 Valve 反馈逐项修，重新提交。

## 当前状态

- [ ] Deck 实机已就位 / steamos-devkit 已装
- [ ] 16 项标准 checklist 全打勾
- [ ] Steamworks Deck Compatibility Review 已提交
- [ ] Valve verdict 收到（结果：_________）
```

- [ ] **Step 2: 写 deck_smoke_test.md（手测脚本）**

`tools/deck_smoke_test.md`:

```markdown
# Steam Deck 手测脚本

> 装好 build 后**只用手柄**完成全流程，不许碰键鼠 / 触屏（触屏可选最后单独测一遍）。

## 准备

- [ ] Steam Deck 已开机，已登录测试账号
- [ ] 已通过 Steamworks beta branch 装好最新 build
- [ ] 全程录屏（按住 Steam 键 + R1 录制，事后归档 `docs/m8-deck-smoke-<date>.mp4`）

## 流程

### 启动
- [ ] 从 Steam 库点 Calendar Puzzle → Play
- [ ] 5 秒内出 logo / 主菜单
- [ ] 无任何"请连接控制器" / "missing input" 提示

### 教程
- [ ] 主菜单 "教程" 用 D-pad + A 进入
- [ ] 5 步教程能用 A 键推进或 B 键跳过
- [ ] 教程文字 ≥ 9pt（眯眼看不糊）

### 玩 1 局 easy
- [ ] 难度选 easy → 开始
- [ ] 用左摇杆移动光标到方块 → A 拾起
- [ ] 摇杆移动放置 → A 落下
- [ ] RB 旋转 / LB 镜像
- [ ] B 取消 / 移除最后放置块
- [ ] 完成最后一块 → 胜利动画 + 音效

### 手动存档槽
- [ ] 菜单 Y / Start → 开存档面板
- [ ] 选槽 0 → 弹出虚拟键盘填名 → 确认
- [ ] 缩略图 + 名字显示在槽位
- [ ] 退出游戏

### 重启 + reload
- [ ] 退到 Steam 库 → 再次 Play
- [ ] 主菜单 → 存档 → 槽 0 → A 加载
- [ ] 棋盘回到保存时状态

### Suspend / Resume
- [ ] 在游戏内（任意场景）按 Deck 电源键短按 → 进入 sleep
- [ ] 15 秒后再按电源键唤醒
- [ ] 游戏恢复显示，无 crash，无存档损坏（再开存档面板看）

### Steam Overlay
- [ ] 按 Steam 键 → 浮层弹出，覆盖游戏
- [ ] 关闭浮层 → 游戏恢复响应输入

### 退出
- [ ] 主菜单 → 退出 → 回 Steam 库

## 触屏单独测（如时间允许）

- [ ] 教程能用触屏推进
- [ ] 棋盘上能直接点击拾起 / 放置方块
- [ ] 菜单按钮 hitbox 够大（不会误点旁边按钮）

## 阻塞性 bug 处理

任一步骤失败：

1. 录屏标时间戳 + 截图
2. 在 `docs/MULTIPLATFORM_TEST_REPORT.md` 记问题
3. 修复后**重跑整套** smoke test，不能只测改动那一项
```

- [ ] **Step 3: Commit**

```bash
git add docs/STEAM_DECK_VERIFIED.md tools/deck_smoke_test.md
git commit -m "docs(deck): Verified standards + manual smoke test script"
```

---

## Task 6 — 写 test_export_presets.gd（自动校验 4 preset 完整性）

**Files:**
- Create: `tests/test_export_presets.gd`

- [ ] **Step 1: 写测试**

`tests/test_export_presets.gd`:

```gdscript
extends "res://addons/gut/test.gd"

# 解析 export_presets.cfg 校验 4 platform target 都在且配置合理。
# 防止有人误删 / 误改 preset。

const PRESETS_PATH = "res://export_presets.cfg"
const EXPECTED_PRESETS = ["Windows Desktop", "macOS", "Linux/X11", "Steam Deck"]
const MAIN_SCENE = "res://boot/boot.tscn"

func _load_cfg() -> ConfigFile:
    var cfg := ConfigFile.new()
    var err := cfg.load(PRESETS_PATH)
    assert_eq(err, OK, "export_presets.cfg 加载失败")
    return cfg

func test_all_four_presets_present():
    var cfg := _load_cfg()
    var names: Array = []
    for section in cfg.get_sections():
        if section.begins_with("preset.") and not section.contains(".options"):
            names.append(cfg.get_value(section, "name", ""))

    for expected in EXPECTED_PRESETS:
        assert_true(expected in names, "missing preset: %s (found: %s)" % [expected, names])

func test_each_preset_has_export_path():
    var cfg := _load_cfg()
    for section in cfg.get_sections():
        if section.begins_with("preset.") and not section.contains(".options"):
            var name = cfg.get_value(section, "name", "")
            var path = cfg.get_value(section, "export_path", "")
            assert_ne(path, "", "preset %s has empty export_path" % name)
            assert_true(path.begins_with("build/"), "preset %s export_path should start with build/" % name)

func test_steam_deck_uses_linux_x11_platform():
    # Steam Deck preset 复用 Linux/X11 platform
    var cfg := _load_cfg()
    for section in cfg.get_sections():
        if section.begins_with("preset.") and not section.contains(".options"):
            if cfg.get_value(section, "name", "") == "Steam Deck":
                assert_eq(cfg.get_value(section, "platform", ""), "Linux/X11")
                # 必须有 custom_features=steam_deck，game 代码用这个判平台
                var features = cfg.get_value(section, "custom_features", "")
                assert_true("steam_deck" in features, "Steam Deck preset must set custom_features=steam_deck")
                return
    fail_test("Steam Deck preset 找不到")

func test_main_scene_is_boot_tscn():
    # 校验项目主 scene 没被改坏
    var project_cfg := ConfigFile.new()
    project_cfg.load("res://project.godot")
    var main_scene = project_cfg.get_value("application", "run/main_scene", "")
    assert_eq(main_scene, MAIN_SCENE)

func test_mac_preset_codesign_disabled_in_editor():
    # 我们在 tools/mac_notarize.sh 手动签；editor 必须关掉 codesign 否则会卡密码
    var cfg := _load_cfg()
    for section in cfg.get_sections():
        if section.begins_with("preset.") and section.ends_with(".options"):
            var preset_num = section.replace("preset.", "").replace(".options", "")
            var meta_section = "preset.%s" % preset_num
            if cfg.get_value(meta_section, "name", "") == "macOS":
                assert_eq(cfg.get_value(section, "codesign/codesign", 0), 0, \
                    "macOS preset codesign should be 0 (CLI handles it)")
                assert_eq(cfg.get_value(section, "notarization/notarization", 0), 0, \
                    "macOS preset notarization should be 0 (CLI handles it)")
                return
    fail_test("macOS preset 找不到")
```

- [ ] **Step 2: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep -A2 "test_export_presets"
```

Expected: 5 个新测试 PASS（all_four_presets_present / each_preset_has_export_path / steam_deck_uses_linux_x11_platform / main_scene_is_boot_tscn / mac_preset_codesign_disabled_in_editor）。

- [ ] **Step 3: Commit**

```bash
git add tests/test_export_presets.gd
git commit -m "test(export): validate 4 platform presets present + correctly configured"
```

---

## Task 7 — Steamworks 配置 3 个 depot（Win/Mac/Linux+Deck）

**Files:**
- Create: `content_builder/app_build.vdf`
- Create: `content_builder/depot_build_win.vdf`
- Create: `content_builder/depot_build_mac.vdf`
- Create: `content_builder/depot_build_linux.vdf`

> 前置：M0 的 STEAM_SETUP.md 流程已走完，真实 Steam App ID 已拿到。本任务用 `<APP_ID>` 占位。

- [ ] **Step 1: 在 Steamworks portal 创建 3 个 depot**

浏览器操作（https://partner.steamgames.com/apps/landing/<APP_ID>）：

1. 进入 App → "SteamPipe" → "Depots"
2. 已有默认 depot `<APP_ID> + 1`（Win），保留并改名为 "Calendar Puzzle Windows Content"
3. 点 "Add Depot" 两次，创建：
   - `<APP_ID> + 2` → "Calendar Puzzle macOS Content"
   - `<APP_ID> + 3` → "Calendar Puzzle Linux Content"（Linux + Deck 共用）
4. 对每个 depot：
   - **Languages**: All
   - **Optional File Filters**: 留空（直接整目录上）
   - **Operating Systems**: 各 depot 仅勾对应 OS（Windows / macOS / Linux）
5. App → "Installation" → "General Installation"：
   - 把三个 depot 加到 default branch
   - 勾 "Only install on platforms that match the depot OS"

- [ ] **Step 2: 写 app_build.vdf**

`content_builder/app_build.vdf`:

```vdf
"appbuild"
{
    "appid" "<APP_ID>"
    "desc" "Calendar Puzzle release build"
    "buildoutput" "../build/steam_output"
    "contentroot" "../build"
    "setlive" ""
    "preview" "0"
    "local" ""

    "depots"
    {
        "<APP_ID + 1>" "depot_build_win.vdf"
        "<APP_ID + 2>" "depot_build_mac.vdf"
        "<APP_ID + 3>" "depot_build_linux.vdf"
    }
}
```

> 注意:
> - `<APP_ID>` 等占位符要替换为真实数字（如 App ID = 1234567，则 depot 是 1234568 / 1234569 / 1234570）
> - `setlive` 空字符串 = 不自动上 default 分支（手动在 Steamworks 后台点 promote）；上线时改 `"default"` 自动 promote
> - `preview "0"` = 正式上传；改 "1" 测试 vdf 配置不上传

- [ ] **Step 3: 写 depot_build_win.vdf**

`content_builder/depot_build_win.vdf`:

```vdf
"DepotBuildConfig"
{
    "DepotID" "<APP_ID + 1>"
    "ContentRoot" "../build/win"

    "FileMapping"
    {
        "LocalPath" "*"
        "DepotPath" "."
        "recursive" "1"
    }

    "FileExclusion" "*.pdb"
}
```

- [ ] **Step 4: 写 depot_build_mac.vdf**

`content_builder/depot_build_mac.vdf`:

```vdf
"DepotBuildConfig"
{
    "DepotID" "<APP_ID + 2>"
    "ContentRoot" "../build/mac"

    "FileMapping"
    {
        "LocalPath" "CalendarPuzzle.app/*"
        "DepotPath" "CalendarPuzzle.app/"
        "recursive" "1"
    }

    "FileExclusion" "*.zip"
}
```

注意：mac depot 只上传 `CalendarPuzzle.app` 目录（已 notarized），不上 zip。

- [ ] **Step 5: 写 depot_build_linux.vdf（Linux + Deck 共用）**

`content_builder/depot_build_linux.vdf`:

```vdf
"DepotBuildConfig"
{
    "DepotID" "<APP_ID + 3>"
    "ContentRoot" "../build/linux"

    "FileMapping"
    {
        "LocalPath" "*"
        "DepotPath" "."
        "recursive" "1"
    }
}
```

> 注意：Deck 不单独搞 depot，Steam 在 Deck 上跑同 Linux depot。Deck 适配通过游戏内部 `custom_features=steam_deck` 标志运行时判定。

- [ ] **Step 6: 安装 steamcmd 并登录**

macOS:

```bash
brew install steamcmd
steamcmd
# 在 steamcmd 提示符:
# Steam> login <your-steamworks-username>
# (输密码 + Steam Guard 验证码)
# Steam> quit
```

之后 steamcmd 凭证缓存在 `~/Library/Application Support/Steam/`，下次免登录。

- [ ] **Step 7: 上传一次测试 build**

```bash
cd content_builder
steamcmd +login <your-steamworks-username> \
  +run_app_build $(pwd)/app_build.vdf \
  +quit
```

Expected:
- 输出 `Build successful` 后跟一个 BuildID 数字（如 18234567）
- Steamworks portal → App → SteamPipe → Builds → 看到新 build

- [ ] **Step 8: 在 Steamworks portal 把 build promote 到 beta branch**

浏览器操作：

1. App → SteamPipe → Builds → 新 build 行 → "Select an app branch..." → `beta` → "Preview Change"
2. "Set Build Live on Beta"

之后测试账号开 Steam，在 Calendar Puzzle 的属性 → BETAS → 选 beta，下载新 build。

- [ ] **Step 9: Commit**

```bash
git add content_builder/
git commit -m "build(steam): per-platform depot config (Win/Mac/Linux+Deck)"
```

---

## Task 8 — 跨平台手测：在 Win / Mac / Linux 真机走一轮关键路径

**Files:**
- Create: `docs/MULTIPLATFORM_TEST_REPORT.md`

> 这一步是**真机操作**，每平台用 30-60 分钟。如果没原生硬件：
> - Win 没机器：找朋友借 / 用 Bootcamp / Parallels
> - Linux 没机器：Ubuntu 22.04 VM (UTM on Mac / VirtualBox)
> - 三平台都没硬件 = 砍发布平台（影响 R3 应对）

- [ ] **Step 1: 写测试报告模板**

`docs/MULTIPLATFORM_TEST_REPORT.md`:

```markdown
# M8 跨平台手测报告

> 每平台跑同一关键路径：launch → tutorial / skip → play one easy puzzle → win → save manual slot → reload → quit
> 通过 → 打勾 + 写日期 + 写 build SHA
> 失败 → 打 ✗ + 标 issue 编号 + 修复后重测

## 测试矩阵

| 平台 | OS 版本 | 硬件 | Build SHA | 测试日期 | 通过 |
|---|---|---|---|---|---|
| Windows | Win 11 22H2 | <CPU / RAM> | <git short SHA> | <YYYY-MM-DD> | ☐ |
| macOS Intel | macOS 13 | <Mac mini 2018> | <SHA> | <date> | ☐ |
| macOS Apple Silicon | macOS 14 | <M2 Air> | <SHA> | <date> | ☐ |
| Linux | Ubuntu 22.04 | <native or VM> | <SHA> | <date> | ☐ |
| Steam Deck | SteamOS Holo | Deck OLED / LCD | <SHA> | <date> | ☐ |

## 每平台详细 checklist

复制本模板填每平台：

### <平台名>

- [ ] launch — 双击 / Steam 启动 5 秒内出主菜单
- [ ] 主菜单上下导航能用（手柄/键盘/鼠标按平台主输入）
- [ ] 教程进入 → 5 步推进 → 跳过按钮工作
- [ ] 难度选 easy → 进入 play scene
- [ ] 鼠标 / 摇杆拾起一块 → 放置 → 旋转 → 镜像
- [ ] 完成 puzzle → 胜利动画 + 音效
- [ ] 菜单 → 存档 → 槽 0 命名为 "test_<plat>" → 保存
- [ ] 退出游戏（窗口关 / 主菜单退出）
- [ ] 重启游戏 → 主菜单 → 存档 → 槽 0 → 加载
- [ ] 棋盘状态正确还原
- [ ] 退出

记录任何异常（截图存 `docs/m8-<plat>-screenshots/`）。

## 性能基线

- [ ] FPS 在 4 平台都 ≥ 60（Deck 至少 ≥ 30）
- [ ] 启动到主菜单 ≤ 5 秒
- [ ] 存档操作 < 200ms
```

- [ ] **Step 2: Win 测试**

借/搭一台 Win 10 或 11 机器：

1. 把 `build/win/CalendarPuzzle.exe` + `.pck` 拷过去
2. 双击 .exe（SmartScreen 警告 → "More info" → "Run anyway"，首发未签名预期会警告）
3. 走 checklist
4. 在 MULTIPLATFORM_TEST_REPORT.md 打勾 + 填 SHA

- [ ] **Step 3: macOS 测试（Intel + Apple Silicon 各一）**

Apple Silicon（开发机即可）：

1. 双击 Task 4 产出的 `CalendarPuzzle.notarized.zip` → .app 拖到 /Applications
2. 第一次双击 .app 不应弹"未公证"（公证已 staple）
3. 走 checklist

Intel Mac：

1. 找老 Mac mini 或同事借
2. 拷 .app 过去
3. 走 checklist
4. 注意 universal binary 启动可能比 ARM 慢 1-2 秒（Rosetta 缓存预热）

- [ ] **Step 4: Linux 测试**

如果有 Ubuntu 22.04 机器：

1. `chmod +x build/linux/CalendarPuzzle.x86_64`
2. 双击或 `./CalendarPuzzle.x86_64`
3. 检查 Wayland 还是 X11：`echo $XDG_SESSION_TYPE`，X11 应该没问题；Wayland 可能需要 `SDL_VIDEODRIVER=wayland`
4. 走 checklist

如无 Linux 机器，用 VM（macOS 上 UTM + Ubuntu 22.04 ISO，4GB RAM 够）。

- [ ] **Step 5: Steam Deck 测试（按 Task 5 tools/deck_smoke_test.md）**

走完 deck_smoke_test.md 全部 checklist。结果填入本报告。

如无真机：

1. 路径 B（steamos-devkit）跑测试模式
2. 至少跑路径 C：上传 build → Steamworks Deck Compatibility Review 提交

- [ ] **Step 6: Commit 测试报告**

填完报告（即使有平台失败也提交，下一轮修），commit：

```bash
git add docs/MULTIPLATFORM_TEST_REPORT.md docs/m8-*-screenshots/
git commit -m "test(m8): cross-platform smoke test report (round 1)"
```

- [ ] **Step 7: 修复发现的 bug 并回归**

每个失败项：

1. 在 GitHub issue 记
2. 修 code
3. 重新 `tools/build_all.sh` 该平台
4. （Mac 改了重跑 `tools/mac_notarize.sh`）
5. 重传 Steamworks beta depot
6. 在那平台 retest
7. Report 表格那行改 ✗ → ☐ → ✓

阻塞性 bug 必须修完，全部 ✓ 才能进 Task 9。

---

## Task 9 — Steam Deck Verified Review 提交

**Files:**
- Modify: `docs/STEAM_DECK_VERIFIED.md`（更新"当前状态"节）

- [ ] **Step 1: 确认 Task 8 Deck 行已全 ✓**

如果 deck_smoke_test.md 全过，进 Step 2。如果还有项失败，回 Task 8 修。

- [ ] **Step 2: 在 Steamworks portal 提交 Verified Review**

浏览器操作：

1. App → "Steam Deck Compatibility" → "Get Compatibility Review"
2. 填表：
   - Default controller layout: 已配置（默认 + 用户可改）
   - Recommended resolution: 1280×800
   - Text size at 1280×800: ≥ 9pt
   - Known issues: 暂无 / 已知小问题列表
   - Suspend / resume: 支持
3. 提交，等 Valve QA 3-7 天

- [ ] **Step 3: 在 STEAM_DECK_VERIFIED.md 更新状态**

```markdown
## 当前状态

- [x] Deck 实机已就位 / steamos-devkit 已装
- [x] 16 项标准 checklist 全打勾
- [x] Steamworks Deck Compatibility Review 已提交 (<YYYY-MM-DD>)
- [ ] Valve verdict 收到（结果：________）
```

- [ ] **Step 4: Commit**

```bash
git add docs/STEAM_DECK_VERIFIED.md
git commit -m "ops(deck): submit for Steam Deck Verified review"
```

- [ ] **Step 5: 异步等 Valve 反馈**

3-7 天后 Steamworks 通知或邮件给 verdict。

如果 **Verified** ✓：M8 完工。

如果 **Playable**：看具体反馈，回 Task 8 修该项，重测，重提交。

如果 **Unsupported**：罕见；通常是核心适配 bug，必须重新规划修复。

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M8 spec 验收门槛 4 条全部覆盖：
- ✅ Win/Mac/Linux native 都跑 → Task 1 (4 preset) + Task 2 (build_all.sh) + Task 8 (跨平台手测报告)
- ✅ Mac 公证通过 → Task 3 (Apple Dev prep) + Task 4 (mac_notarize.sh) + Task 8 (在干净 Mac 验证)
- ✅ Deck 实机过 Verified → Task 5 (checklist + smoke test) + Task 9 (Verified review 提交)
- ✅ Steamworks 3 depot 分平台 → Task 7 (vdf 配置 + 上传测试)
- ✅ tests/test_export_presets.gd → Task 6

**2. Placeholder scan**: `<APP_ID>` 是用户实际 Steam App ID 占位（M0/M11 流程拿到），是预期填写位；`<Your Name>` / `<Team ID>` 同理是用户身份占位。无残留 TODO。

**3. Type consistency**: build_all.sh 输出路径 `build/<plat>/CalendarPuzzle.<ext>` 在 Task 2 / Task 4 / Task 7 depot vdf 中一致；mac_notarize.sh 输入 `.zip` 或 `.app` 在 Task 4 / Task 8 一致；Steam custom_features `steam_deck` 在 Task 1 Step 3 与 Task 6 test 一致。

**4. Ambiguity**: Apple Developer 注册 + Valve Deck QA 是外部异步流程，不可控时间（注册 1-2 天 / Deck review 3-7 天）；plan 明确标注并放在 Task 3 / Task 9 头部。GodotSteam 在 Win 上 cross-export 不签名是已知限制，文档说清楚（Task 2 Step 5）。

无发现要修。M8 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven）。

并行化建议（每 task 一个 subagent）：

- **Day 1**：Task 1 + Task 3（Apple Dev 注册异步），同一个 session 派两个 agent
- **Day 2-3**：等 Apple Dev 通过 + 跑 Task 2
- **Day 4-5**：Task 4 + Task 5 + Task 6（独立可并行）
- **Day 6-7**：Task 7（Steamworks depot 配置）
- **Day 8-12**：Task 8（4 平台手测）必须串行（一台机器一次）
- **Day 13**：Task 9 提交 Verified review
- **Day 14+**：异步等 Valve 反馈，根据 verdict 决定补丁

整个 M8 走完约 2 周 + Apple/Valve 异步审核 buffer。
