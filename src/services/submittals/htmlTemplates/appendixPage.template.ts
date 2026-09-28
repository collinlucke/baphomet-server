type AppendixPageOptions = {
  imageBase64: string;
  imageMimeType: string;
};

export function appendixPageTemplate({
  imageBase64,
  imageMimeType,
}: AppendixPageOptions): string {
  const src = `data:${imageMimeType};base64,${imageBase64}`;
  return `<div class="page">
  <div style="position:absolute;top:36px;left:48px;right:48px;font-size:36px;font-weight:700;color:#136739;">Appendix</div>
  <div style="position:absolute;top:86px;left:48px;right:48px;font-size:20px;color:#333;">Plant Schedule</div>
  <div style="position:absolute;top:130px;left:48px;right:48px;bottom:48px;display:flex;align-items:center;justify-content:center;">
    <img src="${src}" alt="Plant schedule" style="max-width:100%;max-height:100%;object-fit:contain;" />
  </div>
</div>`;
}
