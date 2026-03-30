const fs = require("fs");
const path = require("path");

const ARTICLES_JSON_PATH = path.join(__dirname, "..", "..", "data", "articles.json");

function loadArticleIndex() {
  try {
    const raw = fs.readFileSync(ARTICLES_JSON_PATH, "utf8");
    const articles = JSON.parse(raw);
    const index = new Map();

    for (const article of articles) {
      index.set(article.id, {
        title: article.title ?? null,
        topicLabel: article.topicLabel ?? null,
        category: article.category ?? null
      });
    }

    return index;
  } catch {
    return new Map();
  }
}

module.exports = {
  loadArticleIndex
};

