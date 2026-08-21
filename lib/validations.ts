import { z } from "zod";
import { isValidTimeZone } from "@/lib/timezone";

const phoneSchema = z
  .string()
  .trim()
  .min(9, "Indique um telemóvel válido")
  .max(20, "Telemóvel demasiado longo")
  .regex(/^[\d+\s()-]+$/, "O telemóvel só pode conter dígitos e símbolos +() -");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome demasiado curto").max(80),
  email: z.string().trim().email("Email inválido").toLowerCase(),
  password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres"),
  businessName: z.string().trim().min(2, "Nome do negócio demasiado curto").max(100),
  phone: phoneSchema.optional().or(z.literal("")),
  acceptTerms: z
    .boolean()
    .refine((value) => value === true, "Tem de aceitar os termos de utilização"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").toLowerCase(),
  password: z.string().min(1, "Indique a palavra-passe"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email inválido").toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16, "Link inválido"),
  password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres"),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome do serviço demasiado curto").max(80),
  durationMinutes: z.coerce
    .number()
    .int("Duração inválida")
    .min(10, "Duração mínima de 10 minutos")
    .max(480, "Duração máxima de 8 horas"),
  price: z.coerce.number().min(0, "Preço inválido").max(99999),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
});

export const createAppointmentSchema = z.object({
  userId: z.string().uuid("Negócio inválido").optional(),
  serviceId: z.string().uuid("Selecione um serviço"),
  clientName: z.string().trim().min(2, "Nome demasiado curto").max(80),
  clientPhone: phoneSchema,
  clientEmail: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  date: slotSchema.shape.date,
  time: slotSchema.shape.time,
});

export const publicBookingSchema = createAppointmentSchema.omit({ userId: true }).extend({
  companyWebsite: z.string().max(200).optional().or(z.literal("")),
});

export const updateAppointmentStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
});

export const workingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida (HH:mm)")
    .transform((value) => value.slice(0, 5)),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida (HH:mm)")
    .transform((value) => value.slice(0, 5)),
  isClosed: z.boolean(),
});

export const workingHoursSchema = z.object({
  hours: z.array(workingHourSchema).length(7, "Devem existir 7 dias"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(100),
  phone: phoneSchema.optional().or(z.literal("")),
  timezone: z
    .string()
    .min(1)
    .refine(isValidTimeZone, "Fuso horário inválido"),
  evolutionInstance: z.string().trim().max(80).optional().or(z.literal("")),
});

export const availabilityQuerySchema = z.object({
  userId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

export const availabilityRangeSchema = z.object({
  userId: z.string().uuid(),
  serviceId: z.string().uuid(),
  days: z.coerce.number().int().min(7).max(21).optional(),
});

export const qstashReminderSchema = z.object({
  appointmentId: z.string().uuid(),
  type: z.enum(["REMINDER_24H", "REMINDER_2H"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
