/**
 * greetings.js — Nguồn dữ liệu lời chúc duy nhất của website.
 * Tách khỏi logic render / animation theo MASTER PROMPT §10.
 *
 * Chủ dự án tự thay nội dung trong GREETINGS / CARD mà không cần chạm code khác.
 * Hỗ trợ ánh xạ qua `id` (không tự giải mã hash một chiều).
 */

export const GREETINGS = [
  {
    id: "wish-01",
    text: "Ngày 20/10, chúc bạn luôn được yêu thương vô điều kiện.",
  },
  {
    id: "wish-02",
    text: "Mong bạn mãi rạng rỡ như những đóa hoa trong khu vườn này.",
  },
  {
    id: "wish-03",
    text: "Cảm ơn vì thế giới này đã có bạn.",
  },
  {
    id: "wish-04",
    text: "Bạn xứng đáng với mọi điều tốt đẹp nhất.",
  },
  {
    id: "wish-05",
    text: "Chúc bạn một đời bình an, hạnh phúc và đủ đầy tiếng cười.",
  },
  {
    id: "wish-06",
    text: "Mọi điều tốt đẹp đều đang trên đường đến với bạn.",
  },
];

export const HERO_WISHES = GREETINGS.slice(0, 4).map((g) => g.text);

export const CARD = {
  eyebrow: "Thiệp chúc mừng · 20/10",
  title: "GỬI BẠN YÊU CỦA TÔI 💌",
  body: `Chúc bạn Giang có một ngày 20/10 thật nhiều niềm vui, luôn rạng rỡ, luôn xinh đẹp và luôn đạt được những điều mà bạn đã đặt ra nhé!

À, mà chúc bạn luôn xinh đẹp thì có vẻ hơi thừa một chút, tại vì vốn dĩ đã xinh đẹp quá rồi. Thôi thì chúc bạn ngày càng hạnh phúc, ngày càng rạng rỡ, và dù có chuyện gì xảy ra, cũng luôn giữ được nụ cười thật tươi của mình nhé!

Mong rằng mỗi ngày của bạn Giang đều sẽ tươi tắn như những bông hoa, có thật nhiều điều nhỏ bé khiến bạn vui, có thật nhiều người thương yêu và có đủ can đảm để theo đuổi mọi điều mà bạn mong muốn. Hy vọng những ngày vui sẽ đến với bạn thật nhiều, còn những ngày không vui thì sẽ trôi qua thật nhanh.

Ban đầu, bạn đã nghĩ đến việc tặng bạn Giang một bó hoa thật xinh. Nhưng rồi chợt nghĩ, hoa thật dù đẹp đến đâu cũng sẽ có ngày tàn, nên thôi, quyết định làm hẳn một vườn hoa bằng số. Vừa có hoa để ngắm, vừa có thể giữ mãi, chẳng sợ hoa tàn, cũng chẳng sợ ngày mai hoa không còn nữa. 🌷

Và hơn hết, cảm ơn bạn Giang vì đã luôn là một bông hoa thật xinh đẹp giữa thế giới này. Mong rằng dù sau này có đi đến đâu, gặp gỡ bao nhiêu người hay trải qua bao nhiêu mùa hoa, bạn vẫn sẽ luôn giữ được nét rạng rỡ rất riêng của mình, vẫn được yêu thương thật nhiều và vẫn luôn cảm thấy mình là một người thật đặc biệt.

Chúc bạn Giang một ngày 20/10 thật vui vẻ nhé! Mong rằng món quà nhỏ này sẽ khiến bạn mỉm cười, không chỉ hôm nay mà cả những ngày sau nữa.

Hihi, hoa thì có thể là hoa số, nhưng những lời chúc này là thật đó nha. 🌸`,
  sign: "",
  recipientPlaceholder: "Ví dụ: Mẹ yêu",
  senderPlaceholder: "Ví dụ: Con yêu",
};

export const QUICK_WISHES = [
  "Chúc mẹ 20/10 luôn khỏe mạnh, vui vẻ và mãi là bông hoa đẹp nhất trong lòng con.",
  "Chúc cô 20/10 dịu dàng như hoa, mỗi ngày đều nở nụ cười.",
  "Chúc bạn 20/10 rạng rỡ, tự tin và được yêu thương thật nhiều.",
  "Chúc chị 20/10 bình an, hạnh phúc và luôn xinh đẹp.",
];

export function getGreetingById(id) {
  return GREETINGS.find((g) => g.id === id) || null;
}
