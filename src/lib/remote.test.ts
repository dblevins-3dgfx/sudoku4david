// Unit tests for parseSignInProof in remote.ts, run by `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSignInProof } from "./remote";

const LINK =
  "https://abc.supabase.co/auth/v1/verify?token=pkce_0123abcd&type=magiclink&redirect_to=https://dblevins-3dgfx.github.io/sudoku4david/";

describe("parseSignInProof", () => {
  it("reads the link copied from the email", () => {
    assert.deepEqual(parseSignInProof(` ${LINK}\n`), { kind: "link", tokenHash: "pkce_0123abcd", type: "magiclink" });
  });

  it("reads a first-time sign-up link", () => {
    assert.deepEqual(parseSignInProof(LINK.replace("magiclink", "signup")), {
      kind: "link",
      tokenHash: "pkce_0123abcd",
      type: "signup",
    });
  });

  it("unwraps a link that a mail app put inside its own redirect", () => {
    const wrapped = `https://www.google.com/url?q=${encodeURIComponent(LINK)}&sa=D`;
    assert.deepEqual(parseSignInProof(wrapped), { kind: "link", tokenHash: "pkce_0123abcd", type: "magiclink" });
  });

  it("reads a typed code", () => {
    assert.deepEqual(parseSignInProof("123456"), { kind: "code", code: "123456" });
  });

  it("rejects anything else", () => {
    assert.equal(parseSignInProof(""), null);
    assert.equal(parseSignInProof("12 34"), null);
    assert.equal(parseSignInProof("https://example.com/page"), null);
    assert.equal(parseSignInProof(LINK.replace("magiclink", "recovery")), null);
  });
});
