import type { NextApiRequest, NextApiResponse } from "next";

const MOCK_SESSION = {
  expires: "2099-12-31T23:59:59.999Z",
  user: {
    id: "user-ada",
    name: "Ada Lovelace",
    email: "ada@example.com",
    admin: true,
    canCreateOrganizations: true,
    featureFlags: {
      v4BetaToggleVisible: false,
      v4UpgradeUi: false,
      modernSession: true,
    },
    v4BetaEnabled: false,
    organizations: [
      {
        id: "org-demo",
        name: "Acme AI",
        role: "OWNER",
        plan: "cloud:pro",
        metadata: {},
        aiFeaturesEnabled: true,
        aiTelemetryEnabled: false,
        projects: [
          {
            id: "project-demo",
            name: "Support Copilot",
            role: "OWNER",
            deletedAt: null,
            retentionDays: 30,
            hasTraces: true,
            metadata: {},
            createdAt: "2026-06-01T10:00:00.000Z",
          },
        ],
      },
    ],
  },
  environment: {
    enableExperimentalFeatures: true,
    selfHostedInstancePlan: "self-hosted:enterprise",
    v4WriteMode: "dual",
  },
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") return res.status(200).json(MOCK_SESSION);
  return res.status(200).json({ ok: true });
}
