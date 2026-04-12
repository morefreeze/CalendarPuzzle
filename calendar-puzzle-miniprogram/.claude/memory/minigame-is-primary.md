# 项目迁移记录

## 重要决策

**CalendarPuzzle (Taro 小程序) 已废弃，所有开发转到 minigame (原生微信小游戏)**

## 原因

1. **需求**：项目必须提交为微信小游戏，不是小程序
2. **技术限制**：Taro 框架不支持编译成微信小游戏
3. **功能完整**：minigame 已包含 CalendarPuzzle 的所有功能

## 功能对比确认

| 功能 | CalendarPuzzle | minigame | 状态 |
|------|---------------|----------|------|
| 中文标签（月份/星期/难度） | ✅ | ✅ | 已同步 |
| 体力系统 | ✅ | ✅ | 已实现 |
| 提示功能 | ✅ | ✅ | 已实现 |
| 解法计数 | ✅ | ✅ | 已实现 |
| 拼图切换 | ✅ | ✅ | 已实现 |
| 缩略图选择面板 | ✅ | ✅ | 已实现 |
| playedCombos 持久化 | ✅ | ✅ | 已实现 |
| 安全区支持（刘海屏） | ✅ | ✅ | 已实现 |
| DLX 求解器 | ✅ | ✅ | 已实现 |

## 开发规范

**以后所有开发都在 `minigame/` 目录下进行**

- 目录位置：`calendar-puzzle-miniprogram/minigame/`
- 技术栈：原生 JavaScript + Canvas
- 项目类型：微信小游戏 (compileType: "game")
- 入口文件：`game.js`

## 废弃代码

- `CalendarPuzzle/` 目录已废弃，不再维护
- 该目录使用 Taro 框架，只能编译成小程序
- 所有功能已迁移至 minigame

## 日期

2026-04-12
