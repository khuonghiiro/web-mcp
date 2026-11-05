export function parsePairingUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error('Chưa nhập địa chỉ kết nối AI. Yêu cầu AI gọi studio_extension_pair rồi dán đầy đủ pairingUrl vào ô này. Chữ mờ trong ô chỉ là ví dụ.');
  let url;
  try { url = new URL(text); }
  catch { throw new Error('Địa chỉ kết nối không hợp lệ. Dán nguyên pairingUrl do studio_extension_pair trả về, không dùng địa chỉ website hay chuỗi có dấu …'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || !/^#[a-f0-9]{64}$/.test(url.hash)) {
    throw new Error('Mã ghép nối không đúng định dạng. Cần địa chỉ http://127.0.0.1:CỔNG/#MÃ do studio_extension_pair tạo, gồm cả phần sau dấu #.');
  }
  return url;
}
