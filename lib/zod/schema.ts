import { z } from 'zod';
import { slugify } from '../server-common';
import {
  teamName,
  apiKeyId,
  slug,
  domain,
  email,
  password,
  token,
  role,
  sentViaEmail,
  domains,
  expiredToken,
  sessionId,
  recaptchaToken,
  priceId,
  quantity,
  memberId,
  inviteToken,
  url,
  endpointId,
  sentViaEmailString,
  invitationId,
  name,
  image,
  eventTypes,
} from './primitives';

export const createApiKeySchema = z.object({
  name: name(50),
});

export const deleteApiKeySchema = z.object({
  apiKeyId,
});

export const teamSlugSchema = z.object({
  slug,
});

export const updateTeamSchema = z.object({
  name: teamName,
  slug: slug.transform((slug) => slugify(slug)),
  domain,
});

export const createTeamSchema = z.object({
  name: teamName,
});

export const updateAccountSchema = z.union([
  z.object({
    email,
  }),
  z.object({
    name: name(),
  }),
  z.object({
    image,
  }),
]);

export const updatePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password,
});

export const userJoinSchema = z.union([
  z.object({
    team: teamName,
    slug,
  }),
  z.object({
    name: name(),
    email,
    password,
  }),
]);

export const resetPasswordSchema = z.object({
  password,
  token,
});

export const inviteViaEmailSchema = z.union([
  z.object({
    email,
    role,
    sentViaEmail,
  }),
  z.object({
    role,
    sentViaEmail,
    domains,
  }),
]);

export const resendLinkRequestSchema = z.object({
  email,
  expiredToken,
});

export const deleteSessionSchema = z.object({
  id: sessionId,
});

export const forgotPasswordSchema = z.object({
  email,
  recaptchaToken: recaptchaToken.optional(),
});

export const resendEmailToken = z.object({
  email,
});

export const checkoutSessionSchema = z.object({
  price: priceId,
  quantity: quantity.optional(),
});

export const updateMemberSchema = z.object({
  role,
  memberId,
});

export const acceptInvitationSchema = z.object({
  inviteToken,
});

export const getInvitationSchema = z.object({
  token: inviteToken,
});

export const webhookEndpointSchema = z.object({
  name: name(),
  url,
  eventTypes,
});

export const updateWebhookEndpointSchema = webhookEndpointSchema.extend({
  endpointId,
});

export const getInvitationsSchema = z.object({
  sentViaEmail: sentViaEmailString,
});

export const deleteInvitationSchema = z.object({
  id: invitationId,
});

export const getWebhookSchema = z.object({
  endpointId,
});

export const deleteWebhookSchema = z.object({
  webhookId: endpointId,
});

export const deleteMemberSchema = z.object({
  memberId,
});

export const deleteSoftwareSchema = z.object({
  memberId,
});

export const createSoftwareSchema = z.object({
  id: z.string(),
  teamId: z.string().min(1, 'El ID del equipo es obligatorio'),
  userId: z.string().min(1, 'El ID del usuario es obligatorio'),
  softwareName: z.string().min(1, 'El nombre del software es obligatorio'),
  status: z.string().default('pending'),
  launcher: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  fileSize: z.number().nullable().optional(),
  downloadSource: z.string().nullable().optional(),
  sha256: z.string().nullable().optional(),
  md5: z.string().nullable().optional(),
  requestedBy: z.string().nullable().optional(),
  answers: z.record(z.string()).default({})
});

export const createSoftwareRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().optional(),
  fileUrl: z.string().url().optional(),
  downloadSource: z.string().optional(),
  teamId: z.string().min(1, 'Team ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  status: z.string().default('pending'),
});

// email or slug
export const ssoVerifySchema = z
  .object({
    email: email.optional().or(z.literal('')),
    slug: slug.optional().or(z.literal('')),
  })
  .refine((data) => data.email || data.slug, {
    message: 'At least one of email or slug is required',
  });
