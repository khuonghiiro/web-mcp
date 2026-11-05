import { ExtensionBridge } from './src/generator/extension-bridge.js';

const bridge = new ExtensionBridge();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitConnect() {
  console.log('[1] Starting bridge on 127.0.0.1:43119...');
  await bridge.start(true);
  console.log('[1] Waiting for extension auto-connect...');
  const start = Date.now();
  while (!bridge.connected && Date.now() - start < 50000) await sleep(1000);
  if (!bridge.connected) throw new Error('Extension không kết nối trong 50s. Mở flow.google.com trong Chrome, bật "Tự kết nối AI" trên tab.');
  console.log('[1] ✅ Connected! Tab:', bridge.tabUrl);
}

async function inspect() {
  const data = await bridge.rpc('inspect');
  console.log('[inspect] URL:', data.url, '| Controls:', data.controls?.length ?? 0);
  return data;
}

async function step(type: string, args: Record<string, any> = {}, value?: string) {
  console.log(`[step] ${type}`, args.selector?.slice(0, 60) || args.url || args.key || '');
  const result = await bridge.rpc('step', { step: { type, ...args }, value });
  await sleep(500);
  return result;
}

async function extract(selector: string) {
  return bridge.rpc('extract', { selector });
}

async function findControl(data: any, labelPattern: RegExp | string) {
  const pattern = typeof labelPattern === 'string' ? new RegExp(labelPattern, 'i') : labelPattern;
  return data.controls?.find((c: any) => pattern.test(c.label || ''));
}

async function main() {
  await waitConnect();

  // === STEP 1: Inspect danh sách dự án ===
  console.log('\n[2] Inspecting trang chủ Flow...');
  let page = await inspect();

  // Tìm nút "Dự án mới"
  const newProjectBtn = await findControl(page, /dự án mới/i);
  if (!newProjectBtn) {
    console.log('Controls:', page.controls?.map((c: any) => c.label).join(', '));
    throw new Error('Không tìm thấy nút Dự án mới');
  }
  console.log('[2] ✅ Tìm thấy nút:', newProjectBtn.label, '| selector:', newProjectBtn.selector.slice(0, 60));

  // === STEP 2: Click Dự án mới ===
  console.log('\n[3] Click "Dự án mới"...');
  page = await step('click', { selector: newProjectBtn.selector });
  await sleep(3000);
  page = await inspect();
  console.log('[3] URL sau click:', page.url);

  // === STEP 3: Tìm và đổi tên dự án thành "test 2" ===
  console.log('\n[4] Tìm ô tên dự án...');

  // Kiểm tra xem có nút/ô đổi tên dự án không
  const titleEditable = page.controls?.find((c: any) =>
    c.editable && (c.label?.includes('Dự án') || c.label?.includes('project') || c.tag === 'input')
  );
  
  if (titleEditable) {
    console.log('[4] Tìm thấy ô tên:', titleEditable.label, titleEditable.selector.slice(0, 80));
    await step('click', { selector: titleEditable.selector });
    await sleep(500);
    await step('fill', { selector: titleEditable.selector, parameter: 'name' }, 'test 2');
    await sleep(500);
    await step('press', { key: 'Enter' });
    await sleep(1000);
  } else {
    // Thử tìm tên project trên header/title
    console.log('[4] Không tìm thấy ô tên trực tiếp, kiểm tra controls...');
    const allLabels = page.controls?.map((c: any) => `[${c.tag}] ${c.editable ? 'EDIT ' : ''}${c.label || '(no label)'}`).join('\n  ');
    console.log('[4] Tất cả controls:\n  ' + allLabels);
    
    // Tìm theo nhiều pattern
    const titleControl = page.controls?.find((c: any) => 
      /untitled|chưa đặt tên|dự án/i.test(c.label || '') || 
      (c.tag === 'input' && c.editable)
    );
    
    if (titleControl) {
      console.log('[4] Thử với:', titleControl.label, titleControl.selector.slice(0, 80));
      await step('click', { selector: titleControl.selector });
      await sleep(1000);
      page = await inspect();
      
      const inputNow = page.controls?.find((c: any) => c.editable && c.tag === 'input');
      if (inputNow) {
        console.log('[4] Input xuất hiện, fill "test 2"');
        await step('fill', { selector: inputNow.selector, parameter: 'name' }, 'test 2');
        await step('press', { key: 'Enter' });
        await sleep(1000);
      }
    } else {
      console.log('[4] ⚠️ Không tìm thấy ô đổi tên, dự án sẽ dùng tên mặc định');
    }
  }

  page = await inspect();
  console.log('[4] URL dự án:', page.url);

  // === STEP 4: Kiểm tra đang ở trang dự án, chọn chế độ ảnh ===
  console.log('\n[5] Kiểm tra chế độ tạo ảnh...');
  
  // Tìm nút chuyển Image / chế độ ảnh nếu có
  const imageMode = page.controls?.find((c: any) => /image|ảnh|hình/i.test(c.label || ''));
  if (imageMode) {
    console.log('[5] Click chế độ ảnh:', imageMode.label);
    await step('click', { selector: imageMode.selector });
    await sleep(1500);
    page = await inspect();
  }

  // === STEP 5: Tìm ô prompt (contenteditable trong flow-rich-text-editor) ===
  console.log('\n[6] Tìm ô prompt...');
  let promptEditor = page.controls?.find((c: any) => 
    c.editable && (
      c.selector?.includes('flow-rich-text-editor') ||
      c.selector?.includes('contenteditable') ||
      c.selector?.includes('prompt') ||
      c.tag === 'div' && c.editable
    )
  );

  if (!promptEditor) {
    // Thử tìm editable div
    promptEditor = page.controls?.find((c: any) => c.editable && c.tag === 'div');
  }

  if (!promptEditor) {
    console.log('[6] Controls editable:', page.controls?.filter((c: any) => c.editable).map((c: any) => `[${c.tag}] ${c.label} | ${c.selector.slice(0, 80)}`).join('\n  '));
    throw new Error('Không tìm thấy ô nhập prompt');
  }

  console.log('[6] ✅ Prompt editor:', promptEditor.tag, promptEditor.selector.slice(0, 80));

  // === STEP 6: Chọn số lượng ảnh = 2 ===
  console.log('\n[7] Tìm control số lượng ảnh...');
  const countControl = page.controls?.find((c: any) => 
    /number|số lượng|count|images/i.test(c.label || '') ||
    (c.tag === 'select' || c.tag === 'input') && /\d/.test(c.label || '')
  );
  
  if (countControl) {
    console.log('[7] Tìm thấy control số lượng:', countControl.label);
    await step('click', { selector: countControl.selector });
    await sleep(500);
    // Tìm option "2"
    page = await inspect();
    const option2 = page.controls?.find((c: any) => c.label === '2' || c.label?.includes('2'));
    if (option2) {
      await step('click', { selector: option2.selector });
      await sleep(500);
    }
  } else {
    console.log('[7] ⚠️ Không tìm thấy control số lượng ảnh, thử tìm dropdown/slider...');
    // In ra tất cả controls để debug
    const allControls = page.controls?.map((c: any) => `[${c.tag}] ${c.editable ? 'EDIT ' : ''}${c.label || '(no label)'} | ${c.selector.slice(-40)}`);
    console.log('[7] All controls:\n  ' + allControls?.join('\n  '));
  }

  // === STEP 7: Nhập prompt và tạo ảnh ===
  console.log('\n[8] Nhập prompt...');
  await step('fill', { selector: promptEditor.selector, parameter: 'prompt' }, 'A beautiful sunset over the ocean with vibrant orange and purple colors, photorealistic');
  await sleep(1000);
  
  page = await inspect();
  console.log('[8] Sau nhập prompt, controls:', page.controls?.length);

  // Tìm nút tạo/generate
  const generateBtn = page.controls?.find((c: any) => 
    /bắt đầu tạo|generate|create|tạo ảnh|submit/i.test(c.label || '')
  );

  if (!generateBtn) {
    // Thử tìm nút aria-label phù hợp
    const btns = page.controls?.filter((c: any) => c.tag === 'button');
    console.log('[8] Buttons:', btns?.map((b: any) => b.label).join(', '));
    throw new Error('Không tìm thấy nút tạo ảnh');
  }

  console.log('[8] ✅ Nút tạo:', generateBtn.label);
  console.log('\n[9] Click tạo ảnh...');
  await step('click', { selector: generateBtn.selector });
  
  // Chờ kết quả ảnh
  console.log('[9] Chờ ảnh được tạo (tối đa 120s)...');
  const deadline = Date.now() + 120000;
  let imageFound = false;
  while (Date.now() < deadline) {
    await sleep(5000);
    page = await inspect();
    // Tìm img hoặc card kết quả
    const images = page.controls?.filter((c: any) => 
      c.tag === 'img' || /generated|result|image/i.test(c.label || '')
    );
    if (images?.length) {
      console.log('[9] ✅ Tìm thấy kết quả ảnh:', images.length, 'items');
      imageFound = true;
      break;
    }
    process.stdout.write('.');
  }

  if (imageFound) {
    console.log('\n[DONE] ✅ Tạo dự án "test 2" và ảnh thành công!');
  } else {
    console.log('\n[WARN] Hết thời gian chờ. Kiểm tra trang web để xem kết quả.');
  }

  page = await inspect();
  console.log('[DONE] URL cuối:', page.url);
  console.log('[DONE] Controls:', page.controls?.length);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
