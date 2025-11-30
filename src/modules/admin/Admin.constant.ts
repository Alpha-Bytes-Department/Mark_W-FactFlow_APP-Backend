export const adminOverviewGroupBy = {
  days: Array.from({ length: 31 }, (_, i) => (i + 1).toString()),
  months: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  years: Array.from({ length: 20 }, (_, i) =>
    (new Date().getFullYear() - i).toString(),
  ),
};
