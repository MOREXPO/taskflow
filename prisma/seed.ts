import { PrismaClient, Priority, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.taskHistory.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();

  const tasks = await prisma.task.createMany({
    data: [
      {
        title: 'Preparar informe semanal de incidencias',
        description: 'Recoger bloqueos, riesgos y próximos pasos del equipo.',
        priority: Priority.HIGH,
        status: TaskStatus.PENDING,
        tags: 'informe,operaciones',
        requester: 'Dirección',
        internalNotes: 'Enviar antes del viernes 13:00',
      },
      {
        title: 'Actualizar dashboard de ventas Q1',
        description: 'Revisar métricas y validar datos del CRM.',
        priority: Priority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        tags: 'analytics,ventas',
        requester: 'Comercial',
      },
      {
        title: 'Cerrar propuesta cliente Acme',
        description: 'Incluir cronograma final y costes ajustados.',
        priority: Priority.URGENT,
        status: TaskStatus.IN_REVIEW,
        tags: 'cliente,propuesta',
        requester: 'Cuenta Enterprise',
      },
      {
        title: 'Documentar proceso de onboarding',
        description: 'Crear checklist estándar para nuevas incorporaciones.',
        priority: Priority.LOW,
        status: TaskStatus.COMPLETED,
        tags: 'rrhh,documentación',
        requester: 'People Ops',
      },
    ],
  });

  const created = await prisma.task.findMany({ take: 4, orderBy: { createdAt: 'asc' } });

  for (const t of created) {
    await prisma.taskHistory.create({
      data: {
        taskId: t.id,
        toStatus: t.status,
        note: 'Tarea creada',
      },
    });
  }

  if (created[1]) {
    await prisma.taskComment.create({
      data: { taskId: created[1].id, content: 'Pendiente validación del equipo financiero.' },
    });
  }

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
