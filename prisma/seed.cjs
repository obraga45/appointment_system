const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function cancelToken() {
  return randomBytes(24).toString("hex");
}

const DEFAULT_HOURS = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "13:00", isClosed: true },
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", isClosed: false },
];

async function main() {
  const email = "demo@temvagas.pt";

  await prisma.notificationLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.workingHour.deleteMany();
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      name: "Ana Oliveira",
      email,
      phone: "351912345678",
      businessName: "Salão Oliveira",
      slug: "salao-oliveira",
      passwordHash: hashPassword("demo1234"),
      workingHours: { create: DEFAULT_HOURS },
      services: {
        create: [
          {
            name: "Corte de cabelo",
            durationMinutes: 45,
            price: 18,
            description: "Corte, lavagem e styling.",
          },
          {
            name: "Coloração",
            durationMinutes: 90,
            price: 45,
            description: "Coloração completa com tratamento.",
          },
          {
            name: "Barba",
            durationMinutes: 30,
            price: 12,
            description: "Aparar e modelar a barba.",
          },
        ],
      },
    },
    include: { services: true },
  });

  const corte = user.services.find((service) => service.name === "Corte de cabelo");
  const barba = user.services.find((service) => service.name === "Barba");
  const now = new Date();
  const at = (hours, minutes) => {
    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  if (corte) {
    await prisma.appointment.create({
      data: {
        userId: user.id,
        serviceId: corte.id,
        clientName: "João Martins",
        clientPhone: "351910000001",
        clientEmail: "joao@example.com",
        startTime: at(10, 0),
        endTime: at(10, 45),
        status: "CONFIRMED",
        notes: "Cliente habitual.",
        cancelToken: cancelToken(),
      },
    });
  }

  if (barba) {
    await prisma.appointment.create({
      data: {
        userId: user.id,
        serviceId: barba.id,
        clientName: "Rui Costa",
        clientPhone: "351910000002",
        startTime: at(14, 30),
        endTime: at(15, 0),
        status: "PENDING",
        cancelToken: cancelToken(),
      },
    });
  }

  console.log("Conta demo: demo@temvagas.pt / demo1234");
  console.log("Página pública: /agendar/salao-oliveira");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
