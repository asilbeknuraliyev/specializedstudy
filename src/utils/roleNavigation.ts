export function roleNavigation(role: string) {
  return role === "student"
    ? [
        ["/student/dashboard", "Bugun"],
        ["/student/lessons", "Darslar"],
        ["/student/tasks", "Vazifalar"],
        ["/student/results", "Natijalar"],
        ["/student/me", "Men"],
      ]
    : role === "teacher"
      ? [
          ["/teacher/dashboard", "Bugungi darslar"],
          ["/teacher/workspace/classes", "Sinflar"],
          ["/teacher/workspace/grading", "Tekshirish"],
          ["/teacher/content", "Kontent"],
          ["/teacher/workspace/reports", "Hisobot"],
        ]
      : [
          ["/admin/dashboard", "Umumiy holat"],
          ["/admin/process", "O‘quv jarayoni"],
          ["/admin/accounts", "Foydalanuvchilar"],
          ["/admin/workspace/reports", "Hisobot"],
          ["/admin/settings", "Sozlamalar"],
        ];
}
