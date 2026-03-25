const DEFAULT_BASE_URL = process.env.FEED_REFRESH_BASE_URL || "http://localhost:8787";

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    category: "All",
    limit: 5
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--base-url" && next) {
      args.baseUrl = next;
      i += 1;
      continue;
    }
    if (token === "--category" && next) {
      args.category = next;
      i += 1;
      continue;
    }
    if (token === "--limit" && next) {
      args.limit = Math.max(1, Math.min(50, Number(next) || 5));
      i += 1;
      continue;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = new URL("/feed", args.baseUrl);
  url.searchParams.set("category", args.category);
  url.searchParams.set("limit", String(args.limit));
  url.searchParams.set("refresh", "1");

  const response = await fetch(url.toString());
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!response.ok) {
    console.error(
      `[feed-refresh] failed status=${response.status} url=${url.toString()} body=${text}`
    );
    process.exit(1);
  }

  console.log(
    `[feed-refresh] ok provider=${json?.provider ?? "unknown"} snapshotDate=${
      json?.snapshotDate ?? "unknown"
    } snapshotId=${json?.snapshotId ?? "n/a"} count=${json?.count ?? 0} cached=${
      json?.cached ?? false
    }`
  );
}

main().catch((error) => {
  console.error("[feed-refresh] error", error);
  process.exit(1);
});
