type Category = {
  categoryName: string;
};

type CoverPageTemplateOptions = {
  title: string;
  logoBase64: string;
  logoMimeType?: string;
  coverImageBase64?: string | null;
  coverImageMimeType?: string | null;
  coverImageX?: number | null;
  coverImageY?: number | null;
  coverImageWidth?: number | null;
  coverImageHeight?: number | null;
  categories: Category[];
};

export function coverPageTemplate({
  title,
  logoBase64,
  logoMimeType = "image/png",
  coverImageBase64,
  coverImageMimeType,
  coverImageX,
  coverImageY,
  coverImageWidth,
  coverImageHeight,
  categories,
}: CoverPageTemplateOptions): string {
  const logoSrc = `data:${logoMimeType};base64,${logoBase64}`;
  const coverSrc =
    coverImageBase64 && coverImageMimeType
      ? `data:${coverImageMimeType};base64,${coverImageBase64}`
      : null;

  const categoryRows = categories
    .map(
      (c) =>
        `<div style="font-size:48px;font-weight:400;color:#136739;text-shadow:0 1px 2px rgba(255,255,255,0.8);line-height:1.2;">${c.categoryName}</div>`,
    )
    .join("<div style='height:3px'></div>");

  const widthPx =
    typeof coverImageWidth === "number" && coverImageWidth > 0
      ? Math.round(coverImageWidth)
      : 490;
  const heightPx =
    typeof coverImageHeight === "number" && coverImageHeight > 0
      ? Math.round(coverImageHeight)
      : 360;
  const leftPx =
    typeof coverImageX === "number"
      ? Math.round(coverImageX)
      : Math.round((816 - widthPx) / 2);
  const topPx =
    typeof coverImageY === "number"
      ? Math.round(coverImageY)
      : Math.round((1056 - heightPx) / 2);

  const clampedWidth = Math.min(816, Math.max(1, widthPx));
  const clampedHeight = Math.min(1056, Math.max(1, heightPx));
  const clampedLeft = Math.min(816 - clampedWidth, Math.max(0, leftPx));
  const clampedTop = Math.min(1056 - clampedHeight, Math.max(0, topPx));

  const coverImageHtml = coverSrc
    ? `<img class="cover-image" src="${coverSrc}" style="left:${clampedLeft}px;top:${clampedTop}px;width:${clampedWidth}px;height:${clampedHeight}px;" />`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 816px;
    height: 1056px;
    overflow: hidden;
    background: white;
    font-family: Helvetica, Arial, sans-serif;
  }
  .page {
    width: 816px;
    height: 1056px;
    position: relative;
    background: white;
    display: flex;
    flex-direction: column;
    padding: 48px;
    overflow: hidden;
  }
  .cover-image {
    position: absolute;
    z-index: 0;
    object-fit: contain;
    border-radius: 8px;
  }
  .title {
    position: relative;
    z-index: 1;
    font-size: 82px;
    font-weight: bold;
    color: #136739;
    text-shadow: 0 2px 3px rgba(0,0,0,0.2);
    line-height: 1.2;
    white-space: pre-wrap;
    max-height: 588px;
    overflow: hidden;
  }
  .logo {
    position: absolute;
    bottom: 0;
    left: -180px;
    width: 816px;
    pointer-events: none;
    z-index: 1;
  }
  .categories {
    position: absolute;
    bottom: 48px;
    right: 48px;
    text-align: right;
    max-width: 40%;
    z-index: 1;
  }
</style>
</head>
<body>
<div class="page">
  ${coverImageHtml}
  <div class="title">${title || ""}</div>
  <img class="logo" src="${logoSrc}" />
  ${categories.length > 0 ? `<div class="categories">${categoryRows}</div>` : ""}
</div>
</body>
</html>`;
}
