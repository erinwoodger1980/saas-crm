import { shouldMoveToEnquiries } from "../src/services/inboxFiling";

describe("shouldMoveToEnquiries", () => {
  it("returns true for accepted with score above default threshold", () => {
    expect(shouldMoveToEnquiries("accepted", 0.7)).toBe(true);
  });
  
  it("returns false for accepted with score below default threshold", () => {
    expect(shouldMoveToEnquiries("accepted", 0.5)).toBe(false);
  });

  it("returns false for non-accepted decisions", () => {
    expect(shouldMoveToEnquiries("rejected", 0.99)).toBe(false);
    expect(shouldMoveToEnquiries("pending", 0.8)).toBe(false);
  });
});
