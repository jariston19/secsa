import { APP_AUTHOR, APP_BUILD_MODIFIED_AT, APP_PUBLISHED_AT } from "./buildInfo";

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    if (property) tag.setAttribute("property", name);
    else tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export function applyDocumentMeta() {
  setMeta("author", APP_AUTHOR);
  setMeta("creator", APP_AUTHOR);
  setMeta(
    "description",
    `SECSA Academic Quality Assurance Portal — created by ${APP_AUTHOR}.`
  );
  setMeta("dcterms.created", APP_PUBLISHED_AT);
  setMeta("dcterms.modified", APP_BUILD_MODIFIED_AT);
  setMeta("article:published_time", APP_PUBLISHED_AT, true);
  setMeta("article:modified_time", APP_BUILD_MODIFIED_AT, true);
}
