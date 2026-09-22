import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const team = await prisma.team.upsert({
    where: { slug: 'main-team' },
    update: {},
    create: {
      name: 'Наша команда',
      slug: 'main-team',
      description: 'Рабочее пространство по обновлению сайта'
    }
  });

  const password = await bcrypt.hash('admin12345', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password,
      name: 'Администратор',
      role: 'OWNER',
      verified: true,
      teamId: team.id
    }
  });

  const inviteCode = 'WELCOME2026';
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.invitation.upsert({
    where: { code: inviteCode },
    update: { expiresAt, status: 'ACTIVE', usedCount: 0 },
    create: {
      code: inviteCode,
      role: 'MEMBER',
      expiresAt,
      maxUses: 50,
      teamId: team.id
    }
  });

  const initiative = await prisma.initiative.create({
    data: {
      title: 'Обновление главной страницы',
      description: 'Новый дизайн, новая структура блоков, ускорение загрузки',
      status: 'NOW',
      priority: 'HIGH',
      ownerId: owner.id,
      teamId: team.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.initiative.create({
    data: {
      title: 'Личный кабинет клиента',
      description: 'Авторизация, история заказов, документы',
      status: 'NEXT',
      priority: 'MEDIUM',
      ownerId: owner.id,
      teamId: team.id
    }
  });

  await prisma.initiative.create({
    data: {
      title: 'Интеграция с CRM',
      description: 'Передача заявок с сайта напрямую в CRM',
      status: 'LATER',
      priority: 'LOW',
      teamId: team.id
    }
  });

  await prisma.task.createMany({
    data: [
      {
        title: 'Собрать референсы для главной',
        description: 'Подобрать 10 примеров сайтов с хорошей структурой',
        status: 'DONE',
        priority: 'MEDIUM',
        creatorId: owner.id,
        assigneeId: owner.id,
        initiativeId: initiative.id,
        teamId: team.id
      },
      {
        title: 'Сверстать герой-блок',
        description: 'Адаптив от 360px, анимация появления',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        creatorId: owner.id,
        assigneeId: owner.id,
        initiativeId: initiative.id,
        teamId: team.id
      },
      {
        title: 'Оптимизировать изображения',
        status: 'TODO',
        priority: 'MEDIUM',
        creatorId: owner.id,
        initiativeId: initiative.id,
        teamId: team.id
      },
      {
        title: 'Дождаться доступов к хостингу',
        status: 'BLOCKED',
        priority: 'URGENT',
        creatorId: owner.id,
        teamId: team.id
      }
    ]
  });

  await prisma.idea.createMany({
    data: [
      {
        title: 'Калькулятор стоимости на главной',
        description: 'Помогает клиенту сразу прикинуть бюджет',
        status: 'DISCUSSING',
        creatorId: owner.id,
        teamId: team.id
      },
      {
        title: 'Раздел с кейсами',
        description: 'Показать реальные проекты с цифрами',
        status: 'ACCEPTED',
        creatorId: owner.id,
        teamId: team.id
      },
      {
        title: 'Тёмная тема сайта',
        status: 'NEW',
        creatorId: owner.id,
        teamId: team.id
      }
    ]
  });

  await prisma.note.createMany({
    data: [
      {
        title: 'Решения по дизайну',
        content: 'Акцентный цвет — синий. Скругления 12px. Шрифт Inter.',
        isPrivate: false,
        authorId: owner.id,
        teamId: team.id
      },
      {
        title: 'Протокол встречи 15.09',
        content: 'Договорились сначала выпустить главную, потом личный кабинет.',
        isPrivate: false,
        authorId: owner.id,
        teamId: team.id
      }
    ]
  });

  await prisma.approval.create({
    data: {
      title: 'Согласовать макет главной страницы',
      description: 'Версия 3, правки по обратной связи внесены',
      version: 'v3',
      status: 'PENDING',
      requireAll: false,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      requesterId: owner.id,
      teamId: team.id
    }
  });

  console.log('✅ Seed complete');
  console.log('');
  console.log('Вход:      admin@example.com / admin12345');
  console.log('Приглашение:', inviteCode);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
