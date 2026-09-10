import { describe, expect, it } from "vitest";
import {
  acceptanceValue,
  formatAcceptance,
  formatFrequency,
  frequencyLabel,
  frequencyValue,
} from "./format";

describe("frequencyValue / formatFrequency", () => {
  it("parses plain and percent-suffixed values", () => {
    expect(frequencyValue("62.5")).toBe(62.5);
    expect(frequencyValue("62.5%")).toBe(62.5);
    expect(formatFrequency("62.5")).toBe("62.5%");
  });
  it("scales fractions", () => {
    expect(frequencyValue("0.5")).toBe(50);
    expect(formatFrequency("0.5")).toBe("50%");
  });
  it("marks unparseable input", () => {
    expect(frequencyValue("abc")).toBe(0);
    expect(formatFrequency("abc")).toBe("—");
    expect(formatFrequency("")).toBe("—");
  });
});

describe("acceptanceValue / formatAcceptance", () => {
  it("keeps correct percents", () => {
    expect(formatAcceptance("57.8%")).toBe("57.8%");
  });
  it("repairs double-divided upstream values", () => {
    expect(acceptanceValue("0.0058")).toBe(58);
    expect(formatAcceptance("0.0058")).toBe("58%");
  });
  it("passes through missing values", () => {
    expect(formatAcceptance("N/A")).toBe("N/A");
    expect(formatAcceptance("-")).toBe("N/A");
    expect(formatAcceptance("")).toBe("N/A");
  });
});

describe("frequencyLabel", () => {
  it("bands the editorial thresholds", () => {
    expect(frequencyLabel("100")).toBe("Very high");
    expect(frequencyLabel("50")).toBe("High");
    expect(frequencyLabel("30")).toBe("Medium");
    expect(frequencyLabel("10")).toBe("Low");
    expect(frequencyLabel("0")).toBe("Very low");
  });
});
