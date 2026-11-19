import { z } from 'zod'
import { isValidCpf, onlyDigits } from './format'

const password = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(72, 'A senha pode ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra')
  .regex(/\d/, 'A senha precisa ter pelo menos um número')

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginForm = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, 'Informe seu nome completo').max(120),
    email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
    cpf: z.string().refine(isValidCpf, 'CPF inválido'),
    phone: z.string().refine((v) => /^\d{10,11}$/.test(onlyDigits(v)), 'Telefone inválido'),
    password,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, 'É preciso aceitar os termos de uso e a política de privacidade'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export type RegisterForm = z.infer<typeof registerSchema>

export const resetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export type ResetForm = z.infer<typeof resetSchema>

export const ticketSchema = z.object({
  subject: z.string().trim().min(3, 'Informe o assunto').max(150),
  category: z.enum(['COTACAO', 'PAGAMENTO', 'APOLICE', 'SINISTRO', 'OUTROS'], { message: 'Escolha a categoria' }),
  policyId: z.string().optional(),
  message: z.string().trim().min(5, 'Descreva sua dúvida (mínimo 5 caracteres)').max(4000),
})
export type TicketForm = z.infer<typeof ticketSchema>

export const claimSchema = z.object({
  policyId: z.string().min(1, 'Escolha a apólice'),
  type: z.enum(['ROUBO', 'FURTO_QUALIFICADO', 'QUEBRA_ACIDENTAL', 'DANO_LIQUIDO', 'FURTO_SIMPLES'], {
    message: 'Escolha o tipo de ocorrido',
  }),
  // A regra "não pode estar no futuro" e o prazo de 30 dias são validados pela API, que usa o relógio do sistema.
  occurredAt: z
    .string()
    .min(1, 'Informe a data e hora')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Data inválida'),
  location: z.string().trim().min(3, 'Informe o local').max(200),
  description: z.string().trim().min(20, 'Descreva o ocorrido com pelo menos 20 caracteres').max(2000),
})
export type ClaimForm = z.infer<typeof claimSchema>
