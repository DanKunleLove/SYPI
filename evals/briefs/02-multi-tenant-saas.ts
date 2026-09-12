import type { Brief } from "../types";

/** Tests tenant isolation — the single most common catastrophic SaaS bug. */
export const brief: Brief = {
  id: "02-multi-tenant-saas",
  title: "Multi-tenant HR onboarding SaaS",
  brief:
    "I want to build a SaaS product that helps companies onboard new employees. Each company " +
    "signs up, invites their HR team, and creates onboarding checklists that new hires work " +
    "through — upload your ID, sign the contract, pick your equipment. HR sees a dashboard of " +
    "who's stuck where. We'd be selling this to mid-size companies, so hopefully a few hundred " +
    "companies eventually.",
  expectedTier: 3,
  componentBudget: { min: 5, max: 12 },
  properties: [
    {
      id: "tenant-isolation",
      label: "Explicit tenant/organization boundary — company A must never see company B's data",
      detect: { any: ["tenant", "organization", "org-scoped", "workspace isolation", "row level security", "rls", "multi-tenan"] },
      severity: "critical",
    },
    {
      id: "authz",
      label: "Role-based authorization distinct from authentication (HR admin vs new hire)",
      detect: { any: ["role", "rbac", "permission", "authoriz", "access control"] },
      severity: "critical",
    },
    {
      id: "file-storage",
      label: "Document storage for IDs and signed contracts, separate from the database",
      detect: { categories: ["storage"] },
      severity: "critical",
    },
    {
      id: "pii",
      label: "Recognition that IDs and contracts are sensitive personal data",
      detect: { any: ["pii", "sensitive", "encrypt", "gdpr", "personal data", "confidential", "private"] },
      severity: "critical",
    },
    {
      id: "invitations",
      label: "An invitation flow for HR teams and new hires",
      detect: { any: ["invit", "onboard", "email", "magic link", "signup token"] },
      severity: "important",
    },
    {
      id: "checklist-state",
      label: "Checklist progress is stateful and per-hire",
      detect: { any: ["checklist", "progress", "status", "state", "step", "task"] },
      severity: "important",
    },
  ],
  ambiguityAreas: [
    { id: "tenancy-model", label: "Shared database with tenant column, or database-per-tenant?", keywords: ["tenant", "schema per", "database per", "shared database", "isolation model"] },
    { id: "sso", label: "Do enterprise buyers need SSO/SAML?", keywords: ["sso", "saml", "okta", "azure ad", "enterprise login"] },
    { id: "data-residency", label: "Where must employee data physically live?", keywords: ["residency", "region", "gdpr", "eu", "jurisdiction"] },
    { id: "offboarding", label: "What happens to documents when a company cancels?", keywords: ["offboard", "cancel", "churn", "export", "delete", "retention"] },
    { id: "esign", label: "Is contract signing legally binding e-signature?", keywords: ["e-sign", "esign", "docusign", "signature", "legally binding"] },
    { id: "file-limits", label: "Max upload size and accepted formats for ID documents?", keywords: ["file size", "max size", "format", "mime", "upload limit"] },
  ],
  forbidden: [
    { id: "premature-microservices", label: "Microservice decomposition before product-market fit", keywords: ["microservice", "service mesh"] },
    { id: "multiregion", label: "Multi-region active-active", keywords: ["multi-region", "active-active", "geo-distributed"] },
    { id: "eventsourcing", label: "Event sourcing / CQRS", keywords: ["event sourcing", "cqrs", "event store"] },
  ],
};
