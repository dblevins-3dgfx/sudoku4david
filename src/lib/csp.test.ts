import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { addCsp, contentSecurityPolicy, inlineScripts, scriptHash } from "./csp";

const page =
  '<!DOCTYPE html><html><head><meta charSet="utf-8"/><script src="/_next/app.js" async=""></script></head>' +
  '<body><script>self.__next_f.push([0])</script><script id="x">alert(1)</script></body></html>';

describe("content security policy", () => {
  it("hashes the exact script text", () => {
    const expected = createHash("sha256").update("alert(1)").digest("base64");
    assert.equal(scriptHash("alert(1)"), `'sha256-${expected}'`);
  });

  it("finds inline scripts and skips external ones", () => {
    assert.deepEqual(inlineScripts(page), ["self.__next_f.push([0])", "alert(1)"]);
  });

  it("allows only listed script hashes and the Mt. Sudoku API", () => {
    const policy = contentSecurityPolicy(["alert(1)", "alert(1)"]);
    assert.ok(policy.includes(`script-src 'self' ${scriptHash("alert(1)")};`));
    assert.match(policy, /connect-src 'self' https:\/\/api\.mtsudoku\.com/);
    assert.doesNotMatch(policy, /unsafe-eval/);
    assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  });

  it("adds the tag first in <head>, once", () => {
    const html = addCsp(page, ["theme()"]);
    assert.ok(html.startsWith('<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy"'));
    assert.ok(html.includes(scriptHash("theme()")));
    assert.ok(html.includes(scriptHash("self.__next_f.push([0])")));
    assert.equal(addCsp(html), html);
  });
});
