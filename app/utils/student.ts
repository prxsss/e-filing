export function getStudentYear(studentId: string, currentDate: Date = new Date()) {
  // เอา 2 หลักแรก
  const yearPrefix = studentId.slice(0, 2);

  // แปลงเป็นปี พ.ศ.
  const studentYear = 2500 + Number.parseInt(yearPrefix, 10);

  // ปีปัจจุบัน (แปลงเป็น พ.ศ.)
  const currentYear = currentDate.getFullYear() + 543;

  // เดือนปัจจุบัน
  const currentMonth = currentDate.getMonth() + 1;

  const yearDiff = currentYear - studentYear;

  return currentMonth < 6 ? yearDiff : yearDiff + 1;
}
