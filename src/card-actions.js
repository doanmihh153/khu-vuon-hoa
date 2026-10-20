/** card-actions.js (2/2) — Copy / chia sẻ / xuất ảnh thiệp. */
export function initCardActions() {
  const toast = document.getElementById("card-toast");
  const say = (msg) => window.__cardActions?.say(msg) ?? (toast && (toast.textContent = msg));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  document.getElementById("card-copy")?.addEventListener("click", async () => {
    const a = window.__cardActions;
    const text = (a?.getBody()?.textContent || "") + "\n" + (a?.getSign()?.textContent || "");
    try { await navigator.clipboard.writeText(text); say("Đã sao chép lời chúc. Gửi tặng người thương nhé!"); }
    catch { say("Không sao chép được — hãy bôi đen và copy thủ công giúp mình."); }
  });
  document.getElementById("card-share")?.addEventListener("click", async () => {
    const a = window.__cardActions;
    const text = (a?.getBody()?.textContent || "") + "\n" + (a?.getSign()?.textContent || "");
    if (navigator.share) {
      try { await navigator.share({ title: "Thiệp 20/10", text }); } catch { /* user hủy */ }
    } else {
      try { await navigator.clipboard.writeText(text + "\n" + location.href); say("Đã copy lời chúc + link — dán vào Messenger/Zalo nhé!"); }
      catch { say("Trình duyệt chưa hỗ trợ chia sẻ — hãy copy thủ công nhé."); }
    }
  });
  document.getElementById("card-export")?.addEventListener("click", async () => {
    const a = window.__cardActions;
    try {
      const node = document.getElementById("export-card");
      if (!node) throw new Error("missing");
      node.innerHTML = "<h2 style=\"font-size:34px\">" + esc(a.getTitle().textContent) + "</h2>"
        + "<p style=\"margin-top:14px;line-height:1.85\">" + esc(a.getBody()?.textContent || "").replace(/\n/g, "<br>") + "</p>"
        + "<p style=\"margin-top:18px;font-style:italic\">" + esc(a.getSign()?.textContent || "") + "</p>";
      const { toPngWithFonts } = await import("./font-embed.js");
      const dataUrl = await toPngWithFonts(node, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "thiep-20-10.png";
      link.href = dataUrl;
      link.click();
      say("Đã lưu thiệp thành ảnh PNG.");
    } catch { say("Chưa xuất ảnh được — hãy chụp màn hình giúp mình nhé."); }
  });
}
