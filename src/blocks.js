export function parseBlocksFromJson(data, filePath = null) {
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray(data.blocks)
  ) {
    throw new Error(
      "Invalid JSON: expected an object with key 'blocks' containing a list."
    );
  }

  const canon = [];
  data.blocks.forEach((obj, i) => {
    if (typeof obj !== "object" || obj === null) {
      throw new Error(`Invalid JSON: blocks[${i}] is not an object.`);
    }
    for (const k of ["top", "left", "width", "height"]) {
      if (!(k in obj)) {
        throw new Error(
          `Invalid JSON: blocks[${i}] missing required key '${k}'.`
        );
      }
      if (!Number.isInteger(obj[k]) || obj[k] <= 0) {
        throw new Error(
          `Invalid JSON: blocks[${i}].${k} must be a positive integer.`
        );
      }
    }
    if (obj.color != null && typeof obj.color !== "string") {
      throw new Error(
        `Invalid JSON: blocks[${i}].color must be a string if provided.`
      );
    }
    canon.push({
      x1: obj.left,
      y1: obj.top,
      x2: obj.left + obj.width,
      y2: obj.top + obj.height,
      color: obj.color ?? null,
    });
  });

  return {
    blocksMode: "json",
    blocksCount: 0,
    blocksJson: canon,
    blocksJsonPath: filePath,
  };
}

export function parseBlocksOption(blocksOpt, { readJsonFile } = {}) {
  if (blocksOpt == null) {
    return { blocksMode: "none", blocksCount: 0, blocksJson: null, blocksJsonPath: null };
  }

  const str = String(blocksOpt).trim();
  if (/^\d+$/.test(str)) {
    return {
      blocksMode: "random",
      blocksCount: Math.max(0, parseInt(str, 10)),
      blocksJson: null,
      blocksJsonPath: null,
    };
  }

  if (!readJsonFile) {
    throw new Error(
      `--blocks file paths are only supported in Node CLI, not in the browser. Use a numeric block count instead.`
    );
  }

  const data = readJsonFile(str);
  return parseBlocksFromJson(data, str);
}
