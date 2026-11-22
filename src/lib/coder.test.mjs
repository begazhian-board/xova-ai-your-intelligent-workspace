import { test, expect } from "bun:test";
import { parseCoderOutput, mergeFiles, reviewProject, buildPreviewDoc } from "./coder.ts";

const sample = `Sure!\n<<<FILE index.html>>>\n<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>A</title><link rel="stylesheet" href="styles.css"></head><body><a href="#x">x</a><button id="b">b</button><script src="script.js"></script></body></html>\n<<<END>>>\n<<<FILE styles.css>>>\n\`\`\`css\nbody{color:red}\n\`\`\`\n<<<END>>>\n<<<FILE script.js>>>\ndocument.getElementById("b").onclick=()=>{}\n<<<SUMMARY>>>\nDone`;

test("parses files, strips fences, tolerates missing END", () => {
  const { files, summary } = parseCoderOutput(sample.replace("<<<SUMMARY>>>\nDone", ""));
  expect(files.map((f) => f.path)).toEqual(["index.html", "styles.css", "script.js"]);
  expect(files[1].content).toBe("body{color:red}\n");
  expect(summary).toBe("");
});

test("summary after END is captured", () => {
  const { summary } = parseCoderOutput(sample.replace("{}\n<<<SUMMARY>>>", "{}\n<<<END>>>\n<<<SUMMARY>>>"));
  expect(summary).toBe("Done");
});

test("rejects path traversal", () => {
  expect(parseCoderOutput("<<<FILE ../x.js>>>\na\n<<<END>>>").files).toEqual([]);
});

test("edits merge over existing files", () => {
  const out = mergeFiles([{ path: "index.html", content: "a" }, { path: "s.css", content: "b" }], [{ path: "s.css", content: "c" }]);
  expect(out.find((f) => f.path === "s.css").content).toBe("c");
  expect(out.length).toBe(2);
});

test("review flags broken anchor, missing media query, not wired ids", () => {
  const { files } = parseCoderOutput(sample);
  const keys = reviewProject(files).map((i) => i.key);
  expect(keys).toContain("brokenAnchor");
  expect(keys).toContain("noMedia");
  expect(keys).not.toContain("jsMissingId");
  expect(keys).not.toContain("missingFile");
});

test("preview inlines css and js", () => {
  const doc = buildPreviewDoc(parseCoderOutput(sample).files);
  expect(doc).toContain("body{color:red}");
  expect(doc).toContain('getElementById("b")');
  expect(doc).not.toContain('src="script.js"');
});
