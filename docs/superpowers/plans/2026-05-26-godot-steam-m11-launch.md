# M11 — 上架审核 + 修改 + 发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Steamworks 店面收尾 + 定价 + 评级 + 真 App ID 切换 + 提交 Valve 审核 + 修订一轮拒因 + 选 Tue/Wed 上架，2027 Q1 发布。

**Architecture:** 三条并行线：① 商店页内容完善（描述 / 评级 / tags / 定价）；② 代码侧把 dev 用的 Spacewar App ID 480 换成真 App ID 并 commit 为独立 traceable change；③ 上传 final build (4 平台) + Steam 审核 + 修订循环。最后 launch day 协调 + post-launch 监控 + rollback 预案。

**Tech Stack:** Steamworks portal、SteamCMD、tools/build_all.sh + tools/mac_notarize.sh、Steamworks Analytics dashboard、Twitter / Bilibili / Reddit 公告渠道。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Milestones M11 / § Open questions (价格点) / § Risk R8 (Steam 审核退回)

**Acceptance gates (从 spec 抄):**
- 商店页完整：3 语言描述 (zh-CN / zh-TW / en) + age rating + tags + 截图位置 + trailer
- 价格在 PRICING.md 已记录，Steamworks 已配置 4+ 主要地区
- `STEAM_APP_ID` 已从 480 切到真 App ID，独立 commit 可追溯
- Final build 4 平台齐 (Win/Mac/Linux/Deck) + 已上传到 Steamworks default branch
- Steamworks 审核通过 (3-7 工作日；如退回，修复后重提)
- 2027 Q1 内成功发布（Tue/Wed 黄金日）
- Day-1 到 Day-7 监控 dashboard 已设置 + 每日检查节奏明确
- Rollback 预案 written + 测过 beta-to-default promote 流程

---

## File Structure

本 milestone 创建 / 修改的文件：

```
calendar-puzzle-godot/
├── marketing/
│   ├── PRICING.md                       # 地区价格矩阵
│   ├── STORE_DESCRIPTION.md             # 商店描述三语终稿
│   ├── TAGS_AND_RATING.md               # tags + ESRB/PEGI 问卷答案存档
│   ├── LAUNCH_PLAN.md                   # 上架日协调 + 公告渠道
│   ├── POST_LAUNCH_MONITORING.md        # Day 1-7 dashboard + 检查模板
│   └── ROLLBACK_PLAN.md                 # 紧急 hotfix + rollback 流程
├── boot/platform/
│   └── steam_platform.gd                # 修改：STEAM_APP_ID 切换
├── docs/
│   ├── REJECTION_CHECKLIST.md           # 常见拒因 + 自检 + 修复指南
│   └── RELEASE_RUNBOOK.md               # M11 整轮可重复操作 runbook
├── tests/
│   └── test_final_smoke.gd              # 上架前最终自动化烟测
└── content_builder/
    └── app_build.vdf                    # Modify: setlive 改 "default"
```

---

## Task 1 — 完善 Steamworks 店面：描述 (3 语言) + tags + age rating

**Files:**
- Create: `marketing/STORE_DESCRIPTION.md`
- Create: `marketing/TAGS_AND_RATING.md`

- [ ] **Step 1: 写 STORE_DESCRIPTION.md 三语终稿**

`marketing/STORE_DESCRIPTION.md`:

```markdown
# Steam Store Page Description (final)

> 三语版本；按 Steam 商店字段拆分：Short Description (≤ 300 chars) / About this game (Markdown 富文本)。

## en-US (default)

### Short Description (max 300 chars)

A cozy daily pentomino puzzle. Drop 10 colorful blocks onto an 8×7 calendar grid, leaving today's month, day, and weekday uncovered. 5 difficulties from easy to insomnia. Daily puzzles 2020-2035. 3 visual themes. Steam Cloud. Full controller support.

### About This Game (Markdown)

```markdown
**Calendar Puzzle** is a relaxing daily pentomino challenge.

Each day, you're given a clean 8×7 calendar grid with today's month, day, and weekday marked. Your job: drop all 10 colorful blocks so the only cells left visible are today's. The same puzzle every Tuesday, December 9th — for every Tuesday December 9th from 2020 to 2035.

## Features

- **5 Difficulties** — From a gentle Easy with 3 free cells to the brutal Insomnia mode that demands every move.
- **Daily Puzzles** — Predetermined puzzles for every day from 2020 to 2035. Today's puzzle is the same for everyone. Track your personal best.
- **Calendar Mode** — Pick any past or future date and solve its puzzle.
- **Hints, Not Spoilers** — A gentle weak-hint highlights one playable cell (3 per puzzle; 5 in Insomnia). The board solves itself only if you ask.
- **3 Visual Themes** — Bold default, soft Pastel, focused Mono. All with optional colorblind symbols. Light & dark base themes.
- **Customizable Controls** — Rebind keyboard & mouse. Controller fully supported via Steam Input.
- **Cozy by Design** — Lo-fi BGM, soft SFX, satisfying place animations. No timers. No score chase. Solve when you want.
- **Cross-Device Save** — Steam Cloud sync. Start on PC, finish on Deck.

## Steam Deck Verified

Optimized for handheld. 1280×800 native. Suspend/resume safe.

## Languages

Simplified Chinese · Traditional Chinese · English
```

## zh-CN

### 短简介 (max 300 字符)

每天一道治愈系五连块拼图。把 10 种彩色方块放进 8×7 日历格，恰好露出今天的月/日/星期。5 档难度，从入门到失眠。2020-2035 全年每日一题。3 套视觉皮肤。Steam Cloud 跨设备同步。完整手柄支持。

### 关于本游戏

```markdown
**Calendar Puzzle** 是一款治愈系日历拼图。

每天进入游戏，会看到一张干净的 8×7 日历棋盘，今天的月份、日期、星期会被特殊标记。你的任务：放下全部 10 块彩色方块，恰好只让今天的格子露出来。每年的同一天题目相同——2020 到 2035 年每个 12 月 9 日星期二，都是同一题。

## 特性

- **5 档难度** — 从轻松的 Easy（3 个免费格）到残酷的 Insomnia（每一步都要算）
- **每日一题** — 2020-2035 年每天一题，全球玩家同题。记录个人最佳
- **日历模式** — 任意翻到过去或未来的某一天，解那一天的题
- **温和提示** — 弱提示高亮一个可放置的空格（每题 3 次，失眠 5 次）。不会直接帮你解题
- **3 套皮肤** — 鲜艳的 Default、柔和的 Pastel、专注的 Mono Focus。可选色盲符号。亮色 / 暗色基础主题
- **可自定义按键** — 鼠键随意重映射。手柄通过 Steam Input 完整支持
- **治愈优先** — 轻爵士 BGM、轻柔音效、满足感放置动画。无计时，无强迫，想解就解
- **跨设备存档** — Steam Cloud 同步。在电脑上开局，Deck 上继续

## Steam Deck Verified

为掌机优化。1280×800 原生分辨率。挂起 / 恢复无损存档。

## 语言

简体中文 · 繁体中文 · English
```

## zh-TW

### 短簡介 (max 300 字元)

每天一道治癒系五連塊拼圖。把 10 種彩色方塊放進 8×7 日曆格，恰好露出今天的月/日/星期。5 檔難度，從入門到失眠。2020-2035 全年每日一題。3 套視覺皮膚。Steam Cloud 跨裝置同步。完整手把支援。

### 關於本遊戲

> 翻譯流程：取 zh-CN 版 → OpenCC 简转繁（`opencc -i zh-CN.md -o zh-TW.md -c s2tw`）→ 人工微調术语
>
> 重要术语本地化：
> - 视频 → 影片
> - 默认 → 預設
> - 缓存 → 快取
> - 同步 → 同步（保留）
> - 鼠标 → 滑鼠
> - 信息 → 資訊
> - 集成 → 整合
```

- [ ] **Step 2: 写 TAGS_AND_RATING.md**

`marketing/TAGS_AND_RATING.md`:

```markdown
# Steam Tags & Age Rating

## Steam Tags (按优先级排序，至少 5 个，最多 20 个)

申请添加（Tag → reason）：

1. **Puzzle** — 核心类型
2. **Casual** — 无压力 / 无失败惩罚
3. **Singleplayer** — 唯一玩法
4. **Cozy** — 视觉与音乐定位
5. **Daily** — 每日题机制
6. **Family Friendly** — 0 暴力 / 0 性内容
7. **Relaxing** — BGM + 慢节奏定位
8. **Brain Training** — 实质是空间推理
9. **Logic** — 组合推理本质
10. **Colorful** — 视觉特色
11. **Minimalist** — 极简扁平风格
12. **2D**
13. **Indie**
14. **Steam Achievements**
15. **Steam Cloud**
16. **Full controller support**
17. **Steam Deck Verified** (拿到 Verified 后加)
18. **Multiple Endings** — 不适用 ❌
19. **Card Game** — 不适用 ❌
20. **Roguelike** — 不适用 ❌

## Age Rating

### ESRB (北美)

Self-rating questionnaire 关键回答：

- Animated Blood: No
- Real Blood: No
- Cartoon Violence: No
- Fantasy Violence: No
- Realistic Violence: No
- Sexual Themes: No
- Nudity: No
- Strong Language: No
- Tobacco / Drug / Alcohol References: No
- Gambling: No
- User Interaction (online play): No
- In-Game Purchases (real money): No (Phase 1 无 DLC)

**预期评级**: **ESRB E (Everyone)**

### PEGI (欧洲)

- Violence: No
- Bad Language: No
- Fear: No
- Discrimination: No
- Drugs: No
- Sexual content: No
- Gambling: No
- In-game purchases: No

**预期评级**: **PEGI 3**

### 中国 / GCBP

Steam 国区不需要额外评级（GCBP 改革后 Steam 仍走 Valve 自评级）。

## 提交流程

1. Steamworks → Edit Store Page → "About This Game" → 填三语 Markdown
2. Steamworks → Tags → 申请上面 17 个 (#1-#17)
3. Steamworks → "Age Rating Information" → 填 ESRB + PEGI 问卷
4. 提交，与 store page 一起进入 Valve 审核

预期评级：E / PEGI 3。如果 Valve 给更高评级（罕见），review 实际原因再申诉。
```

- [ ] **Step 3: 浏览器操作上传**

按 STORE_DESCRIPTION.md + TAGS_AND_RATING.md 步骤 1-3 在 Steamworks portal 完成：

- About this game → 三语 Markdown 粘贴
- Short description → 三个语言区分别填
- Tags → 申请 17 个
- Age Rating → 提交 ESRB + PEGI 问卷

- [ ] **Step 4: Commit**

```bash
git add marketing/STORE_DESCRIPTION.md marketing/TAGS_AND_RATING.md
git commit -m "docs(store): final 3-lang descriptions + tags + age rating questionnaire"
```

---

## Task 2 — 定价 + 地区价格矩阵

**Files:**
- Create: `marketing/PRICING.md`

- [ ] **Step 1: 调研竞品定价**

竞品列表 + 在 Steam 当前价：

- A Little to the Left — $14.99 (高端定位)
- Mini Metro — $9.99
- Threes! — $5.99
- Hexcells — $2.99
- Tametsi — $5.99

Calendar Puzzle 定位：cozy + small scope + 单人独立。区间 **$3-7** 合理。Phase 1 无 DLC、首发深度浅，倾向 **$3.99** 入门价 + 后续 Phase 2 DLC 提升 ARPU。

- [ ] **Step 2: 写 PRICING.md**

`marketing/PRICING.md`:

```markdown
# 地区定价矩阵 (final)

> 主价定 **$3.99 USD**。其他地区按 Steam Pricing Tool 推荐 + 本地化调整。

## 主要地区

| 地区 | 货币 | 价格 | 备注 |
|---|---|---|---|
| United States | USD | $3.99 | 主价 |
| China | CNY | ¥18.00 | Steam 国区，按 RMB tier 18 |
| European Union | EUR | €3.99 | 与 USD 同 tier |
| United Kingdom | GBP | £2.99 | 略低，UK 玩家敏感 |
| Japan | JPY | ¥520 | 按 Steam JP tier |
| Korea | KRW | ₩5500 | 按 Steam KR tier |
| Russia | RUB | ₽179 | Steam 推荐 |
| Brazil | BRL | R$14.99 | Steam 推荐，区域低 |
| Turkey | TRY | ₺49.99 | Steam 推荐 |
| India | INR | ₹165 | Steam 推荐 |
| Australia | AUD | A$5.95 | Steam 推荐 |
| Canada | CAD | C$5.25 | Steam 推荐 |
| Argentina | ARS | (按 USD 自动换算) | |
| Mexico | MXN | (按 USD 自动换算) | |

## 启动周优惠

- **首发 10% 折扣**：Launch Discount Steam 自动支持，配置为 `discount: 10%`，duration: 1 week
  - 实际售价：$3.59 USD / ¥16 CNY / €3.59 EUR
- 玩家心理上 launch discount + 新品推荐位 = 销量峰值

## Steamworks 配置流程

1. Steamworks → App → "Edit Pricing" → 输入 USD $3.99
2. Steam 自动按 tier 表生成各国推荐价
3. 手工微调上面表格中的 GBP / CNY / 等关键地区
4. 设 launch discount: 10% / 7 days, starts on launch day

## 长尾价 (post-launch)

- 大型 Sale (Summer / Winter / Autumn / Lunar)：再 −20% (总 30% off)
- 周中常态价不变
- Phase 2 DLC 上市时主游戏永久 −10% 推流

## 替代方案 (R7 应对)

如果 Beta 反馈"内容深度撑不起 $3.99"：
- 砍价到 $2.99，靠走量
- 加入 "Day-1 bundle" with 某独立游戏（Steam Curator partnership）

如果反馈"完成度高，可以再贵"：
- 上调 $4.99，但首发后调价 Steam 会 cooldown 30 天再可买（影响销量），慎重
```

- [ ] **Step 3: 在 Steamworks portal 配置价格**

浏览器操作：

1. App → Edit Pricing
2. USD: 3.99
3. 让 Steam 自动按 tier 算其他地区，然后手工核对上表中的关键地区
4. 配置 Launch Discount: 10% / 7 days, applied to base price

- [ ] **Step 4: Commit**

```bash
git add marketing/PRICING.md
git commit -m "docs(pricing): regional price matrix + launch discount strategy"
```

---

## Task 3 — 替换 Spacewar App ID 480 → 真 App ID (独立 traceable commit)

**Files:**
- Modify: `boot/platform/steam_platform.gd`
- Modify: `content_builder/app_build.vdf`
- Modify: `content_builder/depot_build_*.vdf` (3 个)
- Create: `steam_appid.txt`（仅本地，gitignored）

> 这一步 spec 要求**单独 commit**，便于上架 hotfix / rollback 时一眼看到这是关键 traceability commit。

- [ ] **Step 1: 从 docs/STEAM_SETUP.md 确认拿到的真 App ID**

```bash
grep "App ID 已分配" docs/STEAM_SETUP.md
```

Expected: 看到 6-7 位数字（如 `2812345`）。

如果还没拿到，回 M0 docs/STEAM_SETUP.md 完成 Steam Direct Fee + App ID 申请流程。本 Task 阻塞在 App ID。

- [ ] **Step 2: 改 steam_platform.gd**

`boot/platform/steam_platform.gd` 修改：

```gdscript
# 把
const STEAM_APP_ID = 480  # Valve 公共测试 App ID (Spacewar)。M11 上架前换真 App ID。

# 改成（替换 <REAL_APP_ID> 为真 ID）
const STEAM_APP_ID = <REAL_APP_ID>  # Calendar Puzzle, 拿到于 <YYYY-MM-DD>
```

校验：

```bash
grep "STEAM_APP_ID" boot/platform/steam_platform.gd
```

Expected: 不再含 `480`。

- [ ] **Step 3: 改 steam_appid.txt（本地用，gitignored）**

```bash
echo "<REAL_APP_ID>" > steam_appid.txt
```

校验：

```bash
cat steam_appid.txt
git check-ignore steam_appid.txt && echo "ignored ✓"
```

- [ ] **Step 4: 改 content_builder/*.vdf 中的 App ID 占位符**

`content_builder/app_build.vdf` 把 `<APP_ID>` 全部替换为真 ID：

```vdf
"appbuild"
{
    "appid" "<REAL_APP_ID>"          # 真 ID
    "desc" "Calendar Puzzle release build"
    ...
    "depots"
    {
        "<REAL_APP_ID + 1>" "depot_build_win.vdf"
        "<REAL_APP_ID + 2>" "depot_build_mac.vdf"
        "<REAL_APP_ID + 3>" "depot_build_linux.vdf"
    }
}
```

同理 `depot_build_win.vdf` / `depot_build_mac.vdf` / `depot_build_linux.vdf` 把 `<APP_ID + N>` 替换。

校验：

```bash
grep -r "<APP_ID" content_builder/ && echo "STILL HAS PLACEHOLDER — BAD" || echo "all replaced ✓"
```

- [ ] **Step 5: 在 Steam 客户端运行验证真 App ID 能 init**

1. 关 Godot 编辑器
2. 启动 Steam 客户端并登录
3. `godot` 启动游戏
4. 看 console 日志：

Expected:
```
[SteamPlatform] initialized OK, user_id=765611980XXXXXXXX
```

如果 init 失败：
- 检查 steam_appid.txt 在仓库根（与 project.godot 同级）
- 检查 Steam 客户端是否运行
- 检查 App ID 是否打错（一位数差就 init 失败）

- [ ] **Step 6: Commit (独立 commit, 不带其他改动)**

```bash
git add boot/platform/steam_platform.gd content_builder/
git commit -m "release: switch STEAM_APP_ID from Spacewar 480 to real App ID

Replaces test App ID 480 (Valve Spacewar) with the real
Calendar Puzzle App ID acquired via Steam Direct Fee. Updates
all depot vdf configs in sync.

Steam init verified locally with real App ID at <YYYY-MM-DD>.
"
```

> **重要**：commit message 单独标注真 App ID 的获取日期 + 验证状态。这是上架后 hotfix 回溯关键 commit。

---

## Task 4 — 构建 + 公证 + 上传 final release builds (4 平台)

**Files:**
- 无新代码；纯执行已有脚本 + Steamworks 上传

- [ ] **Step 1: clean working tree + 确认 main 分支绿**

```bash
git status
godot --headless --script tests/run_tests.gd 2>&1 | tail -5
```

Expected: working tree clean，所有测试 PASS。

如果测试红，**禁止继续**，回查 M10 是否引入回归。

- [ ] **Step 2: 在 macOS 本机构建 4 平台**

```bash
./tools/build_all.sh all
```

Expected:
```
✓ Windows Desktop done
✓ macOS done
✓ Linux/X11 done
✓ Steam Deck done
```

校验产物：

```bash
ls -lh build/win/CalendarPuzzle.exe build/win/CalendarPuzzle.pck
ls -lh build/mac/CalendarPuzzle.zip
ls -lh build/linux/CalendarPuzzle.x86_64 build/linux/CalendarPuzzle.pck
ls -lh build/deck/CalendarPuzzle.x86_64 build/deck/CalendarPuzzle.pck
```

每个文件应存在且非空。

- [ ] **Step 3: macOS 公证**

```bash
./tools/mac_notarize.sh build/mac/CalendarPuzzle.zip
```

Expected: 7 step 全 ✓，最末 `spctl` 输出 `source=Notarized Developer ID`。

时长：codesign 30s + notarytool wait 5-15 分钟 + staple < 10s。

如失败，查 docs/MAC_NOTARIZE.md 排错。

- [ ] **Step 4: 修改 app_build.vdf 让 setlive = "default"**

`content_builder/app_build.vdf`:

```vdf
"setlive" "default"   ; 改自 ""，自动 promote 到 default branch
"preview" "0"
```

> ⚠️ 这是个**有意识的决定**。设 `"default"` 后上传立即对所有玩家可见（如果 store page 已发布）。
> 实际上架前可以先用 `"beta"` 上传到 beta branch，最后一刻才 `"default"` promote。
> 本 Task 走"上传到 default 分支但 store page 暂未 release"路径——Steam 审核期间玩家看不到。

- [ ] **Step 5: 上传到 Steamworks**

```bash
cd content_builder
steamcmd +login <your-steamworks-username> \
  +run_app_build $(pwd)/app_build.vdf \
  +quit
```

Expected: `Build successful, BuildID <number>`。

时长：取决于网速，4 平台 ~50MB total，5-15 分钟。

- [ ] **Step 6: 在 Steamworks portal 校验 build 上线**

浏览器操作：

1. App → SteamPipe → Builds → 看到新 BuildID
2. 该 build 行的 "Live Branches" 列应显示 `default`（如果 Step 4 设了 default）
3. 三个 depot 应都包含在这个 build 里

如果某 depot 缺失，回 Task 7 检查 vdf 配置。

- [ ] **Step 7: 自己用 Steam 客户端下载 + 试玩**

1. 退出开发用 Steam 账号，登录普通玩家账号（如果有）
2. 该账号需要持有 key（M10 Task 9 Step 2 生成的多余 key 给自己一个）
3. Steam → Activate Product → 输 key
4. 库里下载 Calendar Puzzle
5. 走一遍 5 步关键路径：launch → 教程 / skip → easy 一局 → 胜利 → 退出
6. **没问题再进 Task 5 审核提交**

如果有阻塞 bug，必须修 → 跳回 Step 1 重建上传。

- [ ] **Step 8: 回切 app_build.vdf 的 setlive 为空（保护性）**

防止下次手滑跑 `tools/build_all.sh` 直接上 default 分支：

`content_builder/app_build.vdf`:

```vdf
"setlive" ""      ; 改回空，下次手动 promote 才上线
```

- [ ] **Step 9: Commit (不含 build/ 产物，已 gitignored)**

```bash
git add content_builder/app_build.vdf
git commit -m "release: upload final 4-platform build to default branch (BuildID <X>)"
```

---

## Task 5 — 提交 Steam Review

**Files:**
- 无新文件（浏览器操作）

- [ ] **Step 1: 自检 store page 最后一遍**

浏览器操作 (Steamworks → App → Edit Store Page → Preview Store Page)：

- [ ] Header capsule / Main capsule / Small capsule 全部正确
- [ ] Library Hero 在 1840×620 安全区无遮挡
- [ ] 8+ 张截图全部 1920×1080，清晰
- [ ] 宣传片自动播放，第 5 秒已展示玩法
- [ ] 三语 About this game 全部填好
- [ ] Tags ≥ 5 个已申请
- [ ] Age Rating ESRB + PEGI 问卷已交
- [ ] Pricing 4+ 主要地区已设
- [ ] System Requirements 已填（Win 10+, macOS 10.12+, Ubuntu 22.04+, 2GB RAM, 200MB disk）
- [ ] Languages 列表标记 zh-CN / zh-TW / en
- [ ] Coming Soon date 设到目标日（先模糊一点 "Q1 2027"）
- [ ] Steam Cloud / Achievements / Cloud Save / Controller support feature tags 都打了 ✓
- [ ] Privacy Policy 链接 / EULA（如有）已填

- [ ] **Step 2: 在 Steamworks 提交 Publish Review**

浏览器操作：

1. App → "Publish" tab → "Review Status"
2. 看到 "Ready to Publish" checklist；点击 "Move to Public"
3. Valve 会触发自动检查，列出 missing items
4. 修缺失项后再点 "Move to Public"
5. Valve 显示 "Submitted, estimated review time 3-7 business days"

- [ ] **Step 3: 在 RELEASE_RUNBOOK.md 记提交日**

下一步 Task 6 创建 RELEASE_RUNBOOK.md；现在先记个提交日：

```bash
# 临时记到 PROGRESS / claude-progress 都行
date '+%Y-%m-%d' > /tmp/m11_review_submitted.txt
```

- [ ] **Step 4: 等 Valve 反馈（异步）**

Valve 通常 3-7 工作日反馈：

- **Approved**: Steamworks portal 邮件 + 状态变 "Ready to Release". 直接进 Task 8 launch 流程
- **Rejected**: 邮件列具体 issue. 进 Task 6 处理

---

## Task 6 — 拒因清单 + 修复 runbook

**Files:**
- Create: `docs/REJECTION_CHECKLIST.md`
- Create: `docs/RELEASE_RUNBOOK.md`

> 提前写好，避免 Valve 反馈后手忙脚乱。

- [ ] **Step 1: 写 REJECTION_CHECKLIST.md**

`docs/REJECTION_CHECKLIST.md`:

```markdown
# Steam 审核常见拒因 + 修复指南

## 一、App 启动崩溃 (最常见, ~20% 拒因)

### 现象
Valve QA 在 Win / Mac / Linux 任一平台 launch 失败。

### 自检
M11 Task 4 Step 7 已经在自己账号上跑过 launch。但 Valve 用干净 VM/容器，环境差异可能暴露问题。

修复：
1. 在干净 VM 跑 launch（Win 10/11 / macOS 13 / Ubuntu 22.04）
2. 看 `~/.local/share/godot/app_userdata/<game>/logs/godot.log` 找 crash
3. 常见原因：
   - 缺失 .pck (export 漏了)
   - cloud save 写权限被 Sandbox 拒（macOS）
   - 字体路径硬编码（Linux 路径区分大小写）

## 二、缺成就图标 (~10% 拒因)

### 现象
Valve QA："Achievement 'achievement_id' is set up but has no icon"

### 自检
```bash
# 提交前在 Steamworks 检查 20 成就每个有 icon
# Steam → App → Achievements → 每个成就右上角 icon 必须有
```

修复：
1. 在 Steamworks → Stats and Achievements → 缺失 icon 的成就行 → 上传 64×64 png
2. 重新提交审核

## 三、Library Hero 尺寸错 (~10% 拒因)

### 现象
"Library Hero must be exactly 3840×1240"

### 自检
```bash
file marketing/capsules/png/library_hero.png
```

期望: `3840 x 1240`

修复：
1. 重新跑 `tools/render_capsules.sh` 看 library_hero 输出
2. 如果 Chrome headless 给了错误尺寸，用 Cmd+Shift+P "Capture full size screenshot" 手测
3. 重传到 Steamworks

## 四、Description / Disclaimer 问题 (~5% 拒因)

### 现象
- 用了 "best" / "ultimate" / 比较性形容词被 Valve 拒
- 第三方品牌名 (e.g. "iPad", "Apple") 没加 ™
- 涉嫌 misleading claim

### 自检
review 三语 description，检查：
- 无 "best" / "greatest" / "perfect" / "ultimate"
- 无比较性 "better than X"
- 无未授权使用 trademark

修复：
- 改 description 用 neutral language
- 提及第三方时加 ™ 或省略

## 五、System Requirement 不真实 (~3% 拒因)

### 现象
"Your game requires 8GB RAM but System Requirements say 2GB"

### 自检
本游戏实际 ~200MB RAM 跑，2GB 标完全 OK。

修复：如有矛盾，按实测调标。

## 六、缺 Privacy Policy / EULA (新 dev 常见)

### 现象
"Your app collects user data but no Privacy Policy is linked"

### 自检
本游戏只用 Steam SDK，不自己采集任何额外数据。但 Steam 还是要求声明。

修复：
- 简单 Privacy Policy 模板：https://github.com/nipunabhat/template-privacy-policy
- 托管到 GitHub Pages / 个人站点
- 在 Steamworks → Edit Store Page → Footer → Privacy Policy URL 填上

## 七、Crash on Achievement Unlock (低频但讨厌)

### 现象
玩到某 achievement 触发时 crash。

修复：
- M6 接 Steam achievement 时 wrap try/catch
- 验证 Steamworks portal 所有 20 个 achievement ID 与代码 `unlock_achievement("...")` 完全一致

## 拒因处理流程

1. 收到 Valve 邮件 / Steamworks 通知 → 截图存 `docs/rejections/<date>.md`
2. 按上面 checklist 分类
3. 修复（每条修复都 commit + push）
4. 在 Steamworks 回复 reviewer 说明已修
5. 重新点 "Move to Public" 提交
6. 等再次 review

**M11 buffer 1.5-2 周** 假设 1-2 轮拒因 + 修复。
```

- [ ] **Step 2: 写 RELEASE_RUNBOOK.md (M11 整轮可重复操作)**

`docs/RELEASE_RUNBOOK.md`:

```markdown
# Calendar Puzzle Release Runbook

> 每次 release（首发 + hotfix + DLC）都按此 runbook 走。

## 阶段 A：构建

```bash
# 1. 拉最新 main
git checkout main && git pull

# 2. 跑测试
godot --headless --script tests/run_tests.gd

# 3. 构建 4 平台
./tools/build_all.sh all

# 4. macOS 公证
./tools/mac_notarize.sh build/mac/CalendarPuzzle.zip
```

## 阶段 B：上传

```bash
# 1. 确认 app_build.vdf setlive 设置
#    - 测试 build: setlive ""
#    - 正式 release: setlive "default"

# 2. 上传
cd content_builder
steamcmd +login <user> +run_app_build $(pwd)/app_build.vdf +quit

# 3. 校验 Steamworks portal builds 列表
```

## 阶段 C：自验

```bash
# 1. 用普通账号下载（用预留 key 之一）
# 2. 跑 5 步 smoke test:
#    - launch
#    - tutorial / skip
#    - play easy puzzle
#    - win
#    - quit
# 3. 全部通过才进阶段 D
```

## 阶段 D：审核（仅首发 + 大版本）

1. Steamworks → Publish → Submit for Review
2. 等 3-7 工作日
3. 收到 verdict
4. Approved → 进阶段 E
5. Rejected → 看 docs/REJECTION_CHECKLIST.md 修，回阶段 A

## 阶段 E：发布日

1. 选 Tuesday / Wednesday 早 10:00 PT （Steam 黄金时段）
2. 提前 24h Twitter / Bilibili / r/IndieDev 预热
3. 当天 Steamworks → "Release App" 按钮（一次性，慎按）
4. Store page 自动从 "Coming Soon" 切到 "Available"
5. Launch discount 自动激活
6. 发上线公告：Twitter / Bilibili / r/IndieDev / r/godot / 个人公众号

## 阶段 F：post-launch monitoring (Day 1-7)

每天检查 docs/POST_LAUNCH_MONITORING.md 的指标。

## 阶段 G：hotfix (如需要)

```bash
git checkout -b hotfix/<issue> main
# 修 bug
git commit ...
git checkout main && git merge hotfix/<issue>

# 走阶段 A → B（setlive 设 "beta" 不直接覆盖正式）
# 在 beta branch 自测过再 Steamworks portal promote beta → default
```

详见 docs/ROLLBACK_PLAN.md。
```

- [ ] **Step 3: Commit**

```bash
git add docs/REJECTION_CHECKLIST.md docs/RELEASE_RUNBOOK.md
git commit -m "docs(release): rejection checklist + release runbook"
```

---

## Task 7 — Final smoke test (代码自动化最末一道关卡)

**Files:**
- Create: `tests/test_final_smoke.gd`

- [ ] **Step 1: 写自动化 smoke test**

`tests/test_final_smoke.gd`:

```gdscript
extends "res://addons/gut/test.gd"

# Final smoke test — 上架前最末一次自动校验。
# 任意失败都阻塞 release。

func test_steam_app_id_is_not_spacewar():
    var SteamPlatform = preload("res://boot/platform/steam_platform.gd")
    assert_ne(SteamPlatform.STEAM_APP_ID, 480, \
        "STEAM_APP_ID 仍为 480 (Spacewar 测试 ID)，必须换成真 App ID 才能发布")

func test_steam_app_id_is_reasonable():
    var SteamPlatform = preload("res://boot/platform/steam_platform.gd")
    # 真 App ID 通常 7 位数字，> 1_000_000
    assert_gt(SteamPlatform.STEAM_APP_ID, 1_000_000, \
        "App ID 看起来不像真实 App ID")

func test_all_capsules_exist():
    var required = [
        "small_capsule", "main_capsule", "header_capsule",
        "library_capsule", "library_hero", "library_logo",
        "community_icon",
    ]
    for name in required:
        var path = "res://marketing/capsules/png/" + name + ".png"
        assert_true(ResourceLoader.exists(path), "缺 capsule: " + path)

func test_all_screenshots_exist_and_correct_size():
    var dir = DirAccess.open("res://marketing/screenshots/")
    assert_not_null(dir, "marketing/screenshots/ 不存在")
    dir.list_dir_begin()
    var count = 0
    var name = dir.get_next()
    while name != "":
        if name.ends_with(".png"):
            count += 1
            var img = Image.new()
            img.load("res://marketing/screenshots/" + name)
            assert_eq(img.get_width(), 1920, "%s width != 1920" % name)
            assert_eq(img.get_height(), 1080, "%s height != 1080" % name)
        name = dir.get_next()
    assert_gte(count, 8, "至少 8 张截图，实际 %d" % count)

func test_trailer_exists():
    var path = "res://marketing/trailer/calendar-puzzle-trailer.mp4"
    assert_true(ResourceLoader.exists(path) or FileAccess.file_exists(path), \
        "宣传片缺失: " + path)

func test_all_skins_loadable():
    var sm = get_node("/root/SkinManager")
    assert_eq(sm.list_skins().size(), 3, "3 个皮肤必须齐")

func test_audio_files_present():
    # 12 个 ogg
    var bgm_count = 0
    var sfx_count = 0
    var bgm_dir = DirAccess.open("res://games/calendar_puzzle/assets/bgm/")
    if bgm_dir:
        bgm_dir.list_dir_begin()
        var n = bgm_dir.get_next()
        while n != "":
            if n.ends_with(".ogg"): bgm_count += 1
            n = bgm_dir.get_next()
    var sfx_dir = DirAccess.open("res://games/calendar_puzzle/assets/sfx/")
    if sfx_dir:
        sfx_dir.list_dir_begin()
        var n = sfx_dir.get_next()
        while n != "":
            if n.ends_with(".ogg"): sfx_count += 1
            n = sfx_dir.get_next()
    assert_eq(bgm_count, 2, "BGM 必须 2 个")
    assert_eq(sfx_count, 10, "SFX 必须 10 个")

func test_three_translations_present():
    for locale in ["zh_CN", "zh_TW", "en"]:
        var path = "res://translations/" + locale + ".po"
        assert_true(ResourceLoader.exists(path) or FileAccess.file_exists(path), \
            "缺翻译: " + path)
```

- [ ] **Step 2: 跑 final smoke**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep test_final_smoke
```

Expected: 8 个测试 PASS。

> 任一红，**阻塞 release**。回前面 Task 修。

- [ ] **Step 3: Commit**

```bash
git add tests/test_final_smoke.gd
git commit -m "test(release): final pre-launch smoke test (capsules/screenshots/trailer/etc)"
```

---

## Task 8 — Launch day 执行 + 协调公告

**Files:**
- Create: `marketing/LAUNCH_PLAN.md`

> 这一步在 Steam Review approved + Task 4 Step 8 setlive 切到 "default" 之后才能开始。
> 推荐选 **Tuesday 或 Wednesday 10:00 PT**（Steam 历史最佳上架时段；周一周五避开）。

- [ ] **Step 1: 写 LAUNCH_PLAN.md**

`marketing/LAUNCH_PLAN.md`:

```markdown
# Calendar Puzzle Launch Plan

## 选日

预定日: **2027-XX-XX (Tuesday)** at **10:00 PT (18:00 UTC)**

理由：
- Steam Top Sellers / New Releases 算法看 24h 销量；早 10 PT 抓全球玩家苏醒峰值
- 避开 周一（Indie 拥堵）+ 周五（大厂 AAA 发布）
- 避开 Steam Summer / Winter Sale 周（会被 sale 流量压制）

## T-7 days

- [ ] 在 Steamworks 设 "Release Date" 为正式日 + 时间
- [ ] 发预热推文（Twitter / Bilibili / 个人公众号）：
  > "Calendar Puzzle is coming to Steam next Tuesday! A cozy daily pentomino. <screenshot> <wishlist link>"
- [ ] r/IndieDev / r/godot 各发 1 个 "Coming Soon" post（含 wishlist link）

## T-1 day

- [ ] 跑 docs/RELEASE_RUNBOOK.md 阶段 A-C 最末一次
- [ ] 确认 Steamworks default branch build 是 Task 4 上传的 final BuildID
- [ ] 准备 launch tweet / 公众号文 / Bilibili 视频上传（不发，保存草稿）
- [ ] 通知 Playtest 玩家 "感谢测试，明天上架，记得留个 review!"
- [ ] 设手机闹钟 launch 时刻 -15 分钟

## Launch day T+0 (Tue 10:00 PT)

10:00 PT：
- [ ] Steamworks → "Release App" 按钮 (一次性操作)
- [ ] 确认 store page 从 "Coming Soon" → "Available" 切换
- [ ] 浏览器开 store page 看 launch discount 有显示 −10%

10:00-10:30 PT：
- [ ] 同步推送 launch 公告：
  - Twitter: "🎉 Calendar Puzzle is now live on Steam! <link> <screenshot>"
  - Bilibili: 发 30s 宣传片 + 文案
  - 个人公众号: 长文（含截图 + 开发故事）
  - r/IndieDev: launch thread
  - r/godot: launch thread
  - Discord (Godot 中文 / Indie 中文): 跨发

10:30 PT 之后：
- [ ] 在 r/IndieDev / r/godot 等回评论
- [ ] 监控 Twitter / Discord 提及

## Launch + 24h checklist

- [ ] Steamworks Analytics → 首日 wishlist conversion 检查
- [ ] Steam Charts (steamdb.info) → 看 Player Count
- [ ] Steam Reviews → 看是否有差评 + 内容
- [ ] 邮件 + Steamworks Inbox → 看 Valve 有无问题反馈

## 数据基线 (估)

参考 Indie / Puzzle 类目均值：
- Day 1 wishlist conversion: 8-15%
- Day 1 sales (有 2-3k wishlist): 200-400 copies
- Day 1 reviews: 5-15 条（5-10 wishlist 转 1 review）
```

- [ ] **Step 2: 预热阶段执行 (T-7 days 起)**

实际操作按 LAUNCH_PLAN.md T-7 / T-1 / T+0 时间线执行。

- [ ] **Step 3: Launch day 执行**

按 T+0 的 10:00 PT 操作清单做。

> ⚠️ Steamworks "Release App" 按钮一旦点了**不可撤回**。提前 24h 在 docs/RELEASE_RUNBOOK.md 阶段 A-C 跑一遍，确认无问题再点。

- [ ] **Step 4: 在 Task 9 创建的 POST_LAUNCH_MONITORING.md 开始 daily check**

- [ ] **Step 5: Commit**

```bash
git add marketing/LAUNCH_PLAN.md
git commit -m "ops(launch): release-day timeline + announcement channels"
```

---

## Task 9 — Post-launch 监控 + 应急 Rollback Plan

**Files:**
- Create: `marketing/POST_LAUNCH_MONITORING.md`
- Create: `marketing/ROLLBACK_PLAN.md`

- [ ] **Step 1: 写 POST_LAUNCH_MONITORING.md**

`marketing/POST_LAUNCH_MONITORING.md`:

```markdown
# Post-Launch Monitoring (Day 1-7)

## Daily 检查 (每天同一时刻, e.g. 早 9:00)

### Steamworks Analytics Dashboard

打开 https://partner.steamgames.com/apps/landing/<APP_ID>

| 指标 | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|---|---|---|---|---|---|---|---|
| Store page visits | | | | | | | |
| Wishlist additions | | | | | | | |
| Wishlist → purchase conversion | | | | | | | |
| Units sold | | | | | | | |
| Revenue (gross) | | | | | | | |
| Avg playtime | | | | | | | |
| Refund rate | | | | | | | |
| Reviews (positive / negative) | | | | | | | |

### Steam Reviews (内容)

每天读所有新 review，分类：

- 5 star: 喜欢什么？
- 4 star: 还差什么？
- 3 star: 抱怨什么？
- 2/1 star: bug / 退款风险

特别看：
- 重复出现的 bug
- 重复出现的 feature request
- Steam Deck 玩家反馈（影响 Verified 维持）

### Crash Reports

Steamworks → App → Tools → Watchdog → Crash Reports

如果 day 1 出现 > 10 个 crash：
- 看 stack trace 找共同点
- 进 Task 10 启动 hotfix 流程

### Social Monitoring

- Twitter 搜 "Calendar Puzzle game" → 看玩家提及
- Reddit r/IndieDev / r/godot launch thread → 回复
- Discord 跨服 ping → 收 informal 反馈

## 应对 trigger

### Day 1: 若 wishlist conversion < 5%

- 看 capsule / trailer 是否 thumbnail 期吸引力差
- 可能需要换 main capsule 文案

### Day 3: 若 negative reviews > 30%

- 内容看是否集中 bug
- 启动 hotfix sprint（Task 10）

### Day 7: 若 sales < 100 units (假设 wishlist 1k+)

- store page CTR 或转化率有结构问题
- 等大型 Sale 季再看

## 周报模板

每周日总结一份，存 `marketing/post_launch_weekly/week_<N>.md`：

- 本周总销量 / 周环比
- Top 3 reviews（含原文）
- 修了哪些 bug
- 下周计划
```

- [ ] **Step 2: 写 ROLLBACK_PLAN.md**

`marketing/ROLLBACK_PLAN.md`:

```markdown
# Rollback / Hotfix Plan

## 触发条件

Day 1-3 任何一项命中 → 启动 hotfix：

- App 启动 crash 在某平台 > 10% 玩家
- 存档损坏 / 丢失报告 > 5 条
- 重大功能完全坏（比如教程过不去）

## Hotfix 流程 (目标 24h 内 rollout)

### Step 1: 准备 hotfix 分支

```bash
git checkout main && git pull
git checkout -b hotfix/<short-desc>
# 修 bug
git commit ...
git push origin hotfix/<short-desc>
```

### Step 2: 构建 + 上传到 beta branch

修改 `content_builder/app_build.vdf`:

```vdf
"setlive" "beta"   ; 不直接覆盖 default
```

然后：

```bash
./tools/build_all.sh all
./tools/mac_notarize.sh build/mac/CalendarPuzzle.zip
cd content_builder
steamcmd +login <user> +run_app_build $(pwd)/app_build.vdf +quit
```

### Step 3: 自测 beta build

1. 自己 Steam 客户端切到 beta branch（Property → BETAS → beta）
2. 走 5 步关键路径 + 复现原 bug 已修
3. 如果新引入回归，**禁止 promote**，回 Step 1

### Step 4: Promote beta → default

Steamworks portal：

1. App → SteamPipe → Builds
2. 找 hotfix BuildID 那行
3. "Select a branch" → default → "Save Build"
4. Confirm

立即对所有玩家生效（Steam 客户端自动更新）。

### Step 5: 在 Steam 公告页发"已修复"

Steamworks → Edit Store Page → "Announcements" → "Add News Item":

```
Title: Hotfix 1.0.1 - <bug 简述>

We've pushed a hotfix addressing:
- <bug 1>
- <bug 2>

Steam will auto-update your install. If you experience issues,
please verify game files via Properties → Local Files → Verify.

Thanks for the reports!
```

## Rollback 流程 (回上一版本)

如果 hotfix 反而引入更糟回归，rollback 到前版：

### Steamworks portal

1. App → SteamPipe → Builds → 找上一个 BuildID（hotfix 之前的）
2. "Select a branch" → default → "Save Build"
3. 玩家自动收上一版

### 注意

- Steam Cloud 存档**不会回滚**（玩家本地存档保留 hotfix 期间的更改）
- 如果 hotfix 引入存档格式不兼容，rollback 后老玩家可能存档读不出 → 必须再发个 hotfix 修存档迁移逻辑

## 沉淀

每次 hotfix / rollback 后写 retrospective 到 `docs/postmortems/<date>-<short>.md`：

- 原因
- 影响范围（玩家数 / 损失收入）
- 修复时间线
- 教训
- 防御措施（加什么自动化测试）
```

- [ ] **Step 3: 在 ROLLBACK_PLAN.md 描述的 beta-to-default 流程上做一次 dry run**

不发实际 hotfix，但**演练一次**：

1. 在 hotfix 分支随便加个 comment
2. 跑 `tools/build_all.sh all`（不公证，节省时间）
3. setlive "beta" 上传到 Steamworks
4. 切自己 Steam 客户端到 beta branch 看下载到了新 build
5. **不 promote** 到 default，仅演练到这里
6. 改回 setlive ""，删 hotfix 分支

这一步是为了发布前**熟悉应急流程**，避免真出事时第一次摸索。

- [ ] **Step 4: Commit**

```bash
git add marketing/POST_LAUNCH_MONITORING.md marketing/ROLLBACK_PLAN.md
git commit -m "docs(post-launch): monitoring dashboard + rollback / hotfix procedure"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M11 spec 验收门槛全覆盖：
- ✅ 商店描述 3 语言 + age rating + tags → Task 1
- ✅ 价格 PRICING.md + Steamworks 配置 → Task 2
- ✅ STEAM_APP_ID 480 → 真 ID, 独立 commit → Task 3
- ✅ 4 平台 final build + 公证 + 上传 → Task 4
- ✅ 提交 Steam 审核 → Task 5
- ✅ 常见拒因清单 (8 类) → Task 6 (REJECTION_CHECKLIST.md)
- ✅ Tue/Wed 黄金日 launch → Task 8 (LAUNCH_PLAN.md)
- ✅ Day 1-7 监控 → Task 9 (POST_LAUNCH_MONITORING.md)
- ✅ Rollback 预案 → Task 9 (ROLLBACK_PLAN.md, 含 dry-run)
- ✅ Final smoke test → Task 7 (test_final_smoke.gd 8 项校验)

**2. Placeholder scan**: `<APP_ID>` / `<REAL_APP_ID>` / `<your-steamworks-username>` / `<YYYY-MM-DD>` / `2027-XX-XX` 是预期用户填的位（App ID 来自 M0 异步流程拿到；launch 日期 M11 末选定）。

**3. Type consistency**: STEAM_APP_ID 在 Task 3 替换 + Task 7 test_final_smoke 校验「不再为 480」+ 「> 1_000_000」一致；setlive 字符串在 Task 4 (default) / Task 7 (Step 8 改回空) / Task 9 ROLLBACK_PLAN (beta → default) 三处用法一致；`tools/build_all.sh all` + `tools/mac_notarize.sh build/mac/CalendarPuzzle.zip` 在 Task 4 / Task 9 引用一致。

**4. Ambiguity**: Steam 审核结果不可控（Valve 内部规则不公开 + 3-7 工作日不固定）；plan 给了 REJECTION_CHECKLIST.md 兜底 + spec M11 留 1.5-2 周 buffer 覆盖 1-2 轮拒因。Launch 日期空着 `2027-XX-XX` 待 M11 末根据审核通过日子确定（提前 7 天定 + Tuesday/Wednesday 约束）。

无发现要修。M11 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven）。

并行化建议：

- **Week 1**：
  - Task 1 + Task 2（store description + pricing）— 1 agent，约 4-6 小时
  - Task 6（写 REJECTION_CHECKLIST + RELEASE_RUNBOOK 预防性文档）— 另一 agent，约 2-3 小时
  - Task 9（写 POST_LAUNCH_MONITORING + ROLLBACK_PLAN 预防性文档）— 第三 agent，约 2 小时
- **Week 1 末**：
  - Task 3（切真 App ID，独立 commit）
  - Task 7（写 final smoke test，与 Task 3 一起跑确认绿）
  - Task 4（构建 + 公证 + 上传）
- **Week 2**：
  - Task 5（提交 Steam 审核）
  - **异步等 3-7 工作日**
  - 如 reject，Task 6 文档已在手，按拒因修
- **Week 2-3**：
  - Approved 后选 Tue/Wed 上架日
  - Task 8 执行 launch
  - Task 9 daily check 起跑

整体 M11 走完约 1.5-2 周（含 Steam 审核异步等待）。若审核退回 2 次，可能滑到 3 周——M11 buffer 已覆盖。

**关键不可控**：Steam 审核时长是 Valve 决定的；只能耐心等，禁止上 Steam 论坛催。
