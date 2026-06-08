/**
 * Zod-schema voor de werk.nl detail-API respons (Fase 2).
 * Vorm vastgelegd via de Task-1 spike (docs/superpowers/research/2026-06-05-werknl-detail-payload.md).
 * Tolerant: werk.nl laat velden weg of zet null. Onbekende int-codetabellen laten we links liggen.
 */

import { z } from "zod";

const EmployerSchema = z
  .object({
    referenceNumber: z.number().nullable().optional(),
    organizationName: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    sector: z.string().nullable().optional(),
    addressNetherlands: z
      .object({
        postcode: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        streetName: z.string().nullable().optional(),
        houseNumber: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .nullable()
  .default(null);

const ContactPersonSchema = z
  .object({
    referenceNumber: z.number().nullable().optional(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
  })
  .nullable()
  .default(null);

const ApplicationMethodSchema = z.object({
  sollicitatieWijze: z.number().nullable().optional(),
  urlApplicationForm: z.string().nullable().optional(),
});

const PropositionSchema = z
  .object({
    function: z
      .object({
        name: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        customDescription: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    salary: z
      .object({ type: z.number().nullable().optional(), amountIndication: z.string().nullable().optional() })
      .nullable()
      .optional(),
    contract: z.object({ type: z.number().nullable().optional() }).nullable().optional(),
    workhours: z
      .object({
        minimumHours: z.number().nullable().optional(),
        maximumHours: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    workLocation: z
      .object({
        type: z.number().nullable().optional(),
        city: z.string().nullable().optional(),
        postcode: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .nullable()
  .default(null);

export const DetailResponseSchema = z.object({
  referenceNumber: z.number(),
  source: z.string().nullable().optional(),
  employerInternalVacatureId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  modifiedDate: z.string().nullable().optional(),
  isAcquisitionNotAppreciated: z.boolean().nullable().optional(),
  isByEmployerDirectly: z.boolean().nullable().optional(),
  applicationMethods: z.array(ApplicationMethodSchema).nullable().optional().default([]),
  proposition: PropositionSchema,
  contactPerson: ContactPersonSchema,
  employer: EmployerSchema,
  cvOffer: z
    .object({
      educationLevel: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
    })
    .nullable()
    .default(null),
});

export type WerknlDetail = z.infer<typeof DetailResponseSchema>;
