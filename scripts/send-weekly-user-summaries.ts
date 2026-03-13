import { execSync } from 'node:child_process';
import nodemailer from 'nodemailer';

function runSql(sql: string) {
  const cmd = `sqlite3 prisma/dev.db \"${sql.replace(/\"/g, '\\\"')}\"`;
  return execSync(cmd, { cwd: '/data/.openclaw/workspace/taskflow', encoding: 'utf8' }).trim();
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

const dryRun = process.argv.includes('--dry-run');
const SMTP_USER = process.env.SMTP_USER || 'morexpo2000@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'reitbsegzlzqgbkx';
const AUDIT_BCC = process.env.SMTP_AUDIT_BCC || 'morexpo2000@gmail.com';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

type UserRow = { id: string; email: string };

const usersRaw = runSql("select id,email from User where email is not null and email <> '';");
const users: UserRow[] = usersRaw
  ? usersRaw.split('\n').map((line) => {
      const [id, email] = line.split('|');
      return { id, email };
    }).filter((u) => !!u.id && !!u.email)
  : [];

if (users.length === 0) {
  console.log('No hay usuarios con email.');
  process.exit(0);
}

(async () => {
  for (const user of users) {
    const assignedRaw = runSql(`select count(*) from Task where ownerUserId='${user.id}';`);
    const assignedTasks = Number(assignedRaw || '0');

    const totalRaw = runSql(`select coalesce(sum(te.minutes),0) from TimeEntry te join Task t on t.id = te.taskId where te.date >= datetime('now','-7 days') and t.ownerUserId='${user.id}';`);
    const totalMinutes = Number(totalRaw || '0');

    const rowsRaw = runSql(`select t.title, sum(te.minutes) as m from TimeEntry te join Task t on t.id = te.taskId where te.date >= datetime('now','-7 days') and t.ownerUserId='${user.id}' group by te.taskId order by m desc;`);
    const rows = rowsRaw
      ? rowsRaw.split('\n').map((line) => {
          const [title, mins] = line.split('|');
          return { title: title || 'Tarea sin título', minutes: Number(mins || '0') };
        })
      : [];

    const top = rows.slice(0, 10);
    const bulletLines =
      top.length > 0
        ? top.map((r) => `- ${r.title}: ${formatHours(r.minutes)} h`).join('\n')
        : '- No hay tareas con horas registradas esta semana.';

    const recentTasksRaw = runSql(`select title,status from Task where ownerUserId='${user.id}' order by updatedAt desc limit 10;`);
    const recentTasks = recentTasksRaw
      ? recentTasksRaw.split('\n').map((line) => {
          const [title, status] = line.split('|');
          return `- ${title || 'Tarea sin título'} (${status || 'N/A'})`;
        }).join('\n')
      : '- Sin tareas asignadas.';

    const body = `Resumen semanal TaskFlow (últimos 7 días)\n\nTareas asignadas totales: ${assignedTasks}\nHoras registradas en la semana: ${formatHours(totalMinutes)} h\n\nDesglose por tarea (solo tareas con horas):\n${bulletLines}\n\nTareas recientes asignadas:\n${recentTasks}\n\nGenerado automáticamente por OpenClaw.`;

    if (dryRun) {
      console.log(`\n[DRY-RUN] ${user.email}\n${body}`);
      continue;
    }

    try {
      await transporter.sendMail({
        from: `TaskFlow Bot <${SMTP_USER}>`,
        to: user.email,
        bcc: AUDIT_BCC,
        subject: 'Resumen semanal TaskFlow',
        text: body,
      });
      console.log(`OK enviado a ${user.email}`);
    } catch (e: any) {
      console.error(`Error enviando a ${user.email}:`, e?.message || e);
    }
  }
})();
