import { describe, expect, it } from "vitest";
import { buildChainMap } from "./chain-engine";
import { CHAIN_CATALOG } from "./chain-catalog";

const T2DM = "Type 2 diabetes mellitus";
const HTN = "Arterial hypertension";

describe("chain catalog safety boundary", () => {
  it("never names a medicine, a dose or a numeric target", () => {
    // "insulin resistance" and "insulin sensitivity" name a physiological
    // state, not the injected medicine, so they are removed before the drug
    // check rather than the check being loosened to let any "insulin" through.
    const text = CHAIN_CATALOG.map((link) => `${link.from} ${link.to} ${link.mechanism}`)
      .join(" ")
      .replace(/insulin (resistance|sensitivity)/gi, "");
    expect(text).not.toMatch(/\b(mg|ml|mcg|tablet|dose|dosage)\b/i);
    expect(text).not.toMatch(/metformin|lisinopril|insulin|statin|amlodipin|aspirin|ramipril/i);
    // A threshold belongs in `marker`, where the engine reads it — never in
    // prose a reader could mistake for a treatment target.
    expect(text).not.toMatch(/\d+(\.\d+)?\s*(%|mmol|mg\/dL|mmHg)/i);
  });

  it("gives every link a unique code", () => {
    const codes = CHAIN_CATALOG.map((link) => link.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("buildChainMap", () => {
  it("returns nothing for a patient with no matching diagnosis", () => {
    const map = buildChainMap({ diagnosisLabels: ["Seasonal allergic rhinitis"], labValues: {} });
    expect(map.chains).toEqual([]);
  });

  it("puts a diabetic patient on the kidney chain as a risk when no marker is on file", () => {
    const map = buildChainMap({ diagnosisLabels: [T2DM], labValues: {} });
    const kidney = map.chains.find((chain) => chain.code === "T2DM_TO_CKD");
    expect(kidney?.stage).toBe("risk");
    expect(kidney?.missingMarker).toBe("latestEgfr");
    expect(map.missingData).toContain("latestEgfr");
  });

  it("promotes the chain to early when the marker has been crossed", () => {
    const map = buildChainMap({ diagnosisLabels: [T2DM], labValues: { latestEgfr: 52 }, labUnits: { latestEgfr: "mL/min" } });
    const kidney = map.chains.find((chain) => chain.code === "T2DM_TO_CKD");
    expect(kidney?.stage).toBe("early");
    expect(kidney?.observed?.value).toBe(52);
    expect(kidney?.because).toContain("52");
  });

  it("keeps the chain at risk when the marker is on file but not crossed", () => {
    const map = buildChainMap({ diagnosisLabels: [T2DM], labValues: { latestEgfr: 95 } });
    expect(map.chains.find((chain) => chain.code === "T2DM_TO_CKD")?.stage).toBe("risk");
  });

  it("marks a chain established when its destination is already on the chart", () => {
    const map = buildChainMap({
      diagnosisLabels: [T2DM, "Diabetic nephropathy"],
      labValues: { latestEgfr: 95 },
    });
    const kidney = map.chains.find((chain) => chain.code === "T2DM_TO_CKD");
    expect(kidney?.stage).toBe("established");
    expect(kidney?.because).toMatch(/already recorded/i);
  });

  it("only fires the compound link when both conditions are present", () => {
    const one = buildChainMap({ diagnosisLabels: [T2DM], labValues: {} });
    expect(one.chains.some((chain) => chain.code === "T2DM_HTN_COMPOUND")).toBe(false);

    const both = buildChainMap({ diagnosisLabels: [T2DM, HTN], labValues: {} });
    expect(both.chains.some((chain) => chain.code === "T2DM_HTN_COMPOUND")).toBe(true);
  });

  it("sorts what has already happened above what might", () => {
    const map = buildChainMap({
      diagnosisLabels: [T2DM, HTN, "Diabetic retinopathy"],
      labValues: {},
    });
    expect(map.chains[0].stage).toBe("established");
  });

  it("is deterministic for the same snapshot", () => {
    const snapshot = { diagnosisLabels: [T2DM, HTN], labValues: { latestEgfr: 52, latestSystolicBp: 168 } };
    const a = buildChainMap(snapshot);
    const b = buildChainMap(snapshot);
    expect(a.chains).toEqual(b.chains);
  });
});
