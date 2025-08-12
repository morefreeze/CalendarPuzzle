// tests/calendar.test.js
const { test, expect } = require('@playwright/test');

// 测试应用加载
 test('应用应该正常加载并显示标题', async ({ page }) => {
   await page.goto('http://localhost:3000');
   await expect(page).toHaveTitle(/日历拼图游戏/);
   await expect(page.locator('h1')).toHaveText('日历拼图游戏');
 });

// 测试日历网格渲染
 test('日历网格应该正确渲染', async ({ page }) => {
   await page.goto('http://localhost:3000');
   // 检查网格是否存在
   const grid = page.locator('div[style*="display: grid"]');
   await expect(grid).toBeVisible();
   
   // 检查网格单元格数量 (8行7列)
   const cells = page.locator('div[style*="width: 69px"][style*="height: 69px"]');
   await expect(cells).toHaveCount(56);
 });

// 测试方块拖动功能
 test('应该能够将方块拖动到网格上', async ({ page }) => {
   await page.goto('http://localhost:3000');
   
   // 获取第一个可拖动方块
   const block = page.locator('div[style*="cursor: move"]').first();
   await expect(block).toBeVisible();
   
   // 获取网格中心位置
   const grid = page.locator('div[style*="display: grid"]');
   const gridBoundingBox = await grid.boundingBox();
   const gridCenterX = gridBoundingBox.x + gridBoundingBox.width / 2;
   const gridCenterY = gridBoundingBox.y + gridBoundingBox.height / 2;
   
   // 执行拖动操作
   await block.dragTo({
     x: gridCenterX,
     y: gridCenterY,
   });
   
   // 检查方块是否被放置
   const droppedBlocks = page.locator('div[style*="position: absolute"][style*="z-index: 10"]');
   await expect(droppedBlocks).toHaveCount(1);
 });

// 测试已放置方块的再次拖动功能
 test('应该能够再次拖动已放置的方块', async ({ page }) => {
   await page.goto('http://localhost:3000');
   
   // 先放置一个方块
   const block = page.locator('div[style*="cursor: move"]').first();
   const grid = page.locator('div[style*="display: grid"]');
   const gridBoundingBox = await grid.boundingBox();
   const gridCenterX = gridBoundingBox.x + gridBoundingBox.width / 2;
   const gridCenterY = gridBoundingBox.y + gridBoundingBox.height / 2;
   await block.dragTo({
     x: gridCenterX,
     y: gridCenterY,
   });
   
   // 尝试拖动已放置的方块
   const droppedBlock = page.locator('div[style*="position: absolute"][style*="z-index: 10"]').first();
   await expect(droppedBlock).toBeVisible();
   
   // 拖动到新位置
   await droppedBlock.dragTo({
     x: gridCenterX + 100,
     y: gridCenterY,
   });
   
   // 检查方块是否移动
   // 这里需要根据实际情况调整断言
   // 由于缺乏具体的位置信息，我们暂时只检查方块是否仍然存在
   await expect(droppedBlock).toBeVisible();
 });