const xlsx = require('xlsx');
const { Student } = require('../models');

// 批量导入学生
async function importStudents(file, classId) {
  try {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const students = data.map(row => ({
      class_id: classId,
      student_name: row['姓名'] || row['学生姓名'],
      student_number: row['学号'] || '',
      status: 'active'
    }));

    await Student.bulkCreate(students);
    return { success: true, count: students.length };
  } catch (error) {
    console.error('导入学生错误:', error);
    throw error;
  }
}

// 生成学生导入模板
function generateStudentTemplate() {
  const data = [
    { '姓名': '张三', '学号': '001' },
    { '姓名': '李四', '学号': '002' }
  ];

  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, '学生名单');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  importStudents,
  generateStudentTemplate
};
