/**
 * 班级码生成器
 * 格式：CLS-xxxx-xxxx-xxxx
 * 字符集：a-z0-9（排除易混淆字符 0Oo1Il）
 * 组合数：约 2.8 万亿种
 */

const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 排除 0Oo1Il
const SEGMENT_LENGTH = 4;
const SEGMENT_COUNT = 3;

/**
 * 生成随机班级码
 * @returns {string} 格式如 CLS-a7k9-x3m2-p5w8
 */
function generateClassCode() {
  const segments = [];

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    let segment = '';
    for (let j = 0; j < SEGMENT_LENGTH; j++) {
      const randomIndex = Math.floor(Math.random() * CHARSET.length);
      segment += CHARSET[randomIndex];
    }
    segments.push(segment);
  }

  return `CLS-${segments.join('-')}`;
}

/**
 * 验证班级码格式
 * @param {string} code
 * @returns {boolean}
 */
function isValidClassCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const pattern = /^CLS-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$/;
  return pattern.test(code);
}

module.exports = {
  generateClassCode,
  isValidClassCode
};
