import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

export function sendVerificationEmail(email: string, code: string) {
  return sendEmail({
    to: email,
    subject: 'Подтвердите регистрацию',
    html: `
      <h2>Добро пожаловать!</h2>
      <p>Ваш код приглашения: <strong>${code}</strong></p>
      <p>Введите его на странице регистрации.</p>
    `,
  });
}

export function sendPasswordResetEmail(email: string, resetLink: string) {
  return sendEmail({
    to: email,
    subject: 'Восстановление пароля',
    html: `
      <h2>Восстановление пароля</h2>
      <p>Перейдите по ссылке для сброса пароля:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>Ссылка действительна 1 час.</p>
    `,
  });
}
