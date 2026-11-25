// Throwaway stand-in for Zotero 7's local API, used to verify the import path
// without Zotero installed: node qa/mock-zotero.mjs  (listens on 127.0.0.1:23119)
import { createServer } from "node:http";

const items = [
  {
    data: {
      key: "Q1",
      itemType: "journalArticle",
      title: "The quiet architecture of a sentence",
      creators: [
        { firstName: "Ada", lastName: "Lovelace" },
        { firstName: "Grace", lastName: "Hopper" },
      ],
      date: "2026-05-01 2026-05-01",
      publicationTitle: "Journal of Writing Tools",
      volume: "12",
      issue: "3",
      pages: "41\u201358",
      DOI: "10.1000/jwt.2026.1",
      abstractNote: "A paper-shaped writing environment.",
    },
  },
  {
    data: {
      key: "Q2",
      itemType: "book",
      title: "Typesetting for humans",
      creators: [{ name: "TUG Press" }],
      date: "1999",
      publisher: "TUG Press",
      place: "Portland",
      ISBN: "978-0-000000-00-0",
    },
  },
  { data: { key: "Q3", itemType: "attachment", title: "full text.pdf", creators: [] } },
];

createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:23119");
  console.error(`mock zotero: ${request.method} ${url.pathname}${url.search}`);
  if (!url.pathname.startsWith("/api/users/0/items")) {
    response.writeHead(404);
    response.end("{}");
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(items));
}).listen(23119, "127.0.0.1", () => console.error("mock zotero listening on 23119"));
