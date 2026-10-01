type MaterialPageItem = {
  id: number;
  materialName: string;
  altName?: string;
  description?: string;
  imageUrl?: string;
  categoryName?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const decodeHtml = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const isEmptyRichText = (html: string) => {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return !text && !/<img\b/i.test(html);
};

const sanitizeRichText = (html: string) => {
  const source = String(html ?? "");
  if (!source.trim()) return "";
  if (!/<[a-z][\s\S]*>/i.test(source)) {
    return escapeHtml(source).replace(/\n/g, "<br>");
  }
  const withoutScripts = source
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  const withImages = withoutScripts.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const url = decodeHtml(src?.[2] || src?.[3] || "");
    if (!/^https?:\/\//i.test(url)) return "";
    return `<img src="${escapeHtml(url)}" alt="" />`;
  });
  return withImages.replace(
    /<(?!\/?(p|br|strong|b|em|i|u|ul|ol|li|img|div|span)\b)[^>]*>/gi,
    ""
  );
};

type MaterialPageTemplateOptions = {
  items: MaterialPageItem[];
  propertyName?: string;
  opportunityName?: string;
  pageNumber?: number;
  totalPages?: number;
  logoBase64: string;
  logoMimeType?: string;
};

export function materialPageTemplate({
  items,
  propertyName,
  opportunityName,
  pageNumber,
  totalPages,
  logoBase64,
  logoMimeType = "image/png",
}: MaterialPageTemplateOptions): string {
  const logoSrc = `data:${logoMimeType};base64,${logoBase64}`;

  // Group items by category for section headings
  const sections: { categoryName: string; items: MaterialPageItem[] }[] = [];
  for (const item of items) {
    const cat = item.categoryName ?? "";
    const last = sections[sections.length - 1];
    if (last && last.categoryName === cat) {
      last.items.push(item);
    } else {
      sections.push({ categoryName: cat, items: [item] });
    }
  }

  // Build rows with headings
  type Row =
    | { type: "heading"; label: string }
    | { type: "item"; item: MaterialPageItem; index: number };
  const rows: Row[] = [];
  let itemIndex = 0;
  for (const section of sections) {
    if (section.categoryName) {
      rows.push({
        type: "heading",
        label: section.categoryName.endsWith("s")
          ? section.categoryName
          : `${section.categoryName}s`,
      });
    }
    for (const item of section.items) {
      rows.push({ type: "item", item, index: itemIndex++ });
    }
  }

  // Build footer
  const footerParts = ["MD Property Services"];
  const titleParts = [propertyName, opportunityName].filter(Boolean);
  if (titleParts.length) footerParts.push(titleParts.join(" | "));
  const pageText =
    pageNumber != null
      ? totalPages != null
        ? `Page ${pageNumber} of ${totalPages}`
        : `Page ${pageNumber}`
      : "";
  if (pageText) footerParts.push(pageText);
  const footerText = footerParts.join(" - ");

  // Build rows HTML
  const rowsHtml = rows
    .map((row, rowIdx) => {
      if (row.type === "heading") {
        return `<div class="material-page-heading">${row.label}</div>`;
      }
      const followsHeading =
        rowIdx > 0 && rows[rowIdx - 1]?.type === "heading";

      const { item, index } = row;
      const isEven = index % 2 === 0;
      const descriptionHtml =
        item.description && !isEmptyRichText(item.description)
          ? `<div class="material-description">${sanitizeRichText(item.description)}</div>`
          : "";
      const SKEW = 18;

      const circleHtml = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.materialName}" />`
        : `<div class="material-image-placeholder">No Image</div>`;

      const topClip = `polygon(0 0, 100% 0, calc(100% - ${SKEW}px) 100%, ${SKEW}px 100%)`;
      const bottomClip = isEven
        ? `polygon(${SKEW}px 0, 100% 0, calc(100% - ${SKEW}px) 100%, 0 100%)`
        : `polygon(0 0, calc(100% - ${SKEW}px) 0, 100% 100%, ${SKEW}px 100%)`;

      return `
        <div class="material-item ${isEven ? "even" : "odd"}${descriptionHtml ? " has-description" : ""}${followsHeading ? " first-in-category" : ""}">
          <div class="material-image">
            ${circleHtml}
          </div>
          <div class="ribbon-stack">
            <div class="ribbon ${isEven ? "even" : "odd"}" style="clip-path: ${topClip};">
              ${item.materialName}
            </div>
            <div class="ribbon-alt-wrapper" style="justify-content: ${isEven ? "flex-start" : "flex-end"};">
              <div class="ribbon-alt ${isEven ? "even" : "odd"}" style="width: calc(100% - 200px); clip-path: ${bottomClip};">
                ${item.altName || ""}
              </div>
            </div>
            ${descriptionHtml}
          </div>
        </div>
      `;
    })
    .join("");

  return `<div class="page">
  <img src="${logoSrc}" class="logo" style="opacity:0.06;" />
  <div class="material-page-content">
    ${rowsHtml}
  </div>
  <div class="material-page-footer">
    <div class="material-page-footer-text">${footerText}</div>
  </div>
</div>`;
}
