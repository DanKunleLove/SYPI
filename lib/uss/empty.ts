import { deriveBudget, tierLabel } from "@/lib/uss/complexity";
import {
  USS_VERSION,
  type Uss,
  type UssSchema,
  ussDomainEnum,
  ussModeEnum,
} from "@/lib/uss/schema";
import { z } from "zod";

type Domain = z.infer<typeof ussDomainEnum>;
type Mode = z.infer<typeof ussModeEnum>;

/**
 * A valid, empty spec.
 *
 * The starting tier is 2 ("app") rather than 0: an unclassified project should
 * not begin under a budget so tight that the first generation is refused, and
 * classification replaces it on the first extraction pass anyway.
 */
export function createEmptySpec(params: {
  specId: string;
  projectId: string;
  domain?: Domain;
  mode?: Mode;
}): Uss {
  const tier = 2;
  return {
    ussVersion: USS_VERSION,
    specId: params.specId,
    projectId: params.projectId,
    domain: params.domain ?? "software",
    mode: params.mode ?? "build",
    complexity: {
      tier,
      label: tierLabel(tier),
      rationale: "Not yet classified — provisional default.",
      signals: [],
      budget: deriveBudget(tier),
      status: "UNKNOWN",
      confidence: 0,
      evidence: [],
      firstSeenVersion: 1,
    },
    entities: [],
    relations: [],
    integrity: [],
    meta: {
      coverage: 0,
      sourceKinds: [],
    },
  } satisfies z.infer<typeof UssSchema>;
}
