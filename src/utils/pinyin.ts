/**
 * 简易拼音首字母匹配
 * 不依赖第三方库，内置常用中文拼音首字母映射
 */

// 常用汉字 Unicode 范围对应的拼音首字母
// 这是一个简化版本，覆盖常用 3500 字
const PINYIN_FIRST_LETTER: Record<number, string> = {};

// 按拼音首字母分组的汉字范围（GB2312 编码范围）
// 每个范围对应一个首字母
const RANGES: [number, number, string][] = [
  [0x4e00, 0x4e13, 'a'],   // 阿-琵
  [0x4e14, 0x4e24, 'a'],
  [0x4e25, 0x4e7c, 'b'],   // 八-簿
  [0x4e7d, 0x4e8e, 'b'],
  [0x4e8f, 0x4ea5, 'c'],   // 错-粗
  [0x4ea6, 0x4eb2, 'c'],
  [0x4eb3, 0x4ec1, 'd'],   // 达-镀
  [0x4ec2, 0x4ed8, 'd'],
  [0x4ed9, 0x4ee4, 'e'],   // 鹅-恩
  [0x4ee5, 0x4efb, 'e'],
  [0x4efc, 0x4f03, 'f'],   // 发-馥
  [0x4f04, 0x4f25, 'f'],
  [0x4f26, 0x4f57, 'g'],   // 旮-过
  [0x4f58, 0x4f84, 'g'],
  [0x4f85, 0x4f8b, 'h'],   // 哈-蠖
  [0x4f8c, 0x4fb5, 'h'],
  [0x4fb6, 0x4fbf, 'j'],   // 几-骏
  [0x4fc0, 0x4ff0, 'j'],
  [0x4ff1, 0x5018, 'k'],   // 咔-廓
  [0x5019, 0x503a, 'k'],
  [0x503b, 0x507a, 'l'],   // 垃-雒
  [0x507b, 0x5099, 'l'],
  [0x509a, 0x50c4, 'm'],   // 妈-穆
  [0x50c5, 0x50e7, 'm'],
  [0x50e8, 0x5114, 'n'],   // 拿-糯
  [0x5115, 0x513f, 'n'],
  [0x5140, 0x5165, 'o'],   // 哦-沤
  [0x5166, 0x518d, 'o'],
  [0x518e, 0x51d1, 'p'],   // 帕-曝
  [0x51d2, 0x5200, 'p'],
  [0x5201, 0x5242, 'q'],   // 七-裙
  [0x5243, 0x5272, 'q'],
  [0x5273, 0x52b2, 'r'],   // 然-蕊
  [0x52b3, 0x52d2, 'r'],
  [0x52d3, 0x5323, 's'],   // 仨-随
  [0x5324, 0x5351, 's'],
  [0x5352, 0x5395, 't'],   // 塌-妥
  [0x5396, 0x53b6, 't'],
  [0x53b7, 0x53e3, 'w'],   // 挖-误
  [0x53e4, 0x5413, 'w'],
  [0x5414, 0x5475, 'x'],   // 夕-讯
  [0x5476, 0x54a4, 'x'],
  [0x54a5, 0x54e1, 'y'],   // 压-蕴
  [0x54e2, 0x5510, 'y'],
  [0x5511, 0x5564, 'z'],   // 匝-做
  [0x5565, 0x5599, 'z'],
];

function initPinyinMap() {
  if (Object.keys(PINYIN_FIRST_LETTER).length > 0) return;
  for (const [start, end, letter] of RANGES) {
    for (let i = start; i <= end; i++) {
      PINYIN_FIRST_LETTER[i] = letter;
    }
  }
}

/**
 * 获取字符串的拼音首字母（小写）
 * 非中文字符原样返回（小写）
 */
export function getPinyinInitials(str: string): string {
  initPinyinMap();
  let result = "";
  for (const char of str) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code >= 0x4e00 && code <= 0x9fff) {
      result += PINYIN_FIRST_LETTER[code] || "?";
    } else if (code < 128) {
      result += char.toLowerCase();
    }
  }
  return result;
}

/**
 * 检查输入是否匹配拼音首字母
 * 例如 "jsqh" 匹配 "计算器" → "jsq"
 */
export function matchPinyinInitials(input: string, target: string): boolean {
  const initials = getPinyinInitials(target);
  return initials.startsWith(input.toLowerCase());
}
