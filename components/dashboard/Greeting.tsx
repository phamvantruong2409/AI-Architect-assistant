"use client";

import { useEffect, useState } from "react";

const USAGE_START_KEY = "usage-session-start";

const TIPS = [
  "Hôm nay chúng ta thiết kế gì?",
  "Ánh sáng tự nhiên là vật liệu đẹp nhất bạn có.",
  "Mặt bằng tốt là nền tảng của mọi công trình xuất sắc.",
  "Đừng quên người dùng cuối khi phác thảo ý tưởng đầu tiên.",
  "Không gian âm cũng quan trọng như không gian dương.",
  "Một bản vẽ tay vẫn nói lên nhiều điều hơn mọi phần mềm.",
  "Tỷ lệ là ngôn ngữ bí mật của kiến trúc.",
  "Vật liệu địa phương mang lại linh hồn cho công trình.",
  "Thiết kế tốt luôn bắt đầu từ việc lắng nghe.",
  "Gió tự nhiên qua mặt bằng là điều hòa tốt nhất.",
  "Mỗi công trình là một lời hứa với không gian xung quanh.",
  "Sketching mỗi ngày giữ tư duy thiết kế luôn sắc bén.",
  "Bước ra ngoài quan sát — thực tế là nguồn cảm hứng bất tận.",
  "Chi tiết nhỏ tạo nên sự khác biệt lớn.",
  "Kiến trúc bền vững không chỉ là xu hướng — đó là trách nhiệm.",
  "Hãy thiết kế cho 50 năm tới, không chỉ hôm nay.",
  "Màu sắc ảnh hưởng đến cảm xúc hơn bạn nghĩ.",
  "Đôi khi giải pháp đơn giản nhất chính là đẹp nhất.",
  "Cây xanh trong thiết kế không chỉ đẹp — còn làm mát không gian.",
  "Hãy mô hình hóa trước khi render — hình khối quan trọng hơn chất liệu.",
  "Lắng nghe địa hình — công trình đẹp hài hòa với đất.",
  "Mỗi lần phê duyệt là cơ hội để hoàn thiện thêm một chút.",
  "Concept mạnh sẽ dẫn lối cho mọi quyết định thiết kế.",
  "Hãy đặt câu hỏi 'tại sao' trước khi quyết định 'như thế nào'.",
  "Một mặt đứng đẹp bắt đầu từ một mặt bằng mạch lạc.",
  "Đừng thiết kế cho giải thưởng — hãy thiết kế cho con người.",
  "Khoảng trống biết thở quan trọng hơn việc lấp đầy mọi mét vuông.",
  "Hướng nắng và hướng gió quyết định trước khi đặt bút vẽ.",
  "Ranh giới giữa trong và ngoài là nơi kiến trúc thật sự bắt đầu.",
  "Một thang đẹp có thể là trái tim của cả ngôi nhà.",
  "Tối ưu chi phí không có nghĩa là hy sinh ý tưởng.",
  "Học từ công trình cũ — chúng đã chịu thử thách của thời gian.",
  "Bóng đổ cũng là một phần của thiết kế, đừng bỏ quên.",
  "Trải nghiệm di chuyển qua không gian quan trọng hơn từng góc nhìn tĩnh.",
  "Vật liệu thật luôn kể câu chuyện mà render khó tả hết.",
  "Đặt mình vào vị trí người dùng và đi thử qua từng căn phòng.",
  "Một ý tưởng rõ ràng đáng giá hơn mười chi tiết cầu kỳ.",
  "Hãy giữ lại bản phác đầu tiên — đôi khi nó đúng nhất.",
  "Thiết kế thụ động trước, thiết bị cơ điện sau.",
  "Tỷ lệ con người là thước đo cuối cùng của mọi không gian.",
  "Ánh sáng buổi chiều sẽ tiết lộ vẻ đẹp thật của vật liệu.",
  "Cửa sổ không chỉ để nhìn ra — còn để đưa thiên nhiên vào.",
  "Bớt một đường nét thừa, công trình lại mạnh thêm một chút.",
  "Lắng nghe khách hàng, nhưng đừng quên vai trò dẫn dắt của bạn.",
  "Sự tĩnh lặng trong thiết kế cũng là một dạng sang trọng.",
  "Hãy để công năng và cảm xúc cùng song hành.",
];

const REST_TIPS_1H = [
  "Đã hơn 1 giờ rồi — nghỉ 10 phút để mắt được thư giãn.",
  "Đứng dậy vươn vai một chút, ý tưởng sẽ rõ hơn sau khi nghỉ ngơi.",
  "Một tách cà phê và vài phút nghỉ sẽ giúp bạn sáng tạo hơn.",
  "Nhìn ra xa 20 giây để đôi mắt được nghỉ — rồi quay lại nhé.",
  "Một quãng nghỉ ngắn thường mở ra giải pháp bạn đang tìm.",
  "Uống chút nước đi đã — não bộ cần được cấp đủ nước để sáng tạo.",
];

const REST_TIPS_5H = [
  "Nghỉ ngơi thôi, đã 5 tiếng rồi — não bộ cần nạp lại năng lượng!",
  "5 tiếng thiết kế là quá đủ — hãy nghỉ ngơi để ngày mai làm tốt hơn.",
  "Công trình tốt nhất được vẽ bởi kiến trúc sư được nghỉ ngơi đầy đủ.",
  "Đã làm việc rất chăm rồi — đứng dậy đi dạo một vòng nhé.",
  "Ý tưởng hay thường đến lúc bạn rời khỏi bàn làm việc.",
  "Sức khỏe của bạn cũng là một dự án quan trọng — hãy chăm sóc nó.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function Greeting() {
  const [greeting, setGreeting] = useState("Chào bạn");
  const [title, setTitle] = useState(TIPS[0]);
  const [userName, setUserName] = useState("bạn");

  useEffect(() => {
    const stored = localStorage.getItem("user-name");
    if (stored) setUserName(stored);

    const hour = new Date().getHours();
    if (hour < 11) setGreeting("Chào buổi sáng");
    else if (hour < 14) setGreeting("Chào buổi trưa");
    else if (hour < 18) setGreeting("Chào buổi chiều");
    else setGreeting("Chào buổi tối");

    let startTime = Number(localStorage.getItem(USAGE_START_KEY));
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(USAGE_START_KEY, String(startTime));
    }

    const updateTitle = () => {
      const elapsedHours = (Date.now() - startTime) / (1000 * 60 * 60);
      if (elapsedHours >= 5) setTitle(pickRandom(REST_TIPS_5H));
      else if (elapsedHours >= 1) setTitle(pickRandom(REST_TIPS_1H));
      else setTitle(pickRandom(TIPS));
    };

    updateTitle();
    const interval = setInterval(updateTitle, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <p className="text-sm font-medium text-white/70">
        Xin chào <span className="text-white font-semibold">{userName}</span> 👋
      </p>
      <h1 className="font-display mt-1 text-2xl tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-white/50">
        AI Architect luôn sẵn sàng hỗ trợ mọi ý tưởng của bạn.
      </p>
    </div>
  );
}
