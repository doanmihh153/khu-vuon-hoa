/**
 * Cấu hình toàn cục của khu vườn.
 * Mọi thông số nhạy cảm về hiệu năng đều nằm ở đây để dễ tinh chỉnh.
 */

export const QUALITY = {
    low: {
        name: "low",
        label: "Thấp",
        pixelRatio: 1,
        shadowMapSize: 0,
        shadows: false,
        flowerScale: 0.42,
        fieldDetail: 0.85,
        petalSegments: [4, 2],
        leafSegments: [4, 2],
        particleCount: 90,
        fallingPetals: 26,
        cloudCount: 8,
        butterflies: 3,
        motes: 120,
        bloomEnabled: true,
        anisotropy: 1,
    },
    medium: {
        name: "medium",
        label: "Trung bình",
        pixelRatio: 1.35,
        shadowMapSize: 1024,
        shadows: true,
        flowerScale: 0.72,
        fieldDetail: 1.15,
        petalSegments: [6, 3],
        leafSegments: [6, 3],
        particleCount: 170,
        fallingPetals: 44,
        cloudCount: 12,
        butterflies: 4,
        motes: 220,
        bloomEnabled: true,
        anisotropy: 4,
    },
    high: {
        name: "high",
        label: "Cao",
        pixelRatio: 2,
        shadowMapSize: 2048,
        shadows: true,
        flowerScale: 1,
        fieldDetail: 1.35,
        petalSegments: [9, 4],
        leafSegments: [8, 4],
        particleCount: 260,
        fallingPetals: 70,
        cloudCount: 16,
        butterflies: 6,
        motes: 340,
        bloomEnabled: true,
        anisotropy: 8,
    },
};

/** Tham số mô phỏng gió + phản hồi con trỏ. */
export const PHYSICS = {
    interactionRadius: 4.2,
    interactionStrength: 1.15,
    windStrength: 0.055,
    windDirection: [0.82, 0.57],
    springStiffness: 26,
    damping: 7.2,
    maxBendAngle: 0.42,
    recoverySpeed: 2.4,
    leafLag: 0.85,
    distanceFalloff: 1.9,
    // lắc theo chuột khi ở trên bầu trời
    skySwayRadius: 0.16,
    skySwaySpeed: 2.2,
    skySwayLag: 3.2,
};

export const CAMERA = {
    fov: 46,
    near: 0.1,
    far: 460,
    intro: { pos: [1.6, 4.4, 34], target: [0, 2.2, 4] },
    garden: { pos: [1.4, 2.05, 16.5], target: [-0.6, 1.55, 0.5] },
    overview: { pos: [0.5, 12.5, 30], target: [0, 1.4, -4] },
    minDistance: 3.2,
    maxDistance: 46,
    minPolar: 0.55,
    maxPolar: 1.47,
    autoTourRadius: 17,
    autoTourSpeed: 0.045,
};

export const GARDEN = {
    groundSize: 190,
    groundSegments: 168,
    pathWidth: 2.35,
    walkLength: 132,
};

/** Bảng màu chung của khu vườn. */
export const PALETTE = {
    skyTop: 0x9fb7e8,
    skyMid: 0xd8a9c4,
    skyHorizon: 0xffd2b4,
    skyGlow: 0xfff0cf,
    sun: 0xfff1d0,
    fog: 0xe6b9c6,
    grassA: 0x4d7a45,
    grassB: 0x6b9a54,
    grassC: 0x86ad5f,
    grassDry: 0xa8b266,
    pathA: 0xd8c9b6,
    pathB: 0xbda894,
    hedge: 0x3f6b3c,
    hedgeLight: 0x54854a,
    hillNear: 0x7e9c74,
    hillFar: 0xa2a3b4,
    leaf: 0x4e8a48,
    leafLight: 0x6ba055,
    leafDark: 0x2f6138,
    stem: 0x54803f,
};

/** Tin nhắn khi chọn hoa. */
export const FLOWER_MESSAGES = {
    rose: {
        name: "Hoa Hồng",
        latin: "Rosa · Những đóa hoa của tình yêu",
        desc: "Dịu dàng, kiêu hãnh và luôn rực rỡ. Mỗi lớp cánh xếp xoắn là một lần gấp gì thêm trong trái tim người tặng.",
        wish: "Mẹ ơi, con luôn yêu mẹ như ngày đầu tiên.",
    },
    carnation: {
        name: "Hoa Cẩm Chướng",
        latin: "Dianthus caryophyllus · Sự mộc mạc",
        desc: "Những lớp cánh mỏng xếp chồng, mép hoa xẻ nhẹ. Như tình cảm chân thành — không hào nhoáng, nhưng bền lâu.",
        wish: "Cảm ơn cô vì những năm tháng âm thầm mà thầm nhẹ nhàng.",
    },
    peony: {
        name: "Hoa Mẫu Đơn",
        latin: "Paeonia · Sự phồn hoa dịu dàng",
        desc: "Bông lớn với nhiều lớp cánh rộng cong mềm. Một tâm hồn rộn ràng, tươi mới trong từng đóa.",
        wish: "Chúc bạn luôn rạng rỡ như tháng Năm trong khu vườn này.",
    },
    tulip: {
        name: "Hoa Tulip",
        latin: "Tulipa · Một nụ cười mùa xuân",
        desc: "Sáu cánh lớn ôm trọn tâm như một chiếc chén. Đơn giản, thanh lịch và rõ ràng như một lời hứa.",
        wish: "Chúc bạn một mùa xuân mới đầy những điều tốt đẹp bất ngờ.",
    },
    daisy: {
        name: "Hoa Cúc",
        latin: "Leucanthemum · Những ngày bình yên",
        desc: "Những cánh thon dài xếp đều quanh nhụy vàng. Giản dị và đẹp như những ngày bình yên cất giữ trong ký ức.",
        wish: "Mong bạn luôn giữ được nét cười dịu dàng như thuở nhỏ này.",
    },
    chrysanthemum: {
        name: "Hoa Cúc Mùa Thu",
        latin: "Chrysanthemum · Vẻ đẹp trưởng thành",
        desc: "Hàng trăm lớp cánh nhỏ xếp chồng thành một khối tròn. Sự điềm tĩnh và bền bỉ của mùa thu.",
        wish: "Chúc bạn vẻ đẹp này càng lâu càng sâu, và mùa thu càng dịu dàng.",
    },
    orchid: {
        name: "Hoa Lan",
        latin: "Phalaenopsis · Sự thanh lịch",
        desc: "Cánh bất đối xứng, môi hoa lấp lánh sắc màu. Mang hương thơm của sự tinh tế và trí tuệ.",
        wish: "Chúc bạn luôn tinh tế, tự tin và biết trân trọng giá trị của mình.",
    },
    lily: {
        name: "Hoa Ly",
        latin: "Lilium · Vẻ đẹp thanh khiết",
        desc: "Sáu cánh dài mở rộng, đầu cánh nhọn và nhị hoa rõ ràng. Như ánh sáng đầu ngày — trong và tinh khiết.",
        wish: "Chúc bạn luôn thanh khiết và rực sáng như ánh sáng đầu ngày.",
    },
    sunflower: {
        name: "Hoa Hướng Dương",
        latin: "Helianthus · Luôn hướng về ánh sáng",
        desc: "Những cánh vàng xếp thành vòng quanh nhụy nâu đậm. Luôn quay về phía mặt trời, như cách bạn luôn tìm điều tốt đẹp.",
        wish: "Chúc bạn luôn đủ sức mạnh để ngước lên và luôn ngắm nhìn điều tốt đẹp.",
    },
    babysbreath: {
        name: "Hoa Baby's Breath",
        latin: "Gypsophila · Những điều nhỏ bé",
        desc: "Những bông nhỏ xíu trên cành mảnh, nhẹ như sương. Món quà dành cho người luôn ghi nhớ những chi tiết nhỏ.",
        wish: "Gửi bạn những điều nhỏ bé nhưng luôn bền bỉ.",
    },
    lavender: {
        name: "Hoa Oải Hương",
        latin: "Lavandula · Bình yên",
        desc: "Những cụm hoa tím nhỏ chạy dọc ngọn thân. Mùi hương dịu dàng giúp tâm trí bình yên và thư giãn.",
        wish: "Chúc bạn luôn tìm được sự bình yên trong những ngày dài.",
    },
};

/** Lời chúc nổi tại các cụm hoa đặc biệt (hiển thị luân phiên). */
export const SPECIAL_WISHES = [
    "Ngày 20/10, chúc bạn luôn được yêu thương vô điều kiện.",
    "Mong bạn mãi mãi rạng rỡ như tháng Năm này.",
    "Cảm ơn vì thế giới này đã có bạn.",
    "Bạn xứng đáng với mọi điều tốt đẹp nhất.",
    "Chúc bạn một đời bình an, hạnh phúc và đủ đầy tiếng cười.",
    "Mọi điều tốt đẹp đều đang trên đường đến với bạn.",
    "Bạn là vẻ đẹp mà thế giới này cần có.",
    "Chúc bạn luôn là chính mình — đó đã là đủ tuyệt vời.",
];

export const MUSIC = {
    /** Đặt đường dẫn tới tệp nhạc nền của bạn ở đây. Để trống = dùng âm thanh không gian tạo bằng WebAudio. */
    file: "",
    volume: 0.45,
};

export const STORAGE_KEY = "vuon-hoa-20-10/card-v1";
