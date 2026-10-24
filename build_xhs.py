# -*- coding: utf-8 -*-
"""把 index.html 转成小红书小工具产物：index.html + app.js（外置脚本、去 B站 SDK、换端能力）"""
import os, re, sys, shutil

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'xiaohongshu')

html = open(SRC, encoding='utf-8').read()
report = []

# ---------- 1. 抽出内联脚本 ----------
m = re.search(r'(?s)<script>\r?\n(.*?)\r?\n</script>', html)
if not m:
    sys.exit('FATAL: 找不到内联 <script> 块')
js = m.group(1)
html_no_js = html[:m.start()] + '<!-- 脚本外置：见 app.js -->\n<script src="./app.js"></script>' + html[m.end():]
report.append('抽出内联脚本 %d 字符' % len(js))

# ---------- 2. 去掉 B站 SDK 外链 ----------
before = html_no_js
html_no_js = re.sub(r'(?m)^\s*<!--[^\n]*Toy SDK[^\n]*-->\s*\n', '', html_no_js)
html_no_js = re.sub(r'(?m)^\s*<script src="//s1\.hdslb\.com[^"]*"></script>\s*\n?', '', html_no_js)
report.append('移除 B站 SDK 外链' if html_no_js != before else 'WARN: 未找到 B站 SDK 行')

# ---------- 3. 战报页按钮改成小红书能力 ----------
old_share = re.search(r'(?s)<p class="hint" id="share-hint">.*?</p>', html_no_js)
if old_share:
    html_no_js = html_no_js.replace(old_share.group(0), '<p class="hint" id="share-hint">保存图片会直接存进系统相册；也可以一键发成笔记</p>')
    report.append('更新战报页提示文案')

# 复制文案（剪贴板被容器禁用）→ 换成「发笔记」
html_no_js = html_no_js.replace(
    '<button class="btn ghost" id="btn-copy">复制文案</button>',
    '<button class="btn ghost" id="btn-postnote">发笔记</button>')
html_no_js = html_no_js.replace(
    '<button class="btn ghost" id="btn-bshare" hidden>分享到 B站</button>', '')
report.append('复制文案 → 发笔记')

# ---------- 4. CSS 基线补丁（Chrome 61） ----------
CSS_PATCH = """
  /* ===== Chrome 61 基线补丁：先给可用值，再用现代语法增强 ===== */
  .panel{width:86%}
  .panel.wide{width:92%;width:min(760px,92%)}
  .levels{max-height:56vh;max-height:min(56vh,calc(430px * var(--u)))}
  .dexlist{max-height:50vh}
  #share-img{height:46vh}
  .controls{right:calc(22px * var(--u));bottom:calc(18px * var(--u))}
  @supports (padding-bottom:env(safe-area-inset-bottom)){
    .controls{
      right:calc(22px * var(--u) + env(safe-area-inset-right,0px));
      bottom:calc(18px * var(--u) + env(safe-area-inset-bottom,0px));
    }
  }
  /* flex gap 在 Chrome 61 不生效：检测失败时用外边距兜底 */
  html.no-flex-gap .btnrow > *{margin-right:calc(10px * var(--u))}
  html.no-flex-gap .btnrow > *:last-child{margin-right:0}
  html.no-flex-gap .how .row > *{margin-right:calc(12px * var(--u))}
  html.no-flex-gap .how .row > *:last-child{margin-right:0}
  html.no-flex-gap .stats > div{margin-right:calc(34px * var(--u))}
  html.no-flex-gap .stats > div:last-child{margin-right:0}
  html.no-flex-gap .stars > span{margin:0 calc(5px * var(--u))}
  html.no-flex-gap .lvl > *{margin-right:calc(13px * var(--u))}
  html.no-flex-gap .lvl > *:last-child{margin-right:0}
  html.no-flex-gap .controls > *{margin-right:calc(9px * var(--u))}
  html.no-flex-gap .controls > *:last-child{margin-right:0}
  html.no-flex-gap .set-row > *{margin-right:calc(9px * var(--u))}
  html.no-flex-gap .set-row > *:last-child{margin-right:0}
  html.no-flex-gap .tabs > *{margin:0 calc(5px * var(--u))}
  html.no-flex-gap .dexskin > *{margin-right:calc(10px * var(--u))}
  html.no-flex-gap .dexskin > *:last-child{margin-right:0}
  html.no-flex-gap .hud-block > *{margin-bottom:calc(3px * var(--u))}
  html.no-flex-gap .hud-block > *:last-child{margin-bottom:0}
  html.no-flex-gap .lvl-main > *{margin-bottom:calc(1px * var(--u))}
  html.no-flex-gap .lvl-main > *:last-child{margin-bottom:0}
  html.no-flex-gap .sk-main > *{margin-bottom:2px}
  html.no-flex-gap .sk-main > *:last-child{margin-bottom:0}
"""
html_no_js = html_no_js.replace('<style>', '<style>' + CSS_PATCH, 1)
report.append('注入 CSS 基线补丁（放在样式最前，现代语法仍然覆盖它）')

# ---------- 5. 替换 JS 里的被禁能力 ----------
# 5.1 downloadCard / fallbackCopy / copyCaption 整段替换
start = js.find('  async function downloadCard() {')
end_marker = '  function togglePause() {'
end = js.find(end_marker)
if start < 0 or end < 0:
    sys.exit('FATAL: 找不到需要替换的战报函数段')

XHS_JS = r'''  /* ---- 小红书容器能力：保存相册 / 发笔记 ---- */
  function xhsMini() { return (window.xhs && window.xhs.miniTool) || null; }
  function xhsTempFile(dataUrl) {
    var m = xhsMini();
    if (!m || typeof m.writeTempFile !== 'function') return Promise.resolve(dataUrl);
    return m.writeTempFile({ data: dataUrl }).then(function (r) {
      return (r && r.filePath) || dataUrl;
    }, function () { return dataUrl; });
  }
  function saveCard() {
    if (!shareUrl) return;
    var m = xhsMini();
    if (!m || typeof m.saveImageToPhotosAlbum !== 'function') {
      toast('直接截图保存这张战报', true);
      return;
    }
    xhsTempFile(shareUrl).then(function (p) {
      return m.saveImageToPhotosAlbum({ filePath: p });
    }).then(function () { toast('已存到相册', true); },
            function () { toast('保存失败，可以直接截图', false); });
  }
  function postNoteWithCard() {
    if (!shareUrl) return;
    var m = xhsMini();
    if (!m || typeof m.postNote !== 'function') {
      toast('当前环境不支持发笔记', false);
      return;
    }
    var r = lastResult;
    var title = '夜鹭局 ' + (r ? r.score : 0) + ' 分';
    xhsTempFile(shareUrl).then(function (p) {
      return m.postNote({
        title: title.slice(0, 20),
        content: captionText().slice(0, 1000),
        pageType: 'photo_publish',
        mediaInfo: { image_resources: [{ url: p }] }
      });
    }).then(function () { toast('已打开发布页', true); },
            function () { toast('发笔记失败，可以先截图', false); });
  }
  function copyCaption() { toast('直接截图分享更方便', true); }

'''
js = js[:start] + XHS_JS + js[end:]
report.append('战报函数改为小红书方式（相册 / 发笔记）')

# 5.2 事件绑定
js = js.replace(
    "$('#btn-save').addEventListener('click', (e) => { e.stopPropagation(); downloadCard(); });",
    "$('#btn-save').addEventListener('click', (e) => { e.stopPropagation(); saveCard(); });")
# 复制文案按钮已移除，对应绑定也要删掉，否则拿到 null 会抛错
js = js.replace(
    "  $('#btn-copy').addEventListener('click', (e) => { e.stopPropagation(); copyCaption(); });\n", "")
report.append('移除已删除按钮的绑定')
old_bshare = re.search(r"(?s)  \$\('#btn-bshare'\)\.addEventListener\('click', \(e\) => \{.*?\n  \}\);\n", js)
if old_bshare:
    js = js.replace(old_bshare.group(0),
        "  $('#btn-postnote').addEventListener('click', (e) => { e.stopPropagation(); postNoteWithCard(); });\n")
    report.append('B站分享按钮 → 发笔记按钮')
else:
    report.append('WARN: 未找到 btn-bshare 绑定')

# 5.3 flex gap 能力检测
js = js.replace("  'use strict';",
    "  'use strict';\n\n  /* Chrome 61 的 flex 不支持 gap：测一下，不支持就给 html 加 no-flex-gap */\n"
    "  (function detectFlexGap() {\n"
    "    try {\n"
    "      var d = document.createElement('div');\n"
    "      d.style.cssText = 'position:absolute;left:-9999px;top:0;display:flex;gap:10px;';\n"
    "      d.innerHTML = '<i style=\"width:10px;height:10px\"></i><i style=\"width:10px;height:10px\"></i>';\n"
    "      document.body.appendChild(d);\n"
    "      var ok = d.scrollWidth >= 30;\n"
    "      document.body.removeChild(d);\n"
    "      if (!ok) document.documentElement.className += ' no-flex-gap';\n"
    "    } catch (e) { /* ignore */ }\n"
    "  })();\n", 1)
report.append('加入 flex gap 检测')

# ---------- 6. 去掉 B站 与排行榜（小红书没有榜单能力，B站痕迹会卡审核） ----------
def cut_between(text, start_marker, end_marker, label, keep_end=False, report=report):
    i = text.find(start_marker)
    if i < 0:
        report.append('WARN: 未找到 %s' % label)
        return text
    j = text.find(end_marker, i)
    if j < 0:
        report.append('WARN: 未找到 %s 的结尾' % label)
        return text
    report.append('移除 %s' % label)
    tail = text[j:] if keep_end else text[j + len(end_marker):]
    return text[:i] + tail

def cut_call(text, needle, label, report=report):
    i = text.find(needle)
    if i < 0:
        report.append('WARN: 未找到 %s' % label)
        return text
    depth = 0; j = i; started = False
    while j < len(text):
        c = text[j]
        if c == '{':
            depth += 1; started = True
        elif c == '}':
            depth -= 1
            if depth == 0 and started:
                j += 1
                break
        j += 1
    while j < len(text) and text[j] in ' \t);':
        j += 1
    while j < len(text) and text[j] in '\r\n':
        j += 1
    report.append('移除 %s' % label)
    return text[:i] + text[j:]

# --- HTML ---
html_no_js = cut_between(html_no_js,
    '    <section class="screen" data-screen="rank">', '    </section>', '榜单页面')
html_no_js = cut_between(html_no_js,
    '        <button type="button" class="myrank" id="res-rank" hidden>', '        </button>', '结算页名次胶囊')
html_no_js = html_no_js.replace('          <button class="btn ghost" id="btn-rank">看榜单</button>\n', '')
html_no_js = html_no_js.replace('<button class="linkbtn" id="btn-rank2">排行榜</button>\n', '')
html_no_js = html_no_js.replace('<button class="linkbtn" id="btn-rank2">排行榜</button>', '')

# --- JS：Toy 接入 / 云存档 / 榜单 ---
js = cut_between(js,
    '  /* ==================== B站 Toy 接入 ==================== */',
    "  function toyHas(name) { return !!(TOY && typeof TOY[name] === 'function'); }", 'Toy 接入与 mock')
js = cut_between(js,
    '  /* ---------- 云存档：本地永远是主，云只做跨设备同步 ---------- */',
    '  function starsFor(score, target) {', '云存档模块', keep_end=True)
js = cut_between(js,
    '  /* ==================== 榜单（B站 Toy） ==================== */',
    '  /* 回到菜单时把场景特效收掉', '榜单模块', keep_end=True)

for needle, label in [
    ("    if (toyHas('isSupport')) {", 'openShare 的 Toy 分支'),
    ("  if (toyHas('onContainerChange')) {", '容器监听'),
    ("  if (toyHas('getCloudStorage')) {", '启动云同步'),
]:
    js = cut_call(js, needle, label)

for needle, label in [
    ("  $('#btn-rank').addEventListener", '看榜单按钮绑定'),
    ("  $('#btn-rank2').addEventListener", '排行榜按钮绑定'),
    ("  $('#res-rank').addEventListener", '名次胶囊绑定'),
    ("  $('#btn-rankback').addEventListener", '榜单返回绑定'),
    ("  $('#rank-tabs').addEventListener", '榜单 tab 绑定'),
]:
    js = cut_call(js, needle, label)

js = js.replace("game.mode === 'dex' || game.mode === 'rank'", "game.mode === 'dex'")
js = js.replace("  else if (uiParam === 'rank') openRank(1);\n", "")
js = js.replace("  /* ---- Toy 容器适配 ---- */\n", "")
js = js.replace("  /* ---- 启动时和云端对一次存档：取星星多的那份 ---- */\n", "")

for line in [
    "toyCloudSave(false);",
    "toyCloudSave(true);",
    "toySubmitScore().then(refreshResultRank);",
]:
    js = re.sub(r'(?m)^\s*' + re.escape(line) + r'[^\n]*\n', '', js)

# 榜单 CSS 整块（从注释到 .myrank .mr-gap 结束）
html_no_js = cut_between(html_no_js,
    '  /* ---------- 榜单 ---------- */',
    '  .myrank .mr-gap{font-size:calc(10px * var(--u));letter-spacing:.06em;color:#9fb8d2}',
    '榜单样式')

# B站 字样兜底
for word in ['B站', 'bilibili', '分享到 B站']:
    n = (html_no_js + js).count(word)
    if n:
        report.append('清除 B站 字样 %s ×%d' % (word, n))
        html_no_js = html_no_js.replace(word, '')
        js = js.replace(word, '')

RESIDUE = ['B站', 'bilibili', 'toyHas', 'TOY.', 'Toy SDK', '榜单', '排行榜', 'res-rank', 'btn-rank']
left = [w for w in RESIDUE if w in html_no_js or w in js]
if left:
    report.append('!! 仍有残留: ' + ', '.join(left))
else:
    report.append('B站 / 榜单 残留检查: 通过')

# ---------- 6.5 校验没有残留被禁能力 ----------
BANNED = [r'\bfetch\(', 'XMLHttpRequest', 'navigator.clipboard', 'execCommand', 'navigator.share',
          r'a\.download', r'window\.open', r'window\.prompt', r'\beval\(', r'new Function\(',
          '<iframe', 'type="module"', r'https?://s1\.hdslb', r'location\.href =']
bad = [p for p in BANNED if re.search(p, js if 's1.hdslb' not in p else html_no_js)]
if bad:
    report.append('!! 仍有被禁能力: ' + ', '.join(bad))
else:
    report.append('被禁能力检查: 通过')

# ---------- 7. 写出 ----------
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html_no_js)
open(os.path.join(OUT, 'app.js'), 'w', encoding='utf-8').write(js)

print('\n'.join(report))
print('index.html: %d bytes, app.js: %d bytes' % (
    os.path.getsize(os.path.join(OUT, 'index.html')), os.path.getsize(os.path.join(OUT, 'app.js'))))
