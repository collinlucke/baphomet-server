type MaterialPageItem = {
  id: number;
  materialName: string;
  altName?: string;
  imageUrl?: string;
  categoryName?: string;
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
    .map((row) => {
      if (row.type === "heading") {
        return `<div class="material-page-heading">${row.label}</div>`;
      }

      const { item, index } = row;
      const isEven = index % 2 === 0;
      const SKEW = 18;

      const circleHtml = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.materialName}" />`
        : `<div class="material-image-placeholder">No Image</div>`;

      const topClip = `polygon(0 0, 100% 0, calc(100% - ${SKEW}px) 100%, ${SKEW}px 100%)`;
      const bottomClip = isEven
        ? `polygon(${SKEW}px 0, 100% 0, calc(100% - ${SKEW}px) 100%, 0 100%)`
        : `polygon(0 0, calc(100% - ${SKEW}px) 0, 100% 100%, ${SKEW}px 100%)`;

      return `
        <div class="material-item ${isEven ? "even" : "odd"}">
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
