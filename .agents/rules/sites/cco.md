<!-- web-to-mcp:managed -->
# Rule cco: chatgpt.com

Chỉ áp dụng khi hostname đúng `chatgpt.com`. Skill: `cco:fix`, file `.agents/skills/cco-project/SKILL.md`. Tra domain chính xác trong `.agents/sites.json`; không đoán namespace từ tên gần giống.

Thu thập thêm vào `artifacts/chatgpt.com/<phiên-mới>/`, giữ lịch sử và cập nhật observations qua Studio/CLI. Không nâng request chưa kiểm chứng thành API hoạt động. Chỉ thực hiện thay đổi tài khoản/dữ liệu trong phạm vi người dùng yêu cầu. Thông tin đăng nhập chỉ ở artifacts cục bộ, không nằm trong tài liệu hay Git.
