// 迁移测试脚本
import { 
  getBoardLayout, 
  getUncoverCells, 
  checkWinCondition, 
  transformShape, 
  formatTime,
  getBlockById,
  getAllBlocks
} from '../utils/gameUtils';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

class MigrationTest {
  private results: TestResult[] = [];

  private assert(name: string, condition: boolean, message: string, data?: any) {
    this.results.push({ name, passed: condition, message, data });
  }

  runAllTests(): TestResult[] {
    this.results = [];
    
    this.testBoardLayout();
    this.testUncoverCells();
    this.testShapeTransformation();
    this.testWinCondition();
    this.testTimeFormatting();
    this.testBlockData();
    
    return this.results;
  }

  private testBoardLayout() {
    const layout = getBoardLayout();
    this.assert(
      '棋盘布局生成',
      layout.length === 8 && layout[0].length === 7,
      `应该生成8x7的棋盘布局`,
      { layout }
    );
  }

  private testUncoverCells() {
    const cells = getUncoverCells(8, 30, 5); // 8月30日星期五
    const expectedCount = 21; // 3行 * 7列
    this.assert(
      '不可覆盖单元格检测',
      cells.length === expectedCount,
      `应该检测到${expectedCount}个不可覆盖单元格`,
      { cells, count: cells.length }
    );
  }

  private testShapeTransformation() {
    const original = [[1, 1], [1, 0]];
    const rotated = transformShape(original, 'rotate');
    const flipped = transformShape(original, 'flip');
    
    this.assert(
      '方块旋转',
      rotated.length === 2 && rotated[0].length === 2,
      '旋转后的形状应该保持2x2',
      { original, rotated }
    );
    
    this.assert(
      '方块翻转',
      flipped.length === 2 && flipped[0].length === 2,
      '翻转后的形状应该保持2x2',
      { original, flipped }
    );
  }

  private testWinCondition() {
    const mockBlocks = [
      { id: 'A', shape: [[1,1,1], [1,0,0]] }, // 4个单元格
      { id: 'B', shape: [[1,1], [1,1]] },     // 4个单元格
      { id: 'C', shape: [[1,1,1,1]] },       // 4个单元格
      { id: 'D', shape: [[1], [1], [1], [1]] }, // 4个单元格
      { id: 'E', shape: [[1,1,1], [1,1,1], [1,1,1]] }, // 9个单元格
      { id: 'F', shape: [[1,1], [1,1], [1,1]] }, // 6个单元格
      { id: 'G', shape: [[1,1,1,1,1]] },     // 5个单元格
      { id: 'H', shape: [[1], [1], [1]] },   // 3个单元格
      { id: 'I', shape: [[1,1,1,1]] },       // 4个单元格
      { id: 'J', shape: [[1]] }                // 1个单元格
    ];
    
    const totalCells = 35; // 主网格区域 5x7
    const coveredCells = mockBlocks.reduce((sum, block) => {
      return sum + block.shape.flat().filter(cell => cell).length;
    }, 0);
    
    const isWin = checkWinCondition([], mockBlocks);
    
    this.assert(
      '胜利条件判断',
      coveredCells === totalCells && isWin,
      `应该正确判断胜利条件，覆盖${coveredCells}/${totalCells}个单元格`,
      { coveredCells, totalCells, isWin }
    );
  }

  private testTimeFormatting() {
    const testCases = [
      { seconds: 0, expected: '00:00' },
      { seconds: 59, expected: '00:59' },
      { seconds: 60, expected: '01:00' },
      { seconds: 3661, expected: '61:01' },
      { seconds: 3600, expected: '60:00' }
    ];

    testCases.forEach(({ seconds, expected }) => {
      const result = formatTime(seconds);
      this.assert(
        `时间格式化 ${seconds}s`,
        result === expected,
        `应该格式化为 ${expected}, 实际为 ${result}`
      );
    });
  }

  private testBlockData() {
    const allBlocks = getAllBlocks();
    const blockA = getBlockById('A');
    
    this.assert(
      '方块数据完整性',
      allBlocks.length > 0 && blockA !== undefined,
      '应该正确加载所有方块数据',
      { totalBlocks: allBlocks.length, blockA: blockA?.label }
    );
  }
}

// 运行测试
const testRunner = new MigrationTest();
const results = testRunner.runAllTests();

console.log('=== 迁移测试结果 ===');
results.forEach(result => {
  console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.message}`);
  if (result.data) {
    console.log('  数据:', JSON.stringify(result.data, null, 2));
  }
});

const passedCount = results.filter(r => r.passed).length;
const totalCount = results.length;
console.log(`\n📊 测试结果: ${passedCount}/${totalCount} 通过`);

export { MigrationTest, TestResult };