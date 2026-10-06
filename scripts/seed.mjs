// Tạo data.json mẫu từ sheet "Tracking_San_Cau_Long_5.xlsx" (tháng 10/2026).
// Chạy: node scripts/seed.mjs > data.json
import { createHash, randomBytes } from 'node:crypto';

const hash = (salt, pw) => createHash('sha256').update(`${salt}:${pw}`).digest('hex');
const id = () => randomBytes(4).toString('hex');
const user = (username, name, role, memberId, pw) => { const salt = id(); return { id: id(), username, name, role, memberId, salt, hash: hash(salt, pw) }; };

const prices = { regularMale: 45000, regularFemale: 40000, guestMale: 50000, guestFemale: 45000 };
const m = (name, type, gender) => ({ id: id(), name, type, gender, phone: '', active: true });
const members = [
  m('Thiên', 'fixed', 'M'), m('Tùng', 'fixed', 'M'), m('Đạt', 'fixed', 'M'),
  m('Quý', 'regular', 'M'), m('Bảo', 'regular', 'M'), m('Sửu', 'regular', 'M'), m('Ngọc Gia', 'regular', 'F'), m('Ngọc Phúc', 'regular', 'F'),
];
const by = Object.fromEntries(members.map((x) => [x.name, x]));
const reg = (name, paid) => ({ memberId: by[name].id, amount: by[name].gender === 'F' ? prices.regularFemale : prices.regularMale, paid });
const guests = (male, female) => [
  ...Array.from({ length: male }, () => ({ id: id(), name: '', gender: 'M', amount: prices.guestMale, paid: true })),
  ...Array.from({ length: female }, () => ({ id: id(), name: '', gender: 'F', amount: prices.guestFemale, paid: true })),
];
const dates = ['01', '03', '06', '08', '10', '13', '15', '17', '20', '22', '24', '27', '29', '31'];
const played = {
  '01': { shuttles: 5, fixed: ['Thiên', 'Đạt'], regulars: [reg('Quý', false), reg('Ngọc Phúc', true)], guests: guests(3, 1), note: 'thiếu Quý' },
  '03': { shuttles: 7, fixed: ['Thiên', 'Tùng', 'Đạt'], regulars: [reg('Bảo', false)], guests: guests(2, 2), note: 'thiếu bảo' },
  '06': { shuttles: 9, fixed: ['Thiên', 'Tùng'], regulars: [reg('Bảo', false)], guests: guests(5, 0), note: 'thiếu bảo' },
};
const sessions = dates.map((d) => {
  const p = played[d] || { shuttles: 0, fixed: [], regulars: [], guests: [], note: '' };
  return { id: id(), date: `2026-10-${d}`, status: 'play', shuttles: p.shuttles, fixed: p.fixed.map((n) => by[n].id), regulars: p.regulars, guests: p.guests, passAmount: 0, note: p.note };
});
const dues = Object.fromEntries(['Thiên', 'Tùng', 'Đạt'].map((n) => [by[n].id, { expected: 700000, paid: 0, paidAt: '', note: '' }]));

const data = {
  version: 1,
  settings: { teamName: 'Team Cầu Lông', defaultDues: 700000, shuttlesPerTube: 12, maxPerSession: 8, scheduleDays: [2, 4, 6], prices, github: {}, showDemoHint: true },
  members,
  users: [user('admin', 'Thiên', 'admin', by['Thiên'].id, 'admin123'), user('tung', 'Tùng', 'editor', by['Tùng'].id, '123456'), user('dat', 'Đạt', 'viewer', by['Đạt'].id, '123456')],
  months: { '2026-10': { courtFee: 2240000, openingShuttles: 13, dues, purchases: [], expenses: [], settled: {}, sessions } },
  updatedAt: new Date().toISOString(), updatedBy: 'seed',
};
process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
